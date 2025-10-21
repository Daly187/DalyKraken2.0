# Trade Sync System

## Overview

The Trade Sync System automatically synchronizes Kraken trade history with your live DCA bots. This ensures that all trades executed on Kraken (whether through the platform, API, or manual trades) are properly tracked and allocated to the correct bots in your database.

## How It Works

### Automatic Sync (Every 15 Minutes)

A scheduled Firebase Function (`syncKrakenTrades`) runs every 15 minutes and:

1. **Fetches** the last 7 days of trade history from Kraken for each user
2. **Matches** each BUY trade to the appropriate bot by symbol (e.g., ATOM/USD → ATOM/USD bot)
3. **Creates** entries in the bot's `entries` subcollection with trade details
4. **Updates** bot statistics:
   - `currentEntryCount` - number of entries
   - `averageEntryPrice` - weighted average entry price
   - `totalVolume` - total crypto amount held
   - `totalInvested` - total USD invested
   - `lastEntryPrice` - most recent entry price
   - `lastEntryTime` - timestamp of last entry

### Manual Sync (On Demand)

You can trigger a sync manually via API:

**Endpoint:** `POST /audit/sync-trades`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 5 new trades to live bots",
  "data": {
    "success": true,
    "processed": 50,
    "added": 5,
    "skipped": 45,
    "errors": 0
  }
}
```

## Architecture

### Files Created

1. **`src/services/tradesSyncService.ts`** - Core sync logic
   - `syncUserTrades(userId)` - Sync trades for a specific user
   - `syncAllUsers()` - Sync trades for all users with Kraken keys

2. **`src/index.ts`** - Integration
   - `POST /audit/sync-trades` - Manual sync endpoint
   - `syncKrakenTrades` - Scheduled function (every 15 minutes)

### Data Flow

```
Kraken API
    ↓
getTradeHistory()
    ↓
Filter BUY trades
    ↓
Match to bot by symbol
    ↓
Check if entry exists (by txid)
    ↓
Create entry in bot/entries
    ↓
Update bot statistics
```

### Key Features

✅ **Idempotent** - Won't create duplicate entries (checks by Kraken txid)
✅ **Automatic** - Runs every 15 minutes without intervention
✅ **Safe** - Only processes BUY orders, skips sells and invalid pairs
✅ **Multi-user** - Handles multiple users with different API keys
✅ **Rate-limit aware** - Includes delays between requests

## Database Structure

### Before Sync
```
dcaBots/{botId}
  ├── symbol: "ATOM/USD"
  ├── status: "active"
  ├── currentEntryCount: 0
  ├── averageEntryPrice: 0
  ├── totalVolume: 0
  ├── totalInvested: 0
  └── entries/ (empty)
```

### After Sync
```
dcaBots/{botId}
  ├── symbol: "ATOM/USD"
  ├── status: "active"
  ├── currentEntryCount: 3
  ├── averageEntryPrice: 3.05
  ├── totalVolume: 9.82
  ├── totalInvested: 30.00
  └── entries/
      ├── {entryId1}
      │   ├── entryNumber: 1
      │   ├── price: 3.07
      │   ├── quantity: 3.26
      │   ├── orderAmount: 10.01
      │   ├── status: "filled"
      │   ├── orderId: "TXID123"
      │   └── source: "kraken_sync"
      ├── {entryId2}
      │   └── ...
      └── {entryId3}
          └── ...
```

## Monitoring

### Check Sync Status

View logs in Firebase Console:
```
Functions > syncKrakenTrades > Logs
```

Look for:
- `[TradesSync] Running scheduled trade sync...`
- `[TradesSync] Sync complete: X users, Y added`

### Manual Trigger via CLI

```bash
# Get your auth token from localStorage in browser
# Then run:
curl -X POST https://us-central1-dalydough.cloudfunctions.net/api/audit/sync-trades \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## Troubleshooting

### Trades not syncing?

1. **Check API keys are configured** - User must have active Kraken API keys in Firestore
2. **Check bot status** - Only syncs to `active` bots
3. **Check symbol matching** - Bot symbol must match normalized Kraken pair
4. **Check logs** - Look for errors in Firebase Functions logs
5. **Check rate limits** - Kraken may temporarily block if too many requests

### Missing some trades?

- Sync only fetches last 7 days of trades
- Run manual backfill for older trades (see backfill scripts)

### Duplicate entries?

- Should not happen (idempotent by txid)
- If it does, check `orderId` field uniqueness

## Future Enhancements

- [ ] Sync SELL orders to close positions
- [ ] Configurable sync interval per user
- [ ] Webhook support for instant sync
- [ ] Historical backfill for trades older than 7 days
- [ ] Support for other exchanges

## Related Files

- `/backend/functions/src/services/tradesSyncService.ts` - Sync service
- `/backend/functions/src/services/krakenService.ts` - Kraken API client
- `/backend/functions/src/index.ts` - API endpoints and scheduled functions
- `/backend/functions/backfill-from-kraken.mjs` - One-time backfill script
- `/backend/functions/backfill-manual.mjs` - Manual backfill with API keys

## Testing

### Test Scheduled Function Locally
```bash
cd backend/functions
npm run serve
# Trigger manually via Firebase emulator UI
```

### Test Endpoint
```bash
./test-sync.sh YOUR_AUTH_TOKEN
```

### Check Results
1. Go to Firebase Console > Firestore
2. Navigate to `dcaBots/{botId}/entries`
3. Verify new entries exist with `source: "kraken_sync"`
4. Check bot document for updated statistics
