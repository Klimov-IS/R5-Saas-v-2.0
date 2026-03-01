# TASK-20260215: База знаний результатов модерации жалоб WB

## Goal

Создать систему сбора и хранения результатов модерации жалоб WB для формирования базы знаний. Расширение "R5 проверка жалоб" переходит с Google Sheets на REST API → PostgreSQL. Добавляются новые поля: текст жалобы и категория.

## Current State

### Расширение (отдельный проект)
- Парсит интерфейс WB, находит одобренные жалобы
- Делает скриншот → загружает в Google Drive
- Записывает строку в Google Sheets (лист `Complaints`, таблица `1eqZCwzEnSS3uKc-NN-LK0dztcUARLO4YcbltQMPEj3A`)
- Дедупликация: Кабинет + Артикул + Дата отзыва + Имя файла
- **Не передаёт:** текст жалобы, категорию жалобы, review_id из нашей БД
- Код: `C:\Users\79025\Desktop\проекты\R5\Расширения\R5 проверка жалоб`

### Google Sheets (текущий лог)
- 499 строк, 12 колонок
- Колонки: Дата проверки | Кабинет | Артикул | ID отзыва | Рейтинг отзыва | Дата отзыва | Дата подачи жалобы | Статус | Скриншот | Имя файла | Ссылка Drive | Путь
- ID отзыва — пустой во всех строках
- Все записи со статусом "Одобрена"

### Наша БД
- `review_complaints` — lifecycle AI-генерации (draft → sent → approved). Требует `review_id` NOT NULL UNIQUE
- `reviews` — денормализованные поля `complaint_status`, `complaint_reason_id`
- Связь: `review_complaints.review_id` → `reviews.id` (1:1)

### Проблема
- Расширение идентифицирует жалобы по "имя кабинета + артикул + дата отзыва", не по нашим UUID
- Расширение может находить жалобы поданные вручную, до внедрения R5, или для кабинетов ещё не в БД
- Нет хранения текста/категории одобренных жалоб → нет аналитики "что одобряет WB"
- Данные в Google Sheets → хрупко, не queryable

## Proposed Change

### 1. Новая таблица `complaint_wb_results`

```sql
CREATE TABLE complaint_wb_results (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Идентификация (как расширение видит данные)
  store_name            TEXT NOT NULL,           -- "ООО КотоМото" (как в WB кабинете)
  article               TEXT NOT NULL,           -- WB артикул (nmId)
  review_wb_id          TEXT NULL,               -- ID отзыва на WB (если расширение передаёт)
  review_rating         INTEGER NULL,            -- Рейтинг отзыва (1-5)
  review_date           TEXT NULL,               -- Дата отзыва (строка, формат WB)

  -- Жалоба
  complaint_date        TEXT NULL,               -- Дата подачи жалобы (строка, формат WB)
  complaint_text        TEXT NULL,               -- НОВОЕ: полный текст жалобы
  complaint_category    TEXT NULL,               -- НОВОЕ: категория жалобы (название)
  reason_id             INTEGER NULL,            -- WB reason_id (11-20), если удалось распарсить
  wb_status             TEXT NOT NULL DEFAULT 'approved',  -- approved / rejected / pending

  -- Скриншот
  has_screenshot        BOOLEAN DEFAULT FALSE,
  screenshot_filename   TEXT NULL,               -- "302396211_19.08.25_16-21.png"
  drive_link            TEXT NULL,               -- Полная ссылка на Google Drive
  drive_path            TEXT NULL,               -- Путь в Drive

  -- Soft-links на нашу БД (заполняются async)
  store_id              TEXT NULL,               -- FK stores(id), если смачтили
  review_complaint_id   TEXT NULL,               -- FK review_complaints(id), если смачтили

  -- Метаданные
  checked_at            TIMESTAMPTZ NULL,        -- Когда расширение проверило
  source                TEXT DEFAULT 'extension', -- 'extension' | 'manual' | 'import'

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Дедупликация (тот же ключ что в Google Sheets)
  CONSTRAINT uq_complaint_wb_result
    UNIQUE(store_name, article, review_date, screenshot_filename)
);

-- Indexes
CREATE INDEX idx_cwb_store_name ON complaint_wb_results(store_name);
CREATE INDEX idx_cwb_article ON complaint_wb_results(article);
CREATE INDEX idx_cwb_store_id ON complaint_wb_results(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX idx_cwb_wb_status ON complaint_wb_results(wb_status);
CREATE INDEX idx_cwb_reason ON complaint_wb_results(reason_id) WHERE reason_id IS NOT NULL;
CREATE INDEX idx_cwb_category ON complaint_wb_results(complaint_category) WHERE complaint_category IS NOT NULL;
CREATE INDEX idx_cwb_created ON complaint_wb_results(created_at DESC);
CREATE INDEX idx_cwb_linked ON complaint_wb_results(review_complaint_id) WHERE review_complaint_id IS NOT NULL;
```

### 2. API эндпоинты для расширения

#### `POST /api/extension/complaints` — Записать результат модерации

```
Headers:
  X-API-Key: <extension_api_key>

Body:
{
  "store_name": "ООО КотоМото",
  "article": "302396211",
  "review_wb_id": null,
  "review_rating": 3,
  "review_date": "19 авг. 2025 г. в 16:21",
  "complaint_date": "09.10.2025",
  "complaint_text": "Данный отзыв не относится к товару...",
  "complaint_category": "Отзыв не относится к товару",
  "reason_id": 11,
  "wb_status": "approved",
  "has_screenshot": true,
  "screenshot_filename": "302396211_19.08.25_16-21.png",
  "drive_link": "https://drive.google.com/file/d/xxx/view",
  "drive_path": "ООО КотоМото/Screenshots/скриншоты: жалобы WB",
  "checked_at": "2025-11-30T12:00:00Z"
}

Response 201:
{ "id": "uuid", "action": "created" }

Response 200 (duplicate):
{ "id": "uuid", "action": "exists" }
```

#### `POST /api/extension/complaints/batch` — Пакетная запись

```
Body:
{
  "items": [ ...массив объектов как выше... ]
}

Response 200:
{ "created": 15, "duplicates": 3, "errors": 0 }
```

#### `GET /api/extension/complaints/check` — Проверка дубликата

```
Query: ?store_name=...&article=...&review_date=...&screenshot_filename=...

Response 200:
{ "exists": true, "id": "uuid" }
```

### 3. Аутентификация расширения

Расширение аутентифицируется через `X-API-Key` — тот же `NEXT_PUBLIC_API_KEY` что уже используется для других extension-эндпоинтов.

### 4. Soft-linking (async, фаза 2)

Отдельный процесс (вызывается при записи или по cron) пытается связать:
1. `store_name` → найти `stores.id` по `stores.name`
2. `article` + `store_id` → найти `products` по `wb_product_id`
3. Если есть product → найти `review_complaints` по `product_id` + `review_date` (fuzzy match)
4. Если нашли → проставить `store_id`, `review_complaint_id`, обновить `review_complaints.status = 'approved'`

### 5. Миграция исторических данных (фаза 3)

Импорт 499 строк из Google Sheets в `complaint_wb_results` с `source = 'import'`.
Без текста/категории (их не было), но со всеми остальными полями.

## Impact

### DB
- **Новая таблица:** `complaint_wb_results`
- **Новая миграция:** `013_complaint_wb_results.sql`
- Без изменений в существующих таблицах

### API
- **Новые эндпоинты:** `POST /api/extension/complaints`, `POST /api/extension/complaints/batch`, `GET /api/extension/complaints/check`
- Без изменений в существующих API

### Cron
- Без изменений на фазе 1
- Фаза 2: возможно новый cron для soft-linking

### AI
- Фаза 3 (будущее): одобренные тексты как feedback для улучшения генерации жалоб

### UI
- Фаза 1: нет изменений
- Будущее: дашборд аналитики по одобренным жалобам (approval rate по категориям, лучшие формулировки)

### Расширение (внешняя команда)
- Добавить парсинг текста жалобы и категории из интерфейса WB
- Заменить запись в Google Sheets на вызов `POST /api/extension/complaints`
- Сохранить fallback на Google Sheets (переходный период)

## Required Docs Updates

- `docs/database-schema.md` — добавить таблицу `complaint_wb_results`
- `docs/reference/api.md` — добавить extension complaints API
- `docs/reference/EXTENSION_API_DOCUMENTATION.md` — новые эндпоинты для команды расширения
- `docs/domains/complaints.md` — добавить секцию "Результаты модерации WB"

## Rollout Plan

### Фаза 1: Инфраструктура (наша сторона)
1. Миграция БД — создать таблицу `complaint_wb_results`
2. DB helpers — CRUD в `src/db/helpers.ts`
3. API эндпоинты — 3 route файла
4. Тесты — проверка dedup, валидации, batch
5. Деплой на прод

### Фаза 2: Интеграция расширения (команда расширения)
1. Парсинг текста + категории жалобы из WB
2. Замена Google Sheets API → вызов нашего REST API
3. Тестирование на 1-2 кабинетах
4. Полный переход

### Фаза 3: Обогащение данных
1. Импорт 499 исторических записей из Google Sheets
2. Soft-linking к `review_complaints`
3. Аналитический дашборд

## Backout Plan

- Фаза 1: DROP TABLE `complaint_wb_results`, удалить API routes
- Фаза 2: расширение откатывается на Google Sheets (должен оставаться fallback)
- Данные в Google Sheets не удаляются — остаются как резервная копия

## Аналитические запросы (примеры будущего использования)

### Approval rate по категориям
```sql
SELECT
  complaint_category,
  reason_id,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE wb_status = 'approved') as approved,
  ROUND(100.0 * COUNT(*) FILTER (WHERE wb_status = 'approved') / COUNT(*), 1) as rate
FROM complaint_wb_results
WHERE complaint_category IS NOT NULL
GROUP BY complaint_category, reason_id
ORDER BY rate DESC;
```

### Топ формулировок по категории
```sql
SELECT
  complaint_text,
  complaint_category,
  COUNT(*) as times_approved
FROM complaint_wb_results
WHERE wb_status = 'approved'
  AND complaint_text IS NOT NULL
GROUP BY complaint_text, complaint_category
ORDER BY times_approved DESC
LIMIT 20;
```

### Статистика по кабинетам
```sql
SELECT
  store_name,
  COUNT(*) as total,
  COUNT(DISTINCT article) as unique_articles,
  MIN(checked_at) as first_check,
  MAX(checked_at) as last_check
FROM complaint_wb_results
GROUP BY store_name
ORDER BY total DESC;
```

## Priority

**High** — формирует базу знаний для улучшения AI-генерации жалоб и аналитики эффективности.

## Estimated Effort

- Фаза 1 (наша сторона): 3-4 часа
- Фаза 2 (команда расширения): зависит от их оценки
- Фаза 3 (обогащение): 2-3 часа
