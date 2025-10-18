# 🚀 Complete Setup Instructions - Do This Now!

## Step 1: Get Firebase Service Account Key

### Option A: Using Firebase CLI (Recommended)
```bash
# Login to Firebase
firebase login

# Get your project info
firebase projects:list

# The key needs to be downloaded manually from the console
```

### Option B: Using Firebase Console (Easier)
1. Open this link: https://console.firebase.google.com/project/dalydough/settings/serviceaccounts/adminsdk
2. Click **"Generate New Private Key"**
3. Click **"Generate Key"** in the confirmation dialog
4. The JSON file will download automatically
5. **IMPORTANT:** Rename it to `serviceAccountKey.json`
6. Move it to: `/Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/`

### Quick Terminal Commands:
```bash
# After downloading the key, run these commands:
cd ~/Downloads
# Find the downloaded key (it will have a name like 'dalydough-firebase-adminsdk-xxxxx.json')
ls -lt | grep dalydough | head -1

# Copy it to the correct location and rename it
cp dalydough-firebase-adminsdk-*.json /Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/serviceAccountKey.json

# Verify it's there
ls -la /Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/serviceAccountKey.json
```

---

## Step 2: Get Your Trade Data from Audit Log

You have two options:

### Option A: Use the Web App (Easier)
1. Start your app if not running:
   ```bash
   cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
   npm run dev:frontend
   ```
2. Open the Audit Log page in your browser
3. Copy the trade data manually to the JSON file

### Option B: I'll help you create a data extraction script

Let me know if you want me to create a script to automatically extract your trade data!

---

## Step 3: Edit the JSON File with Your Data

Open the file in your editor:
```bash
code /Users/Daly/Desktop/DalyDough/DalyKraken2.0/scripts/historical-bots.json
```

Or use nano:
```bash
nano /Users/Daly/Desktop/DalyDough/DalyKraken2.0/scripts/historical-bots.json
```

### What to Change:

1. **For each bot**, update:
   - `symbol`: Your trading pair (e.g., "BTC/USD", "ETH/USD")
   - `status`:
     - `"active"` if you're still trading this
     - `"completed"` if you've exited
     - `"paused"` if temporarily stopped

2. **For each entry in `entries` array**, update:
   - `orderAmount`: How much USD you spent
   - `price`: The price you bought at
   - `quantity`: Amount of crypto (orderAmount / price)
   - `timestamp`: When you made the trade (ISO format: "2025-01-15T10:30:00.000Z")
   - `orderId`: Your Kraken order ID (from audit log)

3. **Remove the example bots** if you don't need them

4. **Add more bots** by copying the structure

---

## Step 4: Run the Population Script

Once you have:
- ✅ Firebase service account key in place
- ✅ Your historical-bots.json file edited with real data

Run this:
```bash
cd /Users/Daly/Desktop/DalyDough/DalyKraken2.0
npm run populate-bots
```

---

## Step 5: Verify in Your App

1. Open your DalyDCA page
2. You should see your bots in the table!
3. Each bot will show:
   - Total invested
   - Unrealized P&L
   - Number of entries
   - Next entry price
   - Take profit target

---

## 🆘 Need Help?

### Error: "Service account key not found"
- Make sure you downloaded the key from Firebase Console
- Verify it's named exactly: `serviceAccountKey.json`
- Check it's in: `backend/functions/serviceAccountKey.json`

### Error: "historical-bots.json not found"
```bash
cp scripts/historical-bots-template.json scripts/historical-bots.json
```

### Bots not showing in app?
1. Hard refresh the page (Cmd+Shift+R)
2. Check the console for errors
3. Verify the script output showed success

---

## 📞 Where Are You Now?

**Current Status:**
- ✅ Template file created: `scripts/historical-bots.json`
- ⏳ Waiting for: Firebase service account key
- ⏳ Waiting for: Your trade data to be added to the JSON

**Next Action:**
1. Download Firebase key using the link above
2. Let me know when it's ready, and I can help with the next steps!

---

## 🎯 Quick Commands Reference

```bash
# Check if key exists
ls -la backend/functions/serviceAccountKey.json

# Edit bots data
code scripts/historical-bots.json

# Run population
npm run populate-bots

# View full guide
cat scripts/README.md
```
