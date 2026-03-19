# Backend Research: Extension API Performance — 2026-03-19

> **Контекст:** Ответ на Audit.md от команды расширения.
> **Исследователь:** Backend (Claude Code)
> **Цель:** Найти корневые причины деградации и составить план исправлений.

---

## 1. Архитектура (реальная, не гипотезы аудита)

Аудит предполагает serverless/Vercel — **это неверно**. Наша архитектура:

| Компонент | Реальность |
|-----------|-----------|
| Runtime | PM2 fork mode, 1 инстанс Next.js (`wb-reputation`) |
| Server | Yandex Cloud VM, 2 vCPU, 4GB RAM, Ubuntu 24.04 |
| DB | Yandex Managed PostgreSQL, подключение через pgBouncer (порт 6432) |
| CDN | Cloudflare (SSL Full Strict, Proxied) |
| Pool | `pg.Pool`, max=20, min=5, idleTimeout=30s, connectionTimeout=10s |

**Следствие:** "cold start" в аудите — это НЕ serverless spinup, а первое подключение к pgBouncer / connection pool warm-up.

---

## 2. Анализ Connection Pool

**Файл:** `src/db/client.ts`

```
max: 20          // максимум соединений в пуле
min: 5           // минимум (keep-alive)
idleTimeoutMillis: 30000      // закрыть idle через 30с
connectionTimeoutMillis: 10000 // таймаут получения из пула 10с
statement_timeout: 60000       // убить запрос через 60с
```

### Проблема: pgBouncer на порту 6432

Yandex Managed PostgreSQL на порту 6432 = **pgBouncer в transaction pooling mode**. Это критически важно:

- pgBouncer имеет свой `max_client_conn` (обычно 100-200)
- В transaction mode: `PREPARE` / `DEALLOCATE` / `SET` / advisory locks **не работают** между запросами
- `statement_timeout` на клиенте отправляет `SET statement_timeout = 60000` через pgBouncer — **может не работать** в transaction mode
- `min: 5` connections warm — pgBouncer может их переиспользовать, но Node.js Pool думает что они его

### Корневая причина деградации: Pool Contention

При 50 последовательных запросах к `/tasks`:
1. Каждый запрос делает **5 параллельных SQL-запросов** (Promise.all) — забирает 5 connections
2. + auth query (1 connection, но кэширована)
3. + store check (1 connection)
4. Итого до **7 connections на запрос** при пике

Если Next.js обрабатывает 2-3 HTTP запроса одновременно → `7 * 3 = 21 connections` → **превышает max=20** → ожидание в очереди pool → спайки.

### Почему спайки каждые 10-15 запросов?

Node.js `pg.Pool` при нехватке соединений ставит запросы в очередь. Когда запросы с разными "весами" (тяжёлый магазин vs лёгкий) попадают в пул одновременно:
- Лёгкий магазин: 4 запроса × 50мс = освобождает за 200мс
- Тяжёлый магазин: 4 запроса × 500мс = держит 4 connections 500мс
- Очередной запрос ждёт освобождения → спайк 5-21с

---

## 3. Эндпоинт `/stores` — анализ

**Файл:** `src/app/api/extension/stores/route.ts`

### Текущая стратегия (v3.0.0):

```
Step 1: 2 параллельных запроса (~20ms)
  - SELECT stores WHERE owner_id = $1
  - SELECT products+product_rules WHERE store_id IN (subquery)

Step 2: 3 параллельных запроса (основная нагрузка)
  - Q1b: stores с draft complaints (EXISTS subquery) — ОДНИМ запросом
  - Q2: stores с pending status parses — ЦИКЛ ПО МАГАЗИНАМ (!!!)
  - Q3: stores с pending chats — ЦИКЛ ПО МАГАЗИНАМ (!!!)
```

### Критическая находка: N+1 в Q2 и Q3

**Q2** (`statusParsesResult`) — это `async () => {}` с **циклом `for...of`**:
```js
for (const storeId of activeStoreIds) {  // 62 итерации!
  const exists = await queryWithTimeout(...)  // 1 SQL запрос каждая
}
```

**Q3** (`pendingChatsResult`) — аналогичный цикл:
```js
for (const storeId of chatStageStoreIds) {
  const exists = await queryWithTimeout(...)
}
```

Это **N+1 в чистом виде**: 62 активных магазина × 2 цикла = **~124 последовательных SQL запроса**. При 10мс на запрос = 1.24с минимум, при нагрузке — до 6.9с.

`queryWithTimeout` с 8с таймаутом маскирует проблему — если запрос долгий, возвращает пустой результат.

### Рекомендация:

Q2 и Q3 должны быть **одним SQL запросом каждый** с GROUP BY store_id, без цикла.

---

## 4. Эндпоинт `/tasks` — анализ

**Файл:** `src/app/api/extension/stores/[storeId]/tasks/route.ts` (v2.0.0)

### Текущая стратегия (уже оптимизированная):

```
Step 1: loadEligibleProducts() — 1 JOIN запрос (~10ms) ✓
Step 2: 4 параллельных запроса:
  - Query A: statusParses (reviews + products, WHERE product_id = ANY)
  - Query B: chatOpens (reviews + review_complaints + products, WHERE product_id = ANY)
  - Query C: chatLinks (reviews + products, WHERE product_id = ANY)
  - Query D: complaints (review_complaints + reviews + products)
Step 3: JS post-filtering + grouping
```

### Находки:

1. **Индекс `idx_reviews_tasks_eligible` (migration 034)** — покрывает Query A. Это partial index на `(store_id, product_id, rating, date)` с WHERE clause. Хорошо.

2. **Query B и Query C** используют `NOT EXISTS (SELECT 1 FROM review_chat_links ...)` с complex WHERE включая `BETWEEN r.date - interval '2 minutes' AND r.date + interval '2 minutes'`. Этот NOT EXISTS сканирует review_chat_links для каждой строки reviews.

3. **Query D** фильтрует через `review_complaints` начиная с `rc.store_id = $1 AND rc.status = 'draft'` — покрыт индексом `idx_complaints_store_draft_review`.

4. **Все 4 запроса выполняются через `Promise.all`** — забирают до 4 connections из пула одновременно.

### Почему МакШуз ООО таймаутит:

28 draft complaints, 20+ артикулов → Query D возвращает 28 строк (быстро), но Query A может возвращать сотни строк с heavy NOT EXISTS subquery, и Query B/C тоже тяжёлые. При одновременном выполнении 4 тяжёлых запросов на одном магазине + pool contention от предыдущих запросов → timeout.

### Рекомендация:

1. Запросы B и C: заменить `NOT EXISTS (... BETWEEN date - 2min AND date + 2min)` на JOIN с review_chat_links по store_id + review_nm_id (без date range)
2. Рассмотреть выполнение Auth + Store check в одном запросе (вместо 2 последовательных)

---

## 5. Эндпоинт `/complaints` — анализ

**Файл:** `src/app/api/extension/stores/[storeId]/complaints/route.ts`

### Стратегия:
```
1. Auth (cached) + Store check — 2 последовательных запроса
2. Complaints query — 1 JOIN (review_complaints + reviews + products)
3. Stats query — аналогичный JOIN с GROUP BY
```

### Находки:

1. **Два почти одинаковых SQL запроса** (complaints + stats) — один с LIMIT, другой с GROUP BY. Выполняются **последовательно**, хотя могут параллельно.

2. **Индекс `idx_complaints_store_draft_review`** покрывает `rc.store_id + rc.status='draft'` — хорошо.

3. Stats запрос можно убрать — данные считаются из основного запроса в JS (uже частично сделано для rating).

### Рекомендация:

Выполнять complaints + stats **параллельно** через Promise.all. Или убрать stats запрос и считать из complaints.

---

## 6. Эндпоинт `/review-statuses` (POST) — анализ

**Файл:** `src/app/api/extension/review-statuses/route.ts`

### КРИТИЧЕСКАЯ ПРОБЛЕМА: N+1 на стероидах

```js
for (const review of reviews) {   // до 100 итераций
  // 5a. chat_status sync — 1 UPDATE
  // 5b. rating_excluded sync — 1 UPDATE
  // 5c. review_status_wb sync — 1 UPDATE
  // 5c2. product_status sync — 1 UPDATE
  // 5d. complaint_status sync — 1 UPDATE + 1 UPDATE review_complaints
}
```

**До 6 SQL запросов на каждый review × 100 reviews = до 600 SQL запросов за один POST!**

Каждый UPDATE ищет review по `(store_id, product_id, rating, DATE_TRUNC('minute', date))` — **без индекса** на эту комбинацию.

### Рекомендация:

Переписать на batch UPDATE: собрать все изменения в массивы и выполнить 5-6 batch UPDATE с `unnest()` вместо 600 отдельных.

---

## 7. Эндпоинт `/chat/stores/{storeId}/rules` — анализ

**Файл:** `src/app/api/extension/chat/stores/[storeId]/rules/route.ts`

### Стратегия:
```
1. Auth (cached) + Store check — 2 запроса
2. getChatRulesForStore() — 1 JOIN (products + product_rules)
```

Простой эндпоинт. Запрос оптимален. Проблем не найдено.

---

## 8. Эндпоинт `/health` — анализ

**Файл:** `src/app/api/health/route.ts`

### Почему бывают спайки до 3.88с:

Health делает **3 SQL запроса**:
1. `SELECT NOW(), version()` — проверка DB
2. `SELECT COUNT(*) FROM chat_auto_sequences WHERE status = 'active'` — активные sequences
3. Rate limiter check (in-memory, быстро)

Спайк 3.88с — это когда DB connection pool заполнен от предыдущих запросов и health ждёт в очереди на получение connection.

---

## 9. Эндпоинт `/reparse` — анализ

**Файл:** `src/app/api/extension/stores/[storeId]/reviews/reparse/route.ts`

### Проблема:

2 тяжёлых запроса с **3-way JOIN** (reviews + products + product_rules):
1. COUNT query — подсчитывает количество review для reset
2. UPDATE query — сбрасывает статусы

Оба делают `JOIN product_rules pr ON pr.product_id = p.id` с complex WHERE. Для магазинов с тысячами reviews это может быть 1-2с.

### Рекомендация:

Применить ту же 2-step стратегию как в `/tasks`: сначала загрузить eligible product_ids, затем UPDATE с `product_id = ANY(...)`.

---

## 10. Сводная таблица проблем

| # | Эндпоинт | Проблема | Тип | Импакт |
|---|----------|----------|-----|--------|
| 1 | Все | Pool contention (max=20, pgBouncer) | Connection Pool | P0 — основная причина деградации |
| 2 | `/stores` | N+1 цикл: 62 EXISTS запроса × 2 | N+1 Query | P0 — 1.1с минимум |
| 3 | `/review-statuses` POST | До 600 UPDATE за запрос | N+1 Query | P1 — 310мс сейчас, но блокирует pool |
| 4 | `/tasks` B/C | NOT EXISTS с BETWEEN date range | Slow Subquery | P1 — причина спайков на больших магазинах |
| 5 | `/complaints` | Два одинаковых запроса последовательно | Sequential | P2 — удвоение времени |
| 6 | `/reparse` | 3-way JOIN count + update | Heavy Query | P2 — 1.87с на 53 review |
| 7 | Все GET | Нет Cache-Control заголовков | No Caching | P2 — каждый запрос бьёт origin |
| 8 | `/health` | SQL запросы в health check | Design | P3 — should be fast-path |
| 9 | `/stores` | Нет server-side кэша | No Caching | P1 — можно 1.1с → <50мс |

---

## 11. Глубинная корневая причина

Все проблемы сводятся к **двум факторам**:

### Фактор 1: Pool Contention

`max=20` connections при:
- 4-7 connections на `/tasks` запрос
- 124+ connections на `/stores` запрос (цикл)
- 600 connections на `/review-statuses` POST
- PM2 fork = 1 инстанс = 1 pool = **одна точка конкуренции**

Когда extension обрабатывает 50 магазинов, накладывается:
- HTTP запрос 1: `/tasks` (держит 5 connections)
- HTTP запрос 2: `/stores` (делает 124 sequential queries)
- Cron jobs в том же процессе (тоже забирают connections)

→ Pool исчерпан → запросы в очереди → спайки → timeouts

### Фактор 2: N+1 паттерны в критических эндпоинтах

| Эндпоинт | Паттерн | Кол-во SQL |
|----------|---------|------------|
| `/stores` Q2+Q3 | for...of цикл с await | 62+62 = 124 |
| `/review-statuses` POST | for...of цикл с await | до 600 |

Эти эндпоинты монополизируют pool connections в серии sequential запросов, блокируя остальные.

---

## 12. Рекомендация по Connection Pool

### Текущее:
```
max: 20, min: 5 (через pgBouncer порт 6432)
```

### Рекомендуемое:
```
max: 10, min: 2 (через pgBouncer)
```

**Парадокс:** нужно УМЕНЬШИТЬ pool size. Причина: pgBouncer на Yandex Cloud имеет свой лимит (обычно 50-100 server connections). 20 connections от одного клиента + cron процесс (ещё 20) = 40 connections → pgBouncer может стать bottleneck.

Вместо увеличения pool → **уменьшить количество SQL запросов** (устранить N+1).

### Альтернатива: прямое подключение к PostgreSQL

Порт 6432 = pgBouncer. Порт **6432** (Yandex Managed по умолчанию использует только pgBouncer). Для прямого подключения нужно проверить, доступен ли порт 5432.

Прямое подключение позволит:
- Prepared statements (более эффективные повторные запросы)
- Session-level statement_timeout (работает надёжно)
- Больше соединений без pgBouncer overhead
