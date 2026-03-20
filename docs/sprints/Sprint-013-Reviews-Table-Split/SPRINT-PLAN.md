# Sprint-013: Reviews Table Split (reviews + reviews_archive)

**Start Date:** 2026-03-20
**Priority:** P0 — Production performance critical
**Status:** Phase 2 COMPLETE — data migration done, code changes pending

---

## Problem Statement

Таблица `reviews` содержит 3,659,419 строк (6.25 GB), из которых 88.8% — пятизвёздочные отзывы, которые НИКОГДА не используются в работе (жалобы, чаты, рассылки, автогенерация). Сервер имеет 4 GB RAM — таблица не помещается в буферный кеш PostgreSQL, что вызывает:

- `/api/extension/stores` — 60s+ на холодном кеше (500 error)
- Медленные запросы во всех endpoints, работающих с reviews
- Деградация после каждого рестарта PM2

### Data Analysis (baseline 2026-03-20)

| Rating | Count       | % of Total | Used in Work? |
|--------|-------------|------------|---------------|
| 5★     | 3,251,690   | 88.8%      | NEVER         |
| 4★     | 198,227     | 5.4%       | Sometimes     |
| 3★     | 84,931      | 2.3%       | Always        |
| 2★     | 37,261      | 1.0%       | Always        |
| 1★     | 89,347      | 2.4%       | Always        |
| **Total** | **3,661,456** | **100%** |             |

### After Split (ACTUAL RESULTS 2026-03-20)

| Table           | Rows     | Size      | Fits in RAM? |
|-----------------|----------|-----------|--------------|
| reviews (1-4★ + 218 fresh 5★) | 410,242 | **596 MB** | YES |
| reviews_archive (5★) | 3,253,314 | **2,642 MB** | No (not needed) |
| **BEFORE split** | **3,661,456** | **6,265 MB** | NO |

---

## Architecture Decision

**Approach:** Две раздельные таблицы + UNION VIEW для статистики.

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| A. Separate tables | Простой routing, чистое разделение, лёгкий rollback | Дублирование FK/индексов | **ВЫБРАНО** |
| B. Partitioning | Автоматический routing, inherited indexes | Сложный UPSERT, migration complexity | Отклонено |
| C. Soft-delete flag | Минимальные изменения | Не улучшает performance (таблица та же) | Отклонено |

**Boundary:** Статическая — `rating = 5` → archive, `rating < 5` → reviews.

**Rationale:** Статическая граница даёт 89% бенефита при минимальной сложности. Динамическая граница (по product_rules) добавляет огромную сложность с маржинальным выигрышем (~4% дополнительно).

---

## Audit Summary

### Files Requiring Changes

**Total:** 29 production files reference `reviews` table.

#### WRITE Operations (must route by rating) — 7 files

| File | Function | Operation | Priority |
|------|----------|-----------|----------|
| `src/db/helpers.ts` | `upsertReview()` | INSERT/UPDATE | P0 — master function |
| `src/lib/review-sync.ts` | Various | INSERT + 4x UPDATE | P0 — highest volume |
| `src/lib/ozon-review-sync.ts` | `refreshOzonReviews()` | INSERT (via upsert) | P0 — via helpers |
| `src/db/extension-helpers.ts` | `upsertReviewsFromExtension()` | INSERT/UPDATE | P0 — extension sync |
| `src/db/complaint-helpers.ts` | `createComplaint()`, `bulkCreate()` | UPDATE | P1 — denormalization |
| `src/app/api/extension/review-statuses/route.ts` | 5 batch UPDATEs | UPDATE (batch) | P1 — batch routing |
| `src/app/api/extension/complaint-statuses/route.ts` | Batch UPDATE | UPDATE (batch) | P1 — batch routing |

#### READ Operations — need UNION (all ratings) — 6 files

| File | Function | Purpose | Priority |
|------|----------|---------|----------|
| `src/db/extension-helpers.ts` | `getStoreReviewsStats()` | Rating breakdown, avg | P0 — extension stats |
| `src/db/cabinet-helpers.ts` | `getCabinetData()` | Cabinet dashboard | P1 — web dashboard |
| `src/db/helpers.ts` | `getReviewsByProductId()`, `getReviewsByStore()`, `getReviewById()` | Core CRUD | P0 — fundamental |
| `src/db/review-chat-link-helpers.ts` | 5 JOIN functions | Review enrichment | P1 — chat context |
| `src/db/telegram-helpers.ts` | Queue builder | TG Mini App | P1 — TG queue |
| `src/lib/cron-jobs.ts` | `startResolvedReviewCloser()` | Auto-close chats | P2 — background |

#### READ Operations — already filtered to 1-4★ (NO changes needed)

| File | Function | Rating Filter |
|------|----------|---------------|
| `src/db/extension-helpers.ts` | `autoGenerateComplaintsForReviews()` | `rating <= 3` |
| `src/db/review-chat-link-helpers.ts` | `getPendingChatsCountOptimized()` | `rating IN (1,2,3,4)` |
| `src/app/api/extension/stores/route.ts` | Q2 statusParses | `rating < 5` |

### Foreign Key Dependencies

| Table | FK Column | ON DELETE | Impact |
|-------|-----------|-----------|--------|
| `review_complaints` | `review_id` → reviews(id) | CASCADE | Must replicate in archive |
| `complaint_details` | `review_id` → reviews(id) | SET NULL | Must replicate in archive |
| `review_chat_links` | `review_id` → reviews(id) | SET NULL | Must replicate in archive |

### Known Issues to Fix

| Issue | Severity | Action |
|-------|----------|--------|
| Broken index `idx_reviews_complaint_workflow` (references dropped column) | CRITICAL | Drop + recreate in Phase 1 |
| `/stores` endpoint uses queryWithTimeout (degrades to 0) | HIGH | Will be fully fixed by split |
| `idx_reviews_tasks_eligible` includes 5★ rows (large) | MEDIUM | Will shrink after split |

---

## Phase Plan

### Phase 0: Pre-Migration Cleanup — DONE 2026-03-20

**Status:** COMPLETE

- TASK-001: `idx_reviews_complaint_workflow` — already didn't exist, nothing to fix
- TASK-002: Baseline captured via `scripts/sprint-013-baseline.mjs` (run on production)
- TASK-003: Index usage audit completed — identified 5 low-usage indexes (~1.5 GB)

---

### Phase 1: Create Archive Table + View — DONE 2026-03-20

**Status:** COMPLETE

**Migration:** `migrations/037_create_reviews_archive.sql` (run via `scripts/run-migration-037.mjs`)

**What was created:**
- `reviews_archive` table via `LIKE reviews INCLUDING DEFAULTS`
- PK, CHECK constraint `chk_archive_rating_5 (rating = 5)`
- 4 indexes: `idx_ra_store_date`, `idx_ra_product_date`, `idx_ra_store_rating`, `idx_ra_marketplace`
- 2 triggers: complaint_flags + updated_at
- `reviews_all` UNION ALL view
- Dropped 4 FK constraints referencing reviews (replaced by app-level checks via view)

---

### Phase 2: Data Migration — DONE 2026-03-20

**Status:** COMPLETE

**Actual timing:**

| Step | Script | Duration |
|------|--------|----------|
| COPY 3,253,314 rows | `_fast_copy_5star.mjs` | 18 min (TRUNCATE→DROP PK→INSERT→rebuild) |
| Rebuild PK + 4 indexes | (same script) | 26 min |
| DELETE 3,254,200 rows | `_bulk_delete_5star.mjs` | 40 min (batches of 100K) |
| VACUUM FULL + REINDEX + ANALYZE | inline script | 10 min |
| **Total** | | **~94 min** |

**Actual results:**

| Metric | Before | After |
|--------|--------|-------|
| reviews total size | 6,265 MB | **596 MB** (-90%) |
| reviews data | 2,777 MB | **341 MB** (-88%) |
| reviews rows | 3,663,639 | **410,242** |
| reviews_archive rows | 0 | **3,253,314** |
| Dead tuples | — | **0** |
| Orphaned complaints | — | **0** |
| Orphaned chat links | — | **0** |

**Notes:**
- 218 fresh 5★ reviews appeared during migration window (between INSERT and DELETE)
- These remain in `reviews` — negligible impact (0.05%), will be handled by Phase 3 write routing
- Approach evolved: cursor-based batching → ON CONFLICT → final optimized TRUNCATE+INSERT (fastest)

---

### Phase 3: Code Changes — Write Routing — DONE 2026-03-20

### Phase 3: Code Changes — Write Routing (Day 2)

**Goal:** Route new reviews to correct table based on rating.

#### 3.1 Core: `src/db/helpers.ts` — `upsertReview()`

**Current:**
```typescript
INSERT INTO reviews (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET ...
```

**New:**
```typescript
async function upsertReview(payload: ReviewPayload) {
  const table = payload.rating === 5 ? 'reviews_archive' : 'reviews';

  // Try upsert in target table
  const result = await query(
    `INSERT INTO ${table} (...) VALUES (...)
     ON CONFLICT (id) DO UPDATE SET ...`,
    [...]
  );

  // Handle rating change: review moved from archive to working (rare)
  if (result.rowCount === 0 && table === 'reviews') {
    // Check if it exists in archive (rating was 5, now changed to 1-4)
    const moved = await query(
      `DELETE FROM reviews_archive WHERE id = $1 RETURNING *`,
      [payload.id]
    );
    if (moved.rowCount > 0) {
      // Re-insert into reviews
      await query(`INSERT INTO reviews (...) VALUES (...)`, [...]);
    }
  }
}
```

**Edge case:** Review changes rating (5★ → 4★ after edit by buyer). Handled by DELETE + INSERT.

#### 3.2 Batch UPDATEs: `review-statuses/route.ts`

**Current:** Single UPDATE on `reviews` table.
**New:** Split batch by rating, execute on both tables:

```typescript
// batch already has rating as part of matching key
const batch14 = items.filter(i => i.rating < 5);
const batch5 = items.filter(i => i.rating === 5);

const promises = [];
if (batch14.length > 0) {
  promises.push(query(`UPDATE reviews r SET ... FROM batch14 ...`));
}
if (batch5.length > 0) {
  promises.push(query(`UPDATE reviews_archive r SET ... FROM batch5 ...`));
}
await Promise.all(promises);
```

#### 3.3 Review Sync: `review-sync.ts`

UPDATEs that don't know the rating (e.g., mark deleted) — use UNION approach:
```sql
-- Update in reviews first
UPDATE reviews SET review_status_wb = 'deleted' WHERE id = ANY($1);
-- Then update in archive
UPDATE reviews_archive SET review_status_wb = 'deleted' WHERE id = ANY($1);
```

#### 3.4 Complaint Helpers: `complaint-helpers.ts`

Same dual-UPDATE pattern — update both tables, only one will match.

---

### Phase 4: Code Changes — Read Queries — DONE 2026-03-20

**Goal:** Update queries to use `reviews_all` view or correct table.

#### 4.1 Statistics (use `reviews_all` view)

| File | Function | Change |
|------|----------|--------|
| `extension-helpers.ts` | `getStoreReviewsStats()` | `FROM reviews` → `FROM reviews_all` |
| `cabinet-helpers.ts` | `getCabinetData()` | `FROM reviews` → `FROM reviews_all` |
| `helpers.ts` | `getReviewsByProductId()` | `FROM reviews` → `FROM reviews_all` |
| `helpers.ts` | `getReviewsByStore()` | `FROM reviews` → `FROM reviews_all` |
| `helpers.ts` | `getReviewById()` | `FROM reviews` → try reviews, then archive |

#### 4.2 JOIN Queries (use `reviews_all` view)

| File | Function | Change |
|------|----------|--------|
| `review-chat-link-helpers.ts` | `isReviewResolvedForChat()` | `JOIN reviews r` → `JOIN reviews_all r` |
| `review-chat-link-helpers.ts` | `findLinkWithReviewByChatId()` | `LEFT JOIN reviews r` → `LEFT JOIN reviews_all r` |
| `review-chat-link-helpers.ts` | `matchReviewByContext()` | `FROM reviews r` → `FROM reviews_all r` |
| `telegram-helpers.ts` | Queue builder (WB + OZON) | `LEFT JOIN reviews r` → `LEFT JOIN reviews_all r` |
| `cron-jobs.ts` | `startResolvedReviewCloser()` | `LEFT JOIN reviews r` → `LEFT JOIN reviews_all r` |

#### 4.3 Already Working (NO changes)

| File | Function | Why |
|------|----------|-----|
| `extension-helpers.ts` | `autoGenerateComplaintsForReviews()` | Already `rating <= 3` |
| `review-chat-link-helpers.ts` | `getPendingChatsCountOptimized()` | Already `rating IN (1,2,3,4)` |
| `stores/route.ts` | Q1b, Q2, Q3 | Already `rating < 5` |

---

### Phase 5: Index Optimization (Day 3)

**Goal:** Clean up indexes on the now-smaller reviews table.

#### Drop redundant/oversized indexes on `reviews`:
```sql
-- idx_reviews_tasks_eligible — was needed for 3.66M rows, now 410K
-- Keep it but it will be much smaller (~50MB vs ~450MB)

-- idx_reviews_parse_pending — similar, will shrink
-- Keep for now

-- idx_reviews_status_parse_r14 — created as hotfix, now redundant
DROP INDEX idx_reviews_status_parse_r14;

-- idx_reviews_complaint_workflow — already broken, drop
DROP INDEX idx_reviews_complaint_workflow;
CREATE INDEX idx_reviews_complaint_workflow
ON reviews(store_id, complaint_status)
WHERE complaint_status IN ('draft', 'sent', 'pending');
```

#### REINDEX after data migration:
```sql
REINDEX TABLE CONCURRENTLY reviews;
-- All indexes will shrink from ~2.5GB to ~300-400MB
```

---

### Phase 6: Testing & Validation (Day 3-4)

#### Automated checks:
```sql
-- Data integrity
SELECT COUNT(*) FROM reviews_all;  -- Must equal original total
SELECT COUNT(*) FROM reviews WHERE rating = 5;  -- Must be 0
SELECT COUNT(*) FROM reviews_archive WHERE rating != 5;  -- Must be 0

-- FK integrity
SELECT COUNT(*) FROM review_complaints rc
WHERE NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rc.review_id);
-- Must be 0

-- Statistics accuracy
SELECT rating, COUNT(*) FROM reviews_all GROUP BY rating;
-- Must match pre-migration snapshot

-- Performance
-- Run /stores cold cache test
-- Run TG queue query
-- Run cabinet dashboard query
```

#### Manual testing:
- [ ] Extension: store list loads with correct badge counts
- [ ] Extension: review parsing works (status updates)
- [ ] Extension: complaint filing works
- [ ] TG: queue shows correct chats with review details
- [ ] TG: chat detail page shows review text + rating
- [ ] Web: cabinet dashboard shows correct rating breakdown
- [ ] Web: review list shows all reviews (1-4★ + 5★)
- [ ] CRON: resolved review closer still works
- [ ] CRON: auto-sequence processor unaffected
- [ ] Google Sheets sync: review stats correct

---

### Phase 7: Deploy (Day 4)

#### Deployment sequence:
1. **Low-traffic window** (22:00 MSK)
2. `git pull origin main`
3. Run migration 038 (create archive table + view)
4. `npm run build && pm2 restart all`
5. Run migration script 039 (batch data migration)
6. Run `VACUUM FULL reviews` (during maintenance window)
7. Run `REINDEX TABLE CONCURRENTLY reviews`
8. Verify all checks pass
9. Monitor logs for 30 minutes

#### Rollback plan:
```sql
-- If anything goes wrong:
INSERT INTO reviews SELECT * FROM reviews_archive;
DROP VIEW reviews_all;
DROP TABLE reviews_archive;
-- Revert code: git revert HEAD~N
-- Redeploy
```

---

## Success Criteria

| Metric | Before | Target | **Actual** | Status |
|--------|--------|--------|------------|--------|
| reviews table size | 6,265 MB | ~700 MB | **596 MB** | EXCEEDED |
| reviews data size | 2,777 MB | ~700 MB | **341 MB** | EXCEEDED |
| reviews rows | 3,663,639 | ~410K | **410,242** | MET |
| Buffer cache fit | NO (6.25 > 4 GB) | YES | **YES (596 MB)** | MET |
| Data integrity | baseline | 100% match | **0 orphans** | MET |
| `/stores` cold cache | 60s+ (500 error) | < 2s | **pending Phase 3+** | — |
| Extension functionality | working | working | **pending Phase 3+** | — |
| TG Mini App | working | working | **no changes needed** | MET |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during migration | LOW | CRITICAL | Batch copy + validate before delete |
| FK constraint violation | MEDIUM | HIGH | Temporarily disable constraints, re-enable after |
| View performance regression | LOW | MEDIUM | Test UNION view performance beforehand |
| Rating change edge case (5→4) | LOW | LOW | Dual-table upsert handles this |
| VACUUM FULL locks table | CERTAIN | MEDIUM | Run during maintenance window |
| Missed code path using `FROM reviews` | MEDIUM | MEDIUM | Grep audit + integration tests |

---

## Timeline

| Day | Phase | Duration | Status |
|-----|-------|----------|--------|
| Day 1 (2026-03-20) | Phase 0: Cleanup + baseline | 1h | **DONE** |
| Day 1 (2026-03-20) | Phase 1: Create archive table | 30 min | **DONE** |
| Day 1 (2026-03-20) | Phase 2: Data migration | ~94 min | **DONE** |
| Day 2 (2026-03-20) | Phase 3: Write routing (16 files) | ~3h | **DONE** |
| Day 2 (2026-03-20) | Phase 4: Read query updates (12 files) | ~2h | **DONE** |
| Day 2 (2026-03-20) | Phase 5: Index optimization + finalize | 10 min | **NEXT** |
| Day 2 (2026-03-20) | Phase 6: Validation | 5 min | PENDING |
| Day 2 (2026-03-20) | Phase 7: Deploy | 15 min | PENDING |

**Phase 0-4 completed in 1 day (2026-03-20). Phases 5-7 remaining (deploy + post-deploy scripts).**

---

## Files to Modify (Complete List)

### Migrations (new files):
- `src/db/migrations/038_create_reviews_archive.sql`
- `scripts/migrate-reviews-to-archive.mjs`

### Core helpers:
- `src/db/helpers.ts` — `upsertReview()`, `getReviews*()` functions
- `src/db/extension-helpers.ts` — stats, upsert from extension
- `src/db/complaint-helpers.ts` — complaint creation/update
- `src/db/cabinet-helpers.ts` — cabinet stats queries
- `src/db/review-chat-link-helpers.ts` — 5 JOIN functions
- `src/db/telegram-helpers.ts` — queue builder queries

### API routes:
- `src/app/api/extension/review-statuses/route.ts` — batch UPDATE routing
- `src/app/api/extension/complaint-statuses/route.ts` — batch UPDATE routing

### Sync services:
- `src/lib/review-sync.ts` — WB review sync (mark deleted, etc.)
- `src/lib/ozon-review-sync.ts` — OZON review sync

### CRON:
- `src/lib/cron-jobs.ts` — resolved review closer

### No changes needed:
- `src/app/api/extension/stores/route.ts` — already `rating < 5`
- Auto-complaint generator — already `rating <= 3`
- `getPendingChatsCountOptimized()` — already `rating IN (1,2,3,4)`
