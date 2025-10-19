# 🚀 Quick Start for Gregg Daly

Follow these steps to get your DalyKraken 2.0 account set up in minutes!

## Step 1: Create Your Account

Run the automated setup script:

```bash
bash backend/scripts/setup-gregg-user-simple.sh
```

This creates your account with:
- **Email:** greggdaly187@gmail.com
- **Username:** greggdaly
- **Password:** DalyKraken2024! (temporary - change this!)

## Step 2: First Login

1. **Start the backend** (if not already running):
   ```bash
   cd backend/functions
   npm run serve
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Open your browser:**
   ```
   http://localhost:5173/login
   ```

4. **Login:**
   - Username: `greggdaly`
   - Password: `DalyKraken2024!`

## Step 3: Set Up Google Authenticator

1. **Download Google Authenticator** on your phone (if you don't have it)

2. **Scan the QR code** shown on screen

3. **Enter the 6-digit code** from the app

4. **Click "Complete Setup"**

5. **IMPORTANT:** Save the secret key shown (backup in case you lose your phone!)

## Step 4: Add Your Kraken API Keys

1. **Go to Settings page** in the app

2. **Click "Add Kraken API Key"**

3. **Enter your Kraken credentials:**
   - Get these from: https://www.kraken.com/u/security/api
   - Make sure permissions include: Query Funds, Query Trades

4. **Save and test the connection**

## Step 5: Migrate Existing Data (If Needed)

If you have existing bots from the old system:

1. **Get Firebase service account key:**
   - Firebase Console → Project Settings → Service Accounts
   - Generate New Private Key
   - Save as `backend/service-account-key.json`

2. **Run migration:**
   ```bash
   cd backend/scripts
   node migrate-default-user.js
   ```

3. **Verify in the app:**
   - Check Dashboard for your bots
   - Verify Portfolio data
   - Confirm trade history

## ✅ You're Done!

Your account is now set up and ready to use with:
- ✅ Secure 2FA authentication
- ✅ All your bots linked to your account
- ✅ Multi-user isolation (your data is private)
- ✅ Persistent sessions (no auto-logout)

## Next Steps

- **Change your password** in Settings
- **Create new DCA bots** from the DCA page
- **Monitor your portfolio** from the Dashboard
- **Review existing bots** and adjust settings as needed

## Need Help?

See the full guides:
- **[GREGG_SETUP_GUIDE.md](GREGG_SETUP_GUIDE.md)** - Complete setup instructions
- **[AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md)** - Authentication details
- **[MULTI_USER_ISOLATION.md](MULTI_USER_ISOLATION.md)** - How user isolation works

---

**Happy Trading! 📈**
