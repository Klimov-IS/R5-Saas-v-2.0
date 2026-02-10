# TASK-20260210: Оптимизация производительности таба "Отзывы"

**Статус:** Выполнено (готово к деплою)
**Дата:** 2026-02-10
**Приоритет:** High

---

## Goal

Оптимизировать загрузку и фильтрацию отзывов для магазинов с сотнями тысяч записей. Текущий запрос с `COUNT(*) OVER()` и постоянным `LEFT JOIN review_complaints` деградирует на больших объёмах.

## Current State

- **Функция:** `getReviewsByStoreWithPagination()` в `src/db/helpers.ts:1319-1481`
- **Проблема:** Один SQL-запрос делает `COUNT(*) OVER()` + `LEFT JOIN` + данные. PostgreSQL вынужден материализовать ВСЕ строки результата перед применением LIMIT/OFFSET.
- **Фильтр productId:** `LIKE '%_' || $X` — suffix match, не использует индекс.
- **Фильтр productStatus:** `EXISTS (SELECT 1 FROM products ...)` — коррелированный подзапрос на каждую строку.

## Proposed Changes

### A. Разделение COUNT и DATA запросов (главный выигрыш)
- COUNT-запрос: `SELECT COUNT(*) FROM reviews r WHERE ...` — без JOIN, без ORDER BY
- DATA-запрос: `SELECT r.*, rc.* FROM reviews r LEFT JOIN ... ORDER BY ... LIMIT/OFFSET`
- Выполняются параллельно через `Promise.all()`

### B. Условный JOIN complaints
- COUNT-запрос: без LEFT JOIN (используем денормализованное `r.complaint_status`)
- DATA-запрос: LEFT JOIN сохраняется (нужен для отображения данных жалобы)

### C. Точное совпадение productId вместо LIKE
- Было: `r.product_id LIKE '%_' || $nmId` (suffix match, full scan)
- Стало: `r.product_id = $full_id` где `full_id = storeId + '_' + nmId` (index lookup)

### D. Frontend: keepPreviousData
- React Query `placeholderData: keepPreviousData` — показывает старые данные пока грузятся новые

## Impact

- **DB:** Никаких миграций. Те же таблицы, те же индексы.
- **API:** Контракт не меняется (`{ data, totalCount }`). Внутренняя оптимизация.
- **Cron:** Не затронут.
- **AI:** Не затронут.
- **UI:** Более быстрые переключения фильтров и пагинации.

## Files Modified

| Файл | Изменение |
|------|-----------|
| `src/db/helpers.ts` | Рефакторинг `getReviewsByStoreWithPagination()`: extract WHERE builder, split queries |
| `src/app/stores/[storeId]/reviews/page.tsx` | `placeholderData: keepPreviousData` |

## Required Docs Updates

- `docs/domains/` — если нужно
- Memory файл — паттерн оптимизации

## Rollout Plan

1. Изменения в коде
2. TypeScript check
3. Deploy
4. Мониторинг времени загрузки

## Backout Plan

Откатить коммит. Старая функция заменяется новой с тем же API — можно git revert.
