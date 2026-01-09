#!/bin/bash

# WB Reputation Manager - Application Deployment Script
# Run this script after setup-server.sh

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   WB Reputation Manager - Application Deployment              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Error: .env.production file not found!${NC}"
    echo ""
    echo "Please create .env.production with your configuration:"
    echo "  nano .env.production"
    echo ""
    exit 1
fi

# Step 1: Install dependencies
echo -e "${BLUE}[1/6] Installing dependencies...${NC}"
npm ci --production=false
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Step 2: Build application
echo -e "${BLUE}[2/6] Building Next.js application...${NC}"
npm run build
echo -e "${GREEN}✓ Application built successfully${NC}\n"

# Step 3: Create ecosystem.config.js if not exists
echo -e "${BLUE}[3/6] Creating PM2 ecosystem config...${NC}"
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'wb-reputation',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/var/www/wb-reputation',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/wb-reputation/logs/error.log',
    out_file: '/var/www/wb-reputation/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
EOF
echo -e "${GREEN}✓ PM2 config created${NC}\n"

# Step 4: Stop existing PM2 process (if running)
echo -e "${BLUE}[4/6] Stopping existing PM2 process...${NC}"
pm2 delete wb-reputation 2>/dev/null || echo "No existing process to stop"
echo -e "${GREEN}✓ Old process stopped${NC}\n"

# Step 5: Start application with PM2
echo -e "${BLUE}[5/6] Starting application with PM2...${NC}"
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✓ Application started${NC}\n"

# Step 6: Configure Nginx
echo -e "${BLUE}[6/6] Configuring Nginx...${NC}"
sudo bash -c 'cat > /etc/nginx/sites-available/wb-reputation << EOF
server {
    listen 80;
    server_name 158.160.217.236;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Static files cache
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, max-age=3600, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
EOF'

# Enable site and remove default
sudo ln -sf /etc/nginx/sites-available/wb-reputation /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
echo -e "${GREEN}✓ Nginx configured and reloaded${NC}\n"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ DEPLOYMENT COMPLETED SUCCESSFULLY!                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Your application is now running!${NC}"
echo ""
echo -e "${BLUE}Access your app:${NC}"
echo "  http://158.160.217.236"
echo ""
echo -e "${BLUE}View logs:${NC}"
echo "  pm2 logs wb-reputation"
echo ""
echo -e "${BLUE}Check status:${NC}"
echo "  pm2 status"
echo ""
echo -e "${BLUE}Monitor:${NC}"
echo "  pm2 monit"
echo ""
