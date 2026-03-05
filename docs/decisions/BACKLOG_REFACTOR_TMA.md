# BACKLOG_REFACTOR_TMA.md — Backlog рефакторинга TMA (Stage 0–3)

> **Дата:** 2026-03-05
> **Prerequisite:** [REFACTOR_PLAN_TMA_BFF.md](REFACTOR_PLAN_TMA_BFF.md) (утверждён)
> **Формат:** Каждая задача = 1 PR. Строгий порядок по зависимостям.

---

## Golden Test Chats (обязательно для smoke)

Перед началом работ зафиксировать 3 реальных чата для regression-проверки:

| ID | Маркетплейс | Рейтинг | Зачем |
|----|------------|---------|-------|
| **GOLDEN-WB-LOW** | WB | 1–3★ | Компенсация предлагается, deletion offer path |
| **GOLDEN-WB-HIGH** | WB | 4–5★ | Компенсация НЕ предлагается, "повышение до 5★" |
| **GOLDEN-OZON** | OZON | любой | 1000-символов лимит, OZON API dispatch |

**Как зафиксировать:** Перед PR-01 записать в `docs/decisions/golden-test-chats.md`:
- chat_id каждого чата
- Текущий draft_reply (snapshot текста, который генерирует AI)
- Текущий response JSON из `GET /api/telegram/chats/{chatId}`
- Текущий response JSON из `GET /api/telegram/queue?status=all&limit=5`

Эти snapshots используются как baseline при smoke-тестировании каждого PR.

---

## Задачи (15 PR)

### PR-01: Contracts & DTO types

**Stage:** 0
**Scope:** Создать typed interfaces для всех 10 TMA endpoints. Зафиксировать golden test snapshots.

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/contracts/tma-auth.ts` | NEW |
| `src/core/contracts/tma-queue.ts` | NEW |
| `src/core/contracts/tma-chat.ts` | NEW |
| `src/core/contracts/tma-status.ts` | NEW |
| `src/core/contracts/tma-sequence.ts` | NEW |
| `src/core/index.ts` | NEW — barrel export |
| `docs/decisions/golden-test-chats.md` | NEW — snapshots 3 golden chats |

**DoD:**
- [ ] 5 contract файлов с typed interfaces для request/response каждого TMA endpoint
- [ ] `QueueItemDTO` покрывает все поля из `getUnifiedChatQueue()` result
- [ ] `ChatDetailDTO` покрывает все поля из `chats/[chatId]/route.ts` response
- [ ] `StartSequenceResponse` покрывает resumeInfo + immediateSent + sequenceType
- [ ] `npx tsc --noEmit` проходит (новые файлы компилируются)
- [ ] Golden test snapshots записаны для 3 чатов
- [ ] Ни один существующий файл не изменён

**Smoke:** Нет (type-only, zero runtime impact)

**Risk:** Минимальный. Типы могут не совпасть с реальным runtime — ловится на PR-03..PR-10.
**Rollback:** `rm -rf src/core/`

---

### PR-02: Extract sendMessageToMarketplace

**Stage:** 1 (foundation)
**Scope:** Выделить marketplace dispatch (WB/OZON) в единый shared utility. Устранить дублирование между `send/route.ts` и `auto-sequence-sender.ts`.

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/message-sender.ts` | NEW — `sendMessageToMarketplace(store, chatId, message)` |
| `src/lib/auto-sequence-sender.ts` (102 LOC) | TOUCH — заменить inline WB/OZON dispatch → import `sendMessageToMarketplace` |

**DoD:**
- [ ] `sendMessageToMarketplace()` принимает store (с marketplace, credentials), chatId, message text
- [ ] Возвращает `{ sent: boolean; error?: string; errorCode?: number }`
- [ ] Обрабатывает WB path: FormData + fetch to buyer-chat-api + replySign
- [ ] Обрабатывает OZON path: createOzonClient + sendChatMessage + error code 7 → errorCode
- [ ] `auto-sequence-sender.ts` использует `sendMessageToMarketplace()` вместо inline dispatch
- [ ] Cron sequence send работает (PM2 restart cron → дождаться scheduled send)

**Smoke:**
- [ ] Cron: `pm2 restart wb-reputation-cron` → дождаться sequence message send → проверить в pm2 logs отсутствие ошибок
- [ ] (Опционально) Если есть тестовый чат с active sequence — проверить что следующее сообщение доставлено

**Risk:** Средний — ломает cron sequence sending если API dispatch неверен.
**Rollback:** Revert PR. `auto-sequence-sender.ts` возвращается к inline dispatch.

---

### PR-03: ChatService.getChatDetail + thin route

**Stage:** 1
**Scope:** Перенести 6-table JOIN + message synthesis из `chats/[chatId]/route.ts` (130 LOC) в `ChatService.getChatDetail()`. Route → thin handler.

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/chat-service.ts` | NEW — метод `getChatDetail(chatId, accessibleStoreIds)` |
| `src/app/api/telegram/chats/[chatId]/route.ts` (130 LOC → ~25) | TOUCH — auth + `chatService.getChatDetail()` + response |

**DoD:**
- [ ] `chat-service.ts` создан с методом `getChatDetail()`
- [ ] 6-table JOIN (chats → stores → rcl → reviews → products → product_rules) перенесён из route
- [ ] Message fetch (last 200, DESC→ASC) перенесён
- [ ] Message synthesis logic (last_message_* fallback) перенесена
- [ ] Route ≤30 LOC: auth → service call → NextResponse.json()
- [ ] Route НЕ содержит `import { query } from '@/db/client'`
- [ ] Return type соответствует `ChatDetailDTO` из PR-01

**Smoke:**
- [ ] TMA: Открыть chat GOLDEN-WB-LOW → сообщения + review rating + product rules видны
- [ ] TMA: Открыть chat GOLDEN-WB-HIGH → rating 4-5★ отображается
- [ ] TMA: Открыть chat GOLDEN-OZON → OZON-specific данные видны
- [ ] Сравнить response JSON с golden snapshot — все поля совпадают

**Risk:** Средний — complex SQL (6 JOIN + marketplace-aware product matching).
**Rollback:** Revert PR → inline SQL возвращается в route.

---

### PR-04: ChatService.sendMessage + thin route

**Stage:** 1
**Depends on:** PR-02 (message-sender)
**Scope:** Перенести send logic из `send/route.ts` (119 LOC) в `ChatService.sendMessage()`. Использовать `sendMessageToMarketplace()` из PR-02.

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/chat-service.ts` | TOUCH — добавить `sendMessage(chatId, message, accessibleStoreIds)` |
| `src/app/api/telegram/chats/[chatId]/send/route.ts` (119 LOC → ~25) | TOUCH — thin handler |

**DoD:**
- [ ] `sendMessage()` добавлен в chat-service
- [ ] Использует `sendMessageToMarketplace()` из `message-sender.ts`
- [ ] После отправки: status → `in_progress`, draft_reply → null, last_message_* обновлены
- [ ] Sequence pause check перенесён (если есть active sequence — паузит)
- [ ] OZON error code 7 → 422 response (чат не активирован)
- [ ] Route ≤30 LOC
- [ ] Route НЕ содержит `import { query } from '@/db/client'`

**Smoke:**
- [ ] TMA: Отправить сообщение в WB чат → "Отправлено" → сообщение появляется в чате
- [ ] TMA: Отправить сообщение в OZON чат → "Отправлено" (или 422 если чат не начат)
- [ ] Проверить: статус чата → "В работе" после отправки
- [ ] Проверить: draft_reply очищен после отправки

**Risk:** Высокий — отправка сообщений в WB/OZON. Ошибка = потерянные сообщения.
**Rollback:** Revert PR. Route возвращается к inline dispatch.

---

### PR-05: Feature flag + ChatService.generateReply (TMA path)

**Stage:** 1
**Depends on:** PR-03 (chat-service file exists)
**Scope:** Перенести AI context building + generation из TMA `generate-ai/route.ts` (188 LOC) в `ChatService.generateReply()`. Добавить feature flag для safe rollback.

**Feature flag:**
- Env var: `TMA_USE_CHAT_SERVICE_GENERATE=true|false` (default: `true`)
- Если `false` — route использует legacy inline logic (нетронутый backup path)
- Если `true` — route вызывает `chatService.generateReply()`
- Flag удаляется в PR-11 после валидации

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/chat-service.ts` | TOUCH — добавить `generateReply(chatId, accessibleStoreIds)` |
| `src/app/api/telegram/chats/[chatId]/generate-ai/route.ts` (188 LOC → ~40 с flag) | TOUCH — feature flag: service vs legacy path |

**DoD:**
- [ ] `generateReply()` добавлен в chat-service
- [ ] AI context building (150 LOC) из route перенесён в service:
  - Message fetch + formatting + role labeling
  - Product rules + compensation gating (1-3★ vs 4-5★)
  - Review context enrichment (rating, date, trimmed text)
  - OZON-specific: "Важно: покупатель написал на OZON"
  - Conversation phase detection
  - Markdown context string assembly
- [ ] AI call: `generateChatReply()` с storeInstructions
- [ ] OZON 1000-char trim at sentence boundary
- [ ] Draft save: updateChat с generated text + timestamps
- [ ] Feature flag работает: `TMA_USE_CHAT_SERVICE_GENERATE=false` → legacy path
- [ ] Feature flag работает: `TMA_USE_CHAT_SERVICE_GENERATE=true` → service path (default)
- [ ] Compensation gating: WB 1-3★ → с компенсацией; WB 4-5★ → без; OZON → OZON-specific text

**Smoke (critical — все 3 golden chats):**
- [ ] GOLDEN-WB-LOW (1-3★): "AI ответ" → draft содержит упоминание компенсации/кешбека → сравнить с golden snapshot (смысл аналогичный, точный текст может отличаться)
- [ ] GOLDEN-WB-HIGH (4-5★): "AI ответ" → draft НЕ содержит компенсации → "повышение до 5★"
- [ ] GOLDEN-OZON: "AI ответ" → draft ≤ 1000 символов → обрезан по границе предложения
- [ ] Переключить flag `TMA_USE_CHAT_SERVICE_GENERATE=false` → повторить все 3 теста → те же результаты (legacy path)
- [ ] Переключить обратно `TMA_USE_CHAT_SERVICE_GENERATE=true`

**Risk:** Высокий — самый сложный PR. AI context building = 150 LOC бизнес-логики.
**Rollback:** Два уровня:
1. **Hot:** `TMA_USE_CHAT_SERVICE_GENERATE=false` → мгновенный откат без редеплоя (только env var)
2. **Cold:** Revert PR → route возвращается к inline context building

---

### PR-06: Web generate-ai → ChatService

**Stage:** 1
**Depends on:** PR-05 (generateReply exists and validated)
**Scope:** Переключить web dashboard `generate-ai/route.ts` (189 LOC) на тот же `ChatService.generateReply()`. Устранить дублирование ~100 LOC.

**Files:**
| Файл | Действие |
|------|---------|
| `src/app/api/stores/[storeId]/chats/[chatId]/generate-ai/route.ts` (189 LOC → ~30) | TOUCH — thin handler → chatService.generateReply() |

**DoD:**
- [ ] Web route использует `chatService.generateReply()`
- [ ] Route ≤35 LOC (auth отличается от TMA — storeId из URL, middleware auth)
- [ ] Дублирование AI context building устранено: единственная реализация в chat-service
- [ ] Web dashboard: AI генерация работает идентично для WB и OZON чатов

**Smoke:**
- [ ] Web dashboard: Открыть WB чат → "Сгенерировать ответ" → draft появляется
- [ ] Web dashboard: Открыть OZON чат → draft ≤1000 символов
- [ ] TMA: Повторить все 3 golden chat теста (regression check после shared service)

**Risk:** Средний — web route теперь зависит от service. Ошибка в service ломает оба канала.
**Rollback:** Revert PR → web route возвращается к inline логике. TMA остаётся на service (не затрагивается).

---

### PR-07: QueueService + thin route

**Stage:** 1
**Depends on:** PR-01 (contracts)
**Scope:** Обёртка над `telegram-helpers.ts` functions. Route (89 LOC → ~25).

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/queue-service.ts` | NEW — `getQueue(params, accessibleStoreIds)` |
| `src/app/api/telegram/queue/route.ts` (89 LOC → ~25) | TOUCH — thin handler |

**DoD:**
- [ ] `QueueService.getQueue()` принимает typed `QueueQueryParams`, возвращает typed `QueueResponse`
- [ ] Делегирует в `getUnifiedChatQueue()`, `getUnifiedChatQueueCount()`, `getUnifiedChatQueueCountsByStatus()` из `telegram-helpers.ts`
- [ ] Query param parsing + validation (limit, offset, status, storeIds, ratings) в service
- [ ] Route ≤25 LOC: auth → service → response
- [ ] Route НЕ содержит inline param parsing logic

**Smoke:**
- [ ] TMA: Открыть /tg → очередь загружается, карточки отображаются
- [ ] TMA: Фильтр "Входящие" → корректный count в badge
- [ ] TMA: Фильтр "1-2★" → только чаты с низким рейтингом
- [ ] TMA: Пагинация → следующие 50 чатов

**Risk:** Низкий — queue-service это thin wrapper, SQL остаётся в telegram-helpers.
**Rollback:** Revert PR → route возвращается к inline parsing.

---

### PR-08: SequenceService — getStatus + stop + thin routes

**Stage:** 1
**Depends on:** PR-01 (contracts)
**Scope:** Создать SequenceService с простыми методами getStatus/stop. Две самые лёгкие routes (63 + 52 LOC).

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/sequence-service.ts` | NEW — `getStatus()`, `stop()` |
| `src/app/api/telegram/chats/[chatId]/sequence/route.ts` (63 LOC → ~20) | TOUCH — thin handler |
| `src/app/api/telegram/chats/[chatId]/sequence/stop/route.ts` (52 LOC → ~20) | TOUCH — thin handler |

**DoD:**
- [ ] `sequence-service.ts` создан
- [ ] `getStatus(chatId, storeIds)`: auth check → getActive/getLatest → return `SequenceInfoDTO`
- [ ] `stop(chatId, storeIds)`: auth check → find active (404 if none) → `stopSequence(id, 'manual')` → log
- [ ] Оба route ≤20 LOC
- [ ] Routes НЕ содержат `import { query } from '@/db/client'`

**Smoke:**
- [ ] TMA: Открыть чат с active sequence → статус sequence отображается (шаг X из Y)
- [ ] TMA: Нажать "Остановить рассылку" → sequence stopped → UI обновился

**Risk:** Низкий — простая экстракция, minimal business logic.
**Rollback:** Revert PR.

---

### PR-09: SequenceService.start + thin route

**Stage:** 1
**Depends on:** PR-02 (message-sender), PR-08 (sequence-service file exists)
**Scope:** Перенести самый сложный sequence route (206 LOC) в service. Three-tier type resolution + resume + dedup + immediate send.

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/sequence-service.ts` | TOUCH — добавить `start(chatId, params, accessibleStoreIds)` |
| `src/app/api/telegram/chats/[chatId]/sequence/start/route.ts` (206 LOC → ~30) | TOUCH — thin handler |

**DoD:**
- [ ] `start()` добавлен в sequence-service
- [ ] Three-tier type resolution перенесён:
  - Requested type in `TAG_SEQUENCE_CONFIG` → tag-based
  - Requested type is sequenceType name → reverse-lookup
  - Default → rating-based (4★ vs 1-3★)
- [ ] Resume path: `findResumableSequence()` → `resumeSequence()` → status back to awaiting_reply
- [ ] Family dedup: `hasCompletedSequenceFamily()` → 409 if family already completed
- [ ] Immediate send via `sendSequenceMessage()` → may fail (cron fallback)
- [ ] Chat status update → `awaiting_reply`
- [ ] Return type: `StartSequenceResponse` (sequenceType, immediateSent, resumeInfo)
- [ ] Route ≤30 LOC
- [ ] Route НЕ содержит `import { query } from '@/db/client'`

**Smoke:**
- [ ] TMA: Запустить 30-дневную sequence на WB чат (1-3★) → "1-е сообщение отправлено"
- [ ] TMA: Запустить 30-дневную sequence на WB чат (4★) → другой шаблон, "1-е сообщение отправлено"
- [ ] TMA: Запустить tag-based sequence (offer_reminder) → "1-е сообщение отправлено"
- [ ] TMA: Попробовать запустить вторую sequence → 409 "уже есть активная"
- [ ] Проверить: статус чата → "Ожидание" после старта

**Risk:** Высокий — type resolution + immediate send. Ошибка = sequence не стартует или стартует с неверным шаблоном.
**Rollback:** Revert PR → route возвращается к inline logic.

---

### PR-10: ChatStatusService + thin route

**Stage:** 1
**Depends on:** PR-01 (contracts), PR-08 (sequence-service для stopSequence)
**Scope:** Перенести status/tag change logic из route (136 LOC) в ChatStatusService.

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/services/chat-status-service.ts` | NEW — `changeStatus(chatId, request, accessibleStoreIds)` |
| `src/app/api/telegram/chats/[chatId]/status/route.ts` (136 LOC → ~25) | TOUCH — thin handler |

**DoD:**
- [ ] `chat-status-service.ts` создан
- [ ] `changeStatus()` содержит:
  - Valid statuses/tags/completion_reasons constants
  - Input validation (completion_reason required for closed)
  - Tag whitelist check (manually settable tags only)
  - `validateTransition()` call
  - Dynamic update assembly (status, tag, completion_reason, status_updated_at)
  - Sequence stopping logic:
    - Tag change → stop if family mismatch
    - Closing or leaving awaiting_reply → stop with reason
- [ ] Return type: `StatusChangeResponse` (success, tag?, sequenceStopped?)
- [ ] Route ≤25 LOC
- [ ] Route НЕ содержит `import { query } from '@/db/client'`

**Smoke:**
- [ ] TMA: Сменить статус → "В работе" → UI обновился
- [ ] TMA: Сменить tag (deletion_offered → deletion_agreed) → badge обновился
- [ ] TMA: Закрыть чат → modal completion_reason → "Закрыт"
- [ ] TMA: Закрыть чат с active sequence → sequence stopped автоматически

**Risk:** Средний — tag/status validation, sequence stopping logic.
**Rollback:** Revert PR.

---

### PR-11: Remove generateReply feature flag

**Stage:** 1 (cleanup)
**Depends on:** PR-05, PR-06 (оба пути через service, валидированы в проде)
**Scope:** Удалить feature flag `TMA_USE_CHAT_SERVICE_GENERATE`. TMA route → только service path.

**Timing:** Выполнять минимум через 3 дня после деплоя PR-06. Дождаться нескольких daily cycles, убедиться что AI generation стабильна.

**Files:**
| Файл | Действие |
|------|---------|
| `src/app/api/telegram/chats/[chatId]/generate-ai/route.ts` (~40 LOC → ~25) | TOUCH — убрать if/else flag, оставить только service path |

**DoD:**
- [ ] Env var `TMA_USE_CHAT_SERVICE_GENERATE` больше не используется
- [ ] Route содержит только service path (legacy inline code удалён)
- [ ] Route ≤25 LOC
- [ ] All 3 golden chat smoke tests pass

**Smoke:**
- [ ] GOLDEN-WB-LOW: AI ответ с компенсацией ✓
- [ ] GOLDEN-WB-HIGH: AI ответ без компенсации ✓
- [ ] GOLDEN-OZON: AI ответ ≤1000 символов ✓

**Risk:** Минимальный — удаление уже-неиспользуемого code path.
**Rollback:** Revert PR → flag возвращается.

---

### PR-12: ChatRepository

**Stage:** 2
**Depends on:** PR-03, PR-04, PR-05 (chat-service exists with inline SQL)
**Scope:** Вынести SQL из chat-service в ChatRepository. Service → typed method calls.

**Files:**
| Файл | Действие |
|------|---------|
| `src/db/repositories/chat-repository.ts` | NEW |
| `src/db/repositories/index.ts` | NEW — barrel export |
| `src/core/services/chat-service.ts` | TOUCH — заменить query() → chatRepo.* |

**DoD:**
- [ ] `chat-repository.ts` создан с методами:
  - `getChatWithEnrichedData(chatId, storeIds)` — 6-table JOIN
  - `getChatMessages(chatId, limit)` — subquery DESC→ASC
  - `updateChatDraft(chatId, draft, generatedAt)` — UPDATE draft_reply
  - `updateChatAfterSend(chatId, message, timestamp)` — UPDATE status, last_message_*
  - `verifyChatAccess(chatId, storeIds)` — SELECT 1 access check
- [ ] `chat-service.ts` НЕ содержит `import { query } from '@/db/client'`
- [ ] `chat-service.ts` НЕ содержит SQL-строк
- [ ] Все repository methods имеют typed return values

**Smoke:**
- [ ] Все 3 golden chat tests pass (getChatDetail, generateReply, sendMessage)

**Risk:** Средний — SQL перенос, возможна ошибка в JOIN aliases.
**Rollback:** Revert PR → chat-service возвращается к inline query().

---

### PR-13: SequenceRepository + StoreRepository

**Stage:** 2
**Depends on:** PR-08, PR-09 (sequence-service exists)
**Scope:** Вынести SQL из sequence-service и chat-status-service в repositories.

**Files:**
| Файл | Действие |
|------|---------|
| `src/db/repositories/sequence-repository.ts` | NEW |
| `src/db/repositories/store-repository.ts` | NEW |
| `src/db/repositories/index.ts` | TOUCH — добавить exports |
| `src/core/services/sequence-service.ts` | TOUCH — query() → sequenceRepo.* |
| `src/core/services/chat-status-service.ts` | TOUCH — query() → chatRepo.verifyChatAccess() |

**DoD:**
- [ ] `sequence-repository.ts` создан:
  - `createSequence(params)` — INSERT с templates JSON
  - `findResumable(chatId, familyPrefix)` — SELECT stopped sequences
  - `hasCompletedFamily(chatId, familyPrefix)` — SELECT completed
  - Делегация в существующие helpers: `getActiveSequenceForChat`, `getLatestSequenceForChat`, `stopSequence`
- [ ] `store-repository.ts` создан:
  - `getById(storeId)` — wrapper
  - `getCredentials(storeId)` — marketplace API keys
- [ ] Оба service файла НЕ содержат `import { query } from '@/db/client'`
- [ ] Оба service файла НЕ содержат `import * as dbHelpers from '@/db/helpers'`

**Smoke:**
- [ ] Запустить sequence → immediate send → проверить в чате
- [ ] Остановить sequence → stopped
- [ ] Сменить статус → sequence auto-stopped

**Risk:** Средний — sequence create SQL + resume logic.
**Rollback:** Revert PR.

---

### PR-14: Import boundary enforcement

**Stage:** 2 (cleanup)
**Depends on:** PR-12, PR-13
**Scope:** Проверить и зафиксировать, что все import boundaries соблюдены. Добавить ESLint rule или documented check.

**Files:**
| Файл | Действие |
|------|---------|
| `.eslintrc.json` или `eslint.config.mjs` | TOUCH — добавить `no-restricted-imports` rule для `src/app/api/telegram/` |
| `docs/decisions/REFACTOR_PLAN_TMA_BFF.md` | TOUCH — обновить статус Stage 2: Done |

**DoD:**
- [ ] Ни один файл в `src/app/api/telegram/` не импортирует `@/db/client`, `@/db/helpers`, `@/ai/*`, `@/lib/ozon-api`
- [ ] Ни один файл в `src/core/services/` не импортирует `@/db/client` или `@/db/helpers`
- [ ] ESLint rule (или документированный grep check) ловит нарушения
- [ ] `npx tsc --noEmit` проходит

**Smoke:** Нет (lint/compile only)

**Risk:** Минимальный.
**Rollback:** Revert ESLint rule.

---

### PR-15: Logger + TMA request logging + health endpoint

**Stage:** 3
**Depends on:** PR-03..PR-10 (services exist для замены console.log)
**Scope:** Structured logging, request latency, health check.

**Files:**
| Файл | Действие |
|------|---------|
| `src/core/logger.ts` | NEW — `createLogger(source: 'TMA'|'WEB'|'CRON'|'BOT')` |
| `src/core/middleware/tma-request-logger.ts` | NEW — latency + status code logging |
| `src/app/api/telegram/health/route.ts` | NEW — DB check + status |
| `src/core/services/chat-service.ts` | TOUCH — console.log → logger.info/error |
| `src/core/services/sequence-service.ts` | TOUCH — console.log → logger.info/error |
| `src/core/services/chat-status-service.ts` | TOUCH — console.log → logger.info/error |
| `src/core/services/queue-service.ts` | TOUCH — console.log → logger.info/error |
| `src/core/services/message-sender.ts` | TOUCH — console.log → logger.info/error |
| `docs/decisions/REFACTOR_PLAN_TMA_BFF.md` | TOUCH — обновить статус Stage 3: Done |

**DoD:**
- [ ] `createLogger('TMA')` возвращает logger с методами info/warn/error
- [ ] Формат: `[TMA] 2026-03-10 14:30:05 INFO: Chat abc123: generateReply started`
- [ ] Request logger: `[TMA] POST /api/telegram/chats/abc/send 200 45ms user=xyz`
- [ ] Все services используют logger вместо console.log
- [ ] `/api/telegram/health` → `{ status: 'ok', db: 'connected', latency_ms: 3 }`
- [ ] `pm2 logs wb-reputation | grep '\[TMA\]'` — показывает только TMA логи

**Smoke:**
- [ ] `GET /api/telegram/health` → 200
- [ ] Выполнить любое действие в TMA → проверить `[TMA]` prefix в pm2 logs
- [ ] Проверить latency logging: request duration виден в логах

**Risk:** Минимальный — additive changes.
**Rollback:** Revert PR → console.log возвращается.

---

## 3. PR Plan

### Dependency Graph

```
PR-01 (contracts)
  │
  ├───────────────┬──────────────┬──────────────┐
  ▼               ▼              ▼              ▼
PR-02           PR-03          PR-07          PR-08
(msg-sender)    (getChatDetail) (queue-svc)    (seq get+stop)
  │               │                              │
  ├───────┐       ▼                              ▼
  ▼       │     PR-05 ◄─────────────────────── PR-09
PR-04     │     (generateReply                 (seq start)
(sendMsg) │      + feature flag)                 │
          │       │                              │
          │       ▼                              │
          │     PR-06                            │
          │     (web gen-ai)                     ▼
          │       │                            PR-10
          │       ▼                            (status-svc)
          │     PR-11
          │     (remove flag)
          │
          ▼─────────────────────────────────────┐
        PR-12                                 PR-13
        (chat-repo)                           (seq+store repo)
          │                                     │
          └─────────────┬───────────────────────┘
                        ▼
                      PR-14
                      (import boundaries)
                        │
                        ▼
                      PR-15
                      (logger + health)
```

### Рекомендуемая последовательность (1 developer)

**Неделя 1: Foundation + Service extraction (часть 1)**

| День | PR | Effort | Блокирует |
|------|-----|--------|----------|
| Пн | PR-01 (contracts) | 0.5d | PR-03..PR-10 |
| Пн-Вт | PR-02 (message-sender) | 1d | PR-04, PR-09 |
| Вт-Ср | PR-03 (getChatDetail) | 1.5d | PR-05, PR-12 |
| Ср-Чт | PR-07 (queue-service) | 0.5d | — |
| Чт-Пт | PR-08 (sequence get+stop) | 1d | PR-09, PR-10 |

**Неделя 2: Service extraction (часть 2) + Risk zone**

| День | PR | Effort | Блокирует |
|------|-----|--------|----------|
| Пн-Вт | PR-04 (sendMessage) | 1d | — |
| Вт-Чт | **PR-05** (generateReply + flag) | **2d** | PR-06 |
| Чт-Пт | PR-09 (sequence start) | 1.5d | PR-13 |

**Неделя 3: Duplication removal + Repositories**

| День | PR | Effort | Блокирует |
|------|-----|--------|----------|
| Пн | PR-10 (status-service) | 1d | — |
| Вт | PR-06 (web gen-ai → service) | 0.5d | PR-11 |
| Ср | PR-12 (chat-repository) | 1.5d | PR-14 |
| Чт | PR-13 (seq+store repository) | 1d | PR-14 |
| Пт | PR-14 (import boundaries) | 0.5d | — |

**Неделя 4: Observability + Cleanup**

| День | PR | Effort | Блокирует |
|------|-----|--------|----------|
| Пн | PR-15 (logger + health) | 1d | — |
| Вт | PR-11 (remove feature flag) | 0.5d | — |
| Ср | Buffer / bugfixes | — | — |

### Где можно параллелить (при 2 developers)

| Track A (critical path) | Track B (independent) |
|--------------------------|----------------------|
| PR-01 → PR-02 → PR-04 → PR-05 → PR-06 → PR-11 | PR-03 → PR-12 |
| | PR-07 |
| | PR-08 → PR-09 → PR-13 |
| | PR-10 |
| | PR-15 |

**Track A** содержит самый рискованный PR (PR-05) и блокирует устранение дублирования.
**Track B** содержит независимые services, которые не зависят от feature flag.

### Summary

| Метрика | Значение |
|---------|---------|
| Всего PR | 15 |
| Stage 0 | 1 PR |
| Stage 1 | 10 PR (включая cleanup PR-11) |
| Stage 2 | 3 PR |
| Stage 3 | 1 PR |
| Critical path | PR-01 → PR-02 → PR-05 → PR-06 → PR-11 (6d) |
| Самый рискованный PR | **PR-05** (generateReply + feature flag) |
| Total effort | 14.5d (≈3 недели + buffer) |
| Feature flag lifetime | PR-05 deploy → PR-11 deploy (min 3 дня, рекомендуется 1 неделя) |
| Golden test chats | 3 (WB-LOW, WB-HIGH, OZON) |
