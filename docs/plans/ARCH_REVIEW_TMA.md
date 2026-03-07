# ARCH_REVIEW_TMA.md — Архитектурный аудит Telegram Mini-App

> **Дата:** 2026-03-05
> **Автор:** Claude Code (Principal Architect Review)
> **Статус:** Draft — ожидает обсуждения
> **Scope:** Анализ текущей архитектуры TMA в контексте R5, риски, варианты, рекомендация

---

## 1. Current State — Инвентаризация

### 1.1 Структура репозитория

```
R5 saas-prod/                         ← Единый Next.js 14 монолит
├── src/
│   ├── app/
│   │   ├── (auth)/                   ← Auth UI (login, register)
│   │   ├── (telegram)/               ← ★ TMA UI (route group)
│   │   │   ├── tg/page.tsx           ← Queue page (~1300 строк)
│   │   │   ├── tg/chat/[chatId]/     ← Chat detail (~1200 строк)
│   │   │   ├── layout.tsx            ← TG SDK + AuthProvider
│   │   │   └── telegram.css          ← Design tokens (inline styles, без Tailwind)
│   │   ├── api/
│   │   │   ├── telegram/             ← ★ TMA API (10 routes)
│   │   │   ├── stores/[storeId]/     ← Web API (35+ routes)
│   │   │   ├── extension/            ← Chrome Extension API
│   │   │   ├── cron/                 ← Cron trigger API
│   │   │   └── ...                   ← 93 API routes total
│   │   └── stores/[storeId]/         ← Web dashboard pages
│   ├── components/
│   │   ├── telegram/                 ← TgQueueCard, TgLoginForm (2 файла)
│   │   └── ...                       ← 85 других компонентов
│   ├── db/                           ← 13 файлов, raw SQL (pg)
│   │   ├── helpers.ts                ← Монолит ~2600 строк
│   │   ├── telegram-helpers.ts       ← TMA-specific (~500 строк)
│   │   └── ...
│   ├── lib/                          ← 33 файла
│   │   ├── telegram-auth.ts          ← HMAC initData (TMA-only)
│   │   ├── telegram-auth-context.tsx  ← React context (TMA-only)
│   │   ├── telegram-notifications.ts  ← Notification hook (TMA-only)
│   │   ├── auto-sequence-sender.ts   ← Shared: TMA + Cron
│   │   ├── cron-jobs.ts              ← All cron definitions (~56KB)
│   │   └── ...
│   └── ai/                           ← 15 файлов, 7 AI flows
├── scripts/
│   ├── start-telegram-bot.js         ← ★ Standalone Node.js bot (PM2 fork)
│   └── start-cron.js                 ← Standalone cron process (PM2 fork)
├── ecosystem.config.js               ← PM2: 3 процесса
├── next.config.mjs                   ← ignoreBuildErrors: true
└── package.json                      ← Единый build: `next build`
```

### 1.2 Размер TMA vs основной системы

| Метрика | TMA | Основная система | % TMA |
|---------|-----|-----------------|-------|
| UI pages | 2 | 12 | 14% |
| API routes | 10 | 83 | 11% |
| Components | 2 | 85 | 2% |
| DB helpers | 1 файл (500 строк) | 12 файлов (~4000 строк) | ~11% |
| Lib modules | 3 файла | 30 файлов | 9% |
| **Итого файлов** | **~20** | **~291** | **~6%** |

### 1.3 Как TMA общается с backend

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Process (x2 cluster)          │
│                                                         │
│  ┌──────────────┐    ┌──────────────────┐               │
│  │  TMA UI      │    │  Web Dashboard   │               │
│  │  /tg/*       │    │  /stores/*       │               │
│  └──────┬───────┘    └──────┬───────────┘               │
│         │                    │                           │
│  ┌──────▼───────┐    ┌──────▼───────────┐               │
│  │ /api/telegram │    │ /api/stores/     │               │
│  │  (10 routes)  │    │  (35+ routes)    │               │
│  └──────┬───────┘    └──────┬───────────┘               │
│         │                    │                           │
│         └────────┬───────────┘                           │
│                  ▼                                       │
│  ┌──────────────────────────────┐                        │
│  │  Shared Domain Layer         │                        │
│  │  db/helpers.ts (2600 строк)  │                        │
│  │  ai/flows/* (7 flows)        │                        │
│  │  lib/auto-sequence-*.ts      │                        │
│  │  db/auth-helpers.ts          │                        │
│  │  db/review-chat-link-*.ts    │                        │
│  └──────────────┬───────────────┘                        │
│                  ▼                                       │
│  ┌──────────────────────────────┐                        │
│  │  PostgreSQL (Yandex Managed) │                        │
│  │  Единая БД, единый pool      │                        │
│  └──────────────────────────────┘                        │
└─────────────────────────────────────────────────────────┘

┌───────────────────┐   ┌───────────────────┐
│  TG Bot (PM2 fork)│   │  Cron (PM2 fork)  │
│  start-telegram-  │   │  start-cron.js    │
│  bot.js           │   │                   │
│  Standalone pg    │   │  HTTP → /api/cron │
│  No Next.js deps  │   │  + in-memory jobs │
└───────────────────┘   └───────────────────┘
```

**Ключевой факт:** TMA API routes (`/api/telegram/*`) — это обычные Next.js route handlers внутри того же процесса. Они напрямую импортируют доменные модули через `@/` alias — без HTTP-вызовов, без message bus, без service boundary.

### 1.4 Shared компоненты (конкретные imports)

TMA API routes импортируют из основного домена:

| TMA Route | Импортирует из основного домена |
|-----------|-------------------------------|
| `generate-ai` | `@/ai/flows/generate-chat-reply-flow`, `@/lib/ai-context`, `@/db/helpers`, `@/db/review-chat-link-helpers` |
| `send` | `@/db/helpers`, `@/lib/ozon-api`, `@/db/auth-helpers` |
| `sequence/start` | `@/lib/auto-sequence-templates`, `@/lib/auto-sequence-sender`, `@/db/review-chat-link-helpers` |
| `status` | `@/lib/chat-transitions`, `@/db/helpers` |
| `queue` | `@/db/telegram-helpers` (но внутри — UNION query с review_chat_links, products, product_rules) |
| `chats/[chatId]` | `@/db/client` (direct `query()`), `@/db/auth-helpers` |

**Все TMA routes** вызывают `authenticateTgApiRequest()` и `getAccessibleStoreIds()` — shared auth layer.

### 1.5 Деплой и CI/CD

| Аспект | Текущее состояние |
|--------|-------------------|
| Build | Единый `next build` → один `.next` артефакт |
| Deploy | `git pull && npm run build && pm2 reload wb-reputation && pm2 restart wb-reputation-cron` |
| Processes | 3 PM2: web×2 cluster, tg-bot×1 fork, cron×1 fork |
| Env vars | Общие (`POSTGRES_*`, `JWT_SECRET`) + 3 TMA-specific (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_MINI_APP_URL`, `TELEGRAM_DEV_MODE`) |
| CI/CD pipeline | Ручной деплой через SSH |
| Rollback | `git checkout <prev-commit> && npm run build && pm2 reload` |

### 1.6 Конфиги и секреты

| Переменная | Используется | Тип |
|-----------|-------------|-----|
| `POSTGRES_*` (5 vars) | Все процессы | Shared |
| `JWT_SECRET` | Web + TMA API | Shared |
| `DEEPSEEK_API_KEY` | AI flows (Web + TMA) | Shared |
| `NEXT_PUBLIC_BASE_URL` | Cron → Web HTTP | Shared |
| `TELEGRAM_BOT_TOKEN` | TG Bot + TMA auth + Notifications | TMA-specific |
| `TELEGRAM_MINI_APP_URL` | TG Bot (inline buttons) | TMA-specific |
| `TELEGRAM_DEV_MODE` | TMA auth bypass | TMA-specific |

---

## 2. Problems & Risks

### 2.1 Coupling — Глубокая связанность

| Симптом | Где в коде | Риск | Последствия |
|---------|-----------|------|-------------|
| **Direct domain import** | TMA `generate-ai` imports `generateChatReply`, `buildStoreInstructions`, `detectConversationPhase` | Изменение AI flow сигнатуры ломает TMA | Невозможно менять AI для web без ретеста TMA |
| **Shared DB helpers** | TMA routes import `@/db/helpers` (50+ функций), `@/db/auth-helpers` | Рефакторинг helpers.ts (2600 строк) — blast radius на весь проект | Сложно выделить TMA-only интерфейс |
| **Дублированный AI context** | ~100 строк context-building кода copy-paste между TMA и Web `generate-ai` routes | Баг-фиксы применяются в одном месте, забываются в другом | Уже было: compensation gating fix в 3 файлах |
| **Shared auth model** | `authenticateTgApiRequest()` возвращает `userId` → дальше используется `getAccessibleStoreIds()` из web auth | Нельзя менять org-model без учёта TMA | Добавление нового типа пользователя ломает оба канала |
| **Direct `query()` calls** | TMA routes (`send`, `generate-ai`, `chats/[chatId]`) используют raw SQL через `@/db/client` | Нет domain boundary — TMA "знает" структуру таблиц | Миграция БД требует проверки TMA SQL тоже |

**Severity: HIGH.** TMA и Web делят один process, один module graph, одну DB connection pool. Граница — только папки в файловой системе.

### 2.2 Release Independence — Невозможность раздельного деплоя

| Симптом | Риск | Последствия |
|---------|------|-------------|
| Один `next build` для всего | Изменение в TMA UI требует полного rebuild + reload всех 2 cluster instances | Downtime для web dashboard при деплое TMA-only изменений |
| PM2 reload = все web + TMA | Нет granularity: нельзя обновить только TMA routes | Сессии web-пользователей прерываются |
| Cron requires manual restart | После `pm2 reload` нужен `pm2 restart wb-reputation-cron` | Забытый restart = сломанные cron jobs |

**Severity: MEDIUM.** При текущем масштабе (1 разработчик, ~20 деплоев/мес) — терпимо. При росте — critical.

### 2.3 Blast Radius

| Сценарий | Blast radius |
|----------|-------------|
| Bug в TMA queue SQL (UNION query) | CPU spike → Node.js event loop blocked → Web dashboard unresponsive |
| OOM в TMA page component | Next.js worker crash → PM2 restart → кратковременный downtime |
| N+1 query в TMA API route | Connection pool exhaustion → Web API 503 |
| Exception в shared helper (helpers.ts) | Ломает и TMA и Web одновременно |

**Severity: HIGH.** Отсутствие process isolation между TMA и Web.

### 2.4 Security

| Аспект | Текущее состояние | Риск |
|--------|-------------------|------|
| Auth boundary | TMA использует HMAC initData ИЛИ JWT — оба пути ведут к `userId` | Если HMAC-валидация сломана, TMA не имеет fallback boundary |
| DB access | TMA routes выполняют raw SQL с тем же connection pool | SQL injection в TMA route = доступ ко всей БД |
| Store access control | `getAccessibleStoreIds()` — единый gate для Web и TMA | ✅ Корректно; но нет audit trail, кто именно обращался (web vs TMA) |
| Bot token exposure | `TELEGRAM_BOT_TOKEN` доступен всему Next.js process | Теоретически читаем из любого API route (не только TMA) |

**Severity: LOW-MEDIUM.** Auth правильный, но отсутствует audit differentiation.

### 2.5 Observability

| Аспект | Текущее состояние | Проблема |
|--------|-------------------|---------|
| Логи | PM2 → один `out.log` для web + TMA | Невозможно отфильтровать TMA-only ошибки |
| Metrics | Нет (ни Prometheus, ни StatsD) | Нельзя измерить latency/error-rate TMA отдельно |
| Tracing | Нет | Нельзя отследить request path через TMA → shared helpers → DB |
| Error tracking | Нет (ни Sentry, ни аналогов) | Ошибки TMA теряются в общем потоке |

**Severity: MEDIUM.** Сейчас debug через `pm2 logs` + ручной grep. Не масштабируется.

### 2.6 Performance

| Аспект | Факт | Влияние |
|--------|------|---------|
| Build time | Один build = TMA UI компилируется вместе с 87 компонентами web dashboard | +10-20% build time (minor) |
| Bundle size | TMA pages отдельный route group → tree-shaking работает | ✅ Нет лишнего кода в TMA bundle |
| Connection pool | 20 connections shared между web (×2 cluster) + TMA | При пиковых нагрузках на TMA — web может ждать connection |
| Cold start | instrumentationHook + cron init при старте каждого worker | +2-3 сек, но для TMA не критично |

**Severity: LOW.** На текущих объёмах (~700 review-linked chats) performance не проблема.

### 2.7 Team Scale

| Сценарий | Проблема |
|----------|---------|
| 2+ разработчика одновременно | Merge conflicts в `helpers.ts` (2600 строк), `cron-jobs.ts` (56KB) |
| Новый разработчик на TMA | Нужно понимать весь domain layer (complaints, auto-sequences, AI) |
| Отдельная mobile team | Невозможно работать изолированно — shared module graph |

**Severity: MEDIUM.** При текущем 1 разработчике — ок. При 2+ — friction растёт быстро.

---

## 3. Target Options

### Option A — Monorepo с чёткими границами модулей

**Суть:** Остаёмся в одном репозитории, но создаём явную module boundary между TMA и core domain.

```
R5 saas-prod/
├── src/
│   ├── core/                    ← Domain layer (новая папка)
│   │   ├── chats/               ← Chat CRUD, transitions, AI
│   │   ├── reviews/             ← Review sync, complaints
│   │   ├── sequences/           ← Auto-sequence logic
│   │   ├── stores/              ← Store management
│   │   └── auth/                ← Auth, org, access control
│   ├── app/
│   │   ├── (telegram)/          ← TMA UI (как сейчас)
│   │   ├── api/telegram/        ← TMA API (как сейчас)
│   │   └── ...                  ← Web (как сейчас)
│   ├── shared/                  ← Shared types, DTOs, utils
│   └── db/                      ← DB layer (как сейчас)
```

| Критерий | Оценка |
|----------|--------|
| **Когда лучший выбор** | Маленькая команда (1-3), быстрая итерация, общая БД допустима |
| **Плюсы** | Минимум friction; IDE навигация; shared types без versioning; один git history |
| **Минусы** | Дисциплина по границам — легко нарушить; всё ещё один build; один process |
| **Сложность** | **S** (Small) — перемещение файлов + lint rules |
| **Риски миграции** | Низкие — рефакторинг imports, возможны TS path alias изменения |
| **Общая БД** | Остаётся как есть; TMA ходит через `core/` API, не напрямую в `db/` |

### Option B — Отдельный сервис (Separate Repository)

**Суть:** TMA выносится в отдельный репозиторий. Общается с R5 backend только через HTTP API.

```
Repo 1: R5-backend (существующий)
├── src/app/api/...              ← Публичный API (+ TMA endpoints)
├── src/db/...                   ← DB layer
└── ...

Repo 2: R5-tma (новый)
├── src/app/tg/...               ← TMA UI (React/Next.js или Vite)
├── src/api-client.ts            ← HTTP client для R5 API
└── ...
```

| Критерий | Оценка |
|----------|--------|
| **Когда лучший выбор** | Отдельная team для TMA; разные release cycles; планируются другие mini-apps |
| **Плюсы** | Полная изоляция; независимый deploy; можно использовать другой фреймворк (Vite, SvelteKit); чистый API contract |
| **Минусы** | Два репо = overhead (sync versions, shared types drift); latency HTTP vs in-process; нужен API versioning; дублирование CI/CD |
| **Сложность** | **L** (Large) — нужен стабильный API contract, отдельный hosting, отдельный SSL |
| **Риски миграции** | Высокие — нужно формализовать все 10 TMA endpoints как public API; auth model меняется |
| **Общая БД** | TMA НЕ имеет доступа к БД; всё через HTTP API backend |

### Option C — BFF (Backend-for-Frontend) слой

**Суть:** Выделить промежуточный слой (BFF) между TMA frontend и core domain.

```
R5 saas-prod/
├── src/
│   ├── app/
│   │   ├── api/telegram/        ← BFF layer (тонкий)
│   │   │   ├── queue/           ← Агрегирует данные для TMA view
│   │   │   └── chats/           ← Маппит domain → TMA DTO
│   │   └── api/stores/          ← Web API (без изменений)
│   ├── core/                    ← Domain services (выделенные)
│   │   ├── chat-service.ts      ← sendMessage(), generateReply()
│   │   ├── sequence-service.ts  ← startSequence(), stopSequence()
│   │   └── queue-service.ts     ← getQueue(), getChatDetail()
│   └── db/                      ← DB layer (без изменений)
```

| Критерий | Оценка |
|----------|--------|
| **Когда лучший выбор** | TMA нужны специфичные view-models; оркестрация нескольких domain calls; разные данные для web vs mobile |
| **Плюсы** | TMA API routes тонкие (mapping only); domain logic консолидирована в services; можно unit-тестировать services |
| **Минусы** | Доп. слой абстракции; нужна дисциплина (не обходить BFF напрямую); всё ещё один process |
| **Сложность** | **M** (Medium) — выделить domain services + рефакторить TMA routes |
| **Риски миграции** | Средние — нужно аккуратно выделить services из helpers.ts (2600 строк) |
| **Общая БД** | Остаётся; но доступ только через core services, не raw SQL |

### Сравнительная таблица

| Критерий | Option A (Monorepo boundaries) | Option B (Separate service) | Option C (BFF layer) |
|----------|-------------------------------|---------------------------|---------------------|
| **Изоляция процессов** | ❌ Нет | ✅ Полная | ❌ Нет |
| **Независимый деплой** | ❌ Нет | ✅ Да | ❌ Нет |
| **Сложность внедрения** | S | L | M |
| **Blast radius protection** | ⚠️ Partial (lint rules) | ✅ Full | ⚠️ Partial (service layer) |
| **Скорость итерации** | ✅ Высокая | ⚠️ Снижается (API versioning) | ✅ Высокая |
| **Дублирование кода** | ⚠️ Можно забыть границы | ✅ Исключено (API contract) | ⚠️ BFF → services mapping |
| **Shared types** | ✅ Тривиально | ⚠️ Нужен shared package | ✅ Тривиально |
| **Team scaling** | ⚠️ До 3 чел | ✅ Неограниченно | ⚠️ До 5 чел |
| **DB миграции** | Единые | Единые (backend owns DB) | Единые |
| **Observability** | ⚠️ Требует convention | ✅ По процессам | ⚠️ Требует convention |

---

## 4. Recommendation — Option C (BFF Layer)

**Рекомендую Option C** — выделение BFF + domain services внутри текущего монолита.

### Обоснование (7 аргументов из найденных фактов):

**1. Дублирование AI context — уже болит.**
Найдено: ~100 строк copy-paste между `api/telegram/.../generate-ai` и `api/stores/.../generate-ai`. Compensation gating fix уже требовал правок в 3 файлах. BFF + `ChatService.generateReply()` = единая точка входа.

**2. helpers.ts (2600 строк) — untestable monolith.**
Сейчас 50+ функций в одном файле, используются и TMA и Web. Domain services (`ChatService`, `SequenceService`) разбивают этот монолит по bounded contexts. TMA routes станут тонкими маппингами.

**3. Raw SQL в TMA routes — нарушение layering.**
Найдено: `send`, `generate-ai`, `chats/[chatId]` routes используют `query()` напрямую. Это значит TMA "знает" SQL-структуру таблиц. При BFF: TMA routes → domain services → db helpers.

**4. Скорость итерации — критична.**
R5 в active development, 1 разработчик, быстрый feature cycle. Option B (separate repo) замедлит каждый PR из-за API versioning overhead. Option C сохраняет in-process скорость.

**5. Один процесс — пока допустимо.**
~700 review-linked chats, ~20 TMA-пользователей. Process isolation не нужна на текущих объёмах. Если вырастет — Option C легко переходит в Option B (services уже выделены, остаётся обернуть HTTP).

**6. Отсутствие team boundary — нет смысла в separate repo.**
1 разработчик. Separate repo = overhead без benefit. BFF даёт те же architectural guarantees через code structure, а не repo separation.

**7. Путь к Option B без потерь.**
Option C — это подготовительный этап для Option B. Domain services, выделенные на этом этапе, станут основой public API, если в будущем понадобится separate service. Zero wasted work.

### Когда переходить к Option B

Option B станет оправдана при **любом** из условий:
- Появляется 2-й mini-app (Viber, WhatsApp, собственный mobile)
- Команда TMA > 2 человек
- TMA latency/uptime SLA отличается от web dashboard
- Нужен canary deploy только для TMA

---

## 5. Migration Plan (4 этапа)

### Stage 0 — Boundaries & Contract

**Цель:** Определить domain API surface для TMA, зафиксировать DTO.

**Что делаем:**
1. Создать файл `src/core/types/tma-contracts.ts` — TypeScript interfaces для всех TMA endpoints (request/response)
2. Создать `src/core/types/domain-events.ts` — события, на которые TMA реагирует (chat_status_changed, sequence_started, etc.)
3. Задокументировать текущие 10 TMA endpoints в `docs/reference/tma-api-contract.md` с request/response schemas

**DoD:**
- [ ] Все 10 TMA endpoints имеют typed request/response interfaces
- [ ] Документ `tma-api-contract.md` описывает каждый endpoint
- [ ] Код пока НЕ меняется — только types + docs

**Риски:** Минимальные. Если забросить — ничего не ломается.
**Rollback:** Удалить файлы types + docs.

---

### Stage 1 — Domain Services Extraction

**Цель:** Вынести бизнес-логику из route handlers в domain services.

**Что делаем:**
1. Создать `src/core/services/`:
   - `chat-service.ts` — `sendMessage()`, `generateReply()`, `getChatDetail()`
   - `sequence-service.ts` — `startSequence()`, `stopSequence()`, `getSequenceStatus()`
   - `queue-service.ts` — `getUnifiedQueue()`, `getQueueCounts()`
   - `chat-status-service.ts` — `changeStatus()`, `changeTag()` с валидацией
2. Перенести дублированную логику AI context building в `chat-service.ts`
3. TMA routes → вызывают services (тонкие handlers)
4. Web routes → тоже вызывают services (постепенно)

**DoD:**
- [ ] AI context building НЕ дублируется (единая реализация в `chat-service.ts`)
- [ ] TMA routes не содержат raw `query()` вызовов
- [ ] TMA routes ≤50 строк каждый (auth + service call + response mapping)
- [ ] Web routes по-прежнему работают (можно мигрировать позже)

**Риски:**
- Неточное выделение services → service всё ещё вызывает слишком много helpers
- Regression в AI generation flow

**Rollback:** Revert commits. Services — additive change, не ломает существующий код.

---

### Stage 2 — Build & Deploy Decoupling

**Цель:** Возможность деплоить TMA-relevant изменения с минимальным blast radius.

**Что делаем:**
1. Разделить PM2 логи: `tma-api.log` через structured logging (prefix `[TMA]` в console.log)
2. Добавить health check endpoint `/api/telegram/health` (отдельно от `/api/health`)
3. Добавить basic metrics: request count + latency для TMA endpoints (custom middleware)
4. (Опционально) Рассмотреть feature flags для TMA-only фич

**DoD:**
- [ ] TMA-specific логи фильтруемы через `grep [TMA]`
- [ ] `/api/telegram/health` возвращает OK + DB connectivity check
- [ ] Request latency для TMA endpoints логируется (p50, p95)

**Риски:** Минимальные — additive changes.
**Rollback:** Убрать middleware + health endpoint.

---

### Stage 3 — Data Boundary (Optional/Future)

**Цель:** Управляемый доступ TMA к данным.

**Что делаем (когда и если понадобится):**
1. PostgreSQL Row-Level Security (RLS) для `telegram_*` таблиц
2. Read-only DB replica для TMA queue queries (тяжёлые UNION-ы)
3. Выделить `telegram_*` таблицы в отдельную schema (`tma.*`)
4. Event-driven уведомления вместо polling (LISTEN/NOTIFY или Redis pub/sub)

**DoD:**
- [ ] TMA queries идут на read-replica (если настроена)
- [ ] `telegram_*` таблицы в отдельной schema
- [ ] Миграции для TMA-schema отделены от core migrations

**Риски:**
- RLS добавляет overhead на каждый query
- Read-replica replication lag может показать stale data
- Event-driven = новая инфраструктура

**Rollback:** Откатить RLS policies, вернуть на primary connection.

---

### Roadmap Summary

```
Stage 0 ──────► Stage 1 ──────► Stage 2 ──────► Stage 3
(~1 день)       (~3-5 дней)     (~2-3 дня)      (по необходимости)

Types +         Domain          Observability    Data boundary
Contract        Services        + Logging        (future)
docs            extraction      + Monitoring

Zero risk       Low risk        Zero risk        Medium risk
```

---

## 6. Decision Checklist

Ответьте на эти вопросы перед принятием финального решения:

### Бизнес-контекст

| # | Вопрос | Варианты ответа | Влияние на выбор |
|---|--------|----------------|-----------------|
| 1 | Нужна ли независимая скорость релизов TMA? | Да → B; Нет → A/C | Сейчас: нет |
| 2 | Сколько mini-apps планируется (Viber, WhatsApp, mobile)? | 0 → A/C; 1+ → B | Сейчас: 0 |
| 3 | Какой SLA по web dashboard vs TMA? | Одинаковый → A/C; Разный → B | Сейчас: одинаковый |
| 4 | Растёт ли команда в ближайшие 6 месяцев? | Нет → A/C; Да (2+) → B/C | ? |
| 5 | Планируется ли TMA для внешних клиентов (white-label)? | Нет → A/C; Да → B | Сейчас: нет |

### Технический контекст

| # | Вопрос | Варианты ответа | Влияние на выбор |
|---|--------|----------------|-----------------|
| 6 | Допустима ли общая БД на ближайший год? | Да → A/C; Нет → B | Сейчас: да |
| 7 | Готовы поддерживать API versioning? | Нет → A/C; Да → B | Overhead для 1 разработчика |
| 8 | Нужен ли TMA доступ к чувствительным данным (billing, credentials)? | Нет → всё ок; Да → нужна доп. изоляция | Сейчас: нет |
| 9 | Были ли инциденты, где TMA баг сломал web (или наоборот)? | Нет → A/C; Да → B/C | ? |
| 10 | Есть ли потребность в A/B тестировании TMA UI? | Нет → A/C; Да → B | Сейчас: нет |

### Операционный контекст

| # | Вопрос | Варианты ответа | Влияние на выбор |
|---|--------|----------------|-----------------|
| 11 | Есть ли мониторинг/alerting сейчас? | Нет → Stage 2 обязателен | Сейчас: нет |
| 12 | Сколько деплоев в неделю? | <5 → A/C ok; >10 → B выгоднее | Сейчас: ~5 |
| 13 | Были ли проблемы с connection pool exhaustion? | Нет → ok; Да → Stage 3 | ? |
| 14 | Как часто TMA и web деплоятся одновременно? | Всегда → A/C; Иногда раздельно → B | Сейчас: всегда |
| 15 | Допустим ли 5-сек downtime при деплое? | Да → A/C; Нет → B (blue-green) | Сейчас: да |

### Scoring Guide

- **5+ ответов указывают на B** → планировать separation
- **10+ ответов указывают на A/C** → оставаться в монолите
- **Если 6-9 mixed** → Option C как компромисс и подготовка к B

---

## Appendix: Concrete File Inventory

### TMA-Only Files (20 files)

**UI:**
- `src/app/(telegram)/layout.tsx`
- `src/app/(telegram)/telegram.css`
- `src/app/(telegram)/tg/page.tsx`
- `src/app/(telegram)/tg/chat/[chatId]/page.tsx`
- `src/components/telegram/TgQueueCard.tsx`
- `src/components/telegram/TgLoginForm.tsx`

**API Routes:**
- `src/app/api/telegram/auth/verify/route.ts`
- `src/app/api/telegram/auth/login/route.ts`
- `src/app/api/telegram/queue/route.ts`
- `src/app/api/telegram/chats/[chatId]/route.ts`
- `src/app/api/telegram/chats/[chatId]/send/route.ts`
- `src/app/api/telegram/chats/[chatId]/generate-ai/route.ts`
- `src/app/api/telegram/chats/[chatId]/status/route.ts`
- `src/app/api/telegram/chats/[chatId]/sequence/route.ts`
- `src/app/api/telegram/chats/[chatId]/sequence/start/route.ts`
- `src/app/api/telegram/chats/[chatId]/sequence/stop/route.ts`

**Libraries:**
- `src/lib/telegram-auth.ts`
- `src/lib/telegram-auth-context.tsx`
- `src/lib/telegram-notifications.ts`
- `src/db/telegram-helpers.ts`

**Standalone:**
- `scripts/start-telegram-bot.js`

### Shared Modules Used by TMA

- `src/db/helpers.ts` (2600 строк — 50+ functions)
- `src/db/auth-helpers.ts` (org access control)
- `src/db/review-chat-link-helpers.ts` (review linking)
- `src/db/client.ts` (PostgreSQL pool)
- `src/ai/flows/generate-chat-reply-flow.ts`
- `src/lib/ai-context.ts`
- `src/lib/auto-sequence-templates.ts`
- `src/lib/auto-sequence-sender.ts`
- `src/lib/chat-transitions.ts`
- `src/lib/ozon-api.ts`

---

> **Следующий шаг:** Обсудить recommendation (Option C) и принять решение по Decision Checklist.
> При согласии — начинаем со Stage 0 (types + API contract docs).
