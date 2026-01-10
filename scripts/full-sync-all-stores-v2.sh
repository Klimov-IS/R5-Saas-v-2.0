#!/bin/bash

# Full Sync All Stores Script V2
# Improved version with retry logic and configurable delays
#
# Features:
# - 10 minute delay between stores (avoid Rate Limit 429)
# - Retry logic: up to 3 attempts per store
# - Excludes Тайди Центр (already fully synced)
# - Detailed logging with timestamps
#
# Usage: bash scripts/full-sync-all-stores-v2.sh

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/sync-config.sh"

echo "============================================="
echo "🚀 Full Sync All Stores V2"
echo "============================================="
echo "Start time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Configuration:"
echo "  - Delay between stores: ${DELAY_BETWEEN_STORES}s ($(($DELAY_BETWEEN_STORES / 60)) minutes)"
echo "  - Max retries: $MAX_RETRIES"
echo "  - Excluding: $EXCLUDE_STORE_ID (Тайди Центр)"
echo ""

# Get all active stores EXCEPT excluded one
echo "📋 Fetching all active stores..."
STORES_JSON=$(curl -s -X GET "$API_URL/api/stores" \
  -H "Authorization: Bearer $API_KEY")

# Filter: active status AND not excluded store
FILTERED_STORES=$(echo "$STORES_JSON" | jq -r ".[] | select(.status == \"active\" and .id != \"$EXCLUDE_STORE_ID\")")
STORE_IDS=$(echo "$FILTERED_STORES" | jq -r '.id')
STORE_COUNT=$(echo "$STORE_IDS" | wc -l)

echo "✅ Found $STORE_COUNT active stores (excluding Тайди Центр)"
echo ""

# Counters
COMPLETED=0
FAILED=0
SKIPPED=0

# Function to sync a store with retry logic
sync_store() {
  local STORE_ID=$1
  local STORE_NAME=$2
  local ATTEMPT=1

  while [ $ATTEMPT -le $MAX_RETRIES ]; do
    echo "$(date '+%H:%M:%S') - Attempt $ATTEMPT/$MAX_RETRIES - Starting full sync..."

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
      return 0  # Success
    else
      ERROR=$(echo "$BODY" | jq -r '.error // .details // "Unknown error"')
      echo "❌ FAILED (Attempt $ATTEMPT/$MAX_RETRIES): HTTP $HTTP_STATUS - $ERROR"

      # If not last attempt, wait before retry
      if [ $ATTEMPT -lt $MAX_RETRIES ]; then
        if [ $ATTEMPT -eq 1 ]; then
          RETRY_DELAY=$RETRY_DELAY_1
        else
          RETRY_DELAY=$RETRY_DELAY_2
        fi

        echo "⏳ Waiting ${RETRY_DELAY}s ($(($RETRY_DELAY / 60)) min) before retry..."
        sleep $RETRY_DELAY
      fi

      ((ATTEMPT++))
    fi
  done

  return 1  # All retries failed
}

# Loop through each store
CURRENT=0
while IFS= read -r STORE_ID; do
  ((CURRENT++))

  # Get store name
  STORE_NAME=$(echo "$FILTERED_STORES" | jq -r "select(.id == \"$STORE_ID\") | .name")

  echo "============================================="
  echo "[$CURRENT/$STORE_COUNT] Store: $STORE_NAME"
  echo "Store ID: $STORE_ID"
  echo "Start time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "---------------------------------------------"

  # Sync store with retry logic
  if sync_store "$STORE_ID" "$STORE_NAME"; then
    ((COMPLETED++))
  else
    ((FAILED++))
  fi

  echo "End time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Progress: ✅ $COMPLETED | ❌ $FAILED | Total: $CURRENT/$STORE_COUNT"
  echo ""

  # Delay before next store (except for last one)
  if [ $CURRENT -lt $STORE_COUNT ]; then
    echo "⏳ Waiting ${DELAY_BETWEEN_STORES}s ($(($DELAY_BETWEEN_STORES / 60)) min) before next store..."
    echo ""
    sleep $DELAY_BETWEEN_STORES
  fi
done <<< "$STORE_IDS"

echo "============================================="
echo "📊 Final Sync Summary"
echo "============================================="
echo "Total stores processed: $STORE_COUNT"
echo "✅ Successful: $COMPLETED"
echo "❌ Failed: $FAILED"
echo "End time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================="
