# DalyKraken 2.0 - Architecture Documentation

## Overview

DalyKraken 2.0 is a resilient, real-time crypto trading dashboard built with an offline-first architecture. The system is designed to maintain functionality even when primary services are degraded through a multi-tier fallback system.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│                     Port 3000                                │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Zustand   │  │  Socket.IO │  │  Live Price Service  │  │
│  │   Store    │  │   Client   │  │  (Kraken WS Direct)  │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                ┌─────────┼─────────┐
                │         │         │
        WebSocket      REST API   WebSocket
         (5001)        (5001)    (wss://ws.kraken.com)
                │         │
┌───────────────┴─────────┴───────────────────────────────────┐
│              Main Backend (Express + Socket.IO)              │
│                        Port 5001                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────────────┐  │
│  │ Kraken │  │  DCA   │  │Scanner │  │   Data Store     │  │
│  │  API   │  │Service │  │Service │  │  (In-Memory)     │  │
│  └────────┘  └────────┘  └────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │           │
            Periodic Pull   Data Push
                    │           │
     ┌──────────────┴─────┐    │
     │  Snapshot Service  │    │
     │     Port 5002      │    │
     │  ┌──────────────┐  │    │
     │  │ Versioned    │  │    │
     │  │ Snapshots    │  │    │
     │  │ (JSON Files) │  │    │
     │  └──────────────┘  │    │
     └────────────────────┘    │
                │              │
            Writes to          │
                │              │
     ┌──────────┴──────────────┴──────┐
     │     Data Directory              │
     │  ┌────────────┐  ┌───────────┐ │
     │  │ snapshots/ │  │events.jsonl│ │
     │  │ latest.json│  │            │ │
     │  └────────────┘  └───────────┘ │
     └─────────────────────────────────┘
                │
            Reads from
                │
     ┌──────────┴──────────┐
     │   Cache API          │
     │   Port 5055          │
     │  ┌────────────────┐  │
     │  │ Compatibility  │  │
     │  │  Endpoints     │  │
     │  └────────────────┘  │
     └──────────────────────┘
```

## Data Flow

### Primary Flow (WebSocket-First)

1. **Frontend** connects to **Main Backend** via Socket.IO (port 5001)
2. **Main Backend** streams real-time updates via topic-based broadcasts:
   - `market_update` - Market data changes
   - `portfolio_update` - Portfolio changes
   - `trade_update` - Trade execution updates
   - `system_alert` - System notifications
3. **Frontend** also connects directly to **Kraken WebSocket** for market prices
4. **Live Price Service** broadcasts prices to all pages (no duplicate connections)

### Fallback Flow

When primary WebSocket fails, the system cascades through fallbacks:

```
WebSocket Failed
      ↓
Cache API (5055) ──→ Serves latest snapshot
      ↓ (if fails)
Snapshot Service (5002) ──→ Serves versioned data
      ↓ (if fails)
REST API (5001/api) ──→ Direct API calls
      ↓ (if fails)
localStorage ──→ Last cached data
```

### Cross-Page Price Sharing

```
Kraken WS (public)
      ↓
CryptoMarket Page (subscribes)
      ↓
Live Price Service (broadcasts)
      ↓
Portfolio Page (receives)
Dashboard (receives)
Scanner (receives)
```

**Benefits:**
- Single WebSocket connection to Kraken
- Reduced bandwidth and API calls
- Consistent prices across all pages
- Automatic reconnection handling

## Services Deep Dive

### Frontend (Port 3000)

**Technology Stack:**
- React 18 (UI framework)
- TypeScript (type safety)
- Zustand (state management)
- TailwindCSS (styling)
- Socket.IO Client (WebSocket)
- Axios (HTTP client)

**Key Components:**

1. **Zustand Store** (`src/store/useStore.ts`)
   - Centralized state management
   - WebSocket connection management
   - API call orchestration with fallbacks
   - Notification system

2. **Socket Client** (`src/services/socketClient.ts`)
   - WebSocket connection with auto-reconnect
   - Room-based subscriptions
   - RPC-style API requests over WebSocket
   - Event handling and broadcasting

3. **Live Price Service** (`src/services/livePriceService.ts`)
   - Direct Kraken WebSocket connection
   - Price aggregation and broadcasting
   - Cross-page price sharing
   - Exponential backoff reconnection

4. **API Service** (`src/services/apiService.ts`)
   - REST API wrapper with fallbacks
   - Request throttling and deduplication
   - Cache API integration
   - Snapshot service integration

**Pages:**
- Landing, Login (public)
- Dashboard, Crypto Market, Crypto Trends
- Portfolio, DalyDCA, Scanner
- Audit Log, Settings (protected)

### Main Backend (Port 5001)

**Technology Stack:**
- Express (REST API)
- Socket.IO (WebSocket)
- node-cron (scheduling)
- Winston (logging)

**Architecture:**

```
src/
├── routes/              # REST API endpoints
│   ├── account.js       # Account info
│   ├── portfolio.js     # Portfolio data
│   ├── market.js        # Market data
│   ├── dcaRoutes.js     # DCA strategy
│   ├── audit.js         # Audit/transactions
│   ├── settings.js      # Settings
│   └── telegram.js      # Telegram integration
├── services/            # Business logic
│   ├── krakenService.js # Kraken API integration
│   ├── dcaService.js    # DCA automation
│   ├── scannerService.js# Market scanning
│   └── dataStore.js     # In-memory cache
├── websocket/           # WebSocket handlers
│   └── index.js         # Socket.IO setup
└── utils/
    └── logger.js        # Logging utility
```

**Key Features:**
- 54 REST API endpoints
- WebSocket server with 4 rooms
- Kraken API integration with rate limiting
- DCA automation with cron scheduling
- In-memory caching with TTL
- Comprehensive error handling

### Snapshot Service (Port 5002)

**Purpose:** Create periodic snapshots of all system data for point-in-time recovery.

**Features:**
- Pulls data from main API every 30 seconds
- Creates versioned snapshots with timestamps
- Maintains `latest.json` pointer
- Automatic cleanup (keeps last 100 snapshots)
- Provides individual data endpoints

**Endpoints:**
- `GET /latest` - Latest complete snapshot
- `GET /account` - Latest account data
- `GET /portfolio` - Latest portfolio data
- `GET /market` - Latest market data
- `GET /dca-status` - Latest DCA status
- `GET /risk` - Latest risk status
- `GET /scanner` - Latest scanner data
- `GET /snapshots` - List all snapshots
- `POST /snapshot` - Force create snapshot

### Cache API (Port 5055)

**Purpose:** Serve cached data from snapshots when main backend is unavailable.

**Features:**
- Reads from latest snapshot file
- 5-second in-memory cache TTL
- Compatibility endpoints matching main API
- Event log streaming (JSONL format)
- Cache statistics and management

**Endpoints:**
- `GET /account-info` - Account data
- `GET /portfolio` - Portfolio data
- `GET /market-overview` - Market data
- `GET /risk-status` - Risk data
- `GET /scanner-data` - Scanner data
- `GET /snapshot` - Raw snapshot
- `GET /events` - Recent events
- `POST /clear-cache` - Clear cache

## Data Persistence

### Snapshots
**Location:** `data/snapshots/`
**Format:** JSON
**Naming:** `snapshot_{timestamp}.json`
**Retention:** Last 100 snapshots
**Pointer:** `latest.json`

### Events Log
**Location:** `data/events.jsonl`
**Format:** JSONL (JSON Lines)
**Content:** System events, trades, alerts
**Rotation:** Manual/external log rotation

### Logs
**Location:** `backend/services/main/logs/`
**Files:**
- `combined.log` - All logs
- `error.log` - Errors only
**Format:** JSON with timestamps

## WebSocket Communication

### Rooms

1. **market** - Market data updates
2. **portfolio** - Portfolio changes
3. **trading** - Trade execution
4. **trends** - Trend analysis

### Event Flow

```
Client                          Server
  │                               │
  ├──connect()──────────────────→│
  │                               │
  ├──emit('join', 'market')─────→│
  │                               │
  │←─────on('market_update')──────┤ (periodic broadcast)
  │                               │
  ├──emit('api_request', {...})─→│ (RPC-style)
  │                               │
  │←─────on('response', {...})────┤
  │                               │
```

### RPC-Style API Requests

```javascript
// Client
const response = await socketClient.apiRequest(
  '/portfolio/overview',
  'GET'
);

// Server
socket.on('api_request', async (request) => {
  const result = await handleApiRequest(request);
  socket.emit('response', {
    id: request.id,
    success: true,
    data: result
  });
});
```

## DCA Strategy

### Bot Scoring System (0-100 scale)

**Components:**
1. **Trend Score** (30%) - Direction and strength
2. **Momentum Score** (25%) - Rate of change
3. **Volume Score** (20%) - Trading activity
4. **Volatility Score** (15%) - Price stability
5. **Technical Score** (10%) - RSI, MACD, etc.

**Execution Logic:**
```javascript
if (score >= minScore && !recoveryMode) {
  execute_dca_order();
} else if (recoveryMode) {
  retry_failed_orders();
}
```

### Cron Scheduling

```javascript
cron.schedule('0 * * * *', () => {
  // Hourly DCA execution
  if (dcaConfig.enabled) {
    runDCAStrategy();
  }
});
```

## Security

### API Key Management
- Environment variables (`.env`)
- AES-256-CBC encryption for storage
- Multiple key support (primary + backup)
- Key masking in logs and UI
- Connection testing before activation

### Authentication
- Development: Hardcoded credentials
- Production: Replace with OAuth/JWT
- Session management via Zustand store
- Protected routes with navigation guards

### Rate Limiting
- Kraken API: 1 request/second
- Frontend throttling: 1 second between same requests
- WebSocket: Connection limits (configurable)

## Resilience Features

### Automatic Reconnection
- WebSocket: Exponential backoff (1s → 30s)
- Kraken WS: Exponential backoff (max 5 attempts)
- Service health checks every 30 seconds

### Caching Strategy
```
Data Type          Primary   Cache TTL   Fallback
─────────────────────────────────────────────────
Account Info       WS        30s         Cache → Snapshot → localStorage
Portfolio          WS        10s         Cache → Snapshot → localStorage
Market Data        Kraken WS 1s          Cache → Snapshot
Live Prices        Kraken WS Real-time   In-memory
DCA Status         WS        30s         Cache → Snapshot
Risk Status        REST      60s         Cache → Snapshot
```

### Error Handling
- Try-catch blocks on all async operations
- Graceful degradation (show cached data)
- User notifications for errors
- Comprehensive logging

## Performance Optimization

### Frontend
- Lazy loading for routes
- Memoization for expensive calculations
- Virtual scrolling for large lists
- Debounced search inputs
- LocalStorage caching

### Backend
- In-memory data store with TTL
- Request deduplication
- Rate limiting
- Connection pooling
- Efficient data structures

### WebSocket
- Topic-based subscriptions (only receive needed data)
- Binary encoding for large payloads (optional)
- Message compression (optional)
- Connection multiplexing

## Monitoring & Observability

### Health Checks
- `GET /health` on all services
- Response includes uptime, status, timestamp
- Frontend system status indicators

### Logging
- Structured logging (JSON format)
- Log levels: error, warn, info, debug
- Separate error log file
- Timestamp on all logs

### Metrics (Future)
- API response times
- WebSocket message counts
- Error rates
- Cache hit/miss ratios
- DCA execution success rate

## Deployment

### Development
```bash
# Terminal 1
npm run dev:frontend

# Terminal 2
npm run dev:backend

# Terminal 3
npm run dev:snapshot

# Terminal 4
npm run dev:cache
```

### Production
```bash
# Build frontend
cd frontend && npm run build

# Use PM2 or similar for services
pm2 start backend/services/main/src/server.js --name dalykraken-main
pm2 start backend/services/snapshot/src/server.js --name dalykraken-snapshot
pm2 start backend/services/cache/src/server.js --name dalykraken-cache
```

### Docker (Future)
```yaml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports: ["3000:80"]
  backend:
    build: ./backend/services/main
    ports: ["5001:5001"]
  snapshot:
    build: ./backend/services/snapshot
    ports: ["5002:5002"]
  cache:
    build: ./backend/services/cache
    ports: ["5055:5055"]
```

## Future Enhancements

### Phase 1 (Foundation)
- ✅ Frontend with React + TypeScript
- ✅ Backend with Express + Socket.IO
- ✅ Multi-tier fallback system
- ✅ DCA automation
- ✅ Real-time data streaming

### Phase 2 (Enhanced Security)
- [ ] OAuth 2.0 authentication
- [ ] JWT token management
- [ ] API key encryption in database
- [ ] Two-factor authentication
- [ ] Rate limiting middleware

### Phase 3 (Advanced Features)
- [ ] Machine learning for bot scoring
- [ ] Advanced charting (TradingView integration)
- [ ] Backtesting engine
- [ ] Custom indicators
- [ ] Alert webhooks

### Phase 4 (Scalability)
- [ ] Redis for caching
- [ ] PostgreSQL for persistence
- [ ] Message queue (RabbitMQ/Redis)
- [ ] Horizontal scaling
- [ ] CDN integration

### Phase 5 (Enterprise)
- [ ] Multi-user support
- [ ] Role-based access control
- [ ] Audit trail with compliance
- [ ] API versioning
- [ ] GraphQL API

## Conclusion

DalyKraken 2.0 is built with resilience, performance, and user experience as core principles. The multi-tier fallback architecture ensures the dashboard remains functional even during service degradation, while the WebSocket-first approach provides real-time updates with minimal latency.

The modular architecture allows for easy enhancement and scaling, making it suitable for both personal use and potential enterprise deployment.
