# 📋 Schema: review_complaints

**Таблица для жалоб на отзывы с полной аналитикой и отчетностью**

## 🎯 Концепция

- **Связь 1:1 с reviews** - каждому отзыву соответствует максимум одна жалоба
- **Immutable после отправки** - после `sent_at` жалоба не изменяется
- **Mutable в draft** - в статусе `draft` можно перегенерировать сколько угодно раз
- **Полная история lifecycle** - от генерации до модерации WB

---

## 📊 Структура таблицы

### 🔑 Primary & Foreign Keys

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | TEXT PK | UUID жалобы |
| **`review_id`** | TEXT UNIQUE | **ID отзыва (1:1 связь)** |
| `store_id` | TEXT | Магазин (денормализация) |
| `owner_id` | TEXT | Владелец (денормализация) |
| `product_id` | TEXT | Товар (денормализация) |

### 📝 Complaint Content

| Поле | Тип | Описание |
|------|-----|----------|
| **`complaint_text`** | TEXT | **Текст жалобы (plain text)** |
| **`reason_id`** | INTEGER | **WB категория (11-20)** |
| **`reason_name`** | TEXT | **Название категории** |

**WB Категории жалоб:**
- `11` - Отзыв не относится к товару
- `12` - Отзыв оставили конкуренты
- `13` - Спам-реклама в тексте
- `14` - Спам-реклама в фото
- `15` - Нецензурное содержимое
- `16` - Нецензурная лексика, угрозы, оскорбления
- `17` - Фото не о товаре
- `18` - Политический контекст
- `19` - Вредоносные ссылки
- `20` - Другое

### 🔄 Complaint Status Lifecycle

| Поле | Тип | Описание |
|------|-----|----------|
| **`status`** | TEXT | **draft / sent / approved / rejected / pending** |

**Статусы:**
1. `draft` - Черновик (можно редактировать/регенерировать)
2. `sent` - Отправлена на WB (больше не изменяется)
3. `pending` - На рассмотрении WB
4. `approved` - WB одобрил жалобу
5. `rejected` - WB отклонил жалобу

### 📅 Draft Stage (статус = 'draft')

| Поле | Тип | Описание |
|------|-----|----------|
| `generated_at` | TIMESTAMPTZ | Когда AI сгенерировала |
| `regenerated_count` | INTEGER | Сколько раз перегенерировали |
| `last_regenerated_at` | TIMESTAMPTZ | Последняя регенерация |

**Логика:**
- При **первой генерации**: `generated_at = NOW()`, `regenerated_count = 0`
- При **регенерации**: `regenerated_count++`, `last_regenerated_at = NOW()`, **перезаписываем** `complaint_text`, `reason_id`, `reason_name`

### 📤 Sent Stage (статус = 'sent')

| Поле | Тип | Описание |
|------|-----|----------|
| `sent_at` | TIMESTAMPTZ | Когда отметили "отправлена" |
| `sent_by_user_id` | TEXT | Кто отправил (user ID) |

**Логика:**
- Пользователь нажимает **"Отметить отправленной"**
- Статус меняется: `draft → sent`
- Запись **заморожена** (больше нельзя редактировать/регенерировать)

### ✅ WB Moderation Result (статусы = 'approved' / 'rejected' / 'pending')

| Поле | Тип | Описание |
|------|-----|----------|
| `moderated_at` | TIMESTAMPTZ | Когда WB рассмотрел |
| `wb_response` | TEXT | Ответ WB (если есть) |

**Логика:**
- Синхронизация с WB API (будущая задача)
- Статус меняется: `sent → pending → approved/rejected`

---

## 💰 AI Generation Metadata (Cost Tracking)

| Поле | Тип | Описание |
|------|-----|----------|
| `ai_model` | TEXT | 'deepseek-chat' |
| `ai_prompt_tokens` | INTEGER | Input tokens |
| `ai_completion_tokens` | INTEGER | Output tokens |
| `ai_total_tokens` | INTEGER | Total tokens |
| `ai_cost_usd` | DECIMAL(10,6) | Стоимость в USD |
| `generation_duration_ms` | INTEGER | Время генерации (мс) |

**Стоимость Deepseek:**
- Input: $0.14 per 1M tokens
- Output: $0.28 per 1M tokens

**Пример расчета:**
```
Input: 200 tokens × $0.14 / 1,000,000 = $0.000028
Output: 150 tokens × $0.28 / 1,000,000 = $0.000042
Total cost: $0.000070
```

---

## 📸 Review Snapshot (Historical Reference)

| Поле | Тип | Описание |
|------|-----|----------|
| `review_rating` | INTEGER | Рейтинг отзыва (1-5) |
| `review_text` | TEXT | Текст отзыва (snapshot) |
| `review_date` | TIMESTAMPTZ | Дата отзыва |

**Зачем:**
- Отзыв может быть удален/изменен
- Нужен snapshot для аналитики и истории

---

## 🏷️ Product Snapshot (Analytics)

| Поле | Тип | Описание |
|------|-----|----------|
| `product_name` | TEXT | Название товара |
| `product_vendor_code` | TEXT | Артикул |
| `product_is_active` | BOOLEAN | Активен ли товар |

**Зачем:**
- Аналитика по товарам
- Товар может быть удален/изменен

---

## ⏱️ Timestamps

| Поле | Тип | Описание |
|------|-----|----------|
| `created_at` | TIMESTAMPTZ | Создание записи |
| `updated_at` | TIMESTAMPTZ | Последнее обновление (auto-trigger) |

---

## 📈 Индексы для аналитики

```sql
-- Primary queries
idx_complaints_review (review_id)  -- Fast lookup by review
idx_complaints_store_status (store_id, status, created_at DESC)  -- Store dashboard
idx_complaints_owner_status (owner_id, status, created_at DESC)  -- Owner analytics

-- Analytics queries
idx_complaints_store_generated (store_id, generated_at DESC)  -- Generation history
idx_complaints_store_sent (store_id, sent_at DESC) WHERE sent_at IS NOT NULL  -- Sent complaints
idx_complaints_status_moderated (status, moderated_at DESC) WHERE moderated_at IS NOT NULL  -- Moderation results
idx_complaints_reason (reason_id, reason_name)  -- By category
idx_complaints_product (product_id, status)  -- By product

-- Cost tracking
idx_complaints_cost_date (generated_at DESC, ai_cost_usd) WHERE ai_cost_usd IS NOT NULL
```

---

## 🔄 Lifecycle Examples

### Example 1: Draft → Regenerate → Send → Approve

```
1. AI генерирует жалобу:
   status = 'draft'
   generated_at = 2026-01-09 08:00:00
   regenerated_count = 0
   complaint_text = "Отзыв не относится..."

2. Пользователь нажимает "Перегенерировать":
   status = 'draft' (не меняется)
   regenerated_count = 1
   last_regenerated_at = 2026-01-09 09:30:00
   complaint_text = "Покупатель описывает..." (НОВЫЙ ТЕКСТ)

3. Пользователь отправляет:
   status = 'sent'
   sent_at = 2026-01-09 10:00:00
   sent_by_user_id = 'user123'
   (ЗАПИСЬ ЗАМОРОЖЕНА)

4. WB одобряет:
   status = 'approved'
   moderated_at = 2026-01-11 14:00:00
   wb_response = NULL
```

### Example 2: Draft → Send → Reject

```
1. AI генерирует:
   status = 'draft'
   generated_at = 2026-01-09 08:00:00

2. Пользователь отправляет без изменений:
   status = 'sent'
   sent_at = 2026-01-09 08:05:00
   regenerated_count = 0  (не перегенерировали)

3. WB отклоняет:
   status = 'rejected'
   moderated_at = 2026-01-12 16:00:00
   wb_response = "Отзыв соответствует правилам площадки"
```

---

## 📊 Analytics Queries Examples

### 1. Статистика по магазину

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(regenerated_count) as avg_regenerations,
  SUM(ai_cost_usd) as total_cost
FROM review_complaints
WHERE store_id = 'store123'
GROUP BY status
ORDER BY count DESC;
```

### 2. Самые дорогие жалобы

```sql
SELECT
  id,
  complaint_text,
  ai_total_tokens,
  ai_cost_usd,
  generation_duration_ms
FROM review_complaints
WHERE store_id = 'store123'
ORDER BY ai_cost_usd DESC
LIMIT 10;
```

### 3. Эффективность по категориям WB

```sql
SELECT
  reason_id,
  reason_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'approved') / COUNT(*), 2) as approval_rate
FROM review_complaints
WHERE store_id = 'store123'
  AND status IN ('approved', 'rejected')
GROUP BY reason_id, reason_name
ORDER BY approval_rate DESC;
```

### 4. Дневная стоимость AI генерации

```sql
SELECT
  DATE(generated_at) as date,
  COUNT(*) as complaints_generated,
  SUM(ai_prompt_tokens) as total_input_tokens,
  SUM(ai_completion_tokens) as total_output_tokens,
  SUM(ai_cost_usd) as total_cost_usd
FROM review_complaints
WHERE store_id = 'store123'
  AND generated_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(generated_at)
ORDER BY date DESC;
```

---

## ✅ Migration Strategy

1. **Создать таблицу** `review_complaints`
2. **Мигрировать существующие данные** из `reviews.complaint_text`
3. **Обновить denormalized поля** в `reviews` (`has_complaint`, `has_complaint_draft`)
4. **Постепенно переводить код** на новую таблицу
5. **Оставить старые поля** в `reviews` для совместимости (можно удалить позже)

---

## 🚀 Next Steps

После согласования схемы:

1. ✅ Применить миграцию в БД
2. ✅ Создать TypeScript типы
3. ✅ Обновить API endpoints для работы с новой таблицей
4. ✅ Обновить UI компоненты (ComplaintBox)
5. ✅ Добавить правила автоматической генерации
6. ✅ Реализовать cron job для ежедневной генерации
