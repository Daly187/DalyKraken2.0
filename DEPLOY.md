# DalyKraken Deployment Guide

This guide covers deploying DalyKraken to Firebase.

## One-Time Setup

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Verify Project Access

```bash
firebase projects:list
```

You should see `dalydough` in the list.

### 4. Install Dependencies

```bash
npm install
cd frontend && npm install && cd ..
cd backend/functions && npm install && cd ../..
```

## Deploy to Preview (Safe Testing)

Preview channels create temporary URLs that expire after 7 days. Use this to test before going live.

```bash
npm run deploy:preview
```

This builds the frontend and deploys to a preview channel. It does NOT deploy functions.

## Deploy to Live

### Option A: Shell Script (Recommended)

The shell script includes all guardrails and is the safest way to deploy:

```bash
./scripts/deploy-live.sh
```

This will:
1. Verify Firebase CLI is installed
2. Verify you're logged in
3. Block if not on `main` branch
4. Block if there are uncommitted changes
5. Show a summary of what will be deployed
6. Require you to type `DEPLOY` to confirm
7. Build and deploy Hosting + Functions + Firestore rules

### Option B: npm Scripts

If you need more control, use individual npm scripts:

```bash
# Deploy everything (hosting + functions + rules)
npm run deploy:live

# Deploy only hosting
npm run deploy:hosting:live

# Deploy only functions
npm run deploy:functions:live
```

**Note:** npm scripts do NOT include branch/uncommitted guardrails.

## What Gets Deployed

| Component | Source | Target |
|-----------|--------|--------|
| Frontend | `frontend/dist` | Firebase Hosting |
| Functions | `backend/functions` | Cloud Functions (us-central1) |
| Firestore Rules | `firestore.rules` | Firestore Security |

## URLs After Deployment

- **Live Site:** https://dalydough.web.app
- **Firebase Console:** https://console.firebase.google.com/project/dalydough/overview

## Troubleshooting

### "Firebase CLI is not installed"

```bash
npm install -g firebase-tools
```

### "You are not logged into Firebase"

```bash
firebase login
```

### "Permission denied" when deploying

1. Check you have access to the project:
   ```bash
   firebase projects:list
   ```
2. If `dalydough` is not listed, ask the project owner to add you.

### "You must be on main branch"

The deploy script blocks deployment from feature branches:

```bash
git checkout main
git pull origin main
```

### "Uncommitted changes" error

Commit or stash your changes:

```bash
# Option 1: Commit
git add .
git commit -m "Your message"

# Option 2: Stash
git stash
# ... deploy ...
git stash pop
```

### Build fails

1. Check frontend builds locally:
   ```bash
   cd frontend && npm run build
   ```
2. Check functions build:
   ```bash
   cd backend/functions && npm run build
   ```

### "Functions deploy failed"

1. Check function logs:
   ```bash
   firebase functions:log
   ```
2. Ensure Node.js 20 is installed (required by functions runtime)

## Project Aliases

The `.firebaserc` file defines project aliases:

```json
{
  "projects": {
    "default": "dalydough",
    "live": "dalydough"
  }
}
```

To add a staging environment in the future, create a new Firebase project and add it here.

## Future Improvements

- Add GitHub Actions workflow for automatic deploys on push to `main`
- Add staging environment with separate Firebase project
- Add Slack/Discord notifications on deploy success/failure
