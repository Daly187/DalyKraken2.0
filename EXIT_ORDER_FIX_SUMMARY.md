# DCA Bot Exit Order Fix - Summary

## Problem Identified

Two DCA bots failed during the exit (sell) process, getting stuck in an infinite retry loop. Analysis revealed:

### Root Cause
**Order ID**: `R94lmVRBkJjtt5rWWEvX`
**Bot ID**: `3x7ZYcJcDGemb8kePQqz`
**Issue**: Sell order stuck in infinite PROCESSING → RETRY loop (123+ failed attempts over 24 hours)

### What Was Happening
1. Bot reached take profit target and created a sell order
2. Bot status changed to `exiting`
3. Sell order failed with "All 1 API keys failed"
4. Order kept getting reset from PROCESSING → RETRY every 12 minutes
5. **CRITICAL**: Order never actually executed, just cycled indefinitely
6. Bot remained stuck in `exiting` status, unable to process new entries

### Why It Failed
1. **No exception handling**: Uncaught exceptions didn't mark orders as failed
2. **No infinite loop protection**: Orders could retry forever (no max error count)
3. **No bot recovery**: Bots stuck in `exiting` never got reset to `active`
4. **Silent failures**: Errors in bot update logic weren't logged properly

---

## Fixes Implemented

### 1. Exception Handling ([orderExecutorService.ts:107-126](backend/functions/src/services/orderExecutorService.ts#L107-L126))
**Before**: Uncaught exceptions were logged but orders stayed in PROCESSING status
```typescript
} catch (error: any) {
  console.error(`[OrderExecutor] Error executing order:`, error.message);
  failed++;
}
```

**After**: Exceptions now properly mark orders as failed
```typescript
} catch (error: any) {
  console.error(`[OrderExecutor] CRITICAL: Unhandled error executing order:`, error.message);

  // Mark order as failed to prevent infinite PROCESSING loop
  await orderQueueService.markAsFailed(
    order.id,
    `Unhandled exception: ${error.message}`,
    undefined,
    true
  );

  failed++;
}
```

### 2. Infinite Loop Protection ([orderExecutorService.ts:149-167](backend/functions/src/services/orderExecutorService.ts#L149-L167))
**New**: Detects and stops orders stuck in infinite retry loops
```typescript
// Check for excessive retries (infinite loop protection)
if (order.errors && order.errors.length > 50) {
  const errorMsg = `Order abandoned after ${order.errors.length} failed attempts`;
  console.error(`[OrderExecutor] ${errorMsg}`);

  await orderQueueService.markAsFailed(order.id, errorMsg, undefined, false);

  // If this is an exit order, reset the bot back to active
  if (order.side === 'sell') {
    await this.handleFailedExitOrder(order, errorMsg);
  }

  return { success: false, error: errorMsg, shouldRetry: false };
}
```

### 3. Bot Recovery System ([orderExecutorService.ts:542-589](backend/functions/src/services/orderExecutorService.ts#L542-L589))
**New**: Automatically recovers bots stuck in `exiting` status
```typescript
private async handleFailedExitOrder(order: PendingOrder, error: string) {
  // Check if bot is stuck in 'exiting' status
  if (bot.status === 'exiting') {
    // Reset bot to active so user can manually intervene
    await db.collection('dcaBots').doc(order.botId).update({
      status: 'active',
      updatedAt: new Date().toISOString(),
      lastFailedExitReason: error,
      lastFailedExitTime: new Date().toISOString(),
    });

    console.log(`✅ Bot ${order.botId} reset to 'active' after failed exit`);
  }
}
```

### 4. Improved Error Logging ([orderExecutorService.ts:798-836](backend/functions/src/services/orderExecutorService.ts#L798-L836))
**Enhanced**: Better error tracking for bot update failures
```typescript
} catch (error: any) {
  console.error(`CRITICAL: Error updating bot ${order.botId}:`, error.message);
  console.error(`Stack trace:`, error.stack);

  // Log to botExecutions for visibility
  await db.collection('botExecutions').add({
    action: order.side === 'buy' ? 'entry' : 'exit',
    reason: `Bot update failed: ${error.message}`,
    success: false,
    error: error.message,
  });

  // Reset bot if this is a sell order
  if (order.side === 'sell') {
    await this.handleFailedExitOrder(order, `Bot update failed: ${error.message}`);
  }

  // Don't throw - order succeeded on Kraken, just bot update failed
  console.warn(`Order completed on Kraken but bot update failed`);
}
```

---

## Recovery Actions

### Step 1: Run Recovery Script
Fix currently stuck bots and orders:
```bash
GOOGLE_APPLICATION_CREDENTIALS="" FIRESTORE_EMULATOR_HOST="" GCLOUD_PROJECT=dalydough NODE_PATH=backend/functions/node_modules node fix-stuck-exit-orders.js
```

**What it does**:
- Finds bots stuck in `exiting` status → resets to `active`
- Finds sell orders with 50+ errors → marks as permanently `failed`
- Logs recovery actions to `botExecutions` collection
- Provides summary of recovered bots and orders

### Step 2: Deploy Updated Code
Deploy the fixes to Firebase Functions:
```bash
npm --prefix backend/functions run build
npm --prefix backend/functions run deploy
```

### Step 3: Monitor
Check Firebase Console:
- **dcaBots**: Verify bots are in `active` status (not `exiting`)
- **pendingOrders**: Check for orders stuck in `processing`/`retry`
- **botExecutions**: Review any `exit_failed` or `recovery` logs

---

## Expected Behavior (After Fix)

### Normal Exit Flow
1. Bot reaches take profit target
2. Status changes: `active` → `exiting`
3. Sell order created and queued
4. Order executor places sell order on Kraken
5. Order completes successfully
6. Bot updates: entries deleted, status reset to `active`, new cycle started
7. ✅ **Bot ready for next cycle**

### Failed Exit Flow (New Behavior)
1. Bot reaches take profit target
2. Status changes: `active` → `exiting`
3. Sell order created and queued
4. Order executor attempts to place sell order
5. **Order fails** (e.g., insufficient balance, API error)
6. Order retries up to 50 attempts
7. **After 50 attempts**: Order marked as permanently `failed`
8. **Bot auto-recovery**: Status reset `exiting` → `active`
9. Error logged to `botExecutions` with `lastFailedExitReason`
10. ✅ **User can manually retry or modify bot settings**

---

## Prevention Measures

### What's Now Protected Against

1. **Infinite Retry Loops**: Orders are abandoned after 50 failed attempts
2. **Stuck Bots**: Bots automatically reset to `active` if exit fails
3. **Silent Failures**: All errors logged to `botExecutions` for visibility
4. **Uncaught Exceptions**: Properly handled and orders marked as failed
5. **Bot Update Failures**: Don't prevent order completion, logged separately

### New Safety Features

- **Error Count Limit**: Max 50 retry attempts per order
- **Auto-Recovery**: Bots automatically exit `exiting` status on repeated failures
- **Comprehensive Logging**: All exit failures logged with detailed error messages
- **Graceful Degradation**: Order success on Kraken doesn't fail due to bot update issues

---

## How to Check if Bots are Healthy

### Firebase Console Checks
1. **dcaBots Collection**
   - Status should be `active`, `paused`, or `completed`
   - No bots should be stuck in `exiting` for more than a few minutes
   - Check `lastFailedExitReason` field for recent exit failures

2. **pendingOrders Collection**
   - No orders should have `errors.length > 50`
   - No orders in `processing` status for more than 5 minutes
   - Failed sell orders should have clear `lastError` messages

3. **botExecutions Collection**
   - Look for `action: 'exit_failed'` entries
   - Check `reason` field for failure details
   - Verify `action: 'recovery'` entries after running fix script

### Command Line Checks
```bash
# Check for stuck bots
gcloud firestore query 'SELECT * FROM dcaBots WHERE status = "exiting"'

# Check for problematic orders
gcloud firestore query 'SELECT * FROM pendingOrders WHERE side = "sell" AND status IN ["processing", "retry"]'
```

---

## Manual Intervention (If Needed)

If a bot still shows issues after the fix:

### Option 1: Manually Reset Bot
```javascript
// In Firebase Console
await db.collection('dcaBots').doc('BOT_ID').update({
  status: 'active',
  updatedAt: new Date().toISOString()
});
```

### Option 2: Delete Failed Order
```javascript
// In Firebase Console
await db.collection('pendingOrders').doc('ORDER_ID').delete();
```

### Option 3: Manually Execute Exit
1. Go to bot's page in frontend
2. Click "Manual Exit" or "Sell All" button
3. This creates a new sell order with fresh API key attempt

---

## Testing Recommendations

1. **Monitor for 24 hours**: Watch `botExecutions` for any `exit_failed` entries
2. **Check order queue**: Ensure no orders stuck in `processing` > 5 minutes
3. **Verify bot cycling**: Confirm bots complete cycles and restart properly
4. **Review error logs**: Check Firebase Functions logs for `CRITICAL` errors

---

## Files Modified

1. `backend/functions/src/services/orderExecutorService.ts`
   - Added exception handling in order execution loop
   - Added infinite loop protection (50 error limit)
   - Added `handleFailedExitOrder()` method for bot recovery
   - Enhanced error logging in `updateBotAfterOrderCompletion()`

2. `fix-stuck-exit-orders.js` (NEW)
   - Recovery script for currently stuck bots/orders

3. `check-bot-failures.js` (NEW)
   - Diagnostic script to check for issues

4. `EXIT_ORDER_FIX_SUMMARY.md` (THIS FILE)
   - Complete documentation of fixes

---

## Summary

✅ **Fixed**: Infinite retry loops for failed exit orders
✅ **Fixed**: Bots stuck in `exiting` status forever
✅ **Fixed**: Silent failures during bot updates
✅ **Added**: Auto-recovery for stuck bots
✅ **Added**: Comprehensive error logging
✅ **Added**: Recovery scripts for existing issues

**Next Steps**:
1. Run `fix-stuck-exit-orders.js` to recover currently stuck bots
2. Deploy updated code to Firebase Functions
3. Monitor for 24 hours to ensure stability

**Your specific stuck orders will be fixed when you run the recovery script!** 🎉
