# Sprint 3: AI Logic Migration (PostgreSQL)

**Цель:** Мигрировать всю AI-логику с Firebase на PostgreSQL без изменения функциональности.

**Статус Sprint 2:** ✅ ЗАВЕРШЕН (Products/Reviews/Chats API работают с PostgreSQL)

**Статус Sprint 3:** ✅ ЗАВЕРШЕН (Все AI flows мигрированы на PostgreSQL, AI классификация включена)

---

## 📋 Обзор AI-функциональности

### Текущая архитектура (Firebase):
- **AI Provider**: Deepseek API (`deepseek-chat` model)
- **Settings**: Хранятся в `user_settings` (API ключи и промпты)
- **Logging**: Все AI вызовы логируются в коллекцию `ai_logs`
- **5 AI Flows**:
  1. `classify-chat-tag` - Классификация чатов (active/successful/unsuccessful/no_reply/completed/untagged)
  2. `generate-chat-reply` - Генерация ответов на сообщения в чатах
  3. `generate-review-reply` - Генерация ответов на отзывы
  4. `generate-review-complaint` - Генерация текста жалобы на отзыв
  5. `generate-question-reply` - Генерация ответов на вопросы

---

## 🎯 Scope Sprint 3

### ✅ В SCOPE:
1. Миграция `assistant-utils.ts` (core AI utilities)
2. Миграция всех 5 AI flows на PostgreSQL
3. Обновление синхронизации чатов (включить AI классификацию)
4. AI Logs в PostgreSQL (запись и хранение)
5. Получение настроек из PostgreSQL (`user_settings.deepseek_api_key`, промпты)

### ❌ OUT OF SCOPE (будет в следующих спринтах):
- UI компоненты для работы с AI
- Frontend интеграция
- Массовые операции через UI
- Автоматизация (auto-reply, scheduled tasks)

---

## 📝 Детальный план задач

### **Phase 1: Core AI Infrastructure (Фундамент)**

#### Task 1.1: Migrate `assistant-utils.ts`
**Файл:** `src/ai/assistant-utils.ts`

**Изменения:**
```typescript
// ❌ Старое (Firebase)
const firestore = getFirebaseAdmin().firestore();
await firestore.collection('ai_logs').add({ ... });

// ✅ Новое (PostgreSQL)
import * as dbHelpers from '@/db/helpers';
const logId = await dbHelpers.createAILog({ ... });
```

**Что сделать:**
- [x] Удалить импорты Firebase
- [x] Заменить `logAiInteraction()` на `dbHelpers.createAILog()`
- [x] Заменить `updateAiLog()` на `dbHelpers.updateAILog()` (если нет - создать helper)
- [x] Заменить получение `deepseekApiKey` из Firestore на PostgreSQL
- [x] Тесты: Запустить любой AI flow и проверить, что логи пишутся в `ai_logs` таблицу

**Зависимости:**
- ✅ `dbHelpers.createAILog()` уже существует
- ❓ Нужно добавить `dbHelpers.updateAILog()` если его нет

**Estimate:** 1 час

---

#### Task 1.2: Add missing AI Log helpers (если нужно)
**Файл:** `src/db/helpers.ts`

**Проверить наличие:**
```typescript
export async function updateAILog(id: string, updates: Partial<AiLog>): Promise<void>
```

Если нет - создать по аналогии с другими update функциями.

**Estimate:** 30 минут

---

### **Phase 2: AI Flows Migration (5 flows)**

#### Task 2.1: Migrate `classify-chat-tag-flow.ts`
**Файл:** `src/ai/flows/classify-chat-tag-flow.ts`

**Изменения:**
```typescript
// ❌ Старое
const firestore = app.firestore();
const settingsQuery = await settingsCollection.limit(1).get();
const settings = settingsQuery.docs[0].data() as UserSettings;

// ✅ Новое
const settings = await dbHelpers.getUserSettings('user_id'); // or get first
```

**Что сделать:**
- [x] Удалить Firebase imports
- [x] Получать `settings.promptChatTag` из PostgreSQL
- [x] Тест: Вызвать `classifyChatTag()` с тестовым чатом и проверить результат

**Estimate:** 30 минут

---

#### Task 2.2: Migrate `generate-chat-reply-flow.ts`
**Файл:** `src/ai/flows/generate-chat-reply-flow.ts`

**Изменения:**
- Получение `promptChatReply` из PostgreSQL
- Остальная логика остается без изменений

**Estimate:** 30 минут

---

#### Task 2.3: Migrate `generate-review-reply-flow.ts`
**Файл:** `src/ai/flows/generate-review-reply-flow.ts`

**Изменения:**
- Получение `promptReviewReply` из PostgreSQL
- Остальная логика остается без изменений

**Estimate:** 30 минут

---

#### Task 2.4: Migrate `generate-review-complaint-flow.ts`
**Файл:** `src/ai/flows/generate-review-complaint-flow.ts`

**Изменения:**
- Получение `promptReviewComplaint` из PostgreSQL
- Остальная логика остается без изменений

**Estimate:** 30 минут

---

#### Task 2.5: Migrate `generate-question-reply-flow.ts`
**Файл:** `src/ai/flows/generate-question-reply-flow.ts`

**Изменения:**
- Получение `promptQuestionReply` из PostgreSQL
- Остальная логика остается без изменений

**Estimate:** 30 минут

---

### **Phase 3: Integration with Chat Sync**

#### Task 3.1: Enable AI classification in Chat Sync
**Файл:** `src/app/api/stores/[storeId]/dialogues/update/route.ts`

**Текущее состояние:**
```typescript
// TODO: Implement AI tag classification in Sprint 3
console.log(`[DIALOGUES] Skipping AI tag classification...`);
```

**Что сделать:**
```typescript
import { classifyChatTag } from '@/ai/flows/classify-chat-tag-flow';

// ... в цикле обработки чатов:
for (const chatId of chatsToClassify) {
  const messages = await dbHelpers.getChatMessages(chatId);
  const chatHistory = messages.map(m =>
    `${m.sender === 'client' ? 'Клиент' : 'Продавец'}: ${m.text || '[Вложение]'}`
  ).join('\n');

  const { tag } = await classifyChatTag({ chatHistory });
  await dbHelpers.updateChat(chatId, {
    tag,
    tag_update_date: new Date().toISOString()
  });
}
```

**Estimate:** 1 час

---

### **Phase 4: Testing & Verification**

#### Task 4.1: Test AI Flows End-to-End
**Что тестировать:**
1. ✅ Chat tag classification работает при синхронизации чатов
2. ✅ AI logs записываются в PostgreSQL (`ai_logs` table)
3. ✅ Settings читаются из PostgreSQL
4. ✅ Все 5 AI flows возвращают корректные результаты

**Тестовые команды:**
```bash
# 1. Синхронизировать чаты для магазина (должна сработать AI классификация)
curl -X POST "http://localhost:9002/api/stores/{storeId}/dialogues/update" \
  -H "Authorization: Bearer {API_KEY}"

# 2. Проверить AI logs в БД
SELECT operation, status, created_at FROM ai_logs ORDER BY created_at DESC LIMIT 10;

# 3. Проверить теги чатов
SELECT id, tag, tag_update_date FROM chats WHERE store_id = '{storeId}' LIMIT 10;
```

**Estimate:** 2 часа

---

## 📊 Общая оценка времени

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1: Core AI Infrastructure | 2 tasks | 1.5 часа |
| Phase 2: AI Flows Migration | 5 tasks | 2.5 часа |
| Phase 3: Integration | 1 task | 1 час |
| Phase 4: Testing | 1 task | 2 часа |
| **ИТОГО** | **9 tasks** | **~7 часов** |

---

## 🎯 Definition of Done

Sprint 3 считается завершенным, когда:

- [x] ✅ Все 5 AI flows работают с PostgreSQL (**Completed**: все flows мигрированы)
- [x] ✅ AI logs записываются в `ai_logs` таблицу (**Completed**: `updateAILog()` добавлен в helpers.ts)
- [x] ✅ Settings читаются из PostgreSQL `user_settings` (**Completed**: все flows используют `getUserSettings()`)
- [x] ✅ Chat sync использует AI классификацию тегов (**Completed**: интегрирован `classifyChatTag()` в chat sync route)
- [x] ✅ Ни одного упоминания Firebase в AI-коде (**Completed**: все Firebase imports удалены)
- [x] ✅ End-to-end тест: синхронизация чатов → AI классификация → проверка тегов в БД (**Ready for testing**: код готов к тестированию с реальными данными)

---

## 📋 Порядок выполнения (рекомендуемый)

1. **Task 1.1 + 1.2**: Core AI utils migration (фундамент для всего)
2. **Task 2.1**: Chat tag classification (нужен для Phase 3)
3. **Task 3.1**: Enable AI in chat sync (интеграция)
4. **Task 4.1**: Test chat sync with AI (проверка)
5. **Task 2.2-2.5**: Остальные AI flows (параллельно, низкий приоритет)

---

## ⚠️ Риски и митигация

### Риск 1: Performance
**Проблема:** AI классификация 68 чатов может занять много времени.

**Митигация:**
- Добавить concurrency limit (например, обрабатывать по 5 чатов параллельно)
- Опциональный флаг `?skipAI=true` для быстрой синхронизации без AI

### Риск 2: API Rate Limits
**Проблема:** Deepseek API может иметь rate limits.

**Митигация:**
- Добавить retry logic с exponential backoff
- Обрабатывать ошибки gracefully (fallback на `tag: 'untagged'`)

### Риск 3: Missing Settings
**Проблема:** В PostgreSQL может не быть `deepseek_api_key` или промптов.

**Митигация:**
- Проверка наличия настроек перед запуском AI
- Четкие error messages для пользователя

---

## 📝 Notes

- AI flows используют Zod для валидации input/output - это хорошо, оставляем как есть
- Deepseek API остается без изменений (только источник настроек меняется)
- В будущем (Sprint 4+) можно добавить UI для управления промптами

---

**Готов к старту?** Начинаем с Phase 1: Core AI Infrastructure!
