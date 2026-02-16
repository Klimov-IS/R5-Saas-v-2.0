# TASK-20260216 — Backend API: Review-Chat Linking

> **Статус:** Планирование
> **Приоритет:** P0 (блокирует команду расширения)
> **Sprint:** 002 — Review-Chat Linking
> **Зависимость:** API Contract от команды расширения

---

## Goal

Реализовать backend API и схему БД для связки отзывов с чатами WB через Chrome-расширение.
Расширение отправляет данные о связке, бэкенд сохраняет и reconciliates с существующим dialogue sync.

---

## Current State

### Отзывы
- Таблица `reviews`: синхронизируются из WB Feedbacks API
- Жалобы: `review_complaints` (1:1 с отзывами)
- Статусы жалоб: `draft` → `sent` → `approved/rejected`
- Расширение уже умеет парсить статус жалобы на странице WB

### Чаты
- Таблица `chats`: синхронизируются из WB Chat API (dialogue sync)
- `product_nm_id` — единственная связь с продуктом (денормализовано)
- **Нет связи с конкретным отзывом** (`review_id` отсутствует)

### Расширение (текущее)
- Уже умеет: парсить страницу отзывов, получать правила, отправлять жалобы
- Новое: будет открывать чаты и отправлять связку в бэкенд

---

## Proposed Change

### 1. Миграция БД

Новая таблица `review_chat_links`:

```sql
-- Migration: 016_review_chat_links.sql

CREATE TABLE review_chat_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id),

  -- Review side (от расширения)
  review_id TEXT REFERENCES reviews(id),
  review_key TEXT NOT NULL,              -- "{nmId}_{rating}_{dateTruncMin}"
  review_nm_id TEXT NOT NULL,
  review_rating INTEGER NOT NULL,
  review_date TIMESTAMPTZ NOT NULL,

  -- Chat side (от расширения + reconciliation)
  chat_id TEXT REFERENCES chats(id),
  chat_url TEXT NOT NULL,
  system_message_text TEXT,
  parsed_nm_id TEXT,
  parsed_product_title TEXT,

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'chat_opened'
    CHECK (status IN (
      'chat_opened',
      'anchor_found',
      'anchor_not_found',
      'message_sent',
      'message_skipped',
      'message_failed',
      'completed',
      'error'
    )),
  message_type TEXT CHECK (message_type IN ('A', 'B')),
  message_text TEXT,
  message_sent_at TIMESTAMPTZ,

  -- Error tracking
  error_code TEXT,
  error_message TEXT,
  error_stage TEXT,

  -- Timestamps
  opened_at TIMESTAMPTZ NOT NULL,
  anchor_found_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(store_id, review_key)
);

CREATE INDEX idx_rcl_store ON review_chat_links(store_id);
CREATE INDEX idx_rcl_review ON review_chat_links(review_id) WHERE review_id IS NOT NULL;
CREATE INDEX idx_rcl_chat ON review_chat_links(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX idx_rcl_status ON review_chat_links(status);
CREATE INDEX idx_rcl_chat_url ON review_chat_links(chat_url);
```

### 2. API Endpoints

#### 2.1 GET /api/extension/chat/stores

Возвращает магазины с чат-правилами. Источник данных: `stores` + `product_rules`.

```typescript
// Response
[
  {
    id: string,
    name: string,
    isActive: boolean,
    chatEnabled: boolean,         // ANY product has work_in_chats = true
    pendingChatsCount: number     // reviews with rejected complaints & no linked chat
  }
]
```

**Логика `pendingChatsCount`:**
```sql
SELECT COUNT(*) FROM reviews r
JOIN review_complaints rc ON rc.review_id = r.id
JOIN products p ON p.id = r.product_id
JOIN product_rules pr ON pr.product_id = p.id
WHERE r.store_id = :storeId
  AND rc.status = 'rejected'
  AND pr.work_in_chats = TRUE
  AND r.rating = ANY(/* starsAllowed logic */)
  AND NOT EXISTS (
    SELECT 1 FROM review_chat_links rcl
    WHERE rcl.store_id = r.store_id
      AND rcl.review_nm_id = p.wb_product_id
      AND rcl.review_rating = r.rating
      AND rcl.review_date BETWEEN r.date - interval '1 minute'
                               AND r.date + interval '1 minute'
  );
```

#### 2.2 GET /api/extension/chat/stores/{storeId}/rules

Возвращает правила по артикулам для конкретного магазина.

```typescript
// Response
{
  storeId: string,
  globalLimits: {
    maxChatsPerRun: number,      // default: 50
    cooldownBetweenChatsMs: number  // default: 3000
  },
  items: [
    {
      nmId: string,
      productTitle: string,
      isActive: boolean,
      chatEnabled: boolean,           // product_rules.work_in_chats
      starsAllowed: number[],         // [1,2,3] or [1,2,3,4] based on chat_rating_*
      requiredComplaintStatus: "rejected"
    }
  ]
}
```

**Источник данных:**
```sql
SELECT
  p.wb_product_id as nm_id,
  p.name as product_title,
  pr.work_in_chats as chat_enabled,
  pr.chat_rating_1, pr.chat_rating_2,
  pr.chat_rating_3, pr.chat_rating_4
FROM products p
JOIN product_rules pr ON pr.product_id = p.id
WHERE p.store_id = :storeId
  AND pr.work_in_chats = TRUE;
```

#### 2.3 POST /api/extension/chat/opened

Фиксация открытия чата. Создаёт `review_chat_link`.

```typescript
// Request
{
  storeId: string,
  reviewContext: {
    nmId: string,
    rating: number,
    reviewDate: string,     // ISO 8601
    reviewKey: string       // "{nmId}_{rating}_{dateTruncMin}"
  },
  chatUrl: string,
  openedAt: string,
  status: "CHAT_OPENED"
}

// Response
{
  success: true,
  chatRecordId: string,     // UUID of review_chat_links record
  message: "Chat record created"
}
```

**Идемпотентность:** UPSERT по `(store_id, review_key)`. Если запись уже есть — вернуть существующий `chatRecordId`.

**Reconciliation с review_id:**
```sql
-- Попытка найти matching review
SELECT id FROM reviews
WHERE store_id = :storeId
  AND product_nm_id = :nmId
  AND rating = :rating
  AND date BETWEEN :reviewDate - interval '2 minutes'
               AND :reviewDate + interval '2 minutes'
ORDER BY ABS(EXTRACT(EPOCH FROM (date - :reviewDate)))
LIMIT 1;
```

#### 2.4 POST /api/extension/chat/{chatRecordId}/anchor

Фиксация системного сообщения WB.

```typescript
// Request
{
  systemMessageText: string,
  parsedNmId: string | null,
  parsedProductTitle: string | null,
  anchorFoundAt: string,
  status: "ANCHOR_FOUND" | "ANCHOR_NOT_FOUND"
}

// Response
{
  success: true,
  reviewChatLinked: boolean,   // true если удалось матчить review_id
  message: "Review-chat association created"
}
```

**При получении anchor:** обновить запись + попытаться reconciliate `chat_id` (парсинг chat ID из URL).

#### 2.5 POST /api/extension/chat/{chatRecordId}/message-sent (Фаза 2)

```typescript
// Request
{
  messageType: "A" | "B" | "NONE",
  messageText: string | null,
  sentAt: string,
  status: "MESSAGE_SENT" | "MESSAGE_SKIPPED" | "MESSAGE_FAILED"
}
```

#### 2.6 POST /api/extension/chat/{chatRecordId}/error (Фаза 2)

```typescript
// Request
{
  errorCode: string,    // ERROR_TAB_TIMEOUT, ERROR_ANCHOR_NOT_FOUND, etc.
  errorMessage: string,
  stage: "chat_open" | "anchor_parsing" | "message_send",
  occurredAt: string
}
```

### 3. Reconciliation Logic

При dialogue sync (`dialogues/update`), после получения чатов из WB API:

```typescript
// Step NEW: Reconcile extension-opened chats
for (const chat of syncedChats) {
  // Попытка найти pending review_chat_link по chat_url
  const link = await findLinkByChatUrl(chat.chatUrl);
  if (link && !link.chat_id) {
    await updateLink(link.id, { chat_id: chat.id });
  }
}
```

Также: при получении `chat_url` в POST /chat/opened — попытаться извлечь `chat_id` из URL:
```
https://seller.wildberries.ru/feedback-and-questions/chats/12345
                                                          ^^^^^
                                                        chat_id
```

### 4. Аутентификация

Используется существующая система аутентификации расширения:
- `Authorization: Bearer wbrm_xxx`
- Middleware проверяет токен → `userId` + `storeId` access

---

## Impact

### DB
- Новая таблица `review_chat_links` (миграция 016)
- Новые индексы (5 шт.)
- Без изменений в существующих таблицах

### API
- 4 новых endpoint (Фаза 1)
- 2 дополнительных endpoint (Фаза 2)
- Под `/api/extension/chat/` — не конфликтует с текущим API

### Cron
- Фаза 1: без изменений
- Фаза 2+: новая задача мониторинга (linked review deleted → update chat)

### AI
- Фаза 1: без изменений
- Фаза 2: обогащение контекста в `generate-chat-reply` и `generate-deletion-offer`

### UI
- Фаза 1: без изменений
- Фаза 3: виджет отзыва в чате, статус чата в отзыве

---

## Required Docs Updates

| Документ | Что обновить |
|----------|-------------|
| `database-schema.md` | Добавить `review_chat_links` |
| `docs/reference/api.md` | Добавить extension chat endpoints |
| `docs/domains/chats-ai.md` | Добавить review-chat linking flow |
| `CRON_JOBS.md` | Добавить мониторинг linked chats (Фаза 2) |

---

## Rollout Plan

### Фаза 1 — MVP
1. Создать миграцию 016
2. Реализовать 4 API endpoints
3. Добавить reconciliation в dialogue sync
4. Протестировать с командой расширения (1 магазин)
5. Задеплоить

### Фаза 2 — AI + Automation
1. Обогатить AI контекстом отзыва
2. Авто-создание auto-sequence
3. Мониторинг linked chats

### Фаза 3 — UI
1. Виджет в карточке чата
2. Статус в карточке отзыва
3. Дашборд аналитики

---

## Backout Plan

- Миграция 016: `DROP TABLE review_chat_links;`
- API endpoints: удалить route-файлы
- Reconciliation: убрать шаг из dialogue sync
- **Zero impact** на существующую функциональность (новая таблица, новые endpoints)

---

## Estimation

| Компонент | Оценка |
|-----------|--------|
| Миграция БД | 0.5ч |
| GET stores + rules | 2ч |
| POST opened + anchor | 3ч |
| Reconciliation logic | 2ч |
| POST message-sent + error | 1.5ч |
| Тестирование с расширением | 2ч |
| Документация | 1ч |
| **Итого Фаза 1** | **~12ч** |

---

## Open Questions

1. **reviewKey uniqueness** — Может ли расширение парсить WB review ID из DOM? Это решит проблему коллизий.
2. **Chat ID из URL** — Стабилен ли формат URL чатов WB? Можно ли гарантированно извлечь chat_id?
3. **Шаблоны сообщений** — Хранить на бэкенде (API endpoint) или хардкод в расширении?
4. **Rate limits** — Нужны ли серверные лимиты на количество POST /chat/opened в минуту?
5. **Retention** — Как долго хранить записи со статусом `error`?
