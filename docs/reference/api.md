# R5 API Reference

**Версия:** 1.0
**Base URL:** `http://158.160.217.236`
**Swagger UI:** `http://158.160.217.236/api/docs`

---

## Аутентификация

Все endpoints требуют Bearer token в заголовке:

```http
Authorization: Bearer wbrm_xxxxxxxxxxxxxxxxxxxxx
```

**Формат токена:** `wbrm_*` (хранится в `user_settings.api_key`)

---

## Stores (Магазины)

### GET /api/stores

Получить список всех магазинов.

**Response:**
```json
{
  "stores": [
    {
      "id": "abc123",
      "name": "Тайди Центр",
      "status": "active",
      "total_reviews": 1344055,
      "total_chats": 5420,
      "last_review_update_date": "2026-02-08T05:00:00Z"
    }
  ]
}
```

---

### POST /api/stores

Создать новый магазин.

**Request:**
```json
{
  "name": "Новый магазин",
  "api_token": "WB_TOKEN_HERE"
}
```

---

### GET /api/stores/:storeId

Получить детали магазина.

---

### PATCH /api/stores/:storeId

Обновить магазин.

**Request:**
```json
{
  "name": "Обновленное название",
  "status": "inactive"
}
```

---

### DELETE /api/stores/:storeId

Удалить магазин (CASCADE: удаляет все связанные данные).

---

### PATCH /api/stores/:storeId/status

Изменить статус магазина.

**Request:**
```json
{
  "status": "active" | "inactive"
}
```

---

## Products (Товары)

### GET /api/stores/:storeId/products

Получить товары магазина.

**Query params:**
- `skip` — offset (default: 0)
- `take` — limit (default: 50)
- `is_active` — фильтр по активности
- `work_status` — фильтр по work_status

---

### POST /api/stores/:storeId/products/update

Синхронизировать товары с WB Content API.

**Response:**
```json
{
  "message": "Synced 150 products",
  "created": 10,
  "updated": 140
}
```

---

### PATCH /api/stores/:storeId/products/:productId/status

Изменить статус товара.

**Request:**
```json
{
  "is_active": true,
  "work_status": "active"
}
```

---

### GET /api/stores/:storeId/products/:productId/rules

Получить правила товара (product_rules).

---

### PUT /api/stores/:storeId/products/:productId/rules

Обновить правила товара.

**Request:**
```json
{
  "submit_complaints": true,
  "complaint_rating_1": true,
  "complaint_rating_2": true,
  "complaint_rating_3": true,
  "work_in_chats": false,
  "offer_compensation": false
}
```

---

### POST /api/stores/:storeId/products/bulk-actions

Массовые действия с товарами.

**Request:**
```json
{
  "product_ids": ["id1", "id2"],
  "action": "activate" | "deactivate" | "enable_complaints"
}
```

---

## Reviews (Отзывы)

### GET /api/stores/:storeId/reviews

Получить отзывы магазина.

**Query params:**
- `skip`, `take` — пагинация
- `rating` — фильтр по рейтингу (1-5)
- `has_complaint` — boolean
- `complaint_status` — not_sent, draft, sent, pending, approved, rejected
- `is_product_active` — boolean
- `dateFrom`, `dateTo` — диапазон дат

**Response:**
```json
{
  "reviews": [...],
  "total": 1500,
  "page": 1,
  "pageSize": 50
}
```

---

### POST /api/stores/:storeId/reviews/update

Синхронизировать отзывы с WB Feedbacks API.

**Query params:**
- `mode` — `incremental` (default) | `full`

**Response:**
```json
{
  "message": "Synced 150 new reviews",
  "synced": 150,
  "skipped": 0
}
```

**Note:** Full sync использует adaptive chunking для обхода лимита WB API в 20k отзывов.

---

### GET /api/stores/:storeId/reviews/stats

Статистика отзывов.

**Response:**
```json
{
  "total": 1344055,
  "by_rating": { "1": 5000, "2": 3000, "3": 8000, "4": 50000, "5": 1278055 },
  "with_complaints": 15000,
  "pending_complaints": 500
}
```

---

### GET /api/stores/:storeId/reviews/:reviewId

Получить детали отзыва.

---

### PATCH /api/stores/:storeId/reviews/:reviewId

Обновить отзыв.

**Request:**
```json
{
  "draft_reply": "Текст черновика ответа"
}
```

---

### POST /api/stores/:storeId/reviews/:reviewId/generate-reply

Сгенерировать AI ответ на отзыв.

**Response:**
```json
{
  "text": "Добрый день! Благодарим за отзыв...",
  "tokens": { "prompt": 250, "completion": 100, "total": 350 },
  "cost": 0.00015
}
```

---

### POST /api/stores/:storeId/reviews/:reviewId/send

Отправить ответ на отзыв в WB.

**Request:**
```json
{
  "text": "Текст ответа"
}
```

---

## Complaints (Жалобы)

### GET /api/stores/:storeId/complaints

Получить жалобы магазина.

**Query params:**
- `status` — draft, sent, pending, approved, rejected
- `skip`, `take` — пагинация

---

### POST /api/stores/:storeId/reviews/:reviewId/generate-complaint

Сгенерировать жалобу на отзыв.

**Response:**
```json
{
  "success": true,
  "complaint": {
    "id": "complaint_id",
    "complaint_text": "Текст жалобы...",
    "reason_id": 11,
    "reason_name": "Отзыв не относится к товару",
    "status": "draft"
  },
  "tokens": { "prompt": 500, "completion": 200, "total": 700 },
  "cost": 0.0003
}
```

---

### PUT /api/stores/:storeId/reviews/:reviewId/complaint/sent

Отметить жалобу как отправленную.

**Request:**
```json
{
  "sent_at": "2026-02-08T10:00:00Z"
}
```

---

## Chats (Чаты)

### GET /api/stores/:storeId/chats

Получить чаты магазина.

**Query params:**
- `tag` — фильтр по тегу (active, no_reply, completed, untagged)
- `skip`, `take` — пагинация

---

### GET /api/stores/:storeId/chats/:chatId

Получить чат с историей сообщений.

---

### PATCH /api/stores/:storeId/chats/:chatId

Обновить чат.

**Request:**
```json
{
  "tag": "active",
  "draft_reply": "Черновик ответа"
}
```

---

### POST /api/stores/:storeId/chats/:chatId/generate-ai

Сгенерировать AI ответ для чата.

**Response:**
```json
{
  "text": "Добрый день! По вашему вопросу...",
  "tokens": { "prompt": 350, "completion": 150, "total": 500 },
  "cost": 0.0002
}
```

---

### POST /api/stores/:storeId/chats/:chatId/send

Отправить сообщение в чат WB.

**Request:**
```json
{
  "text": "Текст сообщения"
}
```

---

### PATCH /api/stores/:storeId/chats/:chatId/status

Изменить тег чата.

**Request:**
```json
{
  "tag": "completed"
}
```

---

### POST /api/stores/:storeId/chats/classify-all

Классифицировать все чаты через AI.

---

### POST /api/stores/:storeId/chats/bulk-actions

Массовые действия с чатами.

**Request:**
```json
{
  "chat_ids": ["id1", "id2"],
  "action": "tag",
  "tag": "completed"
}
```

---

### POST /api/stores/:storeId/chats/bulk/send

Массовая отправка сообщений.

**Request:**
```json
{
  "chat_ids": ["id1", "id2"],
  "message": "Текст сообщения"
}
```

---

### POST /api/stores/:storeId/chats/bulk/generate-ai

Массовая генерация AI ответов.

---

### POST /api/stores/:storeId/dialogues/update

Синхронизировать чаты с WB Chat API.

---

## Deletion Cases (Удаление отзывов)

### POST /api/stores/:storeId/chats/classify-deletion

Классифицировать чаты на предмет удаления отзыва.

---

### POST /api/stores/:storeId/chats/:chatId/generate-deletion-offer

Сгенерировать предложение об удалении.

---

### GET /api/stores/:storeId/deletion-cases/:chatId

Получить deletion case.

---

### POST /api/stores/:storeId/deletion-cases/generate-all

Сгенерировать все deletion offers.

---

## AI Settings (Настройки AI)

### GET /api/stores/:storeId/ai-instructions

Получить AI инструкции магазина.

**Response:**
```json
{
  "ai_instructions": "Мы — бренд премиальной косметики. Обращайтесь к клиенту на Вы..."
}
```

---

### PUT /api/stores/:storeId/ai-instructions

Обновить AI инструкции магазина.

**Request:**
```json
{
  "ai_instructions": "Новые инструкции для AI агента..."
}
```

---

## FAQ (База знаний)

### GET /api/stores/:storeId/faq

Получить все FAQ записи магазина.

**Response:**
```json
[
  {
    "id": "uuid",
    "store_id": "store123",
    "question": "Как вернуть товар?",
    "answer": "Вы можете оформить возврат через личный кабинет WB...",
    "is_active": true,
    "sort_order": 0
  }
]
```

---

### POST /api/stores/:storeId/faq

Создать новую FAQ запись.

**Request:**
```json
{
  "question": "Вопрос клиента",
  "answer": "Ответ продавца"
}
```

---

### PUT /api/stores/:storeId/faq/:faqId

Обновить FAQ запись.

**Request:**
```json
{
  "question": "Обновлённый вопрос",
  "answer": "Обновлённый ответ",
  "is_active": false
}
```

---

### DELETE /api/stores/:storeId/faq/:faqId

Удалить FAQ запись.

---

## Guides (Инструкции для клиентов)

### GET /api/stores/:storeId/guides

Получить все инструкции магазина.

**Response:**
```json
[
  {
    "id": "uuid",
    "store_id": "store123",
    "title": "Как удалить отзыв через браузер",
    "content": "Шаг 1: Откройте wildberries.ru...\nШаг 2: ...",
    "is_active": true,
    "sort_order": 0
  }
]
```

---

### POST /api/stores/:storeId/guides

Создать новую инструкцию.

**Request:**
```json
{
  "title": "Как удалить отзыв",
  "content": "Шаг 1: ..."
}
```

---

### PUT /api/stores/:storeId/guides/:guideId

Обновить инструкцию.

**Request:**
```json
{
  "title": "Обновлённый заголовок",
  "content": "Обновлённый текст",
  "is_active": false
}
```

---

### DELETE /api/stores/:storeId/guides/:guideId

Удалить инструкцию.

---

## AI Analysis (Анализ диалогов)

### POST /api/stores/:storeId/analyze-dialogues

Анализ последних 500 диалогов магазина с помощью AI. Возвращает предложенные FAQ и инструкции на основе реальных переписок. Длительная операция (~15-30 сек).

**Response:**
```json
{
  "faq": [
    { "question": "Как вернуть товар?", "answer": "Возврат через WB в течение 14 дней..." }
  ],
  "guides": [
    { "title": "Как удалить отзыв", "content": "1. Откройте сайт WB...\n2. ..." }
  ],
  "summary": "Основные паттерны: вопросы о возврате, размерах, компенсации",
  "dialoguesAnalyzed": 347
}
```

**Детали:**
- Загружает до 500 последних чатов (с минимум 2 сообщениями)
- Передаёт существующие FAQ/guides в AI для дедупликации
- Использует Deepseek API с JSON mode
- Логируется в `ai_logs` (operation: `analyze-store-dialogues`)

---

## CRON Management

### GET /api/cron/status

Статус cron jobs.

**Response:**
```json
{
  "totalJobs": 4,
  "runningJobs": ["hourly-review-sync"],
  "allJobs": [
    { "name": "hourly-review-sync", "running": true },
    { "name": "daily-product-sync", "running": false },
    { "name": "adaptive-dialogue-sync", "running": false },
    { "name": "backfill-worker", "running": false }
  ]
}
```

---

### POST /api/cron/trigger

Ручной запуск cron job.

**Request:**
```json
{
  "job": "hourly-review-sync"
}
```

---

### POST /api/cron/init

Инициализировать cron jobs (используется при старте сервера).

---

## Extension API

API для Chrome Extension.

### POST /api/extension/auth/verify

Проверить API ключ.

---

### GET /api/extension/stores

Получить список магазинов (для extension).

**Response:**
```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "ИП Артюшина",
    "isActive": true,
    "draftComplaintsCount": 45
  }
]
```

---

### GET /api/extension/stores/:storeId/stats

Статистика магазина.

---

### GET /api/extension/stores/:storeId/active-products

Активные товары для генерации жалоб.

---

### GET /api/extension/stores/:storeId/complaints

Жалобы магазина (для copy-paste в WB).

---

### POST /api/extension/stores/:storeId/reviews/sync

Синхронизировать статусы отзывов из extension.

**Request:**
```json
{
  "reviews": [
    {
      "review_id": "...",
      "review_status_wb": "visible",
      "product_status_by_review": "purchased",
      "chat_status_by_review": "available"
    }
  ]
}
```

---

### POST /api/extension/stores/:storeId/reviews/find-by-data

Найти отзыв по данным (для matching).

---

### POST /api/extension/stores/:storeId/reviews/generate-complaints-batch

Массовая генерация жалоб.

**Request:**
```json
{
  "review_ids": ["id1", "id2", "id3"]
}
```

**Response:**
```json
{
  "generated": [
    { "review_id": "id1", "complaint_id": "c1", "cost_usd": 0.0003 }
  ],
  "failed": [
    { "review_id": "id2", "error": "Already has complaint" }
  ]
}
```

---

### PUT /api/extension/stores/:storeId/reviews/:reviewId/complaint/sent

Отметить жалобу как отправленную (из extension).

---

## Extension Chat API (Sprint 002)

API для связки отзывов с чатами через Chrome Extension.
Расширение открывает чаты из страницы отзывов WB и сообщает бэкенду связку review ↔ chat.

**Auth:** `Authorization: Bearer {api_key}` (тот же токен, что для complaints)
**Base path:** `/api/extension/chat/`

### GET /api/extension/chat/stores

Список магазинов с информацией о чат-workflow.

**Response:**
```json
[
  {
    "id": "store_123",
    "name": "Store Name",
    "isActive": true,
    "chatEnabled": true,
    "pendingChatsCount": 12
  }
]
```

| Field | Description |
|-------|-------------|
| chatEnabled | Есть ли хотя бы один товар с `work_in_chats = true` |
| pendingChatsCount | Отзывы с отклонёнными жалобами, для которых ещё не открыт чат |

---

### GET /api/extension/chat/stores/:storeId/rules

Правила чат-обработки для магазина. Расширение использует для отбора отзывов.

**Response:**
```json
{
  "storeId": "store_123",
  "globalLimits": {
    "maxChatsPerRun": 50,
    "cooldownBetweenChatsMs": 3000
  },
  "items": [
    {
      "nmId": "649502497",
      "productTitle": "Футболка мужская",
      "isActive": true,
      "chatEnabled": true,
      "starsAllowed": [1, 2, 3, 4],
      "requiredComplaintStatus": "rejected"
    }
  ]
}
```

**Критерии отбора (логика в расширении):**
- `nmId` совпадает с артикулом на странице WB
- `isActive = true` и `chatEnabled = true`
- Звёзды отзыва входят в `starsAllowed`
- Статус жалобы на странице = «Отклонена» (`requiredComplaintStatus = "rejected"`)

---

### POST /api/extension/chat/opened

Фиксация открытия чата. Идемпотентно: повторный вызов с тем же `reviewKey` возвращает существующую запись.

**Request:**
```json
{
  "storeId": "store_123",
  "reviewContext": {
    "nmId": "649502497",
    "rating": 2,
    "reviewDate": "2026-01-07T20:09:37.000Z",
    "reviewKey": "649502497_2_2026-01-07T20:09"
  },
  "chatUrl": "https://seller.wildberries.ru/feedback-and-questions/chats/12345",
  "openedAt": "2026-02-16T14:30:00.000Z",
  "status": "CHAT_OPENED"
}
```

**Response (201 Created / 200 OK):**
```json
{
  "success": true,
  "chatRecordId": "uuid-...",
  "message": "Chat record created",
  "reviewMatched": true
}
```

| Field | Description |
|-------|-------------|
| chatRecordId | UUID записи `review_chat_links` (используется в последующих запросах) |
| reviewMatched | Удалось ли найти matching review в БД |

---

### POST /api/extension/chat/:chatRecordId/anchor

Фиксация системного сообщения WB ("Чат с покупателем по товару...").

**Request:**
```json
{
  "systemMessageText": "Чат с покупателем по товару Футболка, артикул 649502497",
  "parsedNmId": "649502497",
  "parsedProductTitle": "Футболка",
  "anchorFoundAt": "2026-02-16T14:30:05.000Z",
  "status": "ANCHOR_FOUND"
}
```

**Response:**
```json
{
  "success": true,
  "reviewChatLinked": true,
  "message": "Review-chat association confirmed"
}
```

---

### POST /api/extension/chat/:chatRecordId/message-sent

Фиксация отправки стартового сообщения покупателю.

**Request:**
```json
{
  "messageType": "A",
  "messageText": "Здравствуйте! Мы увидели ваш отзыв...",
  "sentAt": "2026-02-16T14:30:10.000Z",
  "status": "MESSAGE_SENT"
}
```

| Field | Values |
|-------|--------|
| messageType | `"A"` (1-3⭐), `"B"` (4⭐), `"NONE"` |
| status | `MESSAGE_SENT`, `MESSAGE_SKIPPED` (дубль), `MESSAGE_FAILED` |

---

### POST /api/extension/chat/:chatRecordId/error

Логирование ошибки на любом этапе.

**Request:**
```json
{
  "errorCode": "ERROR_ANCHOR_NOT_FOUND",
  "errorMessage": "System message not found after scrolling to top",
  "stage": "anchor_parsing",
  "occurredAt": "2026-02-16T14:30:15.000Z"
}
```

| errorCode | Description |
|-----------|-------------|
| ERROR_TAB_TIMEOUT | Вкладка чата не загрузилась |
| ERROR_ANCHOR_NOT_FOUND | Системное сообщение не найдено |
| ERROR_DOM_CHANGED | DOM изменился |
| ERROR_INPUT_NOT_FOUND | Поле ввода не найдено |
| ERROR_SEND_FAILED | Не удалось отправить сообщение |
| ERROR_CHAT_BLOCKED | Чат заблокирован |
| ERROR_UNKNOWN | Непредвиденная ошибка |

---

## Admin API

### GET /api/admin/metrics/auto-complaints

Метрики автогенерации жалоб.

**Response:**
```json
{
  "today": {
    "generated": 500,
    "templated": 200,
    "ai_generated": 300,
    "failed": 5,
    "cost_usd": 0.15
  },
  "last_7_days": {...}
}
```

---

### GET /api/admin/analyze-empty-reviews

Анализ пустых отзывов.

---

### POST /api/admin/generate-empty-review-complaints

Генерация жалоб для пустых отзывов (template-based).

---

### POST /api/admin/backfill

Запустить backfill для продукта.

**Request:**
```json
{
  "product_id": "prod123",
  "max_rating": 3
}
```

---

## Google Sheets Sync

### GET /api/admin/google-sheets/sync

Статус синхронизации Product Rules в Google Sheets.

**Response:**
```json
{
  "configured": true,
  "config": {
    "spreadsheetId": "1-mxbnv...",
    "sheetName": "Артикулы ТЗ",
    "serviceAccountEmail": "r5-automation@..."
  },
  "lastSync": {
    "timestamp": "2026-02-08T03:00:00.000Z",
    "success": true,
    "rowsWritten": 58
  }
}
```

---

### POST /api/admin/google-sheets/sync

Ручной запуск синхронизации Product Rules.

**Response:**
```json
{
  "success": true,
  "message": "Successfully synced 150 products from 5 stores",
  "result": {
    "rowsWritten": 151,
    "storesProcessed": 5,
    "productsProcessed": 150,
    "duration_ms": 1250
  }
}
```

---

### GET /api/admin/google-sheets/sync-clients

Статус синхронизации справочника клиентов (Список клиентов).

**Response:**
```json
{
  "configured": true,
  "config": {
    "spreadsheetId": "1-mxbnv...",
    "sheetName": "Список клиентов",
    "serviceAccountEmail": "r5-automation@..."
  },
  "lastSync": {
    "timestamp": "2026-02-08T10:00:00.000Z",
    "success": true,
    "storesProcessed": 63,
    "rowsUpdated": 0,
    "rowsAppended": 63
  }
}
```

---

### POST /api/admin/google-sheets/sync-clients

Запуск синхронизации справочника клиентов.

**Что делает:**
- Читает существующие данные листа "Список клиентов"
- Для существующих магазинов — обновляет строку (UPDATE)
- Для новых магазинов — добавляет строку (APPEND)
- Сохраняет вручную заполненный ИНН (колонка C)
- Связывает с папками Google Drive через fuzzy-matching

**Response:**
```json
{
  "success": true,
  "message": "Synced 63 stores: 10 updated, 5 appended",
  "result": {
    "storesProcessed": 63,
    "rowsUpdated": 10,
    "rowsAppended": 5,
    "duration_ms": 26728
  }
}
```

**Колонки листа:**

| # | Колонка | Источник |
|---|---------|----------|
| A | ID магазина | `store.id` |
| B | Название | `store.name` |
| C | ИНН | (заполняется вручную) |
| D | Дата подключения | `store.created_at` |
| E | Статус | `store.status` |
| F | API Main | ✅/❌ |
| G | API Content | ✅/❌ |
| H | API Feedbacks | ✅/❌ |
| I | API Chat | ✅/❌ |
| J | Папка клиента | Google Drive ссылка |
| K | Отчёт | Ссылка на "Отчёт: ..." |
| L | Скриншоты | Ссылка на папку |
| M | Обновлено | Timestamp |

---

## Tasks API

Управление фоновыми задачами.

### GET /api/tasks

Получить список задач.

---

### GET /api/tasks/stats

Статистика задач.

---

### GET /api/tasks/:id

Получить задачу.

---

## Utility Endpoints

### GET /api/health

Health check.

**Response:**
```
OK
```

---

### POST /api/cache/invalidate

Инвалидировать кеш.

**Request:**
```json
{
  "key": "stores" | "reviews" | "chats"
}
```

---

### GET /api/openapi.json

OpenAPI спецификация.

---

## WB Proxy

Проксирование запросов к WB API.

### POST /api/wb-proxy/reviews

Proxy к WB Feedbacks API.

### POST /api/wb-proxy/products

Proxy к WB Content API.

### POST /api/wb-proxy/chats

Proxy к WB Chat API.

### POST /api/wb-proxy/chat-events

Получить события чатов.

### POST /api/wb-proxy/questions

Proxy к WB Questions API.

### POST /api/wb-proxy/send-message

Отправить сообщение через WB API.

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request — невалидные параметры |
| 401 | Unauthorized — отсутствует или невалидный токен |
| 403 | Forbidden — нет доступа к ресурсу |
| 404 | Not Found — ресурс не найден |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error |

**Error Response Format:**
```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| AI Generation | 60 req/min |
| Sync Operations | 10 req/min |
| Read Operations | 100 req/min |
| Write Operations | 30 req/min |

---

## Связанные документы

- [Database Schema](../database-schema.md)
- [CRON Jobs](../CRON_JOBS.md)
- [Architecture](../ARCHITECTURE.md)

---

**Last Updated:** 2026-02-16
