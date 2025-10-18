# DalyKraken Backend - Quick Start Guide

## Project Overview

A comprehensive cryptocurrency trading backend with:
- **REST API**: Full-featured API for account, portfolio, market data, DCA strategies
- **WebSocket**: Real-time updates for market data, portfolio, and trading events
- **DCA Automation**: Automated dollar-cost averaging with cron scheduling
- **Market Scanner**: AI-powered bot scoring for optimal DCA entry points
- **Audit System**: Complete transaction and trade history tracking

**Total Lines of Code**: 4,394 lines across 15 files

---

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/services/main
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
# Server
PORT=5001

# Kraken API (optional for testing)
KRAKEN_API_KEY=
KRAKEN_API_SECRET=

# DCA
DCA_ENABLED=true
DCA_EXECUTE_ORDERS=false

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Security
ENCRYPTION_KEY=change-this-in-production-to-32-chars

# Logging
LOG_LEVEL=info
```

### 3. Start Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

### 4. Verify Server

```bash
# Health check
curl http://localhost:5001/health

# Get market overview
curl http://localhost:5001/api/market/overview

# Get account balance (mock data without API keys)
curl http://localhost:5001/api/account/balance
```

---

## File Structure

```
src/
├── routes/                    # API Route Handlers (8 files)
│   ├── index.js              # Main router - mounts all routes under /api
│   ├── account.js            # 4 endpoints: balance, info, trade-balance, volume
│   ├── portfolio.js          # 4 endpoints: overview, holdings, performance, allocation
│   ├── market.js             # 8 endpoints: overview, top20, prices, ticker, etc.
│   ├── dcaRoutes.js          # 11 endpoints: status, start, stop, strategies, etc.
│   ├── audit.js              # 9 endpoints: transactions, trades, summary, export, etc.
│   ├── settings.js           # 9 endpoints: api-keys, preferences, notifications
│   └── telegram.js           # 9 endpoints: status, configure, send, alerts
│
├── services/                  # Business Logic (4 files)
│   ├── krakenService.js      # Kraken API integration (25+ methods)
│   ├── dcaService.js         # DCA automation with cron scheduling
│   ├── scannerService.js     # Market analysis and bot scoring
│   └── dataStore.js          # In-memory caching with TTL
│
├── websocket/                 # WebSocket Server (1 file)
│   └── index.js              # Rooms, events, RPC, broadcasts
│
├── utils/                     # Utilities (1 file)
│   └── logger.js             # Winston logger configuration
│
└── server.js                  # Express server entry point
```

---

## API Quick Reference

### Account
- `GET /api/account/balance` - Get balance
- `GET /api/account/info` - Get account info
- `GET /api/account/trade-balance` - Get trade balance
- `GET /api/account/volume` - Get trading volume

### Portfolio
- `GET /api/portfolio/overview` - Full portfolio overview
- `GET /api/portfolio/holdings` - Current holdings
- `GET /api/portfolio/performance?period=30d` - Performance metrics
- `GET /api/portfolio/allocation` - Asset allocation

### Market
- `GET /api/market/overview` - Market overview
- `GET /api/market/top20` - Top 20 assets
- `GET /api/market/prices?pairs=XXBTZUSD,XETHZUSD` - Live prices
- `GET /api/market/ticker/:pair` - Ticker data
- `GET /api/market/ohlc/:pair?interval=60` - OHLC candlestick data
- `GET /api/market/orderbook/:pair?count=10` - Order book
- `GET /api/market/trades/:pair` - Recent trades
- `GET /api/market/spread/:pair` - Bid/ask spread

### DCA (Dollar Cost Averaging)
- `GET /api/dca/status` - Service status
- `POST /api/dca/start` - Start new strategy
- `POST /api/dca/stop/:id` - Stop strategy
- `GET /api/dca/strategies` - All strategies
- `GET /api/dca/strategy/:id` - Strategy details
- `POST /api/dca/execute/:id` - Manual execution
- `GET /api/dca/history/:id?limit=50` - Execution history
- `POST /api/dca/scan` - Scan for opportunities
- `GET /api/dca/bot-scores?limit=20` - Bot scoring
- `PUT /api/dca/strategy/:id` - Update strategy
- `DELETE /api/dca/strategy/:id` - Delete strategy

### Audit
- `GET /api/audit/transactions?limit=50&offset=0` - Transaction history
- `GET /api/audit/trades?pair=XXBTZUSD` - Trade history
- `GET /api/audit/orders?status=all` - Order history
- `GET /api/audit/summary?period=30d` - Audit summary
- `POST /api/audit/sync` - Sync transaction data
- `GET /api/audit/export?format=csv` - Export data
- `GET /api/audit/dca-deployments?limit=100` - DCA audit trail
- `GET /api/audit/transaction/:txId` - Transaction details

### Settings
- `GET /api/settings/api-keys` - List API keys
- `POST /api/settings/api-keys` - Add API key
- `DELETE /api/settings/api-keys/:name` - Delete API key
- `POST /api/settings/api-keys/:name/test` - Test API key
- `GET /api/settings/preferences` - Get preferences
- `PUT /api/settings/preferences` - Update preferences
- `GET /api/settings/notifications` - Get notification settings
- `PUT /api/settings/notifications` - Update notifications
- `GET /api/settings/all` - All settings
- `POST /api/settings/reset` - Reset settings

### Telegram
- `GET /api/telegram/status` - Integration status
- `POST /api/telegram/configure` - Configure bot
- `POST /api/telegram/enable` - Enable/disable
- `POST /api/telegram/test` - Send test message
- `POST /api/telegram/send` - Send custom message
- `GET /api/telegram/notifications` - Get notification preferences
- `PUT /api/telegram/notifications` - Update preferences
- `POST /api/telegram/alert` - Send alert
- `DELETE /api/telegram/configure` - Remove configuration

---

## WebSocket Quick Reference

### Connection
```javascript
const socket = io('http://localhost:5001');
```

### Rooms
```javascript
socket.emit('join_room', { room: 'market' });     // Market updates
socket.emit('join_room', { room: 'portfolio' });  // Portfolio updates
socket.emit('join_room', { room: 'trading' });    // Trading updates
socket.emit('join_room', { room: 'trends' });     // Trends analysis
```

### Events to Listen
```javascript
socket.on('market_update', (data) => { /* ... */ });
socket.on('portfolio_update', (data) => { /* ... */ });
socket.on('trade_update', (data) => { /* ... */ });
socket.on('system_alert', (alert) => { /* ... */ });
socket.on('dca_execution', (exec) => { /* ... */ });
```

### RPC-style API Calls
```javascript
socket.emit('api_request', {
  requestId: 'req_123',
  endpoint: '/account/balance',
  method: 'GET',
  params: {}
});

socket.on('api_response', (response) => {
  if (response.requestId === 'req_123') {
    console.log(response.data);
  }
});
```

### Topic Subscriptions
```javascript
socket.emit('subscribe', { topics: ['market', 'dca', 'portfolio'] });
socket.emit('unsubscribe', { topics: ['market'] });
```

---

## DCA Strategy Example

### Create a Daily Bitcoin DCA
```bash
curl -X POST http://localhost:5001/api/dca/start \
  -H "Content-Type: application/json" \
  -d '{
    "pair": "XXBTZUSD",
    "amount": 100,
    "interval": "1d",
    "conditions": {
      "minPrice": 40000,
      "maxPrice": 50000
    }
  }'
```

### Get Bot Scores
```bash
curl http://localhost:5001/api/dca/bot-scores?limit=10
```

**Response includes:**
- Bot score (0-100)
- Breakdown by volatility, volume, trend, momentum, support
- Recommendation (STRONG_BUY, BUY, MODERATE_BUY, HOLD, CAUTION, AVOID)
- Trading signals

---

## Service Features

### KrakenService
✅ Rate limiting (1 req/sec)
✅ Response caching with TTL
✅ Mock data for development
✅ 25+ API methods
✅ Authentication handling

### DCAService
✅ Cron-based scheduling
✅ Conditional execution
✅ Execution history
✅ WebSocket notifications
✅ Strategy CRUD operations

### ScannerService
✅ 5-component scoring system
✅ Market sentiment analysis
✅ Signal generation
✅ Opportunity scanning
✅ Investment recommendations

### DataStore
✅ In-memory caching
✅ TTL support
✅ Auto-cleanup
✅ Helper methods (increment, push, update)

---

## Testing Examples

### Test Portfolio Overview
```bash
curl http://localhost:5001/api/portfolio/overview
```

### Test Market Scanner
```bash
curl -X POST http://localhost:5001/api/dca/scan \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": {
      "minScore": 70,
      "maxAssets": 5
    }
  }'
```

### Test Audit Summary
```bash
curl "http://localhost:5001/api/audit/summary?period=30d"
```

### Test Telegram Alert
```bash
curl -X POST http://localhost:5001/api/telegram/alert \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Price Alert",
    "message": "BTC reached $50,000!",
    "severity": "info"
  }'
```

---

## Development Workflow

1. **Start server in dev mode**: `npm run dev`
2. **Make changes**: Server auto-reloads on file changes
3. **Test endpoints**: Use curl, Postman, or frontend
4. **Check logs**: Monitor console output
5. **Review files**:
   - `logs/error.log` for errors
   - `logs/combined.log` for all logs

---

## Production Deployment

1. Set environment variables
2. Configure real Kraken API keys
3. Set strong ENCRYPTION_KEY (32 characters)
4. Enable DCA execution: `DCA_EXECUTE_ORDERS=true`
5. Set up database for persistence
6. Configure CORS for production domains
7. Enable HTTPS
8. Set up monitoring and alerting
9. Implement authentication/authorization
10. Regular backups of strategies

---

## Key Highlights

🚀 **54 REST API Endpoints** across 8 route modules
📡 **WebSocket Server** with 4 rooms and topic subscriptions
🤖 **Automated DCA** with cron scheduling and conditions
📊 **Market Scanner** with 5-component scoring (0-100)
📈 **Real-time Updates** every 30-60 seconds
🔐 **Encrypted Storage** for API keys
📝 **Comprehensive Logging** with Winston
💾 **Smart Caching** with configurable TTL
🔔 **Telegram Integration** for alerts and notifications
📋 **Transaction Audit** with export capabilities

---

## Next Steps

1. ✅ Backend structure complete (4,394 LOC)
2. 📱 Connect to frontend dashboard
3. 🔗 Integrate with Kraken API (add real keys)
4. 🤖 Enable DCA order execution
5. 📊 Add database persistence
6. 🔐 Implement authentication
7. 📈 Deploy to production

---

For detailed API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
