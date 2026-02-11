# R5 Architecture Overview

**Версия:** 1.0
**Дата:** 2026-02-08
**Статус:** Production

---

## Обзор системы

**R5 (Reputation Management Service)** — B2B SaaS платформа для управления репутацией продавцов Wildberries.

### Ключевые возможности

1. **Сбор и синхронизация отзывов** — автоматический импорт из WB API
2. **Генерация жалоб** — AI-powered создание текстов жалоб на негативные отзывы
3. **Управление чатами** — обработка диалогов с покупателями
4. **Автоматизация** — cron jobs для синхронизации и генерации

---

## Архитектурные слои

```
┌─────────────────────────────────────────────────────────────┐
│                     Edge / CDN Layer                          │
│          Cloudflare (SSL, CDN, Proxy) │ rating5.ru           │
├─────────────────────────────────────────────────────────────┤
│                      Presentation Layer                      │
│  Next.js App Router │ React 18 │ Tailwind CSS │ React Query │
│  + Telegram Mini App (src/app/(telegram)/tg/)                │
├─────────────────────────────────────────────────────────────┤
│                        API Layer                             │
│    Next.js API Routes │ REST │ Bearer Auth │ TG initData     │
├─────────────────────────────────────────────────────────────┤
│                      Business Logic                          │
│    AI Flows │ Sync Services │ Cron Jobs │ Backfill Worker   │
├─────────────────────────────────────────────────────────────┤
│                       Data Layer                             │
│      PostgreSQL (Yandex Managed) │ pg library │ Raw SQL      │
├─────────────────────────────────────────────────────────────┤
│                   External Services                          │
│   Wildberries API │ Deepseek AI │ Chrome Extension │ TG API │
└─────────────────────────────────────────────────────────────┘
```

---

## Структура репозитория

```
R5/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # REST API endpoints
│   │   │   ├── stores/         # Store management
│   │   │   ├── cron/           # Cron control endpoints
│   │   │   ├── extension/      # Chrome Extension API
│   │   │   ├── admin/          # Admin endpoints
│   │   │   └── wb-proxy/       # WB API proxy
│   │   └── stores/[storeId]/   # Store pages (Products, Reviews, Chats, AI)
│   │
│   ├── components/             # React components
│   │   ├── reviews-v2/         # Reviews UI
│   │   ├── chats/              # Chats UI (Messenger View)
│   │   └── providers/          # Context providers
│   │
│   ├── db/                     # Database layer
│   │   ├── client.ts           # PostgreSQL connection pool
│   │   ├── helpers.ts          # Core CRUD operations
│   │   ├── complaint-helpers.ts # Complaints logic
│   │   ├── review-filters.ts   # Filtering logic
│   │   └── extension-helpers.ts # Extension-specific queries
│   │
│   ├── ai/                     # AI integration
│   │   ├── flows/              # AI workflows
│   │   │   ├── generate-review-complaint-flow.ts
│   │   │   ├── generate-chat-reply-flow.ts
│   │   │   └── classify-chat-tag-flow.ts
│   │   ├── prompts/            # Prompt templates
│   │   └── utils/              # AI utilities (templates, filters)
│   │
│   ├── lib/                    # Utilities
│   │   ├── cron-jobs.ts        # Cron job definitions
│   │   ├── init-server.ts      # Server initialization
│   │   ├── wb-api.ts           # WB API client
│   │   ├── sync-store.ts       # Sync orchestration
│   │   ├── ai-context.ts       # AI context builder (FAQ + Guides + Instructions)
│   │   ├── faq-templates.ts    # 27 pre-built FAQ templates (9 categories)
│   │   ├── guide-templates.ts  # 7 pre-built guide templates
│   │   └── auto-sequence-templates.ts  # Auto-sequence message templates
│   │
│   ├── services/               # Business services
│   │   ├── backfill-worker.ts  # Backfill queue processor
│   │   ├── auto-complaint-generator.ts  # Event-driven complaints
│   │   └── google-sheets-sync/ # Google Sheets export service
│   │
│   └── types/                  # TypeScript definitions
│
├── docs/                       # Documentation
│   ├── _rules/                 # Policies
│   ├── reference/              # Technical reference
│   ├── product/                # Product documentation
│   ├── domains/                # Domain-specific docs
│   ├── decisions/              # ADRs
│   ├── product-specs/          # Feature specifications
│   └── archive/                # Historical docs
│
├── scripts/                    # Utility scripts
├── deploy/                     # Deployment scripts
├── supabase/migrations/        # SQL migrations
└── instrumentation.ts          # Next.js server hook
```

---

## Ключевые компоненты

### 1. API Layer

**Location:** `src/app/api/`

REST API на базе Next.js App Router. Все endpoints требуют Bearer token аутентификации.

**Основные группы:**

| Путь | Назначение |
|------|------------|
| `/api/stores` | CRUD магазинов |
| `/api/stores/[storeId]/reviews` | Отзывы |
| `/api/stores/[storeId]/products` | Товары |
| `/api/stores/[storeId]/chats` | Чаты |
| `/api/stores/[storeId]/complaints` | Жалобы |
| `/api/stores/[storeId]/ai-instructions` | AI инструкции магазина |
| `/api/stores/[storeId]/faq` | FAQ база знаний магазина |
| `/api/stores/[storeId]/guides` | Инструкции для клиентов |
| `/api/stores/[storeId]/analyze-dialogues` | AI-анализ диалогов → FAQ + Guides |
| `/api/extension/*` | Chrome Extension API |
| `/api/cron/*` | Cron management |

**Подробнее:** [docs/reference/api.md](./reference/api.md)

---

### 2. Database Layer

**Location:** `src/db/`

Прямые SQL запросы через `pg` library. Без ORM.

**Ключевые файлы:**

- `client.ts` — Connection pool (max 50 connections)
- `helpers.ts` — Основные CRUD операции
- `complaint-helpers.ts` — Логика жалоб
- `review-filters.ts` — Фильтрация отзывов

**Source of Truth:** [docs/database-schema.md](./database-schema.md)

---

### 3. AI Integration

**Location:** `src/ai/`

Интеграция с Deepseek API для генерации текстов.

**Flows (AI workflows):**

| Flow | Назначение |
|------|------------|
| `generate-review-complaint-flow.ts` | Генерация текста жалобы |
| `generate-chat-reply-flow.ts` | Генерация ответа в чат |
| `classify-chat-tag-flow.ts` | Классификация чата по тегам |
| `classify-chat-deletion-flow.ts` | Классификация на удаление |
| `generate-deletion-offer-flow.ts` | Генерация предложения удаления |
| `generate-review-reply-flow.ts` | Генерация ответа на отзыв |
| `generate-question-reply-flow.ts` | Генерация ответа на вопрос |
| `analyze-store-dialogues-flow.ts` | Анализ 500 диалогов → авто-генерация FAQ + Guides |

**Prompts:** `src/ai/prompts/`

**Per-Store AI Context:** `src/lib/ai-context.ts`

Каждый AI flow получает контекст магазина через `buildStoreInstructions()`:
- **AI Instructions** — свободный текст (тон, правила, ограничения)
- **FAQ** — пары вопрос-ответ из `store_faq` таблицы
- **Guides** — пошаговые инструкции из `store_guides` таблицы

**Особенности:**

- Template-based complaints для пустых отзывов (экономия токенов)
- Per-store personalization (AI instructions + FAQ + Guides)
- Логирование в `ai_logs` таблицу
- Cost tracking (USD)

---

### 4. Cron Jobs

**Location:** `src/lib/cron-jobs.ts`

Автоматизация через `node-cron`.

**Активные jobs:**

| Job | Расписание (MSK) | Назначение |
|-----|------------------|------------|
| `hourly-review-sync` | Каждый час | Синхронизация отзывов + генерация жалоб |
| `daily-product-sync` | 07:00 | Синхронизация товаров |
| `adaptive-dialogue-sync` | 15/60 мин | Синхронизация чатов (адаптивно) |
| `backfill-worker` | Каждые 5 мин | Обработка очереди backfill |
| `stores-cache-refresh` | Каждые 5 мин | Прогрев кэша магазинов для Extension API |
| `google-sheets-sync` | 06:00 | Экспорт правил товаров в Google Sheets |
| `auto-sequence-processor` | Каждые 30 мин (8-22 MSK) | Отправка follow-up сообщений |

**Инициализация:** `instrumentation.ts` → `init-server.ts` → `cron-jobs.ts`

**Подробнее:** [docs/CRON_JOBS.md](./CRON_JOBS.md)

---

### 5. Sync Services

**Синхронизация данных с Wildberries:**

```
WB API → Sync Service → PostgreSQL
           ↓
    Event-driven Complaint Generation
           ↓
    review_complaints table
```

**Типы синхронизации:**

1. **Incremental** — только новые данные (по дате)
2. **Full** — полная выгрузка (adaptive chunking)

**Защита:**

- Rate limiting (2-3 сек между магазинами)
- Retry с exponential backoff
- Concurrent execution protection

---

## Потоки данных

### 1. Review Sync Flow

```
[WB Feedbacks API]
       ↓
[/api/stores/:id/reviews/update]
       ↓
[syncStoreReviews() in sync-store.ts]
       ↓
[upsertReviews() in helpers.ts]
       ↓
[PostgreSQL: reviews table]
       ↓ (if rating ≤ 4 && product active)
[generateComplaint() in generate-review-complaint-flow.ts]
       ↓
[PostgreSQL: review_complaints table]
```

### 2. Chat AI Reply Flow

```
[User clicks "Generate AI"]
       ↓
[/api/stores/:id/chats/:chatId/generate-ai]
       ↓
[generateChatReply() flow]
       ↓
[Deepseek API]
       ↓
[Response → draft_reply in chats table]
       ↓
[UI: AI Suggestion Box]
```

### 3. Complaint Lifecycle

```
Review Created (rating ≤ 4)
       ↓
[Auto-generate complaint] ←── CRON or Event-driven
       ↓
status: 'draft' (editable)
       ↓
[User marks as sent via Extension]
       ↓
status: 'pending'
       ↓
[WB moderates]
       ↓
status: 'approved' | 'rejected'
```

---

## Внешние интеграции

### 1. Wildberries API

| API | Endpoint Base | Назначение |
|-----|---------------|------------|
| Feedbacks API | `feedbacks-api.wildberries.ru` | Отзывы, вопросы |
| Content API | `content-api.wildberries.ru` | Товары |
| Chat API | `chat.wildberries.ru` | Диалоги |

**Аутентификация:** WB API tokens (per store)

### 2. Deepseek API

- **Model:** `deepseek-chat`
- **Назначение:** Генерация текстов (жалобы, ответы)
- **Cost:** ~$0.0005-0.001 per complaint
- **Rate limit:** 60 RPM

### 3. Chrome Extension

Расширение для парсинга статусов отзывов с WB кабинета.

**API endpoints:** `/api/extension/*`

**Данные:**
- `review_status_wb` (visible/unpublished/excluded)
- `product_status_by_review` (purchased/refused)
- `chat_status_by_review` (available/unavailable)

### 4. Google Sheets API

Экспорт правил товаров в Google Sheets для руководителя.

**Service Account:** `r5-automation@r5-wb-bot.iam.gserviceaccount.com`

**Экспортируемые данные:**
- Все активные магазины (`stores.status = 'active'`)
- Все активные товары (`products.work_status = 'active'`)
- Правила жалоб и чатов из `product_rules` таблицы

**API endpoints:** `/api/admin/google-sheets/sync`

**Триггеры:**
- CRON (ежедневно 6:00 MSK)
- Manual API call
- Hooks при изменении правил/статусов

**Service:** `src/services/google-sheets-sync/`

### 5. Telegram Bot & Mini App

Telegram Mini App для управления чатами с покупателями через мобильный интерфейс.

**Компоненты:**

| Компонент | Расположение | Назначение |
|-----------|-------------|------------|
| TG Bot | `scripts/start-telegram-bot.js` | PM2 процесс (fork), long-polling, команды /link /stop /status |
| Mini App UI | `src/app/(telegram)/tg/` | Мобильный интерфейс: очередь чатов + действия |
| Proxy API | `src/app/api/telegram/` | Auth, queue, chat actions (initData HMAC) |
| Notifications | `src/lib/telegram-notifications.ts` | Пуш при ответе клиента (хук в dialogue sync) |
| Auth | `src/lib/telegram-auth.ts` | HMAC-SHA256 валидация initData |
| DB helpers | `src/db/telegram-helpers.ts` | CRUD telegram_users, notification log, dedup |

**Потоки данных:**

```
Клиент отвечает → Dialogue Sync → TG Push → Менеджер открывает Mini App
→ Видит очередь → Тапает чат → 4 кнопки: Отправить / Заново / Закрыть / Пропустить
```

**API endpoints:** `/api/telegram/*`

**Аутентификация:** Telegram `initData` → HMAC-SHA256 с BOT_TOKEN → lookup `telegram_users`

---

## Deployment

**Инфраструктура:**

- **Domain:** `rating5.ru` (registrar: nic.ru, DNS: Cloudflare)
- **CDN/Proxy:** Cloudflare (SSL Full Strict, Proxied ON)
- **Cloud:** Yandex Cloud Compute
- **Server:** 2 vCPU, 4GB RAM, 20GB SSD (IP: 158.160.217.236)
- **OS:** Ubuntu 24.04 LTS
- **Process Manager:** PM2 (4 processes: app cluster x2, cron fork, tg-bot fork)
- **Web Server:** Nginx (reverse proxy + SSL termination, ports 80/443)
- **SSL:** GlobalSign DV certificate (`/etc/ssl/rating5/`)
- **Database:** Yandex Managed PostgreSQL 15

**Процессы PM2 (независимы друг от друга):**

| Процесс | Тип | Назначение | Зависимости |
|---------|-----|-----------|------------|
| `wb-reputation` x2 | cluster | Next.js (UI + API) | Nginx → :3000 |
| `wb-reputation-cron` | fork | Cron задачи | Самостоятельный |
| `wb-reputation-tg-bot` | fork | Telegram бот | Самостоятельный |

**Подробнее:** [docs/DEPLOYMENT.md](../DEPLOYMENT.md)

---

## Security

1. **API Authentication** — Bearer token (`wbrm_*`)
2. **Telegram Auth** — HMAC-SHA256 initData validation + `auth_date` freshness (24h)
3. **Store-level isolation** — `owner_id` checks
4. **Rate limiting** — Per-endpoint limits
5. **Input validation** — Zod schemas
6. **SQL injection protection** — Parameterized queries

---

## Performance Optimizations

1. **Denormalization** — `has_complaint`, `is_product_active` flags
2. **Composite indexes** — Optimized for common queries
3. **Partial indexes** — For specific WHERE conditions
4. **Connection pooling** — Max 50 connections
5. **React Query caching** — Client-side data cache
6. **Template-based complaints** — Zero AI cost for empty reviews

---

## ADRs (Architecture Decision Records)

| ADR | Решение |
|-----|---------|
| [ADR-001](./decisions/ADR-001-why-instrumentation-hook.md) | CRON через instrumentation hook |
| [ADR-002](./decisions/ADR-002-active-stores-filter.md) | Фильтрация только активных магазинов |
| [ADR-003](./decisions/ADR-003-cron-intervals.md) | Интервалы 5 мин (dev) / 1 час (prod) |

---

## Связанные документы

- [Database Schema](./database-schema.md) — Source of Truth по БД
- [CRON Jobs](./CRON_JOBS.md) — Автоматизация
- [API Reference](./reference/api.md) — Карта API
- [Complaints Domain](./domains/complaints.md) — Логика жалоб
- [Chats & AI](./domains/chats-ai.md) — AI в чатах

---

**Last Updated:** 2026-02-10
