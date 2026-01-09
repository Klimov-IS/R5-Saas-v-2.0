#!/bin/bash

# WB Reputation Manager - Automatic Server Setup Script
# This script will setup everything needed on Yandex Cloud Ubuntu server

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   WB Reputation Manager - Server Setup                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Update system
echo -e "${BLUE}[1/9] Updating system...${NC}"
sudo apt update && sudo apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}\n"

# Step 2: Install Node.js 22
echo -e "${BLUE}[2/9] Installing Node.js 22...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}\n"
else
    echo -e "${GREEN}✓ Node.js already installed: $(node --version)${NC}\n"
fi

# Step 3: Install PM2
echo -e "${BLUE}[3/9] Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}\n"
else
    echo -e "${GREEN}✓ PM2 already installed${NC}\n"
fi

# Step 4: Install Nginx
echo -e "${BLUE}[4/9] Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed and started${NC}\n"
else
    echo -e "${GREEN}✓ Nginx already installed${NC}\n"
fi

# Step 5: Install Git
echo -e "${BLUE}[5/9] Installing Git...${NC}"
if ! command -v git &> /dev/null; then
    sudo apt install -y git
    echo -e "${GREEN}✓ Git installed: $(git --version)${NC}\n"
else
    echo -e "${GREEN}✓ Git already installed: $(git --version)${NC}\n"
fi

# Step 6: Create app directory
echo -e "${BLUE}[6/9] Creating application directory...${NC}"
sudo mkdir -p /var/www
sudo chown -R ubuntu:ubuntu /var/www
echo -e "${GREEN}✓ Directory /var/www created${NC}\n"

# Step 7: Clone repository
echo -e "${BLUE}[7/9] Cloning repository from GitHub...${NC}"
cd /var/www
if [ -d "wb-reputation" ]; then
    echo -e "${RED}Directory wb-reputation already exists. Skipping clone.${NC}\n"
    cd wb-reputation
    git pull origin main
else
    git clone https://github.com/Klimov-IS/R5-Saas-v-2.0.git wb-reputation
    cd wb-reputation
fi
echo -e "${GREEN}✓ Repository cloned/updated${NC}\n"

# Step 8: Create logs directory
echo -e "${BLUE}[8/9] Creating logs directory...${NC}"
mkdir -p logs
echo -e "${GREEN}✓ Logs directory created${NC}\n"

# Step 9: Setup PM2 startup
echo -e "${BLUE}[9/9] Configuring PM2 auto-start...${NC}"
pm2 startup | tail -1 | sudo bash
echo -e "${GREEN}✓ PM2 configured for auto-start${NC}\n"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ SERVER SETUP COMPLETED SUCCESSFULLY!                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Create .env.production file:"
echo "   nano /var/www/wb-reputation/.env.production"
echo ""
echo "2. Run the deployment script:"
echo "   cd /var/www/wb-reputation"
echo "   bash deploy/deploy-app.sh"
echo ""
echo -e "${GREEN}Server is ready for deployment!${NC}"
