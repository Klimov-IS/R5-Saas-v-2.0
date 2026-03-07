# REFACTOR_PLAN_TMA_BFF.md — Детальный план рефакторинга TMA → BFF → Domain Services

> **Дата:** 2026-03-05
> **Статус:** Draft — ожидает утверждения
> **Prerequisite:** [ARCH_REVIEW_TMA.md](ARCH_REVIEW_TMA.md)

---

## 0. Executive Summary

**Что делаем:** Выделяем domain services между TMA route handlers и raw SQL/shared helpers. TMA routes превращаются в thin-handlers (auth → service → response mapping). Устраняем дублирование AI context building и marketplace dispatch. Вводим базовую observability.

**Итоговая архитектура:**
```
TMA UI (/tg/*)
  → TMA API routes (auth + mapping, ≤50 LOC each)
    → core/services (ChatService, SequenceService, QueueService, ChatStatusService)
      → db/repositories (typed wrappers над query())
        → PostgreSQL
```

**Этапы и сложность:**

| Stage | Цель | Сложность | Дни (1 dev) |
|-------|------|-----------|-------------|
| 0 | Contracts & DTO | S | 1 |
| 1 | Core Services | L | 5–7 |
| 2 | Repositories / DB boundary | M | 3–4 |
| 3 | Observability | S | 2 |
| 4 | Подготовка к separation (optional) | M | 2–3 |
| **Итого** | | | **11–17 дней** |

---

## 1. Dependency Graph: Current → Target

### 1.1 Current: TMA → Shared Modules (прямые imports)

```
TMA Routes (10 files)
├── @/db/client ──────────────── query() raw SQL         ← 8 из 10 routes
├── @/db/helpers ─────────────── 50+ функций (2600 LOC)  ← 7 из 10 routes
├── @/db/auth-helpers ────────── getAccessibleStoreIds    ← 9 из 10 routes
├── @/db/review-chat-link-helpers findLink*, isResolved   ← 3 routes
├── @/db/extension-helpers ───── getUserStores             ← 2 routes (auth)
├── @/ai/flows/generate-chat-reply-flow ──────────────────── 1 route
├── @/lib/ai-context ─────────── 5 functions               ← 1 route
├── @/lib/auto-sequence-templates ──── templates + config  ← 1 route
├── @/lib/auto-sequence-sender ─ sendSequenceMessage       ← 1 route
├── @/lib/chat-transitions ───── validateTransition        ← 1 route
├── @/lib/ozon-api ──────────── createOzonClient           ← 1 route
├── @/lib/telegram-auth ──────── authenticateTgApiRequest   ← 10 routes
└── @/lib/auth ──────────────── comparePassword, signToken ← 1 route (login)
```

### 1.2 Target: Layered Dependencies

```
TMA Routes (10 files)
├── @/lib/telegram-auth ────── authenticateTgApiRequest    ✅ оставляем
├── @/core/services/* ─────── ChatService, SequenceService ✅ новый слой
├── @/core/contracts/* ────── TMA DTOs, request/response   ✅ новый слой
└── ничего больше

core/services/*
├── @/db/repositories/* ───── ChatRepository, etc.         ✅ новый слой
├── @/ai/flows/* ──────────── generateChatReply             ✅ оставляем
├── @/lib/ai-context ──────── buildStoreInstructions, etc.  ✅ оставляем
├── @/lib/auto-sequence-* ─── sender, templates             ✅ оставляем
├── @/lib/chat-transitions ── validateTransition             ✅ оставляем
└── @/lib/ozon-api ────────── createOzonClient               ✅ оставляем

db/repositories/*
├── @/db/client ───────────── query()                       ✅ единственный пользователь query()
└── (raw SQL живёт здесь)
```

### 1.3 Запретные imports (Architecture Guardrails)

После завершения рефакторинга:

| Слой | МОЖНО импортировать | НЕЛЬЗЯ импортировать |
|------|--------------------|--------------------|
| **TMA routes** (`api/telegram/*`) | `@/lib/telegram-auth`, `@/core/services/*`, `@/core/contracts/*` | `@/db/*` (любой), `@/ai/*`, `@/lib/ozon-api`, `@/lib/auto-sequence-*`, `@/lib/chat-transitions` |
| **core/services** | `@/db/repositories/*`, `@/ai/flows/*`, `@/lib/*` (utilities) | `@/db/client` (direct query), `@/db/helpers` (монолит) |
| **db/repositories** | `@/db/client` | `@/ai/*`, `@/lib/*` (business logic), `@/core/services/*` |
| **Web routes** (`api/stores/*`) | Пока без ограничений; мигрировать постепенно | — |

---

## 2. Этапы рефакторинга

### Stage 0 — Contracts & DTO

**Цель:** Зафиксировать typed interfaces для всех 10 TMA endpoints. Создать единую точку правды для request/response shapes. Zero code changes в существующих файлах.

#### Новые файлы

```
src/core/
├── contracts/
│   ├── tma-auth.ts          ← VerifyRequest/Response, LoginRequest/Response
│   ├── tma-queue.ts         ← QueueRequest (query params), QueueResponse, QueueItemDTO
│   ├── tma-chat.ts          ← ChatDetailDTO, SendRequest, GenerateAiResponse
│   ├── tma-status.ts        ← StatusChangeRequest, StatusChangeResponse
│   └── tma-sequence.ts      ← SequenceInfoDTO, StartRequest, StartResponse
└── index.ts                 ← barrel export
```

#### Migration Steps

1. Создать `src/core/contracts/` directory
2. Извлечь implicit типы из каждого TMA route в explicit interfaces:
   - **tma-auth.ts**: из `verify/route.ts` (lines 15-22 request body, lines 35-45 response) + `login/route.ts` (lines 12-14 request, lines 44-50 response)
   - **tma-queue.ts**: из `queue/route.ts` (lines 15-22 query params → `QueueQueryParams`; lines 60-75 response → `QueueResponse` with `QueueItemDTO[]`)
   - **tma-chat.ts**: из `chats/[chatId]/route.ts` (lines 46-90 response → `ChatDetailDTO` with messages); из `send/route.ts` (line 20 request → `SendMessageRequest`); из `generate-ai/route.ts` (lines 173-178 response → `GenerateAiResponse`)
   - **tma-status.ts**: из `status/route.ts` (lines 30-42 request → `StatusChangeRequest`; lines 131 response → `StatusChangeResponse`)
   - **tma-sequence.ts**: из `sequence/route.ts` (lines 46-57 response → `SequenceInfoDTO`); из `sequence/start/route.ts` (line 28 request → `StartSequenceRequest`; lines 186-201 response → `StartSequenceResponse`)
3. Создать barrel export `src/core/index.ts`
4. **НЕ менять** существующие route файлы на этом этапе

#### Затрагиваемые файлы

| Файл | Действие | Что именно |
|------|---------|-----------|
| `src/core/contracts/tma-auth.ts` | **NEW** | 4 interfaces: VerifyRequest, VerifyResponse, LoginRequest, LoginResponse |
| `src/core/contracts/tma-queue.ts` | **NEW** | 3 interfaces: QueueQueryParams, QueueItemDTO, QueueResponse |
| `src/core/contracts/tma-chat.ts` | **NEW** | 4 interfaces: ChatDetailDTO, ChatMessageDTO, SendMessageRequest, GenerateAiResponse |
| `src/core/contracts/tma-status.ts` | **NEW** | 2 interfaces: StatusChangeRequest, StatusChangeResponse |
| `src/core/contracts/tma-sequence.ts` | **NEW** | 3 interfaces: SequenceInfoDTO, StartSequenceRequest, StartSequenceResponse |
| `src/core/index.ts` | **NEW** | Barrel re-exports |

#### DoD

- [ ] Все 10 TMA endpoints имеют typed request/response interfaces в `src/core/contracts/`
- [ ] Интерфейсы покрывают все поля, которые реально возвращаются (проверить по коду каждого route)
- [ ] `QueueItemDTO` содержит все поля из `getUnifiedChatQueue()` result (из `telegram-helpers.ts`)
- [ ] Типы компилируются (`npx tsc --noEmit` проходит для новых файлов)
- [ ] Ни один существующий файл не изменён

#### Risks & Rollback

- **Риск:** Типы не совпадут с реальными ответами runtime → ловится на Stage 1 при интеграции
- **Rollback:** `rm -rf src/core/` — zero impact

#### Тесты

- Manual: `npx tsc --noEmit` — типы корректны
- Никаких runtime тестов — это чисто type-level изменение

---

### Stage 1 — Core Services

**Цель:** Перенести бизнес-логику из 10 TMA route handlers в domain services. Routes становятся thin-handlers (≤50 LOC). Устранить дублирование AI context building и marketplace dispatch.

#### Новые файлы

```
src/core/services/
├── chat-service.ts          ← getChatDetail(), sendMessage(), generateReply()
├── queue-service.ts         ← getQueue(), getQueueCounts()
├── sequence-service.ts      ← start(), stop(), getStatus()
├── chat-status-service.ts   ← changeStatus()
└── message-sender.ts        ← sendMessageToMarketplace() — shared utility
```

#### Service Decomposition (что куда)

**chat-service.ts** — объединяет логику из 3 routes:

| Метод | Откуда берём логику | LOC inline → service |
|-------|-------------------|---------------------|
| `getChatDetail(chatId, accessibleStoreIds)` | `chats/[chatId]/route.ts` lines 27-94 | 6-table JOIN + message synthesis (~100 LOC) |
| `sendMessage(chatId, message, accessibleStoreIds)` | `send/route.ts` lines 34-112 | Auth check + marketplace dispatch + status update (~80 LOC) |
| `generateReply(chatId, accessibleStoreIds)` | `generate-ai/route.ts` lines 30-178 | Context building + AI call + OZON trim + draft save (~150 LOC) |

**queue-service.ts** — обёртка над telegram-helpers:

| Метод | Откуда | Комментарий |
|-------|--------|------------|
| `getQueue(params: QueueQueryParams, accessibleStoreIds)` | `queue/route.ts` lines 30-75 | Делегирует в `getUnifiedChatQueue()` + count + statusCounts |

**sequence-service.ts** — объединяет 3 routes:

| Метод | Откуда | LOC inline → service |
|-------|--------|---------------------|
| `getStatus(chatId, accessibleStoreIds)` | `sequence/route.ts` lines 28-57 | Auth check + active/latest fetch + mapping (~30 LOC) |
| `start(chatId, params, accessibleStoreIds)` | `sequence/start/route.ts` lines 46-201 | Type resolution + resume + dedup + immediate send (~160 LOC) |
| `stop(chatId, accessibleStoreIds)` | `sequence/stop/route.ts` lines 27-45 | Auth check + find active + stop (~20 LOC) |

**chat-status-service.ts** — из 1 route:

| Метод | Откуда | LOC inline → service |
|-------|--------|---------------------|
| `changeStatus(chatId, request, accessibleStoreIds)` | `status/route.ts` lines 45-131 | Validation + update + sequence stopping (~90 LOC) |

**message-sender.ts** — shared utility (устраняет дублирование):

| Метод | Откуда дублируется | Где используется после |
|-------|-------------------|-----------------------|
| `sendMessageToMarketplace(storeId, chatId, message)` | `send/route.ts` lines 54-93 (WB/OZON dispatch) + `auto-sequence-sender.ts` lines 46-54 | `chat-service.sendMessage()`, `auto-sequence-sender.ts` |

#### Migration Steps (порядок критичен)

**Step 1.1 — message-sender.ts (foundation)**
1. Создать `src/core/services/message-sender.ts`
2. Извлечь marketplace dispatch из `send/route.ts` (lines 54-93):
   - WB: FormData + fetch to buyer-chat-api
   - OZON: createOzonClient + sendChatMessage + error code 7 handling
3. Функция: `sendMessageToMarketplace(store, chatId, message) → { sent, error?, errorCode? }`
4. Обновить `send/route.ts` — заменить inline dispatch на вызов `sendMessageToMarketplace()`
5. Обновить `auto-sequence-sender.ts` — заменить inline dispatch на вызов `sendMessageToMarketplace()`
6. **Smoke test:** отправить сообщение через TMA + дождаться cron sequence send

**Step 1.2 — chat-service.ts (самый сложный)**
1. Создать `src/core/services/chat-service.ts`
2. Метод `getChatDetail()`:
   - Перенести 6-table JOIN из `chats/[chatId]/route.ts` lines 27-45
   - Перенести message fetch + synthesis из lines 54-94
   - Return type: `ChatDetailDTO` (из Stage 0)
3. Метод `generateReply()`:
   - Перенести context building из `generate-ai/route.ts` lines 53-144
   - **Одновременно:** проверить web equivalent (`api/stores/.../generate-ai/route.ts`) — та же логика на lines 53-134
   - Единая реализация context building в service
   - Вызов `generateChatReply()` + OZON trim + draft save
   - Return type: `GenerateAiResponse`
4. Метод `sendMessage()`:
   - Auth check (getAccessibleStoreIds → verify chatId belongs to accessible store)
   - Вызов `sendMessageToMarketplace()` (из Step 1.1)
   - Status update → `in_progress`
   - Draft clear
   - Sequence pause check
5. Обновить TMA routes:
   - `chats/[chatId]/route.ts` → `chatService.getChatDetail(chatId, storeIds)` + response mapping
   - `generate-ai/route.ts` → `chatService.generateReply(chatId, storeIds)` + response mapping
   - `send/route.ts` → `chatService.sendMessage(chatId, message, storeIds)` + response mapping
6. **Smoke test:** открыть чат в TMA → загрузить сообщения → сгенерировать AI ответ → отправить

**Step 1.3 — sequence-service.ts**
1. Создать `src/core/services/sequence-service.ts`
2. Перенести логику из 3 routes:
   - `getStatus()` из `sequence/route.ts`
   - `start()` из `sequence/start/route.ts` (type resolution + resume + dedup + immediate send)
   - `stop()` из `sequence/stop/route.ts`
3. Обновить 3 TMA routes → thin-handlers
4. **Smoke test:** запустить sequence → проверить немедленную отправку → остановить

**Step 1.4 — chat-status-service.ts**
1. Создать `src/core/services/chat-status-service.ts`
2. Перенести из `status/route.ts`:
   - Valid statuses/tags/completion_reasons constants
   - Validation logic
   - `validateTransition()` call
   - Dynamic update assembly
   - Sequence stopping on tag change / status change
3. Обновить TMA `status/route.ts` → thin-handler
4. **(Опционально)** обновить web `api/stores/.../status/route.ts` → тот же service
5. **Smoke test:** сменить статус → проверить sequence stop → закрыть с completion_reason

**Step 1.5 — queue-service.ts**
1. Создать `src/core/services/queue-service.ts`
2. Обёртка: принимает typed `QueueQueryParams`, возвращает typed `QueueResponse`
3. Делегирует в `telegram-helpers.ts` (getUnifiedChatQueue, getUnifiedChatQueueCount, getUnifiedChatQueueCountsByStatus)
4. Обновить TMA `queue/route.ts` → thin-handler
5. **Smoke test:** открыть очередь → фильтры → пагинация

#### Затрагиваемые файлы

| Файл | Действие |
|------|---------|
| `src/core/services/message-sender.ts` | **NEW** |
| `src/core/services/chat-service.ts` | **NEW** |
| `src/core/services/sequence-service.ts` | **NEW** |
| `src/core/services/chat-status-service.ts` | **NEW** |
| `src/core/services/queue-service.ts` | **NEW** |
| `src/app/api/telegram/chats/[chatId]/route.ts` | **TOUCH** — заменить inline JOIN → chatService.getChatDetail() |
| `src/app/api/telegram/chats/[chatId]/send/route.ts` | **TOUCH** — заменить inline dispatch → chatService.sendMessage() |
| `src/app/api/telegram/chats/[chatId]/generate-ai/route.ts` | **TOUCH** — заменить context building → chatService.generateReply() |
| `src/app/api/telegram/chats/[chatId]/status/route.ts` | **TOUCH** — заменить inline logic → chatStatusService.changeStatus() |
| `src/app/api/telegram/chats/[chatId]/sequence/route.ts` | **TOUCH** — заменить → sequenceService.getStatus() |
| `src/app/api/telegram/chats/[chatId]/sequence/start/route.ts` | **TOUCH** — заменить → sequenceService.start() |
| `src/app/api/telegram/chats/[chatId]/sequence/stop/route.ts` | **TOUCH** — заменить → sequenceService.stop() |
| `src/app/api/telegram/queue/route.ts` | **TOUCH** — заменить → queueService.getQueue() |
| `src/lib/auto-sequence-sender.ts` | **TOUCH** — заменить inline WB/OZON dispatch → sendMessageToMarketplace() |
| `src/app/api/stores/[storeId]/chats/[chatId]/generate-ai/route.ts` | **TOUCH** (опц.) — заменить context building → chatService.generateReply() |

**НЕ трогаем на этом этапе:**
- `src/app/api/telegram/auth/verify/route.ts` — уже тонкий (64 LOC, нет raw SQL)
- `src/app/api/telegram/auth/login/route.ts` — уже тонкий (64 LOC, нет raw SQL)

#### DoD

- [ ] Каждый из 8 TMA routes (кроме auth/verify и auth/login) ≤50 LOC
- [ ] Ни один TMA route не содержит `import { query } from '@/db/client'`
- [ ] Ни один TMA route не содержит `import * as dbHelpers from '@/db/helpers'`
- [ ] AI context building — единственная реализация в `chat-service.ts` (не дублируется)
- [ ] Marketplace dispatch — единственная реализация в `message-sender.ts`
- [ ] Web `generate-ai` route (опционально) тоже использует `chatService.generateReply()`
- [ ] Все services имеют typed return values из `@/core/contracts/`

#### Risks & Rollback

| Риск | Вероятность | Митигация |
|------|------------|----------|
| Регрессия в AI generation (context building) | **Средняя** | Smoke test: сгенерировать ответ для WB 1-3★, WB 4-5★, OZON; сравнить с текущим |
| Регрессия в marketplace dispatch (OZON error codes) | **Средняя** | Smoke test: отправить сообщение OZON-магазину; проверить error code 7 handling |
| Sequence immediate send сломается | **Низкая** | Smoke test: запустить sequence → проверить 1-е сообщение в чате WB |
| Merge conflicts в helpers.ts | **Низкая** | Мы НЕ меняем helpers.ts на этом этапе — только перестаём импортировать из routes |

**Rollback:** Git revert по Step (каждый step = отдельный commit). Services — additive; routes — замена imports + inline code на service calls. Revert восстанавливает inline код.

#### Тесты

| Тест | Тип | Критичность |
|------|-----|------------|
| `chatService.generateReply()` для WB 1-3★ chat | Smoke | Critical |
| `chatService.generateReply()` для WB 4-5★ chat (no compensation) | Smoke | Critical |
| `chatService.generateReply()` для OZON chat (1000-char trim) | Smoke | Critical |
| `chatService.sendMessage()` WB | Smoke | Critical |
| `chatService.sendMessage()` OZON + error code 7 | Smoke | High |
| `sequenceService.start()` default 30d + immediate send | Smoke | Critical |
| `sequenceService.start()` tag-based (offer_reminder) | Smoke | High |
| `sequenceService.stop()` manual | Smoke | Medium |
| `chatStatusService.changeStatus()` with completion_reason | Smoke | High |
| `chatStatusService.changeStatus()` tag change → sequence stop | Smoke | High |
| `queueService.getQueue()` with all filters | Smoke | Medium |
| `auto-sequence-sender.ts` cron sends via `sendMessageToMarketplace()` | Integration | Critical |

---

### Stage 2 — Repositories / DB Boundary

**Цель:** Вынести raw SQL из services в repository-слой. Services оперируют typed methods, не SQL-строками. `query()` из `@/db/client` используется ТОЛЬКО в repositories.

#### Новые файлы

```
src/db/repositories/
├── chat-repository.ts        ← getChatWithEnrichedData(), getMessages(), updateDraft(), updateStatus()
├── sequence-repository.ts    ← create(), getActive(), getLatest(), stop(), resume(), hasCompletedFamily()
├── store-repository.ts       ← getById(), getCredentials()
└── index.ts                  ← barrel export
```

#### Что вынести

**chat-repository.ts:**

| Метод | Откуда SQL | Что содержит |
|-------|-----------|-------------|
| `getChatWithEnrichedData(chatId, storeIds)` | `chat-service.getChatDetail()` (бывший `chats/[chatId]/route.ts` JOIN) | 6-table JOIN: chats → stores → review_chat_links → reviews → products → product_rules |
| `getChatMessages(chatId, limit)` | `chat-service.getChatDetail()` | Subquery DESC→ASC для хронологического порядка |
| `updateChatDraft(chatId, draft, generatedAt)` | `chat-service.generateReply()` | UPDATE chats SET draft_reply, draft_reply_generated_at |
| `updateChatAfterSend(chatId, message, timestamp)` | `chat-service.sendMessage()` | UPDATE status, last_message_*, draft_reply = null |
| `verifyChatAccess(chatId, storeIds)` | Все routes — повторяющийся pattern | SELECT 1 FROM chats WHERE id=$1 AND store_id = ANY($2) |

**sequence-repository.ts:**

| Метод | Откуда | Комментарий |
|-------|--------|------------|
| `createSequence(params)` | `sequence-service.start()` | INSERT с templates JSON |
| `getActiveForChat(chatId)` | `dbHelpers.getActiveSequenceForChat()` | Делегация в существующий helper |
| `getLatestForChat(chatId)` | `dbHelpers.getLatestSequenceForChat()` | Делегация в существующий helper |
| `stop(id, reason)` | `dbHelpers.stopSequence()` | Делегация |
| `findResumable(chatId, familyPrefix)` | `sequence-service.start()` inline query | SELECT stopped sequences with matching family |
| `hasCompletedFamily(chatId, familyPrefix)` | `sequence-service.start()` inline query | SELECT completed sequences |

**Альтернатива (выбрана: Option A):**
- **Option A:** Repositories как typed wrappers над `query()` — новые файлы, SQL переезжает из services
- **Option B:** Repositories как wrappers над существующими `db/helpers.ts` functions — меньше кода, но helpers.ts остаётся монолитом

**Выбор Option A:** repositories содержат SQL напрямую, постепенно заменяя вызовы из `db/helpers.ts`. Helpers.ts остаётся для web routes (пока не мигрированы).

#### Migration Steps

1. Создать `src/db/repositories/` directory
2. **chat-repository.ts:** Перенести SQL из `chat-service.ts` (getChatDetail JOIN, messages query, update queries) в repository methods
3. **sequence-repository.ts:** Перенести SQL из `sequence-service.ts` (create, resume, family check) + делегировать в существующие helpers для stop/getActive/getLatest
4. **store-repository.ts:** `getById()` — wrapper над `dbHelpers.getStoreById()` + `getCredentials()` для marketplace API keys
5. Обновить services: заменить `query()` и `dbHelpers.*` вызовы на repository methods
6. Проверить: services НЕ импортируют `@/db/client` и `@/db/helpers`

#### Затрагиваемые файлы

| Файл | Действие |
|------|---------|
| `src/db/repositories/chat-repository.ts` | **NEW** |
| `src/db/repositories/sequence-repository.ts` | **NEW** |
| `src/db/repositories/store-repository.ts` | **NEW** |
| `src/db/repositories/index.ts` | **NEW** |
| `src/core/services/chat-service.ts` | **TOUCH** — заменить query() → chatRepo.* |
| `src/core/services/sequence-service.ts` | **TOUCH** — заменить query() → sequenceRepo.* |
| `src/core/services/chat-status-service.ts` | **TOUCH** — заменить query() → chatRepo.verifyChatAccess() |
| `src/core/services/queue-service.ts` | **NO CHANGE** — уже делегирует в telegram-helpers |

#### DoD

- [ ] `src/core/services/*.ts` — ни один файл не содержит `import { query } from '@/db/client'`
- [ ] `src/core/services/*.ts` — ни один файл не содержит `import * as dbHelpers from '@/db/helpers'`
- [ ] Все SQL-запросы, связанные с TMA flow, живут в `src/db/repositories/`
- [ ] Repository methods имеют typed return values
- [ ] `db/helpers.ts` НЕ изменён (web routes продолжают его использовать)

#### Risks & Rollback

| Риск | Вероятность | Митигация |
|------|------------|----------|
| SQL ошибка при переносе (пропущен JOIN, неверный alias) | **Средняя** | Перенос copy-paste + smoke test каждого endpoint |
| Двойной maintenance: repositories + helpers.ts | **Низкая** | Repositories для TMA; helpers.ts для web — пересечение минимально |

**Rollback:** Git revert → services возвращаются к прямым query() вызовам.

#### Тесты

- Те же smoke tests что в Stage 1 (regression check)
- Дополнительно: проверить что query count не увеличился (N+1 не появились)

---

### Stage 3 — Observability

**Цель:** Структурированные логи, health check, базовая метрика latency. Различимость TMA vs Web vs Cron в логах.

#### Новые файлы

```
src/core/
├── logger.ts                    ← createLogger(source), structured JSON output
└── middleware/
    └── tma-request-logger.ts    ← latency logging для TMA routes
```

```
src/app/api/telegram/
└── health/route.ts              ← /api/telegram/health endpoint
```

#### Implementation

**logger.ts:**
```
createLogger(source: 'TMA' | 'WEB' | 'CRON' | 'BOT') → { info(), warn(), error() }
Output: JSON { timestamp, source, level, message, ...meta }
```
- Заменить `console.log` в TMA services на `logger.info()`
- Prefix автоматический: `[TMA] Chat 123: generateReply started`

**tma-request-logger.ts:**
- Middleware wrapper для TMA routes
- Логирует: method, path, duration_ms, status_code, userId
- Формат: `[TMA] POST /api/telegram/chats/abc/send 200 45ms user=xyz`

**health/route.ts:**
- `GET /api/telegram/health`
- Checks: DB connectivity (SELECT 1), response time
- Returns: `{ status: 'ok', db: 'connected', latency_ms: 3 }`

#### Затрагиваемые файлы

| Файл | Действие |
|------|---------|
| `src/core/logger.ts` | **NEW** |
| `src/core/middleware/tma-request-logger.ts` | **NEW** |
| `src/app/api/telegram/health/route.ts` | **NEW** |
| `src/core/services/*.ts` (5 файлов) | **TOUCH** — заменить console.log → logger.* |
| 10 TMA routes | **TOUCH** — добавить request logger wrapper (опционально) |

#### DoD

- [ ] Все TMA-related логи содержат prefix `[TMA]`
- [ ] `/api/telegram/health` возвращает 200 + DB check
- [ ] Request latency логируется для каждого TMA API вызова
- [ ] `pm2 logs wb-reputation | grep '\[TMA\]'` показывает только TMA логи

#### Risks & Rollback

- **Минимальные.** Additive changes only.
- **Rollback:** Удалить logger + health route; вернуть console.log.

---

### Stage 4 — Подготовка к separation (Optional)

**Цель:** Если в будущем решим вынести TMA в отдельный сервис (Option B из аудита), подготовить API stability layer.

#### Что нужно подготовить

1. **API versioning header:** `X-TMA-API-Version: 1` в ответах TMA routes
2. **OpenAPI spec для TMA:** автогенерация из contracts (Stage 0 types → OpenAPI schema)
3. **Auth token separation:** TMA-specific JWT scope (`scope: 'tma'`) vs web JWT
4. **CORS configuration:** отдельные allowed origins для TMA WebApp domain

#### Когда делать

Запускать Stage 4 только при выполнении одного из условий:
- Появляется 2-й consumer TMA API (другой mini-app, mobile app)
- Команда TMA > 2 человек
- Принято решение о separate deployment

#### DoD

- [ ] TMA endpoints возвращают `X-TMA-API-Version` header
- [ ] OpenAPI spec для TMA endpoints доступен по `/api/telegram/openapi.json`
- [ ] TMA JWT содержит `scope: 'tma'`
- [ ] CORS для TMA endpoints настроен отдельно от web

---

## 3. Architecture Guardrails

### 3.1 Import Boundaries (enforceable)

```
# Enforcement: ESLint rule (no-restricted-imports) или manual review

# TMA routes МОГУТ:
src/app/api/telegram/**  →  @/core/services/*       ✅
src/app/api/telegram/**  →  @/core/contracts/*       ✅
src/app/api/telegram/**  →  @/lib/telegram-auth      ✅

# TMA routes НЕ МОГУТ:
src/app/api/telegram/**  →  @/db/*                   ❌
src/app/api/telegram/**  →  @/ai/*                   ❌
src/app/api/telegram/**  →  @/lib/ozon-api           ❌
src/app/api/telegram/**  →  @/lib/auto-sequence-*    ❌
src/app/api/telegram/**  →  @/lib/chat-transitions   ❌

# Services МОГУТ:
src/core/services/**     →  @/db/repositories/*      ✅
src/core/services/**     →  @/ai/flows/*             ✅
src/core/services/**     →  @/lib/* (utilities)      ✅
src/core/services/**     →  @/core/contracts/*       ✅

# Services НЕ МОГУТ:
src/core/services/**     →  @/db/client              ❌
src/core/services/**     →  @/db/helpers             ❌ (постепенно)

# Repositories МОГУТ:
src/db/repositories/**   →  @/db/client              ✅

# Repositories НЕ МОГУТ:
src/db/repositories/**   →  @/core/services/*        ❌ (circular)
src/db/repositories/**   →  @/ai/*                   ❌
```

### 3.2 Naming Conventions

| Слой | Naming | Пример |
|------|--------|--------|
| Contracts (DTO) | `PascalCase` + суффикс `DTO`, `Request`, `Response` | `QueueItemDTO`, `SendMessageRequest` |
| Services | `kebab-case` файл, `PascalCase` class или plain functions | `chat-service.ts` → `getChatDetail()` |
| Repositories | `kebab-case` файл + суффикс `-repository` | `chat-repository.ts` → `getChatWithEnrichedData()` |
| Service methods | Imperative verb | `sendMessage()`, `startSequence()`, `changeStatus()` |
| Repository methods | Data-centric verb | `getChatWithEnrichedData()`, `updateDraft()`, `createSequence()` |

### 3.3 Где лежат types/DTO

| Что | Где | Пример |
|-----|-----|--------|
| TMA request/response DTOs | `src/core/contracts/` | `tma-chat.ts` → `ChatDetailDTO` |
| Domain types (ChatStatus, ChatTag) | `src/db/helpers.ts` (существующие) | `ChatStatus`, `ChatTag`, `CompletionReason` |
| Repository return types | `src/db/repositories/*.ts` (co-located) | `EnrichedChat`, `ChatMessage` |
| Service param/result types | `src/core/services/*.ts` (co-located) или `contracts/` | Зависит от reuse |

### 3.4 Какие методы доступны TMA

TMA routes имеют доступ ТОЛЬКО к:

```typescript
// Auth
authenticateTgApiRequest(request) → { userId, storeIds }

// Services
chatService.getChatDetail(chatId, storeIds) → ChatDetailDTO
chatService.sendMessage(chatId, message, storeIds) → { sent: boolean }
chatService.generateReply(chatId, storeIds) → GenerateAiResponse
queueService.getQueue(params, storeIds) → QueueResponse
sequenceService.getStatus(chatId, storeIds) → SequenceInfoDTO | null
sequenceService.start(chatId, params, storeIds) → StartSequenceResponse
sequenceService.stop(chatId, storeIds) → { stopped: boolean }
chatStatusService.changeStatus(chatId, request, storeIds) → StatusChangeResponse
```

---

## 4. Тест-стратегия и Anti-Regression

### 4.1 Критичные user flows

| # | Flow | Endpoints задействованы | Приоритет |
|---|------|------------------------|-----------|
| 1 | Открыть очередь → фильтр по статусу → фильтр по рейтингу → пагинация | `GET /queue` | High |
| 2 | Открыть чат → увидеть сообщения + review data + product rules | `GET /chats/:id` | Critical |
| 3 | Сгенерировать AI ответ (WB, 1-3★, с компенсацией) | `POST /chats/:id/generate-ai` | Critical |
| 4 | Сгенерировать AI ответ (WB, 4-5★, БЕЗ компенсации) | `POST /chats/:id/generate-ai` | Critical |
| 5 | Сгенерировать AI ответ (OZON, ≤1000 символов) | `POST /chats/:id/generate-ai` | Critical |
| 6 | Отправить сообщение (WB) | `POST /chats/:id/send` | Critical |
| 7 | Отправить сообщение (OZON) + обработка error code 7 | `POST /chats/:id/send` | Critical |
| 8 | Запустить 30-дневную sequence (1-3★) → проверить immediate send | `POST /chats/:id/sequence/start` | Critical |
| 9 | Запустить tag-based sequence (offer_reminder) | `POST /chats/:id/sequence/start` | High |
| 10 | Остановить sequence вручную | `POST /chats/:id/sequence/stop` | Medium |
| 11 | Сменить статус → in_progress | `PATCH /chats/:id/status` | High |
| 12 | Закрыть чат → с completion_reason + sequence stop | `PATCH /chats/:id/status` | Critical |
| 13 | Сменить tag (deletion_offered → deletion_agreed) | `PATCH /chats/:id/status` | High |
| 14 | Cron: auto-sequence processor отправляет сообщение | Cron → `sendMessageToMarketplace()` | Critical |

### 4.2 Моки и fixtures

| Что мокать | Зачем | Как |
|-----------|-------|-----|
| WB Chat API (`buyer-chat-api.wildberries.ru`) | send flow без реального WB | `nock` или manual mock в `message-sender.ts` |
| OZON Chat API (`api-seller.ozon.ru`) | send flow без реального OZON | Mock `createOzonClient()` return |
| Deepseek API | AI generation без реального LLM | Mock `generateChatReply()` return |
| PostgreSQL | Unit tests для services | Mock repositories (dependency injection) |

**Fixtures (тестовые данные):**
- WB chat с review_chat_link (1-3★, offer_compensation=true)
- WB chat с review_chat_link (4-5★, offer_compensation=false)
- OZON chat с review_chat_link
- Chat без review_chat_link (edge case)
- Active sequence (for stop/status tests)
- Chat in each status (awaiting_reply, inbox, in_progress, closed)

### 4.3 Smoke Checklist для деплоя

Выполнять после каждого Stage деплоя:

```
□ 1. TMA: Открыть /tg → очередь загружается, карточки отображаются
□ 2. TMA: Фильтр по статусу "Входящие" → корректный count
□ 3. TMA: Открыть чат → сообщения + review details видны
□ 4. TMA: Нажать "AI ответ" → draft появляется (WB chat)
□ 5. TMA: Отправить сообщение → "Отправлено" feedback
□ 6. TMA: Запустить sequence → "1-е сообщение отправлено"
□ 7. TMA: Остановить sequence → статус обновился
□ 8. TMA: Сменить статус → "В работе"
□ 9. TMA: Закрыть чат → modal completion_reason → "Закрыт"
□ 10. WEB: Открыть тот же чат → draft виден (если был сгенерирован из TMA)
□ 11. CRON: pm2 restart wb-reputation-cron → проверить pm2 logs что cron стартовал
□ 12. /api/telegram/health → 200 OK (после Stage 3)
```

---

## 5. Оценка усилий

### По этапам

| Stage | Effort (дни) | Что определяет сложность | Параллелизация |
|-------|-------------|--------------------------|----------------|
| **0: Contracts** | 1 | Экстракция типов из 10 routes — механическая работа | Можно параллелить с другими задачами |
| **1: Services** | 5–7 | `chat-service.generateReply()` — самый сложный (AI context, 3 marketplace paths, compensation gating). `sequence-service.start()` — второй по сложности (type resolution, resume, dedup) | Steps 1.1→1.2 последовательно; 1.3+1.4+1.5 можно параллелить |
| **2: Repositories** | 3–4 | Перенос SQL из services — механический, но требует внимания к деталям | Можно после Stage 1 полностью |
| **3: Observability** | 2 | Logger + health + request middleware — straightforward | Можно параллелить с Stage 2 |
| **4: Separation prep** | 2–3 | API versioning, OpenAPI, CORS — по необходимости | Независимый |

### Timeline

```
Week 1:  Stage 0 (1d) → Stage 1 Steps 1.1-1.2 (4d)
Week 2:  Stage 1 Steps 1.3-1.5 (3d) → Stage 2 (2d start)
Week 3:  Stage 2 (2d finish) → Stage 3 (2d) → Smoke testing (1d)
```

### Самый рискованный участок

**Stage 1, Step 1.2 — `chat-service.generateReply()`**

Причины:
1. **AI context building** — 150 LOC бизнес-логики, зависящей от review rating, marketplace, product rules, compensation gating
2. **Три пути:** WB 1-3★ (с компенсацией), WB 4-5★ (без компенсации), OZON (1000-char limit)
3. **Дублирование:** одновременно устраняется copy-paste между TMA и Web routes — ошибка ломает оба
4. **Тестирование:** нужен реальный Deepseek API вызов для smoke test (нельзя мокать в prod)

**Митигация:**
- Сначала перенести context building в service БЕЗ изменения web route (TMA-only migration)
- Smoke test TMA с реальными чатами (WB + OZON)
- Только после подтверждения — переключить web route на тот же service
- Feature flag: если `USE_CHAT_SERVICE=true` → service path; иначе → legacy inline (optional safety net)

---

## 6. File Moves / New Files — Summary Table

### NEW files

| Файл | Stage | Содержание |
|------|-------|-----------|
| `src/core/contracts/tma-auth.ts` | 0 | VerifyRequest/Response, LoginRequest/Response |
| `src/core/contracts/tma-queue.ts` | 0 | QueueQueryParams, QueueItemDTO, QueueResponse |
| `src/core/contracts/tma-chat.ts` | 0 | ChatDetailDTO, ChatMessageDTO, SendMessageRequest, GenerateAiResponse |
| `src/core/contracts/tma-status.ts` | 0 | StatusChangeRequest, StatusChangeResponse |
| `src/core/contracts/tma-sequence.ts` | 0 | SequenceInfoDTO, StartSequenceRequest, StartSequenceResponse |
| `src/core/index.ts` | 0 | Barrel export |
| `src/core/services/message-sender.ts` | 1 | sendMessageToMarketplace() — WB/OZON unified |
| `src/core/services/chat-service.ts` | 1 | getChatDetail, sendMessage, generateReply |
| `src/core/services/sequence-service.ts` | 1 | start, stop, getStatus |
| `src/core/services/chat-status-service.ts` | 1 | changeStatus |
| `src/core/services/queue-service.ts` | 1 | getQueue, getQueueCounts |
| `src/db/repositories/chat-repository.ts` | 2 | SQL: enriched chat, messages, updates |
| `src/db/repositories/sequence-repository.ts` | 2 | SQL: create, resume, family check |
| `src/db/repositories/store-repository.ts` | 2 | SQL: getById, getCredentials |
| `src/db/repositories/index.ts` | 2 | Barrel export |
| `src/core/logger.ts` | 3 | createLogger(source) |
| `src/core/middleware/tma-request-logger.ts` | 3 | Request latency logging |
| `src/app/api/telegram/health/route.ts` | 3 | Health check endpoint |

**Total new files: 18**

### TOUCH (modify existing)

| Файл | Stage | Что меняется |
|------|-------|-------------|
| `src/app/api/telegram/chats/[chatId]/route.ts` (131 LOC → ~30) | 1 | inline JOIN → chatService.getChatDetail() |
| `src/app/api/telegram/chats/[chatId]/send/route.ts` (120 LOC → ~25) | 1 | inline dispatch → chatService.sendMessage() |
| `src/app/api/telegram/chats/[chatId]/generate-ai/route.ts` (189 LOC → ~25) | 1 | context building → chatService.generateReply() |
| `src/app/api/telegram/chats/[chatId]/status/route.ts` (137 LOC → ~30) | 1 | validation + logic → chatStatusService.changeStatus() |
| `src/app/api/telegram/chats/[chatId]/sequence/route.ts` (64 LOC → ~20) | 1 | fetch + mapping → sequenceService.getStatus() |
| `src/app/api/telegram/chats/[chatId]/sequence/start/route.ts` (207 LOC → ~30) | 1 | type resolution + send → sequenceService.start() |
| `src/app/api/telegram/chats/[chatId]/sequence/stop/route.ts` (53 LOC → ~20) | 1 | fetch + stop → sequenceService.stop() |
| `src/app/api/telegram/queue/route.ts` (90 LOC → ~25) | 1 | param parsing → queueService.getQueue() |
| `src/lib/auto-sequence-sender.ts` (102 LOC) | 1 | inline WB/OZON dispatch → sendMessageToMarketplace() |
| `src/app/api/stores/[storeId]/chats/[chatId]/generate-ai/route.ts` (190 LOC → ~25) | 1 (опц.) | context building → chatService.generateReply() |
| `src/core/services/chat-service.ts` | 2 | query() → chatRepo.* |
| `src/core/services/sequence-service.ts` | 2 | query() → sequenceRepo.* |
| `src/core/services/chat-status-service.ts` | 2 | query() → chatRepo.verifyChatAccess() |
| `src/core/services/*.ts` (5 files) | 3 | console.log → logger.* |

### NOT TOUCHED

| Файл | Причина |
|------|--------|
| `src/app/api/telegram/auth/verify/route.ts` | Уже тонкий (64 LOC), нет raw SQL, нет domain logic |
| `src/app/api/telegram/auth/login/route.ts` | Уже тонкий (64 LOC), нет raw SQL |
| `src/db/helpers.ts` | Web routes продолжают использовать; рефакторинг — отдельная задача |
| `src/db/telegram-helpers.ts` | queue-service делегирует в него; SQL остаётся |
| `src/lib/telegram-auth.ts` | Auth layer не меняется |
| `src/lib/telegram-auth-context.tsx` | Frontend auth не меняется |
| `src/lib/telegram-notifications.ts` | Notification hook не связан с route refactoring |
| `scripts/start-telegram-bot.js` | Standalone process, вне scope |

### LOC Impact

| Метрика | До | После |
|---------|-----|-------|
| TMA routes total LOC | ~1119 | ~230 |
| New services LOC | 0 | ~500 |
| New repositories LOC | 0 | ~300 |
| New contracts LOC | 0 | ~100 |
| New infra (logger, middleware, health) | 0 | ~100 |
| `auto-sequence-sender.ts` LOC | 102 | ~70 (dispatch extracted) |
| **Net new LOC** | | **~+80** (дублирование устранено) |
