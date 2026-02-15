# TASK: Оптимизация медленной загрузки магазинов в Extension API

**Дата:** 2026-02-15
**Приоритет:** Высокий
**Статус:** Реализовано
**Компонент:** `GET /api/extension/stores`, `src/lib/stores-cache.ts`

---

## Goal

Сократить время ответа `GET /api/extension/stores` с 10-30+ секунд до < 500 мс.

## Current State

- Endpoint использует in-memory кэш с CRON-прогревом каждые 5 мин
- При cache miss (рестарт, первый запрос) выполняется тяжёлый SQL inline
- SQL: **коррелированный подзапрос** с 3-table JOIN (reviews + review_complaints + products), выполняется N раз (по 1 на магазин)
- Для пользователя с 65 магазинами: 65 подзапросов, каждый с 3-table JOIN
- Таблица `review_complaints` уже имеет `store_id` и `product_id` напрямую — JOIN через `reviews` избыточен

**Источник задачи:** Команда расширения (Extension Team), файл `R5 подача жалоб/docs/TASK/TASK-20260215-slow-stores-loading.md`

## Proposed Change

### 1. Оптимизация SQL в `refreshCacheForUser()` (stores-cache.ts)

**Было:** Коррелированный подзапрос с 3-table JOIN, N раз
```sql
SELECT s.*, COALESCE(
  (SELECT COUNT(*) FROM reviews r
   JOIN review_complaints rc ON r.id = rc.review_id
   JOIN products p ON r.product_id = p.id
   WHERE r.store_id = s.id AND rc.status = 'draft' AND p.work_status = 'active'
  ), 0) as draft_complaints_count
FROM stores s WHERE s.owner_id = $1
```

**Стало:** Один LEFT JOIN + GROUP BY, без таблицы reviews
```sql
SELECT s.*, COALESCE(cnt.draft_count, 0) as draft_complaints_count
FROM stores s
LEFT JOIN (
  SELECT rc.store_id, COUNT(*) as draft_count
  FROM review_complaints rc
  JOIN products p ON rc.product_id = p.id
  WHERE rc.status = 'draft' AND p.work_status = 'active'
  GROUP BY rc.store_id
) cnt ON cnt.store_id = s.id
WHERE s.owner_id = $1
```

### 2. Новый partial index (миграция 013)
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_complaints_draft_store_product
ON review_complaints(store_id, product_id) WHERE status = 'draft';
```

## Impact

- **DB:** Новый partial index (миграция 013), изменён SQL-запрос (только SELECT)
- **API:** Тот же endpoint, тот же формат ответа, ускорение времени ответа
- **Cron:** Без изменений (stores-cache-refresh каждые 5 мин)
- **AI:** Не затронуто
- **UI:** Расширение загружает магазины быстрее

## Required Docs Updates

- [x] `docs/database-schema.md` — новый индекс
- [x] `docs/tasks/TASK-20260215-slow-stores-loading.md` — этот файл

## Rollout Plan

1. Применить миграцию 013 на проде (CREATE INDEX CONCURRENTLY — без блокировки)
2. Деплой кода (оптимизированный SQL в stores-cache.ts)
3. Проверить логи: время cache miss должно быть < 500 мс
4. Подтвердить с Extension Team улучшение

## Backout Plan

- Миграция: `DROP INDEX idx_complaints_draft_store_product;`
- Код: git revert коммита с изменением SQL
- Существующие индексы покрывают старый запрос — откат безопасен
