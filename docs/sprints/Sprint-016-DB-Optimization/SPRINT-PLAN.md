# Sprint 016 — Оптимизация размера БД

**Дата начала:** 2026-04-03
**Цель:** Сократить размер БД с ~7 GB до ~1.5 GB, обеспечить автоматическое управление жизненным циклом данных.

---

## Контекст

БД на Yandex Managed PostgreSQL стоит 5к/мес. Аудит (02.04.2026) показал:

| Таблица | Размер | % от БД | Статус |
|---------|--------|---------|--------|
| reviews_archive (5★) | 3,384 MB | 48% | Не используется в бизнес-процессах |
| ai_logs | 1,704 MB | 24% | **Очищено 03.04** (осталось 8.7K строк) |
| reviews (1-4★) | 749 MB | 11% | Рабочая таблица |
| chats | 574 MB | 8% | **86% очищено 03.04** (OZON stores) |
| Остальное | ~600 MB | 9% | — |

**Уже выполнено (03.04.2026):**
- Удалены 3 OZON-магазина (все inactive): -602,525 строк, -364K чатов
- Очищены ai_logs (мёртвый классификатор + старые логи): -260,353 строки

**Осталось:**
- reviews_archive: 3,384 MB — Task 1
- Данные 26 inactive WB-магазинов: ~645K recoverable строк — Task 2
- VACUUM FULL для физического освобождения места — Task 3

---

## Бэклог

| # | Задача | Приоритет | Зависимости |
|---|--------|-----------|-------------|
| 1 | Удаление reviews_archive + миграция кода | P0 | — |
| 2 | Система автоочистки inactive магазинов | P1 | — |
| 3 | VACUUM FULL (ночь 03→04 апреля, 00:00 MSK) | P0 | После Task 1 |

---

## Task 1: Удаление reviews_archive (5★)

### Цель

Убрать таблицу `reviews_archive` (3,384 MB, 3.2M строк 5★ отзывов) из системы. Сохранить количество 5★ отзывов как агрегат на магазин. Текст 5★ отзывов не хранить.

### Текущее состояние

```
reviews_archive  — 3,384 MB, 3,199,255 строк (CHECK: rating = 5)
reviews          — 749 MB, 406,249 строк (CHECK: rating BETWEEN 1 AND 4)
reviews_all      — VIEW: SELECT * FROM reviews UNION ALL SELECT * FROM reviews_archive
```

**Write routing в коде:**
```js
const targetTable = review.rating === 5 ? 'reviews_archive' : 'reviews';
```

**Читатели `reviews_all` (UNION ALL view):**
- helpers.ts — getReviews, getReviewsByStore, getReviewById, getStoreStats, getStoreRatingBreakdown, фильтры вкладки отзывов
- cabinet-helpers.ts — rating breakdown для дашборда
- extension-helpers.ts — total count, avg rating
- telegram-helpers.ts — LEFT JOIN для чатов (8 мест)
- review-chat-link-helpers.ts — LEFT JOIN для чатов (2 места)
- cron-jobs.ts — auto-close resolved reviews
- review-sync.ts — инкрементальный синк
- extension API routes — батч-обновления, поиск отзывов

**Прямые обращения к `reviews_archive`:**
- helpers.ts — createReview, upsertReview, updateReview (fallback), getReviewById (fallback), deleteStore
- complaint-helpers.ts — fallback UPDATE (4 места)
- extension-helpers.ts — write routing, archive check
- review-sync.ts — mark deleted (fallback), complaint status
- extension routes — review-statuses, complaint-statuses, reparse, sync (дуальные запросы на обе таблицы)

### Целевое состояние

```
reviews          — единственная таблица отзывов (только 1-4★)
stores.review_count_5star  — INTEGER, количество 5★ на магазин
reviews_all      — УДАЛЕНА (view)
reviews_archive  — УДАЛЕНА (таблица)
```

**Поведение синка:** При получении 5★ отзыва с WB/OZON — не сохранять текст, инкрементировать `stores.review_count_5star`.

### Что изменится для пользователя

| Функция | Было | Станет |
|---------|------|--------|
| Вкладка «Отзывы», фильтр 5★ | Показывает текст 5★ | Показывает: «5★: N отзывов» (только число) или убираем фильтр 5★ |
| Кабинет — распределение по рейтингам | 1★:N, 2★:N, 3★:N, 4★:N, 5★:N из reviews_all | Тот же результат, 5★ из stores.review_count_5star |
| Кабинет — средняя оценка | AVG из 3.6M строк | Формула: (sum_1_4 + count_5 * 5) / (total_1_4 + count_5) |
| Расширение — статистика | COUNT + AVG из reviews_all | Формула с подставленным count_5star |
| Расширение — задачи | Только 1-4★ | Без изменений |
| Синк отзывов | Сохраняет все отзывы | Пропускает 5★ текст, считает количество |
| Жалобы | Только 1-3★ | Без изменений |
| Чаты | Только 1-4★ | Без изменений |

### Ограничения

1. **Невозвратимость** — тексты 5★ отзывов будут утеряны. Восстановить можно только через повторный синк с WB API (но мы намеренно не будем сохранять).
2. **Средняя оценка** — будет расчётной, а не по реальным данным. Точность: идентичная (5★ — это всегда ровно 5).
3. **reviews_all view** — все 30+ мест в коде, где используется view, нужно обновить за один деплой.

### План реализации

#### Шаг 1: Миграция БД

```sql
-- 1. Добавить поле на stores
ALTER TABLE stores ADD COLUMN review_count_5star INTEGER NOT NULL DEFAULT 0;

-- 2. Заполнить из текущих данных (перед удалением!)
UPDATE stores s SET review_count_5star = (
  SELECT COUNT(*) FROM reviews_archive ra WHERE ra.store_id = s.id
);

-- 3. Удалить view
DROP VIEW IF EXISTS reviews_all;

-- 4. Удалить таблицу
DROP TABLE reviews_archive;

-- 5. Убрать CHECK constraint на reviews (позволить хранить все рейтинги, если в будущем потребуется)
-- ИЛИ оставить CHECK rating BETWEEN 1 AND 4 если уверены
```

#### Шаг 2: Обновление кода (по файлам)

| Файл | Изменения |
|------|-----------|
| `src/db/helpers.ts` | `reviews_all` → `reviews` (8+ мест). Убрать write routing в createReview/upsertReview (skip 5★). Убрать fallback на archive в getReviewById/updateReview. Обновить getStoreStats/getStoreRatingBreakdown — подмешать count_5star. |
| `src/db/cabinet-helpers.ts` | Rating breakdown: `reviews` + `stores.review_count_5star`. Deleted count: только `reviews`. |
| `src/db/extension-helpers.ts` | Rating stats: подмешать count_5star для total и avg. Write routing: skip 5★. Убрать archive check. |
| `src/db/telegram-helpers.ts` | `reviews_all` → `reviews` (8 мест — механическая замена). |
| `src/db/review-chat-link-helpers.ts` | `reviews_all` → `reviews` (2 места). |
| `src/db/complaint-helpers.ts` | Убрать fallback UPDATE на reviews_archive (4 места). |
| `src/db/repositories/chat-repository.ts` | `reviews_all` → `reviews` (1 место). |
| `src/lib/review-sync.ts` | Пропускать 5★ при upsert. Инкрементировать count_5star. Убрать fallback mark-deleted/complaint на archive. |
| `src/lib/ozon-review-sync.ts` | Убрать reviews_all из SELECT existing IDs. |
| `src/lib/cron-jobs.ts` | `reviews_all` → `reviews` (1 место). |
| `src/app/api/extension/review-statuses/route.ts` | Убрать дуальные запросы на обе таблицы (~6 мест). |
| `src/app/api/extension/complaint-statuses/route.ts` | Убрать дуальные запросы (~2 места). |
| `src/app/api/extension/stores/[storeId]/reviews/sync/route.ts` | Убрать fallback на archive. |
| `src/app/api/extension/stores/[storeId]/reviews/reparse/route.ts` | Убрать дуальный reparse. |
| `src/app/api/extension/stores/[storeId]/reviews/find-by-data/route.ts` | `reviews_all` → `reviews`. |
| `src/app/api/extension/chat/opened/route.ts` | `reviews_all` → `reviews`. |
| `src/app/api/stores/[storeId]/reviews/[reviewId]/complaint/sent/route.ts` | `reviews_all` → `reviews`, убрать fallback. |
| `src/app/api/extension/stores/[storeId]/reviews/[reviewId]/complaint/sent/route.ts` | Убрать fallback. |
| `src/app/api/stores/[storeId]/chats/[chatId]/route.ts` | `reviews_all` → `reviews`. |

**Оценка: ~30-40 точек правки в ~18 файлах.**

#### Шаг 3: Обновление фронтенда

- Вкладка «Отзывы»: фильтр по 5★ — показывать «N отзывов» без текста, либо убрать 5★ из фильтра.
- Кабинет: проверить что rating breakdown корректно отображает 5★ из нового поля.

#### Шаг 4: Деплой

1. Применить миграцию (добавить поле, заполнить, DROP view, DROP table)
2. Деплой нового кода
3. Перезапустить PM2

### Критерии приёмки (DoD)

- [ ] `reviews_archive` таблица удалена
- [ ] `reviews_all` view удалена
- [ ] `stores.review_count_5star` заполнено корректно для всех магазинов
- [ ] Вкладка «Отзывы» работает (фильтры 1-4★ показывают отзывы)
- [ ] Кабинет показывает корректное распределение по рейтингам (включая 5★)
- [ ] Средняя оценка на кабинете и в расширении совпадает с ожидаемой
- [ ] Синк отзывов работает: новые 1-4★ сохраняются, 5★ инкрементируют счётчик
- [ ] Расширение Chrome: задачи, статусы, жалобы — без ошибок
- [ ] TG Mini App: чаты отображаются, отзывы подтягиваются
- [ ] Жалобы: генерация и подача — без ошибок
- [ ] Автосиквенсы: запуск и отправка — без ошибок
- [ ] Крон-задачи: resolved review closer — работает
- [ ] В логах PM2 нет ошибок `relation "reviews_archive" does not exist`
- [ ] В логах PM2 нет ошибок `relation "reviews_all" does not exist`
- [ ] `npm run build` проходит без ошибок (кроме pre-existing archive/ ошибок)

### Замеры (до/после)

| Метрика | До | После | Как проверить |
|---------|----|-------|---------------|
| pg_database_size | 7,089 MB | ожидаем ~3,700 MB | `SELECT pg_database_size(current_database())` |
| reviews_archive | 3,384 MB | 0 (удалена) | `\dt reviews_archive` → not found |
| stores.review_count_5star | — | заполнено | `SELECT name, review_count_5star FROM stores WHERE review_count_5star > 0` |
| Вкладка отзывов — время загрузки | замерить | замерить | DevTools → Network |
| Кабинет — rating breakdown | скриншот | скриншот | Визуальное сравнение |
| Расширение — avg rating | замерить | замерить | Ручная проверка 2-3 магазинов |

---

## Task 2: Система автоочистки inactive магазинов

### Цель

Реализовать автоматическое удаление восстановимых данных у магазинов, которые неактивны > 14 дней. Сохранить ценные данные для финансовой модели. Не удалять сам магазин.

### Текущее состояние

- 26 inactive WB-магазинов хранят 645,270 строк восстановимых данных
- 14,012 строк ценных данных (жалобы)
- Функция `deleteStore()` удаляет ВСЁ включая сам магазин — нам не подходит
- Нет механизма автоочистки — данные копятся бесконечно

### Целевое состояние

```
Магазин стал inactive → через 14 дней → cron удаляет recoverable данные → store + ценные данные остаются
```

### Классификация данных

**УДАЛЯЕМ (восстановимо через WB API при реактивации):**

| Таблица | Почему можно |
|---------|-------------|
| reviews | Синк подтянет заново |
| chats | WB Chat API |
| chat_messages | WB Chat API |
| products | WB API Контент |
| product_rules | Привязаны к products |
| chat_auto_sequences | Завершённые |
| chat_status_history | Аудит-лог |
| ai_logs | Логи |
| review_statuses_from_extension | Кэш расширения |
| telegram_notifications_log | Логи |
| review_chat_links | Пересоздаётся при синке |

**ОСТАВЛЯЕМ (ценность для финансовой модели):**

| Таблица | Зачем |
|---------|-------|
| stores | ИНН, cost_cd, реферал, название, review_count_5star |
| review_complaints | Количество, статусы, тексты жалоб, конверсия (одобрено/отклонено) |
| complaint_details | Факты одобренных жалоб |

### Нюансы FK

Перед удалением `reviews` нужно проверить: `review_complaints.review_id` ссылается на `reviews.id`. Варианты:
- Если FK constraint — SET NULL на `review_id` перед удалением reviews
- Если нет FK constraint — просто удаляем (orphaned ID не критичен, текст жалобы сохранён)

Аналогично `review_chat_links.review_id` и `review_chat_links.chat_id` — удаляем всю таблицу `review_chat_links` для этого магазина.

### План реализации

#### Шаг 1: Добавить поле `deactivated_at` в stores

```sql
ALTER TABLE stores ADD COLUMN deactivated_at TIMESTAMPTZ;
-- Заполнить для текущих inactive
UPDATE stores SET deactivated_at = NOW() WHERE is_active = false AND deactivated_at IS NULL;
```

При деактивации магазина — ставить `deactivated_at = NOW()`.
При реактивации — ставить `deactivated_at = NULL`.

#### Шаг 2: Функция `cleanupInactiveStoreData(storeId)`

```typescript
// Удаляет recoverable данные, оставляет store + complaints
async function cleanupInactiveStoreData(storeId: string): Promise<void> {
  return transaction(async (client) => {
    // Убрать FK перед удалением reviews
    await client.query('UPDATE review_complaints SET review_id = NULL WHERE store_id = $1', [storeId]);

    // Удалить recoverable (порядок зависимостей)
    await client.query('DELETE FROM chat_status_history WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM ai_logs WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM chat_auto_sequences WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM chat_messages WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM review_chat_links WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM review_statuses_from_extension WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM chats WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM reviews WHERE store_id = $1', [storeId]);
    await client.query('DELETE FROM telegram_notifications_log WHERE store_id = $1', [storeId]);
    // product_rules → products
    await client.query('DELETE FROM product_rules WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)', [storeId]);
    await client.query('DELETE FROM products WHERE store_id = $1', [storeId]);

    // Пометить магазин как очищенный
    await client.query('UPDATE stores SET data_cleaned_at = NOW() WHERE id = $1', [storeId]);

    // НЕ удаляем: stores, review_complaints, complaint_details
  });
}
```

#### Шаг 3: Cron-задача

```
Каждый день в 04:00 MSK:
1. SELECT id, name FROM stores WHERE is_active = false AND deactivated_at < NOW() - INTERVAL '14 days' AND data_cleaned_at IS NULL
2. Для каждого: cleanupInactiveStoreData(storeId)
3. Логировать результат
```

#### Шаг 4: Одноразовая очистка текущих 26 inactive магазинов

Запустить `cleanupInactiveStoreData` для всех текущих inactive WB-магазинов.

### Ограничения

1. **Реактивация** — если клиент вернётся, данные восстановятся через синк. Но история чатов/сообщений начнётся заново.
2. **review_complaints.review_id = NULL** — жалобы потеряют связь с конкретным отзывом. Текст и статус жалобы сохранятся. Для фин. модели достаточно.
3. **14 дней** — буфер на случай, если магазин деактивировали по ошибке.

### Критерии приёмки (DoD)

- [ ] `stores.deactivated_at` и `stores.data_cleaned_at` добавлены
- [ ] При деактивации магазина ставится `deactivated_at = NOW()`
- [ ] Cron-задача запускается ежедневно в 04:00 MSK
- [ ] Через 14 дней inactive — recoverable данные удаляются автоматически
- [ ] stores, review_complaints, complaint_details — НЕ удалены
- [ ] review_complaints.review_id = NULL для очищенных магазинов (не ошибка)
- [ ] Текущие 26 inactive WB-магазинов очищены
- [ ] При реактивации магазина: синк подтягивает данные заново
- [ ] В логах PM2 нет ошибок при работе cron-задачи

### Замеры (до/после)

| Метрика | До | После |
|---------|----|-------|
| chats rows | 59,152 | ожидаем ~42,000 (-17K inactive WB) |
| reviews rows | 406,249 | ожидаем ~331,000 (-75K inactive WB) |
| pg_database_size | после Task 1 | ещё ~500-800 MB меньше |

---

## Task 3: VACUUM FULL (ночь 03→04 апреля)

### Цель

Физически освободить дисковое пространство после удалений 03.04 (OZON stores, ai_logs). Обычный VACUUM помечает место как переиспользуемое, но не возвращает ОС. VACUUM FULL перезаписывает таблицу и реально уменьшает файлы на диске.

### Расписание

**Дата:** ночь с 03.04 на 04.04.2026
**Время:** 00:00 MSK (21:00 UTC 03.04)

### Важно

- VACUUM FULL **блокирует таблицу** на время выполнения (запись и чтение)
- Выполнять на таблицах поочерёдно, начиная с самых крупных
- Пользователи в это время не должны работать с системой
- Ожидаемое время: 10-30 минут на крупные таблицы

### Порядок выполнения

```sql
-- 1. Самые крупные (больше всего удалённых строк)
VACUUM FULL ANALYZE chats;            -- 574 MB → ожидаем ~50 MB
VACUUM FULL ANALYZE chat_messages;    -- 202 MB → ожидаем ~170 MB
VACUUM FULL ANALYZE reviews;          -- 749 MB → ожидаем ~700 MB
VACUUM FULL ANALYZE ai_logs;          -- 1,704 MB → ожидаем ~30 MB
VACUUM FULL ANALYZE review_complaints; -- 178 MB

-- 2. Средние
VACUUM FULL ANALYZE products;
VACUUM FULL ANALYZE chat_auto_sequences;
VACUUM FULL ANALYZE review_statuses_from_extension;
```

**Примечание:** reviews_archive к этому моменту может быть уже удалена (если Task 1 выполнен). Если нет — включить в список первой.

### Критерии приёмки

- [ ] VACUUM FULL выполнен для всех затронутых таблиц
- [ ] pg_database_size уменьшился
- [ ] Приложение работает после VACUUM (pm2 list, проверка логов)
- [ ] Нет ошибок в PM2 логах утром 04.04

### Замеры

| Метрика | До VACUUM FULL | После |
|---------|---------------|-------|
| pg_database_size | ~7,089 MB | ожидаем ~5,000 MB (без Task 1) или ~1,500 MB (с Task 1) |
| chats size | 574 MB | ожидаем ~50 MB |
| ai_logs size | 1,704 MB | ожидаем ~30 MB |

---

## Итоговая карта экономии

| Этап | Экономия | Статус |
|------|----------|--------|
| Удаление 3 OZON-магазинов | ~600 MB (логическое) | Выполнено 03.04 |
| Очистка ai_logs | ~1,650 MB (логическое) | Выполнено 03.04 |
| VACUUM FULL (ночь 03→04) | физическое освобождение | **Task 3** |
| Удаление reviews_archive | ~3,384 MB | **Task 1** |
| Очистка inactive WB-магазинов | ~500-800 MB | **Task 2** |
| **ИТОГО** | **~6,000 MB (-85%)** | |

**Ожидаемый финальный размер БД: ~1,000-1,500 MB**

---

## Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Ошибка в коде после удаления reviews_all | Средняя | Полный grep + замеры до/после + build check |
| VACUUM FULL блокирует таблицу надолго | Низкая | Выполнение ночью, мониторинг |
| Клиент реактивирует магазин, данные потеряны | Низкая | 14-дневный буфер + синк восстановит |
| reviews_archive нужна в будущем | Очень низкая | Данные восстановимы через WB API + хранится count |
