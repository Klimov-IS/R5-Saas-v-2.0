# TASK-20260215: Deleted Reviews Detection

## Goal

Detect reviews deleted by buyers on WB and mark them as `deleted` in our database. Auto-cancel draft complaints for deleted reviews with new status `not_applicable`.

## Problem

Buyers delete reviews on WB, but our system keeps "phantom" reviews with draft complaints that can't be submitted. This pollutes complaint metrics and wastes manager time.

## Solution: Server-side Detection (Variant A)

During full sync (rolling + midday), compare review IDs from WB API with DB. Missing reviews = deleted.

## Changes

### Migration 015
- `review_status_wb` ENUM: +`deleted`
- `complaint_status` ENUM: +`not_applicable`
- `review_complaints.status` CHECK: +`not_applicable`
- `reviews.deleted_from_wb_at` TIMESTAMPTZ column
- `idx_reviews_deleted` partial index

### Detection Logic (`reviews/update/route.ts`)
- Collect all review IDs from WB API in `seenReviewIds` Set
- After sync: query DB for non-deleted IDs in date range
- Diff: `dbIds - seenIds = deletedIds`
- Safeguard: skip if >30% deleted (API issue)
- Mark: `review_status_wb = 'deleted'`, `deleted_from_wb_at = NOW()`
- Auto-cancel: draft complaints → `not_applicable`

### Extension Filtering
- `extension/stores/route.ts`: excluded deleted from draft count
- `extension/stores/[storeId]/complaints/route.ts`: excluded deleted from all 3 queries
- `extension/stores/[storeId]/reviews/sync/route.ts`: added `deleted` to type

### Auto-Complaint Guard
- `shouldGenerateComplaint()`: skip if `review_status_wb === 'deleted'`
- `findEligibleReviewsForComplaints()`: already uses whitelist (no change needed)

### UI
- FilterCard: +`deleted` option, +`not_applicable` option, renamed `not_sent` → "Без черновика"

## Impact
- **DB:** New ENUM values, new column, new index
- **API:** Extension routes filter out deleted reviews
- **Cron:** Rolling + midday sync detect deletions
- **AI:** Auto-complaint skips deleted reviews
- **UI:** New filter options

## Docs Updated
- `docs/database-schema.md`
- `docs/domains/complaints.md`
- `docs/CRON_JOBS.md`

## Rollout
1. Run migration 015
2. Deploy code
3. Monitor PM2 logs for "Marked X reviews as deleted"
4. After 24h: `SELECT COUNT(*) FROM reviews WHERE review_status_wb = 'deleted'`

## Status: IMPLEMENTED
