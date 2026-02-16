# Гайд для разработчиков расширения: Chat Workflow API

> **Статус API:** Задеплоен в прод (2026-02-16)
> **Base URL:** `https://rating5.ru`
> **Auth:** `Authorization: Bearer {api_key}` (тот же токен, что для жалоб)

---

## Обзор

Бэкенд предоставляет 6 API endpoints для chat-workflow расширения.
Расширение открывает чаты из страницы отзывов WB и сообщает бэкенду связку **отзыв ↔ чат**.

### Полный flow

```
1. GET  /chat/stores              → какие магазины доступны
2. GET  /chat/stores/{id}/rules   → какие отзывы обрабатывать
3. Расширение парсит страницу WB, находит подходящие отзывы
4. Кликает "Открыть чат" → WB открывает новую вкладку
5. POST /chat/opened              → бэкенд получает reviewContext + chatUrl
6. Парсим системное сообщение в чате
7. POST /chat/{id}/anchor         → бэкенд подтверждает связку
8. [Опционально] Отправляем сообщение покупателю
9. POST /chat/{id}/message-sent   → бэкенд записывает результат
10. При ошибке: POST /chat/{id}/error
```

---

## Аутентификация

Все запросы требуют заголовок:
```
Authorization: Bearer {api_key}
```

Токен тот же, что используется для API жалоб (`user_settings.api_key`).

**Rate limit:** 100 запросов в минуту на токен.

---

## Endpoint 1: GET /api/extension/chat/stores

Получить список магазинов с информацией о чат-workflow.

### Request

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores"
```

### Response (200 OK)

```json
[
  {
    "id": "store_abc123",
    "name": "Мой Магазин WB",
    "isActive": true,
    "chatEnabled": true,
    "pendingChatsCount": 42
  },
  {
    "id": "store_xyz456",
    "name": "Второй Магазин",
    "isActive": true,
    "chatEnabled": false,
    "pendingChatsCount": 0
  }
]
```

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID магазина (используйте в последующих запросах) |
| `name` | string | Название магазина |
| `isActive` | boolean | Активен ли магазин |
| `chatEnabled` | boolean | Есть ли хотя бы один товар с включённой работой в чатах |
| `pendingChatsCount` | number | Кол-во отзывов с отклонёнными жалобами, для которых ещё не открыт чат |

**Логика:** Показывайте в UI расширения только магазины где `isActive = true` и `chatEnabled = true`.

---

## Endpoint 2: GET /api/extension/chat/stores/{storeId}/rules

Получить правила чат-обработки для магазина. Расширение использует для отбора отзывов на странице WB.

### Request

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores/store_abc123/rules"
```

### Response (200 OK)

```json
{
  "storeId": "store_abc123",
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
      "starsAllowed": [1, 2, 3],
      "requiredComplaintStatus": "rejected"
    },
    {
      "nmId": "812345678",
      "productTitle": "Куртка зимняя",
      "isActive": true,
      "chatEnabled": true,
      "starsAllowed": [1, 2, 3, 4],
      "requiredComplaintStatus": "rejected"
    }
  ]
}
```

### Поля items[]

| Поле | Тип | Описание |
|------|-----|----------|
| `nmId` | string | Артикул WB (для сопоставления с отзывами на странице) |
| `productTitle` | string | Название товара (для логов/отображения) |
| `isActive` | boolean | Товар активен |
| `chatEnabled` | boolean | Для этого товара включена работа с чатами |
| `starsAllowed` | number[] | По каким звёздам работаем |
| `requiredComplaintStatus` | string | Всегда `"rejected"` — жалоба должна быть отклонена |

### Поля globalLimits

| Поле | Тип | Описание |
|------|-----|----------|
| `maxChatsPerRun` | number | Максимум чатов за один запуск (default: 50) |
| `cooldownBetweenChatsMs` | number | Пауза между открытием чатов в мс (default: 3000) |

### Критерии отбора отзыва (логика в расширении)

Открываем чат **только если одновременно**:
1. `nmId` отзыва совпадает с артикулом из правил
2. `isActive = true` И `chatEnabled = true`
3. Звёзды отзыва входят в `starsAllowed`
4. Статус жалобы на странице WB = **«Жалоба отклонена»** (маппится на `requiredComplaintStatus = "rejected"`)

---

## Endpoint 3: POST /api/extension/chat/opened

Вызывается **сразу после открытия чата** (до парсинга системного сообщения).

### Request

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "store_abc123",
    "reviewContext": {
      "nmId": "649502497",
      "rating": 2,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "reviewKey": "649502497_2_2026-01-07T20:09"
    },
    "chatUrl": "https://seller.wildberries.ru/feedback-and-questions/chats/12345",
    "openedAt": "2026-02-16T14:30:00.000Z",
    "status": "CHAT_OPENED"
  }' \
  "https://rating5.ru/api/extension/chat/opened"
```

### Поля request body

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `storeId` | string | Да | ID магазина |
| `reviewContext.nmId` | string | Да | Артикул WB |
| `reviewContext.rating` | number | Да | Звёзды отзыва (1-5) |
| `reviewContext.reviewDate` | string | Да | Дата отзыва (ISO 8601) |
| `reviewContext.reviewKey` | string | Да | Ключ отзыва: `"{nmId}_{rating}_{date_trunc_min}"` |
| `chatUrl` | string | Да | Полный URL открытой вкладки чата |
| `openedAt` | string | Да | Время открытия (ISO 8601) |
| `status` | string | Да | Всегда `"CHAT_OPENED"` |

### Формат reviewKey

```
reviewKey = "{nmId}_{rating}_{дата_обрезана_до_минуты}"
Пример:   "649502497_2_2026-01-07T20:09"
```

Бэкенд использует этот ключ для:
- **Дедупликации** — повторный вызов с тем же reviewKey вернёт существующую запись
- **Сопоставления с отзывом** в БД (fuzzy match по nmId + rating + date ±2 минуты)

### Response (201 Created / 200 OK)

```json
{
  "success": true,
  "chatRecordId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Chat record created",
  "reviewMatched": true
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `chatRecordId` | string | UUID записи — **используйте во всех последующих запросах** |
| `message` | string | `"Chat record created"` (новый) или `"Chat record already exists"` (дубль) |
| `reviewMatched` | boolean | Удалось ли найти matching отзыв в БД |

**201** = новая запись создана, **200** = запись уже существует (идемпотентность).

---

## Endpoint 4: POST /api/extension/chat/{chatRecordId}/anchor

Вызывается после парсинга **системного сообщения** WB в чате.

### Request

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "systemMessageText": "Чат с покупателем по товару Футболка мужская, артикул 649502497",
    "parsedNmId": "649502497",
    "parsedProductTitle": "Футболка мужская",
    "anchorFoundAt": "2026-02-16T14:30:05.000Z",
    "status": "ANCHOR_FOUND"
  }' \
  "https://rating5.ru/api/extension/chat/a1b2c3d4-e5f6-7890-abcd-ef1234567890/anchor"
```

### Поля request body

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `systemMessageText` | string | Нет* | Полный текст системного сообщения WB |
| `parsedNmId` | string | Нет | Артикул, извлечённый из текста (если удалось) |
| `parsedProductTitle` | string | Нет | Название товара из текста (если удалось) |
| `anchorFoundAt` | string | Да | Время нахождения (ISO 8601) |
| `status` | string | Да | `"ANCHOR_FOUND"` или `"ANCHOR_NOT_FOUND"` |

*`systemMessageText` обязателен при `status = "ANCHOR_FOUND"`.

### Как искать системное сообщение

В чате WB есть авто-сообщение в начале: *"Чат с покупателем по товару..."*

Алгоритм:
1. Ищем в текущем DOM (сообщение может быть видимым)
2. Если не нашли — скроллим вверх постепенно
3. На каждом шаге re-scan DOM
4. Стоп: нашли сообщение ИЛИ достигли начала истории

Матч по ключам (регистронезависимо): `чат`, `покупател`, `товар`

Если не нашли после полного скролла — отправляйте `status: "ANCHOR_NOT_FOUND"`.

### Response (200 OK)

```json
{
  "success": true,
  "reviewChatLinked": true,
  "message": "Review-chat association confirmed"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `reviewChatLinked` | boolean | `true` если удалось связать с конкретным отзывом в БД |

---

## Endpoint 5: POST /api/extension/chat/{chatRecordId}/message-sent

Вызывается после отправки стартового сообщения покупателю.

### Request

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messageType": "A",
    "messageText": "Здравствуйте! Мы увидели ваш отзыв и хотели бы...",
    "sentAt": "2026-02-16T14:30:10.000Z",
    "status": "MESSAGE_SENT"
  }' \
  "https://rating5.ru/api/extension/chat/a1b2c3d4-e5f6-7890-abcd-ef1234567890/message-sent"
```

### Поля request body

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `messageType` | string | Нет | `"A"` (1-3 звезды), `"B"` (4 звезды), `"NONE"` |
| `messageText` | string | Нет | Текст отправленного сообщения |
| `sentAt` | string | Да | Время отправки (ISO 8601) |
| `status` | string | Да | См. ниже |

### Допустимые значения status

| Status | Когда использовать |
|--------|-------------------|
| `MESSAGE_SENT` | Сообщение успешно отправлено |
| `MESSAGE_SKIPPED` | Сообщение не отправлено (уже есть исходящее от нас в чате) |
| `MESSAGE_FAILED` | Ошибка при отправке (поле ввода не найдено и т.д.) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Message status recorded"
}
```

---

## Endpoint 6: POST /api/extension/chat/{chatRecordId}/error

Вызывается при ошибке **на любом этапе**.

### Request

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "errorCode": "ERROR_ANCHOR_NOT_FOUND",
    "errorMessage": "System message not found after scrolling to top",
    "stage": "anchor_parsing",
    "occurredAt": "2026-02-16T14:30:15.000Z"
  }' \
  "https://rating5.ru/api/extension/chat/a1b2c3d4-e5f6-7890-abcd-ef1234567890/error"
```

### Поля request body

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `errorCode` | string | Да | Код ошибки (см. таблицу) |
| `errorMessage` | string | Да | Человекочитаемое описание |
| `stage` | string | Да | Этап: `"chat_open"`, `"anchor_parsing"`, `"message_send"` |
| `occurredAt` | string | Да | Время ошибки (ISO 8601) |

### Коды ошибок

| Code | Stage | Описание |
|------|-------|----------|
| `ERROR_TAB_TIMEOUT` | chat_open | Вкладка чата не загрузилась за таймаут |
| `ERROR_ANCHOR_NOT_FOUND` | anchor_parsing | Системное сообщение не найдено |
| `ERROR_DOM_CHANGED` | * | DOM изменился, элементы не найдены |
| `ERROR_INPUT_NOT_FOUND` | message_send | Поле ввода не найдено |
| `ERROR_SEND_FAILED` | message_send | Не удалось отправить сообщение |
| `ERROR_CHAT_BLOCKED` | chat_open | Чат заблокирован/ограничен |
| `ERROR_UNKNOWN` | * | Непредвиденная ошибка |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Error recorded"
}
```

---

## Жизненный цикл записи

```
POST /chat/opened
    ↓ status = chat_opened
POST /chat/{id}/anchor
    ├─ status = anchor_found       (системное сообщение найдено)
    └─ status = anchor_not_found   (не найдено)
POST /chat/{id}/message-sent
    ├─ status = message_sent       (сообщение отправлено)
    ├─ status = message_skipped    (пропущено)
    └─ status = message_failed     (ошибка)
POST /chat/{id}/error
    └─ status = error              (любая ошибка)
```

---

## Идемпотентность и дедупликация

### POST /chat/opened
- Повторный вызов с тем же `storeId` + `reviewKey` **не создаёт дубль**
- Возвращает существующий `chatRecordId`
- HTTP 200 вместо 201

### POST /chat/{id}/anchor
- Повторный вызов **перезаписывает** данные (последний парсинг = актуальный)

### Дедупликация сообщений (в расширении)
- Перед отправкой стартового сообщения проверьте: есть ли уже исходящее от нас
- Если да — `status: "MESSAGE_SKIPPED"`

---

## Ошибки API

### Формат ошибок

```json
{
  "error": "Error type",
  "message": "Human-readable description"
}
```

### HTTP статусы

| Код | Описание |
|-----|----------|
| 200 | OK |
| 201 | Created (новая запись) |
| 400 | Bad Request (невалидные данные) |
| 401 | Unauthorized (нет/невалидный токен) |
| 403 | Forbidden (нет доступа к магазину) |
| 404 | Not Found (магазин/запись не найдены) |
| 429 | Too Many Requests (100 req/min лимит) |
| 500 | Internal Server Error |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-02-16T14:31:00.000Z
Retry-After: 30  (только при 429)
```

---

## Минимальный сценарий (MVP)

Для первого прогона достаточно вызвать **3 endpoint'а**:

```
1. GET  /chat/stores/{id}/rules   → получить правила
2. POST /chat/opened              → зафиксировать открытие чата
3. POST /chat/{id}/anchor         → зафиксировать системное сообщение
```

Endpoints `message-sent` и `error` — опциональны для MVP, но рекомендуются для полноты данных.

---

## Тестирование

### Быстрый тест (проверить что API работает)

```bash
# 1. Получить магазины
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores" | jq .

# 2. Получить правила для первого магазина
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores/STORE_ID/rules" | jq .

# 3. Тестовое открытие чата
curl -s -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "STORE_ID",
    "reviewContext": {
      "nmId": "123456789",
      "rating": 2,
      "reviewDate": "2026-02-16T12:00:00.000Z",
      "reviewKey": "123456789_2_2026-02-16T12:00"
    },
    "chatUrl": "https://seller.wildberries.ru/feedback-and-questions/chats/test123",
    "openedAt": "2026-02-16T14:00:00.000Z",
    "status": "CHAT_OPENED"
  }' \
  "https://rating5.ru/api/extension/chat/opened" | jq .

# 4. Тестовый anchor (подставьте chatRecordId из шага 3)
curl -s -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "systemMessageText": "Чат с покупателем по товару Тест, артикул 123456789",
    "parsedNmId": "123456789",
    "parsedProductTitle": "Тест",
    "anchorFoundAt": "2026-02-16T14:00:05.000Z",
    "status": "ANCHOR_FOUND"
  }' \
  "https://rating5.ru/api/extension/chat/CHAT_RECORD_ID/anchor" | jq .
```

---

## Вопросы и контакты

Если что-то непонятно или нужны изменения в API — создайте issue или свяжитесь с бэкенд-командой.

**Связанные документы:**
- [API Contract (полный)](../../../docs/reference/api.md) — в секции "Extension Chat API"
- [Product Spec](PRODUCT_SPEC.md) — продуктовая спецификация
- [Task](TASK-20260216-backend-api.md) — техническая задача
