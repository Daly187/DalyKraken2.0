# Order Queue Fix - Kraken API Keys in Firestore

## Problem Summary

14 pending orders are stuck in RETRY status and not executing because the `processOrderQueue` scheduled function cannot find Kraken API keys.

### Root Cause

- DCA bots created orders using API keys from HTTP headers (frontend → backend)
- Orders were queued successfully in Firestore
- The `processOrderQueue` scheduler runs every minute to execute pending orders
- **But**: The scheduler looks for API keys in `users/{userId}/krakenKeys` in Firestore
- **Issue**: That field doesn't exist - user hasn't saved keys to Firestore yet

### Technical Details

The system has two ways of getting Kraken API keys:

1. **HTTP Headers** (for manual trades and DCA bot creation)
   - Frontend sends `X-Kraken-Key` and `X-Kraken-Secret` headers
   - Backend receives them and uses directly
   - ✅ This works - DCA bots successfully created orders

2. **Firestore** (for scheduled order execution)
   - Scheduler function `processOrderQueue` runs every minute
   - Calls `orderExecutorService.executePendingOrders()` without parameters
   - Service looks for keys at `users/{userId}/krakenKeys`
   - ❌ This fails - field doesn't exist

## Solution Implemented

### Backend (Already Complete)
The backend endpoint already exists and works correctly:

```
POST /settings/kraken-keys
Body: { keys: [{ id, name, apiKey, apiSecret, isActive }] }
```

This endpoint:
- ✅ Encrypts API keys before storage
- ✅ Saves to `users/{userId}/krakenKeys` in Firestore
- ✅ Used by order executor service for scheduled execution

### Frontend (Fixed)
Updated `frontend/src/pages/Settings.tsx`:

**Before:**
```typescript
const saveKrakenKeys = () => {
  // Only saved to localStorage
  localStorage.setItem('kraken_api_keys', JSON.stringify(krakenKeys));
  // TODO: Send to backend API  <- This was commented out!
}
```

**After:**
```typescript
const saveKrakenKeys = async () => {
  // Save to localStorage (backward compatibility)
  localStorage.setItem('kraken_api_keys', JSON.stringify(krakenKeys));

  // Save to backend API (Firestore) - NOW ACTUALLY CALLED
  await apiService.saveKrakenKeys(krakenKeys);
}
```

## How to Fix the Stuck Orders

### Step 1: Deploy Frontend Changes
```bash
npm run build:frontend
npm run firebase:deploy:hosting
```

### Step 2: Save API Keys via UI

1. Open the DalyDough web app and login
2. Navigate to **Settings** page
3. Scroll to **"Kraken API Keys"** section
4. Enter your Kraken API credentials:
   - API Key: (from your Kraken account)
   - API Secret: (from your Kraken account)
5. Make sure "Active" is checked
6. Click **"Save Kraken Keys"**

You should see a success notification: "Your Kraken API keys have been saved securely to the server"

### Step 3: Verify Keys Were Saved

Run this script to verify:
```bash
node backend/functions/check-user-api-keys.mjs
```

Expected output:
```
[Check] ✅ User document exists
[Check] ✅ krakenKeys field exists
[Check] Number of keys: 1
```

### Step 4: Wait for Orders to Execute

The `processOrderQueue` scheduler runs **every minute**. After saving your keys:

1. Wait 1-2 minutes
2. Check order status:
   ```bash
   node backend/functions/check-order-status.mjs
   ```
3. Orders should move from RETRY → PROCESSING → COMPLETED

### Step 5: Monitor Logs

Check Firebase Functions logs:
```bash
npx firebase functions:log
```

Look for:
```
[OrderExecutor] Getting API keys for user SpuaL2eGO3Nkh0kk2wkl
[OrderExecutor] Found 1 total Kraken keys
[OrderExecutor] 1 available keys after filtering
[OrderExecutor] Order executed successfully
```

## Current Status

### Completed ✅
- [x] Identified root cause (no krakenKeys in Firestore)
- [x] Fixed frontend Settings page to actually save keys
- [x] Backend endpoint already working correctly
- [x] Circuit breaker and retry logic deployed

### Pending ⏳
- [ ] Build and deploy frontend changes
- [ ] User saves API keys via Settings UI
- [ ] Verify 14 stuck orders execute successfully

## Files Modified

1. `frontend/src/pages/Settings.tsx` - Uncommented and fixed `saveKrakenKeys()` function
2. `backend/functions/src/index.ts` - Already had working endpoint (no changes needed)
3. `backend/functions/src/services/orderExecutorService.ts` - Already fetches from Firestore (no changes needed)

## Testing

After deploying and saving keys, you can manually trigger order execution:

```bash
# Check current order status
node backend/functions/check-order-status.mjs

# Check user has API keys
node backend/functions/check-user-api-keys.mjs

# View recent function logs
npx firebase functions:log
```

## Future Improvements

To prevent this issue in the future:

1. **Onboarding Flow**: When users first set up DCA bots, require them to save API keys via Settings
2. **Validation**: Before creating DCA bot, check if user has keys in Firestore
3. **UI Warning**: Show warning in UI if keys are only in localStorage and not in Firestore
4. **Auto-Migration**: Automatically save keys to Firestore when user makes their first manual trade

## Questions?

If orders still don't execute after saving keys:

1. Check Firebase Functions logs for errors
2. Verify user ID matches: `SpuaL2eGO3Nkh0kk2wkl`
3. Verify circuit breaker isn't blocking execution
4. Check if API keys have correct permissions in Kraken account
