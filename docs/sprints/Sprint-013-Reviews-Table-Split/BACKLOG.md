# Sprint-013 Backlog — COMPLETED 2026-03-20

## Phase 0: Pre-Migration Cleanup — DONE

### TASK-001: Fix broken index `idx_reviews_complaint_workflow` — DONE (N/A)
**Status:** COMPLETE — index already didn't exist on production, nothing to fix.

### TASK-002: Baseline measurements — DONE
**Status:** COMPLETE — `scripts/sprint-013-baseline.mjs` run on production.
**Key results:**
- Total reviews: 3,661,456 (5★: 3,251,690 = 88.8%)
- Table: 2,777 MB data, 6,265 MB total (with indexes 3,476 MB)
- Buffer cache hit ratio: 89.16%
- Complaints on 5★: 0, Chat links on 5★: 0
- FK orphans: 0 across all tables

### TASK-003: Audit index usage statistics — DONE
**Status:** COMPLETE — identified low-usage indexes.

---

## Phase 1: Create Archive Infrastructure — DONE

### TASK-004: Migration 037 — DONE
**Status:** COMPLETE — `migrations/037_create_reviews_archive.sql` executed on production.
**Created:**
- `reviews_archive` table (LIKE reviews INCLUDING DEFAULTS)
- PK, CHECK constraint `chk_archive_rating_5`
- 4 indexes: idx_ra_store_date, idx_ra_product_date, idx_ra_store_rating, idx_ra_marketplace
- 2 triggers: complaint_flags, updated_at
- `reviews_all` UNION ALL view
- Dropped 4 FK constraints

### TASK-006: FK constraint analysis — DONE
**Status:** COMPLETE — 0 complaints on 5★, 0 chat links on 5★ → safe to split.

---

## Phase 2: Data Migration — DONE

### TASK-005: Data migration — DONE
**Status:** COMPLETE — 3,253,314 rows migrated via TRUNCATE+INSERT approach.

### TASK-007: CHECK constraints — DONE
**Status:** COMPLETE
- `chk_archive_rating_5` — applied in migration 037
- `chk_reviews_rating_1_4` — applied in Phase 5 finalize script

### TASK-008: Post-migration VACUUM + REINDEX — DONE
**Status:** COMPLETE — 2,777 MB → 341 MB (-88%)

### TASK-009: Post-migration validation — DONE
**Status:** COMPLETE — 0 orphans, 0 duplicates, correct rating distribution

---

## Phase 3: Code Changes — Write Routing — DONE

### TASK-010: Route upsertReview, createReview, updateReview, getReviewById — DONE
**File:** `src/db/helpers.ts`
**Changes:** Rating-based routing (5★→archive, 1-4★→reviews), cross-table move on rating change, dual-table fallback for updates.

### TASK-010b: Route upsertReviewsFromExtension — DONE
**File:** `src/db/extension-helpers.ts`
**Changes:** Check both tables for existing review, route INSERT by rating, cleanup other table.

### TASK-011: Route batch UPDATEs in extension APIs — DONE
**Files:** `review-statuses/route.ts` (6 batch UPDATEs), `complaint-statuses/route.ts`, `reparse/route.ts`, `sync/route.ts`, `complaint/sent/route.ts`
**Pattern:** Execute same UPDATE on both tables via closure `const sql = (table) => ...`

### TASK-012: Route review-sync + ozon-review-sync writes — DONE
**Files:** `review-sync.ts`, `ozon-review-sync.ts`
**Changes:** Deletion detection, complaint cancellation, resurrection — all dual-table.

### TASK-013: Route complaint-helpers writes — DONE
**File:** `complaint-helpers.ts`
**Changes:** 5 UPDATEs + bulk createComplaints — dual-table fallback pattern.

---

## Phase 4: Code Changes — Read Queries — DONE

### TASK-014: Update statistics queries to `reviews_all` — DONE
**Changes:**
- `helpers.ts`: 8 queries → `FROM reviews_all`
- `extension-helpers.ts`: 2 queries → `FROM reviews_all`
- `cabinet-helpers.ts`: 2 queries → `FROM reviews_all`

### TASK-015: Update JOIN queries to `reviews_all` — DONE
**Changes:**
- `telegram-helpers.ts`: 8 LEFT JOINs → `reviews_all`
- `review-chat-link-helpers.ts`: 4 queries → `reviews_all`
- `cron-jobs.ts`: 1 LEFT JOIN → `reviews_all`
- `chat-repository.ts`: 1 LEFT JOIN → `reviews_all`
- `stores/[storeId]/chats/[chatId]/route.ts`: 1 LEFT JOIN → `reviews_all`
- `extension/chat/opened/route.ts`: 1 SELECT → `reviews_all`
- `extension/stores/[storeId]/reviews/find-by-data/route.ts`: 1 FROM → `reviews_all`
- `stores/[storeId]/reviews/[reviewId]/complaint/sent/route.ts`: dual-table UPDATE

### TASK-016: No-change verification — DONE
**Verified ~20 queries intentionally stay on `reviews` only:**
- All complaint queries (filter rating ≤ 3)
- Extension tasks (ratings from product_rules, always 1-4)
- Extension stores Q2/Q3 (rating < 5)
- Progress tracking (rating BETWEEN 1 AND 3)
- Backfill helpers (rating IN 1,2,3)
- Google Sheets client directory (rating ≤ 3)

---

## Phase 5: Index Optimization + Finalize — DONE

### TASK-017: Drop redundant index — DONE
**Dropped:** `idx_reviews_status_parse_r14` (hotfix, redundant after split)

### TASK-018: CHECK constraint + move fresh 5★ — DONE
**Script:** `scripts/sprint-013-phase5-finalize.mjs`
**Results:**
- Moved 1,040 fresh 5★ reviews to archive (741 new + 299 already existed)
- Added `chk_reviews_rating_1_4 CHECK (rating BETWEEN 1 AND 4)`
- ANALYZE both tables

---

## Phase 6: Validation — DONE

### TASK-019: Automated validation — DONE
**Script:** `scripts/sprint-013-phase6-validate.mjs`
**Results: 11/11 checks passed:**
- ✅ reviews_all = reviews + archive (3,664,343 = 410,107 + 3,254,236)
- ✅ No 5★ in reviews
- ✅ No non-5★ in archive
- ✅ Both CHECK constraints exist
- ✅ No orphaned review_complaints
- ✅ No orphaned review_chat_links
- ✅ No cross-table duplicates
- ✅ idx_reviews_status_parse_r14 dropped
- ✅ reviews_all queryable + JOINs work

---

## Phase 7: Deploy — DONE

### TASK-020: Deploy code changes — DONE
**Date:** 2026-03-20
**Steps executed:**
1. Committed 22 files (Phase 3+4 code + Phase 5+6 scripts)
2. `git push origin main`
3. SSH → `git pull && npm ci && npm run build && pm2 restart all`
4. Verified CRON started, dialogue sync running
5. Ran Phase 5 finalize script → 1,040 5★ moved, CHECK added, index dropped
6. Ran Phase 6 validation → 11/11 passed

---

## Final Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `reviews` total size | 6,265 MB | 597 MB | **-90%** |
| `reviews` data size | 2,777 MB | 342 MB | **-88%** |
| `reviews` rows | 3,663,639 | 410,107 | **-89%** |
| 5★ in reviews | 3,253,314 | 0 | **-100%** |
| Files modified | — | 22 | — |
| Validation checks | — | 11/11 | **100%** |
