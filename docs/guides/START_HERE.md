# 🚀 DalyKraken 2.0 - START HERE

Welcome to DalyKraken 2.0! This guide will get you started in under 5 minutes.

## Quick Start (3 Steps)

### 1️⃣ Install Dependencies

```bash
./setup.sh
```

This single command installs everything you need.

### 2️⃣ Start All Services

Open 4 terminals and run:

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

### 3️⃣ Open Dashboard

Go to: **http://localhost:3000**

Login: `admin` / `admin`

🎉 **Done!**

---

## 📚 Documentation Guide

Read in this order:

1. **START_HERE.md** ← You are here
2. **QUICK_START.md** - 5-minute setup guide
3. **README.md** - Complete documentation
4. **ARCHITECTURE.md** - How it works
5. **PROJECT_SUMMARY.md** - What was built
6. **INSTALLATION_CHECKLIST.md** - Detailed checklist

---

## 🔍 Quick Reference

### Services & Ports
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- Snapshots: http://localhost:5002
- Cache: http://localhost:5055

### Key Features
- ✅ Real-time crypto prices (Kraken)
- ✅ Portfolio tracking
- ✅ Automated DCA trading
- ✅ Market scanning & bot scoring
- ✅ Transaction history & audit
- ✅ Offline-first architecture

### Test It Works
```bash
# Health check
curl http://localhost:5001/health

# Get market data
curl http://localhost:5001/api/market/overview
```

---

## 🆘 Problems?

### Installation Issues
```bash
# Reinstall everything
npm run install:all
```

### Port Conflicts
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:5001 | xargs kill -9
```

### Still Not Working?
1. Check INSTALLATION_CHECKLIST.md
2. Review logs in `backend/services/main/logs/`
3. Check browser console (F12)

---

## 🎯 What's Next?

### Explore
- Navigate all 8 pages
- Test real-time features
- Review mock data

### Configure (Optional)
- Add Kraken API keys in `backend/services/main/.env`
- Setup Telegram notifications
- Customize DCA parameters

### Learn More
- Read ARCHITECTURE.md for system design
- Check API_DOCUMENTATION.md for endpoints
- Review code in `frontend/src/` and `backend/services/`

---

## 💡 Tips

- **Development Mode**: Works without API keys (uses mock data)
- **Live Prices**: Connect directly to Kraken WebSocket
- **Fallback System**: Works even if backend is down
- **Real-time**: All data updates automatically

---

**Ready to trade? Open http://localhost:3000 now! 🚀**
