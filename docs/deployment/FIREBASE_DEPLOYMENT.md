# Firebase Deployment Guide - DalyKraken 2.0

This guide covers deploying DalyKraken 2.0 to Firebase Console.

## Prerequisites

1. **Firebase Account**: Create a Firebase account at https://console.firebase.google.com
2. **Firebase CLI**: Install Firebase tools globally
   ```bash
   npm install -g firebase-tools
   ```
3. **Node.js**: Version 20 or higher required

## Initial Setup

### 1. Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

### 2. Create Firebase Project

You have two options:

**Option A: Create via Firebase Console (Recommended)**
1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter project name: `dalykraken-2` (or your preferred name)
4. Follow the setup wizard
5. Enable Google Analytics (optional)

**Option B: Create via CLI**
```bash
firebase projects:create dalykraken-2
```

### 3. Initialize Firebase in Your Project

The project is already configured with:
- `firebase.json` - Firebase configuration
- `.firebaserc` - Project aliases

Update the project ID in `.firebaserc` if you used a different name:
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 4. Enable Firebase Services

In the Firebase Console, enable these services:

1. **Firebase Hosting**
   - Go to Hosting section
   - Click "Get Started"

2. **Cloud Functions**
   - Go to Functions section
   - Click "Get Started"
   - Upgrade to Blaze (pay-as-you-go) plan (required for Functions)

3. **Firestore Database** (Optional - for data persistence)
   - Go to Firestore Database
   - Click "Create database"
   - Choose production mode
   - Select your region

4. **Firebase Storage** (Optional - for snapshot storage)
   - Go to Storage
   - Click "Get Started"

## Project Structure for Firebase

```
DalyKraken2.0/
├── firebase.json           # Firebase configuration
├── .firebaserc             # Firebase project settings
├── frontend/
│   ├── dist/              # Built frontend (deployment source)
│   └── ...
└── backend/
    ├── functions/         # Firebase Functions (new)
    │   ├── src/
    │   │   └── index.ts   # Functions entry point
    │   ├── package.json
    │   └── tsconfig.json
    └── services/          # Original backend (legacy)
        ├── main/
        ├── snapshot/
        └── cache/
```

## Deployment Options

### Option 1: Frontend Only (Static Hosting)

If you only want to deploy the frontend:

```bash
# Build frontend
npm run build:frontend

# Deploy to Firebase Hosting
npm run firebase:deploy:hosting
```

**Or using Firebase CLI directly:**
```bash
firebase deploy --only hosting
```

Your app will be available at: `https://your-project-id.web.app`

### Option 2: Frontend + Backend Functions

For full deployment with backend API:

#### Step 1: Configure Environment Variables

Set Firebase environment variables for your Kraken API keys:

```bash
firebase functions:config:set \
  kraken.api_key="YOUR_KRAKEN_API_KEY" \
  kraken.api_secret="YOUR_KRAKEN_API_SECRET" \
  quantify.api_key="YOUR_QUANTIFY_API_KEY" \
  coinmarketcap.api_key="YOUR_COINMARKETCAP_API_KEY" \
  telegram.bot_token="YOUR_TELEGRAM_BOT_TOKEN" \
  telegram.chat_id="YOUR_TELEGRAM_CHAT_ID"
```

**View current config:**
```bash
firebase functions:config:get
```

#### Step 2: Install Functions Dependencies

```bash
cd backend/functions
npm install
cd ../..
```

#### Step 3: Build and Deploy

```bash
# Deploy everything (frontend + functions)
npm run firebase:deploy

# Or deploy separately
npm run firebase:deploy:hosting    # Frontend only
npm run firebase:deploy:functions  # Backend only
```

### Option 3: Hybrid Deployment (Recommended for Full Features)

**Firebase Limitations**: Firebase Functions have limitations with WebSocket connections. For full real-time features:

**Recommended Architecture:**
- **Frontend**: Deploy to Firebase Hosting
- **Backend**: Deploy to Cloud Run, App Engine, or VPS

**Cloud Run Deployment** (supports WebSocket):
```bash
# Build Docker image (requires Dockerfile - see ARCHITECTURE.md)
gcloud builds submit --tag gcr.io/your-project-id/dalykraken-backend

# Deploy to Cloud Run
gcloud run deploy dalykraken-backend \
  --image gcr.io/your-project-id/dalykraken-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars KRAKEN_API_KEY=xxx,KRAKEN_API_SECRET=xxx

# Update frontend API endpoint
# In frontend/src/services/apiService.ts, update the base URL
```

## Environment Configuration

### Frontend Environment Variables

Create `frontend/.env.production`:
```env
VITE_API_URL=https://your-project-id.web.app/api
VITE_WS_URL=wss://your-cloud-run-url
```

### Backend Environment Variables

For Firebase Functions, use Firebase config (shown in Step 1 above).

For Cloud Run/VPS deployment, use environment variables as documented in the original `.env.example` files.

## Testing Locally

### Test with Firebase Emulators

```bash
# Start all emulators
npm run firebase:emulators

# This starts:
# - Hosting: http://localhost:5000
# - Functions: http://localhost:5001
# - Firestore: http://localhost:8080
# - Emulator UI: http://localhost:4000
```

### Test Frontend Only

```bash
npm run dev:frontend
# Runs on http://localhost:3000
```

## Deployment Commands Reference

| Command | Description |
|---------|-------------|
| `npm run firebase:deploy` | Deploy frontend + functions |
| `npm run firebase:deploy:hosting` | Deploy frontend only |
| `npm run firebase:deploy:functions` | Deploy backend functions only |
| `npm run firebase:emulators` | Run local emulators |
| `npm run firebase:logs` | View function logs |

## Post-Deployment Steps

### 1. Verify Deployment

```bash
# Check hosting URL
firebase hosting:channel:list

# Check functions
firebase functions:list

# View logs
firebase functions:log
```

### 2. Set Up Custom Domain (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Enter your domain
4. Follow DNS setup instructions

### 3. Configure CORS

If you encounter CORS issues, update the CORS configuration in:
- `backend/functions/src/index.ts` (for Firebase Functions)
- Or your Cloud Run/VPS backend

### 4. Monitor Usage

Firebase Console → Usage and Billing:
- Monitor function invocations
- Check hosting bandwidth
- Set up budget alerts

## Important Notes

### Firebase Functions Limitations

1. **Execution Time**: Max 9 minutes per invocation
2. **Memory**: Default 256MB, max 8GB
3. **WebSocket**: Limited support (use Cloud Run for full WebSocket)
4. **Cold Starts**: Functions may have cold start delays
5. **Concurrent Executions**: Default 1000 concurrent instances

### Cost Considerations

**Blaze Plan Pricing** (pay-as-you-go):
- Hosting: 10GB storage, 360MB/day free
- Functions: 2M invocations/month free
- Firestore: 50K reads, 20K writes/day free
- Cloud Storage: 5GB storage, 1GB download/day free

**Monitor costs at**: Firebase Console → Usage and Billing

### Security Best Practices

1. **Never commit API keys** - Use Firebase config or environment variables
2. **Enable Security Rules** - Set up Firestore/Storage security rules
3. **Use HTTPS only** - Firebase enforces HTTPS by default
4. **Implement authentication** - Use Firebase Auth for user management
5. **Rate limiting** - Implement rate limiting in functions

## Troubleshooting

### Build Fails

```bash
# Clear caches
cd frontend && rm -rf node_modules dist
npm install
npm run build
```

### Functions Deploy Fails

```bash
# Check logs
firebase functions:log

# Validate function code
cd backend/functions
npm run lint
npm run build
```

### "Insufficient permissions" Error

```bash
# Ensure billing is enabled
# Upgrade to Blaze plan in Firebase Console
```

### CORS Errors

Update CORS in `backend/functions/src/index.ts`:
```typescript
app.use(cors({
  origin: ['https://your-domain.com', 'https://your-project-id.web.app'],
  credentials: true
}));
```

## Migration from Existing Backend

To migrate from the current `backend/services/*` structure:

1. **Copy routes and services** to `backend/functions/src/`
2. **Update imports** for Firebase Functions environment
3. **Replace node-cron** with Cloud Scheduler
4. **Replace in-memory storage** with Firestore
5. **Test thoroughly** with emulators

## Continuous Deployment

### GitHub Actions (Recommended)

Create `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          npm install
          cd frontend && npm install
          cd ../backend/functions && npm install

      - name: Build frontend
        run: npm run build:frontend

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: your-project-id
```

## Support Resources

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firebase Console**: https://console.firebase.google.com
- **Firebase CLI Reference**: https://firebase.google.com/docs/cli
- **Cloud Functions Docs**: https://firebase.google.com/docs/functions
- **Firebase Status**: https://status.firebase.google.com

## Quick Start Commands

```bash
# First time setup
firebase login
firebase init  # If needed
npm install

# Deploy frontend only
npm run build:frontend
npm run firebase:deploy:hosting

# Deploy everything
npm run firebase:deploy

# Test locally
npm run firebase:emulators

# View logs
npm run firebase:logs
```

---

**Need Help?** Check the Firebase Console logs or run `firebase functions:log` for detailed error messages.
