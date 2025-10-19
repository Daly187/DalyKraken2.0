#!/bin/bash

###############################################################################
# Setup Script for greggdaly187@gmail.com
#
# This script creates a user account and provides instructions for migration
###############################################################################

echo "🚀 DalyKraken 2.0 - User Setup for Gregg Daly"
echo "=============================================="
echo ""

# Configuration
BACKEND_URL="http://localhost:5001/api"
USERNAME="greggdaly"
EMAIL="greggdaly187@gmail.com"
TEMP_PASSWORD="DalyKraken2024!"

echo "📋 Account Configuration:"
echo "   Email: $EMAIL"
echo "   Username: $USERNAME"
echo "   Temporary Password: $TEMP_PASSWORD"
echo ""

# Create user account
echo "📝 Creating user account..."
echo ""

RESPONSE=$(curl -s -X POST "${BACKEND_URL}/auth/create-user" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$TEMP_PASSWORD\"}")

echo "Response: $RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q "success.*true"; then
  echo "✅ User account created successfully!"
  echo ""

  # Extract userId if available
  USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)

  if [ ! -z "$USER_ID" ]; then
    echo "   User ID: $USER_ID"
    echo ""
  fi

  echo "🔐 Next Steps:"
  echo ""
  echo "1️⃣  FIRST LOGIN & TOTP SETUP:"
  echo "   - Go to: http://localhost:5173/login"
  echo "   - Enter username: $USERNAME"
  echo "   - Enter password: $TEMP_PASSWORD"
  echo "   - Scan QR code with Google Authenticator"
  echo "   - Complete TOTP setup"
  echo ""

  echo "2️⃣  ADD KRAKEN API KEYS:"
  echo "   - Go to Settings page"
  echo "   - Add your Kraken API keys"
  echo "   - These keys will be stored in your browser"
  echo ""

  echo "3️⃣  MIGRATE EXISTING DATA (if needed):"
  echo "   - Run: node backend/scripts/migrate-default-user.js"
  echo "   - This will move all 'default-user' bots to your account"
  echo ""

  echo "4️⃣  CHANGE YOUR PASSWORD:"
  echo "   - Go to Settings > Security"
  echo "   - Change from temporary password to your own secure password"
  echo ""

  echo "⚠️  SECURITY REMINDERS:"
  echo "   - Keep your TOTP secret key safe (backup in password manager)"
  echo "   - Change the temporary password immediately"
  echo "   - Your Kraken API keys are stored in browser localStorage"
  echo "   - Enable all security features for production use"
  echo ""

elif echo "$RESPONSE" | grep -q "already exists"; then
  echo "ℹ️  User account already exists!"
  echo ""
  echo "🔐 You can login with:"
  echo "   Username: $USERNAME"
  echo "   Password: Your existing password"
  echo ""
  echo "If you forgot your password, you'll need to reset it via Firestore"
  echo ""

else
  echo "❌ Failed to create user account"
  echo ""
  echo "Possible issues:"
  echo "   - Backend server not running (start with: npm run serve)"
  echo "   - Wrong backend URL (check if using different port)"
  echo "   - Network connectivity issues"
  echo ""
  echo "Try running the backend first:"
  echo "   cd backend/functions && npm run serve"
  echo ""
fi

echo "=============================================="
echo "Setup script completed"
echo ""
