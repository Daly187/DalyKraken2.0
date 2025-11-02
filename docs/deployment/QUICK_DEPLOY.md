# Quick Deploy Guide

## TL;DR - Get Running in 5 Minutes

### Prerequisites
- Firebase account
- Kraken API credentials
- Node.js 20+

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
./setup-firebase.sh
```

This will:
1. Install Firebase CLI
2. Login to Firebase
3. Install all dependencies
4. Build frontend and backend
5. Configure Kraken credentials
6. Deploy to Firebase

### Option 2: Manual Setup

```bash
# 1. Login
firebase login

# 2. Select project
firebase use --add

# 3. Install dependencies
npm install
cd frontend && npm install && cd ..
cd backend/functions && npm install && cd ../..

# 4. Build
cd frontend && npm run build && cd ..
cd backend/functions && npm run build && cd ../..

# 5. Configure Kraken (optional for testing)
firebase functions:config:set \
  kraken.api_key="YOUR_KEY" \
  kraken.api_secret="YOUR_SECRET"

# 6. Deploy
firebase deploy
```

### Testing Locally First

```bash
# Start Firebase emulators
firebase emulators:start

# Access:
# - Frontend: http://localhost:5000
# - Functions API: http://localhost:5001
# - Firestore UI: http://localhost:4000
```

## What Gets Deployed

### Frontend (Firebase Hosting)
- React app built with Vite
- Served from `frontend/dist/`
- Available at `https://your-project.web.app`

### Backend (Firebase Functions)
- **HTTP Endpoints:**
  - `GET /health` - Health check
  - `GET /dca-bots` - List all DCA bots
  - `POST /dca-bots` - Create new bot
  - `GET /dca-bots/:id` - Get bot details
  - `PUT /dca-bots/:id` - Update bot
  - `DELETE /dca-bots/:id` - Delete bot
  - `POST /dca-bots/:id/pause` - Pause bot
  - `POST /dca-bots/:id/resume` - Resume bot
  - `GET /dca-bots/:id/executions` - Get execution history

- **Scheduled Functions:**
  - `processDCABots` - Every 5 minutes
  - `updateMarketData` - Every 1 minute

- **Firestore Triggers:**
  - Bot created/deleted audit logging

### Database (Firestore)
- **Collections:**
  - `dcaBots` - Bot configurations
  - `dcaBots/{id}/entries` - Trade entries
  - `botExecutions` - Execution logs
  - `marketData` - Price cache
  - `auditLog` - Audit trail
  - `systemLogs` - System logs

## Verify Deployment

```bash
# Check hosting
firebase hosting:channel:list

# Check functions
firebase functions:list

# View logs
firebase functions:log

# Test API
curl https://your-project.web.app/api/health
```

## Next Steps

1. **Create your first bot:**
   - Visit `https://your-project.web.app`
   - Navigate to DalyDCA page
   - Fill out bot creation form
   - Click "Create Bot"

2. **Monitor bot execution:**
   - Check Firestore Console for `botExecutions` collection
   - View function logs: `firebase functions:log`
   - Monitor in Firebase Console

3. **Configure production settings:**
   - Set up custom domain (optional)
   - Configure per-user Kraken credentials
   - Enable Firebase Auth
   - Set up email notifications

## Cost Estimate

With Firebase Free Tier:
- **Hosting:** FREE (10GB storage, 360MB/day)
- **Functions:** FREE up to 2M invocations/month
- **Firestore:** FREE up to 50K reads, 20K writes/day

For 10 active bots:
- ~100K Firestore operations/month ✅ FREE
- ~50K function invocations/month ✅ FREE
- Well within free limits!

## Troubleshooting

### Build Error
```bash
cd frontend && rm -rf node_modules dist && npm install && npm run build
```

### Deploy Error
```bash
# Check billing enabled in Firebase Console
# Upgrade to Blaze plan (required for Functions)
```

### CORS Error
```typescript
// In backend/functions/src/index.ts
app.use(cors({ origin: true }));
```

### Functions Not Running
```bash
# Check logs
firebase functions:log --only processDCABots

# Manually trigger
curl -X POST https://your-region-your-project.cloudfunctions.net/triggerBotProcessing \
  -H "Authorization: Bearer test-token"
```

## Important Commands

```bash
# Deploy everything
firebase deploy

# Deploy specific parts
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules

# Test locally
firebase emulators:start

# View logs
firebase functions:log
firebase functions:log --only processDCABots

# Config management
firebase functions:config:get
firebase functions:config:set key=value
```

## Firebase Console Links

- **Project Overview:** https://console.firebase.google.com/project/YOUR_PROJECT
- **Hosting:** https://console.firebase.google.com/project/YOUR_PROJECT/hosting
- **Functions:** https://console.firebase.google.com/project/YOUR_PROJECT/functions
- **Firestore:** https://console.firebase.google.com/project/YOUR_PROJECT/firestore
- **Logs:** https://console.firebase.google.com/project/YOUR_PROJECT/logs

## Need Help?

See the full deployment guide: [FIREBASE_DEPLOYMENT.md](./FIREBASE_DEPLOYMENT.md)
