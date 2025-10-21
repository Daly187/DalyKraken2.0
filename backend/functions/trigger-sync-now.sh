#!/bin/bash

# Manually trigger trade sync via API
# This calls the endpoint we created: POST /audit/sync-trades

echo "=== Triggering Trade Sync Manually ==="
echo ""

# You need to get your auth token from the browser's localStorage
# Open browser console and run: localStorage.getItem('auth_token')

read -p "Enter your auth token (or press Enter to skip): " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
  echo ""
  echo "No token provided. To get your auth token:"
  echo "1. Open your browser and go to your app"
  echo "2. Open Developer Console (F12)"
  echo "3. Go to Console tab"
  echo "4. Run: localStorage.getItem('auth_token')"
  echo "5. Copy the token and run this script again"
  echo ""
  echo "Alternatively, the scheduled function will run at the next 15-minute interval (00, 15, 30, 45)"
  exit 0
fi

echo "Calling sync endpoint..."
echo ""

RESPONSE=$(curl -s -X POST https://us-central1-dalydough.cloudfunctions.net/api/audit/sync-trades \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "=== Checking logs ==="
echo ""

# Wait a moment for logs to propagate
sleep 3

# Show recent logs
npm run logs -- --only functions:syncKrakenTrades 2>&1 | grep -E "\[TradesSync\]" | head -50

echo ""
echo "Done! Check Firebase Console for full logs if needed."
