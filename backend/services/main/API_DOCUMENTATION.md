# DalyKraken Backend API Documentation

## Overview

The DalyKraken backend provides a comprehensive REST API and WebSocket interface for cryptocurrency trading, portfolio management, and automated DCA (Dollar Cost Averaging) strategies.

## Base URL

```
http://localhost:5001
```

All API endpoints are prefixed with `/api`

---

## Architecture

### Directory Structure

```
src/
├── routes/              # API route handlers
│   ├── index.js        # Main router setup
│   ├── account.js      # Account endpoints
│   ├── portfolio.js    # Portfolio endpoints
│   ├── market.js       # Market data endpoints
│   ├── dcaRoutes.js    # DCA strategy endpoints
│   ├── audit.js        # Transaction audit endpoints
│   ├── settings.js     # Settings management
│   └── telegram.js     # Telegram integration
├── services/           # Business logic services
│   ├── krakenService.js    # Kraken API integration
│   ├── dcaService.js       # DCA automation
│   ├── scannerService.js   # Market scanning
│   └── dataStore.js        # In-memory caching
├── websocket/          # WebSocket handlers
│   └── index.js        # WebSocket server setup
├── utils/              # Utilities
│   └── logger.js       # Winston logger
└── server.js           # Express server entry point
```

---

## REST API Endpoints

### Account Endpoints

#### GET /api/account/balance
Get account balance for all assets.

**Response:**
```json
{
  "success": true,
  "data": {
    "ZUSD": "10000.00",
    "XXBT": "0.5",
    "XETH": "2.5"
  },
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

#### GET /api/account/info
Get comprehensive account information.

#### GET /api/account/trade-balance
Get trade balance including margin and equity.

#### GET /api/account/volume
Get account trading volume and fee tier.

---

### Portfolio Endpoints

#### GET /api/portfolio/overview
Get complete portfolio overview with holdings and performance.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalValue": 76250.50,
    "holdings": [
      {
        "asset": "BTC",
        "amount": 0.5,
        "price": 45000.50,
        "value": 22500.25,
        "percentage": 29.5
      }
    ],
    "assetCount": 4,
    "lastUpdated": "2025-10-17T12:00:00.000Z"
  },
  "cached": false,
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

#### GET /api/portfolio/holdings
Get current holdings with current prices.

#### GET /api/portfolio/performance
Get portfolio performance metrics.

**Query Parameters:**
- `period` - Time period (24h, 7d, 30d, 90d, 1y)

#### GET /api/portfolio/allocation
Get asset allocation breakdown.

---

### Market Endpoints

#### GET /api/market/overview
Get market overview with key statistics.

#### GET /api/market/top20
Get top 20 cryptocurrencies by market cap/volume.

#### GET /api/market/prices
Get live prices for specified pairs or all pairs.

**Query Parameters:**
- `pairs` - Comma-separated list of pairs (e.g., "XXBTZUSD,XETHZUSD")

#### GET /api/market/ticker/:pair
Get detailed ticker information for a specific pair.

**Example:** `/api/market/ticker/XXBTZUSD`

#### GET /api/market/ohlc/:pair
Get OHLC (candlestick) data for a pair.

**Query Parameters:**
- `interval` - Interval in minutes (1, 5, 15, 30, 60, 240, 1440, 10080, 21600)

#### GET /api/market/orderbook/:pair
Get order book data for a pair.

**Query Parameters:**
- `count` - Number of orders to return (default: 10)

#### GET /api/market/trades/:pair
Get recent trades for a pair.

**Query Parameters:**
- `since` - Return trades since this timestamp

#### GET /api/market/spread/:pair
Get bid/ask spread for a pair.

---

### DCA Endpoints

#### GET /api/dca/status
Get current DCA service status and active strategies.

**Response:**
```json
{
  "success": true,
  "data": {
    "initialized": true,
    "totalStrategies": 3,
    "activeStrategies": 2,
    "totalExecutions": 15,
    "strategies": [
      {
        "id": "dca_1234567890_abc123",
        "pair": "XXBTZUSD",
        "amount": 100,
        "interval": "1d",
        "nextExecution": "2025-10-18T12:00:00.000Z"
      }
    ]
  },
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

#### POST /api/dca/start
Start or create a new DCA strategy.

**Request Body:**
```json
{
  "pair": "XXBTZUSD",
  "amount": 100,
  "interval": "1d",
  "conditions": {
    "minPrice": 40000,
    "maxPrice": 50000
  }
}
```

**Supported Intervals:**
- `1h`, `2h`, `4h`, `6h`, `12h` - Hourly intervals
- `1d`, `daily` - Daily
- `1w`, `weekly` - Weekly

#### POST /api/dca/stop/:strategyId
Stop a running DCA strategy.

#### GET /api/dca/strategies
Get all DCA strategies (active and inactive).

#### GET /api/dca/strategy/:strategyId
Get details for a specific strategy.

#### POST /api/dca/execute/:strategyId
Manually execute a DCA strategy buy.

#### GET /api/dca/history/:strategyId
Get execution history for a strategy.

**Query Parameters:**
- `limit` - Maximum number of executions to return (default: 50)

#### POST /api/dca/scan
Scan market for DCA opportunities.

**Request Body:**
```json
{
  "criteria": {
    "minScore": 60,
    "maxAssets": 20,
    "excludeAssets": ["DOGE"],
    "includeOnlyAssets": null
  }
}
```

#### GET /api/dca/bot-scores
Get bot scoring for potential DCA candidates.

**Query Parameters:**
- `limit` - Maximum number of assets to score (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "scores": [
      {
        "asset": "BTC",
        "price": 45000.50,
        "change24h": 2.3,
        "volume24h": 25000000000,
        "botScore": 85,
        "breakdown": {
          "volatility": 75,
          "volume": 95,
          "trend": 85,
          "momentum": 80,
          "support": 70
        },
        "signals": [
          {
            "type": "positive",
            "indicator": "High Volume",
            "message": "Good liquidity for entries"
          }
        ],
        "recommendation": "STRONG_BUY"
      }
    ],
    "generatedAt": "2025-10-17T12:00:00.000Z"
  },
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

#### PUT /api/dca/strategy/:strategyId
Update DCA strategy settings.

#### DELETE /api/dca/strategy/:strategyId
Delete a DCA strategy.

---

### Audit Endpoints

#### GET /api/audit/transactions
Get transaction history with filtering and pagination.

**Query Parameters:**
- `type` - Transaction type (deposit, withdrawal, trade)
- `asset` - Filter by asset
- `startDate` - ISO 8601 date string
- `endDate` - ISO 8601 date string
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset (default: 0)

#### GET /api/audit/trades
Get trade history with filtering.

**Query Parameters:**
- `pair` - Trading pair
- `startDate` - ISO 8601 date string
- `endDate` - ISO 8601 date string
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset (default: 0)

#### GET /api/audit/orders
Get order history (open and closed).

**Query Parameters:**
- `status` - Order status (all, open, closed)
- `limit` - Maximum number of orders (default: 50)

#### GET /api/audit/summary
Get comprehensive audit summary with statistics.

**Query Parameters:**
- `period` - Time period (24h, 7d, 30d, 90d, 1y)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "totalTrades": 45,
    "totalVolume": 12500.50,
    "totalFees": 25.50,
    "buyTrades": 30,
    "sellTrades": 15,
    "totalTransactions": 50,
    "deposits": 3,
    "withdrawals": 2,
    "avgTradeSize": 277.79,
    "dateRange": {
      "start": "2025-09-17T12:00:00.000Z",
      "end": "2025-10-17T12:00:00.000Z"
    }
  },
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

#### POST /api/audit/sync
Manually trigger sync of transaction data.

#### GET /api/audit/export
Export transaction data in various formats.

**Query Parameters:**
- `format` - Export format (json, csv)
- `startDate` - ISO 8601 date string
- `endDate` - ISO 8601 date string
- `type` - Transaction type filter

#### GET /api/audit/dca-deployments
Get audit trail of DCA strategy deployments and executions.

**Query Parameters:**
- `strategyId` - Filter by strategy ID
- `limit` - Maximum number of deployments (default: 100)

#### GET /api/audit/transaction/:txId
Get detailed information about a specific transaction.

---

### Settings Endpoints

#### GET /api/settings/api-keys
Get list of configured API keys (masked).

#### POST /api/settings/api-keys
Add or update API key configuration.

**Request Body:**
```json
{
  "name": "kraken-main",
  "publicKey": "YOUR_PUBLIC_KEY",
  "privateKey": "YOUR_PRIVATE_KEY",
  "overwrite": false
}
```

#### DELETE /api/settings/api-keys/:name
Delete an API key configuration.

#### POST /api/settings/api-keys/:name/test
Test an API key connection.

#### GET /api/settings/preferences
Get user preferences.

#### PUT /api/settings/preferences
Update user preferences.

#### GET /api/settings/notifications
Get notification settings.

#### PUT /api/settings/notifications
Update notification settings.

#### GET /api/settings/all
Get all settings.

#### POST /api/settings/reset
Reset settings to defaults.

**Request Body:**
```json
{
  "section": "preferences"  // or "notifications", or omit for all
}
```

---

### Telegram Endpoints

#### GET /api/telegram/status
Get Telegram integration status.

#### POST /api/telegram/configure
Configure Telegram bot credentials.

**Request Body:**
```json
{
  "botToken": "YOUR_BOT_TOKEN",
  "chatId": "YOUR_CHAT_ID"
}
```

#### POST /api/telegram/enable
Enable or disable Telegram notifications.

**Request Body:**
```json
{
  "enabled": true
}
```

#### POST /api/telegram/test
Send a test message to Telegram.

#### POST /api/telegram/send
Send a custom message to Telegram.

**Request Body:**
```json
{
  "message": "Custom message text",
  "parseMode": "Markdown"
}
```

#### PUT /api/telegram/notifications
Update notification preferences.

**Request Body:**
```json
{
  "trades": true,
  "dcaExecutions": true,
  "alerts": true,
  "dailySummary": false
}
```

#### GET /api/telegram/notifications
Get notification preferences.

#### POST /api/telegram/alert
Send an alert notification.

**Request Body:**
```json
{
  "title": "Price Alert",
  "message": "BTC reached $50,000",
  "severity": "info"  // info, warning, error, success
}
```

#### DELETE /api/telegram/configure
Remove Telegram configuration.

---

## WebSocket API

### Connection

Connect to WebSocket server:
```javascript
const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling']
});
```

### Rooms

Join specific data rooms to receive targeted updates:

```javascript
// Join market data room
socket.emit('join_room', { room: 'market' });

// Join portfolio updates room
socket.emit('join_room', { room: 'portfolio' });

// Join trading updates room
socket.emit('join_room', { room: 'trading' });

// Join trends analysis room
socket.emit('join_room', { room: 'trends' });
```

### Events

#### Client → Server Events

**join_room**
```javascript
socket.emit('join_room', { room: 'market' });
```

**leave_room**
```javascript
socket.emit('leave_room', { room: 'market' });
```

**api_request** (RPC-style API calls)
```javascript
socket.emit('api_request', {
  requestId: 'req_123',
  endpoint: '/account/balance',
  method: 'GET',
  params: {}
});
```

**subscribe** (Topic-based subscriptions)
```javascript
socket.emit('subscribe', {
  topics: ['market', 'portfolio', 'dca']
});
```

**unsubscribe**
```javascript
socket.emit('unsubscribe', {
  topics: ['market']
});
```

**ping** (Health check)
```javascript
socket.emit('ping');
```

#### Server → Client Events

**market_update**
```javascript
socket.on('market_update', (data) => {
  console.log('Market update:', data);
});
```

**portfolio_update**
```javascript
socket.on('portfolio_update', (data) => {
  console.log('Portfolio update:', data);
});
```

**trade_update**
```javascript
socket.on('trade_update', (data) => {
  console.log('Trade update:', data);
});
```

**system_alert**
```javascript
socket.on('system_alert', (alert) => {
  console.log('System alert:', alert);
});
```

**dca_execution**
```javascript
socket.on('dca_execution', (execution) => {
  console.log('DCA executed:', execution);
});
```

**api_response** (Response to api_request)
```javascript
socket.on('api_response', (response) => {
  if (response.success) {
    console.log('API response:', response.data);
  } else {
    console.error('API error:', response.error);
  }
});
```

**joined_room**
```javascript
socket.on('joined_room', (data) => {
  console.log('Joined room:', data.room);
});
```

**left_room**
```javascript
socket.on('left_room', (data) => {
  console.log('Left room:', data.room);
});
```

**pong** (Response to ping)
```javascript
socket.on('pong', (data) => {
  console.log('Pong:', data.timestamp);
});
```

**error**
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Periodic Broadcasts

The server automatically broadcasts updates:
- **Market updates**: Every 30 seconds (to 'market' room)
- **Portfolio updates**: Every 60 seconds (to 'portfolio' room)

---

## Services

### KrakenService

Handles all Kraken API interactions with rate limiting and caching.

**Features:**
- Automatic rate limiting (1 request/second)
- Response caching with configurable TTL
- Authentication with API key/secret
- Mock data support for development

### DCAService

Manages automated DCA strategies with cron scheduling.

**Features:**
- Cron-based scheduling (hourly, daily, weekly)
- Conditional execution based on price/volume
- Execution history tracking
- WebSocket notifications

### ScannerService

Analyzes market data and scores DCA candidates.

**Scoring Components:**
- Volatility (25%)
- Volume (20%)
- Trend (25%)
- Momentum (15%)
- Support levels (15%)

**Recommendations:**
- STRONG_BUY (80+)
- BUY (70-79)
- MODERATE_BUY (60-69)
- HOLD (50-59)
- CAUTION (40-49)
- AVOID (<40)

### DataStore

In-memory caching service with TTL support.

**Features:**
- Key-value storage
- Automatic expiration
- Periodic cleanup
- Helper methods (increment, push, update)

---

## Environment Variables

```bash
# Server
PORT=5001

# Kraken API
KRAKEN_API_KEY=your_api_key
KRAKEN_API_SECRET=your_api_secret

# DCA
DCA_ENABLED=true
DCA_EXECUTE_ORDERS=false  # Set to true to execute real orders

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Encryption
ENCRYPTION_KEY=your_encryption_key_change_in_production

# Logging
LOG_LEVEL=info
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Development Notes

### Mock Data

When API keys are not configured, the services return mock data for development:
- Balance: Fake portfolio with BTC, ETH, SOL, ADA
- Prices: Mock market prices
- Trades/Orders: Empty or sample data

### Testing DCA Without Real Orders

Set `DCA_EXECUTE_ORDERS=false` to test DCA strategies without placing real orders.

### Logging

All operations are logged using Winston:
- Console output with colors
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs

---

## Production Checklist

- [ ] Configure real Kraken API keys
- [ ] Set strong ENCRYPTION_KEY
- [ ] Enable DCA order execution (DCA_EXECUTE_ORDERS=true)
- [ ] Configure Telegram bot
- [ ] Set up proper database for persistence
- [ ] Implement proper secret management (AWS KMS, etc.)
- [ ] Set up monitoring and alerting
- [ ] Configure CORS for production domains
- [ ] Enable HTTPS
- [ ] Set up rate limiting per client
- [ ] Implement authentication/authorization
- [ ] Regular backup of strategies and execution history

---

## Support

For issues or questions, please refer to the main DalyKraken documentation.
