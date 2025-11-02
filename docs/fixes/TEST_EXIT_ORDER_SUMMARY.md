# Exit Order Flow - Test & Fix Summary

## What Was Fixed

### Issue 1: Module Import Error
**Problem**: The BCH bot triggered an exit but failed with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/workspace/lib/services/krakenWebSocketService'
```

**Root Cause**: ES6 dynamic imports in Firebase require the `.js` extension

**Fix**: Updated imports in `dcaBotService.ts`:
```typescript
// Before
await import('./krakenWebSocketService')

// After
await import('./krakenWebSocketService.js')
```

**Deployed**: `processDCABots` v88 (deploying now)

---

## Test Setup Created

### Test Bot
- **ID**: `h4RkTNGUE3PqzKlFxxkQ`
- **Symbol**: BCH/USD
- **Holdings**: 0.063 BCH
- **Avg Price**: $484.13
- **Current Entries**: 3/10
- **Exit Percentage**: 90%

### Test Pending Order
- **ID**: `kUJPkY2gjW4vv4QlzRxi`
- **Side**: sell
- **Volume**: 0.05670000 BCH (90% of 0.063)
- **Status**: pending
- **Type**: market
- **Created**: 2025-10-29 01:21:31

---

## What Happens Next

### 1. Order Execution Attempt
`processOrderQueue` (runs every minute) will:
1. Find the pending order
2. Look up userId `test_user_123` in users collection
3. **FAIL** - user doesn't exist, no API keys

### 2. Expected Behavior for Real Bot
For the real BCH bot (`3x7ZYcJcDGemb8kePQqz`), once `processDCABots` v88 is deployed and runs:

1. **Balance Lookup** (REST API returns 0):
   ```
   [DCABotService] Kraken balance (rest_api): tried=BCH found= balance=0
   [DCABotService] Got 0 balance from REST API, trying WebSocket cache fallback...
   [DCABotService] Cache has 2 assets
   [DCABotService] ✅ Found balance in cache: BCH = 0.041292
   ```

2. **Exit Calculation**:
   ```
   Total Holdings: 0.041292 BCH
   Exit Quantity (90%): 0.0371628 BCH
   Keep Quantity (10%): 0.0041292 BCH
   ```

3. **Pending Order Creation**:
   ```javascript
   {
     botId: '3x7ZYcJcDGemb8kePQqz',
     userId: '<real_user_id>',
     symbol: 'BCH/USD',
     side: 'sell',
     type: 'market',
     volume: '0.03716280',
     pair: 'BCHUSD',
     status: 'pending',
     shouldRetry: true
   }
   ```

4. **Order Execution** (`processOrderQueue`):
   ```
   1. Get user's Kraken API keys
   2. Call Kraken: AddOrder(pair=BCHUSD, type=sell, ordertype=market, volume=0.03716280)
   3. Update order status to 'completed'
   4. Return transaction ID from Kraken
   ```

---

## Cleanup Test Data

To remove the test bot and order:

```bash
cd backend/functions
node cleanup-test-bot.mjs h4RkTNGUE3PqzKlFxxkQ
```

This will delete:
- Test bot: `h4RkTNGUE3PqzKlFxxkQ`
- Pending order: `kUJPkY2gjW4vv4QlzRxi`

---

## Current Deployment Status

| Function | Version | Status | Notes |
|----------|---------|--------|-------|
| `processDCABots` | v88 | Deploying | Fixed import paths for cache fallback |
| `processOrderQueue` | v65 | Active | No changes needed |
| `updateMarketData` | v73 | Active | Fixed Firestore document ID issue |

---

## Next Steps

1. Wait for `processDCABots` v88 to finish deploying (~2 min)
2. Wait for next 5-minute interval (runs at :00, :05, :10, :15, etc.)
3. Real BCH bot should create pending exit order
4. Monitor logs for successful order creation:
   ```bash
   firebase functions:log --only processDCABots
   ```

---

## Verification Commands

Check pending orders:
```bash
node check-bch-status.mjs
```

Check processDCABots logs:
```bash
firebase functions:log --only processDCABots | head -100
```

Check processOrderQueue logs:
```bash
firebase functions:log --only processOrderQueue | head -100
```

---

## Files Created

1. `test-exit-order-flow.mjs` - Creates test bot and pending order
2. `cleanup-test-bot.mjs` - Removes test data
3. `check-bch-status.mjs` - Status checker for BCH bots/orders
4. `check-bch-market-data.mjs` - Market data checker
5. `check-all-market-data.mjs` - All market data checker

All test scripts are in `/backend/functions/` directory.
