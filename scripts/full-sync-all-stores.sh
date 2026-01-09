#!/bin/bash

# Full Sync All Stores Script
# Triggers full review sync for ALL active stores overnight
# Uses adaptive chunking to bypass WB API 20k limit

API_URL="http://localhost:3000"
API_KEY="wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

echo "====================================="
echo "🚀 Full Sync All Stores"
echo "====================================="
echo "Start time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Get all active stores
echo "📋 Fetching all active stores..."
STORES_JSON=$(curl -s -X GET "$API_URL/api/stores" \
  -H "Authorization: Bearer $API_KEY")

# Extract store IDs and names for active stores
STORE_IDS=$(echo "$STORES_JSON" | jq -r '.data[] | select(.status == "active") | .id')
STORE_COUNT=$(echo "$STORE_IDS" | wc -l)

echo "✅ Found $STORE_COUNT active stores"
echo ""

# Counter
COMPLETED=0
FAILED=0

# Loop through each store
while IFS= read -r STORE_ID; do
  # Get store name
  STORE_NAME=$(echo "$STORES_JSON" | jq -r ".data[] | select(.id == \"$STORE_ID\") | .name")

  echo "-----------------------------------"
  echo "[$((COMPLETED + FAILED + 1))/$STORE_COUNT] Store: $STORE_NAME"
  echo "Store ID: $STORE_ID"
  echo "$(date '+%H:%M:%S') - Starting full sync..."

  # Trigger full sync
  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "$API_URL/api/stores/$STORE_ID/reviews/update?mode=full" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json")

  HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  if [ "$HTTP_STATUS" = "200" ]; then
    MESSAGE=$(echo "$BODY" | jq -r '.message // empty')
    echo "✅ SUCCESS: $MESSAGE"
    ((COMPLETED++))
  else
    ERROR=$(echo "$BODY" | jq -r '.error // .details // "Unknown error"')
    echo "❌ FAILED: HTTP $HTTP_STATUS - $ERROR"
    ((FAILED++))
  fi

  echo "Completed: $COMPLETED | Failed: $FAILED"
  echo ""

  # Small delay between stores (5 seconds)
  sleep 5
done <<< "$STORE_IDS"

echo "====================================="
echo "📊 Sync Summary"
echo "====================================="
echo "Total stores: $STORE_COUNT"
echo "✅ Successful: $COMPLETED"
echo "❌ Failed: $FAILED"
echo "End time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "====================================="
