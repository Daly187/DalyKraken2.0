#!/bin/bash
#
# deploy-live.sh - Deploy DalyKraken to Firebase (LIVE)
#
# This script deploys both Hosting and Functions to the live Firebase project.
# It includes guardrails to prevent accidental deployments of broken code.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the repo root (parent of scripts/)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   DalyKraken Deploy to LIVE${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# --------------------------------------------------
# GUARDRAIL 1: Check Firebase CLI is installed
# --------------------------------------------------
echo -e "${YELLOW}[1/6]${NC} Checking Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}ERROR: Firebase CLI is not installed.${NC}"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi
FIREBASE_VERSION=$(firebase --version)
echo -e "${GREEN}OK${NC} - Firebase CLI version: $FIREBASE_VERSION"

# --------------------------------------------------
# GUARDRAIL 2: Check Firebase login status
# --------------------------------------------------
echo -e "${YELLOW}[2/6]${NC} Checking Firebase login status..."
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}ERROR: You are not logged into Firebase.${NC}"
    echo "Run: firebase login"
    exit 1
fi
echo -e "${GREEN}OK${NC} - Logged into Firebase"

# --------------------------------------------------
# GUARDRAIL 3: Check we're on main branch
# --------------------------------------------------
echo -e "${YELLOW}[3/6]${NC} Checking git branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo -e "${RED}ERROR: You must be on 'main' or 'master' branch to deploy to live.${NC}"
    echo "Current branch: $CURRENT_BRANCH"
    echo ""
    echo "Switch to main with: git checkout main"
    exit 1
fi
echo -e "${GREEN}OK${NC} - On branch: $CURRENT_BRANCH"

# --------------------------------------------------
# GUARDRAIL 4: Check for uncommitted changes
# --------------------------------------------------
echo -e "${YELLOW}[4/6]${NC} Checking for uncommitted changes..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}ERROR: You have uncommitted changes.${NC}"
    echo ""
    echo "Uncommitted files:"
    git status --short
    echo ""
    echo "Commit or stash your changes before deploying."
    exit 1
fi
echo -e "${GREEN}OK${NC} - Working tree is clean"

# --------------------------------------------------
# GUARDRAIL 5: Verify project alias exists
# --------------------------------------------------
echo -e "${YELLOW}[5/6]${NC} Checking Firebase project alias..."
if ! grep -q '"live"' .firebaserc; then
    echo -e "${RED}ERROR: No 'live' alias found in .firebaserc${NC}"
    echo "Add it manually or run: firebase use --add"
    exit 1
fi
echo -e "${GREEN}OK${NC} - 'live' alias exists in .firebaserc"

# --------------------------------------------------
# Show deployment summary
# --------------------------------------------------
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Deployment Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Project:     dalydough (live)"
echo "Branch:      $CURRENT_BRANCH"
echo "Deploying:   Hosting + Functions + Firestore Rules"
echo ""
echo "This will deploy:"
echo "  - Frontend (frontend/dist)"
echo "  - Cloud Functions (backend/functions)"
echo "  - Firestore security rules"
echo ""

# --------------------------------------------------
# GUARDRAIL 6: Require confirmation
# --------------------------------------------------
echo -e "${YELLOW}To proceed, type DEPLOY and press Enter:${NC}"
read -r CONFIRM
if [ "$CONFIRM" != "DEPLOY" ]; then
    echo -e "${RED}Deployment cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Starting deployment...${NC}"
echo ""

# --------------------------------------------------
# Step 1: Select the live project
# --------------------------------------------------
echo -e "${YELLOW}[Step 1/4]${NC} Selecting Firebase project..."
firebase use live
echo ""

# --------------------------------------------------
# Step 2: Build frontend
# --------------------------------------------------
echo -e "${YELLOW}[Step 2/4]${NC} Building frontend..."
cd frontend
npm run build
cd "$REPO_ROOT"
echo ""

# --------------------------------------------------
# Step 3: Deploy everything
# --------------------------------------------------
echo -e "${YELLOW}[Step 3/4]${NC} Deploying to Firebase..."
firebase deploy
echo ""

# --------------------------------------------------
# Step 4: Show result
# --------------------------------------------------
echo -e "${YELLOW}[Step 4/4]${NC} Deployment complete!"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Hosting URL: https://dalydough.web.app"
echo ""
echo "View in Firebase Console:"
echo "https://console.firebase.google.com/project/dalydough/overview"
echo ""
