# OZON Seller API — Документация для интеграции R5

> Этот файл — рабочий справочник по OZON API для планирования интеграции.
> Обновляется по мере изучения API.
> Последнее обновление: 2026-02-12

---

## Scope интеграции R5 + OZON

**Чаты + ответы на отзывы.** Жалобы на отзывы (complaints) на OZON невозможны,
но **можно отвечать на отзывы** через API (комментарии).

Нужные блоки API:
- Управление чатами (отправка/получение сообщений)
- **Работа с отзывами (чтение + AI-ответы)** — NEW!
- Товары (для контекста AI при генерации ответов)
- Рейтинг продавца (KPI дашборд)

Не нужны:
- Заказы (FBO/FBS/rFBS)
- Остатки и цены
- Накладные
- Финансы и аналитика
- Возвраты

---

## 1. Общие сведения

| Параметр | Значение | Сравнение с WB |
|----------|----------|----------------|
| **Base URL** | `https://api-seller.ozon.ru` | WB: несколько доменов (buyer-chat-api, feedbacks-api, content-api) |
| **Авторизация** | `Client-Id` + `Api-Key` (заголовки) | WB: один Bearer-токен (4 разных) |
| **OAuth** | Поддерживается (`Authorization: Bearer ACCESS_TOKEN`) | WB: нет OAuth |
| **Rate limit** | **50 req/sec** на все методы с одного Client ID | WB: ~5-10 req/min (значительно строже) |
| **Часовой пояс** | **UTC** | WB: MSK (UTC+3) |
| **Формат** | JSON | WB: JSON (чаты — FormData) |
| **CORS** | Запрещён с 16.05.2025 (back-to-back only) | WB: аналогично |

### Формат запроса

```http
GET / HTTP/1.1
Host: api-seller.ozon.ru
Client-Id: <Client-Id>
Api-Key: <Api-Key>
Content-Type: application/json
```

### OAuth-авторизация (альтернатива)

```http
POST https://api-seller.ozon.ru/{endpoint}
Authorization: Bearer ACCESS_TOKEN
```

OAuth через создание частного/публичного приложения в ЛК OZON.

### Важные ограничения

- Оферта должна быть подписана, иначе 403 `Offer not signed`
- OZON может отозвать ключ при подозрительной активности / большой нагрузке
- API-ключ виден только при создании — потом скрыт
- Можно создать несколько ключей с разными уровнями доступа

---

## 2. Идентификаторы товаров

| ID | Описание | Аналог в WB |
|----|----------|-------------|
| `product_id` | Внутренний ID товара в OZON | — |
| `offer_id` | ID предложения продавца (артикул) | `vendor_code` |
| `SKU` | SKU товара на OZON | `nmID` (wb_product_id) |

Пара `offer_id` + `product_id` используется **практически во всех запросах**.

> **Ключевое отличие от WB:** У WB один идентификатор `nmID` для всего. У OZON — тройка `product_id` / `offer_id` / `SKU`.

---

## 3. Товары (Products) — Релевантные методы

Нужны для контекста AI (имя товара, изображение, характеристики).

| Метод | Назначение | Примечания |
|-------|-----------|------------|
| `POST /v3/product/list` | Список товаров с фильтрами | Возвращает `offer_id` + `product_id` |
| `POST /v3/product/info/list` | Информация о товаре (штрихкод, цена, категория) | Основной метод |
| `POST /v4/product/info/attributes` | Характеристики товара | Для AI-контекста |
| `POST /v1/product/info/description` | Описание товара | Для AI-контекста |

### Категории и атрибуты

| Метод | Назначение |
|-------|-----------|
| `POST /v1/description-category/tree` | Дерево категорий и типов |
| `POST /v1/description-category/attribute` | Характеристики для категории+типа |
| `POST /v1/description-category/attribute/values` | Значения словарной характеристики (пагинация) |
| `POST /v1/description-category/attribute/values/search` | Поиск по значениям словаря |

#### `POST /v1/description-category/tree` — Дерево категорий

Возвращает полное дерево категорий OZON. Каждая категория имеет:

```json
{
  "result": [
    {
      "description_category_id": 17028922,
      "category_name": "Электроника",
      "children": [
        {
          "description_category_id": 17028923,
          "category_name": "Смартфоны",
          "type_name": "Смартфон",
          "type_id": 97311,
          "children": []
        }
      ]
    }
  ]
}
```

**Ключевые поля:**

| Поле | Описание |
|------|----------|
| `description_category_id` | ID категории (нужен для запроса атрибутов) |
| `type_id` | ID типа товара внутри категории |
| `type_name` | Название типа (например, "Смартфон") |
| `category_name` | Название категории |

> **Связка:** `description_category_id` + `type_id` = уникальная пара для запроса характеристик товара.

#### `POST /v1/description-category/attribute` — Характеристики категории

**Запрос:**
```json
{
  "description_category_id": 17028923,
  "type_id": 97311,
  "language": "RU"
}
```

**Ответ (структура одного атрибута):**
```json
{
  "result": [
    {
      "id": 85,
      "name": "Бренд",
      "description": "Укажите бренд товара",
      "type": "String",
      "is_collection": false,
      "is_required": true,
      "dictionary_id": 28732849,
      "group_name": "Общие",
      "group_id": 1,
      "attribute_complex_id": 0,
      "max_value_count": 1
    }
  ]
}
```

**Типы атрибутов:** `String`, `Integer`, `Decimal`, `Boolean`, `URL`, `ImageURL`

> **Для R5:** Категория + атрибуты дают структурированный контекст для AI.
> Когда AI генерирует ответ, мы можем знать: "это чат о Смартфоне (бренд Samsung, 128 ГБ)".
> WB аналог: у нас уже есть product name/description через WB Content API.

#### `POST /v1/description-category/attribute/values` — Значения словаря

Для атрибутов с `dictionary_id > 0` — нужно запрашивать допустимые значения.

**Запрос:**
```json
{
  "description_category_id": 17028923,
  "type_id": 97311,
  "attribute_id": 85,
  "language": "RU",
  "last_value_id": 0,
  "limit": 5000
}
```

**Ответ:**
```json
{
  "result": [
    { "id": 47043, "value": "Samsung", "info": "", "picture": "" },
    { "id": 47044, "value": "Apple", "info": "", "picture": "" }
  ],
  "has_next": true
}
```

> **Для R5:** Словари нужны в основном для создания/редактирования товаров (не наш скоуп).
> Но могут быть полезны для AI-контекста: если мы знаем `attribute_id` товара → словарь даёт читаемое значение.
> Низкий приоритет для MVP.

---

## 3.5 Отзывы (Reviews) — AI-ответы

> Все методы отзывов требуют **Premium Plus** или **Premium Pro**.
> Жалобы (complaints) на отзывы **невозможны** на OZON.
> Но можно **отвечать комментариями** — это задача для AI.

### 3.5.1 Обзор методов

| Метод | Назначение | Аналог в WB |
|-------|-----------|-------------|
| `POST /v1/review/list` | Список отзывов (пагинация) | `GET feedbacks-api/v1/feedbacks` |
| `POST /v1/review/info` | Детали отзыва (текст, рейтинг, фото, видео) | Включено в list у WB |
| `POST /v1/review/count` | Кол-во по статусам (processed/unprocessed) | Нет аналога |
| `POST /v1/review/change-status` | Пометить как обработан/необработан | Нет аналога |
| `POST /v1/review/comment/create` | **Ответить на отзыв** (комментарий) | `PATCH feedbacks-api/v1/feedbacks` |
| `POST /v1/review/comment/list` | Список комментариев к отзыву | Нет аналога (у WB один ответ) |
| `POST /v1/review/comment/delete` | Удалить комментарий | Нет аналога |

### 3.5.2 Сравнение с WB

| Аспект | WB | OZON |
|--------|-----|------|
| Получение отзывов | По дате, чанками, offset-пагинация | Курсор (`last_id` + `has_next`), limit 20-100 |
| Рейтинг | 1-5 (productValuation) | 1-5 (`rating`) |
| Текст отзыва | `text` + `pros` + `cons` | Только `text` (pros/cons устарели) |
| Фото/видео | `photoLinks[]`, `video` | `photos[]` (url+size), `videos[]` (url+preview) |
| Ответ продавца | Один ответ (PATCH) | **Комментарии** — можно несколько, древовидные (`parent_comment_id`) |
| Статус обработки | Нет | `PROCESSED` / `UNPROCESSED` — workflow-статус |
| Жалобы | Да (reason_id 11-20, 1000 символов) | **Нет** |
| Привязка к товару | `productDetails.nmId` | `sku` (OZON SKU) |
| Статус заказа | Нет | `order_status`: `DELIVERED` / `CANCELLED` |
| Участие в рейтинге | Нет (всегда) | `is_rating_participant: boolean` |

### 3.5.3 Детали: `POST /v1/review/list`

**Запрос:**
```json
{
  "last_id": "",           // курсор (пустой = первая страница)
  "limit": 100,            // 20-100
  "sort_dir": "ASC",       // ASC / DESC
  "status": "ALL"          // ALL / UNPROCESSED / PROCESSED
}
```

**Ответ:**
```json
{
  "has_next": true,
  "last_id": "string",
  "reviews": [
    {
      "id": "string",                    // UUID отзыва
      "rating": 0,                       // 1-5
      "text": "string",                  // текст отзыва
      "sku": 0,                          // SKU товара (int64)
      "status": "UNPROCESSED",           // PROCESSED / UNPROCESSED
      "order_status": "DELIVERED",       // DELIVERED / CANCELLED
      "is_rating_participant": true,     // участвует в рейтинге?
      "published_at": "2019-08-24T14:15:22Z",
      "comments_amount": 0,
      "photos_amount": 0,
      "videos_amount": 0
    }
  ]
}
```

### 3.5.4 Детали: `POST /v1/review/info`

Расширенная информация (добавляет к list):
```json
{
  "likes_amount": 0,          // лайки на отзыве
  "dislikes_amount": 0,       // дизлайки
  "photos": [
    { "url": "string", "width": 0, "height": 0 }
  ],
  "videos": [
    { "url": "string", "preview_url": "string", "width": 0, "height": 0 }
  ]
}
```

### 3.5.5 Детали: `POST /v1/review/comment/create` (ответ на отзыв)

**Запрос:**
```json
{
  "review_id": "string",                   // ID отзыва (обязателен)
  "text": "string",                        // текст комментария (обязателен)
  "parent_comment_id": "string",           // ID родительского комментария (для ответа на ответ)
  "mark_review_as_processed": true         // автоматически пометить как обработанный
}
```

**Ответ:** `{ "comment_id": "string" }`

**Ключевые отличия от WB:**
- У WB один ответ на отзыв (перезаписывается). У OZON — **цепочка комментариев**.
- `parent_comment_id` позволяет отвечать на ответ покупателя (вложенность).
- `mark_review_as_processed` — удобный workflow-флаг, автоматически ставит статус.
- Комментарии проходят **модерацию** перед публикацией.

### 3.5.6 Детали: `POST /v1/review/comment/list`

**Ответ:**
```json
{
  "comments": [
    {
      "id": "string",
      "text": "string",
      "published_at": "2019-08-24T14:15:22Z",
      "is_official": true,         // официальный ответ продавца
      "is_owner": true,            // автор — владелец магазина
      "parent_comment_id": "string"
    }
  ]
}
```

> `is_official` + `is_owner` — позволяют отличить ответ продавца от других комментариев.

### 3.5.7 Влияние на R5

**Что можем делать:**
1. **AI-ответы на отзывы** — аналог `generate-review-reply` из WB
2. **Автоматическая обработка** — пометка как PROCESSED после ответа
3. **Статистика** — count по статусам, likes/dislikes на отзывах
4. **Workflow** — фильтр UNPROCESSED → AI-ответ → mark as PROCESSED

**Что НЕ можем:**
- Жаловаться на отзывы (нет complaint API)
- Удалить/скрыть отзыв
- Один ответ перезаписать (только добавить новый комментарий)

**Маппинг полей для БД R5:**

| OZON поле | R5 поле (reviews) | Примечания |
|-----------|-------------------|------------|
| `id` | `id` | UUID отзыва |
| `rating` | `rating` | 1-5 (совпадает с WB) |
| `text` | `text` | Нет pros/cons на OZON |
| `sku` | → `product_id` через products | SKU → lookup |
| `published_at` | `date` | ISO 8601 UTC |
| `status` | Новое поле? | PROCESSED/UNPROCESSED |
| `order_status` | Новое поле? | DELIVERED/CANCELLED |
| `is_rating_participant` | Новое поле? | boolean |
| `photos[]` | `photo_links` | URL + dimensions |
| `videos[]` | Новое поле? | URL + preview |

---

## 4. Чаты (Chats) — ОСНОВНОЙ БЛОК

### 4.1 Обзор методов

| Метод | Назначение | Аналог в WB |
|-------|-----------|-------------|
| `POST /v3/chat/list` | Список чатов (ID чатов + ID последних сообщений) | `GET /api/v1/seller/chats` |
| `POST /v3/chat/history` | История сообщений чата | `GET /api/v1/seller/events` (курсор) |
| `POST /v1/chat/send/message` | Отправка текстового сообщения | `POST /api/v1/seller/message` (FormData) |
| `POST /v1/chat/send/file` | Отправка файла/изображения | Нет аналога в WB |
| `POST /v1/chat/start` | Создание нового чата по номеру отправления | Нет аналога в WB |
| `POST /v2/chat/read` | Отметить сообщения прочитанными | Нет аналога в WB |

### 4.2 Сравнение с WB Chat API

| Аспект | WB | OZON |
|--------|-----|------|
| Получение чатов | `/seller/chats` — список активных | `/v3/chat/list` — с ID последних сообщений |
| Получение сообщений | `/seller/events` — курсорная пагинация по всем чатам сразу | `/v3/chat/history` — история конкретного чата |
| Отправка текста | FormData (`replySign` + `message`) | JSON (`/v1/chat/send/message`) |
| Отправка файлов | Нет отдельного метода | Отдельный `/v1/chat/send/file` |
| Создание чата | Нет (чат создаёт покупатель) | **Да** — `/v1/chat/start` по номеру отправления |
| Прочитано | Нет | `/v2/chat/read` — отметка прочитанности |
| `replySign` | Обязателен для ответа | **Нет аналога** — ответ по `chat_id` |
| Формат данных | FormData (multipart) | JSON |
| Сортировка истории | От старых к новым (курсор) | **От новых к старым** (по умолчанию) |

### 4.3 Детали метода: `POST /v3/chat/list`

**Запрос:**
```json
{
  "filter": {
    "chat_status": "All",       // фильтр: "All" / "OPENED" / "CLOSED" (UPPERCASE в реальном API!)
    "unread_only": true         // только непрочитанные
  },
  "limit": 100,                // макс 100 (по умолчанию 30)
  "cursor": "304000402034"     // курсор для следующей страницы
}
```

**Ответ:**
```json
{
  "chats": [
    {
      "chat": {
        "created_at": "2022-07-22T08:07:19.581Z",
        "chat_id": "5e767w03-b400-4y1b-a841-75319ca8a5c8",
        "chat_status": "OPENED",
        "chat_type": "UNSPECIFIED"
      },
      "first_unread_message_id": 3000000381833363500,
      "last_message_id": 3000000399077800000,
      "unread_count": 11
    }
  ],
  "total_unread_count": 5,
  "cursor": "30000002342123123",
  "has_next": true
}
```

**Ключевые наблюдения (обновлено после API-тестов 2026-02-12):**
- `chat_id` = **UUID-строка** (подтверждено: `"3cdf5a5f-0dc2-4e65-904e-92f74b95a1ab"`)
- Пагинация: **курсорная** (limit + cursor + has_next)
- `chat_type`: в реальном API возвращает `"UNSPECIFIED"` (а не `"Buyer_Seller"` из Go SDK!)
- `chat_status`: **UPPERCASE** в реальном API: `"OPENED"` / `"CLOSED"` (не mixed case из Go SDK)
- `first_unread_message_id` / `last_message_id` — **number** (не string как в документации OZON!)
- **НЕТ** имени покупателя в ответе (в отличие от WB `clientName`)
- **НЕТ** product_id / товарной привязки (но есть в `context.sku` в history)
- Есть `unread_count` и `first_unread_message_id` — полезно для синка
- **Фильтр `chat_type` ИГНОРИРУЕТСЯ** — передача `"Buyer_Seller"` не фильтрует результат
- **Фильтр `chat_status` ИГНОРИРУЕТСЯ** — передача `"Closed"` возвращает все чаты (тест на PREMIUM-аккаунте)

> **v2 устаревает** — была offset-пагинация (limit до 1000). Используем только v3.

### 4.4 Детали метода: `POST /v3/chat/history`

> Требует **Premium Plus** или **Premium Pro**.
> v2 отключается 13 июля 2025. **Используем v3.**

**Запрос:**
```json
{
  "chat_id": "18b8e1f9-4ae7-461c-84ea-8e1f54d1a45e",
  "direction": "Forward",           // "Forward" (старые→новые) | "Backward" (новые→старые, default). CASE-SENSITIVE!
  "from_message_id": 3000000000118032000,  // обязателен при Forward
  "limit": 50,                       // макс 1000, по умолчанию 50
  "filter": {                        // NEW в v3!
    "message_ids": ["3000000300211559667"]  // фильтр по конкретным ID (опционально)
  }
}
```

**Ответ (v3 — расширенный):**
```json
{
  "has_next": true,
  "messages": [
    {
      "message_id": "3000000000817031942",
      "user": {
        "id": "115568",
        "type": "Сustomer"
      },
      "created_at": "2019-08-24T14:15:22Z",
      "is_read": true,
      "data": [
        "Здравствуйте, у меня вопрос по вашему товару..."
      ],
      "context": {
        "order_number": "123456789",
        "sku": "987654321"
      },
      "is_image": true,
      "moderate_image_status": "SUCCESS"
    }
  ]
}
```

**Новые поля в v3 (по сравнению с v2):**

| Поле | Тип | Описание | Важность |
|------|-----|----------|----------|
| **`context.order_number`** | string | Номер заказа | **КРИТИЧНО** — привязка к заказу! |
| **`context.sku`** | string | SKU товара | **КРИТИЧНО** — привязка к товару! |
| `is_image` | boolean | Сообщение — изображение? | Полезно для UI |
| `moderate_image_status` | string | Статус модерации изображения (`SUCCESS`) | Информативно |
| `filter.message_ids` | string[] | Запрос конкретных сообщений | Полезно для точечного синка |

> **ВАЖНЕЙШЕЕ ОТКРЫТИЕ:** `context.sku` решает проблему привязки чата к товару!
> Хотя `/v3/chat/list` не возвращает product_id, **сообщения в `/v3/chat/history` содержат SKU**.

**Полная таблица полей сообщения:**

| Поле | Формат | Аналог в WB | Примечания |
|------|--------|-------------|------------|
| `message_id` | Строка (большое число) | `eventID` | ID сообщения |
| `user.id` | Строка (число) | — | ID пользователя |
| `user.type` | `"Сustomer"` / ??? | `sender: 'client'\|'seller'` | Нужно выяснить тип для продавца |
| `created_at` | ISO 8601 (UTC) | `addTime` | Время создания |
| `is_read` | boolean | — | Прочитано ли (WB не имеет) |
| `data` | **Массив строк** | `message.text` (строка) | Текст как массив |
| `context.sku` | string | `goodCard.nmID` | **Привязка к товару!** |
| `context.order_number` | string | — | Привязка к заказу |
| `is_image` | boolean | — | Тип контента |

**Маппинг sender (Go SDK + реальные API-тесты 2026-02-12):**
```
OZON user.type         →  R5 sender
"customer"             →  "client"     // покупатель
"seller"               →  "seller"     // продавец (мы)
"NotificationUser"     →  (ignore)     // НОВОЕ! Системные уведомления OZON (id="o3_notification_user_sc")
"crm"                  →  (ignore)     // CRM OZON
"courier"              →  (ignore)     // курьер
"support"              →  (ignore)     // поддержка OZON
```

### 4.4.1 Детали метода: `POST /v1/chat/send/message`

> Требует **Premium Plus** или **Premium Pro**.

**Запрос:**
```json
{
  "chat_id": "99feb3fc-a474-469f-95d5-268b470cc607",
  "text": "test"
}
```

**Ответ:** `{ "result": "success" }`

**Ограничения:**
- Текст: plain text, **1-1000 символов**
- FBO: можно отправить в течение **48 часов** с последнего сообщения покупателя
- FBS/rFBS: можно отправить после оплаты и в течение **72 часов после доставки**,
  далее — только ответ в течение **48 часов** с последнего сообщения покупателя

**Сравнение с WB:**

| Аспект | WB | OZON |
|--------|-----|------|
| Формат | FormData (`replySign` + `message`) | JSON (`chat_id` + `text`) |
| Лимит текста | Нет лимита | **1-1000 символов** |
| Окно ответа | Нет ограничения | 48ч (FBO) / 72ч+48ч (FBS) |
| Аутентификация | `replySign` (уникальный per-chat) | `chat_id` (UUID) |

> **Лимит 1000 символов** — нужно учитывать в AI-генерации ответов!

### 4.4.1b Детали метода: `POST /v1/chat/send/file`

> Требует **Premium Plus** или **Premium Pro**.

**Запрос:**
```json
{
  "base64_content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQA...",
  "chat_id": "99feb3fc-a474-469f-95d5-268b470cc607",
  "name": "photo.png"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `base64_content` | string (required) | Файл в виде **base64-строки** |
| `chat_id` | string (required) | ID чата |
| `name` | string (required) | Имя файла **с расширением** |

**Ответ:** `{ "result": "success" }`

**Ключевые отличия:**
- Формат: **JSON с base64**, а не multipart/form-data — удобно для программной отправки
- Временные окна: те же ограничения 48/72ч что и для текстовых сообщений
- Расширение файла определяет тип контента (png, jpg, pdf и т.д.)

> **Для R5:** Может быть полезно для отправки фото компенсации, скриншотов, инструкций.
> На MVP — не приоритет. AI генерирует текст, не файлы.

### 4.4.2 Детали метода: `POST /v1/chat/start`

> Требует **Premium Plus** или **Premium Pro**.

**Запрос:**
```json
{
  "posting_number": "47873153-0052-1"     // номер отправления
}
```

**Ответ:**
```json
{
  "result": {
    "chat_id": "5969c331-2e64-44b7-8a0e-ff9526762c62"
  }
}
```

**Ограничения:**
- FBO: **только покупатель** может начать чат
- FBS/rFBS: продавец может начать чат в течение **72 часов** после оплаты/доставки

> Привязка через `posting_number` — это способ связать чат с заказом/товаром.

### 4.4.3 Детали метода: `POST /v2/chat/read`

> Требует **Premium Plus** или **Premium Pro**.

**Запрос:**
```json
{
  "chat_id": "99feb3fc-a474-469f-95d5-268b470cc607",
  "from_message_id": 3000000000118032000    // все сообщения до этого ID = прочитаны
}
```

**Ответ:** `{ "unread_count": 0 }`

### 4.5 Ключевые архитектурные отличия

**1. Нет `replySign`:**
У WB для отправки сообщения нужен `replySign` (уникальный токен чата, хранится в БД).
У OZON достаточно `chat_id` — **значительно проще**.

**2. История по чату, а не глобальные events:**
WB: один эндпоинт `/events` с курсором возвращает события по ВСЕМ чатам.
OZON: `/v3/chat/history` запрашивается **по конкретному чату** (по `chat_id` или `message_id`).

> Стратегия синхронизации OZON:
> 1. `POST /v3/chat/list` (filter: unread_only или all Opened) → получить список чатов
> 2. Сравнить `last_message_id` с сохранённым в БД
> 3. Для изменённых чатов: `POST /v3/chat/history` (direction: Forward, from: last_known_message_id)
> 4. Сохранить новые сообщения + обновить `last_message_id`

**3. Можно создавать чаты:**
OZON позволяет продавцу инициировать чат (`/v1/chat/start` по номеру отправления).
WB — нет (только покупатель начинает).

**4. Отметка "прочитано":**
OZON поддерживает `/v2/chat/read` — можно отмечать сообщения прочитанными.
WB — нет такого.

**5. Товарная привязка через сообщения, не через чат:**
WB: чат содержит `goodCard.nmID` → сразу знаем, о каком товаре речь.
OZON: `/v3/chat/list` не возвращает product_id, **НО** `/v3/chat/history` содержит `context.sku` + `context.order_number` в каждом сообщении. Привязка к товару возможна при первом синке истории.

**6. Нет имени покупателя:**
WB: чат содержит `clientName`.
OZON: только `user.id` (число). Имя покупателя нужно получать отдельно (или невозможно).

**7. `data` — массив, не строка:**
WB: `message.text` — одна строка.
OZON: `data` — **массив строк**. Из примеров видно: обычно **один элемент** с полным текстом,
включая markdown-ссылки: `[ модель ](https://www.ozon.ru/product/...)`.
Парсинг: `data[0]` — основной текст сообщения. Множественные элементы — вероятно, для файлов/вложений.

### 4.6 Ограничения

#### Premium Plus / Premium Pro обязательны

> **ПОДТВЕРЖДЕНО тестами (2026-02-12):**
> - **Reviews:** 403 — `"Information is available starting from the premium plus subscription."`
> - **Chats:** list и history работают на PREMIUM (без Plus), но возвращают только системные уведомления
> - **Покупательские чаты и отзывы** требуют **Premium Plus** — подтверждено

Проверка: `POST /v1/rating/summary` → `premium_plus: boolean`
или `POST /v1/seller/info` → `subscription.type` = `"PREMIUM_PLUS"` / `"PREMIUM_PRO"` / `"PREMIUM"`.

#### Временные окна для сообщений

| Тип доставки | Когда можно писать первым | Окно ответа |
|-------------|--------------------------|-------------|
| **FBO** | Только покупатель начинает | **48 часов** с последнего сообщения покупателя |
| **FBS/rFBS** | После оплаты, до 72ч после доставки | **48 часов** с последнего сообщения покупателя |

> **Для R5:** Нужно отслеживать `created_at` последнего сообщения клиента
> и предупреждать оператора/AI об истекающем окне ответа.
> У WB таких ограничений нет.

#### Лимит текста: 1000 символов

Отправка сообщения: plain text, 1-1000 символов.
AI-генерация должна укладываться в этот лимит (аналогично WB complaints).

### 4.7 Открытые вопросы

**Закрытые вопросы:**
- [x] ~~Формат запроса `/v1/chat/send/message`~~ → `{ chat_id, text }`, plain text 1-1000 символов
- [x] ~~Документация на v3 chat/history~~ → Получена! Новые поля: `context`, `is_image`, `filter.message_ids`
- [x] ~~Есть ли привязка к товару/заказу?~~ → **ДА!** `context.sku` + `context.order_number` в сообщениях v3
- [x] ~~Есть ли поле для вложений?~~ → `is_image: boolean` + `moderate_image_status`
- [x] ~~Как проверить Premium Plus?~~ → **2 способа:** `rating/summary` → `premium_plus` ИЛИ `seller/info` → `subscription.type`
- [x] ~~Как связать чат с товаром?~~ → `context.sku` в сообщениях `/v3/chat/history`
- [x] ~~Как получить название магазина?~~ → `POST /v1/seller/info` → `company.name`
- [x] ~~Формат `/v1/chat/send/file`~~ → JSON: `{ base64_content, chat_id, name }` (base64, не multipart)
- [x] ~~Что если `data[]` содержит несколько элементов?~~ → Обычно 1 элемент с полным текстом (включая markdown-ссылки). `data[0]` = текст сообщения

**Оставшиеся вопросы (2 — после финальных тестов):**

**По бизнес-логике:**
- [ ] Как получить имя покупателя? (только `user.id` в API — OZON принципиально не раскрывает)
- [ ] Reviews API — как выглядит реальный ответ `/v1/review/list`? (нужен Premium Plus)

**Закрыто финальными тестами (2026-02-12):**
- [x] ~~`chat_type: "UNSPECIFIED"`~~ → **РЕШЕНО!** При полной пагинации (237 чатов) нашлись ВСЕ типы: `BUYER_SELLER` (78), `SELLER_SUPPORT` (136), `UNSPECIFIED` (23). Все UPPERCASE!
- [x] ~~Фильтры chat_status/chat_type~~ → Частично: chat/list видит все типы на PREMIUM, но chat/history для BUYER_SELLER = 403 без Premium Plus

**Закрыто через Go SDK** (`github.com/diPhantxm/ozon-api-client`, файл `ozon/chats.go`):

- [x] ~~`chat_status`~~ → Go SDK: `"All"`, `"Opened"`, `"Closed"`. **Реальный API: `"OPENED"` (UPPERCASE!)**
- [x] ~~`chat_type`~~ → Go SDK: `"Seller_Support"`, `"Buyer_Seller"`. **Реальный API: `"UNSPECIFIED"` (всегда)**
- [x] ~~Фильтр по `chat_type`~~ → Фильтр **игнорируется**. Фильтруем на стороне R5 по `user.type`
- [x] ~~`user.type`~~ → Go SDK: 5 значений. **Реальный API: 6-й тип `"NotificationUser"`!**
- [x] ~~Webhooks~~ → Подтверждено: только polling через `/v3/chat/list`

### Полные enum-таблицы (Go SDK + реальные API-тесты 2026-02-12)

**`chat_status` (подтверждено тестами — ALL UPPERCASE):**

| Значение в ответе | Кол-во (тест) | Описание |
|----------|----------|--------|
| `"OPENED"` | 215 | Открытые чаты |
| `"CLOSED"` | 22 | Закрытые чаты (все — SELLER_SUPPORT) |

> Для фильтра в запросе: `"All"` / `"Opened"` / `"Closed"` (mixed case).
> В ответе значения **ВСЕГДА UPPERCASE**: `"OPENED"`, `"CLOSED"`.

**`chat_type` (подтверждено тестами — ALL UPPERCASE, 3 значения):**

| Значение в ответе | Кол-во (тест) | Описание | Для R5 |
|----------|----------|--------|--------|
| `"BUYER_SELLER"` | 78 | Покупательские чаты | **Основной тип** |
| `"SELLER_SUPPORT"` | 136 | Поддержка OZON | Игнорируем |
| `"UNSPECIFIED"` | 23 | Уведомления/системные | Игнорируем |

> **ВАЖНО:** При первичном тесте (limit=10) все чаты были UNSPECIFIED — это из-за сортировки
> по last_message_id (уведомления всегда "свежее"). При полной пагинации (237 чатов) нашлись все 3 типа.
> Go SDK имеет `"Buyer_Seller"` / `"Seller_Support"` (mixed case) — **реальный API: UPPERCASE!**
>
> **Premium Plus и chat_type:**
> - `/v3/chat/list` — видит ВСЕ типы чатов на PREMIUM (без Plus)
> - `/v3/chat/history` для BUYER_SELLER — **требует Premium Plus** (403!)
> - `/v3/chat/history` для UNSPECIFIED/SELLER_SUPPORT — работает на PREMIUM

**`user.type` (sender mapping — обновлено после тестов):**

| OZON `user.type` | R5 sender | Описание | Источник |
|-------------------|-----------|----------|----------|
| `"customer"` | `"client"` | Покупатель | Go SDK |
| `"seller"` | `"seller"` | Продавец (мы) | Go SDK |
| **`"NotificationUser"`** | — (игнорируем) | **Системные уведомления OZON** | **API-тест!** |
| `"crm"` | — (игнорируем) | CRM-система OZON | Go SDK |
| `"courier"` | — (игнорируем) | Курьер | Go SDK |
| `"support"` | — (игнорируем) | Поддержка OZON | Go SDK |

> **ОТКРЫТИЕ из тестов:** 6-й тип `"NotificationUser"` (НЕТ в Go SDK!).
> `user.id` = `"o3_notification_user_sc"`. Это маркетинговые рассылки OZON для продавцов.
> R5 должен **игнорировать** сообщения с этим типом.
>
> **ПОДТВЕРЖДЕНО:** В реальном API `user.type` НЕ lowercase — `"NotificationUser"` (PascalCase).
> Безопасный маппинг: switch по точному значению, с fallback на `toLowerCase()`.

---

## 4.8 Информация о продавце

### `POST /v1/seller/info`

Возвращает информацию о кабинете продавца: компания, рейтинги и подписка — **всё в одном запросе**.

**Запрос:** `{}` (пустой body)

**Ответ (полная структура):**
```json
{
  "company": {
    "country": "string",
    "currency": "string",
    "inn": "string",
    "legal_name": "string",
    "name": "string",
    "ogrn": "string",
    "ownership_form": "string",
    "tax_system": "UNKNOWN"
  },
  "ratings": [
    {
      "name": "string",
      "rating": "string",
      "status": "UNKNOWN",
      "value_type": "UNKNOWN",
      "current_value": {
        "date_from": "2019-08-24T14:15:22Z",
        "date_to": "2019-08-24T14:15:22Z",
        "formatted": "string",
        "value": 0,
        "status": {
          "danger": true,
          "premium": true,
          "warning": true
        }
      },
      "past_value": {
        "date_from": "2019-08-24T14:15:22Z",
        "date_to": "2019-08-24T14:15:22Z",
        "formatted": "string",
        "value": 0,
        "status": {
          "danger": true,
          "premium": true,
          "warning": true
        }
      }
    }
  ],
  "subscription": {
    "is_premium": true,
    "type": "UNKNOWN"
  }
}
```

**Ключевые поля — `company`:**

| Поле | Тип | Значение для R5 |
|------|-----|-----------------|
| `company.name` | string | **Название магазина** — store name в R5 |
| `company.legal_name` | string | Юрлицо — для отображения/верификации |
| `company.inn` | string | ИНН юрлица |
| `company.ogrn` | string | ОГРН юрлица |
| `company.country` | string | Страна |
| `company.currency` | string | Валюта |
| `company.ownership_form` | string | Форма собственности (ООО, ИП и т.д.) |
| `company.tax_system` | string | Система налогообложения (`UNKNOWN` и др.) |

**Ключевые поля — `subscription`:**

| Поле | Тип | Значение для R5 |
|------|-----|-----------------|
| `subscription.is_premium` | boolean | Есть Premium (базовый) |
| `subscription.type` | string | Тип подписки: `PREMIUM_PLUS` / `PREMIUM_PRO` / `UNKNOWN` |

**Ключевые поля — `ratings[]` (рейтинги ПРЯМО В ОТВЕТЕ!):**

| Поле | Тип | Описание |
|------|-----|----------|
| `ratings[].name` | string | Название рейтинга |
| `ratings[].rating` | string | Уровень рейтинга |
| `ratings[].status` | string | Статус (`UNKNOWN` и др.) |
| `ratings[].value_type` | string | Тип значения (`UNKNOWN` и др.) |
| `ratings[].current_value.value` | number | **Текущее значение** |
| `ratings[].current_value.formatted` | string | Отформатированное значение |
| `ratings[].current_value.status` | object | `{ danger, premium, warning }` — boolean-флаги уровня |
| `ratings[].past_value` | object | Прошлое значение (та же структура) |

> **ЗАЦЕПКА — ТРИ В ОДНОМ!** `/v1/seller/info` возвращает:
> 1. **Компанию** — название магазина для онбординга
> 2. **Подписку** — Premium Plus проверка
> 3. **Рейтинги** — текущие + прошлые значения с danger/premium/warning статусами
>
> Это значит, что при онбординге **одним запросом** получаем ВСЁ:
> имя, подписку, и даже рейтинги! Не нужен отдельный `/v1/rating/summary` для базовой проверки.
>
> `/v1/rating/summary` и `/v1/rating/history` всё ещё нужны для:
> - Детальной истории по дням
> - Штрафных баллов Premium (`with_premium_scores`)
> - Поля `premium_plus: boolean` (прямой флаг, проще парсить)

> **ЗАЦЕПКА:** `company.name` решает вопрос "как получить название магазина OZON" при добавлении в R5.
> Аналог WB: при добавлении WB-магазина мы ищем имя через WB API. Для OZON — один запрос `/v1/seller/info`.

### `POST /v1/roles` — Роли и методы API-ключа

Возвращает список ролей и доступных методов для текущего API-ключа.

**Запрос:** `{}` (пустой body)

**Ответ:**
```json
{
  "roles": [
    {
      "name": "Admin",
      "methods": ["/v1/actions"]
    },
    {
      "name": "Posting FBS",
      "methods": ["/v1/posting"]
    }
  ]
}
```

**Поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `roles[].name` | string | Название роли (Admin, Posting FBS, и т.д.) |
| `roles[].methods` | string[] | Массив путей доступных методов |

> **ЗАЦЕПКА — ВАЛИДАЦИЯ ПРИ ОНБОРДИНГЕ!**
> Это **идеальный метод для проверки API-ключа** при добавлении OZON-магазина в R5.
>
> **Сценарий онбординга (3 запроса):**
> 1. `POST /v1/roles` → проверяем, что ключ валидный + имеет доступ к нужным методам
> 2. `POST /v1/seller/info` → получаем название магазина + проверяем Premium Plus
> 3. Показываем пользователю: "Магазин: [name], Подписка: [type], Доступ: ✅/❌"
>
> **Какие методы проверять в `roles[].methods`:**
> - `/v3/chat/list`, `/v3/chat/history`, `/v1/chat/send/message` — чаты
> - `/v1/review/list`, `/v1/review/comment/create` — отзывы
> - `/v1/rating/summary` — рейтинг
> - `/v3/product/list`, `/v3/product/info/list` — товары
>
> Если какой-то метод отсутствует → предупреждаем:
> "Ваш API-ключ не имеет доступа к чатам. Создайте ключ с ролью [X]."
>
> **Сравнение с WB:** У WB нет такого метода. Мы узнаём о недостаточных правах
> только когда получаем ошибку при конкретном запросе. OZON — **проактивная проверка**.

---

## 5. Сравнение авторизации: WB vs OZON

| Аспект | Wildberries | OZON |
|--------|-------------|------|
| Количество токенов | 4 (api, content, feedbacks, chat) | 1 ключ (Client-Id + Api-Key) |
| Формат | `Authorization: {token}` | Два заголовка: `Client-Id` + `Api-Key` |
| OAuth | Нет | Да (Bearer token) |
| Создание | Через ЛК WB | Через ЛК OZON → Настройки → Seller API |
| Уровни доступа | Нет (один токен = всё) | Да (разные ключи = разные права) |
| Восстановление | Перевыпуск | Только создание нового |

### Влияние на БД R5

Текущая таблица `stores` имеет 4 WB-поля:
```
api_token, content_api_token, feedbacks_api_token, chat_api_token
```

Для OZON нужны:
```
ozon_client_id TEXT
ozon_api_key TEXT
```

---

## 6. Рейтинг продавца и аналитика

### 6.1 Рейтинг продавца

| Метод | Назначение |
|-------|-----------|
| `POST /v1/rating/summary` | Текущие значения рейтингов + флаги Premium/Premium Plus |
| `POST /v1/rating/history` | История рейтингов за период + штрафные баллы Premium |

#### `POST /v1/rating/summary` — детали

**Запрос:** `{}` (пустой body)

**Ответ (ключевые поля):**
```json
{
  "groups": [
    {
      "group_name": "string",
      "items": [
        {
          "name": "string",           // название рейтинга
          "current_value": 0,         // текущее значение
          "past_value": 0,            // прошлое значение
          "rating": "string",         // уровень
          "status": "string",         // статус
          "change": {
            "direction": "string",    // направление изменения
            "meaning": "string"       // значение изменения
          }
        }
      ]
    }
  ],
  "penalty_score_exceeded": true,     // штрафные баллы превышены
  "premium": true,                    // есть ли Premium
  "premium_plus": true                // есть ли Premium Plus !!!
}
```

> **ВАЖНО для интеграции:** Поле `premium_plus` позволяет **программно проверить**,
> доступны ли чаты с покупателями для данного продавца!
> Решает наш открытый вопрос из секции 4.6.

#### `POST /v1/rating/history` — детали

**Запрос:**
```json
{
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-02-12T00:00:00Z",
  "ratings": ["rating_reaction_time", "rating_replied_dialogs_ratio"],
  "with_premium_scores": true
}
```

**Доступные рейтинги:**

| Рейтинг | Описание | Релевантность для R5 |
|---------|----------|---------------------|
| **`rating_reaction_time`** | **Среднее время первого ответа** покупателю (сек), 30 дней | **КРИТИЧНО** — прямой KPI нашего сервиса |
| **`rating_average_response_time`** | **Среднее время ответа** (сек), 30 дней | **КРИТИЧНО** — KPI |
| **`rating_replied_dialogs_ratio`** | **% диалогов с ответом в 24ч**, 30 дней | **КРИТИЧНО** — KPI |
| `rating_review_avg_score_total` | Средняя оценка всех товаров | Полезно для дашборда |
| `rating_on_time` | % заказов доставленных вовремя, 30 дней | Информативно |
| `rating_price_green` | Выгодный индекс цен | Не для нас |
| `rating_price_yellow` | Умеренный индекс цен | Не для нас |
| `rating_price_red` | Невыгодный индекс цен | Не для нас |
| `rating_price_super` | Супервыгодный индекс цен | Не для нас |
| `rating_ssl` | Оценка FBO (поставки) | Не для нас |
| `rating_on_time_supply_delivery` | % поставок вовремя, 60 дней | Не для нас |
| `rating_order_accuracy` | % поставок без ошибок, 60 дней | Не для нас |
| `rating_on_time_supply_cancellation` | % заявок без опоздания, 60 дней | Не для нас |
| `rating_general_indicator_fbs_rfbs` | Индекс ошибок FBS/rFBS | Не для нас |

**Ответ содержит:**
- `values[]` — значения за каждый день/период
- `danger_threshold` / `warning_threshold` / `premium_threshold` — пороговые значения
- `status` — `{ danger, premium, warning }` (boolean) — уровень для каждого значения
- `premium_scores[]` — штрафные баллы (если `with_premium_scores=true`)

> **Для R5 дашборда:**
> 3 чат-метрики OZON — это прямые KPI нашего сервиса:
> - Время первого ответа (секунды)
> - Среднее время ответа (секунды)
> - Доля диалогов с ответом в 24ч (процент)
> Можем показывать "до R5" и "после R5" — доказательство ценности сервиса!

### 6.2 Оборачиваемость товаров

**Метод:** `POST /v1/analytics/stock_on_warehouses` (или аналогичный)

**Ответ содержит по каждому товару:**

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | string | Название товара |
| `offer_id` | string | Артикул продавца |
| `sku` | int64 | SKU товара в OZON |
| `current_stock` | int64 | Остаток на складе, шт |
| `ads` | double | Среднесуточные продажи за 60 дней |
| `idc` | double | На сколько дней хватит остатка |
| `idc_grade` | enum | Уровень остатка: `GRADES_GREEN` / `YELLOW` / `RED` / `CRITICAL` / `NOSALES` / `NONE` |
| `turnover` | double | Фактическая оборачиваемость (дни) |
| `turnover_grade` | enum | Уровень оборачиваемости (та же шкала) |

**Пагинация:** limit + offset

> **Для R5:** Не критично для MVP чатов, но полезно для расширенной аналитики.
> Можно показывать в карточке товара рядом с правилами.

### 6.3 Отчёты (асинхронные)

OZON генерирует отчёты асинхронно:
1. Запросить создание → получить `code` (уникальный ID отчёта)
2. Полить `/v1/report/info` с этим `code` → статусы: `waiting` → `processing` → `success`
3. Получить ссылку на XLSX/CSV файл

**Типы отчётов:**
- `SELLER_PRODUCTS` — отчёт по товарам
- `SELLER_STOCK` — остатки
- `SELLER_RETURNS` — возвраты
- `SELLER_POSTINGS` — отправления
- `SELLER_DISCOUNTED` — уценённые товары
- И другие (финансовые, маркировка, размещение)

> **Для R5:** На будущее. Может быть полезно для автоматических отчётов клиентам.
> Не нужно для MVP чатов.

---

## 7. Архитектурные решения (по мере изучения)

### Маппинг идентификаторов

```
WB:   chats.product_nm_id  →  products.wb_product_id (nmID)
OZON: chats.product_nm_id  →  products.wb_product_id (???)
      Нужно решить: хранить SKU или product_id?
```

### Rate limiting

OZON: 50 req/sec — **в 300+ раз щедрее WB**.
Текущие задержки (1.5s между страницами чата, 10s между чанками ревью) для OZON не нужны.
Можно делать параллельные запросы.

---

## 8. Результаты API-тестов (2026-02-12)

> Тестовый аккаунт: **MariKollection** (Client-Id: 645186)
> Подписка: **PREMIUM** (не Premium Plus!)
> Скрипты: `scripts/test-ozon-api.mjs`, `scripts/test-ozon-api-v2.mjs`, `scripts/test-ozon-api-v3.mjs`

### Сводка тестов (все раунды)

| Эндпоинт | Статус | Результат |
|----------|--------|-----------|
| `POST /v1/seller/info` | **200** | MariKollection, ИП, PREMIUM, 20+ рейтингов |
| `POST /v1/roles` | **200** | Admin role, 100+ доступных методов |
| `POST /v3/product/list` | **200** | 20 товаров, все product_id + offer_id + FBO/FBS флаги |
| `POST /v3/product/info/list` | **200** | Полные данные: name, price, images, SKU, stocks, commissions (batch до 20) |
| `POST /v1/product/info/description` | **200** | HTML-описание товара (до 2000+ символов) |
| `POST /v1/product/info/attributes` | **404** | Эндпоинт не существует! |
| `POST /v1/description-category/tree` | **200** | 9372 leaf-категории |
| `POST /v1/description-category/attribute` | **200** | 48 атрибутов (4 обязательных) для категории сумок |
| `POST /v1/review/list` | **403** | Требует Premium Plus! |
| `POST /v1/review/info` | **400** | review_id = string (не number!) |
| `POST /v3/chat/list` | **200** | 237 чатов: 78 BUYER_SELLER, 136 SELLER_SUPPORT, 23 UNSPECIFIED |
| `POST /v3/chat/history` (UNSPECIFIED) | **200** | Работает на PREMIUM |
| `POST /v3/chat/history` (BUYER_SELLER) | **403** | Требует Premium Plus! |
| `POST /v1/rating/summary` | **200** | Рейтинги в группах, premium=true |
| `POST /v1/rating/history` | **200** | 30 дней истории, threshold-ы, статусы danger/premium/warning |

### Расхождения с документацией OZON и Go SDK

| Что | Документация/Go SDK | Реальный API | Критичность |
|-----|---------------------|-------------|-------------|
| `chat_status` | `"Opened"` / `"Closed"` | **`"OPENED"` / `"CLOSED"`** (UPPERCASE) | ВЫСОКАЯ |
| `chat_type` | `"Buyer_Seller"` / `"Seller_Support"` | **`"BUYER_SELLER"` / `"SELLER_SUPPORT"` / `"UNSPECIFIED"`** | ВЫСОКАЯ |
| `user.type` | 5 типов (Go SDK) | **6 типов** (+`"NotificationUser"`) | СРЕДНЯЯ |
| `direction` | `"Forward"` / `"Backward"` | **Case-sensitive!** (`"backward"` → 400) | ВЫСОКАЯ |
| `message_id` тип | string в доках | **number** в реальности | СРЕДНЯЯ |
| `first_unread_message_id` | string в доках | **number** в реальности | СРЕДНЯЯ |
| `review/list` limit | не указан min | **min=20, max=100** | НИЗКАЯ |
| `review/info` review_id | не указан тип | **string** (не number!) | НИЗКАЯ |
| `source` в SKU | "fbo" / "fbs" | **"sds"** (вместо "fbo"!), "fbs" | СРЕДНЯЯ |

### Premium Plus — точная карта ограничений

| Метод | PREMIUM | PREMIUM PLUS |
|-------|---------|--------------|
| `/v3/chat/list` | **Работает** (видит все типы) | Работает |
| `/v3/chat/history` (BUYER_SELLER) | **403** | Работает |
| `/v3/chat/history` (UNSPECIFIED/SELLER_SUPPORT) | **Работает** | Работает |
| `/v1/chat/send/message` | Не тестировали (write) | Скорее всего Premium Plus |
| `/v1/review/list` | **403** | Работает |
| `/v1/review/comment/create` | Не тестировали (write) | Скорее всего Premium Plus |
| `/v3/product/*` | **Работает** | Работает |
| `/v1/rating/*` | **Работает** | Работает |
| `/v1/seller/info` | **Работает** | Работает |

> **ВЫВОД:** R5 при онбординге может проверить `seller/info → subscription.type`:
> - `"PREMIUM"` → товары + рейтинги работают, чаты/отзывы ограничены
> - `"PREMIUM_PLUS"` / `"PREMIUM_PRO"` → всё работает

### Реальные данные — Products (20 товаров)

```json
{
  "id": 379595885,
  "name": "Сумка женская через плечо черная кросс- боди шоппер экокожа",
  "offer_id": "2201черная",
  "description_category_id": 17027904,
  "type_id": 970575517,
  "price": "4500.00",
  "old_price": "6438.00",
  "sources": [
    { "sku": 737482673, "source": "sds" },
    { "sku": 737482675, "source": "fbs" }
  ],
  "stocks": { "has_stock": true, "stocks": [{ "present": 222, "sku": 737482673, "source": "fbo" }] },
  "images": ["https://cdn1.ozone.ru/..."],
  "commissions": [
    { "sale_schema": "FBO", "percent": 43 },
    { "sale_schema": "FBS", "percent": 47 }
  ]
}
```

> **Зацепки для R5:**
> - `sources[].sku` — SKU для привязки к `context.sku` в чатах
> - `source: "sds"` = FBO (складское), `source: "fbs"` = FBS (свой склад)
> - Один товар может иметь **несколько SKU** (FBO и FBS — разные!)
> - `description_category_id` + `type_id` → категория + 48 атрибутов (4 обязательных)
> - `commissions` — комиссии по схемам продаж

### Реальные данные — Rating History

```json
{
  "premium_scores": [],
  "ratings": [{
    "rating": "rating_review_avg_score_total",
    "danger_threshold": 0,
    "premium_threshold": 4.5,
    "warning_threshold": 3,
    "values": [
      { "date_from": "2026-01-13T00:00:00Z", "value": 4.8932896, "status": { "danger": false, "premium": true, "warning": false } }
    ]
  }]
}
```

> **Зацепки:** threshold-ы чётко определены (danger=0, warning=3, premium=4.5 для оценки товаров).
> Дневные значения с boolean-статусами — идеально для дашборда.

### Реальные данные — Category Attributes (для сумок)

**4 обязательных атрибута:**
| ID | Название | Тип | dictionary_id |
|----|----------|-----|---------------|
| 9163 | Пол | String | 320 |
| 9048 | Название модели | String | 0 (свободный текст) |
| 8229 | Тип | String | 1960 |
| 85 | Бренд | String | 28732849 |

> Всего 48 атрибутов для категории `17027904/970575517` (сумки). Можно обогащать AI-контекст.

### Что осталось (нужен Premium Plus)

- [ ] `/v3/chat/history` для BUYER_SELLER — увидеть реальные сообщения покупателей с `context.sku`
- [ ] `/v1/review/list` — структура отзыва, поля для AI-ответа
- [ ] `/v1/chat/send/message` — отправка (write-операция)
- [ ] `/v1/review/comment/create` — ответ на отзыв (write-операция)

---

## Лог изменений

| Дата | Что добавлено |
|------|--------------|
| 2026-02-12 | Первичная структура: авторизация, идентификаторы, rate limits, товары |
| 2026-02-12 | Chat API: 6 методов, сравнение с WB, архитектурные отличия |
| 2026-02-12 | Детали /v3/chat/list и /v2/chat/history — полные request/response, маппинг полей, Premium Plus ограничение |
| 2026-02-12 | Рейтинг продавца, оборачиваемость товаров, система асинхронных отчётов |
| 2026-02-12 | Детали rating/summary и rating/history: Premium Plus проверка, 3 чат-KPI метрики, 14 рейтингов |
| 2026-02-12 | Review API: 7 методов, комментарии вместо ответов, workflow PROCESSED/UNPROCESSED, маппинг полей |
| 2026-02-12 | **КЛЮЧЕВОЕ:** v3/chat/history (context.sku!), send/message, chat/start, chat/read, временные окна 48/72ч, лимит 1000 символов |
| 2026-02-12 | Seller info: `/v1/seller/info` — название магазина + подписка (альтернативная Premium проверка). Категории/атрибуты: дерево, словари, структурированный контекст для AI |
| 2026-02-12 | **Roles API:** `/v1/roles` — валидация API-ключа при онбординге, проактивная проверка доступа к методам |
| 2026-02-12 | **Уточнение seller/info:** полная структура ответа — `company` + `ratings[]` + `subscription` (3-в-1: имя + рейтинги + подписка одним запросом) |
| 2026-02-12 | **send/file:** base64 JSON формат, `data[]` — обычно 1 элемент с markdown-ссылками |
| 2026-02-12 | **ДЖЕКПОТ из Go SDK:** все enum-ы найдены! `chat_status`: All/Opened/Closed. `chat_type`: Buyer_Seller/Seller_Support. `user.type`: customer/seller/crm/courier/support. Webhooks для чатов — НЕТ (только polling). **Остался 1 вопрос** |
| 2026-02-12 | **API-ТЕСТЫ (раунд 1-3):** 7/9 эндпоинтов работают на PREMIUM. Reviews=403. Расхождения: UPPERCASE enum-ы, 6-й user.type, direction case-sensitive |
| 2026-02-12 | **ФИНАЛЬНЫЕ ТЕСТЫ (раунд 4):** Полная пагинация: 237 чатов — **BUYER_SELLER (78), SELLER_SUPPORT (136), UNSPECIFIED (23)**. chat/history для BUYER_SELLER=403 на PREMIUM! 20 товаров с полными данными. Rating history с threshold-ами. 9372 категорий. 48 атрибутов для сумок. Точная карта Premium Plus ограничений. Документация ПОЛНАЯ на уровне PREMIUM-доступа. |
