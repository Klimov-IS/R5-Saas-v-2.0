#!/bin/bash

#
# Production Deployment Script for WB Reputation Manager
#
# This script performs a safe deployment to production:
# 1. Pull latest changes from GitHub
# 2. Install dependencies (if needed)
# 3. Build application
# 4. Restart PM2 processes (main app + cron jobs)
# 5. Verify deployment success
#
# Usage:
#   bash scripts/deploy.sh
#
# Run this on production server at /var/www/wb-reputation
#

set -e  # Exit on error

echo ""
echo "======================================"
echo "🚀 WB Reputation Manager - Deployment"
echo "======================================"
echo ""
echo "📅 Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Navigate to project directory
cd /var/www/wb-reputation

# 1. Pull latest changes
echo "📥 Step 1/5: Pulling latest changes from GitHub..."
git pull origin main
echo "✅ Git pull completed"
echo ""

# 2. Install dependencies
echo "📦 Step 2/5: Installing dependencies..."
npm ci --production=false
echo "✅ Dependencies installed"
echo ""

# 3. Build application
echo "🔨 Step 3/5: Building application..."
npm run build
echo "✅ Build completed"
echo ""

# 4. Restart PM2 processes
echo "🔄 Step 4/5: Restarting PM2 processes..."
echo "   Restarting all processes (wb-reputation + wb-reputation-cron)..."
pm2 restart all
echo "✅ PM2 processes restarted"
echo ""

# 5. Verify deployment
echo "🔍 Step 5/5: Verifying deployment..."
echo ""

echo "   PM2 Status:"
pm2 status
echo ""

echo "   Waiting 10 seconds for CRON jobs to initialize..."
sleep 10

echo ""
echo "   Checking CRON jobs:"
pm2 logs wb-reputation --lines 50 --nostream | grep -E "\[CRON\].*✅|INIT.*✅" | tail -10

echo ""
echo "======================================"
echo "✅ Deployment completed successfully!"
echo "======================================"
echo ""
echo "📅 Finished at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "📊 Next steps:"
echo "   - Check application: http://158.160.217.236"
echo "   - Monitor logs: pm2 logs wb-reputation"
echo "   - Check CRON status: curl http://localhost:3000/api/cron/status"
echo ""
