# Домен: AI в чатах

**Дата:** 2026-02-09
**Версия:** 2.0
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

### ChatTag (12 тегов) — классификация чата

> Source of truth: `src/types/chats.ts`

**Стандартные (6):**

| Тег | Описание | Критерии |
|-----|----------|----------|
| `active` | Активный диалог | Требует ответа продавца |
| `successful` | Успешно решён | Проблема решена, клиент доволен |
| `unsuccessful` | Не решён | Проблема НЕ решена, клиент недоволен |
| `no_reply` | Нет ответа | Продавец не ответил на сообщение клиента |
| `untagged` | Не классифицирован | Недостаточно контекста для классификации |
| `completed` | Завершён | Диалог окончен, действий не требуется |

**Deletion workflow (6):**

| Тег | Описание | Критерии |
|-----|----------|----------|
| `deletion_candidate` | Кандидат на удаление | AI обнаружил возможность удаления/изменения отзыва |
| `deletion_offered` | Оффер отправлен | Предложение компенсации отправлено клиенту |
| `deletion_agreed` | Клиент согласился | Клиент согласился удалить/изменить отзыв |
| `deletion_confirmed` | Отзыв удалён/изменён | Подтверждено удаление или изменение отзыва |
| `refund_requested` | Запрос возврата | Клиент просит возврат без упоминания отзыва |
| `spam` | Спам | Спам, конкуренты, автоматические сообщения |

### ChatStatus (4 статуса Kanban)

> Source of truth: `src/types/chats.ts`

| Статус | Описание | Использование |
|--------|----------|---------------|
| `inbox` | Входящие | Новые/необработанные чаты |
| `in_progress` | В работе | Менеджер работает с чатом |
| `awaiting_reply` | Ожидание ответа | Ждём ответа клиента (триггер для авто-рассылки) |
| `closed` | Закрыто | Диалог закрыт (требует `completion_reason`) |

> `resolved` удалён в migration 008.

**Важно:** ChatTag = AI-классификация содержимого. ChatStatus = позиция на Kanban-доске (управляется вручную).

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
  tag: ChatTag;              // Один из 12 тегов
  confidence: number;        // 0-1
  reasoning?: string;        // Обоснование AI
  triggers?: string[];       // Обнаруженные триггерные фразы
}
```

**Промпт:** `user_settings.prompt_chat_tag`

---

### 3. Classify Chat Deletion

**Flow:** `src/ai/flows/classify-chat-deletion-flow.ts`

**Назначение:** Определение, подходит ли чат для сценария удаления отзыва. Двухэтапный подход: regex + AI.

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
  tag: ChatTag;              // Один из 12 тегов
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
  └── Fallback: если AI упал → используем regex-результат
```

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

**Промпт:** Hardcoded в `src/ai/prompts/chat-deletion-classification-prompt.ts` (~3800 символов, русский язык)

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

| Рейтинг отзыва | % от max_compensation |
|----------------|----------------------|
| 1 звезда | 100% |
| 2 звезды | 80% |
| 3 звезды | 60% |
| 4 звезды | 40% |
| 5 звёзд | 20% |

Минимальное предложение: 50 руб.

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
[AI классифицирует каждый чат (12 тегов)]
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

> Отправляет draft_reply для каждого чата. Меняет статус на `awaiting_reply`.

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

### buildStoreInstructions(storeId, aiInstructions?)

```typescript
async function buildStoreInstructions(
  storeId: string,
  aiInstructions?: string | null
): Promise<string | undefined>
```

**Объединяет:**

1. **AI Instructions** (`stores.ai_instructions`) — свободный текст: тон, правила, ограничения
2. **FAQ** (`store_faq`) — пары вопрос-ответ, форматируются как `## FAQ магазина\nВ: ...\nО: ...`
3. **Guides** (`store_guides`) — пошаговые инструкции, форматируются как `## Инструкции для клиентов\n### Title\nContent`

**Используется в 6 customer-facing flows:**
- generate-chat-reply
- classify-chat-tag
- classify-chat-deletion
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

Система автоматической рассылки follow-up сообщений для чатов в статусе `awaiting_reply`.
Поддерживает **два набора шаблонов** для разных типов отзывов.

### Набор 1: Негативные отзывы (1-2-3 звезды)

**sequence_type:** `no_reply_followup`

**СТАРТ-сообщение** (отправляется менеджером/AI клиенту):
```
Здравствуйте! 👋
Мы увидели ваш отзыв и очень хотим разобраться, что именно пошло не так.
Подскажите, пожалуйста, что больше всего расстроило: качество, упаковка, ожидания, доставка или что-то ещё? 🙏
```
**Ключевая фраза:** `Мы увидели ваш отзыв и очень хотим разобраться`
**Хранение:** `user_settings.no_reply_trigger_phrase` (или `DEFAULT_TRIGGER_PHRASE`)

**СТОП-сообщение** (после 14 дней без ответа):
```
Спасибо вам за обращение и за то, что поделились впечатлениями 🙏
Мы получили много обратной связи по этому товару и поняли, над чем нам нужно поработать...
```
**Хранение:** `user_settings.no_reply_stop_message` (или `DEFAULT_STOP_MESSAGE`)

**Follow-up шаблоны (14 дней, 4 фазы):**
- Day 1-3: Мягкие напоминания о предложении
- Day 4-7: Уточнение, ожидание ответа
- Day 8-11: Подтверждение актуальности предложения
- Day 12-14: Финальные напоминания перед закрытием

### Набор 2: Отзывы 4 звезды

**sequence_type:** `no_reply_followup_4star`

**СТАРТ-сообщение:** Ожидает настройки (будет другое, не как для негатива)
**Ключевая фраза:** `user_settings.no_reply_trigger_phrase2` (пока не настроена, набор неактивен)

**СТОП-сообщение** (после 14 дней без ответа):
```
Спасибо за вашу оценку и обратную связь! 🙏
Мы рады, что товар вам в целом понравился. Ваши замечания очень ценны для нас...
```
**Хранение:** `user_settings.no_reply_stop_message2` (или `DEFAULT_STOP_MESSAGE_4STAR`)

**Follow-up шаблоны (14 дней, 4 фазы):**
- Day 1-3: Узнаём, чего не хватило до 5 звёзд
- Day 4-7: Предложение бесплатно дополнить/улучшить
- Day 8-11: Подтверждение готовности помочь
- Day 12-14: Финальные напоминания

**Логика выбора набора:** Если сообщение совпало с `trigger_phrase` → набор 1. Если с `trigger_phrase2` → набор 2. Если совпали оба → набор 1 (приоритет).

### Полный flow

```
1. Менеджер (или AI) отправляет СТАРТ-сообщение клиенту
2. Dialogue sync обнаруживает триггерную фразу в новом seller-сообщении
3. Определяется набор шаблонов (набор 1 или 2 по trigger phrase)
4. → tag = 'deletion_candidate', status = 'awaiting_reply'
5. → Создаётся авто-рассылка (14 follow-up, 1/день) с соответствующим sequence_type
6. Cron-job (каждые 30 мин, 8:00-22:00 MSK) отправляет сообщения
7. Если клиент ответил → рассылка останавливается
8. Если 14 дней без ответа → СТОП-сообщение (по sequence_type) + status = 'closed' (no_reply)
```

### Стоп-условия

| Условие | Результат |
|---------|-----------|
| Клиент ответил | Sequence stopped (`client_replied`) |
| Статус изменён (не `awaiting_reply`) | Sequence stopped (`manual`) |
| 14 сообщений отправлено | СТОП-сообщение (набор 1 или 2) + chat closed (`no_reply`) |

**Таблица:** `chat_auto_sequences` (поле `sequence_type` определяет набор)
**Шаблоны:** `src/lib/auto-sequence-templates.ts` (дефолты) или `user_settings` (кастомные)
**Cron job:** `startAutoSequenceProcessor` в `src/lib/cron-jobs.ts`
**Trigger detection:** `src/app/api/stores/[storeId]/dialogues/update/route.ts` (Step 5b)

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
- Авто-создание auto-sequence при открытии linked чата
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

**Last Updated:** 2026-02-22
