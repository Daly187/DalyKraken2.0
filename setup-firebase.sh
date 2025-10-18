#!/bin/bash

# DalyKraken 2.0 - Firebase Setup Script
# This script helps you set up and deploy DalyKraken 2.0 to Firebase

set -e

echo "======================================"
echo "DalyKraken 2.0 - Firebase Setup"
echo "======================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found"
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLI installed"
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20 or higher required"
    echo "   Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version $(node -v)"

# Login to Firebase
echo ""
echo "🔐 Logging into Firebase..."
firebase login

# Check if .firebaserc exists
if [ ! -f ".firebaserc" ]; then
    echo ""
    echo "📋 Select Firebase project:"
    firebase use --add
else
    echo "✅ Firebase project configured"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."

echo "  → Frontend dependencies..."
cd frontend
npm install
cd ..

echo "  → Backend Functions dependencies..."
cd backend/functions
npm install
cd ../..

# Build the project
echo ""
echo "🔨 Building project..."

echo "  → Building frontend..."
cd frontend
npm run build
cd ..

echo "  → Building backend functions..."
cd backend/functions
npm run build
cd ../..

# Configure environment
echo ""
echo "⚙️  Configure Kraken API credentials"
read -p "Do you want to set Kraken API credentials now? (y/n): " configure_kraken

if [ "$configure_kraken" = "y" ]; then
    echo ""
    read -p "Enter Kraken API Key: " kraken_key
    read -sp "Enter Kraken API Secret: " kraken_secret
    echo ""

    firebase functions:config:set \
        kraken.api_key="$kraken_key" \
        kraken.api_secret="$kraken_secret"

    echo "✅ Kraken credentials configured"
fi

# Deploy
echo ""
echo "🚀 Ready to deploy!"
echo ""
echo "Deployment options:"
echo "  1) Deploy everything (Hosting + Functions)"
echo "  2) Deploy Hosting only (Frontend)"
echo "  3) Deploy Functions only (Backend)"
echo "  4) Deploy Firestore rules and indexes"
echo "  5) Test with Firebase Emulators"
echo "  6) Skip deployment"
echo ""
read -p "Select option (1-6): " deploy_option

case $deploy_option in
    1)
        echo "🚀 Deploying everything..."
        firebase deploy
        ;;
    2)
        echo "🚀 Deploying Hosting..."
        firebase deploy --only hosting
        ;;
    3)
        echo "🚀 Deploying Functions..."
        firebase deploy --only functions
        ;;
    4)
        echo "🚀 Deploying Firestore rules and indexes..."
        firebase deploy --only firestore:rules,firestore:indexes
        ;;
    5)
        echo "🧪 Starting Firebase Emulators..."
        firebase emulators:start
        ;;
    6)
        echo "⏭️  Skipping deployment"
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. View your app:"
echo "   https://$(firebase projects:list | grep -o 'your-project-id').web.app"
echo ""
echo "2. Monitor functions:"
echo "   firebase functions:log"
echo ""
echo "3. View Firebase Console:"
echo "   https://console.firebase.google.com"
echo ""
echo "4. Test locally with emulators:"
echo "   firebase emulators:start"
echo ""
echo "For more information, see FIREBASE_DEPLOYMENT.md"
echo ""
