# SPRINT-001: OZON Integration — Foundation

**Период:** 2026-02-12 — TBD
**Статус:** Code Complete (pending deploy)
**Фаза:** 1 (БД + Архитектура + Онбординг + Товары)

---

## Цель спринта

Заложить фундамент мультиплощадочности в R5: добавить поддержку OZON на уровне БД, API-клиента, онбординга магазинов и синхронизации товаров. Не затрагивать чаты, отзывы и AI — это Фазы 2-3.

---

## Контекст и предпосылки

### Что было сделано до спринта

**Исследование OZON Seller API (2026-02-12):**
- Полная документация: [OZON-SELLER-API.md](../product-specs/OZON/OZON-SELLER-API.md) (~900+ строк)
- 15 API-эндпоинтов задокументировано с request/response примерами
- 15 реальных API-запросов на аккаунте MariKollection (Client-Id: 645186)
- 11 успешных, 2 ожидаемых 403 (Premium Plus), 2 ошибки формата (задокументированы)
- Найдены критические расхождения с официальной документацией OZON

### Тестовый аккаунт

| Параметр | Значение |
|----------|----------|
| Магазин | MariKollection |
| Client-Id | 645186 |
| Подписка | PREMIUM (не Plus) |
| Товаров | 20 |
| Чатов | 237 (78 BUYER_SELLER, 136 SELLER_SUPPORT, 23 UNSPECIFIED) |
| Юрлицо | ИП Карян Арам Рафаелович |

### Ключевые технические факты

**Авторизация:**
- 2 заголовка: `Client-Id` (число) + `Api-Key` (UUID)
- vs WB: 4 отдельных токена
- Rate limit: 50 req/sec (vs WB ~5-10 req/min)

**Идентификаторы товаров:**
- Тройная система: `product_id` (internal) / `offer_id` (артикул продавца) / `sku` (по схеме FBO/FBS)
- Один товар = несколько SKU (разные для FBO и FBS!)
- `source: "sds"` = FBO, `source: "fbs"` = FBS

**Enum-ы (ВСЕ UPPERCASE в реальном API!):**
- `chat_type`: `BUYER_SELLER`, `SELLER_SUPPORT`, `UNSPECIFIED`
- `chat_status`: `OPENED`, `CLOSED`
- `user.type`: `customer`, `seller`, `NotificationUser`, `crm`, `courier`, `support`
- `subscription.type`: `PREMIUM`, `PREMIUM_PLUS`, `PREMIUM_PRO`

**Premium Plus ограничения:**
| Функция | PREMIUM | PREMIUM PLUS |
|---------|---------|--------------|
| Товары | Работает | Работает |
| Рейтинги | Работает | Работает |
| Chat list | Работает | Работает |
| Chat history (BUYER_SELLER) | **403** | Работает |
| Reviews | **403** | Работает |
| Send message | Не проверено | Скорее всего да |

---

## Scope спринта

### Входит в спринт (Фаза 1)

1. **Миграция БД** — мультиплощадочность
2. **OZON API клиент** — абстрактный + конкретная реализация
3. **Онбординг OZON-магазина** — UI + API
4. **Синхронизация товаров OZON** — cron + БД
5. **Обновление документации** — database-schema, ARCHITECTURE, CRON_JOBS

### НЕ входит в спринт

- Чаты OZON (Фаза 2 — нужен Premium Plus)
- Отзывы OZON (Фаза 3 — нужен Premium Plus)
- AI-генерация для OZON (Фазы 2-3)
- Рефакторинг существующего WB кода (только расширение)
- UI дашборд OZON (кроме онбординга)

---

## Задачи

### TASK-1: Миграция БД — мультиплощадочность

**Цель:** Подготовить схему БД для хранения данных нескольких маркетплейсов.

**Изменения:**

```sql
-- stores: добавить маркетплейс и OZON-креды
ALTER TABLE stores ADD COLUMN marketplace TEXT NOT NULL DEFAULT 'wb';  -- 'wb' | 'ozon'
ALTER TABLE stores ADD COLUMN ozon_client_id TEXT;
ALTER TABLE stores ADD COLUMN ozon_api_key TEXT;

-- products: добавить маркетплейс-специфичные поля
ALTER TABLE products ADD COLUMN marketplace TEXT NOT NULL DEFAULT 'wb';
ALTER TABLE products ADD COLUMN ozon_product_id BIGINT;      -- OZON product_id
ALTER TABLE products ADD COLUMN ozon_offer_id TEXT;           -- артикул продавца
ALTER TABLE products ADD COLUMN ozon_sku TEXT;                -- основной SKU (FBO)
ALTER TABLE products ADD COLUMN ozon_fbs_sku TEXT;            -- FBS SKU (если есть)

-- Индексы
CREATE INDEX idx_stores_marketplace ON stores(marketplace);
CREATE INDEX idx_products_marketplace ON products(marketplace);
CREATE INDEX idx_products_ozon_product_id ON products(ozon_product_id);
```

**Ограничения:**
- Существующие WB-данные НЕ трогаем
- DEFAULT 'wb' обеспечивает обратную совместимость
- Миграция должна быть идемпотентной

**Зависимости:** Нет
**Приоритет:** P0 (блокирует все остальные задачи)

---

### TASK-2: OZON API клиент

**Цель:** Создать модуль для работы с OZON Seller API.

**Файлы:**
- `src/lib/ozon-api.ts` — OZON HTTP клиент
- `src/lib/marketplace-client.ts` — абстрактный интерфейс (опционально)

**Методы клиента:**

| Метод | OZON endpoint | Назначение |
|-------|--------------|------------|
| `getSellerInfo()` | `POST /v1/seller/info` | Инфо о магазине |
| `getRoles()` | `POST /v1/roles` | Валидация ключа |
| `getProducts(limit, lastId)` | `POST /v3/product/list` | Список товаров |
| `getProductInfo(productIds)` | `POST /v3/product/info/list` | Детали товаров (batch) |
| `getProductDescription(productId)` | `POST /v1/product/info/description` | Описание |
| `getRatingSummary()` | `POST /v1/rating/summary` | Рейтинг |
| `getRatingHistory(from, to, ratings)` | `POST /v1/rating/history` | История рейтинга |

**Технические решения:**
- Base URL: `https://api-seller.ozon.ru`
- Headers: `Client-Id` + `Api-Key` + `Content-Type: application/json`
- Все запросы POST с JSON body
- Rate limit: не нужен (50 req/sec), но добавить конфигурируемую задержку
- Retry: 1 повтор при 5xx, не ретраить 4xx
- Логирование: каждый запрос + статус

**Важные нюансы из тестов:**
- `direction` в chat/history: **case-sensitive** (`"Backward"`, не `"backward"`)
- `review/list` limit: min=20, max=100
- `review/info` review_id: **string** (не number)
- `message_id`, `first_unread_message_id`: **number** в реальности (не string)

**Зависимости:** Нет
**Приоритет:** P0

---

### TASK-3: Онбординг OZON-магазина

**Цель:** Дать возможность добавить OZON-магазин в R5 через UI.

**Сценарий:**
1. Пользователь вводит `Client-Id` + `Api-Key`
2. R5 вызывает `POST /v1/roles` → проверяет валидность ключа
3. R5 вызывает `POST /v1/seller/info` → получает:
   - `company.name` — название магазина
   - `subscription.type` — тип подписки
   - `ratings[]` — текущие рейтинги
4. R5 показывает:
   - "Магазин: MariKollection"
   - "Подписка: PREMIUM" (+ warning если не Plus)
   - "Доступ к чатам: ❌ (требуется Premium Plus)" или "✅"
5. Пользователь подтверждает → создаётся запись в `stores`

**API:**
- `POST /api/stores/ozon/validate` — шаги 2-3, возвращает preview
- `POST /api/stores/ozon/create` — шаг 5, создаёт store

**UI:**
- Страница `/stores/add-ozon` или модальное окно
- Форма: Client-Id (число) + Api-Key (UUID)
- Preview карточка: имя, подписка, рейтинг
- Кнопка "Добавить магазин"

**Зависимости:** TASK-1 (БД), TASK-2 (API клиент)
**Приоритет:** P1

---

### TASK-4: Синхронизация товаров OZON

**Цель:** Регулярно загружать товары OZON-магазинов в таблицу `products`.

**Логика:**
1. Cron job: каждые 6 часов (или по запросу)
2. Для каждого OZON-магазина (`stores WHERE marketplace = 'ozon' AND status = 'active'`):
   - `POST /v3/product/list` — получить все product_id (пагинация по last_id)
   - `POST /v3/product/info/list` — получить детали (batch до 20)
   - `POST /v1/product/info/description` — описания
3. Upsert в `products`:
   - `wb_product_id` → использовать `ozon_product_id::TEXT` или отдельное поле
   - Маппинг: name, description, price, images, SKUs
4. Обработка нескольких SKU (FBO + FBS)

**Маппинг OZON → products:**

| OZON поле | products поле | Примечание |
|-----------|--------------|------------|
| `id` | `ozon_product_id` | Новое поле |
| `offer_id` | `ozon_offer_id` | Артикул продавца |
| `sources[0].sku` | `ozon_sku` | Основной SKU |
| `name` | `name` | Название |
| `description` | `description` | HTML-описание |
| `price` | `price` | Цена |
| `images[0]` | `image_url` | Главное фото |
| `description_category_id` | — | Для AI-контекста (позже) |

**Зависимости:** TASK-1 (БД), TASK-2 (API клиент)
**Приоритет:** P1

---

### TASK-5: Документация

**Цель:** Обновить все docs в соответствии с изменениями.

**Файлы для обновления:**
- `docs/database-schema.md` — новые поля stores, products
- `docs/reference/ARCHITECTURE.md` — мультиплощадочность
- `docs/CRON_JOBS.md` — новый cron синка товаров OZON
- `docs/DEPLOYMENT.md` — новые env-переменные (если будут)

**Зависимости:** TASK-1..4 (параллельно с разработкой)
**Приоритет:** P2

---

## Порядок выполнения

```
TASK-1 (БД миграция)
  ↓
TASK-2 (API клиент)  ←  параллельно с TASK-1
  ↓
TASK-3 (Онбординг)   ←  после TASK-1 + TASK-2
  ↓
TASK-4 (Синк товаров) ← после TASK-1 + TASK-2
  ↓
TASK-5 (Документация)  ← параллельно со всеми
```

**Критический путь:** TASK-1 → TASK-2 → TASK-3

---

## Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| WB-специфичный код сломается | Средняя | DEFAULT 'wb' + тесты перед деплоем |
| OZON API изменит формат | Низкая | Версионирование (v3), документация расхождений |
| Нет Premium Plus для полного теста | Факт | Фаза 1 не требует Plus. Чаты/отзывы — Фаза 2-3 |
| Множественные SKU на один товар | Средняя | Хранить основной SKU + FBS SKU отдельно |
| Нагрузка на БД от новых данных | Низкая | 20 товаров у тестового магазина, индексы |

---

## Критерии завершения спринта

- [x] Миграция БД выполнена, WB-данные не затронуты (`migrations/012_ozon_marketplace_support.sql`)
- [x] OZON API клиент работает (7 методов) (`src/lib/ozon-api.ts`)
- [x] Можно добавить OZON-магазин через UI (`AddOzonStoreModal` + `/api/stores/ozon/*`)
- [x] Товары OZON синхронизируются в БД (`src/lib/ozon-product-sync.ts`)
- [x] Документация обновлена (`database-schema.md`, `CRON_JOBS.md`)
- [ ] Существующий WB-функционал не сломан (needs testing after deploy)

---

## Будущие спринты (roadmap)

**SPRINT-002: OZON Chats (Фаза 2)**
- Синк чатов OZON → `chats` + `chat_messages`
- Отображение OZON-чатов в Kanban
- AI-генерация ответов (лимит 1000 символов)
- Отправка сообщений
- **Требует:** Premium Plus аккаунт

**SPRINT-003: OZON Reviews (Фаза 3)**
- Синк отзывов OZON → `reviews`
- AI-ответы на отзывы (комментарии, не прямые ответы)
- Workflow PROCESSED/UNPROCESSED
- **Требует:** Premium Plus аккаунт

**SPRINT-004: Unified Dashboard**
- Единый дашборд WB + OZON
- Рейтинги обоих площадок
- Общая аналитика
