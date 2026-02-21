# Extension API - Complete Documentation

> **Backend API для интеграции с Chrome Extension (R5 Complaints System)**

**Версия:** 2.1.0
**Дата обновления:** 2026-02-20
**Статус:** Production Ready

---

## Обзор

WB Reputation Manager работает в паре с Chrome Extension для автоматизации подачи жалоб на отзывы Wildberries.

### Архитектура интеграции

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Chrome Extension                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  1. Парсит отзывы со страницы WB seller cabinet             │    │
│  │  2. Отправляет статусы в Backend (review-statuses)          │    │
│  │  3. Получает готовые жалобы (complaints)                    │    │
│  │  4. Подает жалобы в WB                                      │    │
│  │  5. Обновляет статусы после подачи                          │    │
│  │  6. Проверяет статусы жалоб (complaint-statuses)            │    │
│  │  7. Скриншотит одобренные и шлёт детали (complaint-details) │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
└────────────── HTTP API ──────┼────────────────────────────────────────
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend API                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  - /api/extension/review-statuses     (статусы отзывов)     │    │
│  │  - /api/extension/stores              (список магазинов)    │    │
│  │  - /api/extension/stores/:id/complaints (очередь жалоб)     │    │
│  │  - /api/extension/stores/:id/stats    (статистика)          │    │
│  │  - /api/extension/complaint-statuses  (статусы жалоб WB)    │    │
│  │  - /api/extension/complaint-details   (одобренные жалобы)   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL:                                                 │    │
│  │  - review_statuses_from_extension (статусы от Extension)     │    │
│  │  - reviews (основная таблица отзывов)                       │    │
│  │  - review_complaints (AI-черновики жалоб)                   │    │
│  │  - complaint_details (одобренные жалобы — source of truth)  │    │
│  │  - review_chat_links (связка отзыв↔чат)                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Аутентификация

Все endpoints требуют Bearer Token в заголовке:

```http
Authorization: Bearer wbrm_<token>
```

**Формат токена:** `wbrm_` + 32-символьный хеш

**Где получить:** Токены хранятся в таблице `user_settings.api_key`

**Rate limit:** 100 requests/minute

---

## API Endpoints

### 1. Review Statuses Sync (NEW)

**Назначение:** Синхронизация статусов отзывов от Extension для фильтрации перед генерацией GPT жалоб. Экономит ~80% токенов.

#### POST /api/extension/review-statuses

Принимает статусы отзывов, спарсенные Extension с WB seller cabinet.

**Request:**

```http
POST /api/extension/review-statuses
Content-Type: application/json
Authorization: Bearer wbrm_<token>
```

```json
{
  "storeId": "7kKX9WgLvOPiXYIHk6hi",
  "parsedAt": "2026-02-01T12:00:00.000Z",
  "reviews": [
    {
      "reviewKey": "649502497_1_2026-01-07T20:09",
      "productId": "649502497",
      "rating": 1,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "statuses": ["Жалоба отклонена", "Выкуп"],
      "canSubmitComplaint": false,
      "chatStatus": "chat_available",
      "ratingExcluded": false
    }
  ]
}
```

**Fields:**
- `ratingExcluded` (boolean, optional, default: false) — WB transparent rating: `true` = review excluded from product rating calculation. Reviews with `ratingExcluded: true` are removed from all task queues.
- `chatStatus` (string, optional) — Chat button state: `chat_not_activated` | `chat_available` | `chat_opened`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "received": 20,
    "created": 15,
    "updated": 5,
    "errors": 0
  },
  "message": "Статусы успешно синхронизированы"
}
```

**Лимиты:**
- Max 100 reviews per request
- Max request size: 1 MB

---

#### GET /api/extension/review-statuses

Получение сохраненных статусов (для тестирования и верификации).

**Request:**

```http
GET /api/extension/review-statuses?storeId=xxx&limit=50&canSubmit=true|false|all
Authorization: Bearer wbrm_<token>
```

**Query Parameters:**

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| storeId | string | Да | ID магазина |
| limit | number | Нет | Лимит записей (default: 50, max: 100) |
| canSubmit | string | Нет | Фильтр: 'true', 'false', 'all' (default: 'all') |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "total": 1500,
    "reviews": [
      {
        "reviewKey": "649502497_1_2026-01-07T20:09",
        "productId": "649502497",
        "rating": 1,
        "reviewDate": "2026-01-07T20:09:37.000Z",
        "statuses": ["Жалоба отклонена", "Выкуп"],
        "canSubmitComplaint": false,
        "ratingExcluded": false,
        "parsedAt": "2026-02-01T12:00:00.000Z",
        "createdAt": "2026-02-01T12:00:01.000Z",
        "updatedAt": "2026-02-01T12:00:01.000Z"
      }
    ],
    "stats": {
      "canSubmit": 300,
      "cannotSubmit": 1200
    }
  }
}
```

---

### 2. Stores

#### GET /api/extension/stores

Получение списка магазинов пользователя.

**Response 200:**

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

**Response Fields:**

| Поле | Тип | Описание |
|------|-----|----------|
| id | string | Уникальный ID магазина |
| name | string | Название магазина |
| isActive | boolean | Активен ли магазин (status = 'active') |
| draftComplaintsCount | number | Количество жалоб в статусе `draft` **только для активных товаров** (`work_status = 'active'`) |

> **Важно:** `draftComplaintsCount` учитывает только жалобы по товарам с `work_status = 'active'`. Если товар поставлен на стоп — его черновики не считаются.

---

### 3. Complaints Queue

#### GET /api/extension/stores/{storeId}/complaints

Получение очереди жалоб для массовой подачи.

**Query Parameters:**

| Параметр | Тип | Default | Описание |
|----------|-----|---------|----------|
| filter | string | 'draft' | Фильтр статуса: 'draft', 'all' |
| limit | number | 100 | Лимит (max: 500) |
| rating | string | '1,2,3' | Рейтинги через запятую |

**Response 200:**

```json
{
  "complaints": [
    {
      "id": "MDZTXVilHWCXBK1YZx4u",
      "productId": "649502497",
      "rating": 1,
      "text": "Текст отзыва...",
      "authorName": "Алина",
      "createdAt": "2026-01-07T20:09:37.000Z",
      "complaintText": {
        "reasonId": 11,
        "reasonName": "Отзыв не относится к товару",
        "complaintText": "Текст жалобы..."
      }
    }
  ],
  "total": 601,
  "stats": {
    "by_rating": { "1": 205, "2": 123, "3": 273 },
    "by_article": { "649502497": 78, "528735233": 52 }
  }
}
```

---

### 4. Complaint Status Update

#### POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent

Отметить жалобу как отправленную.

**Request:**

```json
{
  "sentAt": "2026-02-01T14:30:00.000Z"
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Complaint marked as sent"
}
```

---

### 5. Stats

#### GET /api/extension/stores/{storeId}/stats

Получение статистики магазина.

**Response 200:**

```json
{
  "totalReviews": 15234,
  "complaintsQueue": {
    "draft": 601,
    "sent": 2340,
    "approved": 1523,
    "rejected": 234
  },
  "lastSync": "2026-02-01T08:00:00.000Z"
}
```

---

## База данных

### Таблица: review_statuses_from_extension

Хранит статусы отзывов, спарсенные Chrome Extension.

```sql
CREATE TABLE review_statuses_from_extension (
    id SERIAL PRIMARY KEY,
    review_key VARCHAR(100) NOT NULL,           -- {productId}_{rating}_{datetime}
    store_id TEXT NOT NULL REFERENCES stores(id),
    product_id VARCHAR(50) NOT NULL,            -- WB nmId
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_date TIMESTAMPTZ NOT NULL,
    statuses JSONB NOT NULL DEFAULT '[]',       -- ["Жалоба отклонена", "Выкуп"]
    can_submit_complaint BOOLEAN NOT NULL DEFAULT true,
    parsed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_review_key_store UNIQUE (review_key, store_id)
);
```

**Индексы:**
- `idx_ext_statuses_store_can_submit` - основной запрос фильтрации
- `idx_ext_statuses_product_rating_date` - матчинг с основной таблицей
- `idx_ext_statuses_parsed_at` - сортировка по времени парсинга

---

### Таблица: reviews (основная)

**Ключевые поля для Extension:**

| Поле | Тип | Описание |
|------|-----|----------|
| id | TEXT | Уникальный ID отзыва |
| product_id | TEXT → products.id | Ссылка на товар |
| rating | INTEGER | Рейтинг 1-5 |
| text | TEXT | Текст отзыва |
| complaint_status | ENUM | Статус жалобы |

**complaint_status ENUM:**

```sql
'not_sent'     -- Жалоба не создана
'draft'        -- Черновик (AI сгенерировал)
'sent'         -- Отправлена
'pending'      -- На рассмотрении WB
'approved'     -- Одобрена WB
'rejected'     -- Отклонена WB
'reconsidered' -- Пересмотрена (NEW)
```

---

### Таблица: review_complaints

1:1 связь с reviews, хранит детали жалобы.

**Ключевые поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| review_id | TEXT | FK → reviews.id |
| complaint_text | TEXT | Текст жалобы |
| reason_id | INTEGER | ID причины WB (11-20) |
| reason_name | TEXT | Название причины |
| status | TEXT | draft/sent/approved/rejected/pending |
| sent_at | TIMESTAMPTZ | Дата отправки |

---

## Маппинг статусов

### Статусы от Extension → complaint_status

| WB Interface | → | complaint_status |
|--------------|---|------------------|
| Жалоба отклонена | → | rejected |
| Жалоба одобрена | → | approved |
| Проверяем жалобу | → | pending |
| Жалоба пересмотрена | → | reconsidered |
| (нет статуса) | → | not_sent/draft |

### Логика canSubmitComplaint

```javascript
const COMPLAINT_STATUSES = [
  'Жалоба отклонена',
  'Жалоба одобрена',
  'Проверяем жалобу',
  'Жалоба пересмотрена'
];

// Можно подать = НЕТ ни одного статуса жалобы
const canSubmitComplaint = !statuses.some(s => COMPLAINT_STATUSES.includes(s));
```

---

## Тестовые данные

### Production Environment

```bash
Base URL: http://158.160.217.236
Test Token: wbrm_0ab7137430d4fb62948db3a7d9b4b997
Test Store: 7kKX9WgLvOPiXYIHk6hi (ИП Артюшина)
```

### Примеры запросов

#### Тест POST review-statuses:

```bash
curl -X POST "http://158.160.217.236/api/extension/review-statuses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
  -d '{
    "storeId": "7kKX9WgLvOPiXYIHk6hi",
    "parsedAt": "2026-02-01T14:00:00.000Z",
    "reviews": [
      {
        "reviewKey": "649502497_1_2026-01-07T20:09",
        "productId": "649502497",
        "rating": 1,
        "reviewDate": "2026-01-07T20:09:37.000Z",
        "statuses": ["Жалоба отклонена"],
        "canSubmitComplaint": false,
        "ratingExcluded": true
      }
    ]
  }'
```

#### Тест GET review-statuses:

```bash
curl "http://158.160.217.236/api/extension/review-statuses?storeId=7kKX9WgLvOPiXYIHk6hi&limit=10" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

#### Тест GET complaints:

```bash
curl "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=5" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

---

## Воркфлоу интеграции

### Полный цикл подачи жалоб

```
1. Extension парсит страницу WB seller cabinet
                    │
                    ▼
2. POST /api/extension/review-statuses
   (отправляем статусы всех отзывов)
                    │
                    ▼
3. Backend сохраняет в review_statuses_from_extension
   и переносит в основную таблицу reviews
                    │
                    ▼
4. CRON job генерирует жалобы ТОЛЬКО для отзывов
   где can_submit_complaint = true
                    │
                    ▼
5. GET /api/extension/stores/:id/complaints
   (Extension получает готовые жалобы)
                    │
                    ▼
6. Extension подает жалобы в WB
                    │
                    ▼
7. POST /api/extension/stores/:id/reviews/:id/complaint/sent
   (Extension отмечает жалобы как отправленные)
          │
          ▼
8. Extension Complaint Checker проверяет статусы жалоб на WB
          │
          ▼
9. POST /api/extension/complaint-statuses
   (Extension передаёт статусы всех жалоб + кто подавал)
          │
          ▼
10. При одобрении — Extension делает скриншот
          │
          ▼
11. POST /api/extension/complaint-details
    (Extension передаёт полные данные одобренной жалобы)
```

---

### 6. Complaint Statuses (Bulk Status Sync)

#### POST /api/extension/complaint-statuses

Массовое обновление статусов жалоб. Расширение парсит страницу жалоб WB и передаёт текущие статусы.

**Request:**

```json
{
  "storeId": "store_123",
  "results": [
    {
      "reviewKey": "149325538_1_2026-02-18T21:45",
      "status": "Жалоба одобрена",
      "filedBy": "R5",
      "complaintDate": "15.02.2026"
    }
  ]
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| reviewKey | string | `{nmId}_{rating}_{YYYY-MM-DDTHH:mm}` |
| status | string | "Жалоба одобрена" / "Жалоба отклонена" / "Проверяем жалобу" / "Жалоба пересмотрена" |
| filedBy | string | "R5" или "Продавец" |
| complaintDate | string\|null | Дата подачи DD.MM.YYYY, null если подал продавец |

**Что обновляет:**
- `reviews.complaint_status` + `complaint_filed_by` + `complaint_filed_date`
- `review_complaints.status` + `filed_by` + `complaint_filed_date`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "received": 50,
    "valid": 48,
    "reviewsUpdated": 45,
    "complaintsUpdated": 40,
    "skipped": 2
  },
  "elapsed": 234
}
```

---

### 7. Complaint Details (Approved Complaint Data)

#### POST /api/extension/complaint-details

Полные данные одобренной жалобы. Вызывается после каждого скриншота. Зеркало Google Sheets "Жалобы V 2.0".

**Назначение:** Биллинг, отчётность клиентам, обучение AI на реальных одобренных кейсах.

**Request:**

```json
{
  "storeId": "store_123",
  "complaint": {
    "checkDate": "20.02.2026",
    "cabinetName": "МойМагазин",
    "articul": "149325538",
    "reviewId": "",
    "feedbackRating": 1,
    "feedbackDate": "18 февр. 2026 г. в 21:45",
    "complaintSubmitDate": "15.02.2026",
    "status": "Одобрена",
    "hasScreenshot": true,
    "fileName": "149325538_18.02.26_21-45.png",
    "driveLink": "https://drive.google.com/file/d/abc123/view",
    "complaintCategory": "Отзыв не относится к товару",
    "complaintText": "Жалоба от: 20.02.2026\n\nОтзыв покупателя не содержит..."
  }
}
```

**Дедупликация:** `store_id + articul + feedbackDate + fileName`

**filed_by автодетекция:** complaintText начинается с "Жалоба от:" → `r5`, иначе → `seller`

**Response (created):**
```json
{ "success": true, "data": { "created": true } }
```

**Response (duplicate):**
```json
{ "success": true, "data": { "created": false, "reason": "duplicate" } }
```

---

## Error Handling

### Стандартные коды ошибок

| HTTP Status | Error Code | Описание |
|-------------|------------|----------|
| 400 | VALIDATION_ERROR | Некорректные данные |
| 401 | UNAUTHORIZED | Отсутствует/неверный токен |
| 403 | FORBIDDEN | Нет доступа к магазину |
| 404 | NOT_FOUND | Магазин/отзыв не найден |
| 429 | RATE_LIMITED | Превышен лимит запросов |
| 500 | INTERNAL_ERROR | Внутренняя ошибка сервера |

### Формат ошибки

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Описание ошибки",
    "details": [...]
  }
}
```

---

## Changelog

### v2.1.0 (2026-02-20)

**Data Collection Pipeline**

- POST /api/extension/complaint-statuses — массовый sync статусов жалоб + filed_by + complaintDate
- POST /api/extension/complaint-details — полные данные одобренных жалоб (source of truth для биллинга)
- Новая таблица `complaint_details` (migration 021) — зеркало Google Sheets "Жалобы V 2.0"
- Поля `filed_by` + `complaint_filed_date` на reviews + review_complaints (migration 020)
- Автодетекция filed_by из текста жалобы ("Жалоба от:" → r5)

### v2.0.0 (2026-02-16)

**Sprint 002: Review-Chat Linking**

- POST /api/extension/chat/opened — фиксация открытия чата из страницы отзывов
- POST /api/extension/chat/:id/anchor — фиксация системного сообщения
- POST /api/extension/chat/:id/message-sent — отправка стартового сообщения
- POST /api/extension/chat/:id/error — логирование ошибок
- GET /api/extension/chat/stores — список магазинов с chat-workflow
- GET /api/extension/chat/stores/:id/rules — правила чат-обработки

### v1.1.0 (2026-02-01)

**Sprint: Status Sync**

- ✅ Добавлена таблица `review_statuses_from_extension`
- ✅ Добавлен ENUM значение `reconsidered` в `complaint_status`
- ✅ Новый endpoint: `POST /api/extension/review-statuses`
- ✅ Новый endpoint: `GET /api/extension/review-statuses`
- ✅ Документация обновлена

**Ожидаемый результат:**
- Экономия ~80% GPT токенов
- Генерация жалоб только для подходящих отзывов

### v1.0.0 (2026-01-29)

- Исправлен токен аутентификации
- Исправлена фильтрация по статусу жалобы
- Исправлен формат productId (wb_product_id вместо vendor_code)
- Удалено поле productName из ответа

---

## Связанные документы

- [Sprint-StatusSync/README.md](../docs/Sprint-StatusSync/README.md) - Спецификация спринта
- [Sprint-StatusSync/API-SPEC.md](../docs/Sprint-StatusSync/API-SPEC.md) - Детальная спецификация API
- [database-schema.md](./database-schema.md) - Полная схема БД
- [EXTENSION_API_ISSUES_SUMMARY.md](./EXTENSION_API_ISSUES_SUMMARY.md) - История решённых проблем

---

## Контакты

**Backend Team:** WB Reputation Manager v2.0.0
**Repository:** https://github.com/Klimov-IS/R5-Saas-v-2.0
**Production:** http://158.160.217.236

---

**Последнее обновление:** 2026-02-20
**Автор:** R5 Backend Team
