# Аудит: Модернизация страницы Stores (Кабинеты)

**Status:** Proposal / Technical Analysis
**Date:** 2026-03-11
**Author:** Claude Code
**Context:** Phase 1 перед реализацией Kanban-доски (Sprint-006)

---

## Executive Summary

**Задача:** Модернизировать текущую страницу списка кабинетов (stores) с новыми прогресс-ориентированными метриками перед преобразованием в Kanban-доску.

**Текущие метрики:**
- 📦 Товары: просто total count
- ⭐ Отзывы: просто total count
- 💬 Чаты: просто total count

**Новые метрики:**
- 📦 Товары: `активные / всего`
- ⭐ Отзывы: `обработанные / всего`
- 💬 Чаты: `открытые / требуемые`
- 🎯 **Этап:** manual stage field (6 значений)

**Ключевое решение:** Кэшировать метрики в `stores` table → обновлять через cron → мгновенная загрузка страницы.

**ETA:** 1 рабочий день (migration + backend + frontend)

---

## 1. Текущая архитектура

### Страница
**File:** `src/app/page.tsx`
**Route:** `/` (главная страница dashboard)

**Функционал:**
- Таблица всех stores с metrics
- Search by name
- Filter by status (active, paused, stopped, trial, archived)
- Sort by: date, name, product count, review count, chat count
- Sync controls (individual + bulk)

### API Endpoint
**File:** `src/app/api/stores/route.ts`
**Method:** `GET /api/stores`

**Response:**
```typescript
{
  id: string;
  name: string;
  marketplace: 'wb' | 'ozon';
  status: StoreStatus;
  product_count: number;          // Computed from products table
  total_reviews: number;          // Cached in stores.total_reviews
  total_chats: number;            // Cached in stores.total_chats
  chat_tag_counts: Record<ChatTag, number>;
  created_at: string;
  updated_at: string;
}[]
```

### DB Helper
**File:** `src/db/helpers.ts`
**Function:** `getStores(ownerId?: string): Promise<Store[]>`

**SQL Logic:**
```sql
WITH product_counts AS (
  SELECT store_id, COUNT(*)::int AS cnt
  FROM products
  GROUP BY store_id
)
SELECT
  s.*,
  COALESCE(pc.cnt, 0) AS product_count,
  COALESCE(s.total_reviews, 0) AS total_reviews,
  COALESCE(s.total_chats, 0) AS total_chats
FROM stores s
LEFT JOIN product_counts pc ON pc.store_id = s.id
ORDER BY s.created_at DESC
```

**Performance:** ~100-200ms на 65 stores (fast)

**Почему быстро:**
- `product_count` через CTE на ~15K products
- `total_reviews`, `total_chats` кэшированы в stores table

---

## 2. Новые метрики: Детальные определения

### 📦 Метрика 1: Товары `активные / всего`

#### **Всего товаров:**
```sql
COUNT(*) FROM products WHERE store_id = X
```
*(существующая логика, без изменений)*

#### **Активные товары:**
```sql
SELECT COUNT(*)
FROM products p
INNER JOIN product_rules pr ON pr.product_id = p.id
WHERE p.store_id = X
  AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
```

**Определение активного товара:**
Товар активен, если по нему разрешена подача жалоб **ИЛИ** работа в чатах.

**Пример:**
- Всего товаров: 45
- Активные: 38
- Display: `📦 Товары: 38 / 45 (84%)`

---

### ⭐ Метрика 2: Отзывы `обработанные / всего`

#### **Всего отзывов к обработке:**

```sql
SELECT COUNT(*)
FROM reviews r
INNER JOIN products p
  ON p.wb_product_id = r.product_nm_id
  AND p.store_id = r.store_id
INNER JOIN product_rules pr ON pr.product_id = p.id
WHERE r.store_id = X
  AND r.rating <= 3  -- негативные отзывы (1-3★)
  AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)  -- товар в работе
  AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')  -- отзыв виден
```

**Логика базового фильтра:**
1. Только негативные отзывы (1-3★)
2. Только по товарам в работе (product_rules разрешает)
3. Только видимые отзывы (не скрытые до нас)

#### **Обработанные отзывы:**

**Для WB:**
```sql
SELECT COUNT(*)
FROM reviews r
INNER JOIN products p ON p.wb_product_id = r.product_nm_id
  AND p.store_id = r.store_id
INNER JOIN product_rules pr ON pr.product_id = p.id
WHERE r.store_id = X
  AND r.rating <= 3
  AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
  AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')
  AND (
    r.complaint_status IS NOT NULL  -- жалоба подана (WB)
    OR EXISTS (
      SELECT 1 FROM review_chat_links rcl
      WHERE rcl.review_id = r.id AND rcl.store_id = r.store_id
    )  -- ИЛИ чат открыт
  )
```

**Для OZON:**
```sql
SELECT COUNT(*)
FROM reviews r
[...same base filters...]
WHERE [базовые фильтры]
  AND EXISTS (
    SELECT 1 FROM review_chat_links rcl
    WHERE rcl.review_id = r.id AND rcl.store_id = r.store_id
  )  -- только через чаты (жалоб на OZON нет)
```

**Определение обработанного отзыва:**
- **WB:** жалоба подана (`complaint_status IS NOT NULL`) ИЛИ чат открыт
- **OZON:** чат открыт (жалоб на отзывы не существует)

**Пример (WB):**
- Всего к обработке: 1,100 отзывов (негативные по активным товарам)
- Обработано: 890 (жалобы поданы / чаты открыты)
- Display: `⭐ Отзывы: 890 / 1,100 (81%)`

---

### 💬 Метрика 3: Чаты `открытые / требуемые`

#### **Требуемые чаты:**

**Формула:**
```
chats_required = total_reviews_to_process - reviews_hidden_via_complaints
```

**Для WB:**
```sql
total_reviews_to_process  -- из метрики "Отзывы всего"
MINUS
(
  SELECT COUNT(*) FROM reviews r
  WHERE [базовые фильтры]
    AND (
      r.complaint_status IN ('approved', 'excluded')
      OR r.product_status IN ('excluded', 'deleted', 'hidden', 'temporarily_hidden')
    )
)
```

**Для OZON:**
```sql
chats_required = total_reviews_to_process
-- (жалоб нет, все негативные отзывы требуют чатов)
```

**Логика скрытых отзывов (WB only):**
- Жалоба удовлетворена (`complaint_status = 'approved'`)
- Жалоба исключена (`complaint_status = 'excluded'`)
- Отзыв скрыт маркетплейсом (`product_status IN (...)`)

#### **Открытые чаты:**

```sql
SELECT COUNT(DISTINCT rcl.chat_id)
FROM review_chat_links rcl
WHERE rcl.store_id = X
```

**Логика:**
Считаем уникальные `chat_id` из `review_chat_links` — только наши review-linked чаты.

**Пример (WB):**
- Всего отзывов: 1,100
- Скрыто через жалобы: 890
- Требуемые чаты: 1,100 - 890 = 210
- Открыто чатов: 210
- Display: `💬 Чаты: 210 / 210 (100%)`

---

### 🎯 Метрика 4: Этап (Stage)

**Новое поле:** `stores.stage VARCHAR(50)`

**Enum значения:**

| Value | Label (RU) | Trigger |
|-------|------------|---------|
| `access_received` | Доступы получены | Credentials added |
| `cabinet_connected` | Кабинет подключён | First successful sync |
| `complaints_submitted` | Жалобы поданы | At least one complaint |
| `chats_opened` | Чаты открыты | At least one chat |
| `monitoring` | Мониторинг | Active work in progress |
| `client_lost` | Клиент потерян | Manual only |

**Управление:**
- **Manual ONLY** — менеджер переставляет этап руками
- Никакой автоматики (на данном этапе)

**UI:**
- Dropdown selector на карточке store
- PATCH /api/stores/:id/stage endpoint
- Permissions: owner/admin/manager (manager только для своих stores)

**Default:**
- Существующие stores: `cabinet_connected`
- Новые stores при onboarding: `access_received`

---

## 3. Performance Impact Analysis

### Текущая производительность ✅

**Query:** `getStores()` на 65 stores
**Time:** ~100-200ms
**Tables:**
- products: ~15K rows (CTE, fast)
- stores: 65 rows (cached metrics, instant)

**Почему быстро:**
- Минимум JOIN'ов
- Кэшированные aggregate metrics

---

### Новая производительность (если считать на лету) ❌

**Problem:** reviews table ~3.2M rows

**Worst case SQL (all on-the-fly):**
```sql
WITH
  product_stats AS (
    SELECT
      p.store_id,
      COUNT(*)::int AS total_products,
      COUNT(*) FILTER (
        WHERE pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE
      ) AS active_products
    FROM products p
    LEFT JOIN product_rules pr ON pr.product_id = p.id
    GROUP BY p.store_id
    -- ✅ Fast: ~15K products
  ),
  review_stats AS (
    SELECT
      r.store_id,
      COUNT(*) FILTER (
        WHERE r.rating <= 3 AND pr.work_in_chats = TRUE
      ) AS total_reviews_to_process,
      COUNT(*) FILTER (
        WHERE r.rating <= 3
          AND (r.complaint_status IS NOT NULL OR rcl.chat_id IS NOT NULL)
      ) AS processed_reviews
    FROM reviews r
    INNER JOIN products p
      ON p.wb_product_id = r.product_nm_id AND p.store_id = r.store_id
    LEFT JOIN product_rules pr ON pr.product_id = p.id
    LEFT JOIN review_chat_links rcl
      ON rcl.review_id = r.id AND rcl.store_id = r.store_id
    GROUP BY r.store_id
    -- ❌ SLOW: 3.2M reviews, complex joins
  ),
  chat_stats AS (
    SELECT
      rcl.store_id,
      COUNT(DISTINCT rcl.chat_id) AS chats_opened
    FROM review_chat_links rcl
    GROUP BY rcl.store_id
    -- ✅ Fast: ~700-1000 rows
  )
SELECT
  s.*,
  ps.total_products,
  ps.active_products,
  rs.total_reviews_to_process,
  rs.processed_reviews,
  cs.chats_opened
FROM stores s
LEFT JOIN product_stats ps ON ps.store_id = s.id
LEFT JOIN review_stats rs ON rs.store_id = s.id
LEFT JOIN chat_stats cs ON cs.store_id = s.id
```

**Expected time:** 2-5 seconds на 65 stores
**Verdict:** ❌ Неприемлемо для UI

---

### Оптимизированная производительность (cached) ✅

**Strategy:** Кэшировать метрики в `stores` table

**Query after optimization:**
```sql
SELECT
  s.id,
  s.name,
  s.marketplace,
  s.status,
  s.stage,                      -- NEW
  s.active_products_count,      -- NEW (cached)
  s.product_count,              -- existing
  s.reviews_to_process,         -- NEW (cached)
  s.reviews_processed,          -- NEW (cached)
  s.chats_required,             -- NEW (cached)
  s.chats_opened,               -- NEW (cached)
  s.metrics_updated_at,         -- NEW
  s.created_at,
  s.updated_at
FROM stores s
WHERE s.status IN ('active', 'trial', 'paused')
ORDER BY s.created_at DESC
```

**Expected time:** ~50-100ms
**Verdict:** ✅ Отлично!

**Trade-off:**
- Метрики обновляются каждые 15-30 минут (не real-time)
- Показываем `metrics_updated_at` на UI
- Опционально: кнопка "Refresh metrics" для manual trigger

---

## 4. Рекомендуемая архитектура

### Схема данных

**Migration 028:** Добавить поля в `stores` table

```sql
ALTER TABLE stores
  ADD COLUMN stage VARCHAR(50) DEFAULT 'cabinet_connected',
  ADD COLUMN active_products_count INT DEFAULT 0,
  ADD COLUMN reviews_to_process INT DEFAULT 0,
  ADD COLUMN reviews_processed INT DEFAULT 0,
  ADD COLUMN chats_required INT DEFAULT 0,
  ADD COLUMN chats_opened INT DEFAULT 0,
  ADD COLUMN metrics_updated_at TIMESTAMP;

-- Index for filtering by stage (future Kanban)
CREATE INDEX idx_stores_stage ON stores(stage) WHERE status IN ('active', 'trial');

-- Set initial stage for existing stores
UPDATE stores
SET stage = 'cabinet_connected'
WHERE status IN ('active', 'trial', 'paused');
```

---

### Backend: Metrics Calculation

**New helper:** `src/db/helpers.ts`

```typescript
/**
 * Recalculates and updates cached metrics for a store
 * Called by cron jobs after product/review/chat sync
 */
export async function updateStoreMetrics(
  storeId: string
): Promise<void> {
  const pool = await getPool();

  // Get store marketplace
  const storeResult = await pool.query(
    'SELECT marketplace FROM stores WHERE id = $1',
    [storeId]
  );
  const marketplace = storeResult.rows[0]?.marketplace;

  // Calculate all metrics in parallel
  const [productStats, reviewStats, chatStats] = await Promise.all([
    calculateProductStats(pool, storeId),
    calculateReviewStats(pool, storeId, marketplace),
    calculateChatStats(pool, storeId, marketplace),
  ]);

  // Update stores table
  await pool.query(`
    UPDATE stores
    SET
      active_products_count = $2,
      reviews_to_process = $3,
      reviews_processed = $4,
      chats_required = $5,
      chats_opened = $6,
      metrics_updated_at = NOW()
    WHERE id = $1
  `, [
    storeId,
    productStats.active,
    reviewStats.total,
    reviewStats.processed,
    chatStats.required,
    chatStats.opened,
  ]);
}

async function calculateProductStats(pool, storeId) {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE
      ) AS active_count
    FROM products p
    LEFT JOIN product_rules pr ON pr.product_id = p.id
    WHERE p.store_id = $1
  `, [storeId]);

  return { active: result.rows[0].active_count };
}

async function calculateReviewStats(pool, storeId, marketplace) {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE r.rating <= 3
          AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
          AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')
      ) AS total_to_process,
      COUNT(*) FILTER (
        WHERE r.rating <= 3
          AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
          AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')
          AND (
            ${marketplace === 'wb' ? 'r.complaint_status IS NOT NULL OR' : ''}
            rcl.chat_id IS NOT NULL
          )
      ) AS processed_count
    FROM reviews r
    INNER JOIN products p
      ON p.wb_product_id = r.product_nm_id AND p.store_id = r.store_id
    LEFT JOIN product_rules pr ON pr.product_id = p.id
    LEFT JOIN review_chat_links rcl
      ON rcl.review_id = r.id AND rcl.store_id = r.store_id
    WHERE r.store_id = $1
  `, [storeId]);

  return {
    total: result.rows[0].total_to_process,
    processed: result.rows[0].processed_count,
  };
}

async function calculateChatStats(pool, storeId, marketplace) {
  // Count opened chats
  const openedResult = await pool.query(`
    SELECT COUNT(DISTINCT rcl.chat_id) AS cnt
    FROM review_chat_links rcl
    WHERE rcl.store_id = $1
  `, [storeId]);

  const opened = openedResult.rows[0].cnt;

  // Calculate required chats
  const requiredResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE r.rating <= 3
          AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
          AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')
      ) AS total_reviews,
      COUNT(*) FILTER (
        WHERE r.rating <= 3
          AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
          AND (
            r.complaint_status IN ('approved', 'excluded')
            OR r.product_status IN ('excluded', 'deleted', 'hidden', 'temporarily_hidden')
          )
      ) AS hidden_via_complaints
    FROM reviews r
    INNER JOIN products p
      ON p.wb_product_id = r.product_nm_id AND p.store_id = r.store_id
    LEFT JOIN product_rules pr ON pr.product_id = p.id
    WHERE r.store_id = $1
  `, [storeId]);

  const totalReviews = requiredResult.rows[0].total_reviews;
  const hiddenViaComplaints = marketplace === 'wb'
    ? requiredResult.rows[0].hidden_via_complaints
    : 0;

  const required = totalReviews - hiddenViaComplaints;

  return { required, opened };
}
```

---

### Cron Integration

**Option 1: Integrate into existing cron jobs**

Modify existing cron endpoints:
- `/api/cron/products/update` → call `updateStoreMetrics(storeId)` after product sync
- `/api/cron/reviews/update` → call `updateStoreMetrics(storeId)` after review sync
- `/api/cron/dialogues/update` → call `updateStoreMetrics(storeId)` after chat sync

**Option 2: Separate dedicated cron**

Create new endpoint:
- **Route:** `/api/cron/stores/metrics`
- **Schedule:** Every 15 minutes
- **Logic:** Loop through active stores, call `updateStoreMetrics()`

**Recommendation:** Option 2 (separate cron)
- Cleaner separation of concerns
- Easier to debug
- Can run independently of sync jobs
- Allows manual trigger via UI button

**Cron config:**
```typescript
// src/lib/cron.ts
export function startStoresMetricsCron() {
  cron.schedule('*/15 * * * *', async () => {  // Every 15 minutes
    console.log('[Cron] Updating stores metrics...');

    const stores = await getStores();
    const activeStores = stores.filter(s =>
      ['active', 'trial', 'paused'].includes(s.status)
    );

    for (const store of activeStores) {
      try {
        await updateStoreMetrics(store.id);
        console.log(`[Cron] Updated metrics for store ${store.name}`);
      } catch (err) {
        console.error(`[Cron] Failed to update metrics for ${store.id}:`, err);
      }
    }

    console.log('[Cron] Stores metrics update completed');
  });
}
```

---

### API Endpoints

#### 1. GET /api/stores (modify existing)

**File:** `src/app/api/stores/route.ts`

**Changes:**
```typescript
// Add new fields to response type
export interface StoreWithMetrics extends Store {
  stage: StoreStage;
  active_products_count: number;
  total_products: number;  // renamed from product_count
  reviews_to_process: number;
  reviews_processed: number;
  chats_required: number;
  chats_opened: number;
  metrics_updated_at: string | null;
}

// Update getStores() query to include new fields
```

#### 2. PATCH /api/stores/:id/stage (new)

**File:** `src/app/api/stores/[storeId]/stage/route.ts`

```typescript
import { verifyAuth } from '@/lib/auth';
import { updateStore } from '@/db/helpers';

export async function PATCH(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Check if user has access to this store (manager role check)

  const { stage } = await req.json();

  const validStages = [
    'access_received',
    'cabinet_connected',
    'complaints_submitted',
    'chats_opened',
    'monitoring',
    'client_lost',
  ];

  if (!validStages.includes(stage)) {
    return Response.json({ error: 'Invalid stage' }, { status: 400 });
  }

  await updateStore(params.storeId, { stage });

  return Response.json({ success: true });
}
```

#### 3. POST /api/stores/:id/refresh-metrics (optional)

**File:** `src/app/api/stores/[storeId]/refresh-metrics/route.ts`

```typescript
import { verifyAuth } from '@/lib/auth';
import { updateStoreMetrics } from '@/db/helpers';

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Trigger immediate metrics recalculation
  await updateStoreMetrics(params.storeId);

  return Response.json({ success: true });
}
```

---

### Frontend UI Changes

**File:** `src/app/page.tsx`

**New store card display:**

```tsx
// Before:
<div className="store-card">
  <h3>{store.name}</h3>
  <div className="metrics">
    <div>📦 Товары: {store.product_count}</div>
    <div>⭐ Отзывы: {store.total_reviews}</div>
    <div>💬 Чаты: {store.total_chats}</div>
  </div>
</div>

// After:
<div className="store-card">
  <h3>{store.name}</h3>

  {/* NEW: Stage selector */}
  <div className="stage">
    <Label>🎯 Этап:</Label>
    <Select value={store.stage} onValueChange={(stage) => handleStageChange(store.id, stage)}>
      <SelectItem value="access_received">Доступы получены</SelectItem>
      <SelectItem value="cabinet_connected">Кабинет подключён</SelectItem>
      <SelectItem value="complaints_submitted">Жалобы поданы</SelectItem>
      <SelectItem value="chats_opened">Чаты открыты</SelectItem>
      <SelectItem value="monitoring">Мониторинг</SelectItem>
      <SelectItem value="client_lost">Клиент потерян</SelectItem>
    </Select>
  </div>

  {/* UPDATED: Progress metrics */}
  <div className="metrics">
    <div className="metric">
      <span>📦 Товары:</span>
      <strong>{store.active_products_count} / {store.total_products}</strong>
      <span className="percentage">
        ({Math.round(store.active_products_count / store.total_products * 100)}%)
      </span>
      {/* Optional: Progress bar */}
      <Progress value={store.active_products_count / store.total_products * 100} />
    </div>

    <div className="metric">
      <span>⭐ Отзывы:</span>
      <strong>{store.reviews_processed} / {store.reviews_to_process}</strong>
      <span className="percentage">
        ({Math.round(store.reviews_processed / store.reviews_to_process * 100)}%)
      </span>
      <Progress value={store.reviews_processed / store.reviews_to_process * 100} />
    </div>

    <div className="metric">
      <span>💬 Чаты:</span>
      <strong>{store.chats_opened} / {store.chats_required}</strong>
      <span className="percentage">
        ({Math.round(store.chats_opened / store.chats_required * 100)}%)
      </span>
      <Progress value={store.chats_opened / store.chats_required * 100} />
    </div>
  </div>

  {/* NEW: Metrics update timestamp */}
  <div className="metrics-timestamp">
    <small>
      Обновлено: {formatDistanceToNow(new Date(store.metrics_updated_at), { locale: ru })}
    </small>
    <Button size="sm" variant="ghost" onClick={() => refreshMetrics(store.id)}>
      <RefreshCw className="h-4 w-4" />
    </Button>
  </div>
</div>
```

**Handlers:**
```typescript
const handleStageChange = async (storeId: string, stage: string) => {
  await fetch(`/api/stores/${storeId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });

  // Invalidate query to refetch stores
  queryClient.invalidateQueries(['stores']);
};

const refreshMetrics = async (storeId: string) => {
  await fetch(`/api/stores/${storeId}/refresh-metrics`, {
    method: 'POST',
  });

  queryClient.invalidateQueries(['stores']);
};
```

---

## 5. Implementation Plan

### Phase 1: Database Migration
**ETA:** 30 minutes

**Tasks:**
1. Create migration 028
2. Add new columns to `stores` table
3. Create index on `stage` column
4. Backfill initial values for existing stores
5. Test migration on dev DB

**Deliverables:**
- `migrations/028_add_stores_metrics.sql`
- Backfill script

---

### Phase 2: Backend Logic
**ETA:** 2-3 hours

**Tasks:**
1. Create `updateStoreMetrics()` helper
2. Create sub-helpers: `calculateProductStats()`, `calculateReviewStats()`, `calculateChatStats()`
3. Add marketplace-specific logic (WB vs OZON)
4. Create cron job `/api/cron/stores/metrics`
5. Integrate cron into `src/lib/cron.ts`
6. Create PATCH `/api/stores/:id/stage` endpoint
7. Create POST `/api/stores/:id/refresh-metrics` endpoint (optional)
8. Update `getStores()` to return new fields
9. Write tests for calculation logic

**Deliverables:**
- Updated `src/db/helpers.ts`
- New `src/app/api/cron/stores/metrics/route.ts`
- New `src/app/api/stores/[storeId]/stage/route.ts`
- New `src/app/api/stores/[storeId]/refresh-metrics/route.ts`
- Updated `src/app/api/stores/route.ts`

---

### Phase 3: Frontend UI
**ETA:** 2 hours

**Tasks:**
1. Update `src/app/page.tsx` store card component
2. Add stage selector dropdown
3. Add progress metrics display (with percentages)
4. Add progress bars (optional, using Shadcn Progress component)
5. Add metrics timestamp + refresh button
6. Update types in `src/types/`
7. Test UI with different data scenarios

**Deliverables:**
- Updated `src/app/page.tsx`
- Updated `src/types/stores.ts`

---

### Phase 4: Testing & Deployment
**ETA:** 1 hour

**Tasks:**
1. Test metrics calculation on dev DB
2. Verify cron job runs correctly
3. Test stage update via UI
4. Test manual metrics refresh
5. Verify performance (load time < 200ms)
6. Deploy to production
7. Monitor cron logs

**Deliverables:**
- Test results
- Deployment checklist
- Monitoring dashboard

---

**Total ETA:** 1 рабочий день (6-7 hours)

---

## 6. Risks & Mitigation

### ⚠️ Risk 1: Stale Metrics
**Problem:** Метрики обновляются каждые 15 минут, данные могут быть устаревшими

**Mitigation:**
- Показывать `metrics_updated_at` на UI
- Добавить кнопку "Refresh" для manual trigger
- Добавить tooltip: "Метрики обновляются автоматически каждые 15 минут"

---

### ⚠️ Risk 2: OZON vs WB Logic Confusion
**Problem:** Разная логика расчёта для WB и OZON (жалобы vs только чаты)

**Mitigation:**
- Чётко разделить логику в `calculateReviewStats()` через `if (marketplace === 'wb')`
- Добавить комментарии в коде
- Написать unit tests для обоих маркетплейсов

---

### ⚠️ Risk 3: Performance Degradation
**Problem:** Cron job может нагрузить DB при пересчёте метрик для всех stores

**Mitigation:**
- Добавить rate limiting: обрабатывать по 5 stores в параллели
- Добавить timeout protection
- Логировать время выполнения
- Если медленно → переключиться на materialized view

---

### ⚠️ Risk 4: Migration Rollback
**Problem:** Если что-то пойдёт не так, нужен план отката

**Mitigation:**
- Написать rollback SQL в migration файле
- Сделать backup DB перед deploy
- Протестировать rollback на dev environment

---

## 7. Success Criteria

### Performance
- ✅ Page load time < 200ms для списка stores
- ✅ Metrics cron execution < 5 minutes для всех stores
- ✅ No visible lag in UI when changing stage

### Accuracy
- ✅ Metrics match reality within 15-minute window
- ✅ WB and OZON logic correctly differentiated
- ✅ Edge cases handled (no products, no reviews, etc.)

### UX
- ✅ Clear visual indication of progress (percentages)
- ✅ Intuitive stage selector
- ✅ Visible metrics update timestamp
- ✅ Manual refresh works correctly

---

## 8. Future Enhancements (Post-MVP)

### Auto Stage Transitions
После сбора статистики можно добавить автоматические переходы:
- `cabinet_connected` → `complaints_submitted` когда `reviews_processed > 0`
- `complaints_submitted` → `chats_opened` когда `chats_opened > 0`
- `chats_opened` → `monitoring` когда прогресс > 80%

### Real-time Metrics (WebSocket)
Для critical stores показывать real-time метрики через WebSocket вместо 15-min cache.

### Advanced Analytics
- Velocity tracking (как быстро растёт прогресс)
- Bottleneck detection (где застревает работа)
- Predictive alerts (когда чаты истекут)

### Stage Automation Rules
Возможность настроить triggers для автоматического изменения stage на основе метрик.

---

## 9. Questions for Clarification

1. **OZON обработанные отзывы:**
   Считать только через `review_chat_links` (т.к. жалоб нет)?
   ✅ **Предлагаю:** `processed = EXISTS(review_chat_link)`

2. **Stage default для existing stores:**
   Ставить `cabinet_connected` если есть products?
   ✅ **Предлагаю:** да

3. **Metrics refresh frequency:**
   Каждые 15 минут достаточно или чаще?
   ✅ **Предлагаю:** 15 минут, с manual refresh button

4. **Stage permissions:**
   Только owner/admin или manager тоже?
   ✅ **Предлагаю:** owner/admin/manager (manager только для своих stores)

5. **Progress bars:**
   Нужны визуальные progress bars или достаточно "38 / 45 (84%)"?
   🤔 **Решение:** User choice

6. **Zero division:**
   Что показывать если `total_products = 0`?
   ✅ **Предлагаю:** "0 / 0 (—)" или "N/A"

---

## 10. Appendix: SQL Examples

### Full Query for Single Store Metrics

```sql
-- Products
SELECT
  COUNT(*) AS total_products,
  COUNT(*) FILTER (
    WHERE pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE
  ) AS active_products
FROM products p
LEFT JOIN product_rules pr ON pr.product_id = p.id
WHERE p.store_id = '123';

-- Reviews (WB)
SELECT
  COUNT(*) FILTER (
    WHERE r.rating <= 3
      AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
      AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')
  ) AS reviews_to_process,
  COUNT(*) FILTER (
    WHERE r.rating <= 3
      AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
      AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')
      AND (r.complaint_status IS NOT NULL OR rcl.chat_id IS NOT NULL)
  ) AS reviews_processed
FROM reviews r
INNER JOIN products p ON p.wb_product_id = r.product_nm_id
  AND p.store_id = r.store_id
LEFT JOIN product_rules pr ON pr.product_id = p.id
LEFT JOIN review_chat_links rcl
  ON rcl.review_id = r.id AND rcl.store_id = r.store_id
WHERE r.store_id = '123';

-- Chats (WB)
WITH base_reviews AS (
  SELECT COUNT(*) AS total_reviews
  FROM reviews r
  INNER JOIN products p ON p.wb_product_id = r.product_nm_id
    AND p.store_id = r.store_id
  LEFT JOIN product_rules pr ON pr.product_id = p.id
  WHERE r.store_id = '123'
    AND r.rating <= 3
    AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
    AND r.product_status NOT IN ('excluded', 'deleted', 'hidden')
),
hidden_reviews AS (
  SELECT COUNT(*) AS hidden_count
  FROM reviews r
  INNER JOIN products p ON p.wb_product_id = r.product_nm_id
    AND p.store_id = r.store_id
  LEFT JOIN product_rules pr ON pr.product_id = p.id
  WHERE r.store_id = '123'
    AND r.rating <= 3
    AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
    AND (
      r.complaint_status IN ('approved', 'excluded')
      OR r.product_status IN ('excluded', 'deleted', 'hidden', 'temporarily_hidden')
    )
),
opened_chats AS (
  SELECT COUNT(DISTINCT rcl.chat_id) AS opened_count
  FROM review_chat_links rcl
  WHERE rcl.store_id = '123'
)
SELECT
  br.total_reviews - hr.hidden_count AS chats_required,
  oc.opened_count AS chats_opened
FROM base_reviews br, hidden_reviews hr, opened_chats oc;
```

---

## Conclusion

Предлагаемая архитектура обеспечивает:
- ✅ Быструю загрузку страницы (< 200ms)
- ✅ Точные прогресс-метрики
- ✅ Масштабируемость на 100+ stores
- ✅ Поддержку WB и OZON с разной логикой
- ✅ Manual stage management для managers
- ✅ Подготовку к Kanban-доске (Phase 2)

Ключевое решение — кэширование метрик с периодическим обновлением через cron — это проверенный паттерн для dashboard систем с большим объёмом данных.

**Next step:** После approval переходим к имплементации Phase 1 (migration).
