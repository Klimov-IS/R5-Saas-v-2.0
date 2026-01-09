# 🤖 Правила автоматической генерации жалоб

## ✅ Критерии отбора отзывов для генерации жалоб

### 1. **Рейтинг отзыва**
```sql
WHERE review.rating IN (1, 2, 3)
```
Генерируем только на негативные отзывы (1-3 звезды).

---

### 2. **Дата отзыва**
```sql
WHERE review.date >= '2023-10-01'
```
Не генерируем на отзывы старше **1 октября 2023 года**.

**Причина:** Wildberries может не принимать жалобы на очень старые отзывы.

---

### 3. **Статус товара**
```sql
WHERE review.is_product_active = TRUE
```
Генерируем только для **активных товаров**.

**Причина:** Нет смысла жаловаться на отзывы неактивных товаров.

---

### 4. **Статус магазина (кабинета)**
```sql
WHERE store.is_active = TRUE
```
Генерируем только для **активных магазинов**.

**Причина:** Неактивные кабинеты не должны генерировать новые жалобы.

---

### 5. **Статус отзыва на WB (review_status_wb)**
```sql
WHERE review.review_status_wb NOT IN ('excluded_rating', 'hidden', 'temporary_hidden')
   OR review.review_status_wb IS NULL
   OR review.review_status_wb = 'unknown'
```

**НЕ генерируем если:**
- `excluded_rating` - Исключен из рейтинга
- `hidden` - Скрыт
- `temporary_hidden` - Временно скрыт

**ГЕНЕРИРУЕМ если:**
- `published` - Опубликован
- `NULL` / `unknown` / другие статусы - Статус не известен

**Причина:** Если отзыв уже скрыт/исключен, жалоба не нужна (цель уже достигнута).

---

### 6. **Наличие жалобы**
```sql
WHERE NOT EXISTS (
  SELECT 1 FROM review_complaints
  WHERE review_complaints.review_id = review.id
)
```
Генерируем только если **жалобы еще не существует** (нет записи в `review_complaints`).

**Связь 1:1:** Один отзыв = максимум одна жалоба.

---

## ⏰ Расписание генерации

### Время запуска
```
Cron: 0 6 * * *  (6:00 AM UTC = 9:00 AM MSK)
```

**Последовательность:**
1. **8:00 МСК (5:00 UTC)** - Синхронизация отзывов
2. **9:00 МСК (6:00 UTC)** - Генерация жалоб

**Частота:** 1 раз в день

---

## 🚀 Лимиты и производительность

### Лимит генерации за один запуск
```
MAX_COMPLAINTS_PER_RUN = 1000
```

**Причина:** Защита от перерасхода AI токенов и времени.

### Параллельная обработка (Concurrency)
```
CONCURRENCY_LIMIT = 10
```

Генерируем **10 жалоб одновременно** с помощью `p-limit`.

**Расчет времени:**
- 1 жалоба = ~10 секунд
- 10 параллельно = ~10 секунд на 10 жалоб
- 1000 жалоб = ~1000 секунд = **~17 минут**

---

## 📊 Система уведомлений

### Логирование прогресса

**В процессе генерации:**
```
[CRON] 🤖 Starting auto-complaint generation at 2026-01-09 09:00:00
[CRON] Found 3247 reviews eligible for complaints
[CRON] Processing batch 1/4 (1-1000 of 3247)
[CRON] ⏳ Progress: 250/1000 (25%) - 2 min elapsed
[CRON] ⏳ Progress: 500/1000 (50%) - 5 min elapsed
[CRON] ⏳ Progress: 750/1000 (75%) - 8 min elapsed
[CRON] ✅ Batch 1 completed: 1000 complaints generated in 10 min
[CRON] ⚠️  Reached daily limit (1000). Remaining: 2247 reviews
```

**После завершения:**
```
[CRON] 📊 Daily Complaint Generation Summary:
  - Eligible reviews found: 3247
  - Complaints generated: 1000
  - Remaining for tomorrow: 2247
  - Success rate: 98.5% (985/1000)
  - Errors: 15
  - Total AI cost: $0.14
  - Total duration: 17 min 32 sec
```

### Уведомления (будущая реализация)

**Каналы уведомлений:**
1. **Email** - отправка на email владельца
2. **In-app notifications** - уведомления в интерфейсе
3. **Telegram bot** (опционально)

**Триггеры уведомлений:**
- ✅ Генерация завершена (если сгенерировано > 100 жалоб)
- ⚠️ Достигнут лимит (если осталось > 500 отзывов)
- ❌ Критическая ошибка (если > 10% жалоб не сгенерировались)

**Пример уведомления:**
```
🤖 Автогенерация жалоб завершена

✅ Сгенерировано: 1000 из 3247 возможных
⏱️ Время: 17 мин 32 сек
💰 Стоимость: $0.14
📊 Успешность: 98.5%

⚠️ Внимание: Осталось 2247 отзывов для генерации.
Они будут обработаны завтра в 9:00 МСК.
```

---

## 🔍 SQL запрос для отбора отзывов

```sql
-- Найти все отзывы, которые подходят для генерации жалоб
SELECT
  r.id as review_id,
  r.store_id,
  r.owner_id,
  r.product_id,
  r.rating,
  r.text,
  r.pros,
  r.cons,
  r.date as review_date,
  p.name as product_name,
  p.vendor_code as product_vendor_code,
  s.name as store_name
FROM reviews r
INNER JOIN products p ON r.product_id = p.id
INNER JOIN stores s ON r.store_id = s.id
WHERE
  -- 1. Рейтинг 1-3 звезды
  r.rating IN (1, 2, 3)

  -- 2. Отзыв не старше 1 октября 2023
  AND r.date >= '2023-10-01'

  -- 3. Товар активен
  AND r.is_product_active = TRUE

  -- 4. Магазин активен
  AND s.is_active = TRUE

  -- 5. Статус отзыва на WB (не скрыт/исключен)
  AND (
    r.review_status_wb NOT IN ('excluded_rating', 'hidden', 'temporary_hidden')
    OR r.review_status_wb IS NULL
    OR r.review_status_wb = 'unknown'
  )

  -- 6. Жалобы еще не существует
  AND NOT EXISTS (
    SELECT 1 FROM review_complaints c
    WHERE c.review_id = r.id
  )

ORDER BY r.date DESC  -- Сначала свежие отзывы
LIMIT 1000;  -- Лимит за один запуск
```

---

## 🔄 Алгоритм генерации

```typescript
async function runAutoComplaintGeneration() {
  const START_TIME = Date.now();

  // 1. Найти отзывы для генерации
  const eligibleReviews = await findEligibleReviews();
  console.log(`Found ${eligibleReviews.length} eligible reviews`);

  if (eligibleReviews.length === 0) {
    console.log('No reviews to process. Exiting.');
    return;
  }

  // 2. Применить лимит
  const reviewsToProcess = eligibleReviews.slice(0, MAX_COMPLAINTS_PER_RUN);
  const remaining = eligibleReviews.length - reviewsToProcess.length;

  if (remaining > 0) {
    console.log(`⚠️ Limiting to ${MAX_COMPLAINTS_PER_RUN} complaints. Remaining: ${remaining}`);
  }

  // 3. Генерировать жалобы параллельно с concurrency limit
  const results = await generateComplaintsWithConcurrency(
    reviewsToProcess,
    CONCURRENCY_LIMIT
  );

  // 4. Подсчет статистики
  const stats = {
    total: results.length,
    success: results.filter(r => r.success).length,
    errors: results.filter(r => !r.success).length,
    totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
    duration: Date.now() - START_TIME
  };

  // 5. Логирование результатов
  console.log(`
📊 Daily Complaint Generation Summary:
  - Eligible reviews found: ${eligibleReviews.length}
  - Complaints generated: ${stats.success}
  - Errors: ${stats.errors}
  - Remaining for tomorrow: ${remaining}
  - Total AI cost: $${stats.totalCost.toFixed(4)}
  - Total duration: ${Math.round(stats.duration / 1000)}s
  `);

  // 6. Отправить уведомление (если нужно)
  if (stats.success > 100 || remaining > 500 || stats.errors > stats.total * 0.1) {
    await sendNotification(stats, remaining);
  }
}
```

---

## 📈 Мониторинг и аналитика

### Дневные метрики
```sql
-- Сколько жалоб сгенерировано сегодня
SELECT
  DATE(generated_at) as date,
  COUNT(*) as complaints_generated,
  COUNT(DISTINCT store_id) as stores_affected,
  SUM(ai_cost_usd) as total_cost
FROM review_complaints
WHERE generated_at >= CURRENT_DATE
GROUP BY DATE(generated_at);
```

### Отставание (backlog)
```sql
-- Сколько отзывов ждут генерации жалоб
SELECT COUNT(*) as backlog
FROM reviews r
INNER JOIN stores s ON r.store_id = s.id
WHERE r.rating IN (1, 2, 3)
  AND r.date >= '2023-10-01'
  AND r.is_product_active = TRUE
  AND s.is_active = TRUE
  AND (r.review_status_wb NOT IN ('excluded_rating', 'hidden', 'temporary_hidden')
       OR r.review_status_wb IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM review_complaints c WHERE c.review_id = r.id
  );
```

### Успешность генерации
```sql
-- Процент успешной генерации за последние 7 дней
SELECT
  DATE(generated_at) as date,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status != 'draft') as sent,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status != 'draft') / COUNT(*), 2) as sent_rate
FROM review_complaints
WHERE generated_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(generated_at)
ORDER BY date DESC;
```

---

## 🚨 Обработка ошибок

### Типы ошибок

1. **AI API недоступна** - retry 3 раза с экспоненциальной задержкой
2. **Rate limit exceeded** - пауза 60 секунд и повтор
3. **Недостаточно токенов в аккаунте** - остановить генерацию, уведомить админа
4. **Отзыв/товар удален** - пропустить, логировать
5. **DB connection lost** - retry, затем остановить

### Retry стратегия
```typescript
async function generateComplaintWithRetry(review: Review, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateComplaint(review);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }
}
```

---

## 🔐 Безопасность и лимиты

### Защита от перерасхода
```typescript
// Максимальный бюджет на день (USD)
const MAX_DAILY_BUDGET = 5.00;

// Проверка перед генерацией
const todayCost = await getTodayComplaintsCost();
if (todayCost >= MAX_DAILY_BUDGET) {
  console.log('⛔ Daily budget exceeded. Stopping generation.');
  await sendBudgetAlert(todayCost);
  return;
}
```

### Rate limiting
```typescript
// Ограничение запросов к Deepseek API
const AI_REQUESTS_PER_MINUTE = 60;
const rateLimiter = new RateLimiter(AI_REQUESTS_PER_MINUTE);
```

---

## ✅ Готово к согласованию

Правила полностью определены и готовы к реализации!

**Следующие шаги:**
1. ✅ Применить SQL миграцию для создания таблицы
2. ✅ Реализовать cron job с этими правилами
3. ✅ Добавить систему уведомлений
4. ✅ Настроить мониторинг и алерты
