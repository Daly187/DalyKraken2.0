# DalyKraken 2.0 - Quick Start Guide

Get up and running with DalyKraken in 5 minutes!

## 🚀 Quick Installation

### Step 1: Install All Dependencies

From the root directory:

```bash
npm run install:all
```

Or install individually:

```bash
# Frontend
cd frontend && npm install

# Main Backend
cd backend/services/main && npm install

# Snapshot Service
cd backend/services/snapshot && npm install

# Cache API
cd backend/services/cache && npm install
```

### Step 2: Configure Environment (Optional)

For development, the app works with mock data. For production, configure:

```bash
cd backend/services/main
cp .env.example .env
# Edit .env with your API keys
```

### Step 3: Start All Services

Open 4 terminal windows and run:

**Terminal 1 - Frontend:**
```bash
npm run dev:frontend
# Or: cd frontend && npm run dev
```
✅ Frontend: http://localhost:3000

**Terminal 2 - Main Backend:**
```bash
npm run dev:backend
# Or: cd backend/services/main && npm run dev
```
✅ Backend: http://localhost:5001

**Terminal 3 - Snapshot Service:**
```bash
npm run dev:snapshot
# Or: cd backend/services/snapshot && npm run dev
```
✅ Snapshots: http://localhost:5002

**Terminal 4 - Cache API:**
```bash
npm run dev:cache
# Or: cd backend/services/cache && npm run dev
```
✅ Cache: http://localhost:5055

### Step 4: Access the Dashboard

Open your browser and navigate to:
```
http://localhost:3000
```

**Login with default credentials:**
- Username: `admin`
- Password: `admin`

🎉 **You're ready!**

---

## 📋 Quick Test Checklist

After starting all services:

### 1. Check Services Health
```bash
# Main backend
curl http://localhost:5001/health

# Snapshot service
curl http://localhost:5002/health

# Cache API
curl http://localhost:5055/health
```

### 2. Test API Endpoints
```bash
# Market overview
curl http://localhost:5001/api/market/overview

# Portfolio
curl http://localhost:5001/api/portfolio/overview

# DCA status
curl http://localhost:5001/api/dca/status
```

### 3. Test Frontend
1. Open http://localhost:3000
2. Login (admin/admin)
3. Navigate to Dashboard
4. Check Portfolio page
5. Open Crypto Market page
6. Verify live data streaming

---

## 🎯 Common Tasks

### View Logs
```bash
# Backend logs
tail -f backend/services/main/logs/combined.log

# View errors only
tail -f backend/services/main/logs/error.log
```

### Clear Cache
```bash
curl -X POST http://localhost:5055/clear-cache
```

### Force Snapshot
```bash
curl -X POST http://localhost:5002/snapshot
```

### View Snapshots
```bash
curl http://localhost:5002/snapshots
```

---

## 🔧 Troubleshooting

### Port Already in Use

If you get "port in use" errors:

```bash
# Find process using port
lsof -ti:3000  # Frontend
lsof -ti:5001  # Backend
lsof -ti:5002  # Snapshot
lsof -ti:5055  # Cache

# Kill process
kill -9 $(lsof -ti:3000)
```

### Frontend Won't Connect

1. Check all backend services are running
2. Check browser console for errors
3. Verify CORS is enabled
4. Try clearing browser cache

### No Data Showing

1. Check WebSocket connection (see console)
2. Verify services are running
3. Check API endpoints manually
4. Review backend logs

### WebSocket Connection Failed

The app will automatically fall back to:
1. Cache API (5055)
2. Snapshot Service (5002)
3. Legacy REST API
4. localStorage cache

---

## 📦 Project Structure

```
DalyKraken2.0/
├── frontend/              # React app (Port 3000)
├── backend/
│   └── services/
│       ├── main/         # Main backend (Port 5001)
│       ├── snapshot/     # Snapshot service (Port 5002)
│       └── cache/        # Cache API (Port 5055)
├── data/                 # Data storage
└── README.md
```

---

## 🎓 Next Steps

1. **Configure API Keys** - Edit `backend/services/main/.env` for live data
2. **Explore Pages** - Navigate through all dashboard pages
3. **Test DCA** - Configure and test automated DCA strategy
4. **Review API Docs** - See `backend/services/main/docs/API_DOCUMENTATION.md`
5. **Customize Settings** - Configure preferences in Settings page

---

## 💡 Tips

- **Development Mode**: App works without API keys using mock data
- **Live Prices**: Crypto Market page connects directly to Kraken WebSocket
- **Fallback System**: UI works even if backends are down (uses cache)
- **Real-time Updates**: Portfolio and market data update automatically
- **Export Data**: Use Audit Log page to export transaction history

---

## 🆘 Need Help?

1. Check the main [README.md](README.md)
2. Review [API_DOCUMENTATION.md](backend/services/main/docs/API_DOCUMENTATION.md)
3. Check backend logs in `logs/` directory
4. Verify all services are running with health checks

---

**Happy Trading! 🚀📈**
