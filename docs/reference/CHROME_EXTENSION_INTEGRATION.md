# Chrome Extension Integration - WB Reviews Parser

**Статус**: В разработке
**Дата последнего обновления**: 27 января 2026
**Ответственный**: R5 Development Team

---

## Оглавление

1. [Обзор](#обзор)
2. [Текущее состояние](#текущее-состояние)
3. [Архитектура](#архитектура)
4. [Проблема с версиями интерфейса WB](#проблема-с-версиями-интерфейса-wb)
5. [Roadmap](#roadmap)
6. [Технические детали](#технические-детали)

---

## Обзор

Chrome Extension для интеграции с интерфейсом продавца Wildberries. Основная задача — парсинг отзывов со страницы WB и автоматическая подача жалоб на негативные отзывы.

### Цели проекта

- Автоматический парсинг отзывов из интерфейса WB
- Сопоставление отзывов со страницы с данными в БД
- Генерация и подача жалоб на негативные отзывы
- Интеграция с SaaS платформой R5

---

## Текущее состояние

### Что реализовано

#### 1. Content Script загрузка (MAIN world)
- ✅ Content scripts корректно загружаются в контексте MAIN
- ✅ Доступ к `window.WBPageParser` из консоли браузера
- ✅ Изоляция кода расширения от страницы

**Файлы**:
- `Extension/manifest.json` - конфигурация загрузки скриптов
- `Extension/src/content/page-parser.js` - основной парсер

#### 2. PageParser (v2 - для нового интерфейса WB)
- ✅ Парсинг отзывов с новой структуры HTML WB
- ✅ Извлечение артикула, даты, рейтинга, текста отзыва
- ✅ Генерация composite ID формата: `{article}-{YYYYMMDD}-{HHMM}-{rating}`

**Composite ID** используется потому, что WB убрал ID отзывов из HTML.

**Пример composite ID**: `147369104-20260127-1230-5`

#### 3. API Endpoint `/find-by-data`
- ✅ Endpoint для поиска отзыва в БД по composite данным
- ✅ Матчинг по артикулу, дате, рейтингу и тексту
- ✅ Возвращает полные данные отзыва, включая DB ID

**API Route**:
```
POST /api/extension/stores/{storeId}/reviews/find-by-data
```

**Request Body**:
```json
{
  "article": "147369104",
  "date": "2026-01-27T12:30:00.000Z",
  "rating": 5,
  "text": "Отличный товар!"
}
```

**Response**:
```json
{
  "data": {
    "id": "abc123def456",
    "wb_feedback_id": "147369104-20260127-1230-5",
    "article": "147369104",
    "product_valuation": 5,
    "created_at": "2026-01-27T12:30:00.000Z",
    "text": "Отличный товар!",
    "answer": null,
    "complaint_status": null
  }
}
```

#### 4. Тестовый магазин
- ✅ Создан магазин "IP Adamyan" (ID: `ihMDtYWEY7IXkR3Lm9Pq`)
- ✅ Синхронизировано 15 товаров
- ✅ Синхронизировано 1226 отзывов
- ✅ Статус: active

### Что НЕ реализовано

- ❌ Поддержка старой версии интерфейса WB
- ❌ Автоматическая генерация жалоб через UI расширения
- ❌ Подача жалоб через расширение
- ❌ End-to-end тестирование полного workflow

---

## Архитектура

### Компоненты системы

```
┌─────────────────────────────────────────────────────────────┐
│                    WB Seller Interface                      │
│                  (Страница отзывов продавца)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ DOM Parsing
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               Chrome Extension (Content Script)             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           window.WBPageParser                        │  │
│  │                                                       │  │
│  │  parseReviews() → Array<{                           │  │
│  │    article, date, rating, text, compositeId         │  │
│  │  }>                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ API Request
                           │ POST /api/extension/stores/{storeId}/reviews/find-by-data
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    R5 SaaS Backend                          │
│                   (Next.js API Routes)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/extension/stores/[storeId]/                   │  │
│  │    reviews/find-by-data                             │  │
│  │                                                       │  │
│  │  1. Match by article + date + rating                │  │
│  │  2. Fuzzy text matching (optional)                  │  │
│  │  3. Return DB review with complaint status          │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ PostgreSQL Query
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   PostgreSQL Database                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  reviews table                                       │  │
│  │  - id (primary key)                                  │  │
│  │  - wb_feedback_id (composite ID)                    │  │
│  │  - article                                           │  │
│  │  - product_valuation (rating)                       │  │
│  │  - created_at (date)                                │  │
│  │  - text                                              │  │
│  │  - complaint_status                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Workflow

1. **Пользователь открывает страницу отзывов в WB**
2. **Extension парсит DOM** → извлекает данные отзывов
3. **Extension отправляет запрос в API** → `/find-by-data` с данными отзыва
4. **Backend ищет отзыв в БД** → по composite данным
5. **Backend возвращает данные** → включая статус жалобы
6. **Extension отображает UI** → с кнопками для подачи жалоб (будущее)

---

## Проблема с версиями интерфейса WB

### Ситуация

**27 января 2026**: Wildberries откатил интерфейс продавца на **старую версию**.

- Текущий парсер (PageParser v2) работал с новым интерфейсом
- После отката парсер перестал работать
- Неизвестно, будет ли WB снова менять интерфейс

### Требование

Парсер должен **поддерживать обе версии интерфейса**:
- Старую версию (до обновления WB)
- Новую версию (которая была активна до отката)

### Решение (план)

Создать **универсальный парсер** с автоматическим определением версии:

```javascript
window.WBPageParser = {
  // Определяет версию интерфейса
  detectInterfaceVersion() {
    // Проверяет наличие специфичных селекторов
    if (document.querySelector('.new-interface-class')) {
      return 'v2';
    } else if (document.querySelector('.old-interface-class')) {
      return 'v1';
    }
    return 'unknown';
  },

  // Парсит отзывы в зависимости от версии
  parseReviews() {
    const version = this.detectInterfaceVersion();

    if (version === 'v2') {
      return this.parseReviewsV2();
    } else if (version === 'v1') {
      return this.parseReviewsV1();
    } else {
      throw new Error('Unknown WB interface version');
    }
  },

  parseReviewsV1() {
    // Логика парсинга для старой версии
  },

  parseReviewsV2() {
    // Логика парсинга для новой версии (текущая)
  }
};
```

---

## Roadmap

### Phase 1: Dual-version Parser Support (COMPLETED ✅)

**Дата начала**: 28 января 2026
**Дата завершения**: 28 января 2026
**Статус**: ✅ Реализовано, готово к тестированию

#### Задачи:

1. ✅ **Получить HTML старой версии интерфейса**
   - ✅ Пользователь предоставил HTML файлы (Extension/WB/Docs/HTML)

2. ✅ **Анализ различий между версиями**
   - ✅ Сравнены селекторы DOM
   - ✅ Определены ключевые различия:
     - v1 имеет реальный ID отзыва в кнопке `ID: E4xcMRRPzkCrUck0Hgic`
     - v2 не имеет ID, используется composite ID
     - v1 имеет отдельные элементы для даты и времени
     - v2 имеет объединенный формат даты
     - v1 использует SVG fill="#FF773C" для рейтинга
     - v2 использует классы "Rating--active"

3. ✅ **Реализовать функции для обеих версий**
   - ✅ `detectInterfaceVersion(row)` - автоопределение версии
   - ✅ `extractReviewId_V1(row)` - извлечение реального ID
   - ✅ `extractReviewId_V2(row)` - генерация composite ID
   - ✅ `extractReviewId(row)` - универсальная маршрутизация
   - ✅ `extractReviewDate(row)` - поддержка обеих версий
   - ✅ `extractRating(row)` - поддержка обеих версий

4. ✅ **Документация**
   - ✅ Создан [DUAL_VERSION_PARSER_TESTING.md](../Extension/WB/Docs/DUAL_VERSION_PARSER_TESTING.md)
   - ✅ Подробные инструкции по тестированию

5. ⏳ **Тестирование** (следующий этап)
   - Тесты на странице WB с текущей версией интерфейса
   - Проверка корректности извлечения всех данных
   - Проверка работы `/find-by-data` endpoint

### Phase 2: End-to-End Testing

**Статус**: Ожидает завершения Phase 1

#### Задачи:

1. ⏳ **Тестирование парсинга**
   - Открыть страницу отзывов магазина "IP Adamyan"
   - Выполнить `window.WBPageParser.parseReviews()`
   - Проверить корректность данных

2. ⏳ **Тестирование `/find-by-data`**
   - Взять данные из первого отзыва
   - Отправить запрос в API
   - Проверить, что отзыв найден в БД

3. ⏳ **Тестирование генерации жалоб**
   - Для негативного отзыва (rating 1-2)
   - Проверить автоматическую генерацию текста жалобы

### Phase 3: Auto-Complaint Generation UI

**Статус**: Планируется после Phase 2

#### Задачи:

1. ⏳ **UI для подачи жалоб**
   - Кнопка "Подать жалобу" для каждого отзыва
   - Модальное окно с текстом жалобы
   - Кнопка "Отправить" для submit

2. ⏳ **API для генерации жалоб**
   - Endpoint для генерации текста жалобы
   - Интеграция с AI (DeepSeek)

3. ⏳ **API для подачи жалоб**
   - Endpoint для отправки жалобы в WB
   - Обновление статуса в БД

---

## Технические детали

### Файловая структура Extension

```
Extension/
├── manifest.json              # Конфигурация расширения
├── src/
│   ├── content/
│   │   ├── page-parser.js    # Парсер отзывов (MAIN world)
│   │   └── content-script.js # Content script (ISOLATED world)
│   ├── background/
│   │   └── service-worker.js # Background service worker
│   └── popup/
│       ├── popup.html         # UI popup (будущее)
│       └── popup.js
└── README.md
```

### API Endpoints

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/extension/stores` | GET | Получить список магазинов пользователя |
| `/api/extension/stores/{storeId}/reviews/find-by-data` | POST | Найти отзыв по composite данным |
| `/api/extension/stores/{storeId}/reviews/{reviewId}/complaint/generate` | POST | Генерировать текст жалобы (будущее) |
| `/api/extension/stores/{storeId}/reviews/{reviewId}/complaint/submit` | POST | Подать жалобу в WB (будущее) |

### Database Schema

#### `reviews` table

```sql
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  wb_feedback_id TEXT,           -- Composite ID: {article}-{YYYYMMDD}-{HHMM}-{rating}
  article TEXT,
  product_valuation INTEGER,     -- Rating 1-5
  created_at TIMESTAMPTZ,
  text TEXT,
  answer TEXT,
  was_viewed BOOLEAN DEFAULT false,
  is_able_supplier_feedback_valuation BOOLEAN DEFAULT false,
  supplier_feedback_valuation INTEGER,
  state TEXT,                    -- 'pending', 'answered', etc.
  complaint_status TEXT,         -- null, 'pending', 'sent', 'approved', 'rejected'
  complaint_text TEXT,
  complaint_sent_at TIMESTAMPTZ,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE INDEX idx_reviews_composite ON reviews(article, created_at, product_valuation);
```

### Composite ID Format

**Формат**: `{article}-{YYYYMMDD}-{HHMM}-{rating}`

**Пример**: `147369104-20260127-1230-5`

- **article**: Артикул товара WB (например, `147369104`)
- **YYYYMMDD**: Дата отзыва в формате год-месяц-день
- **HHMM**: Время отзыва в формате часы-минуты
- **rating**: Рейтинг от 1 до 5

**Почему composite ID?**
- WB убрал ID отзывов из HTML интерфейса
- Нужен способ уникально идентифицировать отзыв
- Комбинация артикула + даты + времени + рейтинга даёт уникальность

---

## История изменений

### 2026-01-27
- ✅ Создан магазин "IP Adamyan" для тестирования
- ✅ Синхронизировано 15 товаров и 1226 отзывов
- ✅ Обновлено имя магазина с кириллицы на латиницу (проблема кодировки)
- ⚠️ **WB откатил интерфейс на старую версию** — парсер перестал работать
- 📋 Запланирована поддержка двух версий интерфейса

### 2026-01-26
- ✅ Реализован endpoint `/find-by-data`
- ✅ Обновлен PageParser для нового интерфейса WB
- ✅ Реализована генерация composite ID

### 2026-01-25
- ✅ Исправлена загрузка content scripts в MAIN world
- ✅ Создан базовый PageParser

---

## Контакты и поддержка

**Документация проекта**: `docs/`
**GitHub Issues**: (если есть)
**Telegram**: (если есть)

---

**Следующий шаг**: Получить HTML старой версии интерфейса WB и обновить парсер для поддержки обеих версий.
