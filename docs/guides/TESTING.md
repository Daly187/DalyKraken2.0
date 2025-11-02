# DalyDEPEG Testing Guide

## Quick Start - Verify System is Working

### Option 1: Quick Health Check (Fastest)
```bash
# Set your auth token
export AUTH_TOKEN="your-jwt-token-here"

# Run quick health check
./test-depeg-health.sh
```

**What it checks:**
- ✅ API is online and responding
- ✅ Depeg configuration endpoint working
- ✅ Stablecoin price fetching from Kraken
- ✅ Opportunity detection logic
- ✅ Scheduled function execution status

---

### Option 2: Full API Test Suite (Comprehensive)
```bash
# Set your auth token
export AUTH_TOKEN="your-jwt-token-here"

# Run full test suite
cd backend/functions
node test-depeg.js
```

**What it tests:**
1. API Health Check
2. Get Depeg Configuration
3. Get Stablecoin Prices
4. Detect Arbitrage Opportunities
5. Get Open Positions
6. Get Trade History
7. Update Configuration
8. Manual Monitoring Trigger

---

## Frontend Testing Checklist

### Step 1: Access the Dashboard
1. Go to: https://dalydough.web.app
2. Login with your credentials
3. Navigate to **Strategies → DalyDEPEG**

**What to verify:**
- ✅ Page loads without errors
- ✅ UI displays correctly
- ✅ Summary cards show at top

---

### Step 2: Check Live Price Monitoring
In the **Live Price Monitor** section:

**What to look for:**
- ✅ Prices are updating (check timestamp)
- ✅ Depeg percentages are calculated
- ✅ Color coding shows correctly:
  - 🔴 Red = >2% depeg (extreme)
  - 🟠 Orange = 1-2% depeg (high)
  - 🟡 Yellow = 0.5-1% depeg (medium)
  - 🟢 Green = <0.5% depeg (normal)

**How to verify real data vs mock:**
- Real data: Timestamp updates every 5 seconds
- Real data: Prices fluctuate slightly
- Mock data: Static prices, old timestamps

---

### Step 3: Check Opportunity Detection
In the **Arbitrage Opportunities** section:

**What to look for:**
- ✅ Section shows opportunities (if any exist)
- ✅ Each opportunity shows:
  - Pair name (USDT/USD, USDC/USD, etc.)
  - Buy/Sell direction
  - Entry and target prices
  - Estimated profit after fees
  - Risk level and confidence score
- ✅ "Execute Trade" button is clickable

**Note:** It's normal to see zero opportunities if no stablecoins are depegged >0.5%

---

### Step 4: Test Configuration
In the **Strategy Configuration** panel:

**Test these controls:**
1. Toggle **Enable Strategy** on/off
   - ✅ Status changes immediately
   - ✅ Auto-refresh starts when enabled

2. Adjust **Min Depeg Threshold** slider
   - ✅ Value updates as you drag
   - ✅ Auto-saves after 1 second (watch for confirmation)

3. Toggle **Auto-Execute Trades**
   - ✅ Switch toggles on/off
   - ✅ Setting persists after page refresh

4. Change **Risk Level** (Conservative/Moderate/Aggressive)
   - ✅ Selection changes
   - ✅ Other parameters adjust accordingly

**Verify auto-save:**
- Make a change, wait 2 seconds
- Refresh the page
- Your changes should still be there

---

### Step 5: Check Positions (If You Have Trades)
In the **Active Positions** section:

**What to verify:**
- ✅ Shows any open positions
- ✅ P&L updates in real-time
- ✅ Progress bar shows movement to target
- ✅ Duration counts up
- ✅ "Close Position" button works

---

### Step 6: Review Trade History
In the **Trade History** section:

**What to check:**
- ✅ Shows completed trades (if any)
- ✅ Displays profit/loss correctly
- ✅ Shows fees breakdown
- ✅ Net profit calculation is accurate

---

## View Firebase Logs

### Check Scheduled Function Execution
```bash
# View monitorDepegOpportunities logs (runs every minute)
firebase functions:log --only monitorDepegOpportunities

# Filter for recent executions
firebase functions:log --only monitorDepegOpportunities --limit 10

# Watch logs in real-time
firebase functions:log --only monitorDepegOpportunities --follow
```

**What to look for in logs:**
```
[DepegMonitor] Running scheduled depeg monitoring...
[DepegMonitor] Found X opportunities for user...
[DepegMonitor] Executed trade for user...
[DepegMonitor] Summary: X opportunities detected, Y trades executed
```

---

### Check API Logs
```bash
# View all API logs and filter for depeg
firebase functions:log --only api | grep -i depeg

# View recent API errors
firebase functions:log --only api --limit 50 | grep -i error
```

---

### Check System Logs in Firestore

**View monitoring summaries:**
1. Go to Firebase Console
2. Navigate to **Firestore Database**
3. Open collection: `systemLogs`
4. Look for documents with type: `depeg_monitoring`

**Each log entry shows:**
- `timestamp`: When monitoring ran
- `summary.totalOpportunities`: Opportunities detected
- `summary.totalExecuted`: Trades executed
- `summary.errorCount`: Any errors
- `errors`: Array of error messages (if any)

---

## Testing Real Trade Execution

### ⚠️ IMPORTANT: Test with Small Amounts First!

**Before enabling auto-execute:**
1. ✅ Set `maxPositionSize` to a small amount ($10-$50)
2. ✅ Set `maxAllocationPercent` to 5-10%
3. ✅ Enable `stopLossPercent` at 3%
4. ✅ Verify Kraken API keys have correct permissions

---

### Manual Trade Test (Safest)
1. Keep `Auto-Execute` **OFF**
2. Wait for an opportunity to appear
3. Click **"Execute Trade"** button manually
4. Verify the trade executes in Kraken
5. Check position appears in **Active Positions**
6. Monitor P&L updates

---

### Auto-Execute Test (After Manual Works)
1. Set conservative limits
2. Enable **Auto-Execute**
3. Wait up to 1 minute for scheduled function
4. Check **systemLogs** in Firestore
5. Verify trade shows in **Active Positions**

---

## Common Issues & Solutions

### Issue: "Using Demo Data" notification
**Cause:** Frontend couldn't connect to API
**Solution:**
- Verify you're logged in
- Check AUTH_TOKEN is valid
- Run health check script

---

### Issue: No opportunities showing
**Cause:** Normal market conditions
**Reason:** Stablecoins are stable! No depegs >0.5%
**Solution:** This is expected. Wait for market volatility.

---

### Issue: Scheduled function not running
**Cause:** Function might need time to initialize
**Solution:**
```bash
# Check if function exists
firebase functions:list | grep monitorDepegOpportunities

# View recent executions
firebase functions:log --only monitorDepegOpportunities --limit 5
```

---

### Issue: Configuration not saving
**Cause:** API connection or auth issue
**Solution:**
1. Check browser console for errors (F12)
2. Verify you're logged in
3. Run: `./test-depeg-health.sh`

---

## Success Indicators

### ✅ System is Working When:
1. Health check script passes all tests
2. Prices update every 5 seconds in UI
3. Configuration saves successfully
4. Firebase logs show scheduled execution
5. Manual trade execution works

---

### ✅ Auto-Trading is Working When:
1. systemLogs shows `totalExecuted > 0`
2. Positions appear after opportunities
3. P&L updates in real-time
4. Trade history grows over time

---

## Performance Monitoring

### Check System Performance
```bash
# CPU and memory usage
firebase functions:log --only monitorDepegOpportunities | grep -i "memory\|cpu"

# Execution time
firebase functions:log --only monitorDepegOpportunities | grep -i "elapsed\|duration"

# Error rate
firebase functions:log --only monitorDepegOpportunities | grep -i "error" | wc -l
```

---

### Monitor Trade Success Rate
In Firestore:
1. Go to `systemLogs` collection
2. Filter by `type == "depeg_monitoring"`
3. Calculate: `totalExecuted / totalOpportunities`

**Good success rate:** 80%+
**Low success rate:** Check error messages in logs

---

## Getting Your AUTH_TOKEN

### Method 1: From Browser Console
1. Login to https://dalydough.web.app
2. Open browser console (F12)
3. Type: `localStorage.getItem('auth_token')`
4. Copy the token (without quotes)

### Method 2: From Network Tab
1. Login to https://dalydough.web.app
2. Open browser DevTools (F12)
3. Go to **Network** tab
4. Look for any API request
5. Check **Request Headers** → **Authorization**
6. Copy the token after "Bearer "

---

## Next Steps After Testing

### If Tests Pass:
1. ✅ Gradually increase position sizes
2. ✅ Enable auto-execute for hands-free trading
3. ✅ Monitor daily P&L
4. ✅ Review weekly performance

### If Tests Fail:
1. Check error messages in logs
2. Verify Kraken API credentials
3. Ensure sufficient account balance
4. Contact support with error details

---

## Support & Troubleshooting

**View all logs:**
```bash
# Combined view
firebase functions:log --only api,monitorDepegOpportunities --limit 100
```

**Check function status:**
```bash
firebase functions:list
```

**Redeploy if needed:**
```bash
firebase deploy --only functions:monitorDepegOpportunities
```

---

## Happy Trading! 🚀

Your DalyDEPEG system is monitoring markets 24/7 for profitable opportunities. Remember:
- Start small
- Monitor regularly
- Adjust strategy based on results
- Keep stop-losses enabled

Good luck and trade safely! 💰
