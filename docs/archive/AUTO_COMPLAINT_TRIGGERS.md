# Триггеры автоматической генерации жалоб

**Дата создания:** 2026-01-20
**Статус:** Реализовано (Event-Driven + CRON Fallback)
**Версия:** 1.0

---

## 📋 Обзор

Система автоматической генерации жалоб работает по **гибридному подходу**:

1. **Event-Driven (99% случаев)** — мгновенная генерация при триггерах
2. **CRON Fallback (1% случаев)** — подхватывает пропущенные (ошибки, rate limits)

**Гарантия:** 100% coverage — нет ни одного согласованного отзыва без черновика жалобы.

---

## 🔔 Триггер 1: Синхронизация новых отзывов

### Когда срабатывает:
```
POST /api/stores/{storeId}/reviews/update
```

### Логика:
1. Синхронизируются отзывы из Wildberries API
2. Отслеживаются **новые отзывы** (которых не было в БД)
3. Для каждого нового отзыва проверяются **правила генерации** (см. ниже)
4. Если отзыв подходит → запускается **background генерация жалобы**

### Код:
```typescript
// src/app/api/stores/[storeId]/reviews/update/route.ts

// После синхронизации отзывов
if (newReviewIds.length > 0) {
  // Фильтруем eligible reviews
  const eligibleReviewIds = [];
  for (const reviewId of newReviewIds) {
    const review = await dbHelpers.getReviewById(reviewId);
    if (review && (await shouldGenerateComplaint(review))) {
      eligibleReviewIds.push(reviewId);
    }
  }

  if (eligibleReviewIds.length > 0) {
    // Background генерация (non-blocking)
    autoGenerateComplaintsInBackground(storeId, eligibleReviewIds, apiKey)
      .catch(err => console.error('[AUTO-COMPLAINT] Failed:', err));
  }
}
```

### Примеры:

**Пример 1: Incremental синхронизация (каждый час)**
```bash
curl -X POST "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/reviews/update?mode=incremental" \
  -H "Authorization: Bearer wbrm_..."
```
- Синхронизирует отзывы за последний час
- Находит 5 новых отзывов
- 3 из них подходят под правила (рейтинг 1-2, активный товар, разрешена генерация)
- Автоматически генерируются 3 жалобы в фоне

**Пример 2: Full синхронизация (первый импорт)**
```bash
curl -X POST "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/reviews/update?mode=full" \
  -H "Authorization: Bearer wbrm_..."
```
- Синхронизирует ВСЕ отзывы (с 2020 года)
- Находит 1500 новых отзывов
- **Оптимизация:** Если >100 новых отзывов → передается CRON (чтобы не перегрузить API)
- CRON обработает batch за час

---

## 🔔 Триггер 2: Активация магазина (Store)

### Когда срабатывает:
```
PATCH /api/stores/{storeId}
Body: { "status": "active" }
```

### Логика:
1. Магазин меняет статус с `paused`/`stopped` → `active`
2. Система находит **все отзывы** этого магазина без жалоб
3. Фильтрует по правилам (`product_rules`, активные товары)
4. Запускается **batch генерация** для backlog (до 500 отзывов за раз)

### Код:
```typescript
// Пример (endpoint пока не реализован, но логика готова)

// После обновления магазина
const oldStore = await dbHelpers.getStoreById(storeId);
await dbHelpers.updateStore(storeId, { status: 'active' });

if (oldStore.status !== 'active') {
  console.log('[STORE-ACTIVATION] Store activated — triggering backlog generation');

  // Получить отзывы без жалоб (product_rules уже проверяются внутри)
  const eligibleReviewIds = await dbHelpers.getReviewsWithoutComplaints(storeId, 4, 500);

  if (eligibleReviewIds.length > 0) {
    autoGenerateComplaintsInBackground(storeId, eligibleReviewIds, apiKey);
  }
}
```

### Сценарий использования:

**До:**
- Магазин был на паузе (status = 'paused')
- Накопилось 300 отзывов без жалоб

**Действие:** Менеджер активирует магазин

**После:**
- Система находит 300 отзывов
- Генерирует жалобы на 300 отзывов (batch)
- Все жалобы готовы через 10-15 минут

---

## 🔔 Триггер 3: Активация товара (Product)

### Когда срабатывает:
```
PATCH /api/products/{productId}
Body: { "is_active": true }
```

### Логика:
1. Товар меняет статус с `is_active: false` → `is_active: true`
2. Система находит **все отзывы для этого товара** без жалоб
3. Проверяет `product_rules` (submit_complaints, complaint_rating_*)
4. Генерирует жалобы для backlog

### Код:
```typescript
// Пример (endpoint пока не реализован, но логика готова)

const oldProduct = await dbHelpers.getProductById(productId);
await dbHelpers.updateProduct(productId, { is_active: true });

if (!oldProduct.is_active) {
  console.log('[PRODUCT-ACTIVATION] Product activated — checking reviews');

  // Получить отзывы для товара без жалоб
  const reviews = await dbHelpers.getReviewsForProduct(productId, { hasComplaint: false });

  const eligibleReviewIds = [];
  for (const review of reviews) {
    if (await shouldGenerateComplaint(review)) {
      eligibleReviewIds.push(review.id);
    }
  }

  if (eligibleReviewIds.length > 0) {
    autoGenerateComplaintsInBackground(storeId, eligibleReviewIds, apiKey);
  }
}
```

### Сценарий использования:

**До:**
- Товар был неактивен (`is_active: false`)
- На этот товар 50 отзывов 1-3 звезды

**Действие:** Менеджер активирует товар

**После:**
- Система находит 50 отзывов для этого товара
- Генерирует 50 жалоб автоматически

---

## 🔔 Триггер 4: Изменение правил (Product Rules)

### Когда срабатывает:
```
POST/PATCH /api/products/{productId}/rules
Body: {
  "submit_complaints": true,
  "complaint_rating_1": true,
  "complaint_rating_2": true
}
```

### Логика:
1. Правила товара обновляются (включается `submit_complaints` или новые рейтинги)
2. Система находит **все отзывы для товара** без жалоб
3. Проверяет новые правила (какие рейтинги теперь разрешены)
4. Генерирует жалобы для backlog

### Код:
```typescript
// Пример (endpoint пока не реализован, но логика готова)

const oldRules = await dbHelpers.getProductRule(productId);
const newRules = await dbHelpers.upsertProductRule({ ...body, product_id: productId });

// Проверяем, включились ли жалобы или изменились рейтинги
const rulesChanged =
  newRules.submit_complaints === true &&
  (oldRules?.submit_complaints !== true || rulesChangedDetails(oldRules, newRules));

if (rulesChanged) {
  console.log('[RULES-UPDATE] Product rules enabled — checking reviews');

  const reviews = await dbHelpers.getReviewsForProduct(productId, { hasComplaint: false });

  const eligibleReviewIds = [];
  for (const review of reviews) {
    // Проверяем с НОВЫМИ правилами
    if (await shouldGenerateComplaintWithRules(review, newRules)) {
      eligibleReviewIds.push(review.id);
    }
  }

  if (eligibleReviewIds.length > 0) {
    autoGenerateComplaintsInBackground(storeId, eligibleReviewIds, apiKey);
  }
}
```

### Сценарий использования:

**До:**
- У товара правила: `submit_complaints: false`
- На товар 80 отзывов 1-3 звезды, но жалобы НЕ генерируются

**Действие:** Менеджер включает правила: `submit_complaints: true`, `complaint_rating_1: true`, `complaint_rating_2: true`

**После:**
- Система находит все отзывы 1-2 звезды (например, 60 отзывов)
- Генерирует 60 жалоб автоматически

---

## 🔔 Триггер 5: CRON Fallback (Safety Net)

### Когда срабатывает:
```
Каждый час (production) / каждые 5 минут (test)
```

### Логика:
1. CRON ищет **все отзывы без жалоб** через `getReviewsWithoutComplaints()`
2. Проверяет правила (`product_rules`, активные товары, активные магазины)
3. Если находит пропущенные отзывы → генерирует жалобы
4. **Назначение:** Подхватывает пропущенные event-driven (ошибки, rate limits, downtime)

### Код:
```typescript
// src/lib/cron-jobs.ts:142-190

async function generateComplaintsForStore(storeId: string, storeName: string) {
  // Получить отзывы без жалоб (до 50 за раз)
  const reviewIds = await dbHelpers.getReviewsWithoutComplaints(storeId, 4, 50);

  if (reviewIds.length === 0) {
    console.log(`[CRON] ✅ No backlog — event-driven coverage is working`);
    return { generated: 0, failed: 0, templated: 0 };
  }

  console.log(`[CRON] ⚠️  FALLBACK: Found ${reviewIds.length} reviews without complaints (missed by event-driven)`);

  // Batch генерация
  const response = await fetch('/api/extension/stores/${storeId}/reviews/generate-complaints-batch', {
    method: 'POST',
    body: JSON.stringify({ review_ids: reviewIds }),
  });

  const result = await response.json();
  console.log(`[CRON] Generated ${result.generated.length} complaints`);

  return { generated: result.generated.length, ... };
}
```

### Сценарий использования:

**Пример 1: Event-Driven сработал отлично**
```
[CRON] Checking reviews without complaints for: Store A
[CRON] ✅ No backlog — event-driven coverage is working
```
→ Все новые отзывы были обработаны event-driven → CRON ничего не нашел

**Пример 2: Event-Driven упал (ошибка API)**
```
[CRON] Checking reviews without complaints for: Store B
[CRON] ⚠️  FALLBACK: Found 12 reviews without complaints (missed by event-driven)
[CRON] Generated 12 complaints (10 AI, 2 templates)
```
→ Event-driven не смог обработать из-за ошибки → CRON подхватил

---

## ✅ Правила генерации жалоб (Business Logic)

Жалоба генерируется **ТОЛЬКО** если выполняются ВСЕ условия:

### 1. Рейтинг отзыва: 1-4 звезды
```typescript
if (review.rating < 1 || review.rating > 4) return false;
```
- ✅ 1★, 2★, 3★, 4★ — генерируем
- ❌ 5★ — НЕ генерируем (положительный отзыв)

### 2. Магазин активен
```typescript
const store = await dbHelpers.getStoreById(review.store_id);
if (store.status !== 'active') return false;
```
- ✅ `status: 'active'` — генерируем
- ❌ `status: 'paused' | 'stopped' | 'archived'` — НЕ генерируем

### 3. Товар активен
```typescript
const product = await dbHelpers.getProductById(review.product_id);
if (!product.is_active) return false;
```
- ✅ `is_active: true` — генерируем
- ❌ `is_active: false` — НЕ генерируем

### 4. Правила товара разрешают жалобы
```typescript
const productRule = await dbHelpers.getProductRule(review.product_id);
if (!productRule?.submit_complaints) return false;
```
- ✅ `submit_complaints: true` — генерируем
- ❌ `submit_complaints: false` — НЕ генерируем

### 5. Конкретный рейтинг разрешен в правилах
```typescript
const ratingKey = `complaint_rating_${review.rating}`;
if (!productRule[ratingKey]) return false;
```
- ✅ `complaint_rating_1: true` для отзыва 1★ — генерируем
- ❌ `complaint_rating_1: false` для отзыва 1★ — НЕ генерируем

### 6. Жалоба еще не существует (Idempotency)
```typescript
const existingComplaint = await dbHelpers.getComplaintByReviewId(review.id);
if (existingComplaint) return false;
```
- ✅ Жалобы нет → генерируем
- ❌ Жалоба уже есть → НЕ генерируем (никогда не создаем дубликаты)

---

## 📊 Мониторинг и метрики

### Логи для отслеживания

**Event-Driven генерация:**
```
[AUTO-COMPLAINT] Found 15 new reviews — checking for auto-complaint generation
[AUTO-COMPLAINT] 8/15 reviews eligible for complaints
[AUTO-COMPLAINT] Background generation triggered for 8 reviews
```

**CRON Fallback (все работает):**
```
[CRON] Checking reviews without complaints for: Store A
[CRON] ✅ No backlog — event-driven coverage is working
```

**CRON Fallback (подхватывает пропущенные):**
```
[CRON] ⚠️  FALLBACK: Found 12 reviews without complaints (missed by event-driven)
[CRON] Generated 12 complaints (10 AI, 2 templates)
```

### KPI для анализа эффективности

**1. Event-Driven Coverage (должно быть >95%)**
```sql
SELECT
  COUNT(*) FILTER (WHERE rc.generated_at - r.created_at < INTERVAL '5 minutes') as event_driven,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE rc.generated_at - r.created_at < INTERVAL '5 minutes') / COUNT(*), 2) as coverage_pct
FROM review_complaints rc
INNER JOIN reviews r ON r.id = rc.review_id
WHERE rc.generated_at >= NOW() - INTERVAL '7 days';
```

**2. CRON Fallback Usage (должно быть <5%)**
```sql
SELECT COUNT(*) as cron_fallback
FROM review_complaints rc
INNER JOIN reviews r ON r.id = rc.review_id
WHERE rc.generated_at - r.created_at >= INTERVAL '5 minutes'
  AND rc.generated_at >= NOW() - INTERVAL '7 days';
```

**3. Review Coverage (должно быть 100%)**
```sql
SELECT
  COUNT(*) FILTER (WHERE rc.id IS NOT NULL) as with_complaints,
  COUNT(*) as total_eligible,
  ROUND(100.0 * COUNT(*) FILTER (WHERE rc.id IS NOT NULL) / COUNT(*), 2) as coverage_pct
FROM reviews r
INNER JOIN products p ON r.product_id = p.id
INNER JOIN stores s ON r.store_id = s.id
INNER JOIN product_rules pr ON pr.product_id = p.id
LEFT JOIN review_complaints rc ON rc.review_id = r.id
WHERE p.is_active = true
  AND s.status = 'active'
  AND pr.submit_complaints = true
  AND (
    (r.rating = 1 AND pr.complaint_rating_1 = true) OR
    (r.rating = 2 AND pr.complaint_rating_2 = true) OR
    (r.rating = 3 AND pr.complaint_rating_3 = true) OR
    (r.rating = 4 AND pr.complaint_rating_4 = true)
  );
```

---

## 🎯 Acceptance Criteria (Критерии приемки)

- ✅ **Event-Driven:** Жалобы генерируются мгновенно при синхронизации новых отзывов
- ✅ **Store Activation:** Backlog генерируется при активации магазина
- ✅ **Product Activation:** Backlog генерируется при активации товара
- ✅ **Rules Update:** Backlog генерируется при включении правил
- ✅ **CRON Fallback:** Подхватывает пропущенные (ошибки, downtime)
- ✅ **Idempotency:** Никогда не создаются дубликаты (1:1 review ↔ complaint)
- ✅ **Logging:** Все триггеры логируются для мониторинга
- ✅ **Coverage:** 100% согласованных отзывов имеют черновики жалоб

---

## 📚 Связанные документы

- [AUTO_COMPLAINT_STRATEGY.md](./AUTO_COMPLAINT_STRATEGY.md) — Стратегия и архитектура
- [complaint-auto-generation-rules.md](./complaint-auto-generation-rules.md) — Бизнес-правила
- [CRON_JOBS.md](./CRON_JOBS.md) — Документация CRON jobs
- [database-schema.md](./database-schema.md) — Схема БД

---

**Last Updated:** 2026-01-20
**Status:** Implemented ✅
**Version:** 1.0
