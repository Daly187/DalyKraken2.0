# Multi-Exchange Funding Strategy Database Schema

This document outlines the Firestore database collections and schema for the multi-exchange funding rate arbitrage strategy across Aster, Hyperliquid, and Liquid exchanges.

## Collections Overview

1. **fundingPositions** - Active and historical funding positions
2. **fundingRateHistory** - Historical funding rate data
3. **exchangeConfigs** - User-specific exchange configurations
4. **tradeMonitoring** - Queue for monitoring open positions

---

## 1. fundingPositions Collection

Stores all funding positions (both open and closed) across all three exchanges.

### Document Structure

```typescript
{
  // Document ID: Auto-generated

  // User Information
  userId: string;                    // Firebase Auth UID

  // Exchange & Asset
  exchange: 'aster' | 'hyperliquid' | 'liquid';
  symbol: string;                    // e.g., 'BTCUSDT', 'ETHUSDT'

  // Position Details
  side: 'long' | 'short';           // Position direction
  size: number;                      // Position size in base currency
  leverage: number;                  // Leverage used (1-125 on Aster)

  // Entry Information
  entryPrice: number;                // Entry price in quote currency
  entryFundingRate: number;          // Funding rate at entry (%)
  entryTime: number;                 // Timestamp (ms) of position entry
  entryOrderId: string;              // Exchange order ID

  // Current State
  currentPrice: number;              // Current mark price
  currentFundingRate: number;        // Current funding rate (%)
  fundingEarned: number;             // Total funding earned/paid (USD)
  unrealizedPnL: number;            // Unrealized P&L (USD)
  realizedPnL: number;              // Realized P&L (USD)

  // Exit Information (if closed)
  exitPrice?: number;                // Exit price (if position closed)
  exitTime?: number;                 // Timestamp (ms) of position exit
  exitOrderId?: string;              // Exchange order ID for exit
  exitReason?: string;               // Reason for exit (manual, threshold, stop-loss, etc.)

  // Status & Management
  status: 'open' | 'closing' | 'closed' | 'failed';
  lastFundingPayment: number;        // Timestamp of last funding payment
  nextFundingPayment: number;        // Timestamp of next funding payment
  fundingPaymentsReceived: number;   // Count of funding payments received

  // Liquidity Check Data (at entry)
  liquidityCheck: {
    volume24h: number;               // 24h volume at entry
    bidDepth: number;                // Order book bid depth
    askDepth: number;                // Order book ask depth
    spread: number;                  // Bid-ask spread (%)
    timestamp: number;               // When check was performed
  };

  // Risk Management
  stopLoss?: number;                 // Stop loss price
  takeProfit?: number;               // Take profit price
  maxDrawdown: number;               // Maximum drawdown experienced (%)

  // Metadata
  createdAt: number;                 // Timestamp (ms)
  updatedAt: number;                 // Timestamp (ms)
  notes?: string;                    // Optional user notes
}
```

### Example Document

```json
{
  "userId": "user123",
  "exchange": "aster",
  "symbol": "BTCUSDT",
  "side": "long",
  "size": 0.01,
  "leverage": 10,
  "entryPrice": 45000,
  "entryFundingRate": 0.0125,
  "entryTime": 1704067200000,
  "entryOrderId": "ASTER-ORD-123456",
  "currentPrice": 45500,
  "currentFundingRate": 0.0115,
  "fundingEarned": 5.62,
  "unrealizedPnL": 50,
  "realizedPnL": 0,
  "status": "open",
  "lastFundingPayment": 1704096000000,
  "nextFundingPayment": 1704124800000,
  "fundingPaymentsReceived": 3,
  "liquidityCheck": {
    "volume24h": 1500000000,
    "bidDepth": 500000,
    "askDepth": 480000,
    "spread": 0.02,
    "timestamp": 1704067200000
  },
  "maxDrawdown": -2.3,
  "createdAt": 1704067200000,
  "updatedAt": 1704096000000
}
```

### Indexes

- `userId` + `status` (for querying user's open positions)
- `exchange` + `status` (for exchange-specific queries)
- `symbol` + `status` (for symbol-specific analysis)
- `createdAt` (for time-based queries)

---

## 2. fundingRateHistory Collection

Stores historical funding rate data from all exchanges for analysis and charting.

### Document Structure

```typescript
{
  // Document ID: `${exchange}-${symbol}-${timestamp}`

  exchange: 'aster' | 'hyperliquid' | 'liquid';
  symbol: string;                    // e.g., 'BTCUSDT'

  // Funding Rate Data
  fundingRate: number;               // Funding rate (%)
  annualizedRate: number;            // Annualized funding rate (%)

  // Market Data
  markPrice: number;                 // Mark price at this time
  indexPrice: number;                // Index price at this time
  openInterest: number;              // Total open interest
  volume24h: number;                 // 24h volume

  // Timestamps
  timestamp: number;                 // When rate was recorded (ms)
  fundingTime: number;               // When funding was paid (ms)
  nextFundingTime: number;           // Next funding payment (ms)

  // Additional Context
  premium: number;                   // Premium/discount to index
  longShortRatio?: number;           // Long/short ratio (if available)

  createdAt: number;                 // When document was created
}
```

### Example Document

```json
{
  "exchange": "hyperliquid",
  "symbol": "BTCUSDT",
  "fundingRate": 0.0108,
  "annualizedRate": 31.752,
  "markPrice": 45250,
  "indexPrice": 45230,
  "openInterest": 125000000,
  "volume24h": 2100000000,
  "timestamp": 1704096000000,
  "fundingTime": 1704096000000,
  "nextFundingTime": 1704124800000,
  "premium": 0.044,
  "longShortRatio": 1.35,
  "createdAt": 1704096000000
}
```

### Indexes

- `exchange` + `symbol` + `timestamp` (for time series queries)
- `symbol` + `timestamp` (for cross-exchange comparison)
- `fundingRate` (for finding extreme rates)

---

## 3. exchangeConfigs Collection

Stores user-specific configuration for each exchange.

### Document Structure

```typescript
{
  // Document ID: userId

  userId: string;                    // Firebase Auth UID

  // Aster Configuration
  aster: {
    enabled: boolean;
    apiKey: string;                  // Encrypted
    apiSecret: string;               // Encrypted
    testnet: boolean;

    // Strategy Parameters
    fundingRateThreshold: number;    // Minimum funding rate to enter (%)
    positionSize: number;            // Default position size (USD)
    maxLeverage: number;             // Maximum leverage to use
    minVolume24h: number;            // Minimum 24h volume required
    maxSpread: number;               // Maximum spread allowed (%)
    minBidAskDepth: number;          // Minimum order book depth
    autoExecute: boolean;            // Auto-execute trades

    // Risk Management
    stopLossPercent: number;         // Stop loss (%)
    takeProfitPercent: number;       // Take profit (%)
    maxOpenPositions: number;        // Max concurrent positions
    maxDailyLoss: number;            // Max daily loss limit (USD)
  };

  // Hyperliquid Configuration
  hyperliquid: {
    enabled: boolean;
    privateKey: string;              // Encrypted agent wallet key
    walletAddress: string;           // Agent wallet address
    mainnet: boolean;

    // Strategy Parameters (same structure as Aster)
    fundingRateThreshold: number;
    positionSize: number;
    maxLeverage: number;
    minVolume24h: number;
    maxSpread: number;
    minBidAskDepth: number;
    autoExecute: boolean;

    // Risk Management
    stopLossPercent: number;
    takeProfitPercent: number;
    maxOpenPositions: number;
    maxDailyLoss: number;
  };

  // Liquid Configuration
  liquid: {
    enabled: boolean;
    apiToken: string;                // Encrypted
    apiSecret: string;               // Encrypted

    // Strategy Parameters
    fundingRateThreshold: number;
    positionSize: number;
    maxLeverage: number;
    minVolume24h: number;
    maxSpread: number;
    minBidAskDepth: number;
    autoExecute: boolean;

    // Risk Management
    stopLossPercent: number;
    takeProfitPercent: number;
    maxOpenPositions: number;
    maxDailyLoss: number;
  };

  // Global Settings
  global: {
    enableTelegramNotifications: boolean;
    notifyOnEntry: boolean;
    notifyOnExit: boolean;
    notifyOnFundingPayment: boolean;
    preferredExchange?: 'aster' | 'hyperliquid' | 'liquid' | 'auto';
  };

  createdAt: number;
  updatedAt: number;
}
```

---

## 4. tradeMonitoring Collection

Queue for Cloud Functions to monitor and manage open positions.

### Document Structure

```typescript
{
  // Document ID: Auto-generated

  positionId: string;                // Reference to fundingPositions doc
  userId: string;
  exchange: 'aster' | 'hyperliquid' | 'liquid';
  symbol: string;

  // Monitoring Tasks
  tasks: {
    checkFundingRate: boolean;       // Monitor funding rate changes
    checkLiquidity: boolean;         // Monitor liquidity conditions
    checkStopLoss: boolean;          // Monitor stop loss
    checkTakeProfit: boolean;        // Monitor take profit
    checkCircuitBreaker: boolean;    // Check global risk limits
  };

  // Status
  lastCheckTime: number;             // Last time position was checked
  nextCheckTime: number;             // Next scheduled check
  checkIntervalMs: number;           // How often to check (ms)

  // Alerts
  alerts: Array<{
    type: string;                    // Alert type
    message: string;                 // Alert message
    timestamp: number;               // When alert was triggered
    acknowledged: boolean;           // User acknowledgment
  }>;

  // Flags
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryCount: number;                // Number of retry attempts
  lastError?: string;                // Last error message

  createdAt: number;
  updatedAt: number;
}
```

---

## Security Rules Summary

All collections use the following security model:

1. **Authentication Required**: All reads require user authentication
2. **User Isolation**: Users can only access their own data (userId matching)
3. **Write Restrictions**: Most write operations restricted to Cloud Functions
4. **Field Validation**: CREATE operations validate required fields

See `firestore.rules` for complete security implementation.

---

## Data Flow

### 1. Position Entry
```
User Config → Funding Rate Monitor → Liquidity Check → Create Position → Update tradeMonitoring
```

### 2. Position Monitoring
```
tradeMonitoring Queue → Cloud Function → Check Conditions → Update Position → Trigger Actions
```

### 3. Funding Payment
```
Exchange Webhook → Record Payment → Update fundingPositions.fundingEarned → Log to History
```

### 4. Position Exit
```
Exit Trigger → Close Order → Update Status → Calculate Final P&L → Archive
```

---

## Cloud Function Responsibilities

### monitorFundingPositions (Scheduled - every 1 minute)
- Query `tradeMonitoring` queue
- For each position:
  - Fetch current market data
  - Check stop loss / take profit
  - Check funding rate changes
  - Check liquidity conditions
  - Execute exits if conditions met
  - Update `fundingPositions`

### recordFundingRates (Scheduled - every 5 minutes)
- Connect to each exchange WebSocket
- Fetch current funding rates
- Store in `fundingRateHistory`
- Trigger alerts for extreme rates

### executeFundingStrategy (Triggered by user or schedule)
- Check each exchange for opportunities
- Validate against user config
- Perform liquidity checks
- Execute entries
- Create monitoring tasks

---

## Query Patterns

### Get User's Open Positions
```typescript
db.collection('fundingPositions')
  .where('userId', '==', userId)
  .where('status', '==', 'open')
  .orderBy('createdAt', 'desc')
  .get();
```

### Get Funding Rate History for Symbol
```typescript
db.collection('fundingRateHistory')
  .where('symbol', '==', 'BTCUSDT')
  .where('timestamp', '>=', startTime)
  .where('timestamp', '<=', endTime)
  .orderBy('timestamp', 'asc')
  .get();
```

### Get Best Current Funding Rates
```typescript
db.collection('fundingRateHistory')
  .where('timestamp', '>=', Date.now() - 300000)  // Last 5 min
  .orderBy('fundingRate', 'desc')
  .limit(10)
  .get();
```

---

## Backup and Archival

- **Active Positions**: Kept in `fundingPositions` indefinitely
- **Closed Positions**: Archived after 90 days to `fundingPositionsArchive`
- **Funding History**: Retained for 12 months, then aggregated to daily averages
- **Monitoring Queue**: Cleaned up immediately after position closes

---

## Migration from Existing System

If migrating from an existing system:

1. Export existing positions to CSV
2. Transform to new schema format
3. Batch import via Admin SDK
4. Verify data integrity
5. Enable new monitoring functions
6. Gradually migrate users

End of schema documentation.
