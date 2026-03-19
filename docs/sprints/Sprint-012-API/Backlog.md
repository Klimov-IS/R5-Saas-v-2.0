# Sprint 012 — Extension API Performance: Backlog

> **Дата:** 2026-03-19
> **Основание:** Audit.md (команда расширения) + Research.md (backend анализ)
> **Цель:** Снизить время обработки 50 магазинов с 214с до <30с

## Статус реализации (2026-03-19)

| Фаза | Статус | Что сделано |
|------|--------|-------------|
| **Фаза 1** | ✅ DONE | TASK-001: N+1 в /stores (124 SQL → 2 SQL), TASK-002: batch /review-statuses (600 SQL → ~10 SQL) |
| **Фаза 2** | ✅ DONE | TASK-003: индекс idx_rcl_matching (migration 035), TASK-004: in-memory кэш /stores (30с TTL), TASK-005: Cache-Control на все GET |
| **Фаза 3** | ✅ DONE | TASK-006: Promise.all в /complaints, TASK-007: 2-step unnest в /reparse, TASK-008: skipped (auth уже cached) |
| **Фаза 4** | TODO | TASK-009-011: мониторинг, rate limit, Server-Timing |
| **Фаза 5** | TODO | TASK-012-013: bulk API, lightweight /stores/list |

### Файлы изменены:
- `src/app/api/extension/stores/route.ts` — v3.0→v4.0 (N+1 fix + cache + Cache-Control)
- `src/app/api/extension/review-statuses/route.ts` — v1.2→v2.0 (batch unnest)
- `src/app/api/extension/stores/[storeId]/complaints/route.ts` — Promise.all + Cache-Control + bugfix
- `src/app/api/extension/stores/[storeId]/tasks/route.ts` — Cache-Control
- `src/app/api/extension/stores/[storeId]/reviews/reparse/route.ts` — v1.0→v1.1 (2-step unnest)
- `src/app/api/extension/chat/stores/[storeId]/rules/route.ts` — Cache-Control
- `migrations/035_add_rcl_matching_index.sql` — NEW (composite index for /tasks B/C queries)

---

## Фаза 1: Устранение N+1 (P0 — убирает корневую причину деградации) ✅ DONE

### TASK-001: Устранить N+1 в GET /stores (Q2 + Q3) ✅

**Файл:** `src/app/api/extension/stores/route.ts:194-252`

**Проблема:** Два `for...of` цикла с `await` — 62+62 = 124 последовательных SQL запроса.

**Решение:** Заменить циклы на **один SQL запрос каждый** с `store_id = ANY(...)` + GROUP BY:

```sql
-- Q2: вместо цикла по 62 магазинам
SELECT DISTINCT r.store_id
FROM reviews r
WHERE r.store_id = ANY($1::text[])
  AND r.product_id = ANY($2::text[])
  AND r.review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
  AND r.rating_excluded = FALSE
  AND r.marketplace = 'wb'
  AND (r.chat_status_by_review IS NULL OR r.chat_status_by_review = 'unknown')
  AND NOT EXISTS (
    SELECT 1 FROM review_complaints rc WHERE rc.review_id = r.id AND rc.status = 'draft'
  )
LIMIT 1 -- нам нужен только boolean per store
```

Потребуется собрать **единый массив всех eligible product_ids** (через все магазины) и выполнить один запрос. Затем в JS определить, какие store_id вернулись.

**Ожидаемый эффект:** 124 SQL → 2 SQL. Время `/stores`: 1.1с → ~200мс.

**Оценка:** 2-3 часа.

---

### TASK-002: Оптимизировать POST /review-statuses (batch UPDATE) ✅

**Файл:** `src/app/api/extension/review-statuses/route.ts:270-527`

**Проблема:** До 600 UPDATE за один POST (6 SQL × 100 reviews). Каждый UPDATE ищет по `(store_id, product_id, rating, DATE_TRUNC('minute', date))`.

**Решение:** Batch UPDATE через `unnest()`:

```sql
-- Вместо 100 отдельных UPDATE для chat_status:
UPDATE reviews r
SET chat_status_by_review = batch.new_status::chat_status_by_review,
    updated_at = NOW()
FROM (
  SELECT unnest($1::text[]) as product_id,
         unnest($2::int[]) as rating,
         unnest($3::timestamptz[]) as review_date,
         unnest($4::text[]) as new_status
) batch
WHERE r.store_id = $5
  AND r.product_id = batch.product_id
  AND r.rating = batch.rating
  AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.review_date)
  AND (r.chat_status_by_review IS NULL OR r.chat_status_by_review != 'opened' OR batch.new_status = 'opened')
```

**Ожидаемый эффект:** 600 SQL → 5-6 SQL. Время POST: 310мс → ~50мс. Pool contention -95%.

**Оценка:** 4-5 часов (нужна аккуратная работа с returnig + side effects).

---

## Фаза 2: Оптимизация тяжёлых запросов (P1 — убирает спайки) ✅ DONE

### TASK-003: Оптимизировать /tasks Query B и C (NOT EXISTS с date range) ✅

**Файл:** `src/app/api/extension/stores/[storeId]/tasks/route.ts:243-308`

**Проблема:** `NOT EXISTS (SELECT 1 FROM review_chat_links WHERE ... AND review_date BETWEEN r.date - 2min AND r.date + 2min)` — range scan на каждую строку reviews.

**Решение варианта A:** Добавить composite индекс на review_chat_links:
```sql
CREATE INDEX idx_rcl_matching
ON review_chat_links(store_id, review_nm_id, review_rating, review_date);
```

**Решение варианта B:** Заменить `BETWEEN date - 2min AND date + 2min` на точное совпадение `DATE_TRUNC('minute', review_date)`:
```sql
AND rcl.review_date_trunc = DATE_TRUNC('minute', r.date)
```
Потребует добавить computed column `review_date_trunc` в review_chat_links.

**Ожидаемый эффект:** Спайки на больших магазинах: 13-21с → <1с.

**Оценка:** 2 часа (вариант A — только индекс).

---

### TASK-004: Кэширование GET /stores (in-memory TTL) ✅

**Файл:** `src/app/api/extension/stores/route.ts`

**Проблема:** Одинаковый ответ 91 магазинов (15KB) вычисляется с нуля каждый раз.

**Решение:** In-memory cache с TTL 30 секунд, ключ = `userId`:

```ts
const storesCache = new Map<string, { data: any; expiresAt: number }>();

function getCachedStores(userId: string) {
  const entry = storesCache.get(userId);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCachedStores(userId: string, data: any) {
  storesCache.set(userId, { data, expiresAt: Date.now() + 30_000 });
}
```

**Ожидаемый эффект:** После первого запроса: 1.1с → <5мс (30 секунд).

**Оценка:** 1 час.

---

### TASK-005: Добавить Cache-Control заголовки ✅

**Файлы:** Все GET-эндпоинты в `src/app/api/extension/`

**Проблема:** Нет `Cache-Control` → Cloudflare не кэширует, extension не кэширует.

**Решение:**

```ts
// GET /stores — данные меняются редко
'Cache-Control': 'private, max-age=30'

// GET /tasks, /complaints — данные актуальные, но допустим stale
'Cache-Control': 'private, max-age=10'

// GET /rules — почти статика
'Cache-Control': 'private, max-age=60'
```

**Примечание:** `private` — нельзя кэшировать в CDN (данные авторизованные). Но extension может кэшировать локально.

**Ожидаемый эффект:** Extension может не перезапрашивать данные при повторном обращении в пределах TTL.

**Оценка:** 1 час.

---

## Фаза 3: Архитектурные улучшения (P2) ✅ DONE

### TASK-006: Параллелизация в /complaints ✅

**Файл:** `src/app/api/extension/stores/[storeId]/complaints/route.ts:104-148`

**Проблема:** Complaints query и Stats query выполняются последовательно, хотя независимы.

**Решение:** Обернуть в `Promise.all([complaintsQuery, statsQuery])`.

**Ожидаемый эффект:** Время: ~460мс → ~230мс.

**Оценка:** 30 минут.

---

### TASK-007: Оптимизировать /reparse (2-step strategy) ✅

**Файл:** `src/app/api/extension/stores/[storeId]/reviews/reparse/route.ts:94-181`

**Проблема:** 3-way JOIN (reviews + products + product_rules) в COUNT и UPDATE.

**Решение:** Применить ту же 2-step стратегию: загрузить eligible product_ids, затем UPDATE с `product_id = ANY(...)`.

**Ожидаемый эффект:** 1.87с → ~500мс.

**Оценка:** 2 часа.

---

### TASK-008: Объединить auth + store check в /tasks и /complaints — SKIPPED

**Причина пропуска:** Auth уже кэширован in-memory (api-key-cache.ts), store check — PK lookup (~1мс). Выигрыш маргинален (~10мс на запрос) при значительном усложнении кода.

---

## Фаза 4: Мониторинг и рейт-лимит (P3)

### TASK-009: Облегчить /health (убрать DB запросы из fast path)

**Файл:** `src/app/api/health/route.ts`

**Проблема:** Health делает 2 SQL запроса — при полном pool это замедляет сам health check.

**Решение:** Добавить `?quick=true` параметр:
- `?quick=true` → только in-memory данные (uptime, cron status), без DB
- По умолчанию → полная проверка с DB

**Оценка:** 30 минут.

---

### TASK-010: Поднять rate limit 100 → 300/min

**Файл:** `src/app/api/extension/stores/route.ts:23` и `src/lib/rate-limiter.ts:19`

**Проблема:** 50 магазинов × 5 endpoints = 250 запросов/цикл. Лимит 100/мин недостаточен.

**Решение:** Поднять до 300/мин. После оптимизаций запросы будут быстрее → extension будет чаще попадать в rate limit.

**Оценка:** 15 минут.

---

### TASK-011: Добавить server-side timing логи

**Файлы:** Все extension API endpoints.

**Проблема:** Нет видимости "что именно тормозит" — DB, network, serialization.

**Решение:** Добавить `Server-Timing` заголовок:
```
Server-Timing: auth;dur=2, db;dur=145, serialize;dur=5, total;dur=152
```

**Оценка:** 2 часа.

---

## Фаза 5: Будущие оптимизации (P3+, после измерений)

### TASK-012: Bulk endpoint GET /tasks?storeIds=...

Вместо 50 отдельных запросов — один. Требует значительной переработки, но даёт максимальный эффект (50 HTTP → 1 HTTP, 200+ SQL → ~10 SQL).

**Оценка:** 8-10 часов. Делать после Фаз 1-3 если результаты недостаточны.

### TASK-013: Lightweight /stores/list (без counts)

Быстрый список магазинов `[{id, name, isActive}]` без агрегированных counts для начальной загрузки расширения.

**Оценка:** 1 час.

---

## Приоритетный план внедрения

| Фаза | Задачи | Время | Ожидаемый результат |
|------|--------|-------|---------------------|
| **Фаза 1** | TASK-001, TASK-002 | 7-8ч | 214с → ~60с (устранение N+1) |
| **Фаза 2** | TASK-003, TASK-004, TASK-005 | 4ч | 60с → ~25с (кэш + индексы) |
| **Фаза 3** | TASK-006, TASK-007, TASK-008 | 3.5ч | 25с → ~20с (мелкие оптимизации) |
| **Фаза 4** | TASK-009, TASK-010, TASK-011 | 3ч | Мониторинг + запас по rate limit |
| **Фаза 5** | TASK-012, TASK-013 | 10ч | ~20с → <10с (bulk API) |

**Итого Фазы 1-3:** ~15 часов → целевое время 50 магазинов: **~20-25с** (в 10x быстрее).

---

## Критерии успеха

1. **50 stores sequential scan < 30 секунд** (was 214с)
2. **0 HTTP 500** на любом магазине (МакШуз ООО)
3. **GET /stores < 300мс** при холодном кэше, **<10мс** при горячем
4. **POST /review-statuses < 200мс** при 100 reviews
5. **Нет спайков > 5с** на отдельных магазинах

---

## Зависимости и риски

| Риск | Митигация |
|------|-----------|
| Batch UPDATE может изменить поведение review-statuses sync | Покрыть юнит-тестами current behavior перед рефакторингом |
| Индекс `idx_rcl_matching` добавит нагрузку на INSERT/UPDATE rcl | Partial index, таблица маленькая (~700 строк) |
| In-memory cache `/stores` — stale data 30с | Допустимо для extension (counts не critical) |
| pgBouncer ограничения | Мониторить через `SHOW POOLS` на pgBouncer |
