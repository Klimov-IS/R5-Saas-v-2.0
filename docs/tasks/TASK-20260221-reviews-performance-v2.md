# TASK-20260221: Оптимизация загрузки отзывов — Keyset Pagination + ленивая загрузка

**Статус:** Планирование
**Дата:** 2026-02-21
**Приоритет:** High
**Предшественник:** TASK-20260210-reviews-performance-optimization (Completed)

---

## Goal

Устранить деградацию производительности страницы Отзывы при росте объёма данных.
Сейчас 2.6M отзывов — страница уже тормозит. При 26M система станет непригодной.

---

## Current State

### Архитектура (что есть сейчас)

- **API:** `GET /api/stores/{storeId}/reviews?skip=N&take=M&...filters`
- **DB helper:** `getReviewsByStoreWithPagination()` в `src/db/helpers.ts:1625`
- **Пагинация:** LIMIT/OFFSET (skip/take)
- **COUNT:** Отдельный `SELECT COUNT(*)` в `Promise.all()` с DATA-запросом
- **JOIN:** `LEFT JOIN review_complaints rc ON r.id = rc.review_id`
- **Сортировка:** `ORDER BY r.date DESC`
- **UI:** Жёсткая пагинация с кнопками "←→" и "Страница N из M"
- **Размер страницы:** 50 (по умолчанию), настраивается: 50/100/200/500

### Бенчмарк-результаты (21.02.2026, Yandex Managed PostgreSQL)

#### Размеры магазинов

| Магазин | Отзывов | Доля в БД |
|---|---|---|
| Тайди-Центр | 1,406,812 | 53% |
| МакШуз | 263,870 | 10% |
| Мамедов Рафик | 124,807 | 5% |
| Остальные 57+ | < 82K | 32% |
| **ИТОГО** | **2,651,620** | 100% |

#### Результаты замеров

| Операция | Тайди (1.4M) | Средний (82K) | Мелкий (23K) |
|---|---|---|---|
| COUNT (rating 1-3) | **2,100ms** | 53ms | 154ms |
| DATA page 1 (50 rows) | 387ms | 419ms | - |
| DATA page 1 без JOIN | 931ms | 858ms | - |
| **OFFSET 5000** | **249,640ms (4 мин!)** | 10,693ms | - |
| **Keyset (date < cursor)** | **81ms** | - | - |
| Global COUNT (вся БД) | 17,659ms | - | - |

#### EXPLAIN ANALYZE — что на самом деле происходит

**DATA-запрос (page 1, Тайди-Центр):**
```
Execution Time: 2.951 ms  (при hot cache)
Index Scan using idx_reviews_store_date → Filter rating → 944 rows removed
Nested Loop Left Join → Index Scan using idx_complaints_review
Buffers: shared hit=1090
```
Индексы работают. **Проблема не в запросе первой страницы — проблема в COUNT и OFFSET.**

**COUNT-запрос (Тайди-Центр):**
```
Execution Time: 24.466 ms  (hot cache)
Index Only Scan using idx_reviews_store_rating — 70,361 rows scanned
```
На cold cache: **2-3 секунды** (данные читаются с диска).

### Три критические проблемы

#### 1. COUNT = бесполезная нагрузка
Каждая загрузка страницы = `SELECT COUNT(*)` по всем отзывам магазина с текущими фильтрами.
Нужен ТОЛЬКО для "Страница 3 **из 1407**". Пользователь никогда не перейдёт на страницу 1407.

- Тайди-Центр: 2,100ms на cold cache
- При 26M записей: ~20+ секунд

#### 2. OFFSET — экспоненциальная деградация
`OFFSET 5000` = PostgreSQL сортирует и ПРОПУСКАЕТ 5000 строк. Каждая дополнительная страница — медленнее.

| OFFSET | Тайди-Центр |
|---|---|
| 0 | 387ms |
| 5000 | **249,640ms (4 мин!)** |
| 50000 | timeout (оценка) |

Keyset pagination: `WHERE r.date < $cursor ORDER BY r.date DESC LIMIT 50` → **81ms** на любой глубине.

#### 3. Cold cache на первую загрузку
COUNT + DATA = 3-6 секунд для крупного магазина при первом заходе.

---

## Proposed Changes

### A. Keyset Pagination (backend) — критический fix

**Суть:** вместо `OFFSET N` используем `WHERE r.date < $lastDate ORDER BY r.date DESC LIMIT 50`.

**Изменения в `ReviewsFilterOptions`:**
```typescript
export type ReviewsFilterOptions = {
  limit?: number;
  // offset?: number;          // УДАЛИТЬ
  cursor?: string;             // НОВОЕ: ISO date последнего отзыва на предыдущей странице
  // ... остальные фильтры без изменений
};
```

**Изменения в SQL:**
```sql
-- Было:
ORDER BY r.date DESC LIMIT 50 OFFSET 5000

-- Стало:
WHERE ... AND r.date < $cursor   -- если cursor передан
ORDER BY r.date DESC LIMIT 51    -- +1 чтобы знать "есть ли ещё"
```

**API контракт (новый):**
```
GET /api/stores/{storeId}/reviews?take=50&cursor=2025-12-02T09:32:55.000Z&rating=1,2,3...

Response:
{
  "data": [...50 reviews...],
  "nextCursor": "2025-11-28T14:21:00.000Z",  // date последнего элемента или null
  "hasMore": true                              // есть ли ещё страницы
}
```

**Обратная совместимость:** `skip/take` остаётся рабочим (deprecated), новый параметр `cursor` приоритетнее.

### B. Убрать COUNT из основного запроса

**Вместо `totalCount`** — возвращаем `hasMore: boolean`.

Определяется просто: запрашиваем `LIMIT N+1`, если вернулось N+1 строк → `hasMore = true`, возвращаем только первые N.

**Приблизительный COUNT (опционально):**
Для отображения "~70K отзывов" в заголовке — однократный запрос при первом заходе, кэшируется на 5 мин. Или использовать `pg_class.reltuples` (мгновенный, но без фильтров).

### C. UI: "Загрузить ещё" вместо номеров страниц

**Вариант 1 (рекомендуемый): Кнопка "Загрузить ещё"**
```
[Фильтры]
[50 отзывов]
[Кнопка "Загрузить ещё"]  ← загружает следующие 50, добавляет к списку
```
- При смене фильтра — сброс, загрузка первых 50
- Нет бесконечного скролла (контролируемая загрузка)
- Нет номеров страниц — не нужен COUNT

**Вариант 2: Infinite scroll**
- Автоматическая подгрузка при скролле до конца
- Intersection Observer API
- Может создать проблемы с рендером при 1000+ строк в DOM

**Вариант 3: Виртуализация + infinite scroll**
- react-virtual / tanstack-virtual
- Рендерит только видимые строки (~20), остальные — виртуальные
- Самый эффективный, но самый сложный

**Рекомендация:** Вариант 1. Простой, предсказуемый, решает 99% проблем.

### D. Совместимость с фильтрами

Keyset pagination **полностью совместима** с текущими фильтрами:

```sql
SELECT r.*, rc.*
FROM reviews r
LEFT JOIN review_complaints rc ON r.id = rc.review_id
WHERE r.store_id = $1
  AND r.rating = ANY($2)          -- фильтр по рейтингу
  AND r.complaint_status = $3     -- фильтр по жалобе
  AND r.date < $cursor            -- keyset cursor
ORDER BY r.date DESC
LIMIT 51
```

Индекс `idx_reviews_store_date (store_id, date DESC)` покрывает `store_id + date` — работает для всех комбинаций фильтров.

**При смене фильтра:** cursor сбрасывается → загружаются первые 50 по новым фильтрам.

### E. Оптимизация для bulk selection

Текущий bulk selection (выделение + генерация жалоб) работает на **загруженных** отзывах. С "Загрузить ещё" пользователь видит все загруженные отзывы и может их выделить. Поведение не меняется.

---

## Impact

| Область | Влияние |
|---|---|
| **DB** | Без миграций. Те же таблицы, те же индексы. |
| **API** | Новые параметры `cursor`, `hasMore`, `nextCursor`. `skip/take` deprecated но работает. |
| **Cron** | Не затронут. |
| **AI** | Не затронут. |
| **UI** | Пагинация "← Страница N из M →" → кнопка "Загрузить ещё". Фильтры без изменений. |

---

## Ожидаемый эффект

| Метрика | Было | Станет |
|---|---|---|
| Первая загрузка (Тайди, cold) | 3-6 сек | **< 1 сек** (нет COUNT) |
| Первая загрузка (средний) | 1-2 сек | **< 0.5 сек** |
| Переход на стр. 100 (Тайди) | **249 сек (timeout)** | **81ms** (keyset) |
| При 26M записей | Непригодно | Без изменений (keyset = O(1)) |

---

## Files to Modify

| Файл | Изменение |
|---|---|
| `src/db/helpers.ts` | `getReviewsByStoreWithPagination()` — добавить cursor, убрать COUNT, LIMIT N+1 |
| `src/db/helpers.ts` | `ReviewsFilterOptions` — `cursor?: string`, убрать `offset` |
| `src/app/api/stores/[storeId]/reviews/route.ts` | Новый параметр `cursor`, ответ с `nextCursor`/`hasMore` |
| `src/app/stores/[storeId]/reviews/page.tsx` | Заменить пагинацию на "Загрузить ещё" |
| `src/hooks/usePersistedFilters.ts` | Без изменений (фильтры сохраняются так же) |

---

## Required Docs Updates

- `docs/reference/api.md` — новый контракт GET /reviews (cursor, hasMore)
- `docs/database-schema.md` — если добавятся индексы
- `docs/DEVELOPMENT.md` — паттерн keyset pagination

---

## Rollout Plan

1. Реализовать backend (cursor в helpers.ts + route.ts)
2. Оставить backward-compatible skip/take
3. Реализовать UI "Загрузить ещё"
4. TypeScript check
5. Deploy
6. Мониторинг: проверить время загрузки для Тайди-Центр
7. Через неделю: удалить deprecated skip/take если не используется

## Backout Plan

Git revert коммита. API backward-compatible (skip/take продолжает работать).

---

## Открытые вопросы

1. **"Загрузить ещё" vs Infinite scroll** — решение: Кнопка (Вариант 1)
2. **Показывать ли приблизительный count?** — "~70K отзывов" в заголовке? Или просто "Отзывы"?
3. **Размер batch** — 50 по умолчанию или увеличить до 100?
4. **Дупликаты при keyset:** если два отзыва имеют одинаковый `date`, возможен пропуск/дубль. Решение: compound cursor `(date, id)` — `WHERE (r.date, r.id) < ($cursor_date, $cursor_id)`
