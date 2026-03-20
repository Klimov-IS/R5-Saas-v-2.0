# Sprint-013: Reviews Table Split (reviews + reviews_archive)

**Start Date:** 2026-03-20
**Priority:** P0 — Production performance critical
**Status:** Planning

---

## Problem Statement

Таблица `reviews` содержит 3,659,419 строк (6.25 GB), из которых 88.8% — пятизвёздочные отзывы, которые НИКОГДА не используются в работе (жалобы, чаты, рассылки, автогенерация). Сервер имеет 4 GB RAM — таблица не помещается в буферный кеш PostgreSQL, что вызывает:

- `/api/extension/stores` — 60s+ на холодном кеше (500 error)
- Медленные запросы во всех endpoints, работающих с reviews
- Деградация после каждого рестарта PM2

### Data Analysis

| Rating | Count       | % of Total | Used in Work? |
|--------|-------------|------------|---------------|
| 5★     | 3,249,842   | 88.8%      | NEVER         |
| 4★     | ~150,000    | ~4.1%      | Sometimes     |
| 3★     | ~80,000     | ~2.2%      | Always        |
| 2★     | ~60,000     | ~1.6%      | Always        |
| 1★     | ~120,000    | ~3.3%      | Always        |
| **Total** | **3,659,419** | **100%** |             |

### After Split

| Table           | Rows     | Est. Size | Fits in RAM? |
|-----------------|----------|-----------|--------------|
| reviews (1-4★)  | ~410,000 | ~700 MB   | YES          |
| reviews_archive (5★) | ~3,250,000 | ~5.5 GB | No (not needed) |

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

### Phase 0: Pre-Migration Cleanup (Day 1, morning)

**Goal:** Fix known issues, prepare baseline measurements.

#### Tasks:
1. **Fix broken index** `idx_reviews_complaint_workflow`
   - DROP broken index
   - Recreate without `complaint_generated_at`:
     ```sql
     CREATE INDEX idx_reviews_complaint_workflow
     ON reviews(store_id, complaint_status)
     WHERE complaint_status IN ('draft', 'sent', 'pending');
     ```

2. **Baseline measurements** (run on production):
   - Table sizes: reviews, indexes, total
   - Query benchmarks: /stores cold, /stores warm, TG queue, cabinet
   - Buffer cache hit ratio

3. **Snapshot counts** (for validation after migration):
   ```sql
   SELECT rating, COUNT(*) FROM reviews GROUP BY rating ORDER BY rating;
   SELECT COUNT(*) FROM review_complaints;
   SELECT COUNT(*) FROM review_chat_links;
   ```

---

### Phase 1: Create Archive Table + View (Day 1, afternoon)

**Goal:** Create infrastructure without touching existing data.

#### Migration 038: `038_create_reviews_archive.sql`

```sql
-- 1. Create archive table (identical schema)
CREATE TABLE reviews_archive (LIKE reviews INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

-- 2. Add primary key
ALTER TABLE reviews_archive ADD PRIMARY KEY (id);

-- 3. Create essential indexes (minimal set for archive)
CREATE INDEX idx_reviews_archive_store_date
  ON reviews_archive(store_id, date DESC);
CREATE INDEX idx_reviews_archive_product_date
  ON reviews_archive(product_id, date DESC);
CREATE INDEX idx_reviews_archive_store_rating
  ON reviews_archive(store_id, rating, date DESC);

-- 4. Create UNION view for statistics queries
CREATE OR REPLACE VIEW reviews_all AS
  SELECT * FROM reviews
  UNION ALL
  SELECT * FROM reviews_archive;

-- 5. Add FK constraints on archive (same as reviews)
-- review_complaints: CASCADE
ALTER TABLE review_complaints
  DROP CONSTRAINT IF EXISTS review_complaints_review_id_fkey;
-- Will be replaced with trigger-based routing (see Phase 3)

-- review_chat_links: SET NULL
-- No change needed — review_id can point to either table

-- complaint_details: SET NULL
-- No change needed — review_id can point to either table

-- 6. Replicate trigger for denormalized flags
CREATE TRIGGER update_reviews_archive_complaint_flags
  BEFORE INSERT OR UPDATE OF complaint_status, complaint_text, complaint_sent_date
  ON reviews_archive
  FOR EACH ROW
  EXECUTE FUNCTION update_review_complaint_flags();
```

**Risk:** LOW — creates new objects, doesn't modify existing data.
**Rollback:** `DROP TABLE reviews_archive; DROP VIEW reviews_all;`

---

### Phase 2: Data Migration (Day 1, evening — off-peak)

**Goal:** Move 5★ reviews to archive table.

#### Migration 039: `039_migrate_5star_to_archive.sql`

**Strategy:** Batch migration to avoid locking.

```sql
-- Run during low-traffic window (22:00-06:00 MSK)

-- Step 1: Disable FK constraints temporarily
-- (review_complaints has CASCADE — we need to handle carefully)

-- Step 2: Copy 5★ reviews in batches of 50,000
INSERT INTO reviews_archive
SELECT * FROM reviews
WHERE rating = 5
ORDER BY date DESC
LIMIT 50000
OFFSET 0;
-- ... repeat with increasing OFFSET

-- Step 3: Verify counts match
-- SELECT COUNT(*) FROM reviews WHERE rating = 5;
-- SELECT COUNT(*) FROM reviews_archive;

-- Step 4: Delete 5★ from reviews in batches
DELETE FROM reviews WHERE id IN (
  SELECT id FROM reviews WHERE rating = 5 LIMIT 50000
);
-- ... repeat until done

-- Step 5: VACUUM FULL reviews (reclaim disk space)
-- WARNING: Locks table, run during maintenance window
VACUUM FULL reviews;

-- Step 6: ANALYZE reviews (update statistics)
ANALYZE reviews;
ANALYZE reviews_archive;
```

**Estimated timing:**
- COPY 3.25M rows: ~5-10 minutes
- DELETE 3.25M rows: ~10-20 minutes (batch)
- VACUUM FULL: ~5-15 minutes (locks table)
- Total: ~30-45 minutes

**Script:** `scripts/migrate-reviews-to-archive.mjs` (automated batching + validation)

**Validation after migration:**
```sql
-- Must all pass:
SELECT COUNT(*) FROM reviews;               -- Should be ~410K
SELECT COUNT(*) FROM reviews_archive;       -- Should be ~3.25M
SELECT COUNT(*) FROM reviews_all;           -- Should equal original total
SELECT COUNT(*) FROM reviews WHERE rating = 5; -- Must be 0
SELECT MIN(rating), MAX(rating) FROM reviews;  -- Must be 1, 4
```

**Risk:** MEDIUM — modifies production data, but reversible.
**Rollback:**
```sql
INSERT INTO reviews SELECT * FROM reviews_archive;
DROP TABLE reviews_archive;
```

---

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

### Phase 4: Code Changes — Read Queries (Day 2-3)

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

| Metric | Before | Target | Method |
|--------|--------|--------|--------|
| `/stores` cold cache | 60s+ (500 error) | < 2s (200 OK) | curl timing |
| `/stores` warm cache | ~50ms | ~50ms (no regression) | curl timing |
| reviews table size | 6.25 GB | ~700 MB | pg_total_relation_size |
| reviews index size | ~2.5 GB | ~300 MB | pg_indexes_size |
| Buffer cache fit | NO (6.25 > 4 GB) | YES (700 MB < 4 GB) | pg_buffercache |
| Data integrity | baseline | 100% match | count validation |
| Extension functionality | working | working | manual test |
| TG Mini App | working | working | manual test |

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

| Day | Phase | Duration | Risk |
|-----|-------|----------|------|
| Day 1 AM | Phase 0: Cleanup + baseline | 2h | LOW |
| Day 1 PM | Phase 1: Create archive table | 1h | LOW |
| Day 1 EVE | Phase 2: Data migration | 1h | MEDIUM |
| Day 2 | Phase 3: Write routing | 4h | MEDIUM |
| Day 2-3 | Phase 4: Read query updates | 3h | LOW |
| Day 3 | Phase 5: Index optimization | 1h | LOW |
| Day 3-4 | Phase 6: Testing | 3h | LOW |
| Day 4 | Phase 7: Deploy | 2h | MEDIUM |

**Total estimated: 3-4 days**

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
