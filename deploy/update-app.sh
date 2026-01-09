#!/bin/bash

# WB Reputation Manager - Update Script
# Use this to update the application after pushing changes to GitHub

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   WB Reputation Manager - Application Update                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /var/www/wb-reputation

# Step 1: Pull latest changes
echo -e "${BLUE}[1/5] Pulling latest changes from GitHub...${NC}"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}\n"

# Step 2: Install/update dependencies
echo -e "${BLUE}[2/5] Installing dependencies...${NC}"
npm ci --production=false
echo -e "${GREEN}✓ Dependencies updated${NC}\n"

# Step 3: Rebuild application
echo -e "${BLUE}[3/5] Rebuilding application...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}\n"

# Step 4: Reload PM2
echo -e "${BLUE}[4/5] Reloading application (zero-downtime)...${NC}"
pm2 reload wb-reputation
echo -e "${GREEN}✓ Application reloaded${NC}\n"

# Step 5: Check status
echo -e "${BLUE}[5/5] Checking application status...${NC}"
pm2 status wb-reputation
echo -e "${GREEN}✓ Status checked${NC}\n"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ UPDATE COMPLETED SUCCESSFULLY!                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}View logs:${NC} pm2 logs wb-reputation"
echo -e "${BLUE}Monitor:${NC} pm2 monit"
echo ""
