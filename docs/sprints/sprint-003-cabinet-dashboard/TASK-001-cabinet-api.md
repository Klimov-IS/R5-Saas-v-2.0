# TASK-001: Cabinet API — Backend endpoint

> **Статус:** Planning
> **Приоритет:** P0
> **Фаза:** Phase 1 (MVP)
> **Sprint:** 003

---

## Goal

Создать единый API endpoint `GET /api/stores/[storeId]/cabinet` который возвращает все метрики для таба "Кабинет", используя только существующие таблицы.

## Current State

Данные есть, но разбросаны по разным эндпоинтам:
- `/api/stores/[storeId]` — базовая информация о магазине
- `/api/stores/[storeId]/reviews/stats` — статистика отзывов (неполная)
- `/api/dashboard/stats` — глобальная статистика (не per-store)
- Нет единого endpoint для профиля одного магазина

## Proposed Change

### 1. Новый endpoint: `GET /api/stores/[storeId]/cabinet`

Один запрос — вся информация. Внутри выполняем 6-8 параллельных SQL-запросов.

### 2. SQL-запросы (все на существующих таблицах)

**Query 1: Store info** (уже есть в helpers.ts)
```sql
SELECT id, name, marketplace, status, created_at, updated_at,
       total_reviews, total_chats, chat_tag_counts,
       ai_instructions,
       last_product_update_status, last_product_update_date,
       last_review_update_status, last_review_update_date,
       last_chat_update_status, last_chat_update_date
FROM stores WHERE id = $1
```

**Query 2: Product counts**
```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE pr.work_in_chats = TRUE OR pr.submit_complaints = TRUE) AS active
FROM products p
LEFT JOIN product_rules pr ON pr.product_id = p.id
WHERE p.store_id = $1
```

**Query 3: Rating breakdown**
```sql
SELECT rating, COUNT(*) AS count
FROM reviews
WHERE store_id = $1
GROUP BY rating
ORDER BY rating DESC
```

**Query 4: Complaint stats**
```sql
SELECT
  COUNT(*) FILTER (WHERE status IN ('sent','approved','rejected','pending','reconsidered')) AS filed,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft
FROM review_complaints rc
JOIN reviews r ON rc.review_id = r.id
WHERE r.store_id = $1
```

**Query 5: Deleted reviews count**
```sql
SELECT COUNT(*) AS deleted_count
FROM reviews
WHERE store_id = $1 AND deleted_from_wb_at IS NOT NULL
```

**Query 6: Product rules aggregation**
```sql
SELECT
  COUNT(*) FILTER (WHERE complaint_rating_1) AS cr1,
  COUNT(*) FILTER (WHERE complaint_rating_2) AS cr2,
  COUNT(*) FILTER (WHERE complaint_rating_3) AS cr3,
  COUNT(*) FILTER (WHERE chat_rating_1) AS chr1,
  COUNT(*) FILTER (WHERE chat_rating_2) AS chr2,
  COUNT(*) FILTER (WHERE chat_rating_3) AS chr3,
  COUNT(*) FILTER (WHERE chat_rating_4) AS chr4,
  MODE() WITHIN GROUP (ORDER BY chat_strategy) AS main_strategy,
  COUNT(*) FILTER (WHERE offer_compensation) AS with_compensation,
  MAX(max_compensation) AS max_compensation,
  MODE() WITHIN GROUP (ORDER BY compensation_type) AS main_comp_type
FROM product_rules pr
JOIN products p ON p.id = pr.product_id
WHERE p.store_id = $1 AND (pr.work_in_chats OR pr.submit_complaints)
```

**Query 7: Auto-sequences**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) AS total
FROM chat_auto_sequences cas
JOIN chats c ON cas.chat_id = c.id
WHERE c.store_id = $1
```

**Query 8: AI stats**
```sql
SELECT
  COUNT(*) FILTER (WHERE sf.is_active) AS faq_active
FROM store_faq sf WHERE sf.store_id = $1;

SELECT
  COUNT(*) FILTER (WHERE sg.is_active) AS guides_active
FROM store_guides sg WHERE sg.store_id = $1;
```

**Query 9: Telegram**
```sql
SELECT
  tu.is_notifications_enabled,
  (SELECT MAX(sent_at) FROM telegram_notifications_log tnl WHERE tnl.store_id = $1) AS last_notification
FROM telegram_users tu
JOIN users u ON tu.user_id = u.id
JOIN stores s ON s.owner_id = u.id
WHERE s.id = $1
```

**Query 10: TG queue count**
```sql
SELECT COUNT(DISTINCT rcl.chat_id) AS queue_count
FROM review_chat_links rcl
JOIN chats c ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
WHERE rcl.store_id = $1 AND c.status != 'closed'
```

### 3. Файлы

- `src/app/api/stores/[storeId]/cabinet/route.ts` — API route
- `src/db/cabinet-helpers.ts` — SQL queries + response builder

### 4. Кэширование

- `staleTime: 2 * 60 * 1000` (2 мин) в React Query
- Prefetch в `layout.tsx` вместе с другими табами
- Инвалидация при sync операциях

## Impact

### DB
- Нет изменений схемы. Только SELECT запросы.

### API
- Новый: `GET /api/stores/[storeId]/cabinet`

### Cron
- Нет изменений

### AI
- Нет изменений

### UI
- Данные потребляются в TASK-002

## Required Docs Updates
- `docs/reference/api.md` — добавить endpoint
- `docs/database-schema.md` — нет изменений

## Rollout Plan
1. Создать `cabinet-helpers.ts` с SQL-запросами
2. Создать API route
3. Протестировать на 3 магазинах (малый, средний, крупный)
4. Добавить prefetch в layout.tsx
5. Deploy

## Backout Plan
- Удалить route и helpers. Никаких миграций — откат мгновенный.

## Estimated Effort
- ~3-4 часа
