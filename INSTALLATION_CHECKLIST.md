# DalyKraken 2.0 - Installation Checklist

## ✅ Pre-Installation Checklist

### System Requirements
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm or yarn installed (`npm --version`)
- [ ] Git installed (optional)
- [ ] 4 GB RAM minimum
- [ ] 1 GB free disk space

### Ports Available
- [ ] Port 3000 (Frontend)
- [ ] Port 5001 (Main Backend)
- [ ] Port 5002 (Snapshot Service)
- [ ] Port 5055 (Cache API)

---

## 🚀 Installation Steps

### Step 1: Setup Project
```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
```

- [ ] Navigate to project directory
- [ ] Verify all files are present

### Step 2: Run Setup Script
```bash
./setup.sh
```

**OR** install manually:

```bash
# Install all dependencies
npm run install:all

# Or individually:
cd frontend && npm install
cd backend/services/main && npm install
cd backend/services/snapshot && npm install
cd backend/services/cache && npm install
```

- [ ] All dependencies installed successfully
- [ ] No error messages during installation
- [ ] `.env` file created in `backend/services/main/`

### Step 3: Configure Environment (Optional)

Edit `backend/services/main/.env`:

```env
# Kraken API (Required for live trading)
KRAKEN_API_KEY=your_key_here
KRAKEN_API_SECRET=your_secret_here

# Optional Services
QUANTIFY_CRYPTO_API_KEY=your_key
COINMARKETCAP_API_KEY=your_key
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

- [ ] Environment file configured (or using mock data)
- [ ] API keys added (if using real data)
- [ ] Sensitive data not committed to git

### Step 4: Create Required Directories

These should be created automatically, but verify:

```bash
mkdir -p data/snapshots
mkdir -p backend/services/main/logs
```

- [ ] `data/snapshots/` directory exists
- [ ] `backend/services/main/logs/` directory exists

---

## 🏃 Running the Application

### Start All Services

Open 4 separate terminal windows:

#### Terminal 1: Frontend
```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
npm run dev:frontend
```

**Expected Output:**
```
VITE v5.2.8  ready in 543 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

- [ ] Frontend starts without errors
- [ ] Accessible at http://localhost:3000
- [ ] No error messages in console

#### Terminal 2: Main Backend
```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
npm run dev:backend
```

**Expected Output:**
```
🚀 DalyKraken Backend Server running on port 5001
📊 WebSocket server ready
🔗 REST API available at http://localhost:5001/api
```

- [ ] Backend starts without errors
- [ ] Listening on port 5001
- [ ] WebSocket server initialized

#### Terminal 3: Snapshot Service
```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
npm run dev:snapshot
```

**Expected Output:**
```
📸 Snapshot Service running on port 5002
📂 Snapshots saved to: [path]/data/snapshots
⏱️  Snapshot interval: */30 * * * * *
Creating snapshot...
Snapshot created: snapshot_[timestamp].json
```

- [ ] Snapshot service starts without errors
- [ ] First snapshot created successfully
- [ ] Snapshots directory populated

#### Terminal 4: Cache API
```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
npm run dev:cache
```

**Expected Output:**
```
💾 Cache API Service running on port 5055
📂 Data directory: [path]/data
⚡ Cache TTL: 5000ms
```

- [ ] Cache API starts without errors
- [ ] Listening on port 5055
- [ ] Can read snapshot files

---

## 🧪 Verification Tests

### Test 1: Health Checks

```bash
# Test all services
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5055/health
```

**Expected:** All return `{"status":"healthy",...}`

- [ ] Main backend health check passes
- [ ] Snapshot service health check passes
- [ ] Cache API health check passes

### Test 2: API Endpoints

```bash
# Test main API
curl http://localhost:5001/api/market/overview
curl http://localhost:5001/api/portfolio/overview
curl http://localhost:5001/api/dca/status
```

**Expected:** All return JSON data (mock data is fine)

- [ ] Market overview returns data
- [ ] Portfolio overview returns data
- [ ] DCA status returns data

### Test 3: Cache & Snapshot

```bash
# Test snapshot endpoint
curl http://localhost:5002/latest

# Test cache endpoint
curl http://localhost:5055/snapshot
```

**Expected:** Both return snapshot data

- [ ] Snapshot service returns data
- [ ] Cache API returns data

### Test 4: Frontend

Open browser to http://localhost:3000

- [ ] Landing page loads
- [ ] Can navigate to /login
- [ ] Can login with admin/admin
- [ ] Redirects to /dashboard after login
- [ ] Dashboard shows data (even if mock)
- [ ] No console errors

### Test 5: Navigation

After logging in, test all pages:

- [ ] Dashboard loads
- [ ] Crypto Market loads
- [ ] Crypto Trends loads
- [ ] Portfolio loads
- [ ] DalyDCA loads
- [ ] Scanner loads
- [ ] Audit Log loads
- [ ] Settings loads

### Test 6: Real-Time Features

On the Crypto Market page:

- [ ] Price table displays
- [ ] Prices update in real-time
- [ ] Can switch intervals (1m, 5m, etc.)
- [ ] Data streams from Kraken WebSocket

### Test 7: Fallback System

Stop the main backend (Ctrl+C in Terminal 2):

- [ ] Frontend still works
- [ ] Shows cached data
- [ ] System status shows "Fallback Mode"
- [ ] No critical errors

Restart the main backend:

- [ ] Frontend reconnects automatically
- [ ] System status shows "Connected"
- [ ] Data starts updating again

---

## 🐛 Troubleshooting

### Issue: Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:5001 | xargs kill -9  # Backend
lsof -ti:5002 | xargs kill -9  # Snapshot
lsof -ti:5055 | xargs kill -9  # Cache
```

- [ ] Problem resolved

### Issue: Module Not Found

**Error:** `Cannot find module 'express'` or similar

**Solution:**
```bash
# Reinstall dependencies
cd [service-directory]
rm -rf node_modules package-lock.json
npm install
```

- [ ] Problem resolved

### Issue: Frontend Won't Connect

**Symptoms:** Login successful but dashboard shows no data

**Solution:**
1. Check all backend services are running
2. Check browser console for errors
3. Verify CORS is enabled
4. Check backend logs

```bash
tail -f backend/services/main/logs/combined.log
```

- [ ] Problem resolved

### Issue: WebSocket Connection Failed

**Symptoms:** "Fallback Mode" or "Disconnected" in status

**Solution:**
1. Check main backend is running (port 5001)
2. Check browser console for WebSocket errors
3. Try refreshing the page
4. Check firewall/antivirus settings

**Note:** App should still work in fallback mode

- [ ] Problem resolved or acceptable

### Issue: No Snapshots Created

**Symptoms:** Snapshot service runs but no files in `data/snapshots/`

**Solution:**
1. Check directory permissions
2. Check snapshot service logs
3. Check main backend is running
4. Force create snapshot: `curl -X POST http://localhost:5002/snapshot`

- [ ] Problem resolved

### Issue: Mock Data Not Showing

**Symptoms:** Empty tables/charts after login

**Solution:**
1. Check browser console for errors
2. Check all services are running
3. Check API responses manually with curl
4. Clear browser cache and reload

- [ ] Problem resolved

---

## ✅ Final Verification Checklist

### Services Running
- [ ] Frontend (3000) - No errors in terminal
- [ ] Main Backend (5001) - Logs show activity
- [ ] Snapshot Service (5002) - Creating snapshots
- [ ] Cache API (5055) - Serving data

### Frontend Working
- [ ] Can access landing page
- [ ] Can login successfully
- [ ] Dashboard shows data
- [ ] All pages load
- [ ] Navigation works
- [ ] No console errors

### Backend Working
- [ ] Health checks pass
- [ ] API endpoints return data
- [ ] WebSocket connects
- [ ] Snapshots being created
- [ ] Cache serving data

### Features Working
- [ ] Real-time price updates (Crypto Market)
- [ ] Portfolio displays holdings
- [ ] DCA status shows
- [ ] Market scanning works
- [ ] Settings page functional
- [ ] Notifications appear

### System Status
- [ ] WebSocket connected (or fallback working)
- [ ] System status indicators correct
- [ ] No critical errors in any service
- [ ] Logs show normal activity

---

## 🎓 Next Steps After Installation

### 1. Explore the Application
- [ ] Navigate through all pages
- [ ] Test different features
- [ ] Review mock data structure

### 2. Read Documentation
- [ ] Read README.md
- [ ] Review ARCHITECTURE.md
- [ ] Check API_DOCUMENTATION.md

### 3. Configure for Real Use (Optional)
- [ ] Add Kraken API keys
- [ ] Configure Quantify Crypto
- [ ] Setup Telegram bot
- [ ] Test with real data

### 4. Customize (Optional)
- [ ] Change default login credentials
- [ ] Adjust DCA parameters
- [ ] Configure notification preferences
- [ ] Customize UI theme

---

## 📞 Support Resources

If you encounter issues:

1. **Check Logs**
   - Browser console (F12)
   - `backend/services/main/logs/error.log`
   - Terminal output from each service

2. **Review Documentation**
   - README.md (main docs)
   - QUICK_START.md (quick guide)
   - ARCHITECTURE.md (technical details)
   - API_DOCUMENTATION.md (API reference)

3. **Common Solutions**
   - Restart all services
   - Clear browser cache
   - Reinstall dependencies
   - Check port availability

4. **Test Endpoints Manually**
   ```bash
   curl http://localhost:5001/health
   curl http://localhost:5001/api/market/overview
   ```

---

## 🎉 Installation Complete!

If all checkboxes are marked, congratulations!

**DalyKraken 2.0 is fully installed and operational.**

You now have:
- ✅ A running crypto trading dashboard
- ✅ Real-time market data integration
- ✅ Automated DCA strategy system
- ✅ Multi-tier fallback architecture
- ✅ Complete audit and tracking system

**Happy Trading! 🚀📈**

---

**Version:** 2.0.0
**Last Updated:** 2025-10-17
