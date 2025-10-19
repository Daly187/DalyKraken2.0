# Setup Guide for greggdaly187@gmail.com

This guide will walk you through setting up your DalyKraken 2.0 account and migrating any existing data.

## Quick Start

### Option 1: Automated Setup (Recommended)

**Using the setup script:**

```bash
# Make script executable
chmod +x backend/scripts/setup-gregg-user-simple.sh

# Run the setup
bash backend/scripts/setup-gregg-user-simple.sh
```

This will:
- Create your user account with username: `greggdaly`
- Set temporary password: `DalyKraken2024!`
- Link account to email: `greggdaly187@gmail.com`
- Provide next steps for TOTP setup

### Option 2: Manual Setup

**1. Start the backend server:**
```bash
cd backend/functions
npm run serve
```

**2. Create your account:**
```bash
curl -X POST http://localhost:5001/api/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "username": "greggdaly",
    "password": "DalyKraken2024!"
  }'
```

Expected response:
```json
{
  "success": true,
  "userId": "abc123...",
  "username": "greggdaly"
}
```

## First Login & TOTP Setup

**1. Start the frontend:**
```bash
cd frontend
npm run dev
```

**2. Navigate to login page:**
```
http://localhost:5173/login
```

**3. Enter credentials:**
- Username: `greggdaly`
- Password: `DalyKraken2024!`

**4. Set up Google Authenticator:**
- You'll be redirected to TOTP setup page
- Download Google Authenticator app (iOS/Android)
- Scan the QR code displayed on screen
- OR manually enter the secret key shown
- Enter the 6-digit code from the app
- Click "Complete Setup"

**5. You're logged in!**
- You'll be redirected to the dashboard
- Your session will remain active until you log out
- No auto-logout timer

## Adding Your Kraken API Keys

**Important:** Your API keys are stored in your browser's localStorage for security.

**1. Go to Settings page**
- Click Settings in the sidebar

**2. Add Kraken API Keys**
- Navigate to "API Keys" section
- Click "Add Kraken API Key"
- Enter your Kraken API Key
- Enter your Kraken API Secret
- Set as "Primary" key
- Click Save

**3. Test the connection**
- Click "Test Connection"
- Should show "Connected" status

**Where to get Kraken API keys:**
1. Log into your Kraken account
2. Go to Settings > API
3. Click "Generate New Key"
4. Set permissions:
   - Query Funds ✅
   - Query Open Orders & Trades ✅
   - Query Closed Orders & Trades ✅
   - (Others as needed for trading)
5. Copy both Key and Secret
6. **Save the Secret securely** (shown only once!)

## Migrating Existing Data

If you have existing bots or data from the old 'default-user' setup:

### Prerequisites

**1. Get Firebase Service Account Key:**
```bash
# Go to Firebase Console
# Project Settings > Service Accounts
# Click "Generate New Private Key"
# Save as: backend/service-account-key.json
```

**2. Run Migration Script:**
```bash
cd backend/scripts
node migrate-default-user.js
```

### What Gets Migrated

The migration will transfer:
- ✅ All DCA bots (from userId='default-user' to your account)
- ✅ Trade history
- ✅ Cost basis calculations
- ✅ Bot execution history

### After Migration

**1. Verify your data:**
- Login to the app
- Check Dashboard for your bots
- Verify Portfolio shows correct balance
- Check Trade History is accurate

**2. Add API Keys (if not done yet):**
- Go to Settings
- Add your Kraken API keys
- These are required for:
  - Fetching real-time balance
  - Syncing trade history
  - Bot trading operations

## Account Security

### Change Your Password

**Important:** Change from the temporary password!

1. Go to Settings
2. Click "Security" or "Change Password"
3. Enter current password: `DalyKraken2024!`
4. Enter new secure password
5. Save changes

### Backup Your TOTP Secret

During TOTP setup, you'll see a secret key like:
```
JBSWY3DPEHPK3PXP
```

**Save this in a secure location:**
- Password manager (1Password, Bitwarden, etc.)
- Encrypted notes
- Secure backup

**Why?** If you lose your phone, you can use this to set up Google Authenticator on a new device.

### Security Best Practices

- ✅ Use a strong, unique password
- ✅ Enable Google Authenticator 2FA (required)
- ✅ Keep TOTP secret backed up securely
- ✅ Don't share your JWT token
- ✅ Keep Kraken API keys secure
- ✅ Use API key permissions wisely
- ✅ Regularly review active bots

## Understanding Your Data

### What's Linked to Your Account

Everything is isolated to your user account:

**DCA Bots:**
- All bots you create
- Bot configurations
- Bot execution history
- Entry orders and trades

**Portfolio Data:**
- Fetched from YOUR Kraken API keys
- Shows YOUR account balance
- Calculates YOUR P&L
- Uses YOUR trade history

**Trade History:**
- Synced from YOUR Kraken account
- Stored in YOUR user collection
- Used for YOUR cost basis

**Cost Basis:**
- Calculated from YOUR trades
- Specific to YOUR holdings
- Updates when YOU sync trades

### Multi-User Isolation

If others use this app:
- ❌ They CANNOT see your bots
- ❌ They CANNOT see your portfolio
- ❌ They CANNOT access your data
- ✅ Everyone has completely separate data

## Troubleshooting

### "User already exists" Error

If you see this when creating the account:
```bash
# Check if account exists
# Login with: greggdaly / DalyKraken2024!
# If you forgot password, reset via Firestore
```

### Can't Login - Invalid Credentials

1. Double-check username: `greggdaly`
2. Double-check password: `DalyKraken2024!`
3. Make sure CAPS LOCK is off
4. Try resetting password via Firestore

### Can't Scan QR Code

If QR code won't scan:
1. Make sure you're using Google Authenticator app
2. Try manual entry instead
3. Copy the secret key shown below QR code
4. In Google Authenticator: Add > Enter setup key
5. Account name: DalyKraken (greggdaly)
6. Key: [paste the secret]
7. Time-based: Yes

### "Invalid TOTP token" Error

Common causes:
- Phone clock is out of sync
  - Enable automatic time sync on your phone
- Typing error in 6-digit code
  - Code changes every 30 seconds
- Using wrong account in Authenticator
  - Make sure you're using the DalyKraken entry

### No Bots Showing After Migration

Check:
1. Did migration script run successfully?
2. Are you logged in with correct account?
3. Check Firestore for userId in dcaBots collection
4. Run migration script again if needed

### API Keys Not Working

Verify:
1. Keys are entered correctly (no spaces)
2. Keys have correct permissions in Kraken
3. Keys are not expired
4. Test connection in Settings
5. Check browser console for errors

## Production Deployment

When deploying to production:

**1. Update Backend URL:**
```bash
# In frontend/src/config/env.ts
# Change from localhost to production URL
```

**2. Set JWT_SECRET:**
```bash
# In Firebase Functions config or .env
firebase functions:config:set jwt.secret="your-production-secret"
```

**3. Update CORS:**
```bash
# In backend/functions/src/index.ts
# Update allowed origins to production domain
```

**4. Enable HTTPS:**
- Required for JWT tokens
- Required for TOTP
- Use Firebase Hosting or similar

**5. Set up Firestore Security Rules:**
```javascript
// See MULTI_USER_ISOLATION.md for rules
```

## Support

If you run into issues:

1. **Check the logs:**
   - Backend: Terminal where `npm run serve` is running
   - Frontend: Browser Developer Console (F12)

2. **Review documentation:**
   - `AUTHENTICATION_SETUP.md` - Auth details
   - `MULTI_USER_ISOLATION.md` - Multi-user setup
   - `GREGG_SETUP_GUIDE.md` - This file

3. **Common fixes:**
   - Restart backend server
   - Clear browser cache
   - Re-login
   - Check Firestore data

## Quick Reference

### Your Account Details

- **Email:** greggdaly187@gmail.com
- **Username:** greggdaly
- **Temp Password:** DalyKraken2024! (change this!)
- **User ID:** (created during setup)

### Important URLs

- **Login:** http://localhost:5173/login
- **Dashboard:** http://localhost:5173/dashboard
- **Settings:** http://localhost:5173/settings

### Commands

```bash
# Start backend
cd backend/functions && npm run serve

# Start frontend
cd frontend && npm run dev

# Create account
bash backend/scripts/setup-gregg-user-simple.sh

# Migrate data
node backend/scripts/migrate-default-user.js

# Build backend
cd backend/functions && npm run build

# Build frontend
cd frontend && npm run build
```

---

**You're all set!** 🎉

Your DalyKraken 2.0 account is ready to use with complete multi-user isolation and secure 2FA authentication.
