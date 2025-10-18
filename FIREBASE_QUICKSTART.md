# Firebase Quick Start - DalyKraken 2.0

## 5-Minute Setup

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Create Firebase Project
Go to https://console.firebase.google.com and create a new project named `dalykraken-2` (or your preferred name).

### 4. Update Project ID
Edit `.firebaserc` and replace `dalykraken-2` with your actual Firebase project ID.

### 5. Enable Billing
In Firebase Console, upgrade to the **Blaze (pay-as-you-go)** plan to use Cloud Functions.

### 6. Deploy Frontend Only (Fastest)
```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Build and deploy
npm run build:frontend
firebase deploy --only hosting
```

Your app will be live at: `https://your-project-id.web.app`

---

## Full Deployment (Frontend + Backend)

### 1. Install Functions Dependencies
```bash
cd backend/functions
npm install
cd ../..
```

### 2. Set Environment Variables
```bash
firebase functions:config:set \
  kraken.api_key="YOUR_KRAKEN_API_KEY" \
  kraken.api_secret="YOUR_KRAKEN_API_SECRET"
```

### 3. Deploy Everything
```bash
npm run firebase:deploy
```

---

## Local Testing

### Test with Firebase Emulators
```bash
npm run firebase:emulators
```

Open http://localhost:4000 for the Firebase Emulator UI.

### Test Frontend Development
```bash
npm run dev:frontend
```

Open http://localhost:3000

---

## Common Commands

| Task | Command |
|------|---------|
| Deploy all | `npm run firebase:deploy` |
| Deploy frontend only | `npm run firebase:deploy:hosting` |
| Deploy backend only | `npm run firebase:deploy:functions` |
| View logs | `npm run firebase:logs` |
| Local testing | `npm run firebase:emulators` |

---

## Important Notes

1. **WebSocket Support**: Firebase Functions have limited WebSocket support. For full real-time features, consider deploying the backend to Cloud Run or a VPS.

2. **Project ID**: Make sure to update `.firebaserc` with your actual Firebase project ID.

3. **API Keys**: Store sensitive keys using Firebase config, NOT in environment files:
   ```bash
   firebase functions:config:set key.name="value"
   ```

4. **Billing**: Functions require the Blaze (pay-as-you-go) plan, but it includes a generous free tier.

---

## Troubleshooting

**Error: "Billing account not configured"**
→ Upgrade to Blaze plan in Firebase Console

**Error: "Permission denied"**
→ Run `firebase login` and ensure you have Owner/Editor role

**Build errors**
→ Clear caches: `rm -rf frontend/node_modules frontend/dist && npm install`

**CORS errors**
→ Check CORS configuration in `backend/functions/src/index.ts`

---

For detailed documentation, see [FIREBASE_DEPLOYMENT.md](FIREBASE_DEPLOYMENT.md)
