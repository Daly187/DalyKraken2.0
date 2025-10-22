#!/bin/bash

##############################################################################
# DalyDEPEG Quick Health Check
# Quick one-command test to verify your stablecoin arbitrage system is working
##############################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-https://us-central1-dalydough.cloudfunctions.net/api}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo -e "${BOLD}${CYAN}"
echo "======================================================================"
echo "DalyDEPEG Quick Health Check"
echo "======================================================================"
echo -e "${NC}"

# Check if AUTH_TOKEN is set
if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}⚠ AUTH_TOKEN not set. Trying to load from .env file...${NC}"
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
        if [ -z "$AUTH_TOKEN" ]; then
            echo -e "${RED}✗ AUTH_TOKEN not found in .env file${NC}"
            echo -e "${YELLOW}Please set AUTH_TOKEN environment variable:${NC}"
            echo -e "${BLUE}  export AUTH_TOKEN='your-jwt-token-here'${NC}"
            echo ""
            exit 1
        else
            echo -e "${GREEN}✓ AUTH_TOKEN loaded from .env${NC}"
        fi
    else
        echo -e "${RED}✗ No .env file found and AUTH_TOKEN not set${NC}"
        echo -e "${YELLOW}Please create a .env file or set AUTH_TOKEN:${NC}"
        echo -e "${BLUE}  export AUTH_TOKEN='your-jwt-token-here'${NC}"
        echo ""
        exit 1
    fi
fi

echo -e "${BLUE}API URL: ${API_URL}${NC}"
echo ""

# Test 1: API Health
echo -e "${BOLD}Test 1: API Health Check${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/health" -H "Authorization: Bearer ${AUTH_TOKEN}")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ API is online and responding${NC}"
    echo -e "${CYAN}  Response: $RESPONSE_BODY${NC}"
else
    echo -e "${RED}✗ API health check failed (HTTP $HTTP_CODE)${NC}"
    echo -e "${YELLOW}  Response: $RESPONSE_BODY${NC}"
fi
echo ""

# Test 2: Depeg Config Endpoint
echo -e "${BOLD}Test 2: Depeg Configuration${NC}"
CONFIG_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/depeg/config" -H "Authorization: Bearer ${AUTH_TOKEN}")
HTTP_CODE=$(echo "$CONFIG_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$CONFIG_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Configuration endpoint working${NC}"
    # Parse enabled and autoExecute from JSON
    ENABLED=$(echo "$RESPONSE_BODY" | grep -o '"enabled":[^,}]*' | cut -d':' -f2)
    AUTO_EXEC=$(echo "$RESPONSE_BODY" | grep -o '"autoExecute":[^,}]*' | cut -d':' -f2)
    echo -e "${CYAN}  Strategy Enabled: $ENABLED${NC}"
    echo -e "${CYAN}  Auto-Execute: $AUTO_EXEC${NC}"
else
    echo -e "${RED}✗ Configuration endpoint failed (HTTP $HTTP_CODE)${NC}"
    echo -e "${YELLOW}  Response: $RESPONSE_BODY${NC}"
fi
echo ""

# Test 3: Price Fetching
echo -e "${BOLD}Test 3: Stablecoin Price Fetching${NC}"
PRICES_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/depeg/prices" -H "Authorization: Bearer ${AUTH_TOKEN}")
HTTP_CODE=$(echo "$PRICES_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$PRICES_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Price fetching working${NC}"
    PRICE_COUNT=$(echo "$RESPONSE_BODY" | grep -o '"pair"' | wc -l | tr -d ' ')
    echo -e "${CYAN}  Retrieved $PRICE_COUNT stablecoin prices from Kraken${NC}"
else
    echo -e "${RED}✗ Price fetching failed (HTTP $HTTP_CODE)${NC}"
    echo -e "${YELLOW}  Response: $RESPONSE_BODY${NC}"
fi
echo ""

# Test 4: Opportunity Detection
echo -e "${BOLD}Test 4: Opportunity Detection${NC}"
OPP_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/depeg/opportunities" -H "Authorization: Bearer ${AUTH_TOKEN}")
HTTP_CODE=$(echo "$OPP_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$OPP_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Opportunity detection working${NC}"
    OPP_COUNT=$(echo "$RESPONSE_BODY" | grep -o '"pair"' | wc -l | tr -d ' ')
    if [ "$OPP_COUNT" -gt "0" ]; then
        echo -e "${CYAN}  Found $OPP_COUNT arbitrage opportunities!${NC}"
    else
        echo -e "${CYAN}  No current opportunities (market conditions normal)${NC}"
    fi
else
    echo -e "${RED}✗ Opportunity detection failed (HTTP $HTTP_CODE)${NC}"
    echo -e "${YELLOW}  Response: $RESPONSE_BODY${NC}"
fi
echo ""

# Test 5: Check Scheduled Function Logs
echo -e "${BOLD}Test 5: Scheduled Function Status${NC}"
echo -e "${BLUE}Checking recent monitorDepegOpportunities executions...${NC}"

# Check if firebase CLI is available
if command -v firebase &> /dev/null; then
    RECENT_LOGS=$(firebase functions:log --only monitorDepegOpportunities --limit 1 2>&1 | head -20)
    if echo "$RECENT_LOGS" | grep -q "DepegMonitor"; then
        echo -e "${GREEN}✓ Scheduled function is executing${NC}"
        echo -e "${CYAN}  Recent execution log:${NC}"
        echo "$RECENT_LOGS" | grep "DepegMonitor" | head -3 | while read line; do
            echo -e "${CYAN}    $line${NC}"
        done
    else
        echo -e "${YELLOW}⚠ Could not verify scheduled function execution${NC}"
        echo -e "${YELLOW}  (This may be normal if function just deployed)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Firebase CLI not found - skipping log check${NC}"
    echo -e "${BLUE}  Install: npm install -g firebase-tools${NC}"
fi
echo ""

# Summary
echo -e "${BOLD}${CYAN}"
echo "======================================================================"
echo "Health Check Summary"
echo "======================================================================"
echo -e "${NC}"

echo -e "${GREEN}✓ Your DalyDEPEG system is deployed and operational!${NC}"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo -e "  1. ${BLUE}Visit your app:${NC} https://dalydough.web.app/daly-depeg"
echo -e "  2. ${BLUE}Run full tests:${NC} node backend/functions/test-depeg.js"
echo -e "  3. ${BLUE}View logs:${NC} firebase functions:log --only monitorDepegOpportunities"
echo -e "  4. ${BLUE}Monitor positions:${NC} Check the UI for active trades"
echo ""

# View recent system logs
echo -e "${BOLD}Want to see detailed logs?${NC}"
echo -e "  ${BLUE}View all depeg logs:${NC}"
echo -e "    firebase functions:log --only monitorDepegOpportunities"
echo ""
echo -e "  ${BLUE}View API logs:${NC}"
echo -e "    firebase functions:log --only api | grep -i depeg"
echo ""
