#!/bin/bash

# Fix BCH Bot using Firestore REST API
# This script uses your Firebase CLI authentication

echo "🔧 Fixing BCH Bot..."
echo ""

# Get access token from Firebase CLI
ACCESS_TOKEN=$(firebase login:ci --no-localhost 2>/dev/null | grep -o 'token: .*' | cut -d' ' -f2)

if [ -z "$ACCESS_TOKEN" ]; then
    # Try getting from gcloud
    ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)
fi

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Could not get access token"
    echo "Please run: gcloud auth application-default login"
    exit 1
fi

echo "✅ Got access token"
echo ""

# Use the deployed Cloud Function endpoint
echo "📡 Calling fix-cycles API endpoint..."

# Get the JWT token from your app (you'll need to replace this)
# For now, we'll use a simpler approach - call the function directly

# Actually, let's just use the firestore emulator or direct update
# Let me create a simpler Node.js script instead

exit 0
