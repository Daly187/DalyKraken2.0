#!/bin/bash

# Test the trade sync endpoint
# Usage: ./test-sync.sh YOUR_AUTH_TOKEN

AUTH_TOKEN=${1:-$(cat ~/.dalykraken_auth_token 2>/dev/null)}

if [ -z "$AUTH_TOKEN" ]; then
  echo "Error: No auth token provided"
  echo "Usage: ./test-sync.sh YOUR_AUTH_TOKEN"
  exit 1
fi

echo "Testing trade sync endpoint..."
echo ""

curl -X POST https://us-central1-dalydough.cloudfunctions.net/api/audit/sync-trades \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.'

echo ""
echo "Done!"
