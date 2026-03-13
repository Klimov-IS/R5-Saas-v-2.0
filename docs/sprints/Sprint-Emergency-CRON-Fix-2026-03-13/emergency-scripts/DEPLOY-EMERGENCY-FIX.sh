#!/bin/bash
# 🚨 EMERGENCY DEPLOYMENT: Fix duplicate auto-sequence sends
#
# Date: 2026-03-13
# Issue: 3 processes sending same messages (2× main app + 1× cron process)
# Fix: Disable CRON in main app, keep only in wb-reputation-cron process
#
# Usage: bash DEPLOY-EMERGENCY-FIX.sh

set -e  # Exit on error

echo "========================================="
echo "🚨 EMERGENCY FIX DEPLOYMENT"
echo "========================================="
echo ""
echo "⏰ Started at: $(date)"
echo ""

# Step 1: Stop all active auto-sequences
echo "📋 Step 1/6: Stopping all active auto-sequences..."
node scripts/EMERGENCY-stop-auto-sequences.mjs
echo "✅ Sequences stopped"
echo ""

# Step 2: Stop CRON process temporarily
echo "📋 Step 2/6: Stopping CRON process..."
pm2 stop wb-reputation-cron
echo "✅ CRON process stopped"
echo ""

# Step 3: Run audit to document current state
echo "📋 Step 3/6: Running audit (saving to logs/)..."
mkdir -p logs
node scripts/AUDIT-check-duplicate-sends.mjs > logs/audit-before-fix-$(date +%Y%m%d-%H%M%S).txt
echo "✅ Audit complete (see logs/ directory)"
echo ""

# Step 4: Build new version with fix
echo "📋 Step 4/6: Building Next.js with CRON disabled in main app..."
npm run build
echo "✅ Build complete"
echo ""

# Step 5: Restart main app (will NOT start CRON anymore)
echo "📋 Step 5/6: Restarting main application..."
pm2 restart wb-reputation
echo "✅ Main app restarted (CRON disabled)"
echo ""

# Step 6: Start CRON process (only source of CRON now)
echo "📋 Step 6/6: Starting CRON process (single source of truth)..."
pm2 start wb-reputation-cron
echo "✅ CRON process started"
echo ""

# Final check
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "📊 Process Status:"
pm2 list
echo ""
echo "🔍 Next Steps:"
echo "   1. Monitor logs: pm2 logs wb-reputation-cron --lines 100"
echo "   2. Wait 30 minutes for next auto-sequence run"
echo "   3. Run audit again: node scripts/AUDIT-check-duplicate-sends.mjs"
echo "   4. Verify NO duplicates in audit report"
echo ""
echo "⏰ Completed at: $(date)"
echo ""
