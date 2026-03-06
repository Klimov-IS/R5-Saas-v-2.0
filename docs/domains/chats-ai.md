# Домен: AI в чатах

**Дата:** 2026-03-04
**Версия:** 3.5
**AI Model:** Deepseek Chat (`deepseek-chat`)
**API Endpoint:** `https://api.deepseek.com/chat/completions`

---

## Обзор

AI-ассистент в чатах помогает менеджерам быстро отвечать на сообщения покупателей. Система генерирует контекстные ответы, классифицирует чаты и помогает в сценариях удаления отзывов.

### Возможности AI

1. **Генерация ответов** — создание текста ответа на сообщение клиента
2. **Классификация чатов** — автоматическое присвоение тегов (12 тегов)
3. **Deletion classification** — определение кандидатов на удаление отзыва (regex + AI)
4. **Deletion offers** — генерация предложений об удалении/изменении отзыва
5. **Bulk operations** — массовая генерация/классификация для нескольких чатов

---

## Теги и статусы

### ChatTag (4 тега + NULL) — этап воронки удаления

> Source of truth: `src/types/chats.ts`
> AI-классификация удалена (migration 024, 2026-03-06). Заменена на regex-классификатор (`src/lib/tag-classifier.ts`).
> Подробная документация: [`docs/domains/TAG_CLASSIFICATION.md`](TAG_CLASSIFICATION.md)

| Тег | Описание | Как назначается |
|-----|----------|----------------|
| `NULL` | Новый чат | По умолчанию, ещё не обработан |
| `deletion_candidate` | Кандидат на удаление | **Автоматически** при привязке чата к отзыву (`review_chat_links`) |
| `deletion_offered` | Оффер отправлен | **Regex** (синк) + **Вручную** (TG) — продавец предлагает компенсацию |
| `deletion_agreed` | Клиент согласился | **Regex** (синк) + **Вручную** (TG) — покупатель согласился удалить |
| `deletion_confirmed` | Отзыв удалён/изменён | **Regex** (синк) + **Вручную** (TG) — факт удаления/изменения |

Удалённые теги (migration 024): `active`, `successful`, `unsuccessful`, `no_reply`, `untagged`, `completed`, `refund_requested`, `spam`.

### ChatStatus (4 статуса Kanban)

> Source of truth: `src/types/chats.ts`

| # | Статус | Описание | Использование |
|---|--------|----------|---------------|
| 1 | `awaiting_reply` | Ожидание | Чат с активной авто-рассылкой, ждём ответа покупателя |
| 2 | `inbox` | Входящие | Покупатель ответил — требует реакции менеджера |
| 3 | `in_progress` | В работе | Продавец ответил последним, ведётся диалог |
| 4 | `closed` | Закрыто | Диалог закрыт (требует `completion_reason`) |

> `resolved` удалён в migration 008.

**Порядок табов в TG Mini App:** Ожидание → Входящие → В работе → Закрытые (обновлено 2026-02-28).

**Workflow статусов (обновлено 2026-02-28):**
- Менеджер запускает рассылку из TG → `awaiting_reply` (ЕДИНСТВЕННЫЙ автоматический путь в awaiting_reply)
- Покупатель ответил → `inbox` (нужна реакция менеджера)
- Продавец ответил (ручная отправка из TG/веб) → `in_progress`
- Продавец ответил (авто-сообщение от рассылки) → остаётся `awaiting_reply`
- Из `in_progress` можно запустить рассылку по кнопке → обратно в `awaiting_reply`
- Все рассылки отправлены → `closed` (no_reply)

> **ВАЖНО (2026-02-28):** Крон `transitionStaleInProgressChats` (auto `in_progress → awaiting_reply` после 2 дней) **ОТКЛЮЧЁН**. Статус `awaiting_reply` ставится ТОЛЬКО: (1) ручной запуск рассылки из TG, (2) ручная смена статуса через Kanban drag-and-drop.

**Защита статуса:** Dialogue sync НЕ переводит `awaiting_reply` → `in_progress` при отправке сообщения продавцом, если есть активная авто-рассылка (`getActiveSequenceForChat()`). Это предотвращает сброс статуса при автоматической отправке follow-up.

**Важно:** ChatTag = AI-классификация содержимого. ChatStatus = позиция на Kanban-доске (управляется автоматически + вручную).

### Причины закрытия (CompletionReason)

> Source of truth: `src/db/helpers.ts` — тип `CompletionReason`

| Причина | Label в TG | Описание |
|---------|-----------|----------|
| `review_deleted` | Отзыв удален | Отзыв удалён покупателем |
| `review_upgraded` | Отзыв дополнен | Покупатель поднял оценку до 5★ |
| `review_resolved` | Не влияет на рейтинг | Жалоба одобрена / отзыв исключён / скрыт / удалён WB |
| `temporarily_hidden` | Временно скрыт | Отзыв временно скрыт WB (может "проснуться" при ответе покупателя) |
| `refusal` | Отказ | Покупатель отказался от сотрудничества |
| `no_reply` | Нет ответа | Покупатель не ответил (ставится авто-рассылкой при завершении) |
| `old_dialog` | Старый диалог | Неактуальный диалог |
| `not_our_issue` | Не наш вопрос | Тема чата не связана с товаром/отзывом |
| `spam` | Спам | Спам, автоответы, конкуренты |
| `negative` | Негатив | Агрессивный покупатель, без перспектив |
| `other` | Другое | Прочие причины |

### Авто-закрытие resolved отзывов (обновлено 2026-03-03)

**3-уровневая система мгновенного авто-закрытия:**

| # | Уровень | Когда срабатывает | Файл |
|---|---------|-------------------|------|
| 1 | **Extension chat/opened** | Расширение открывает чат → API проверяет resolved | `src/app/api/extension/chat/opened/route.ts` |
| 2 | **Dialogue sync Step 3.5b** | Каждый sync проверяет ВСЕ синхронизируемые чаты | `src/app/api/stores/[storeId]/dialogues/update/route.ts` |
| 3 | **Крон (safety net)** | Каждые 30 мин, :15/:45 | `src/lib/cron-jobs.ts` → `startResolvedReviewCloser()` |

**Resolved conditions (единые для всех уровней):**
- `complaint_status = 'approved'` — жалоба одобрена WB
- `review_status_wb IN ('excluded', 'unpublished', 'temporarily_hidden', 'deleted')` — отзыв скрыт/удалён
- `rating_excluded = TRUE` — "прозрачные звёзды" (не влияют на рейтинг)

**Разделение completion_reason:**
- `temporarily_hidden` → `completion_reason = 'temporarily_hidden'` (для статистики)
- Все остальные → `completion_reason = 'review_resolved'`

**Уровень 1 — Extension chat/opened (мгновенно):**
При создании `review_chat_link` проверяет статус отзыва. Если resolved + chatId найден → сразу закрывает чат. Возвращает `reviewResolved: true` и `resolvedReason` в ответе для расширения.

**Уровень 2 — Dialogue sync Step 3.5b (мгновенно):**
После reconciliation (Step 3.5), проверяет ВСЕ синхронизируемые чаты через `isReviewResolvedForChat()`. Закрывает resolved чаты + останавливает активные рассылки.

**Уровень 3 — Крон (safety net, каждые 30 мин):**
`startResolvedReviewCloser()` — fallback для чатов, пропущенных уровнями 1-2. Batch: 200 чатов за раз.

**SQL-фильтр:** TG очередь (`getUnifiedChatQueue`, `getUnifiedChatQueueCount`, `getUnifiedChatQueueCountsByStatus`) также фильтрует resolved отзывы — они не отображаются в активных табах.

### Особая обработка `temporarily_hidden` (обновлено 2026-03-03)

Отзывы со статусом `temporarily_hidden` (временно скрыт WB) требуют **особого подхода**:

| Аспект | Поведение |
|--------|-----------|
| **Влияние на рейтинг** | Нет — пока покупатель не ответил в чате |
| **Показ в TG очереди** | Только если `last_message_sender = 'client'` (покупатель ответил сам) |
| **Авто-закрытие** | **Да** — закрывается с `completion_reason = 'temporarily_hidden'` (отдельная причина для статистики) |
| **Рассылки** | Заблокированы (`isReviewResolvedForChat` включает `temporarily_hidden`) |

**Бизнес-логика:** Если мы начнём рассылку, покупатель ответит → отзыв "просыпается" и начинает влиять на рейтинг. Поэтому:
1. Рассылки заблокированы — не "будим" покупателя
2. Чат скрыт из очереди — менеджер не увидит и не начнёт диалог
3. Чат автоматически закрывается с `temporarily_hidden` (для отдельной статистики)
4. Но если покупатель **сам** ответил — чат появляется в очереди, нужно работать

**SQL-фильтр (3 функции × 2 ветки WB/OZON):**
```sql
AND (
  r.id IS NULL
  OR NOT (
    r.complaint_status = 'approved'
    OR r.review_status_wb IN ('excluded', 'unpublished', 'deleted')
    OR r.rating_excluded = TRUE
  )
  OR (r.review_status_wb = 'temporarily_hidden' AND c.last_message_sender = 'client')
)
```

---

## AI Flows

### 1. Generate Chat Reply

**Flow:** `src/ai/flows/generate-chat-reply-flow.ts`

**Назначение:** Генерация ответа на сообщение покупателя.

**Входные данные:**
```typescript
interface GenerateChatReplyInput {
  context: string;   // Полный контекст: магазин + товар + история чата (одна строка)
  storeId: string;   // ID магазина (для логирования)
  ownerId: string;   // ID владельца (для логирования)
  chatId: string;    // ID чата (для логирования)
}
```

**Выходные данные:**
```typescript
interface GenerateChatReplyOutput {
  text: string;      // Сгенерированный текст ответа
}
```

> Метрики (tokens, cost, duration) логируются в `ai_logs` через `runChatCompletion`, а не возвращаются в output.

**Логика:**
1. Загрузка системного промпта из `user_settings.prompt_chat_reply`
2. Если промпт не настроен → ошибка (дефолта нет)
3. Вызов Deepseek API через `runChatCompletion()`
4. Возврат текста ответа
5. Автоматическое логирование в `ai_logs`

**Промпт:** Хранится в БД (`user_settings.prompt_chat_reply`). Вызывающий код формирует `context` как строку с информацией о магазине, товаре и историей диалога.

---

### 2. Classify Chat Tag

**Flow:** `src/ai/flows/classify-chat-tag-flow.ts`

**Назначение:** Автоматическая классификация чата по тегам.

**Входные данные:**
```typescript
interface ClassifyChatTagInput {
  chatHistory: string;     // История переписки как строка
  lastMessageText: string; // Последнее сообщение (для быстрого regex-анализа)
  storeId: string;
  ownerId: string;
  chatId: string;
}
```

**Выходные данные:**
```typescript
interface ClassifyChatTagOutput {
  tag: ChatTag | null;       // Один из 4 тегов или NULL (migration 024: было 12 → стало 4 + NULL)
  confidence: number;        // 0-1
  reasoning?: string;        // Обоснование AI
  triggers?: string[];       // Обнаруженные триггерные фразы
}
```

**Промпт:** `user_settings.prompt_chat_tag` *(deprecated, migration 024 — flow отключён)*

> **DEPRECATED (migration 024, 2026-03-06):** Flow classify-chat-tag отключён. Теги теперь выставляются вручную из TG Mini App или автоматически при создании review_chat_link (deletion_candidate). AI-классификация больше не используется.

---

### 3. Classify Chat Deletion (DEPRECATED — replaced by regex classifier)

**Flow:** `src/ai/flows/classify-chat-deletion-flow.ts` (DEPRECATED, migration 024)

**Замена:** `src/lib/tag-classifier.ts` — regex-классификатор, интегрирован в sync flows. См. [`TAG_CLASSIFICATION.md`](TAG_CLASSIFICATION.md).

**Бывшее назначение:** Определение, подходит ли чат для сценария удаления отзыва. Двухэтапный подход: regex + AI.

**Входные данные:**
```typescript
interface ClassifyChatDeletionInput {
  chatHistory: string;
  lastMessageText: string;
  storeId: string;
  ownerId: string;
  chatId: string;
  productName?: string;
  productRules?: {
    work_in_chats: boolean;
    offer_compensation: boolean;
    chat_strategy?: 'upgrade_to_5' | 'delete' | 'both';
    max_compensation?: string;
  };
}
```

**Выходные данные:**
```typescript
interface ClassifyChatDeletionOutput {
  tag: ChatTag | null;       // Один из 4 тегов или NULL (migration 024: было 12 → стало 4 + NULL)
  confidence: number;        // 0-1
  reasoning?: string;        // Обоснование (regex или AI)
  triggers?: string[];       // Обнаруженные триггерные фразы
}
```

**Двухэтапная логика:**

```
Этап 1: Regex (быстро, ~0ms)
  ├── detectDeletionIntent(lastMessageText) — src/db/chat-deletion-helpers.ts
  ├── Если confidence >= 0.90 → сразу tag='deletion_candidate' (без AI)
  ├── Если spam_caps → сразу tag='spam'
  └── Иначе → Этап 2

Этап 2: AI (Deepseek, ~2-3с)
  ├── Промпт: prompt_chat_deletion_tag (fallback: prompt_chat_tag)
  ├── Контекст: история + товар + product_rules + regex-подсказки
  ├── JSON response → валидация через Zod
  ├── AI определяет ВСЕ 6 deletion-тегов (candidate → offered → agreed → confirmed)
  └── Fallback: если AI упал → используем regex-результат
```

**AI auto-progression тегов (добавлено 2026-03-01):**

AI классификация при dialogue sync автоматически продвигает теги воронки:
- `deletion_candidate` → `deletion_offered` — если продавец отправил конкретное предложение компенсации
- `deletion_offered` → `deletion_agreed` — если покупатель явно согласился удалить/изменить отзыв
- `deletion_agreed` → `deletion_confirmed` — если покупатель подтвердил что удалил/изменил

**Направленная защита:** Guard `canAutoOverwriteTag` разрешает только FORWARD progression — AI не может откатить `deletion_agreed` → `deletion_candidate`. Порядок: candidate(0) → offered(1) → agreed(2) → confirmed(3). `refund_requested` = уровень 1 (боковая ветка).

**Файл:** `src/lib/chat-transitions.ts` — `DELETION_TAG_ORDER` + `canAutoOverwriteTag()`

**Триггерные фразы (regex):**

| Категория | Пример | Confidence |
|-----------|--------|------------|
| Прямое обещание удалить | "удалю отзыв", "уберу отзыв" | 95-98% |
| Обещание 5 звёзд | "поставлю 5", "изменю на 5" | 94-96% |
| Запрос компенсации | "верните деньги", "хочу возврат" | 84-92% |
| Комбинированные | "верните деньги... удалю отзыв" | 94-96% |
| Негативный сентимент | "брак", "не работает" | 78-82% |
| Спам | ALL CAPS текст | 100% |

**Порог для deletion_candidate:** confidence >= 0.80

**Промпт:** Хранится в `user_settings.prompt_chat_deletion_tag` (~4500 символов, русский язык). Обновлён 2026-03-01: добавлены описания `deletion_offered`, `deletion_agreed`, `deletion_confirmed` для AI auto-progression.

---

### 4. Generate Deletion Offer

**Flow:** `src/ai/flows/generate-deletion-offer-flow.ts`

**Назначение:** Генерация персонализированного предложения компенсации за удаление/изменение отзыва.

**Выходные данные:**
```typescript
interface GenerateDeletionOfferOutput {
  messageText: string;                                    // Текст сообщения
  offerAmount: number;                                    // Сумма компенсации
  strategy: 'upgrade_to_5' | 'delete' | 'both';         // Стратегия
  tone?: 'empathetic' | 'apologetic' | 'professional' | 'friendly';
  estimatedSuccessRate?: number;                          // 0-1
}
```

**Калькулятор компенсации (детерминистичный):**

| Рейтинг отзыва | % от max_compensation | Примечание |
|----------------|----------------------|------------|
| 1 звезда | 100% | Компенсация предлагается |
| 2 звезды | 80% | Компенсация предлагается |
| 3 звезды | 60% | Компенсация предлагается |
| 4 звезды | **0% — НЕ ПРЕДЛАГАТЬ** | Только повышение до 5★ |
| 5 звёзд | **0% — НЕ ПРЕДЛАГАТЬ** | Не работаем |

> **Бизнес-правило (обновлено 2026-03-04):** Компенсация (кешбек/возврат) предлагается **только для негативных отзывов (1-3★)** и **только за целевое действие** (удаление/изменение отзыва на WB, дополнение до 5★ на OZON). Для 4★ — стратегия исключительно повышение оценки до 5★, без денежной компенсации. AI-контекст автоматически блокирует упоминание компенсации для 4★+ отзывов (проверка `review_rating` через `review_chat_links`). При отсутствии привязки к отзыву (OZON чаты без rcl) — AI получает инструкцию "компенсация СТРОГО только за целевое действие".

Минимальное предложение: 50 руб. (только для 1-3★).

**Стратегии:**

| Стратегия | Описание | Когда использовать |
|-----------|----------|--------------------|
| `upgrade_to_5` | Попросить повысить оценку до 5 | После решения проблемы |
| `delete` | Деликатный намёк на удаление (без прямого упоминания!) | Клиент уже намекал |
| `both` | Универсальный фокус на решении проблемы | Неясная ситуация |

**Важно:** Прямое упоминание "удалить отзыв" запрещено правилами WB. Используются тонкие намёки: "надеемся на ваше понимание", "готовы исправить ситуацию".

**Промпт:** Hardcoded в `src/ai/prompts/deletion-offer-prompt.ts` (~5200 символов)

**Fallback:** Если AI упал → шаблонное сообщение с суммой компенсации.

---

## Маркетплейс-специфика AI (WB vs OZON)

### Общий механизм

Маркетплейс-специфичные правила инжектируются через `buildStoreInstructions()` в `src/lib/ai-context.ts`. Когда `marketplace === 'ozon'`, к инструкциям магазина добавляется `OZON_MARKETPLACE_ADDENDUM`.

**Файл:** `src/lib/ai-context.ts`

### WB: Удаление отзыва
- Цель: покупатель **удаляет** негативный отзыв
- AI использует тонкие намёки ("надеемся на ваше понимание", "готовы исправить ситуацию")
- НЕЛЬЗЯ прямо упоминать "удаление отзыва" (нарушение правил WB)
- 1-3★: компенсация (кешбэк/возврат) + намёк на удаление
- 4★: только повышение до 5★, без кешбека

### OZON: Дополнение отзыва до 5★
- Цель: покупатель **дополняет и редактирует** свой отзыв, ставит 5★
- На OZON отзывы НЕ удаляются — покупатель может только изменить
- НЕЛЬЗЯ упоминать "удаление", "убрать отзыв" — на OZON это невозможно
- МОЖНО: "дополнить отзыв", "обновить оценку", "пересмотреть оценку"
- 1-3★: компенсация **СТРОГО только за согласие дополнить до 5★** + инструкция по редактированию
- 4★: просьба дополнить до 5★ без компенсации
- **КРИТИЧЕСКОЕ ПРАВИЛО:** Компенсацию НЕЛЬЗЯ предлагать "просто так", "за неудобства", "на след покупку" — только в обмен на дополнение отзыва. Если покупатель отказался — компенсацию НЕ предлагать

**Инструкция для покупателя OZON (отправляется в фазе "решение"):**

> 1. Откройте приложение Ozon
> 2. Нажмите иконку профиля внизу справа
> 3. Перейдите в раздел «Отзывы» → «Мои отзывы»
> 4. Найдите нужный товар и откройте свой отзыв
> 5. Нажмите «Редактировать»
> 6. Поставьте оценку 5★
> 7. Нажмите «Отправить отзыв»

### Где различия в коде

| Файл | WB | OZON |
|------|-----|------|
| `ai-context.ts` | DEFAULT_AI_INSTRUCTIONS | + OZON_MARKETPLACE_ADDENDUM |
| `generate-ai/route.ts` (web) | "Артикул WB", "повышение до 5★, без кешбека" | "ID товара OZON", "попросить дополнить до 5★" + 1000-char trim |
| `generate-ai/route.ts` (TG) | То же | То же + 1000-char trimming |
| `generate-ai/route.ts` (bulk) | То же | То же (v3.6: vendor code + seller context) |
| `deletion-offer-prompt.ts` | Намёки на удаление | **НЕ поддерживается для OZON** |

### Compensation Gating по рейтингу отзыва (обновлено 2026-03-04)

Компенсация в AI-контексте гейтится через `review_rating` из `review_chat_links`:

| Рейтинг | Результат для AI | WB | OZON |
|---------|------------------|-----|------|
| 1-3★ | Компенсация показана | "до X₽ (кешбек)" | "до X₽ (кешбек)" |
| 4-5★ | Компенсация заблокирована | "только повышение до 5★" | "попросить дополнить до 5★" |
| **NULL** (нет rcl) | **Компенсация с условием** | "СТРОГО только за удаление/изменение" | "СТРОГО только за дополнение до 5★" |

> **Фикс v3.6:** Ранее при NULL рейтинге (OZON чаты без `review_chat_links`) компенсация показывалась безусловно — AI предлагал кешбэк без привязки к целевому действию. Теперь NULL рейтинг обрабатывается отдельной веткой с явным требованием целевого действия.

### Фазы диалога (v4.0, обновлено 2026-03-04)

`detectConversationPhase()` определяет фазу по количеству сообщений клиента:

| Фаза | Условие | Label | Поведение AI |
|------|---------|-------|-------------|
| `discovery` | 0 сообщений клиента | "знакомство" | Спросить что не так, закончить вопросом, БЕЗ компенсации |
| `proposal` | 1 сообщение клиента | "предложение" | Отреагировать + СРАЗУ предложить удаление/дополнение с намёком на компенсацию |
| `resolution` | 2+ сообщений клиента | "решение" | Развивать диалог, называть сумму, давать инструкции |

> **Изменение v4.0:** Ранее фаза "понимание" (1-2 сообщения) запрещала предлагать компенсацию — это приводило к затяжным диалогам (6+ сообщений до предложения). Теперь после первого ответа клиента AI сразу переходит к предложению. Каждое сообщение обязательно заканчивается вопросом.

**Новые правила v4.0:**
- **Обязательный вопрос:** Каждое сообщение заканчивается вопросом/предложением, требующим ответа
- **Учёт таймстампов:** Если продавец уже писал сегодня — не здороваться повторно, продвигать диалог
- **Быстрая воронка:** 1 сообщение = знакомство, 2 = предложение, 3+ = решение

### Ограничения OZON API
- Сообщение в чат: **СТРОГО до 1000 символов**
- 1 сообщение до ответа покупателя (error code 7 при повторной попытке)
- Подробности: `docs/domains/ozon-work-policy.md`

---

## AI Backend

### runChatCompletion()

**Файл:** `src/ai/assistant-utils.ts`

Общая функция для всех AI-вызовов:

```typescript
async function runChatCompletion({
  systemPrompt: string,
  userContent: string,
  isJsonMode?: boolean,
  operation: string,       // 'generate-chat-reply', 'classify-chat-deletion', etc.
  storeId: string,
  ownerId: string,
  entityType: string,      // 'chat', 'review'
  entityId: string,
}): Promise<string>
```

**Параметры Deepseek API:**
- Model: `deepseek-chat`
- Temperature: 0.7
- Max tokens: 2048
- JSON mode: опционально (`response_format: { type: 'json_object' }`)
- Auth: Bearer token из `user_settings` или env `DEEPSEEK_API_KEY`

**Стоимость:**
- Input: $0.14 / 1M tokens
- Output: $0.28 / 1M tokens
- ~$0.0001-0.0003 за генерацию ответа

---

## Сценарии использования

### Сценарий 1: Быстрый ответ

```
[Клиент пишет вопрос о товаре]
       ↓
[Менеджер открывает чат]
       ↓
[Нажимает "Генерировать AI"]
       ↓
[AI генерирует ответ → сохраняется как draft_reply]
       ↓
[Менеджер редактирует (опционально)]
       ↓
[Отправка через WB API]
```

### Сценарий 2: Массовая классификация

```
[Менеджер открывает таб Чаты]
       ↓
[POST /api/stores/:id/chats/classify-all]
       ↓
[AI классифицирует каждый чат] ← DEPRECATED (migration 024: flow отключён, 4 тега + NULL)
       ↓
[Обновляются теги в БД]
```

### Сценарий 3: Deletion workflow

```
[Dialogue Sync обнаруживает новое сообщение]
       ↓
[classifyChatDeletion() → regex + AI]
       ↓
[Если deletion_candidate → менеджер видит индикатор]
       ↓
[Менеджер нажимает "Сгенерировать предложение"]
       ↓
[generateDeletionOffer() → расчёт суммы + генерация текста]
       ↓
[Создаётся deletion_case в БД]
       ↓
[Менеджер отправляет → тег меняется на deletion_offered]
       ↓
[Клиент соглашается → deletion_agreed → deletion_confirmed]
```

### Сценарий 4: Автоклассификация при синхронизации

```
[CRON: Adaptive Dialogue Sync (каждые 15 мин)]
       ↓
[Получены новые сообщения от WB API]
       ↓
[Для каждого чата с новыми сообщениями: classifyChatDeletion()]
       ↓
[Тег обновляется автоматически]
```

---

## Обогащённый контекст AI (v4.0, 2026-03-04)

AI при генерации ответа получает полный контекст чата. Ниже — полный перечень данных, передаваемых в `context` для `generateChatReply()`.

### Что передаётся AI

| Блок | Поле | Источник | Пример |
|------|------|----------|--------|
| Магазин | Название | `stores.name` | "StyleBrand" |
| Товар | Название | `products.name` | "Кроссовки мужские" |
| Товар | Артикул/ID | `chats.product_nm_id` | WB: "123456", OZON: "sku-789" |
| Товар | Вендор код | `products.vendor_code` | Только WB |
| Товар | Правила (компенсация, стратегия) | `product_rules.*` | "до 500₽ (кешбек)" |
| **Отзыв** | **Оценка** | `review_chat_links.review_rating` | "3★" |
| **Отзыв** | **Дата** | `review_chat_links.review_date` | "15.02 14:30" (МСК) |
| **Отзыв** | **Текст отзыва** | `reviews.text` (через JOIN) | "Качество ужасное..." (до 500 символов) |
| Клиент | Имя | `chats.client_name` | "Алексей" |
| **Воронка** | **Текущий тег** | `chats.tag` | "Предложена компенсация" |
| **Воронка** | **Статус чата** | `chats.status` | "Входящие (покупатель ответил)" |
| Фаза | Фаза диалога | `detectConversationPhase()` | "знакомство" / "предложение" / "решение" |
| Фаза | Кол-во сообщений от клиента | computed | 3 |
| **Фаза** | **Кол-во сообщений от продавца** | computed | 2 |
| **Фаза** | **Последнее сообщение продавца** | computed (до 200 символов) | "Добрый день..." |
| **История** | **Сообщения с таймстампами** | `chat_messages.*` | "[04.03 15:32 \| Клиент]: текст" |

**Жирным** выделены поля, добавленные в v3.5-3.6.

### Хелперы контекста

**Файл:** `src/lib/ai-context.ts`

| Функция | Назначение |
|---------|------------|
| `formatTimestampMSK(ts)` | Формат даты в МСК: "DD.MM HH:MM" |
| `getTagLabel(tag)` | Человекочитаемый тег: `deletion_offered` → "Предложена компенсация" |
| `getStatusLabel(status)` | Человекочитаемый статус: `inbox` → "Входящие (покупатель ответил)" |
| `detectConversationPhase(messages)` | Фаза: discovery/proposal/resolution |

### Что НЕ передаётся AI (осознанно)

- `complaint_status` — не влияет на генерацию ответа
- Предыдущие компенсации — нет таблицы отслеживания
- Баланс клиента — не реализовано

### Где используется обогащённый контекст

| Endpoint | Файл | Все данные |
|----------|------|:----------:|
| Web generate-ai | `stores/[storeId]/chats/[chatId]/generate-ai/route.ts` | ✅ (v4.0: быстрая воронка) |
| TG generate-ai | `telegram/chats/[chatId]/generate-ai/route.ts` | ✅ (v4.0: быстрая воронка) |
| Bulk generate-ai | `stores/[storeId]/chats/bulk/generate-ai/route.ts` | ✅ (v4.0: быстрая воронка) |

---

## Ограничения AI

### 1. Context window
- Максимум 20 последних сообщений в истории
- Длинные сообщения обрезаются до 500 символов

### 2. Rate limiting
- 60 запросов в минуту к Deepseek
- При превышении → ошибка 429

### 3. Стоимость
- ~$0.0001-0.0003 за генерацию ответа
- Классификация дешевле (меньше токенов)

### 4. Качество
- Требуется review человеком перед отправкой
- Возможны галлюцинации
- Не гарантируется tone of voice бренда

---

## Stop Conditions

AI **НЕ должен** генерировать ответы, которые:

1. Обещают то, что нельзя выполнить
2. Раскрывают конфиденциальную информацию
3. Содержат оскорбления
4. Дают юридические советы
5. Обсуждают конкурентов
6. Предлагают компенсацию без согласования
7. Напрямую упоминают "удаление отзыва" (нарушение правил WB)

---

## API Endpoints

### Генерация ответа

```http
POST /api/stores/:storeId/chats/:chatId/generate-ai
Authorization: Bearer {token}
```

**Response:**
```json
{
  "text": "Добрый день! Благодарим за обращение..."
}
```

> draft_reply сохраняется в БД автоматически.

### Классификация

```http
POST /api/stores/:storeId/chats/classify-all
Authorization: Bearer {token}
```

### Deletion classification

```http
POST /api/stores/:storeId/chats/classify-deletion
Authorization: Bearer {token}
```

### Deletion offer

```http
POST /api/stores/:storeId/chats/:chatId/generate-deletion-offer
Authorization: Bearer {token}
```

> Параметр `?autoSend=true` существует, но **НЕ реализован** (TODO в коде).

### Bulk генерация

```http
POST /api/stores/:storeId/chats/bulk/generate-ai
Authorization: Bearer {token}
Content-Type: application/json

{
  "chatIds": ["id1", "id2", "id3"]
}
```

> Требует явный массив chatIds. Ключевое слово "all" заблокировано для безопасности.

### Bulk отправка

```http
POST /api/stores/:storeId/chats/bulk/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "chatIds": ["id1", "id2", "id3"]
}
```

> Отправляет draft_reply для каждого чата. Меняет статус на `in_progress` (продавец ответил → "В работе").

### Смена статуса (Kanban)

```http
PATCH /api/stores/:storeId/chats/:chatId/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "awaiting_reply",
  "completion_reason": "review_deleted"  // обязательно при closed
}
```

---

## AI Context Injection (Per-Store Personalization)

**Файл:** `src/lib/ai-context.ts`

Система инжекции контекста магазина в system prompt AI. Объединяет три источника данных в единый блок инструкций.

### buildStoreInstructions(storeId, aiInstructions?, marketplace?)

```typescript
async function buildStoreInstructions(
  storeId: string,
  aiInstructions?: string | null,
  marketplace?: 'wb' | 'ozon'
): Promise<string | undefined>
```

**Объединяет:**

1. **AI Instructions** (`stores.ai_instructions`) — свободный текст: тон, правила, ограничения
2. **FAQ** (`store_faq`) — пары вопрос-ответ, форматируются как `## FAQ магазина\nВ: ...\nО: ...`
3. **Guides** (`store_guides`) — пошаговые инструкции, форматируются как `## Инструкции для клиентов\n### Title\nContent`
4. **Marketplace addendum** — OZON-специфичные правила (если `marketplace === 'ozon'`): дополнение отзыва вместо удаления, 1000-символьный лимит, инструкция по редактированию на OZON

**Используется в 6 customer-facing flows:**
- generate-chat-reply
- ~~classify-chat-tag~~ *(deprecated, migration 024)*
- ~~classify-chat-deletion~~ *(deprecated, migration 024)*
- generate-deletion-offer
- generate-review-reply
- generate-question-reply

**НЕ используется в:** generate-review-complaint (жалоба — не клиентский ответ)

### FAQ Templates

**Файл:** `src/lib/faq-templates.ts`

27 предустановленных FAQ пар в 9 категориях (на основе анализа 5000+ реальных диалогов):
- Возвраты, Брак, Размеры, Доставка, Качество, Комплектность, Обмен, Компенсация, Описание

### Guide Templates

**Файл:** `src/lib/guide-templates.ts`

7 предустановленных инструкций (на основе анализа 2000+ реальных сообщений продавцов):
1. Как удалить отзыв (браузер)
2. Как удалить отзыв (приложение)
3. Как дополнить отзыв (изменить оценку на 5)
4. Как оставить новый отзыв
5. Как оформить возврат по браку
6. Как оформить обычный возврат
7. Как мы выплачиваем компенсацию

### UI: Вкладка AI

**Файл:** `src/app/stores/[storeId]/ai/page.tsx`

Четыре секции:

| # | Секция | Данные | Хранение |
|---|--------|--------|----------|
| 1 | Инструкции AI-агента | Свободный текст | `stores.ai_instructions` |
| 2 | FAQ База знаний | Вопрос + Ответ пары | `store_faq` таблица |
| 3 | Инструкции для клиентов | Название + Пошаговый текст | `store_guides` таблица |
| 4 | AI-анализ диалогов | Кнопка анализа + модалка результатов | не хранится (on-demand) |

Каждая секция (1-3) имеет:
- CRUD (добавить, редактировать, удалить)
- Toggle active/inactive
- Template picker с multi-select и batch add
- Детекция дубликатов ("уже добавлено")

### Defaults (безкоробочный опыт)

- **AI Instructions fallback:** если магазин не настроил `ai_instructions`, используется `DEFAULT_AI_INSTRUCTIONS` из `src/lib/ai-context.ts` — базовые правила вежливости, эмпатии, компенсации
- **Default Guides banner:** при пустом списке инструкций показывается баннер "Добавить 3 базовых" → создаёт: удаление отзыва через браузер, дополнение до 5 звёзд, возврат по браку
- **5 шаблонов инструкций:** Косметика, Электроника, Одежда, Продукты, Универсальный (`src/lib/ai-instruction-templates.ts`)

### Секция 4: AI-анализ диалогов

**Кнопка:** "Проанализировать диалоги" → `POST /api/stores/{storeId}/analyze-dialogues`

**Логика:**
1. `getRecentDialogues(storeId, 500)` — загружает 500 последних чатов с минимум 2 сообщениями
2. Компактная сериализация: `[tag] Товар: name\nК: текст\nП: текст` (до 120K символов)
3. Передаёт существующие FAQ/guides для дедупликации
4. Deepseek API (JSON mode, max_tokens=4096) → анализирует паттерны
5. Возвращает: предложенные FAQ (5-15 шт.), Guides (3-7 шт.), summary

**UI модалка:** чекбоксы для каждого предложения, "Выбрать все / Снять все", batch add в один клик

**Flow:** `src/ai/flows/analyze-store-dialogues-flow.ts`
**DB helper:** `getRecentDialogues()` в `src/db/helpers.ts`

**Prefetch:** `src/app/stores/[storeId]/layout.tsx` предзагружает `ai-instructions`, `store-faq`, `store-guides`

---

## Настройки

### User Settings (таблица `user_settings`)

| Поле | Описание | Используется в |
|------|----------|----------------|
| `prompt_chat_reply` | Системный промпт для генерации ответов | generate-chat-reply-flow |
| `prompt_chat_tag` | Промпт для классификации тегов | classify-chat-tag-flow |
| `prompt_chat_deletion_tag` | Промпт для deletion-классификации (fallback: prompt_chat_tag) | classify-chat-deletion-flow |
| `prompt_deletion_offer` | Промпт для генерации deletion offer (fallback: prompt_chat_reply) | generate-deletion-offer-flow |
| `ai_concurrency` | Параллельность AI запросов (default: 5) | Bulk operations |
| `deepseek_api_key` | API ключ Deepseek (если свой) | assistant-utils |
| `no_reply_messages` | Шаблоны авто-рассылки (набор 1: негатив 1-2-3) | auto-sequence-templates |
| `no_reply_trigger_phrase` | Триггерная фраза (набор 1) | dialogue sync trigger detection |
| `no_reply_stop_message` | Стоп-сообщение (набор 1) | cron: sequence completion |
| `no_reply_messages2` | Шаблоны авто-рассылки (набор 2: 4 звезды) | auto-sequence-templates |
| `no_reply_trigger_phrase2` | Триггерная фраза (набор 2) | dialogue sync trigger detection |
| `no_reply_stop_message2` | Стоп-сообщение (набор 2) | cron: sequence completion |

### Product Rules (таблица `product_rules`)

| Поле | Описание |
|------|----------|
| `work_in_chats` | Работать с чатами по товару (включает deletion workflow) |
| `offer_compensation` | Разрешено предлагать компенсацию |
| `chat_strategy` | Стратегия: `upgrade_to_5` / `delete` / `both` |
| `compensation_type` | Тип компенсации: `cashback` / `refund` |
| `max_compensation` | Максимальная сумма компенсации |

---

## Логирование

### ai_logs таблица

Все AI-вызовы автоматически логируются через `runChatCompletion()`:

```sql
INSERT INTO ai_logs (
  store_id, owner_id,
  entity_type, entity_id, action,
  prompt, response,
  model, tokens_used, cost,
  created_at
) VALUES (...);
```

---

## Связь с компенсациями и жалобами

### Компенсации

1. AI анализирует чат на предмет deletion-кандидата
2. Если `offer_compensation = true` в product_rules:
   - Калькулятор вычисляет сумму (рейтинг → % от max_compensation)
   - AI генерирует персонализированное сообщение
   - Создаётся `deletion_case` в БД
3. Менеджер отправляет → клиент соглашается → удаление/изменение отзыва
4. ROI: 600 руб за успешное удаление

### Жалобы

1. Если клиент НЕ согласился удалить отзыв:
   - Чат закрывается как `completed`
   - Жалоба остаётся/генерируется через стандартный flow
2. Если клиент удалил отзыв:
   - Жалоба не нужна
   - Отзыв помечается как `review_status_wb = 'hidden'`

---

## Авто-рассылка (Auto-Sequence)

Система автоматической рассылки follow-up сообщений для review-linked чатов.
Запускается **только вручную** из TG Mini App (кнопка "Запустить рассылку").

> **Обновлено 2026-02-28:** Все автоматические механизмы запуска удалены (trigger phrases, auto-launch из dialogue sync, auto-create при смене статуса). Рассылки создаются **только вручную** менеджером из TG Mini App.

### Типы рассылок

#### Базовые рассылки (30-дневные, для первого контакта)

| Тип | sequence_type | Рейтинг | Сообщений | Интервал | Общий период |
|-----|---------------|---------|-----------|----------|-------------|
| Негативные | `no_reply_followup_30d` | 1-3★ | 15 | каждые 2 дня | ~30 дней |
| Четвёрки | `no_reply_followup_4star_30d` | 4★ | 10 | каждые 3 дня | ~30 дней |

#### Рассылки по этапам воронки (короткие follow-up, добавлено 2026-03-01)

| Тип | sequence_type | Тег | Сообщений | Интервал | Общий период | Кнопка в TG |
|-----|---------------|-----|-----------|----------|-------------|-------------|
| Напоминание об оффере | `offer_reminder` | `deletion_offered` | 5 | каждые 3 дня | ~14 дней | "Напомнить об оффере" |
| Напоминание об инструкции | `agreement_followup` | `deletion_agreed` | 4 | каждые 2-3 дня | ~10 дней | "Напомнить об инструкции" |
| ~~Follow-up по возврату~~ | ~~`refund_followup`~~ | ~~`refund_requested`~~ | ~~3~~ | ~~каждые 2-3 дня~~ | ~~~7 дней~~ | **Удалён** (migration 024) |

**Логика:** Базовая 30-дневная рассылка запускается для `deletion_candidate`. Если покупатель ответил и диалог продвинулся (тег сменился), но потом замолчал — менеджер запускает короткую рассылку, актуальную для нового этапа.

> Legacy типы `no_reply_followup` и `no_reply_followup_4star` — старая 14-дневная система (trigger-phrase). Новые рассылки создаются только с суффиксом `_30d` или funnel-типами.

### Набор 1: Негативные отзывы (1-3★)

**sequence_type:** `no_reply_followup_30d`

**Follow-up шаблоны (30 дней, ~15 сообщений, каждые 2 дня):**
- Day 0-6: Знакомство, выяснение проблемы, предложение помощи
- Day 8-16: Конкретные предложения компенсации, уточнение деталей
- Day 18-26: Подтверждение готовности помочь, эмоциональная связь
- Day 28-30: Финальные напоминания перед закрытием

**СТОП-сообщение:** Отправляется после завершения всех 15 шагов. Чат закрывается с `completion_reason='no_reply'`.

### Набор 2: Отзывы 4★

**sequence_type:** `no_reply_followup_4star_30d`

**Follow-up шаблоны (30 дней, ~10 сообщений, каждые 3 дня):**
- Day 0-6: Узнаём, чего не хватило до 5 звёзд
- Day 9-18: Предложение бесплатно дополнить/улучшить
- Day 21-27: Подтверждение готовности помочь
- Day 30: Финальное сообщение

### Запуск рассылки (MANUAL ONLY, с 2026-02-28)

Рассылка запускается **только вручную** менеджером из TG Mini App:
- Менеджер открывает детальную страницу чата
- Нажимает кнопку рассылки (текст зависит от текущего тега чата)
- API: `POST /api/telegram/chats/[chatId]/sequence/start`
- Body (опционально): `{ "sequenceType": "deletion_offered" }` — для tag-based рассылок
- **Первое сообщение отправляется сразу** (immediate send), остальные — по расписанию через крон
- Если immediate send успешен → чат переходит в `in_progress`, UI показывает "1/N"
- Если immediate send не удался → fallback к `awaiting_reply`, крон отправит при следующем тике

**Файл:** `src/app/api/telegram/chats/[chatId]/sequence/start/route.ts`
**Shared sender:** `src/lib/auto-sequence-sender.ts`

**Два режима запуска:**

1. **Базовая рассылка** (без `sequenceType` в body):
   - Определение типа по рейтингу: 4★ → `_4star_30d`, остальные → `_30d`
   - Family dedup по `no_reply_followup` / `no_reply_followup_4star`

2. **Tag-based рассылка** (`sequenceType` = имя тега или sequence_type):
   - Маппинг из `TAG_SEQUENCE_CONFIG` в `auto-sequence-templates.ts`
   - Family dedup по `offer_reminder` / `agreement_followup` (~~`refund_followup`~~ удалён, migration 024)

**Проверки при ручном запуске:**
1. Отзыв не resolved (`isReviewResolvedForChat`) — если resolved, возвращает 400
2. Нет активной рассылки для этого чата
3. Нет completed рассылки в той же «семье» (dedup)

### Смена тега из TG Mini App (добавлено 2026-03-01)

Менеджер может вручную продвигать чат по воронке удаления через кнопки в TG Mini App:

```
deletion_candidate → deletion_offered
deletion_offered   → deletion_agreed
deletion_agreed    → deletion_confirmed
```

**API:** `PATCH /api/telegram/chats/[chatId]/status` с полем `tag` в body.

**Допустимые теги для ручной смены:** `deletion_candidate`, `deletion_offered`, `deletion_agreed`, `deletion_confirmed`. *(migration 024: `refund_requested` удалён)*

> **Удалено:** `maybeStartAutoSequence()` из `auto-sequence-launcher.ts` — dead code, не вызывается. Trigger phrase detection из dialogue sync (Step 5b) и OZON sync (Step 3.5) — удалены. Auto-create при смене статуса на `awaiting_reply` — удалён.

### Полный flow

```
1. Chrome Extension открывает чат по отзыву → создаётся review_chat_link
2. Dialogue sync (Step 3.5) reconcile: привязывает chat_id к review_chat_link
3. Менеджер видит чат в TG Mini App → нажимает "Запустить рассылку"
4. → tag = 'deletion_candidate', status = 'awaiting_reply'
5. → Создаётся авто-рассылка (15 или 10 follow-up, каждые 2-3 дня)
6. Cron-job (каждые 30 мин, 8:00-22:00 MSK) отправляет сообщения
7. При каждой отправке: повторная проверка review-resolved + client replied
8. Если клиент ответил → рассылка останавливается, чат → inbox
9. Если все сообщения отправлены → СТОП + status = 'closed' (no_reply)
```

### Защита статуса awaiting_reply

Dialogue sync при обнаружении seller message НЕ переводит `awaiting_reply` → `in_progress`, если есть активная авто-рассылка. Это важно, т.к. cron отправляет follow-up от имени продавца — без этой защиты каждое авто-сообщение сбрасывало бы статус.

**Файл:** `src/app/api/stores/[storeId]/dialogues/update/route.ts` (seller message handler)

### Стоп-условия

| Условие | Результат |
|---------|-----------|
| Клиент ответил | Sequence stopped (`client_replied`), чат → `inbox` |
| Статус изменён вручную (не `awaiting_reply`/`inbox`) | Sequence stopped (`manual`) |
| Review resolved (complaint approved / review deleted) | Sequence stopped (`review_resolved`) |
| Все сообщения отправлены (15 или 10) | СТОП-сообщение + chat closed (`no_reply`) |

### Ручной запуск из TG Mini App

Менеджер может запустить рассылку вручную из детальной страницы чата (кнопка «Запустить рассылку»). При этом чат переходит в `awaiting_reply`.

### Скрипты

| Скрипт | Назначение |
|--------|-----------|
| `scripts/backfill-auto-sequences-30d.mjs` | Массовый backfill 30-дневных рассылок |
| `scripts/migrate-chat-statuses.mjs` | Миграция статусов review-linked чатов |
| `scripts/_check_sequences.mjs` | Диагностика состояния рассылок |

**Таблица:** `chat_auto_sequences` (поле `sequence_type` определяет набор)
**Шаблоны:** `src/lib/auto-sequence-templates.ts`:
- Базовые: `DEFAULT_FOLLOWUP_TEMPLATES_30D`, `DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D`
- По воронке: `DEFAULT_OFFER_REMINDER_TEMPLATES`, `DEFAULT_AGREEMENT_FOLLOWUP_TEMPLATES`, `DEFAULT_REFUND_FOLLOWUP_TEMPLATES`
- Маппинг: `TAG_SEQUENCE_CONFIG` — тег → sequence_type + шаблоны + label
**Ручной запуск:** `src/app/api/telegram/chats/[chatId]/sequence/start/route.ts`
**Cron job:** `startAutoSequenceProcessor` в `src/lib/cron-jobs.ts` (работает с ЛЮБЫМ sequence_type — универсален)
**Review-resolved check:** `src/db/review-chat-link-helpers.ts` → `isReviewResolvedForChat()`
**Dead code:** `src/lib/auto-sequence-launcher.ts` — НЕ вызывается, оставлен для справки

---

## Review-Chat Linking (Sprint 002)

**Проблема:** WB API не связывает отзывы и чаты. Система ведёт два независимых потока — мы не знаем, по какому отзыву идёт конкретный чат.

**Решение:** Chrome-расширение выступает мостом:

```
Страница отзывов WB (Extension)
    ↓ находит отзыв с rejected жалобой
    ↓ кликает "Открыть чат"
    ↓
Вкладка чата WB (Extension)
    ↓ парсит URL чата
    ↓ парсит системное сообщение WB ("Чат с покупателем по товару...")
    ↓
POST /api/extension/chat/opened → review_chat_links (review_key + chat_url)
POST /api/extension/chat/{id}/anchor → system_message_text + parsed_nm_id
    ↓
Dialogue Sync (Step 3.5) → reconciliation: заполняет chat_id
```

### Data flow

| Шаг | Источник | Данные | Таблица |
|-----|----------|--------|---------|
| 1 | Extension → GET rules | starsAllowed, requiredComplaintStatus | product_rules |
| 2 | Extension → POST opened | reviewKey, chatUrl, nmId, rating, date | review_chat_links |
| 3 | Extension → POST anchor | systemMessageText, parsedNmId | review_chat_links |
| 4 | Dialogue sync → Step 3.5 | chat_id (reconciliation) | review_chat_links |

### Условие открытия чата

Чат открывается **только если** жалоба уже отклонена:

```
Путь 1 (бесплатный): Жалоба → WB одобрил → Отзыв удалён ✓
Путь 2 (платный):    Жалоба → WB отклонил → Чат → Компенсация → Удаление ✓
```

### Таблица

`review_chat_links` — связка review ↔ chat:
- `review_id` TEXT FK → reviews (nullable, fuzzy matched)
- `chat_id` TEXT FK → chats (nullable, populated by reconciliation)
- `review_key` TEXT — ключ от расширения (`{nmId}_{rating}_{dateTruncMin}`)
- `chat_url` TEXT — URL чата WB
- `system_message_text` TEXT — системное сообщение WB
- `status` — `chat_opened` → `anchor_found` → `message_sent` → `completed`

### API Endpoints

| Method | Endpoint | Назначение |
|--------|----------|------------|
| GET | `/api/extension/chat/stores` | Магазины с pendingChatsCount |
| GET | `/api/extension/chat/stores/{id}/rules` | Правила по артикулам |
| POST | `/api/extension/chat/opened` | Фиксация открытия чата |
| POST | `/api/extension/chat/{id}/anchor` | Фиксация системного сообщения |
| POST | `/api/extension/chat/{id}/message-sent` | Фиксация отправки сообщения |
| POST | `/api/extension/chat/{id}/error` | Логирование ошибок |

### Файлы

- **Миграция:** `migrations/016_review_chat_links.sql`
- **DB Helpers:** `src/db/review-chat-link-helpers.ts`
- **API Routes:** `src/app/api/extension/chat/`
- **Reconciliation:** `src/app/api/stores/[storeId]/dialogues/update/route.ts` (Step 3.5)
- **Sprint Docs:** `docs/sprints/sprint-002-review-chat-linking/`

### Review-Linked Chat Filtering (Sprint 002, фаза 2)

**Проблема:** Из ~300K+ диалогов с WB, только несколько тысяч — наши (открытые по отзывам). Остальные — обычная клиентская поддержка, не наша зона ответственности.

**Решение:** TG мини-апп и нотификации фильтруют чаты через `INNER JOIN review_chat_links`:

```sql
-- Вместо: JOIN products + product_rules WHERE work_in_chats = TRUE
-- Теперь: INNER JOIN review_chat_links → только наши чаты
INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
JOIN products p ON p.store_id = c.store_id AND c.product_nm_id = p.wb_product_id
JOIN product_rules pr ON p.id = pr.product_id AND pr.work_in_chats = TRUE
```

**Эффект:** ~90% снижение шума (тысячи → десятки-сотни чатов в очереди).

**Где применяется:**
1. **TG очередь** (`src/db/telegram-helpers.ts`) — `getUnifiedChatQueue()`, `getUnifiedChatQueueCount()`, `getUnifiedChatQueueCountsByStatus()`
2. **TG нотификации** (`src/app/api/stores/[storeId]/dialogues/update/route.ts`, Step 5a-tg) — фильтрует `clientRepliedChats` по `review_chat_links`
3. **Вкладка Чаты** (`src/db/helpers.ts`) — параметр `reviewLinkedOnly=true`

**НЕ затрагивает:**
- Dialogue sync — продолжает синхронизировать ВСЕ чаты (нужно для reconciliation)
- Extension tasks API — уже правильно фильтрует

### Обогащённые данные чатов (Review Enrichment)

Чаты, привязанные к отзывам через `review_chat_links`, обогащены данными из `reviews` и `product_rules`. Работает в **основном ПО** и **TG мини-апп**.

**Доступные поля (10 полей):**
- `reviewRating` — рейтинг отзыва (1-5)
- `reviewDate` — дата отзыва
- `reviewText` — текст самого отзыва
- `complaintStatus` — статус жалобы
- `productStatus` — статус товара (purchased/refused/returned)
- `offerCompensation` — предлагать кешбек (boolean)
- `maxCompensation` — макс. сумма
- `compensationType` — тип
- `compensationBy` — кто платит (r5/seller)
- `chatStrategy` — стратегия (upgrade_to_5/delete/both)

**SQL (из `helpers.ts` и `telegram-helpers.ts`):**
```sql
-- Из review_chat_links:
rcl.review_rating, rcl.review_date

-- Из reviews (LEFT JOIN через rcl.review_id):
r.text as review_text,
r.complaint_status, r.product_status_by_review as product_status

-- Из product_rules (LEFT JOIN через products):
pr.offer_compensation, pr.max_compensation,
pr.compensation_type, pr.compensation_by,
pr.chat_strategy::text as chat_strategy
```

**Основное ПО (вкладка Чаты):**
- **Kanban карточка** (`ChatKanbanCard.tsx`) — рейтинг (цветные звёзды) + дата отзыва
- **ChatPreviewModal** — рейтинг + дата в хедере, раскрываемая секция "Детали" (стратегия, кешбек, жалоба, текст отзыва)
- **SQL:** `getChatsByStoreWithPagination()` — всегда LEFT JOIN rcl (INNER при `reviewLinkedOnly=true`)
- **API list:** `/api/stores/:storeId/chats` — 10 полей в response
- **API detail:** `/api/stores/:storeId/chats/:chatId` — inline SQL с JOINs + 10 полей

**TG мини-апп:**
- **Карточка** (`TgQueueCard.tsx`) — рейтинг + дата
- **Детальный вид** (`tg/chat/[chatId]/page.tsx`) — раскрываемые чипсы + текст отзыва
- **SQL:** `getUnifiedChatQueue()` — INNER JOIN rcl + LEFT JOIN reviews/product_rules
- **API queue:** `/api/telegram/queue` — все 10 полей + `reviewText`
- **API detail:** `/api/telegram/chats/:chatId` — все 10 полей + `reviewText`

**Файлы:**
- `src/db/helpers.ts` — SQL: LEFT JOIN rcl + reviews + product_rules, Chat interface
- `src/db/telegram-helpers.ts` — SQL: INNER JOIN rcl, QueueChat interface
- `src/app/api/stores/[storeId]/chats/route.ts` — API list маппинг
- `src/app/api/stores/[storeId]/chats/[chatId]/route.ts` — API detail (inline SQL)
- `src/app/api/telegram/queue/route.ts` — TG queue маппинг
- `src/app/api/telegram/chats/[chatId]/route.ts` — TG detail маппинг
- `src/types/chats.ts` — Frontend Chat interface (10 optional fields)
- `src/components/chats/ChatKanbanCard.tsx` — UI: рейтинг badge
- `src/components/chats/ChatPreviewModal.tsx` — UI: expandable "Детали"
- `src/components/telegram/TgQueueCard.tsx` — TG UI карточка
- `src/app/(telegram)/tg/chat/[chatId]/page.tsx` — TG UI деталей

### Будущие возможности (Фаза 3)

- AI получает текст отзыва при генерации ответа в чате
- Закрытие чата при обнаружении удаления отзыва
- Аналитика: воронка review → complaint → chat → deletion

---

## Нереализованный функционал

| Функционал | Статус | Где находится |
|------------|--------|---------------|
| autoSend для deletion offers | TODO в коде | generate-deletion-offer route, строка ~254 |
| Messenger View (split-screen) | Не реализован | - |
| Режимы AI (auto/supervised) | Планируется | - |
| ~~Персонализация по кабинетам~~ | **Реализовано (2026-02-10)** | `stores.ai_instructions` + `store_faq` + `store_guides` |

---

## Связанные документы

- [Спецификация чатов](../product-specs/CHATS_FEATURE_SPEC.md)
- [Kanban Board](../product-specs/KANBAN_BOARD_IMPLEMENTATION.md)
- [Логика жалоб](./complaints.md)
- [Статусы (reference)](../reference/statuses-reference.md)
- [Database Schema](../database-schema.md)
- [Sprint 002: Review-Chat Linking](../sprints/sprint-002-review-chat-linking/README.md)

---

**Last Updated:** 2026-03-04
