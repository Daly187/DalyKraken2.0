# DalyDCA Bot Database Setup - Complete Guide

## Overview

Your DalyDCA application now has a **complete database implementation** for managing DCA bots! This guide will help you populate your historical bots that were created before the app was fully implemented.

## What's Been Implemented

### ✅ Backend Infrastructure
- **Firestore Database Schema**: Collections for `dcaBots` and bot `entries`
- **DCA Bot Service**: Complete business logic for bot execution and management
- **API Routes**: Full CRUD operations (Create, Read, Update, Delete, Pause, Resume)
- **Market Analysis Integration**: Trend alignment and support/resistance checking

### ✅ Frontend Integration
- **DalyDCA Page**: Already integrated with the database
- **API Service**: Configured to call the correct endpoints
- **Live Bot Display**: Shows real-time P&L, entries, and status
- **Bot Management**: Create, pause, resume, and delete bots from the UI

### ✅ Population Scripts
- **JSON Template**: Easy-to-edit format for historical bot data
- **Population Script**: Automated Firestore population
- **Comprehensive Documentation**: Step-by-step guide

## Database Schema

### DCA Bots Collection (`dcaBots`)

Each bot document contains:

```typescript
{
  id: string;                           // Auto-generated
  userId: string;                       // User identifier
  symbol: string;                       // e.g., "BTC/USD"
  initialOrderAmount: number;           // First entry amount (USD)
  tradeMultiplier: number;              // Entry size multiplier (default: 2)
  reEntryCount: number;                 // Max entries (default: 8)
  stepPercent: number;                  // Initial price drop % (default: 1)
  stepMultiplier: number;               // Step percent multiplier (default: 2)
  tpTarget: number;                     // Take profit % (default: 3)
  supportResistanceEnabled: boolean;    // Use S/R levels
  reEntryDelay: number;                 // Minutes between entries (default: 888)
  trendAlignmentEnabled: boolean;       // Check trend scores
  status: 'active' | 'paused' | 'completed' | 'stopped';
  createdAt: string;                    // ISO timestamp
  updatedAt: string;                    // ISO timestamp
}
```

### Bot Entries Subcollection (`dcaBots/{botId}/entries`)

Each entry document contains:

```typescript
{
  id: string;                           // Auto-generated
  botId: string;                        // Parent bot ID
  entryNumber: number;                  // Sequential entry number
  orderAmount: number;                  // USD amount
  price: number;                        // Execution price
  quantity: number;                     // Crypto amount
  timestamp: string;                    // ISO timestamp
  orderId?: string;                     // Kraken order ID
  txid?: string;                        // Kraken transaction ID
  status: 'pending' | 'filled' | 'failed';
}
```

## Quick Start Guide

### Step 1: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to: **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Save the downloaded file as:
   ```
   backend/functions/serviceAccountKey.json
   ```

### Step 2: Prepare Your Historical Data

1. **Open the Audit Log in your app** to review your trade history

2. **Copy the template file:**
   ```bash
   cp scripts/historical-bots-template.json scripts/historical-bots.json
   ```

3. **Edit `scripts/historical-bots.json`** with your actual data from the audit log

### Step 3: Run the Population Script

```bash
npm run populate-bots
```

Or manually:
```bash
npx ts-node scripts/populate-from-json.ts
```

### Step 4: Verify in the App

1. Open your DalyDCA page
2. Your historical bots should appear in the "Live Bots" table
3. Each bot will show live P&L, entries, and current status

## Example: Creating a Bot Entry

Based on these trades from your audit log:

| Date | Symbol | Type | Price | Volume | Cost | Order ID |
|------|--------|------|-------|--------|------|----------|
| Jan 15, 10:30 | BTC/USD | BUY | $45,000 | 0.000222 | $10 | O-123 |
| Jan 16, 14:20 | BTC/USD | BUY | $44,550 | 0.000449 | $20 | O-124 |
| Jan 17, 09:15 | BTC/USD | BUY | $44,109 | 0.000907 | $40 | O-125 |

Create this bot entry in `historical-bots.json`:

```json
{
  "bots": [
    {
      "symbol": "BTC/USD",
      "initialOrderAmount": 10,
      "tradeMultiplier": 2,
      "reEntryCount": 8,
      "stepPercent": 1,
      "stepMultiplier": 2,
      "tpTarget": 3,
      "supportResistanceEnabled": false,
      "reEntryDelay": 888,
      "trendAlignmentEnabled": true,
      "status": "active",
      "userId": "default-user",
      "entries": [
        {
          "entryNumber": 1,
          "orderAmount": 10,
          "price": 45000,
          "quantity": 0.000222,
          "timestamp": "2025-01-15T10:30:00.000Z",
          "orderId": "O-123",
          "status": "filled"
        },
        {
          "entryNumber": 2,
          "orderAmount": 20,
          "price": 44550,
          "quantity": 0.000449,
          "timestamp": "2025-01-16T14:20:00.000Z",
          "orderId": "O-124",
          "status": "filled"
        },
        {
          "entryNumber": 3,
          "orderAmount": 40,
          "price": 44109,
          "quantity": 0.000907,
          "timestamp": "2025-01-17T09:15:00.000Z",
          "orderId": "O-125",
          "status": "filled"
        }
      ]
    }
  ]
}
```

## Bot Configuration Guide

### Initial Order Amount
- The USD amount for your first entry
- Example: `10` means $10 for the first buy

### Trade Multiplier
- How much to multiply each subsequent entry
- Example: `2` with initial $10 → $10, $20, $40, $80, $160...

### Re-Entry Count
- Maximum number of entries the bot can make
- Example: `8` means up to 8 total entries

### Step Percent
- Initial price drop percentage for re-entry
- Example: `1` means 1% drop triggers next entry

### Step Multiplier
- How much to multiply the step percent each time
- Example: `2` with initial 1% → 1%, 2%, 4%, 8%, 16%...

### TP Target
- Take profit percentage above average entry price
- Example: `3` means sell when 3% above average cost

### Support Resistance Enabled
- `true`: Wait for price to cross support before entering
- `false`: Enter based on price drop alone

### Re-Entry Delay
- Minimum minutes between entries
- Example: `888` means 14.8 hours cooldown

### Trend Alignment Enabled
- `true`: Only enter when both tech & trend scores are bullish
- `false`: Ignore trend scores

### Status Options
- `"active"`: Bot is running, will make new entries
- `"paused"`: Temporarily stopped
- `"completed"`: Exited all positions successfully
- `"stopped"`: Manually stopped by user

## API Endpoints

The following endpoints are available (via Firebase Functions):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dca-bots` | Get all bots for user |
| GET | `/api/dca-bots/:id` | Get specific bot |
| POST | `/api/dca-bots` | Create new bot |
| PUT | `/api/dca-bots/:id` | Update bot config |
| DELETE | `/api/dca-bots/:id` | Delete bot |
| POST | `/api/dca-bots/:id/pause` | Pause bot |
| POST | `/api/dca-bots/:id/resume` | Resume bot |
| GET | `/api/dca-bots/:id/executions` | Get execution history |

## Frontend Usage

### Creating a New Bot (via UI)

1. Open the DalyDCA page
2. Fill out the "Create New DCA Bot" form
3. Select trading pairs
4. Configure strategy parameters
5. Click "Create Bot"

### Managing Existing Bots

- **Pause**: Click pause button on any active bot
- **Resume**: Click resume button on paused bots
- **Delete**: Click delete button (with confirmation)
- **View Details**: All entry history and P&L shown in table

### Live Data Updates

The DalyDCA page auto-refreshes every 5 minutes and shows:
- Current price
- Unrealized P&L
- Average entry price
- Next entry price
- Take profit target
- Trend alignment status

## Firestore Console Management

You can also manage bots directly in Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database**
3. Browse collections:
   - `dcaBots`: Main bot configurations
   - `dcaBots/{botId}/entries`: Individual trade entries
   - `botExecutions`: Execution logs

## Files Created

```
DalyKraken2.0/
├── scripts/
│   ├── README.md                          # Detailed usage guide
│   ├── historical-bots-template.json      # Template for bot data
│   ├── populate-from-json.ts              # Population script
│   └── populate-historical-bots.ts        # Alternative script
├── backend/functions/src/
│   ├── services/
│   │   └── dcaBotService.ts              # Already existed ✓
│   └── routes/
│       └── dcaBots.ts                     # Already existed ✓
└── DCA_BOT_SETUP_GUIDE.md                # This file
```

## Troubleshooting

### "Service account key not found"
**Solution:** Download your Firebase service account key and save it as `backend/functions/serviceAccountKey.json`

### "historical-bots.json not found"
**Solution:** Copy the template: `cp scripts/historical-bots-template.json scripts/historical-bots.json`

### "No bots found in historical-bots.json"
**Solution:** Make sure your JSON has a `"bots"` array with at least one bot entry

### "Bots not appearing in the app"
**Solution:**
1. Check the script output for errors
2. Hard refresh the app (Cmd+Shift+R)
3. Check browser console
4. Verify Firebase connection

### "Invalid JSON"
**Solution:** Validate your JSON at [jsonlint.com](https://jsonlint.com/)

## Next Steps

1. ✅ **Populate historical bots** using the scripts
2. ✅ **Test creating new bots** from the UI
3. ✅ **Monitor live P&L** on the DalyDCA page
4. ✅ **Set up automated execution** (optional - via Firebase scheduled functions)

## Support

For issues or questions:
1. Check the `scripts/README.md` for detailed instructions
2. Review the Firebase Console for database errors
3. Check browser console for frontend errors
4. Review the backend logs: `npm run firebase:logs`

---

**Status:** ✅ Complete and Ready to Use

The database infrastructure is fully implemented. You just need to populate your historical bots!
