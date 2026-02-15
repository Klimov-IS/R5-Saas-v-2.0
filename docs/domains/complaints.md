# Домен: Жалобы (Complaints)

**Дата:** 2026-02-08
**Версия:** 1.0
**Source of Truth:** `review_complaints` таблица

---

## Обзор

**Жалобы** — ключевой инструмент управления репутацией на Wildberries. Система R5 автоматически генерирует тексты жалоб на негативные отзывы с помощью AI.

### Ключевые принципы

1. **Жалоба — snapshot** на момент генерации (не синхронизируется обратно с отзывом)
2. **1:1 связь** — один отзыв = максимум одна жалоба
3. **Лимит текста** — 900 символов (soft 750, WB hard limit 1000)
6. **Cutoff дата** — только отзывы с 01.10.2023 (правило WB, CHECK constraint в БД)
4. **Идемпотентность** — повторная генерация безопасна
5. **Иммутабельность после отправки** — отправленную жалобу нельзя изменить

---

## Жизненный цикл жалобы

```
[Отзыв с rating ≤ 4]
       ↓
[Проверка критериев]
       ↓
[Генерация (AI или template)]
       ↓
status = 'draft'
       ↓
[Пользователь отправляет через Extension]
       ↓
status = 'pending'
       ↓
[WB модерирует]
       ↓
status = 'approved' | 'rejected'
```

### Статусы

| Статус | Описание | Изменяемость |
|--------|----------|--------------|
| `draft` | Черновик, сгенерирован AI | ✅ Можно редактировать |
| `pending` | Отправлена на модерацию | ❌ Заморожена |
| `approved` | Одобрена WB | ❌ Заморожена |
| `rejected` | Отклонена WB | ❌ Заморожена |
| `reconsidered` | Пересмотрена WB | ❌ Заморожена |
| `not_applicable` | Нельзя подать (отзыв удалён) | ❌ Заморожена |

**Примечание:** Статус `sent` удалён — используется `pending` напрямую.

**Примечание:** Статус `not_applicable` автоматически выставляется при детекции удалённого отзыва (migration 015). Черновик жалобы на удалённый отзыв автоматически отменяется.

---

## Критерии генерации

### 1. Рейтинг отзыва

```sql
WHERE rating IN (1, 2, 3, 4)  -- Обычно 1-3, настраивается через product_rules
```

### 2. Активность товара

```sql
WHERE is_product_active = TRUE
```

### 3. Правила товара

```sql
WHERE product_rules.submit_complaints = TRUE
  AND product_rules.complaint_rating_{N} = TRUE  -- N = rating
```

### 4. Отсутствие жалобы

```sql
WHERE NOT EXISTS (
  SELECT 1 FROM review_complaints
  WHERE review_id = reviews.id
)
```

### 5. Статус отзыва на WB (опционально)

```sql
WHERE review_status_wb NOT IN ('excluded_rating', 'hidden')
   OR review_status_wb IS NULL
```

---

## Методы генерации

### 1. Template-based (для пустых отзывов)

**Когда применяется:**
- `text IS NULL OR text = ''`
- `pros IS NULL OR pros = ''`
- `cons IS NULL OR cons = ''`
- `rating IN (1, 2)`

**Преимущества:**
- 0 токенов = 0 стоимость
- Мгновенная генерация
- 30-40% отзывов подходят

**Template:**
```
Отзыв содержит только числовую оценку без какого-либо текстового описания.
Покупатель не указал:
- что именно его не устроило в товаре
- какие недостатки он обнаружил
- причины низкой оценки

Такой отзыв не помогает другим покупателям сделать осознанный выбор
и не даёт продавцу возможности улучшить качество товара или сервиса.

Прошу рассмотреть возможность удаления данного отзыва как неинформативного.
```

**Reason ID:** 11 (Отзыв не относится к товару)

### 2. AI-powered (для отзывов с текстом)

**Когда применяется:**
- Отзыв имеет текст, pros или cons

**AI Model:** Deepseek Chat

**Prompt:** см. `src/ai/prompts/optimized-review-complaint-prompt.ts`

**Выход:**
- `complaint_text` — текст жалобы (≤ 900 символов)
- `reason_id` — категория WB (11-20)
- `reason_name` — название категории

### Категории жалоб WB

| ID | Название |
|----|----------|
| 11 | Отзыв не относится к товару |
| 12 | Оскорбления и нецензурная лексика |
| 13 | Спам или реклама |
| 14 | Ложная информация |
| 15 | Дублирующийся отзыв |
| 16 | Отзыв о доставке |
| 17 | Отзыв о работе пункта выдачи |
| 18 | Персональные данные |
| 19 | Призыв к противоправным действиям |
| 20 | Другое |

---

## Автоматизация

### Event-driven генерация

При синхронизации нового отзыва:

```typescript
// В syncStoreReviews()
for (const review of newReviews) {
  if (review.rating <= 4 && review.is_product_active) {
    const rules = await getProductRules(review.product_id);
    if (rules.submit_complaints && rules[`complaint_rating_${review.rating}`]) {
      await generateComplaint(review.id);
    }
  }
}
```

### CRON fallback (hourly-review-sync)

Каждый час проверяет отзывы без жалоб:

```typescript
const reviewIds = await getReviewsWithoutComplaints(storeId, 4, 200);
if (reviewIds.length > 0) {
  await generateComplaintsBatch(reviewIds);
}
```

### Backfill Worker

При активации товара:

1. Создаётся задача в `complaint_backfill_jobs`
2. **Немедленный запуск** `runBackfillWorker(1)` (fire-and-forget)
3. CRON подхватывает каждые 5 минут (fallback)
4. Параметры: BATCH_SIZE=200, DELAY=1500ms, MAX_BATCHES=20
5. Дневной лимит: 6000 жалоб/магазин (было 2000)
6. 10K отзывов: ~2 дня (было 5 дней)

---

## БД Schema

### Таблица `review_complaints`

```sql
CREATE TABLE review_complaints (
  id                      TEXT PRIMARY KEY,
  review_id               TEXT NOT NULL UNIQUE REFERENCES reviews(id),
  store_id                TEXT NOT NULL,
  owner_id                TEXT NOT NULL,
  product_id              TEXT NOT NULL,

  -- Контент
  complaint_text          TEXT NOT NULL,
  reason_id               INTEGER NOT NULL,
  reason_name             TEXT NOT NULL,

  -- Lifecycle
  status                  TEXT NOT NULL DEFAULT 'draft',

  -- Timestamps
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  regenerated_count       INTEGER DEFAULT 0,
  sent_at                 TIMESTAMPTZ NULL,
  moderated_at            TIMESTAMPTZ NULL,

  -- AI metadata
  ai_model                TEXT DEFAULT 'deepseek-chat',
  ai_prompt_tokens        INTEGER NULL,
  ai_completion_tokens    INTEGER NULL,
  ai_total_tokens         INTEGER NULL,
  ai_cost_usd             DECIMAL(10, 6) NULL,

  -- Snapshots
  review_rating           INTEGER NOT NULL,
  review_text             TEXT NOT NULL,
  review_date             TIMESTAMPTZ NOT NULL,
  product_name            TEXT NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Индексы

```sql
CREATE INDEX idx_complaints_store_status ON review_complaints(store_id, status);
CREATE INDEX idx_complaints_store_generated ON review_complaints(store_id, generated_at DESC);
CREATE INDEX idx_complaints_product ON review_complaints(product_id, status);
```

---

## API Endpoints

| Метод | Endpoint | Назначение |
|-------|----------|------------|
| GET | `/api/stores/:id/complaints` | Список жалоб |
| POST | `/api/stores/:id/reviews/:reviewId/generate-complaint` | Генерация |
| PUT | `/api/stores/:id/reviews/:reviewId/complaint/sent` | Отметить отправленной |
| POST | `/api/extension/stores/:id/reviews/generate-complaints-batch` | Batch генерация |

---

## Лимиты и защита

### Лимит текста

```typescript
// src/ai/utils/complaint-text-validator.ts
export const COMPLAINT_HARD_LIMIT = 900;  // Наш жёсткий лимит (WB = 1000)
export const COMPLAINT_SOFT_LIMIT = 750;  // Рекомендуемый для качества
```

AI промпт настроен на 450–750 символов. Truncation fallback обрезает до 900 по предложениям.

### Cutoff дата (01.10.2023)

```sql
-- Migration 014: CHECK constraint на уровне БД
ALTER TABLE review_complaints
ADD CONSTRAINT check_review_date_after_cutoff
CHECK (review_date >= '2023-10-01');
```

WB не принимает жалобы на отзывы до 01.10.2023. Проверка в коде + constraint в БД.

### Rate limiting

- AI запросы: 60 RPM
- Batch генерация: 200 отзывов за раз (backfill worker)
- CRON fallback: 200 отзывов на магазин
- Дневной лимит: 6000 жалоб на магазин (backfill)

### Защита от дублей

```sql
-- UNIQUE constraint
ALTER TABLE review_complaints
ADD CONSTRAINT review_complaints_review_id_key UNIQUE (review_id);
```

```typescript
// В коде
const existing = await getComplaintByReviewId(reviewId);
if (existing) {
  throw new Error('Complaint already exists');
}
```

---

## Мониторинг

### Метрики

```sql
-- Сегодняшняя статистика
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ai_cost_usd = 0) as templated,
  COUNT(*) FILTER (WHERE ai_cost_usd > 0) as ai_generated,
  SUM(ai_cost_usd) as total_cost
FROM review_complaints
WHERE generated_at >= CURRENT_DATE;
```

### Логирование

```
[AI INPUT] Generating complaint for review: { reviewId, rating, hasText, textLength }
[TEMPLATE] Using template for empty review (zero AI cost)
[AI RAW RESPONSE] Review abc123: Отзыв содержит несоответствие...
[CRON] ✅ Generated complaints: 42 total (18 templates, 24 AI)
```

---

## Edge Cases

### 1. Отзыв удалён после генерации

- Жалоба сохраняется (snapshot)
- При отправке через Extension → ошибка (обрабатывается в UI)

### 2. Текст > 900 символов

- AI промпт требует 450–750 символов
- Truncation fallback: обрезка до 900 по последнему полному предложению

### 3. AI недоступен

- Retry 3 раза с backoff
- Если все попытки неудачны → отзыв остаётся без жалобы
- Следующий CRON попробует снова

### 4. Повторная генерация

- Для `draft` — допустимо (перезаписывает)
- Для `pending`/`approved`/`rejected` — запрещено

---

## Связанные документы

- [Database Schema](../database-schema.md) — полная схема review_complaints
- [CRON Jobs](../CRON_JOBS.md) — автоматизация
- [complaint-auto-generation-rules.md](../complaint-auto-generation-rules.md) — детальные правила
- [complaints-table-schema.md](../complaints-table-schema.md) — детальная схема таблицы
- [AUTO_COMPLAINT_STRATEGY.md](../AUTO_COMPLAINT_STRATEGY.md) — стратегия
- [Табы кабинета](../product/client-tabs.md) — UI для отзывов

---

**Last Updated:** 2026-02-15
