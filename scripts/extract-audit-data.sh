#!/bin/bash

# Script to help extract trade data from your audit log
# This will guide you through the process

echo "=========================================="
echo "DCA Bot Data Extraction Helper"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if service account key exists
if [ ! -f "backend/functions/serviceAccountKey.json" ]; then
    echo -e "${RED}❌ Firebase service account key not found!${NC}"
    echo ""
    echo "Please follow these steps:"
    echo "1. Open: https://console.firebase.google.com/project/dalydough/settings/serviceaccounts/adminsdk"
    echo "2. Click 'Generate New Private Key'"
    echo "3. Download the file"
    echo "4. Run these commands:"
    echo ""
    echo "   cd ~/Downloads"
    echo "   cp dalydough-firebase-adminsdk-*.json $(pwd)/backend/functions/serviceAccountKey.json"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Firebase service account key found${NC}"
echo ""

# Check if historical-bots.json exists
if [ ! -f "scripts/historical-bots.json" ]; then
    echo -e "${YELLOW}Creating historical-bots.json from template...${NC}"
    cp scripts/historical-bots-template.json scripts/historical-bots.json
    echo -e "${GREEN}✓ Created${NC}"
fi

echo ""
echo "=========================================="
echo "How to get your trade data:"
echo "=========================================="
echo ""
echo "OPTION 1: From Your Audit Log Page"
echo "-----------------------------------"
echo "1. Open your DalyDCA app in the browser"
echo "2. Go to the Audit Log page"
echo "3. Look at the 'Trade History' table"
echo "4. For each symbol (BTC/USD, ETH/USD, etc.):"
echo "   - Note all the BUY trades"
echo "   - Note the Date, Price, Volume, Cost, and Order ID"
echo "5. Add them to scripts/historical-bots.json"
echo ""
echo "OPTION 2: Directly from Kraken (If API keys are set)"
echo "-----------------------------------"
echo "If your Kraken API keys are configured in the app,"
echo "the audit log should already show your trades."
echo ""
echo "OPTION 3: Manual Entry"
echo "-----------------------------------"
echo "If you remember your trades, you can enter them manually"
echo "into scripts/historical-bots.json"
echo ""

echo "=========================================="
echo "Current Status:"
echo "=========================================="
echo -e "${GREEN}✓ Firebase key: Ready${NC}"
echo -e "${GREEN}✓ Template file: Created${NC}"
echo -e "${YELLOW}⏳ Trade data: Waiting for you to add it${NC}"
echo ""

echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Open the JSON file:"
echo "   code scripts/historical-bots.json"
echo ""
echo "2. Replace the example data with your actual trades"
echo ""
echo "3. Run the population script:"
echo "   npm run populate-bots"
echo ""
echo "4. Check your DalyDCA page to see the bots!"
echo ""

echo "=========================================="
echo "Example Bot Entry:"
echo "=========================================="
cat << 'EOF'

{
  "symbol": "BTC/USD",
  "initialOrderAmount": 10,
  "tradeMultiplier": 2,
  "reEntryCount": 8,
  "stepPercent": 1,
  "stepMultiplier": 2,
  "tpTarget": 3,
  "supportResistanceEnabled": false,
  "reEntryDelay": 888,
  "trendAlignmentEnabled": true,
  "status": "active",
  "userId": "default-user",
  "entries": [
    {
      "entryNumber": 1,
      "orderAmount": 10,
      "price": 45000,
      "quantity": 0.00022222,
      "timestamp": "2025-01-15T10:30:00.000Z",
      "orderId": "YOUR-KRAKEN-ORDER-ID",
      "status": "filled"
    }
  ]
}

EOF

echo ""
echo "=========================================="
echo "Ready to edit? Run:"
echo "  code scripts/historical-bots.json"
echo "=========================================="
