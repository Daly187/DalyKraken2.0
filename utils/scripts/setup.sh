#!/bin/bash

# DalyKraken 2.0 Setup Script
# This script will install all dependencies and set up the project

set -e

echo "=================================="
echo "DalyKraken 2.0 Setup"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Error: Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version) detected${NC}"
echo ""

# Create necessary directories
echo -e "${BLUE}Creating directories...${NC}"
mkdir -p data/snapshots
mkdir -p backend/services/main/logs
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Install Frontend Dependencies
echo -e "${BLUE}Installing Frontend dependencies...${NC}"
cd frontend
npm install
cd ..
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

# Install Main Backend Dependencies
echo -e "${BLUE}Installing Main Backend dependencies...${NC}"
cd backend/services/main
npm install
cd ../../..
echo -e "${GREEN}✓ Main Backend dependencies installed${NC}"
echo ""

# Install Snapshot Service Dependencies
echo -e "${BLUE}Installing Snapshot Service dependencies...${NC}"
cd backend/services/snapshot
npm install
cd ../../..
echo -e "${GREEN}✓ Snapshot Service dependencies installed${NC}"
echo ""

# Install Cache API Dependencies
echo -e "${BLUE}Installing Cache API dependencies...${NC}"
cd backend/services/cache
npm install
cd ../../..
echo -e "${GREEN}✓ Cache API dependencies installed${NC}"
echo ""

# Setup environment file
if [ ! -f backend/services/main/.env ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cp backend/services/main/.env.example backend/services/main/.env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠ Please edit backend/services/main/.env with your API keys${NC}"
    echo ""
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
    echo ""
fi

# Setup complete
echo ""
echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "To start the application:"
echo ""
echo "  Terminal 1: npm run dev:frontend"
echo "  Terminal 2: npm run dev:backend"
echo "  Terminal 3: npm run dev:snapshot"
echo "  Terminal 4: npm run dev:cache"
echo ""
echo "Then open: http://localhost:3000"
echo "Login: admin / admin"
echo ""
echo "For more information, see:"
echo "  - README.md"
echo "  - QUICK_START.md"
echo ""
