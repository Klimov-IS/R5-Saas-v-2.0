# План интеграции системы проверки жалоб

## Обзор

Данный документ описывает план интеграции Chrome Extension "R5 проверка жалоб" (v2.3.2) с R5 SaaS платформой.

### Текущая бизнес-модель
- Компания зарабатывает на подаче жалоб на негативные отзывы Wildberries
- За каждую одобренную жалобу компания получает **600 рублей**
- Расширение автоматизирует проверку одобренных жалоб и сохраняет данные в Google Sheets
- Это критически важный компонент монетизации бизнеса

---

## 1. Текущая архитектура расширения

### 1.1 Основные компоненты

**Manifest V3 Extension:**
- `manifest.json` - конфигурация расширения
- `content.js` - основная логика автоматизации проверки жалоб на странице WB
- `background.js` - service worker для работы с Google Drive/Sheets API
- `google-sheets-api.js` - обертка для работы с Google Sheets API
- `deduplication-cache.js` - кэш для предотвращения дублирования скриншотов

### 1.2 Текущий поток данных

```
1. Extension читает из Google Sheets:
   - Clients (список кабинетов/клиентов)
   - Артикулы (список артикулов для проверки по каждому клиенту)

2. Пользователь выбирает кабинет и диапазон дат в popup

3. Content script:
   - Открывает страницу жалоб WB для каждого артикула
   - Ищет одобренные жалобы в заданном диапазоне дат
   - Делает скриншот с overlay (показывает данные жалобы)
   - Отправляет данные в background.js

4. Background.js:
   - Сохраняет скриншот в Google Drive (в папки по кабинету/артикулу)
   - Записывает данные в Google Sheets:
     * Complaints - индивидуальные записи жалоб
     * Stats_Daily - агрегированная статистика (UPSERT)
     * Report_Log - логи сессий проверки

5. Деду пликация:
   - Проверка существования файла в Drive по имени
   - Кэширование в chrome.storage.local
```

### 1.3 Структура данных в Google Sheets

**Clients (Клиенты):**
| Колонка | Описание |
|---------|----------|
| A: ClientID | Уникальный ID клиента |
| B: ClientName | Название кабинета |
| C: Status | активен/неактивен |
| D: DriveFolderID | ID папки в Google Drive |
| E: ScreenshotsFolderID | ID папки для скриншотов |
| F: ReportSheetID | ID таблицы для отчетов |
| G: CreatedAt | Дата создания |
| H: UpdatedAt | Дата обновления |

**Артикулы:**
| Колонка | Описание |
|---------|----------|
| A: Клиент | Название клиента (связь с Clients) |
| B: Артикул WB | Номер артикула WB |
| C: Статус | активен/неактивен |

**Complaints (Жалобы - основная монетизация!):**
| Колонка | Описание | Значение для бизнеса |
|---------|----------|----------------------|
| A: Дата проверки | Когда была найдена одобренная жалоба | Tracking |
| B: Кабинет | Название кабинета | Группировка |
| C: Артикул | Артикул WB | Группировка |
| D: ID отзыва | ID отзыва WB | Идентификация |
| E: Рейтинг отзыва | 1-5 звезд | Аналитика |
| F: Дата отзыва | Когда был оставлен отзыв | Tracking |
| G: Дата подачи жалобы | Когда была подана жалоба | Tracking |
| H: Статус | "Одобрена" | **600₽ = ВЫРУЧКА!** |
| I: Скриншот | Да/Нет | Подтверждение |
| J: Имя файла | Имя PNG файла | Reference |
| K: Ссылка Drive | URL на Google Drive | Access |
| L: Путь | Путь в структуре папок | Organization |

**Stats_Daily (Ежедневная статистика):**
| Колонка | Описание |
|---------|----------|
| A: ClientName | Название клиента |
| B: Article | Артикул |
| C: ComplaintDate | Дата подачи жалобы |
| D: TotalComplaints | Всего жалоб за дату |
| E: ApprovedComplaints | Одобрено жалоб (600₽ × count) |
| F: LastCheck | Дата последней проверки |
| G: CheckCount | Счетчик проверок (инкрементируется при UPSERT) |

**Report_Log (Логи сессий):**
- Когда запускалась проверка
- Сколько жалоб найдено
- Длительность сессии
- Ошибки

---

## 2. Предлагаемая архитектура интеграции

### 2.1 Фазы внедрения

#### **Фаза 1: Dual-Write (2-3 недели)**
Расширение пишет данные **И** в Google Sheets **И** в PostgreSQL через API

**Преимущества:**
- Нулевой риск потери данных
- Постепенная валидация новой системы
- Возможность отката в любой момент
- Сохранение работы текущих отчетов в Sheets

**Реализация:**
1. Создать API endpoints в SaaS
2. Модифицировать background.js расширения для dual-write
3. Сохранить все существующие операции с Sheets как fallback

#### **Фаза 2: Миграция исторических данных (1 неделя)**
Перенос существующих данных из Google Sheets в PostgreSQL

**Действия:**
1. Написать скрипт миграции
2. Мигрировать Complaints (каждая запись = 600₽!)
3. Мигрировать Stats_Daily
4. Мигрировать Report_Log
5. Валидация: сверка количества записей и сумм

#### **Фаза 3: DB Primary (1-2 недели)**
PostgreSQL становится основным источником данных

**Действия:**
1. Переключить расширение на чтение из API (вместо Sheets)
2. Sheets остается как backup/archive
3. Создать дашборды в SaaS для аналитики жалоб

#### **Фаза 4: Оптимизация (ongoing)**
- Улучшение UI/UX дашбордов
- Автоматические отчеты
- Интеграция с системой оплаты (600₽ × approved complaints)
- Прогнозирование выручки

---

## 3. Схема базы данных PostgreSQL

### 3.1 Новые таблицы

#### **clients (Кабинеты/Клиенты)**
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,

  -- Google Integration (опционально, для обратной совместимости)
  drive_folder_id VARCHAR(255),
  screenshots_folder_id VARCHAR(255),
  report_sheet_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_store_id ON clients(store_id);
CREATE INDEX idx_clients_owner_id ON clients(owner_id);
CREATE INDEX idx_clients_status ON clients(status);
```

#### **client_articles (Артикулы клиентов)**
```sql
CREATE TABLE client_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article VARCHAR(50) NOT NULL, -- WB артикул
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- Связь с products

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(client_id, article)
);

CREATE INDEX idx_client_articles_client_id ON client_articles(client_id);
CREATE INDEX idx_client_articles_status ON client_articles(status);
CREATE INDEX idx_client_articles_product_id ON client_articles(product_id);
```

#### **complaints (Жалобы - ОСНОВНАЯ МОНЕТИЗАЦИЯ!)**
```sql
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Связи
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article VARCHAR(50) NOT NULL,
  review_id VARCHAR(255), -- WB Review ID (если известен)
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,

  -- Данные жалобы
  check_date DATE NOT NULL, -- Дата проверки (когда нашли одобренную жалобу)
  complaint_submit_date DATE NOT NULL, -- Дата подачи жалобы
  review_date DATE, -- Дата отзыва
  review_rating INT CHECK (review_rating >= 1 AND review_rating <= 5),

  -- Статус (критически важно!)
  status VARCHAR(50) NOT NULL DEFAULT 'approved', -- 'approved' | 'rejected' | 'pending'

  -- Выручка (автоматически вычисляется)
  revenue_amount DECIMAL(10, 2) DEFAULT 600.00, -- 600 рублей за одобренную
  is_paid BOOLEAN DEFAULT FALSE, -- Оплачено ли клиенту/менеджеру
  payment_date TIMESTAMP,

  -- Скриншот
  screenshot_filename VARCHAR(255),
  screenshot_drive_url TEXT,
  screenshot_drive_path TEXT,

  -- Метаданные
  found_by_extension BOOLEAN DEFAULT TRUE, -- Найдено расширением (vs ручной ввод)
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Уникальность: один complaint на комбинацию (client + article + complaint_date + review_date)
  UNIQUE(client_id, article, complaint_submit_date, review_date)
);

CREATE INDEX idx_complaints_client_id ON complaints(client_id);
CREATE INDEX idx_complaints_store_id ON complaints(store_id);
CREATE INDEX idx_complaints_owner_id ON complaints(owner_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_check_date ON complaints(check_date);
CREATE INDEX idx_complaints_is_paid ON complaints(is_paid);
CREATE INDEX idx_complaints_article ON complaints(article);
```

#### **complaints_stats_daily (Ежедневная статистика - агрегация)**
```sql
CREATE TABLE complaints_stats_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article VARCHAR(50) NOT NULL,
  complaint_date DATE NOT NULL, -- Дата подачи жалобы

  -- Статистика
  total_complaints INT NOT NULL DEFAULT 0,
  approved_complaints INT NOT NULL DEFAULT 0,
  rejected_complaints INT NOT NULL DEFAULT 0,
  pending_complaints INT NOT NULL DEFAULT 0,

  -- Выручка (вычисляемое поле)
  revenue_total DECIMAL(10, 2) DEFAULT 0.00, -- approved_complaints × 600₽

  -- Метаданные проверок
  last_check_at TIMESTAMP NOT NULL,
  check_count INT NOT NULL DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Уникальность: одна запись на (client + article + date)
  UNIQUE(client_id, article, complaint_date)
);

CREATE INDEX idx_stats_client_id ON complaints_stats_daily(client_id);
CREATE INDEX idx_stats_complaint_date ON complaints_stats_daily(complaint_date);
CREATE INDEX idx_stats_article ON complaints_stats_daily(article);
```

#### **complaints_report_log (Логи сессий проверки)**
```sql
CREATE TABLE complaints_report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,

  -- Параметры проверки
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  articles_checked INT NOT NULL DEFAULT 0,

  -- Результаты
  total_complaints_found INT NOT NULL DEFAULT 0,
  approved_found INT NOT NULL DEFAULT 0,
  screenshots_saved INT NOT NULL DEFAULT 0,
  screenshots_skipped INT NOT NULL DEFAULT 0, -- Дубликаты

  -- Выручка за сессию
  session_revenue DECIMAL(10, 2) DEFAULT 0.00,

  -- Метаданные
  duration_seconds INT, -- Длительность проверки
  errors TEXT[], -- Массив ошибок (если были)

  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_log_client_id ON complaints_report_log(client_id);
CREATE INDEX idx_report_log_owner_id ON complaints_report_log(owner_id);
CREATE INDEX idx_report_log_started_at ON complaints_report_log(started_at);
```

---

## 4. API Endpoints

### 4.1 Clients Management

#### **GET /api/complaints/clients**
Получить список клиентов (замена чтения из Google Sheets "Clients")

**Query params:**
- `status` - 'all' | 'active' | 'inactive'

**Response:**
```json
{
  "clients": [
    {
      "id": "uuid",
      "clientName": "Кабинет 1",
      "status": "active",
      "storeId": "uuid",
      "driveFolderId": "...",
      "screenshotsFolderId": "...",
      "reportSheetId": "...",
      "articlesCount": 50,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### **GET /api/complaints/clients/:clientId/articles**
Получить артикулы для клиента (замена чтения из "Артикулы")

**Response:**
```json
{
  "articles": [
    {
      "id": "uuid",
      "article": "12345678",
      "status": "active",
      "productId": "uuid",
      "productName": "Товар 1"
    }
  ]
}
```

#### **POST /api/complaints/clients**
Создать нового клиента

**Body:**
```json
{
  "clientName": "Новый кабинет",
  "storeId": "uuid",
  "status": "active",
  "driveFolderId": "optional",
  "screenshotsFolderId": "optional",
  "reportSheetId": "optional"
}
```

#### **POST /api/complaints/clients/:clientId/articles**
Добавить артикул к клиенту

**Body:**
```json
{
  "article": "12345678",
  "status": "active"
}
```

### 4.2 Complaints Recording (Ключевое для расширения!)

#### **POST /api/complaints/record**
Записать одобренную жалобу (вызывается из расширения)

**Headers:**
- `X-Extension-Key`: `<extension_api_key>` (для аутентификации)

**Body:**
```json
{
  "clientId": "uuid",
  "clientName": "Кабинет 1",
  "article": "12345678",
  "checkDate": "2025-01-26",
  "complaintSubmitDate": "2025-01-20",
  "reviewDate": "2025-01-15",
  "reviewRating": 2,
  "reviewId": "wb_review_id",
  "status": "approved",
  "screenshot": {
    "filename": "12345678_20-01-2025.png",
    "driveUrl": "https://drive.google.com/...",
    "drivePath": "/Кабинет 1/Скриншоты/12345678/"
  }
}
```

**Response:**
```json
{
  "success": true,
  "complaint": {
    "id": "uuid",
    "revenue": 600.00,
    "isDuplicate": false
  },
  "message": "Жалоба записана. Выручка: 600₽"
}
```

**Логика:**
1. Проверить уникальность (client + article + date)
2. Если дубликат - вернуть `isDuplicate: true`, не создавать новую запись
3. Если уникальная - создать запись в `complaints`
4. Обновить `complaints_stats_daily` (UPSERT)
5. Dual-write: также записать в Google Sheets (Фаза 1)

#### **POST /api/complaints/bulk-record**
Массовая запись жалоб (для миграции или batch операций)

**Body:**
```json
{
  "complaints": [
    { /* complaint object */ },
    { /* complaint object */ }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "inserted": 45,
  "skipped": 5,
  "totalRevenue": 27000.00
}
```

### 4.3 Stats & Analytics

#### **GET /api/complaints/stats/daily**
Получить дневную статистику

**Query params:**
- `clientId` - UUID клиента
- `startDate` - начало периода
- `endDate` - конец периода
- `article` - фильтр по артикулу (опционально)

**Response:**
```json
{
  "stats": [
    {
      "date": "2025-01-26",
      "article": "12345678",
      "totalComplaints": 10,
      "approvedComplaints": 8,
      "rejectedComplaints": 2,
      "revenue": 4800.00,
      "lastCheckAt": "2025-01-26T10:00:00Z",
      "checkCount": 3
    }
  ],
  "summary": {
    "totalRevenue": 27000.00,
    "totalApproved": 45,
    "averageApprovalRate": 0.85
  }
}
```

#### **GET /api/complaints/stats/revenue**
Статистика выручки

**Query params:**
- `clientId`
- `period` - 'day' | 'week' | 'month' | 'year'
- `startDate`
- `endDate`

**Response:**
```json
{
  "revenue": {
    "total": 180000.00,
    "paid": 120000.00,
    "unpaid": 60000.00,
    "approvedCount": 300,
    "averagePerDay": 6000.00
  },
  "breakdown": [
    {
      "date": "2025-01-26",
      "revenue": 4800.00,
      "approvedCount": 8
    }
  ]
}
```

#### **GET /api/complaints/report-logs**
История сессий проверки

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "clientName": "Кабинет 1",
      "startDate": "2025-01-20",
      "endDate": "2025-01-26",
      "articlesChecked": 50,
      "totalComplaintsFound": 15,
      "approvedFound": 12,
      "sessionRevenue": 7200.00,
      "durationSeconds": 1800,
      "startedAt": "2025-01-26T09:00:00Z",
      "completedAt": "2025-01-26T09:30:00Z"
    }
  ]
}
```

### 4.4 Session Management (для расширения)

#### **POST /api/complaints/sessions/start**
Начать сессию проверки (логирование)

**Body:**
```json
{
  "clientId": "uuid",
  "startDate": "2025-01-20",
  "endDate": "2025-01-26",
  "articlesCount": 50
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "startedAt": "2025-01-26T09:00:00Z"
}
```

#### **PATCH /api/complaints/sessions/:sessionId/complete**
Завершить сессию

**Body:**
```json
{
  "totalComplaintsFound": 15,
  "approvedFound": 12,
  "screenshotsSaved": 10,
  "screenshotsSkipped": 2,
  "errors": [],
  "durationSeconds": 1800
}
```

---

## 5. Модификации Chrome Extension

### 5.1 Конфигурация

Добавить в `manifest.json`:
```json
{
  "host_permissions": [
    "*://*.wildberries.ru/*",
    "https://www.googleapis.com/*",
    "https://your-saas-domain.com/*"
  ]
}
```

Новый файл `config.js`:
```javascript
const CONFIG = {
  API_BASE_URL: 'https://your-saas-domain.com/api',
  EXTENSION_API_KEY: 'your-extension-api-key',
  ENABLE_DUAL_WRITE: true, // Фаза 1: писать и в Sheets и в API
  ENABLE_SHEETS_FALLBACK: true, // Если API недоступен, писать только в Sheets
};
```

### 5.2 Новый модуль `saas-api.js`

```javascript
/**
 * SaaS API integration for R5 Extension
 */
class SaaSAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': this.apiKey,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[SaaS API] ${method} ${endpoint} failed:`, error);
      throw error;
    }
  }

  // Get clients
  async getClients(status = 'active') {
    return this.request(`/complaints/clients?status=${status}`);
  }

  // Get articles for client
  async getClientArticles(clientId) {
    return this.request(`/complaints/clients/${clientId}/articles`);
  }

  // Record approved complaint
  async recordComplaint(complaintData) {
    return this.request('/complaints/record', 'POST', complaintData);
  }

  // Start session
  async startSession(sessionData) {
    return this.request('/complaints/sessions/start', 'POST', sessionData);
  }

  // Complete session
  async completeSession(sessionId, results) {
    return this.request(`/complaints/sessions/${sessionId}/complete', 'PATCH', results);
  }
}

// Export for use in background.js
window.SaaSAPI = SaaSAPI;
```

### 5.3 Модификации `background.js`

```javascript
// Initialize SaaS API
const saasAPI = new SaaSAPI(CONFIG.API_BASE_URL, CONFIG.EXTENSION_API_KEY);

// Session tracking
let currentSessionId = null;

// Handle session start
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "startSession") {
    try {
      const result = await saasAPI.startSession({
        clientId: msg.clientId,
        startDate: msg.startDate,
        endDate: msg.endDate,
        articlesCount: msg.articlesCount,
      });
      currentSessionId = result.sessionId;
      console.log('[SaaS API] Session started:', currentSessionId);
      sendResponse({ success: true, sessionId: currentSessionId });
    } catch (error) {
      console.error('[SaaS API] Failed to start session:', error);
      if (CONFIG.ENABLE_SHEETS_FALLBACK) {
        // Fallback: continue without session tracking
        sendResponse({ success: true, sessionId: null, fallback: true });
      } else {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  }

  if (msg.action === "saveScreenshot") {
    return handleSaveScreenshotDualWrite(msg, sender, sendResponse);
  }

  // ... other handlers
});

// DUAL-WRITE: Save to both Sheets AND SaaS API
async function handleSaveScreenshotDualWrite(msg) {
  const {
    imageData, articul, feedbackDate, feedbackRating,
    complaintSubmitDate, cabinetFolderId, reportSheetId,
    clientId, clientName
  } = msg;

  let apiSuccess = false;
  let sheetsSuccess = false;
  let isDuplicate = false;

  // 1. Try SaaS API first (Phase 1)
  if (CONFIG.ENABLE_DUAL_WRITE) {
    try {
      const result = await saasAPI.recordComplaint({
        clientId: clientId,
        clientName: clientName,
        article: articul,
        checkDate: new Date().toISOString().split('T')[0],
        complaintSubmitDate: complaintSubmitDate,
        reviewDate: feedbackDate,
        reviewRating: feedbackRating,
        status: 'approved',
        screenshot: {
          filename: `${articul}_${formattedDate}.png`,
          driveUrl: null, // Will be set after Drive upload
          drivePath: null,
        },
      });

      apiSuccess = true;
      isDuplicate = result.complaint.isDuplicate;
      console.log('[SaaS API] Complaint recorded:', result);
    } catch (error) {
      console.error('[SaaS API] Failed to record complaint:', error);
      if (!CONFIG.ENABLE_SHEETS_FALLBACK) {
        throw error; // Fail fast if fallback disabled
      }
    }
  }

  // 2. Save to Google Drive + Sheets (existing logic)
  try {
    const result = await handleSaveScreenshotToSheets(msg);
    sheetsSuccess = true;
  } catch (error) {
    console.error('[Google Sheets] Failed to save:', error);
    if (!apiSuccess) {
      throw error; // Both failed - critical error
    }
  }

  // 3. If saved to Drive, update API with Drive URLs
  if (apiSuccess && driveFileId) {
    try {
      await saasAPI.request(`/complaints/${complaintId}/screenshot`, 'PATCH', {
        driveUrl: `https://drive.google.com/file/d/${driveFileId}/view`,
        drivePath: drivePath,
      });
    } catch (error) {
      console.error('[SaaS API] Failed to update screenshot URLs:', error);
    }
  }

  return {
    success: apiSuccess || sheetsSuccess,
    apiSuccess,
    sheetsSuccess,
    isDuplicate,
    skipped: isDuplicate,
  };
}

// Handle session completion
async function completeCurrentSession(stats) {
  if (!currentSessionId) return;

  try {
    await saasAPI.completeSession(currentSessionId, {
      totalComplaintsFound: stats.totalComplaintsFound,
      approvedFound: stats.approvedFound,
      screenshotsSaved: stats.screenshotsSaved,
      screenshotsSkipped: stats.screenshotsSkipped,
      errors: stats.errors || [],
      durationSeconds: stats.durationSeconds,
    });
    console.log('[SaaS API] Session completed:', currentSessionId);
  } catch (error) {
    console.error('[SaaS API] Failed to complete session:', error);
  }

  currentSessionId = null;
}
```

### 5.4 Модификации `content.js`

Добавить в начало сессии:
```javascript
// Start session tracking
chrome.runtime.sendMessage({
  action: "startSession",
  clientId: state.cabinetId,
  startDate: state.startDate,
  endDate: state.endDate,
  articlesCount: state.articuls.length,
}, (response) => {
  if (response.success) {
    console.log('[Session] Started:', response.sessionId);
  }
});
```

Добавить в конец сессии:
```javascript
// Complete session
chrome.runtime.sendMessage({
  action: "completeSession",
  sessionId: currentSessionId,
  stats: {
    totalComplaintsFound: state.totalComplaintsFound,
    approvedFound: state.stats.totalApproved,
    screenshotsSaved: state.screenshotsSaved,
    screenshotsSkipped: state.screenshotsSkipped,
    durationSeconds: Math.floor((Date.now() - sessionStartTime) / 1000),
  },
});
```

---

## 6. Дашборды в SaaS (Новый раздел UI)

### 6.1 Complaints Dashboard (`/complaints`)

**Компоненты:**
- Revenue Overview Card (выручка за период)
- Approved vs Rejected Chart
- Recent Complaints Table
- Payment Status (оплачено/не оплачено)

**Метрики:**
```typescript
{
  totalRevenue: 180000.00, // Всего выручки
  paidRevenue: 120000.00,  // Оплачено
  unpaidRevenue: 60000.00, // Ожидает оплаты
  approvedCount: 300,      // Одобрено жалоб
  rejectedCount: 45,       // Отклонено
  pendingCount: 12,        // Ожидание решения
  averagePerDay: 6000.00,  // Средняя выручка в день
  approvalRate: 0.87,      // 87% approval rate
}
```

### 6.2 Clients Management (`/complaints/clients`)

Управление кабинетами и артикулами:
- Список клиентов (кабинетов)
- Добавление/редактирование клиентов
- Управление артикулами по клиенту
- Связь с products (WB артикулы)

### 6.3 Complaints Report Logs (`/complaints/logs`)

История сессий проверки:
- Когда проверялись жалобы
- Сколько найдено
- Выручка за сессию
- Длительность
- Ошибки

### 6.4 Revenue Dashboard (`/revenue`)

**Прогнозирование и аналитика:**
- Прогноз выручки на месяц
- Тренды одобрений/отклонений
- Топ артикулов по выручке
- Топ клиентов по выручке
- Оплата менеджерам (процент от выручки)

---

## 7. Безопасность

### 7.1 Аутентификация расширения

**Extension API Key:**
- Уникальный API ключ для расширения
- Хранится в `user_settings.extension_api_key`
- Передается в хедере `X-Extension-Key`

**Создание ключа:**
```sql
ALTER TABLE user_settings ADD COLUMN extension_api_key VARCHAR(255);
```

API endpoint для генерации:
```typescript
POST /api/settings/extension/generate-key

Response:
{
  "apiKey": "ext_1234567890abcdef",
  "createdAt": "2025-01-26T10:00:00Z"
}
```

### 7.2 Валидация данных

**На уровне API:**
- Проверка формата дат
- Проверка рейтинга (1-5)
- Проверка существования client_id
- Санитизация строк (XSS prevention)

**На уровне БД:**
- Constraints на поля
- Unique constraints для предотвращения дубликатов
- Foreign keys для целостности данных

### 7.3 Rate Limiting

Ограничение запросов от расширения:
- Max 100 complaints per minute
- Max 10 sessions per hour
- Max 1000 complaints per day per client

---

## 8. Миграция данных (Фаза 2)

### 8.1 Скрипт миграции `scripts/migrate-complaints-from-sheets.ts`

```typescript
/**
 * Migrate complaints data from Google Sheets to PostgreSQL
 */

import { google } from 'googleapis';
import { query } from '@/db/client';

async function migrateComplaints() {
  const sheets = google.sheets('v4');
  const auth = await getGoogleAuth();

  // 1. Migrate Clients
  const clientsData = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: MASTER_SHEET_ID,
    range: 'Clients!A:H',
  });

  for (const row of clientsData.data.values.slice(1)) {
    const [clientId, clientName, status, driveFolderId, screenshotsFolderId, reportSheetId] = row;

    await query(`
      INSERT INTO clients (client_name, status, drive_folder_id, screenshots_folder_id, report_sheet_id, owner_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (client_name) DO NOTHING
    `, [clientName, status, driveFolderId, screenshotsFolderId, reportSheetId, DEFAULT_OWNER_ID]);
  }

  // 2. Migrate Complaints (CRITICAL - каждая запись = 600₽!)
  for (const client of clients) {
    const complaintsData = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: client.reportSheetId,
      range: 'Complaints!A:L',
    });

    let migratedCount = 0;
    let totalRevenue = 0;

    for (const row of complaintsData.data.values.slice(1)) {
      const [checkDate, cabinet, article, reviewId, rating, reviewDate, complaintDate, status, screenshot, filename, driveUrl, drivePath] = row;

      if (status === 'Одобрена') {
        await query(`
          INSERT INTO complaints (
            client_id, article, check_date, complaint_submit_date, review_date,
            review_rating, status, screenshot_filename, screenshot_drive_url,
            screenshot_drive_path, revenue_amount, owner_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, $8, $9, 600.00, $10, NOW())
          ON CONFLICT (client_id, article, complaint_submit_date, review_date) DO NOTHING
        `, [clientDbId, article, parseDate(checkDate), parseDate(complaintDate), parseDate(reviewDate), rating, filename, driveUrl, drivePath, DEFAULT_OWNER_ID]);

        migratedCount++;
        totalRevenue += 600;
      }
    }

    console.log(`✅ Migrated ${migratedCount} complaints for ${client.name}. Total revenue: ${totalRevenue}₽`);
  }

  // 3. Migrate Stats_Daily
  // ... similar logic

  console.log('✅ Migration completed!');
}
```

Запуск:
```bash
npm run migrate:complaints
```

### 8.2 Валидация миграции

После миграции запустить проверку:
```sql
-- Проверка количества одобренных жалоб
SELECT
  c.client_name,
  COUNT(*) as approved_count,
  SUM(revenue_amount) as total_revenue
FROM complaints co
JOIN clients c ON c.id = co.client_id
WHERE co.status = 'approved'
GROUP BY c.client_name
ORDER BY total_revenue DESC;

-- Сравнить с Google Sheets вручную
```

---

## 9. Мониторинг и алерты

### 9.1 Метрики для отслеживания

1. **Расширение:**
   - Успешность записи в API (success rate)
   - Fallback на Sheets (сколько раз срабатывал)
   - Дубликаты (skipped count)
   - Ошибки API

2. **API:**
   - Response time для POST /api/complaints/record
   - Rate of API key authentication failures
   - Количество записанных жалоб в день
   - Выручка в день

3. **База данных:**
   - Рост таблицы complaints (rows per day)
   - Query performance на статистику
   - Индексы (slow queries)

### 9.2 Алерты

**Critical:**
- API недоступен более 5 минут
- 0 записей жалоб за день (если обычно > 10)
- Fallback на Sheets сработал более 10 раз подряд

**Warning:**
- Response time > 2s для /api/complaints/record
- Дубликатов больше 50% от всех попыток записи
- Approval rate упал ниже 70%

---

## 10. Тестирование

### 10.1 Unit Tests

```typescript
// tests/api/complaints.test.ts

describe('POST /api/complaints/record', () => {
  it('should record approved complaint', async () => {
    const response = await request(app)
      .post('/api/complaints/record')
      .set('X-Extension-Key', TEST_API_KEY)
      .send({
        clientId: testClientId,
        article: '12345678',
        complaintSubmitDate: '2025-01-20',
        reviewDate: '2025-01-15',
        reviewRating: 2,
        status: 'approved',
      });

    expect(response.status).toBe(200);
    expect(response.body.complaint.revenue).toBe(600.00);
  });

  it('should detect duplicate complaint', async () => {
    // Insert first time
    await recordComplaint(testData);

    // Try to insert again
    const response = await request(app)
      .post('/api/complaints/record')
      .set('X-Extension-Key', TEST_API_KEY)
      .send(testData);

    expect(response.body.complaint.isDuplicate).toBe(true);
  });
});
```

### 10.2 Integration Tests

1. **Расширение → API:**
   - Запустить расширение в test mode
   - Проверить dual-write (и Sheets и API)
   - Проверить fallback при недоступности API

2. **Миграция:**
   - Мигрировать тестовый набор из Google Sheets
   - Сверить количество записей
   - Сверить суммы выручки

3. **End-to-End:**
   - Расширение находит одобренную жалобу
   - Записывается в БД
   - Отображается в дашборде SaaS
   - Выручка корректно вычисляется

---

## 11. Rollout Plan (Поэтапное внедрение)

### Week 1-2: Preparation (Фаза 0)
- [ ] Создать ветку `feature/complaints-integration`
- [ ] Создать миграции БД
- [ ] Написать API endpoints
- [ ] Написать unit tests
- [ ] Code review

### Week 3: Phase 1 - Dual Write
- [ ] Deploy API to production
- [ ] Обновить расширение (dual-write logic)
- [ ] Протестировать на 1 клиенте (pilot)
- [ ] Мониторинг: сверка Sheets vs DB

### Week 4: Phase 2 - Data Migration
- [ ] Написать скрипт миграции
- [ ] Мигрировать исторические данные
- [ ] Валидация: сверка количества и сумм
- [ ] Backup Google Sheets

### Week 5: Phase 3 - DB Primary
- [ ] Расширение читает из API (не из Sheets)
- [ ] Sheets только для записи (backup)
- [ ] Создать дашборды в SaaS

### Week 6: Phase 4 - Optimization
- [ ] Revenue dashboard
- [ ] Payment tracking (оплачено/не оплачено)
- [ ] Автоматические отчеты
- [ ] Performance optimization

### Week 7+: Ongoing
- [ ] Мониторинг и алерты
- [ ] Сбор feedback от менеджеров
- [ ] Итерации по UI/UX
- [ ] Прогнозирование выручки
- [ ] Интеграция с системой оплаты

---

## 12. Риски и митигация

### Риск 1: Потеря данных при dual-write
**Митигация:**
- Логирование всех операций
- Fallback на Sheets если API падает
- Ежедневная сверка: кол-во записей в Sheets vs DB
- Backup Google Sheets перед миграцией

### Риск 2: Duplicate revenue (двойной подсчет)
**Митигация:**
- UNIQUE constraint: (client_id, article, complaint_submit_date, review_date)
- API возвращает `isDuplicate: true` если запись уже существует
- Расширение не показывает дубликаты как "новые"

### Риск 3: API недоступен
**Митигация:**
- Fallback на Google Sheets
- Rate limiting и timeout handling
- Мониторинг uptime
- Алерты при downtime > 5 минут

### Риск 4: Несоответствие выручки (600₽ может измениться)
**Митигация:**
- Поле `revenue_amount` не hardcoded - можно изменить
- История изменений в `complaints` (когда revenue был обновлен)
- Конфигурация: DEFAULT_COMPLAINT_REVENUE = 600.00

### Риск 5: Производительность при росте данных
**Митигация:**
- Индексы на ключевые поля
- Partitioning таблицы complaints по датам (если > 1M записей)
- Архивация старых записей (> 2 года)

---

## 13. Success Criteria

**Фаза 1 (Dual-Write):**
- ✅ 100% записей дублируются в Sheets и DB
- ✅ 0 критических ошибок API
- ✅ < 2s response time для POST /api/complaints/record
- ✅ 0 потерянных данных

**Фаза 2 (Migration):**
- ✅ Мигрировано 100% исторических данных
- ✅ Суммы выручки совпадают (Sheets vs DB)
- ✅ Backup Google Sheets создан

**Фаза 3 (DB Primary):**
- ✅ Расширение читает из API (не из Sheets)
- ✅ Дашборды отображают корректные данные
- ✅ Менеджеры довольны новым интерфейсом

**Фаза 4 (Optimization):**
- ✅ Revenue dashboard запущен
- ✅ Автоматические отчеты работают
- ✅ Прогнозирование выручки точное (±10%)

---

## 14. Дальнейшие улучшения (Post-MVP)

1. **Автоматическая подача жалоб:**
   - Интеграция с WB API для подачи жалоб
   - AI генерация текста жалобы
   - Автоматическое отслеживание статуса

2. **Мобильное приложение для менеджеров:**
   - Push уведомления о новых одобренных жалобах
   - Быстрый просмотр выручки за день
   - Оплата менеджерам через приложение

3. **Machine Learning:**
   - Предсказание вероятности одобрения жалобы
   - Оптимизация текста жалобы (А/B тесты)
   - Анализ причин отклонений

4. **Финансовая интеграция:**
   - Автоматическая оплата менеджерам (процент от выручки)
   - Счета для клиентов
   - Интеграция с бухгалтерией

---

## 15. Заключение

Данный план обеспечивает:
1. **Безопасную миграцию** с нулевой потерей данных (dual-write)
2. **Постепенное внедрение** по фазам с валидацией на каждом этапе
3. **Обратную совместимость** с Google Sheets на время перехода
4. **Масштабируемость** архитектуры для будущего роста
5. **Прозрачность выручки** - каждая одобренная жалоба = 600₽ tracked

**Основные преимущества интеграции:**
- Централизованное хранение данных в PostgreSQL
- Современные дашборды для аналитики
- Автоматический подсчет выручки
- История изменений и аудит
- Возможность интеграции с другими системами
- Прогнозирование и бизнес-аналитика

**Критически важно:**
Таблица `complaints` - это ОСНОВА монетизации. Каждая запись со статусом "approved" = 600₽ выручки. Поэтому дедупликация и целостность данных - наивысший приоритет.

---

**Дата создания:** 2025-01-26
**Версия:** 1.0
**Автор:** Claude (R5 SaaS Integration Team)
