# DCA Bot Database - Quick Start

## 🚀 5-Minute Setup

### 1. Get Firebase Key
```bash
# Download from Firebase Console > Project Settings > Service Accounts
# Save as: backend/functions/serviceAccountKey.json
```

### 2. Prepare Bot Data
```bash
# Copy template
cp scripts/historical-bots-template.json scripts/historical-bots.json

# Edit with your audit log data
code scripts/historical-bots.json  # or use nano/vim
```

### 3. Populate Database
```bash
npm run populate-bots
```

### 4. View in App
Open DalyDCA page → See your bots!

## 📋 Bot Entry Template

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
      "orderId": "KRAKEN-ORDER-ID",
      "status": "filled"
    }
  ]
}
```

## 🔑 Key Fields

| Field | What It Does | Example |
|-------|--------------|---------|
| `initialOrderAmount` | First entry size ($) | `10` |
| `tradeMultiplier` | Entry size growth | `2` → $10, $20, $40... |
| `stepPercent` | Price drop for re-entry | `1` → 1% drop |
| `tpTarget` | Take profit % | `3` → 3% gain |
| `status` | Bot state | `active`, `paused`, `completed` |

## 📊 Where to Get Data

1. **Open Audit Log** in your app
2. **Find trades** for each symbol
3. **Copy to JSON**:
   - Price → `price`
   - Volume → `quantity`
   - Cost → `orderAmount`
   - Time → `timestamp` (convert to ISO 8601)
   - Order ID → `orderId`

## ⚡ Commands

```bash
# Populate bots
npm run populate-bots

# View help
npm run populate-bots:help

# Or manually
npx ts-node scripts/populate-from-json.ts
```

## ❓ Troubleshooting

| Error | Fix |
|-------|-----|
| Service key not found | Download from Firebase Console |
| JSON file not found | Copy template: `cp scripts/historical-bots-template.json scripts/historical-bots.json` |
| Bots not showing | Hard refresh app (Cmd+Shift+R) |
| Invalid JSON | Check at jsonlint.com |

## 📚 Full Documentation

See [DCA_BOT_SETUP_GUIDE.md](./DCA_BOT_SETUP_GUIDE.md) for complete instructions.

See [scripts/README.md](./scripts/README.md) for detailed examples.

---

**Ready?** Let's populate your bots! 🎯
