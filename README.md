# DalyKraken 2.0

**Professional Crypto Trading Dashboard with Automated DCA Strategy**

A resilient, real-time crypto trading console with automated Dollar-Cost Averaging (DCA), designed to keep working even when primary services are degraded, using an offline-first cache and snapshot architecture.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 Features

### Real-Time Data Flow
- **WebSocket-First Architecture**: Primary data flow via Socket.IO with automatic reconnection
- **Live Kraken Integration**: Direct WebSocket connection to Kraken for real-time market data
- **Cross-Page Price Sharing**: Eliminates duplicate WebSocket connections via shared live price service

### Portfolio Management
- Real-time holdings tracking with live P&L calculations
- Asset allocation visualization
- DCA deployment tracking per asset
- Performance analytics and insights

### Automated DCA Strategy
- Automated Dollar-Cost Averaging with configurable parameters
- Bot scoring system (0-100 scale) for opportunity ranking
- Multi-signal analysis (trend, momentum, volume, volatility)
- Conditional execution based on market conditions
- Recovery mode for failed orders

### Offline-First Resilience
- **Multi-Tier Fallback System**:
  1. Primary: WebSocket (port 5001)
  2. Fallback 1: Cache API (port 5055)
  3. Fallback 2: Snapshot Service (port 5002)
  4. Fallback 3: Legacy REST API (port 5001/api)
  5. Final: localStorage backup

### Additional Features
- Market scanning and opportunity detection
- Risk assessment and portfolio analysis
- Complete audit trail with transaction history
- Telegram integration for alerts
- Multiple API key management with fallback support
- Export functionality (CSV/JSON)

## 🏗️ Architecture

### Frontend (Port 3000)
- **Framework**: React 18 + TypeScript
- **State Management**: Zustand
- **Styling**: TailwindCSS
- **Build Tool**: Vite
- **Routing**: React Router v6

### Backend Services

#### Main Backend (Port 5001)
- Express + Socket.IO
- 54 REST API endpoints
- WebSocket server with 4 rooms
- Kraken API integration
- DCA automation with cron scheduling

#### Snapshot Service (Port 5002)
- Periodic data snapshots (every 30 seconds)
- Versioned storage with automatic cleanup
- Provides point-in-time recovery

#### Cache API (Port 5055)
- Serves latest snapshot data
- Compatibility endpoints for UI fallback
- Events streaming (JSONL format)

## 📦 Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Kraken API keys (optional for development)

### Clone Repository
```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
```

### Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Main Backend
```bash
cd backend/services/main
npm install
```

#### Snapshot Service
```bash
cd backend/services/snapshot
npm install
```

#### Cache API
```bash
cd backend/services/cache
npm install
```

## ⚙️ Configuration

### Backend Configuration

Create `.env` file in `backend/services/main/`:

```bash
cp backend/services/main/.env.example backend/services/main/.env
```

Edit `.env` with your credentials:

```env
# Kraken API Keys (Primary)
KRAKEN_API_KEY=your_kraken_api_key_here
KRAKEN_API_SECRET=your_kraken_api_secret_here

# Kraken API Keys (Backup)
KRAKEN_API_KEY_BACKUP=your_backup_key_here
KRAKEN_API_SECRET_BACKUP=your_backup_secret_here

# Quantify Crypto API Keys
QUANTIFY_CRYPTO_API_KEY=your_quantify_crypto_key

# CoinMarketCap API Key
COINMARKETCAP_API_KEY=your_coinmarketcap_key

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Server Configuration
PORT=5001
NODE_ENV=development

# DCA Configuration
DCA_ENABLED=false
DCA_INTERVAL_MINUTES=60
DCA_DEFAULT_AMOUNT=100
DCA_MAX_ORDERS_PER_CYCLE=5
DCA_MIN_SCORE=70
```

**Note**: The application works with mock data in development mode without API keys.

## 🚀 Running the Application

### Development Mode

Open 4 terminal windows:

#### Terminal 1: Frontend
```bash
cd frontend
npm run dev
```
Frontend will be available at: http://localhost:3000

#### Terminal 2: Main Backend
```bash
cd backend/services/main
npm run dev
```
Backend API at: http://localhost:5001

#### Terminal 3: Snapshot Service
```bash
cd backend/services/snapshot
npm run dev
```
Snapshot service at: http://localhost:5002

#### Terminal 4: Cache API
```bash
cd backend/services/cache
npm run dev
```
Cache API at: http://localhost:5055

### Production Mode

```bash
# Build frontend
cd frontend
npm run build

# Start services (use PM2 or similar)
cd backend/services/main
npm start

cd backend/services/snapshot
npm start

cd backend/services/cache
npm start
```

## 🔐 Default Login Credentials

For development:
- **Username**: `admin`
- **Password**: `admin`

⚠️ **Change these in production!**

## 📱 Pages Overview

### Dashboard (`/dashboard`)
- Portfolio value and P&L at a glance
- DCA status and activity
- System health indicators
- Top holdings overview

### Crypto Market (`/crypto-market`)
- Real-time price table from Kraken WebSocket
- Multiple timeframe intervals (1m, 5m, 15m, 1h, 4h, 1d)
- 24h change, high, low, volume tracking

### Crypto Trends (`/crypto-trends`)
- Enhanced market trends with technical indicators
- RSI, MACD, Bollinger Bands
- Support/resistance levels
- Trend scoring and signals

### Portfolio (`/portfolio`)
- Real-time holdings with live prices
- DCA deployment tracking
- Winners/Losers analysis
- Asset allocation visualization

### DalyDCA (`/daly-dca`)
- Start/Stop DCA automation
- Configure DCA parameters
- Market scanner with bot scores
- Execute manual DCA orders

### Scanner (`/scanner`)
- Multi-signal market analysis
- Opportunity detection
- Customizable filters and thresholds
- CSV export

### Audit Log (`/audit-log`)
- Complete transaction history
- Kraken sync functionality
- DCA deployment tracking
- Export to CSV/JSON

### Settings (`/settings`)
- API key management (Kraken, Quantify Crypto, CoinMarketCap)
- Multiple key support with fallback
- Connection testing
- General preferences

## 🔌 API Documentation

### REST API Endpoints

Base URL: `http://localhost:5001/api`

#### Account
- `GET /account/info` - Account information
- `GET /account/balance` - Current balance
- `GET /account/trade-balance` - Trade balance

#### Portfolio
- `GET /portfolio/overview` - Portfolio overview
- `GET /portfolio/holdings` - All holdings
- `GET /portfolio/performance` - Performance metrics

#### Market
- `GET /market/overview` - Market overview
- `GET /market/top-20` - Top 20 markets
- `GET /market/live-prices` - Live prices

#### DCA
- `GET /dca/status` - DCA status
- `POST /dca/start` - Start DCA
- `POST /dca/stop` - Stop DCA
- `POST /dca/scan` - Scan markets
- `POST /dca/execute` - Execute DCA
- `GET /dca/bot-scores` - Bot scores

#### Audit
- `GET /audit/transactions` - Transaction history
- `GET /audit/summary` - Audit summary
- `POST /audit/sync-kraken` - Sync with Kraken
- `GET /audit/export` - Export data

For complete API documentation, see [backend/services/main/docs/API_DOCUMENTATION.md](backend/services/main/docs/API_DOCUMENTATION.md)

### WebSocket Events

#### Rooms
- `market` - Market data updates
- `portfolio` - Portfolio updates
- `trading` - Trade execution updates
- `trends` - Trend analysis updates

#### Events
- `market_update` - Market data broadcast
- `portfolio_update` - Portfolio changes
- `trade_update` - Trade execution
- `system_alert` - System alerts
- `trends_update` - Trend data

## 🛠️ Development

### Project Structure
```
DalyKraken2.0/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API and WebSocket services
│   │   ├── store/          # Zustand state management
│   │   └── types/          # TypeScript types
│   └── package.json
│
├── backend/
│   ├── services/
│   │   ├── main/           # Main backend (5001)
│   │   │   ├── src/
│   │   │   │   ├── routes/        # API routes
│   │   │   │   ├── services/      # Business logic
│   │   │   │   ├── websocket/     # WebSocket handlers
│   │   │   │   └── utils/         # Utilities
│   │   │   └── package.json
│   │   │
│   │   ├── snapshot/       # Snapshot service (5002)
│   │   └── cache/          # Cache API (5055)
│   │
│   └── shared/             # Shared utilities
│
└── data/                   # Data storage
    ├── snapshots/          # Versioned snapshots
    └── events.jsonl        # Event log
```

### Key Technologies

**Frontend:**
- React 18
- TypeScript
- Zustand (state management)
- TailwindCSS (styling)
- Socket.IO Client (WebSocket)
- Axios (HTTP client)
- Recharts (charting)
- date-fns (date formatting)
- Lucide React (icons)

**Backend:**
- Express (REST API)
- Socket.IO (WebSocket)
- Kraken API (exchange integration)
- node-cron (scheduling)
- Winston (logging)
- Axios (HTTP client)

## 🧪 Testing

### Test API Endpoints
```bash
# Health check
curl http://localhost:5001/health

# Market overview
curl http://localhost:5001/api/market/overview

# Portfolio
curl http://localhost:5001/api/portfolio/overview

# DCA status
curl http://localhost:5001/api/dca/status
```

### Test WebSocket Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001');

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('join', 'market');
});

socket.on('market_update', (data) => {
  console.log('Market update:', data);
});
```

## 📊 Performance

- **WebSocket Latency**: < 10ms
- **REST API Response**: < 100ms
- **Fallback Switch Time**: < 500ms
- **Snapshot Creation**: Every 30 seconds
- **Cache TTL**: 5 seconds

## 🔒 Security

- API keys stored in environment variables
- AES-256-CBC encryption for sensitive data
- CORS enabled for localhost only
- Rate limiting on Kraken API calls
- Input validation on all endpoints

## 🐛 Troubleshooting

### Frontend won't connect to backend
1. Check all services are running
2. Verify ports are not in use
3. Check CORS configuration
4. Review browser console for errors

### WebSocket connection fails
1. Falls back to polling automatically
2. Check firewall settings
3. Verify Socket.IO versions match
4. Check backend logs

### Kraken API errors
1. Verify API keys in `.env`
2. Check API key permissions
3. Review rate limiting
4. Check Kraken API status

### Data not updating
1. Check WebSocket connection
2. Verify fallback services running
3. Check snapshot service logs
4. Review cache API status

## 📝 Contributing

This is a personal project, but feedback and suggestions are welcome!

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Kraken for exchange API
- Quantify Crypto for enhanced market data
- Socket.IO for real-time communication
- React team for the amazing framework

## 📞 Support

For issues and questions:
- Check troubleshooting section
- Review API documentation
- Check backend logs in `logs/` directory

---

**Built with ❤️ for crypto traders who value reliability and resilience**
