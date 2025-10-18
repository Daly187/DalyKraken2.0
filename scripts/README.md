# DCA Bot Population Scripts

This directory contains scripts to populate your Firestore database with historical DCA bots based on your trading history.

## Overview

Your DalyDCA page now supports storing and managing DCA bots in Firestore. This allows you to:
- Track multiple DCA bots simultaneously
- View live profit/loss for each bot
- See entry history and performance
- Pause, resume, or delete bots as needed

Since you had bots running before the app was fully implemented, these scripts help you manually create those historical bots in the database.

## Prerequisites

1. **Firebase Service Account Key**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to: Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded file as: `backend/functions/serviceAccountKey.json`

2. **Node.js and TypeScript**
   ```bash
   npm install -g ts-node typescript
   ```

## Step-by-Step Guide

### Step 1: Review Your Trade History

1. Open your DalyDCA app
2. Go to the **Audit Log** page
3. Review your historical trades
4. Note the following for each symbol you traded:
   - Symbol (e.g., BTC/USD, ETH/USD)
   - All entry prices
   - All entry amounts
   - Timestamps of each trade
   - Kraken order IDs (if available)

### Step 2: Prepare Your Bot Data

1. Copy the template:
   ```bash
   cp scripts/historical-bots-template.json scripts/historical-bots.json
   ```

2. Edit `historical-bots.json` with your actual data:
   ```bash
   # Use your preferred text editor
   code scripts/historical-bots.json
   # or
   nano scripts/historical-bots.json
   ```

3. For each symbol you traded, create a bot entry:

```json
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
      "quantity": 0.00022222,
      "timestamp": "2025-01-15T10:30:00.000Z",
      "orderId": "KRAKEN-ORDER-123",
      "txid": "KRAKEN-TX-456",
      "status": "filled"
    }
  ]
}
```

**Field Explanations:**

| Field | Description | Example |
|-------|-------------|---------|
| `symbol` | Trading pair | "BTC/USD" |
| `initialOrderAmount` | First entry amount in USD | 10 |
| `tradeMultiplier` | Multiplier for each subsequent entry | 2 (2x, so 10, 20, 40, 80...) |
| `reEntryCount` | Max number of entries | 8 |
| `stepPercent` | Initial price drop % for re-entry | 1 (1% drop) |
| `stepMultiplier` | Multiplier for step percent | 2 (so 1%, 2%, 4%, 8%...) |
| `tpTarget` | Take profit target % | 3 (3% above average entry) |
| `status` | Bot status | "active", "paused", "completed", or "stopped" |
| `entries` | Array of historical trades | See entry structure below |

**Entry Structure:**

| Field | Description | Where to Find |
|-------|-------------|---------------|
| `entryNumber` | Sequential entry number | Start at 1, increment |
| `orderAmount` | USD amount of this entry | From audit log |
| `price` | Execution price | From audit log |
| `quantity` | Amount of crypto bought | orderAmount / price |
| `timestamp` | When the trade occurred | From audit log (ISO 8601 format) |
| `orderId` | Kraken order ID | From audit log (optional) |
| `txid` | Kraken transaction ID | From audit log (optional) |
| `status` | Entry status | Usually "filled" |

### Step 3: Run the Population Script

```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
npx ts-node scripts/populate-from-json.ts
```

The script will:
1. Read your `historical-bots.json` file
2. Validate the data
3. Create bots in Firestore
4. Create all historical entries for each bot
5. Show a summary of what was created

### Step 4: Verify in the App

1. Open your DalyDCA app
2. Go to the **DalyDCA** page
3. You should see your historical bots in the "Live Bots" table
4. Each bot will show:
   - Current entries
   - Average purchase price
   - Total invested
   - Unrealized P&L
   - Next entry price
   - Take profit target

## Bot Status Guide

- **active**: Bot is running and will make new entries when conditions are met
- **paused**: Bot is temporarily stopped (won't make new entries)
- **completed**: Bot has reached its goal and exited all positions
- **stopped**: Bot was manually stopped

## Example: Populating from Audit Log

Let's say your audit log shows these BTC trades:

| Date | Type | Price | Volume | Cost |
|------|------|-------|--------|------|
| Jan 15, 10:30 | BUY | $45,000 | 0.000222 | $10 |
| Jan 16, 14:20 | BUY | $44,550 | 0.000449 | $20 |
| Jan 17, 09:15 | BUY | $44,109 | 0.000907 | $40 |

You would create a bot entry like this:

```json
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
      "orderId": "OABCDE-12345-FGHIJK",
      "status": "filled"
    },
    {
      "entryNumber": 2,
      "orderAmount": 20,
      "price": 44550,
      "quantity": 0.000449,
      "timestamp": "2025-01-16T14:20:00.000Z",
      "orderId": "OABCDE-12346-FGHIJK",
      "status": "filled"
    },
    {
      "entryNumber": 3,
      "orderAmount": 40,
      "price": 44109,
      "quantity": 0.000907,
      "timestamp": "2025-01-17T09:15:00.000Z",
      "orderId": "OABCDE-12347-FGHIJK",
      "status": "filled"
    }
  ]
}
```

## Troubleshooting

### Error: Service account key not found

**Solution:**
1. Download your Firebase service account key
2. Save it as `backend/functions/serviceAccountKey.json`

### Error: historical-bots.json not found

**Solution:**
```bash
cp scripts/historical-bots-template.json scripts/historical-bots.json
```

### Error: Missing required field

**Solution:** Make sure each bot has at minimum:
- `symbol`
- `initialOrderAmount`
- `status`

### Bots not appearing in the app

**Solution:**
1. Check the script output for errors
2. Verify Firebase is accessible
3. Hard refresh the app (Cmd+Shift+R or Ctrl+Shift+R)
4. Check browser console for errors

## Managing Bots After Creation

Once your historical bots are created, you can:

### Via the UI
- **Pause**: Click the pause button to stop new entries
- **Resume**: Click the resume button to activate again
- **Delete**: Click the delete button to remove the bot
- **View Details**: Click on a bot to see all entries and performance

### Via Firestore Console
1. Go to Firebase Console > Firestore Database
2. Navigate to `dcaBots` collection
3. Edit or delete bots directly

## Need Help?

If you encounter issues:
1. Check the Firebase console for errors
2. Review the script output for detailed error messages
3. Verify your `historical-bots.json` is valid JSON
4. Make sure timestamps are in ISO 8601 format

## Additional Resources

- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [DalyDCA Strategy Guide](../docs/dca-strategy.md)
- [Kraken API Documentation](https://docs.kraken.com/rest/)
