# Sprint-013 Backlog

## Phase 0: Pre-Migration Cleanup

### TASK-001: Fix broken index `idx_reviews_complaint_workflow`
**Priority:** P0 — blocking
**Effort:** 30 min
**Risk:** LOW

**Problem:**
Migration 029 дропнула колонку `complaint_generated_at`, но индекс `idx_reviews_complaint_workflow` всё ещё ссылается на неё. Индекс невалидный, PostgreSQL его не использует.

**Steps:**
1. Проверить состояние индекса на проде:
   ```sql
   SELECT indexrelid::regclass, indisvalid
   FROM pg_index
   WHERE indexrelid::regclass::text = 'idx_reviews_complaint_workflow';
   ```
2. Дропнуть сломанный индекс:
   ```sql
   DROP INDEX IF EXISTS idx_reviews_complaint_workflow;
   ```
3. Создать исправленный (без `complaint_generated_at`):
   ```sql
   CREATE INDEX CONCURRENTLY idx_reviews_complaint_workflow
   ON reviews(store_id, complaint_status)
   WHERE complaint_status IN ('draft', 'sent', 'pending');
   ```
4. Проверить `indisvalid = true`

**Validation:**
- `SELECT indisvalid FROM pg_index WHERE indexrelid::regclass::text = 'idx_reviews_complaint_workflow';` → `true`

**File:** `src/db/migrations/037_fix_complaint_workflow_index.sql`

---

### TASK-002: Baseline measurements (pre-migration snapshot)
**Priority:** P0 — blocking
**Effort:** 30 min
**Risk:** LOW

**Purpose:** Зафиксировать текущее состояние для сравнения после миграции.

**Script:** `scripts/sprint-013-baseline.mjs`

**Measurements to capture:**

1. **Row counts:**
   ```sql
   SELECT rating, COUNT(*) as cnt FROM reviews GROUP BY rating ORDER BY rating;
   SELECT COUNT(*) as total FROM reviews;
   SELECT COUNT(*) FROM review_complaints;
   SELECT COUNT(*) FROM review_chat_links;
   SELECT COUNT(*) FROM complaint_details;
   ```

2. **Table & index sizes:**
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('reviews')) as total_with_indexes;
   SELECT pg_size_pretty(pg_relation_size('reviews')) as table_only;
   SELECT pg_size_pretty(pg_indexes_size('reviews')) as indexes_only;

   SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size
   FROM pg_indexes WHERE tablename = 'reviews'
   ORDER BY pg_relation_size(indexname::regclass) DESC;
   ```

3. **Buffer cache hit ratio:**
   ```sql
   SELECT
     sum(heap_blks_read) as heap_read,
     sum(heap_blks_hit) as heap_hit,
     ROUND(sum(heap_blks_hit) / GREATEST(sum(heap_blks_hit) + sum(heap_blks_read), 1) * 100, 2) as hit_ratio_pct
   FROM pg_statio_user_tables
   WHERE relname = 'reviews';
   ```

4. **Query benchmarks (cold cache):**
   - `/api/extension/stores` — time + HTTP status
   - TG queue query (1 store) — execution time
   - Cabinet stats query (1 store) — execution time
   - `getStoreReviewsStats()` (1 store) — execution time

5. **FK dependency check:**
   ```sql
   -- Orphaned review_complaints (review_id not in reviews)
   SELECT COUNT(*) FROM review_complaints rc
   WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.id = rc.review_id);

   -- Orphaned review_chat_links
   SELECT COUNT(*) FROM review_chat_links rcl
   WHERE rcl.review_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.id = rcl.review_id);

   -- Orphaned complaint_details
   SELECT COUNT(*) FROM complaint_details cd
   WHERE cd.review_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.id = cd.review_id);
   ```

**Output:** Сохранить результаты в `docs/sprints/Sprint-013-Reviews-Table-Split/baseline-snapshot.json`

**Validation:**
- Все FK-проверки возвращают 0 orphans
- Snapshot файл создан с полными данными

---

### TASK-003: Audit index usage statistics
**Priority:** P1 — informational
**Effort:** 15 min
**Risk:** LOW

**Purpose:** Определить неиспользуемые индексы для удаления после миграции.

```sql
SELECT
  indexrelname as index_name,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  idx_tup_read as rows_read,
  idx_tup_fetch as rows_fetched
FROM pg_stat_user_indexes
WHERE relname = 'reviews'
ORDER BY idx_scan ASC;
```

**Decision criteria:**
- `idx_scan = 0` → кандидат на удаление
- `idx_scan < 10` за последние N дней → кандидат на удаление
- Broken indexes → удалить безусловно

**Output:** Список индексов для удаления/сохранения в BACKLOG notes.

---

## Phase 1: Create Archive Infrastructure

### TASK-004: Write migration `038_create_reviews_archive.sql`
**Priority:** P0 — blocking
**Effort:** 1h
**Risk:** LOW (только создание новых объектов)

**File:** `src/db/migrations/038_create_reviews_archive.sql`

**SQL содержимое:**

```sql
-- ============================================================
-- Migration 038: Create reviews_archive table + reviews_all view
-- Sprint-013: Reviews Table Split
-- Date: 2026-03-20
-- ============================================================

-- 1. Create archive table with IDENTICAL schema
CREATE TABLE IF NOT EXISTS reviews_archive (
  -- Copy ALL columns from reviews (same types, same defaults)
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  marketplace TEXT NOT NULL DEFAULT 'wb',
  rating INTEGER NOT NULL,
  text TEXT NOT NULL,
  pros TEXT,
  cons TEXT,
  author TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  answer JSONB,
  photo_links JSONB,
  video JSONB,
  supplier_feedback_valuation INTEGER,
  supplier_product_valuation INTEGER,
  complaint_text TEXT,
  complaint_sent_date TIMESTAMPTZ,
  complaint_filed_by TEXT,
  complaint_filed_date DATE,
  draft_reply TEXT,
  is_product_active BOOLEAN NOT NULL DEFAULT TRUE,
  has_answer BOOLEAN NOT NULL DEFAULT FALSE,
  has_complaint BOOLEAN NOT NULL DEFAULT FALSE,
  has_complaint_draft BOOLEAN NOT NULL DEFAULT FALSE,
  review_status_wb TEXT NOT NULL DEFAULT 'unknown',
  product_status_by_review TEXT NOT NULL DEFAULT 'unknown',
  chat_status_by_review TEXT NOT NULL DEFAULT 'unknown',
  complaint_status TEXT NOT NULL DEFAULT 'not_sent',
  purchase_date TIMESTAMPTZ,
  parsed_at TIMESTAMPTZ,
  page_number INTEGER,
  deleted_from_wb_at TIMESTAMPTZ,
  rating_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  ozon_review_status TEXT,
  ozon_order_status TEXT,
  is_rating_participant BOOLEAN,
  likes_amount INTEGER,
  dislikes_amount INTEGER,
  ozon_sku TEXT,
  ozon_comment_id TEXT,
  ozon_comments_amount INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes (минимальный набор для archive — только статистика и lookup)
CREATE INDEX IF NOT EXISTS idx_ra_store_date
  ON reviews_archive(store_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ra_product_date
  ON reviews_archive(product_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ra_store_rating
  ON reviews_archive(store_id, rating, date DESC);

CREATE INDEX IF NOT EXISTS idx_ra_id_store
  ON reviews_archive(id, store_id);

-- 3. Trigger for denormalized complaint flags (same as reviews)
CREATE TRIGGER update_reviews_archive_complaint_flags
  BEFORE INSERT OR UPDATE OF complaint_status, complaint_text, complaint_sent_date
  ON reviews_archive
  FOR EACH ROW
  EXECUTE FUNCTION update_review_complaint_flags();

-- 4. UNION view for queries needing ALL reviews
CREATE OR REPLACE VIEW reviews_all AS
  SELECT * FROM reviews
  UNION ALL
  SELECT * FROM reviews_archive;

-- 5. CHECK constraint to enforce invariant
ALTER TABLE reviews_archive
  ADD CONSTRAINT chk_archive_rating_5 CHECK (rating = 5);

-- Inverse constraint on reviews (after data migration)
-- Will be added in migration 039 AFTER moving data
```

**Validation after running:**
- `SELECT COUNT(*) FROM reviews_archive;` → 0
- `SELECT * FROM reviews_all LIMIT 1;` → returns a review
- `SELECT COUNT(*) FROM reviews_all;` = `SELECT COUNT(*) FROM reviews;`
- Trigger test: `INSERT INTO reviews_archive (id, product_id, store_id, owner_id, rating, text, author, date, complaint_status) VALUES ('test_archive_1', 'p1', 's1', 'u1', 5, 'test', 'author', NOW(), 'draft') RETURNING has_complaint_draft;` → `true`
- Clean up: `DELETE FROM reviews_archive WHERE id = 'test_archive_1';`

**Rollback:**
```sql
DROP VIEW IF EXISTS reviews_all;
DROP TABLE IF EXISTS reviews_archive;
```

---

### TASK-005: Write data migration script `migrate-reviews-to-archive.mjs`
**Priority:** P0 — blocking
**Effort:** 2h
**Risk:** MEDIUM (moves production data)

**File:** `scripts/migrate-reviews-to-archive.mjs`

**Architecture:**
```
1. Connect to DB (POSTGRES_* env vars)
2. Get total 5★ count
3. Disable FK constraints temporarily
4. COPY in batches of 100,000:
   a. INSERT INTO reviews_archive SELECT * FROM reviews WHERE rating = 5 AND id > $last_id ORDER BY id LIMIT 100000
   b. Log progress: "Copied 100000/3250000 (3.1%)"
   c. Track last_id for cursor-based pagination
5. Validate count: reviews_archive = original 5★ count
6. DELETE in batches of 100,000:
   a. DELETE FROM reviews WHERE rating = 5 AND id IN (SELECT id FROM reviews WHERE rating = 5 ORDER BY id LIMIT 100000)
   b. Log progress: "Deleted 100000/3250000 (3.1%)"
7. Validate: reviews WHERE rating = 5 → 0
8. Re-enable FK constraints
9. Print summary
```

**Key design decisions:**
- **Cursor-based pagination** (`id > $last_id` ORDER BY id) — не OFFSET (OFFSET медленный на больших таблицах)
- **Batch size 100,000** — баланс между скоростью и lock duration
- **Separate COPY + DELETE** (не INSERT...DELETE в одном запросе) — можно валидировать между шагами
- **No VACUUM FULL in script** — запускается отдельно вручную (блокирующая операция)
- **Dry-run mode** — `--dry-run` флаг для тестирования без записи

**Batch copy SQL:**
```sql
INSERT INTO reviews_archive
SELECT * FROM reviews
WHERE rating = 5 AND id > $1
ORDER BY id
LIMIT 100000
RETURNING id;
```

**Batch delete SQL:**
```sql
DELETE FROM reviews
WHERE id IN (
  SELECT id FROM reviews
  WHERE rating = 5
  ORDER BY id
  LIMIT 100000
)
RETURNING id;
```

**Progress output format:**
```
[Phase: COPY] 100,000 / 3,249,842 (3.1%) — elapsed: 12s
[Phase: COPY] 200,000 / 3,249,842 (6.2%) — elapsed: 24s
...
[Phase: COPY] COMPLETE — 3,249,842 rows copied in 312s

[Phase: VALIDATE-COPY]
  reviews_archive count: 3,249,842 ✅
  reviews 5★ count: 3,249,842 (will be deleted)

[Phase: DELETE] 100,000 / 3,249,842 (3.1%) — elapsed: 8s
...
[Phase: DELETE] COMPLETE — 3,249,842 rows deleted in 245s

[Phase: VALIDATE-DELETE]
  reviews 5★ count: 0 ✅
  reviews total: 409,577 ✅
  reviews_archive total: 3,249,842 ✅
  Combined: 3,659,419 = original 3,659,419 ✅

[DONE] Migration completed in 557s
Run VACUUM FULL reviews; manually during maintenance window.
```

**Safety checks:**
- Перед стартом: `SELECT COUNT(*) FROM reviews_archive;` must be 0
- Если archive не пустой — abort с сообщением
- Если `--force` — очистить archive перед стартом
- После COPY: count validation
- После DELETE: count validation + `MIN(rating), MAX(rating)` check

**Rollback (в случае ошибки mid-migration):**
```sql
-- Если COPY прошёл, но DELETE не завершён — данные в обоих таблицах, это ОК.
-- Повторный запуск скрипта проверит WHERE rating = 5 AND id > last_id.

-- Полный rollback:
INSERT INTO reviews SELECT * FROM reviews_archive
  ON CONFLICT (id) DO NOTHING;
TRUNCATE reviews_archive;
```

**CLI usage:**
```bash
POSTGRES_HOST=... node scripts/migrate-reviews-to-archive.mjs
POSTGRES_HOST=... node scripts/migrate-reviews-to-archive.mjs --dry-run
POSTGRES_HOST=... node scripts/migrate-reviews-to-archive.mjs --batch-size=50000
```

**Validation after full run:**
```sql
SELECT COUNT(*) FROM reviews;                          -- ~410K
SELECT COUNT(*) FROM reviews_archive;                  -- ~3.25M
SELECT COUNT(*) FROM reviews_all;                      -- ~3.66M (original)
SELECT COUNT(*) FROM reviews WHERE rating = 5;         -- 0
SELECT COUNT(*) FROM reviews_archive WHERE rating != 5; -- 0
SELECT MIN(rating), MAX(rating) FROM reviews;          -- 1, 4
SELECT MIN(rating), MAX(rating) FROM reviews_archive;  -- 5, 5
```

---

### TASK-006: Handle FK constraints during migration
**Priority:** P0 — blocking (part of TASK-005)
**Effort:** 30 min
**Risk:** MEDIUM

**Problem:**
`review_complaints.review_id` имеет FK → `reviews(id)` с `ON DELETE CASCADE`. При DELETE 5★ из reviews, каскадно удалятся complaint записи.

Но 5★ отзывы НЕ должны иметь complaints (жалобы только для 1-4★). Нужно проверить.

**Pre-migration check:**
```sql
-- Есть ли complaints на 5★ отзывы?
SELECT COUNT(*)
FROM review_complaints rc
JOIN reviews r ON rc.review_id = r.id
WHERE r.rating = 5;
```

**Scenarios:**
- **Count = 0** → безопасно удалять, FK CASCADE ничего не тронет
- **Count > 0** → нужно перенести эти complaints или дропнуть FK перед миграцией

**If complaints exist on 5★ (unlikely but handle):**
1. Перед DELETE: временно дропнуть FK constraint
   ```sql
   ALTER TABLE review_complaints DROP CONSTRAINT review_complaints_review_id_fkey;
   ```
2. Выполнить миграцию (COPY + DELETE)
3. Пересоздать FK, но теперь без прямого REFERENCES (trigger-based)

**FK strategy after split:**

Текущее:
```
review_complaints.review_id → reviews(id) ON DELETE CASCADE
complaint_details.review_id → reviews(id) ON DELETE SET NULL
review_chat_links.review_id → reviews(id) ON DELETE SET NULL
```

После split — **убрать FK constraints, заменить на application-level проверки:**
```sql
-- Drop FKs (they can't reference two tables)
ALTER TABLE review_complaints DROP CONSTRAINT review_complaints_review_id_fkey;
ALTER TABLE complaint_details DROP CONSTRAINT IF EXISTS complaint_details_review_id_fkey;
ALTER TABLE review_chat_links DROP CONSTRAINT IF EXISTS review_chat_links_review_id_fkey;

-- Application-level: helpers.ts проверяет review_id в обоих таблицах
```

**Rationale:** PostgreSQL FK не может ссылаться на две таблицы одновременно. Application-level проверка через `reviews_all` view обеспечивает ту же гарантию.

**Validation:**
```sql
-- После миграции: проверить что все review_id в complaints существуют
SELECT COUNT(*) FROM review_complaints rc
WHERE NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rc.review_id);
-- Must be 0
```

---

### TASK-007: Add CHECK constraint on reviews after migration
**Priority:** P1 — safety net
**Effort:** 15 min
**Risk:** LOW

**Purpose:** Предотвратить вставку 5★ в reviews после миграции.

**SQL (in migration 039 or after data migration):**
```sql
-- Enforce: reviews table only has rating 1-4
ALTER TABLE reviews
  ADD CONSTRAINT chk_reviews_rating_1_4 CHECK (rating < 5);
```

**When to apply:** ПОСЛЕ полного удаления 5★ из reviews. Иначе constraint violation.

**Rollback:**
```sql
ALTER TABLE reviews DROP CONSTRAINT chk_reviews_rating_1_4;
```

---

### TASK-008: Post-migration VACUUM + REINDEX
**Priority:** P0 — performance
**Effort:** 30 min (wait time)
**Risk:** LOW (но VACUUM FULL блокирует таблицу)

**Steps:**

1. **VACUUM FULL reviews** (reclaim disk space):
   ```sql
   VACUUM FULL reviews;
   ```
   - **Blocking:** YES — таблица заблокирована для reads/writes
   - **Estimated time:** 2-5 min (410K rows, ~700MB)
   - **When:** Maintenance window (22:00-06:00 MSK)

2. **REINDEX** (rebuild all indexes on smaller table):
   ```sql
   REINDEX TABLE CONCURRENTLY reviews;
   ```
   - **Blocking:** NO (CONCURRENTLY)
   - **Estimated time:** 5-10 min

3. **ANALYZE** (update query planner statistics):
   ```sql
   ANALYZE reviews;
   ANALYZE reviews_archive;
   ```

4. **Drop hotfix index** (no longer needed after split):
   ```sql
   DROP INDEX IF EXISTS idx_reviews_status_parse_r14;
   ```

5. **Verify new sizes:**
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('reviews')) as reviews_total;
   SELECT pg_size_pretty(pg_total_relation_size('reviews_archive')) as archive_total;
   SELECT pg_size_pretty(pg_indexes_size('reviews')) as reviews_indexes;
   ```

**Expected results:**
| Metric | Before | After |
|--------|--------|-------|
| reviews table | 6.25 GB | ~700 MB |
| reviews indexes | ~2.5 GB | ~300 MB |
| reviews_archive table | 0 | ~5.5 GB |
| reviews_archive indexes | 0 | ~500 MB |

---

### TASK-009: Post-migration validation script
**Priority:** P0 — blocking
**Effort:** 1h
**Risk:** LOW

**File:** `scripts/sprint-013-validate.mjs`

**Checks:**

1. **Data integrity:**
   ```sql
   -- Total count matches
   SELECT
     (SELECT COUNT(*) FROM reviews) as live,
     (SELECT COUNT(*) FROM reviews_archive) as archive,
     (SELECT COUNT(*) FROM reviews_all) as combined;
   -- combined must equal baseline total

   -- No 5★ in reviews
   SELECT COUNT(*) FROM reviews WHERE rating = 5;
   -- Must be 0

   -- Only 5★ in archive
   SELECT COUNT(*) FROM reviews_archive WHERE rating != 5;
   -- Must be 0

   -- Rating range
   SELECT MIN(rating), MAX(rating) FROM reviews;      -- 1, 4
   SELECT MIN(rating), MAX(rating) FROM reviews_archive; -- 5, 5
   ```

2. **FK integrity:**
   ```sql
   -- No orphaned review_complaints
   SELECT COUNT(*) FROM review_complaints rc
   WHERE NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rc.review_id);
   -- Must be 0

   -- No orphaned review_chat_links
   SELECT COUNT(*) FROM review_chat_links rcl
   WHERE rcl.review_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rcl.review_id);
   -- Must be 0

   -- No orphaned complaint_details
   SELECT COUNT(*) FROM complaint_details cd
   WHERE cd.review_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = cd.review_id);
   -- Must be 0
   ```

3. **Statistics accuracy:**
   ```sql
   -- Per-store rating breakdown via view must match baseline
   SELECT store_id, rating, COUNT(*) FROM reviews_all
   GROUP BY store_id, rating
   ORDER BY store_id, rating;
   ```

4. **Constraint check:**
   ```sql
   -- CHECK constraints active
   SELECT conname, contype FROM pg_constraint
   WHERE conrelid IN ('reviews'::regclass, 'reviews_archive'::regclass);
   ```

5. **Performance benchmarks** (compare to baseline):
   - `/api/extension/stores` cold cache
   - TG queue query
   - Cabinet stats

**Output format:**
```
=== Sprint-013 Post-Migration Validation ===

[DATA INTEGRITY]
  reviews count: 409,577 ✅
  archive count: 3,249,842 ✅
  combined: 3,659,419 = baseline 3,659,419 ✅
  5★ in reviews: 0 ✅
  non-5★ in archive: 0 ✅

[FK INTEGRITY]
  orphaned review_complaints: 0 ✅
  orphaned review_chat_links: 0 ✅
  orphaned complaint_details: 0 ✅

[CONSTRAINTS]
  chk_reviews_rating_1_4: ACTIVE ✅
  chk_archive_rating_5: ACTIVE ✅

[PERFORMANCE]
  /stores cold: 1.2s (baseline: 60s+) ✅
  reviews table size: 680 MB (baseline: 6.25 GB) ✅
  reviews indexes: 290 MB (baseline: 2.5 GB) ✅

ALL CHECKS PASSED ✅
```

---

## Execution Order (Phase 0 → Phase 2)

```
Phase 0 (Day 1 AM):
  TASK-001 Fix broken index ──────────────────┐
  TASK-002 Baseline measurements ─────────────┤
  TASK-003 Audit index usage ─────────────────┘

Phase 1 (Day 1 PM):
  TASK-004 Migration 038 (create archive) ────┐
  TASK-006 FK constraint analysis ────────────┘

Phase 2 (Day 1 EVE, maintenance window):
  TASK-005 Data migration script ─────────────┐
  TASK-007 CHECK constraints ─────────────────┤
  TASK-008 VACUUM + REINDEX ──────────────────┤
  TASK-009 Validation ────────────────────────┘
```

**Dependencies:**
- TASK-004 → TASK-005 (archive table must exist)
- TASK-006 → TASK-005 (FK strategy must be decided before migration)
- TASK-005 → TASK-007 (constraints after data moved)
- TASK-005 → TASK-008 (vacuum after delete)
- All → TASK-009 (validate at the end)
- TASK-002 → TASK-009 (baseline needed for comparison)
