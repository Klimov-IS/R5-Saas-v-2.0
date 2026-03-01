# Product Spec — Таб "Кабинет"

> **Sprint:** 003
> **Версия:** 1.1 (revised — billing/reporting deferred)
> **Дата:** 2026-02-25

---

## Проблема

Менеджер R5 работает с 65+ клиентами. Для каждого клиента информация разбросана:
- Статистика — в табах Товары/Отзывы/Чаты (нужно кликать в каждый)
- Контакты клиента — в голове / в Telegram / в заметках
- Ссылки на Google Drive — в закладках браузера
- Правила работы — в product_rules (нужно открыть товары)
- Стоимость услуг — в отдельной таблице Google Sheets
- Отчёты — формируются вручную

**Результат:** 15+ минут на подготовку к звонку с клиентом, потеря информации, ошибки в расчётах.

---

## Решение

Единый таб **"Кабинет"** — первый в навигации. Открывая магазин, менеджер сразу видит полный профиль клиента.

---

## Информационная архитектура

### Уровень 1 — Идентификация (всегда вверху)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Аватар]  Бьюти Маркет                    [● Активен]          │
│            WB · Подключен 15 сен 2025       Синхр: ✓ ✓ ✓        │
└──────────────────────────────────────────────────────────────────┘
```

**Данные из:** `stores.name`, `stores.marketplace`, `stores.status`, `stores.created_at`, `stores.last_*_update_*`

### Уровень 2 — Ключевые метрики (KPI-строка)

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ 📦 1 245  │  │ ⭐ 2 890  │  │ 💬 4 312  │  │ 📋 1 847  │
│ Товаров  │  │ Отз 1-3★ │  │ Чатов    │  │ Жалоб    │
│ 347 раб  │  │ из 18450 │  │ 156 акт  │  │ 94% одоб │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

**Данные из (Phase 1 — всё существует):**
- Товары: `COUNT(products)`, `COUNT(product_rules WHERE work_in_chats OR submit_complaints)`
- Отзывы: `COUNT(reviews WHERE rating <= 3)`, `stores.total_reviews`
- Чаты: `stores.total_chats`, `stores.chat_tag_counts`
- Жалобы: `COUNT(review_complaints WHERE status = 'sent')`, `COUNT(WHERE status = 'approved')` / total

### Уровень 3 — Жалобы и удаления + Статус чатов

**Левая колонка: Жалобы и удаления**

| Метрика | Источник (Phase 1) |
|---|---|
| Подано жалоб | `COUNT(review_complaints WHERE status IN ('sent','approved','rejected','pending'))` |
| Одобрено | `COUNT(review_complaints WHERE status = 'approved')` |
| Отклонено | `COUNT(review_complaints WHERE status = 'rejected')` |
| % одобрения | approved / (approved + rejected) * 100 |
| Удалено с WB | `COUNT(reviews WHERE deleted_from_wb_at IS NOT NULL)` |

**Правая колонка: Статус работы в чатах**

| Поле | Источник |
|---|---|
| Чаты согласованы | **Phase 2** — новое поле `stores.chats_agreed` |
| Работаем в чатах | **Phase 2** — новое поле `stores.chats_work_status` |
| Статус паузы | **Phase 2** — новое поле `stores.chats_paused` |
| Опция в WB | **Phase 2** — новое поле `stores.wb_chat_option` |
| Авто-цепочки | `COUNT(chat_auto_sequences WHERE status = 'active')` |
| Стратегия | Агрегация из `product_rules.chat_strategy` |

### Уровень 4 — Правила работы + Рейтинг

**Левая: Правила работы с отзывами (Phase 1)**

Агрегация из `product_rules`:
- На какие рейтинги подаём жалобы (`complaint_rating_1-4`)
- На какие рейтинги работаем в чатах (`chat_rating_1-4`)
- Стратегия чатов (`chat_strategy`)
- Компенсация (`offer_compensation`, `compensation_type`, `max_compensation`)
- Авто-закрытие (из `user_settings.no_reply_trigger_phrase`)

**Правая: Распределение отзывов (Phase 1)**

```sql
SELECT rating, COUNT(*)
FROM reviews WHERE store_id = $1
GROUP BY rating ORDER BY rating DESC
```

### Уровень 5 — Google Drive + Реквизиты + Стоимость

**Google Drive (Phase 2)**
- Новая таблица `store_links`
- CRUD: добавить/удалить/редактировать ссылку
- Типы: google_sheets, google_docs, google_drive, custom_url

**Реквизиты (Phase 2)**
- Новые поля в `stores`: company_name, inn, ogrn, contact_name, contact_email, contact_phone
- Поле `r5_manager` — кто ведёт клиента в R5

**Стоимость услуг (Phase 3)**
- Новая таблица `store_billing`
- Цена за удалённый отзыв
- Расчёт: удалено * цена = сумма
- Оплаты, задолженность

### Уровень 6 — AI конфигурация + Заметки

**AI (Phase 1)**
- `stores.ai_instructions` — длина + краткая выжимка
- `COUNT(store_faq WHERE is_active)` — активных FAQ
- `COUNT(store_guides WHERE is_active)` — активных гайдов
- AI расходы: `SUM(ai_logs.cost WHERE store_id AND month)`

**Заметки (Phase 2)**
- Новое поле `stores.internal_notes` TEXT
- Свободная текстовая область для менеджера

### Уровень 7 — Telegram + Лента событий

**Telegram (Phase 1)**
- Из `telegram_users`: подключён ли, уведомления вкл/выкл
- `telegram_notifications_log`: последнее уведомление
- Чатов в TG очереди: из `review_chat_links` COUNT

**Лента событий (Phase 4)**
- Новая таблица `store_activity_log`
- Последние 10 событий: синхронизации, жалобы, удаления, чаты

---

## API Design

### Phase 1 — GET /api/stores/[storeId]/cabinet

Единый endpoint, возвращает всё для отрисовки кабинета.

```typescript
interface CabinetData {
  // Store identity
  store: {
    id: string;
    name: string;
    marketplace: 'wb' | 'ozon';
    status: StoreStatus;
    created_at: string;
    syncs: {
      products: { status: string; date: string; };
      reviews: { status: string; date: string; };
      chats: { status: string; date: string; };
    };
  };

  // KPI metrics
  metrics: {
    products: { total: number; active: number; };
    reviews: { total: number; negative: number; }; // negative = 1-3★
    chats: { total: number; active: number; tagCounts: Record<string, number>; };
    complaints: { filed: number; approved: number; rejected: number; pending: number; };
    deletions: { total: number; }; // deleted_from_wb_at IS NOT NULL
  };

  // Rating breakdown
  ratingBreakdown: Record<1|2|3|4|5, number>;

  // Product rules aggregation
  rules: {
    complaintRatings: number[];     // [1,2,3] — какие рейтинги
    chatRatings: number[];          // [1,2,3,4]
    chatStrategy: string;           // most common strategy
    compensation: { enabled: boolean; type: string; maxAmount: number; };
    autoSequences: { active: number; total: number; };
  };

  // AI config
  ai: {
    hasInstructions: boolean;
    instructionsLength: number;
    instructionsPreview: string;     // first 100 chars
    faqCount: number;
    guidesCount: number;
    monthCost: number;              // USD
  };

  // Telegram
  telegram: {
    connected: boolean;
    notificationsEnabled: boolean;
    lastNotification: string | null;
    queueCount: number;
  };
}
```

### Phase 2 — CRUD endpoints

```
GET    /api/stores/[storeId]/links        — список ссылок
POST   /api/stores/[storeId]/links        — добавить ссылку
PUT    /api/stores/[storeId]/links/[id]   — редактировать
DELETE /api/stores/[storeId]/links/[id]   — удалить

GET    /api/stores/[storeId]/details      — реквизиты + контакты
PUT    /api/stores/[storeId]/details      — обновить реквизиты

GET    /api/stores/[storeId]/notes        — заметки
PUT    /api/stores/[storeId]/notes        — обновить заметки

GET    /api/stores/[storeId]/chat-config  — статус работы чатов
PUT    /api/stores/[storeId]/chat-config  — обновить статус
```

### Phase 3 — Billing endpoints

```
GET    /api/stores/[storeId]/billing              — тариф + текущий период
PUT    /api/stores/[storeId]/billing/settings     — настройки тарифа
GET    /api/stores/[storeId]/billing/invoices      — список счетов
POST   /api/stores/[storeId]/billing/invoices      — создать счёт
GET    /api/stores/[storeId]/billing/payments      — список оплат
POST   /api/stores/[storeId]/billing/payments      — записать оплату
```

### Phase 4 — Reporting endpoints

```
GET    /api/stores/[storeId]/reports              — список отчётов
POST   /api/stores/[storeId]/reports/generate     — сгенерировать отчёт
GET    /api/stores/[storeId]/activity             — лента событий (last N)
```

---

## Новые таблицы (полная схема)

### Phase 2: Migration 018 — CRM fields

```sql
-- Новые поля в stores
ALTER TABLE stores ADD COLUMN company_name TEXT;
ALTER TABLE stores ADD COLUMN inn TEXT;
ALTER TABLE stores ADD COLUMN ogrn TEXT;
ALTER TABLE stores ADD COLUMN contact_name TEXT;
ALTER TABLE stores ADD COLUMN contact_email TEXT;
ALTER TABLE stores ADD COLUMN contact_phone TEXT;
ALTER TABLE stores ADD COLUMN r5_manager TEXT;
ALTER TABLE stores ADD COLUMN internal_notes TEXT;
ALTER TABLE stores ADD COLUMN chats_agreed BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN chats_work_status TEXT DEFAULT 'not_started'; -- not_started, active, paused, stopped
ALTER TABLE stores ADD COLUMN wb_chat_option TEXT DEFAULT 'unknown'; -- enabled, disabled, unknown

-- Ссылки клиента
CREATE TABLE store_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'custom', -- google_sheets, google_docs, google_drive, document, custom
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_store_links_store ON store_links(store_id);
```

### Phase 3: Migration 019 — Billing (ОТЛОЖЕНО — отдельное планирование)

> **Статус:** Черновик. Будет пересмотрено после реализации учёта удалений.
> Биллинг зависит от системы учёта удалений (R5-жалобы + чат-удаления).
> Банк: Точка. API интеграция — при планировании.

```sql
-- Биллинг магазина
CREATE TABLE store_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT UNIQUE NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  price_per_deletion NUMERIC(10,2) DEFAULT 0,       -- руб за удалённый отзыв
  billing_currency TEXT DEFAULT 'RUB',
  billing_period TEXT DEFAULT 'monthly',             -- monthly, weekly, per_event
  billing_email TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Счета
CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id),

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  deletions_count INTEGER DEFAULT 0,
  price_per_deletion NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,

  status TEXT DEFAULT 'draft',  -- draft, sent, paid, overdue, cancelled
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  due_date DATE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_invoices_store ON billing_invoices(store_id);

-- Оплаты
CREATE TABLE billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id),
  invoice_id UUID REFERENCES billing_invoices(id),

  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,           -- bank_transfer, card, cash
  reference_number TEXT,         -- номер платёжки

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_payments_store ON billing_payments(store_id);
```

### Phase 4: Migration 020 — Reporting (ОТЛОЖЕНО — отдельное планирование)

> **Статус:** Черновик. Зависит от системы учёта удалений.
> Учёт удалений из чатов требует исследования триггерных сообщений.
> Интеграция отчётов с TG Mini App и Google Sheets — при планировании.

```sql
-- Отчёты
CREATE TABLE store_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id),

  report_type TEXT DEFAULT 'weekly',  -- weekly, monthly, custom
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  data JSONB NOT NULL,               -- snapshot метрик на момент генерации

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_store_reports_store ON store_reports(store_id);
CREATE INDEX idx_store_reports_period ON store_reports(store_id, period_start);

-- Лента активности
CREATE TABLE store_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id),

  event_type TEXT NOT NULL,          -- sync_completed, complaint_filed, complaint_approved,
                                     -- review_deleted, chat_completed, chat_upgraded,
                                     -- sequence_started, sequence_completed, settings_changed
  event_data JSONB,                  -- детали события

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_store ON store_activity_log(store_id, created_at DESC);
```

---

## UI Layout (прототип)

См. файл `prototype-cabinet-tab.html` в этой папке.

Ключевые решения по UI:
1. Таб "Кабинет" — первый в навигации (перед Товарами)
2. Иконка: портфель (💼)
3. Все секции — карточки (`.section-card`) в 2-3 колонки
4. KPI — 4 карточки в ряд (как на главной странице)
5. Editable поля — inline edit с иконкой карандаша
6. Ссылки Google Drive — кликабельные карточки с типами

---

## Маппинг прототипа → фазы

| Секция прототипа | Фаза | Источник данных |
|---|---|---|
| Карточка магазина | Phase 1 | `stores.*` |
| KPI строка | Phase 1 | `stores.*`, SQL aggregation |
| Жалобы и удаления | Phase 1 | `review_complaints`, `reviews` |
| Распределение отзывов | Phase 1 | `reviews` GROUP BY rating |
| Правила работы | Phase 1 | `product_rules` aggregation |
| AI конфигурация | Phase 1 | `stores`, `store_faq`, `store_guides`, `ai_logs` |
| Telegram | Phase 1 | `telegram_users`, `telegram_notifications_log` |
| Статус работы чатов | Phase 2 | Новые поля `stores.chats_*` |
| Файлы Google Drive | Phase 2 | Новая таблица `store_links` |
| Реквизиты компании | Phase 2 | Новые поля `stores.company_*` |
| Заметки | Phase 2 | Новое поле `stores.internal_notes` |
| Стоимость услуг | Phase 3 | Новые таблицы `store_billing`, `billing_*` |
| Лента событий | Phase 4 | Новая таблица `store_activity_log` |
