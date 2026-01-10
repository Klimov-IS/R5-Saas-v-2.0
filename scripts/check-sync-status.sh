#!/bin/bash

# Check Sync Status Script
# Monitors the current state of review synchronization across all stores
#
# Usage: bash scripts/check-sync-status.sh

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/sync-config.sh"

echo "============================================="
echo "📊 Review Sync Status Report"
echo "============================================="
echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Fetch all stores
STORES_JSON=$(curl -s -X GET "$API_URL/api/stores" \
  -H "Authorization: Bearer $API_KEY")

# Count stores by sync status
TOTAL_ACTIVE=$(echo "$STORES_JSON" | jq -r '[.[] | select(.status == "active")] | length')
SUCCESS_COUNT=$(echo "$STORES_JSON" | jq -r '[.[] | select(.status == "active" and .last_review_update_status == "success")] | length')
PENDING_COUNT=$(echo "$STORES_JSON" | jq -r '[.[] | select(.status == "active" and .last_review_update_status == "pending")] | length')
ERROR_COUNT=$(echo "$STORES_JSON" | jq -r '[.[] | select(.status == "active" and .last_review_update_status == "error")] | length')
NEVER_SYNCED=$(echo "$STORES_JSON" | jq -r '[.[] | select(.status == "active" and .last_review_update_status == null)] | length')

echo "📈 Overall Statistics:"
echo "---------------------------------------------"
echo "Total active stores:     $TOTAL_ACTIVE"
echo "✅ Successfully synced:  $SUCCESS_COUNT"
echo "🔄 Currently syncing:    $PENDING_COUNT"
echo "❌ Failed with errors:   $ERROR_COUNT"
echo "⚪ Never synced:         $NEVER_SYNCED"
echo ""

# Show stores currently syncing
if [ $PENDING_COUNT -gt 0 ]; then
  echo "🔄 Stores Currently Syncing:"
  echo "---------------------------------------------"
  echo "$STORES_JSON" | jq -r '.[] | select(.status == "active" and .last_review_update_status == "pending") | "  - \(.name) (ID: \(.id))"'
  echo ""
fi

# Show stores with errors
if [ $ERROR_COUNT -gt 0 ]; then
  echo "❌ Stores with Sync Errors:"
  echo "---------------------------------------------"
  echo "$STORES_JSON" | jq -r '.[] | select(.status == "active" and .last_review_update_status == "error") | "  - \(.name) (ID: \(.id))\n    Error: \(.last_review_update_error // "Unknown")"'
  echo ""
fi

# Top 10 stores by review count
echo "🏆 Top 10 Stores by Review Count:"
echo "---------------------------------------------"
echo "$STORES_JSON" | jq -r '.[] | select(.status == "active") | {name, total_reviews, id}' | \
  jq -s 'sort_by(.total_reviews) | reverse | .[:10]' | \
  jq -r '.[] | "  \(.total_reviews | tostring | . + " reviews" | ljust(12)) - \(.name)"'
echo ""

# Total reviews across all active stores
TOTAL_REVIEWS=$(echo "$STORES_JSON" | jq -r '[.[] | select(.status == "active") | .total_reviews] | add')
echo "📊 Total Reviews Across All Stores: $(printf "%'d" $TOTAL_REVIEWS)"
echo ""

# Show stores never synced
if [ $NEVER_SYNCED -gt 0 ]; then
  echo "⚪ Stores Never Synced:"
  echo "---------------------------------------------"
  echo "$STORES_JSON" | jq -r '.[] | select(.status == "active" and .last_review_update_status == null) | "  - \(.name) (ID: \(.id))"'
  echo ""
fi

echo "============================================="
echo "💡 Tips:"
echo "---------------------------------------------"
echo "• Run full-sync-all-stores-v2.sh to sync all stores"
echo "• Check logs: tail -f sync-v2-*.log"
echo "• Monitor PM2: pm2 logs wb-reputation"
echo "============================================="
