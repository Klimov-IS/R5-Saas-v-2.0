# Chat Status & Tagging System — Product Analysis & Recommendations

**Дата:** 2026-01-22
**Автор:** Product Manager
**Статус:** Proposal для обсуждения
**Цель:** Оптимизировать систему управления чатами для менеджеров + максимизировать ROI от диалогов

---

## 📊 Текущее состояние (Gap Analysis)

### Что есть сейчас:

#### 1. **Текущие "теги" (на самом деле статусы)**
```typescript
type ChatTag =
  | 'untagged'            // 🔘 Не обработан (79% чатов!)
  | 'active'              // 🟢 Активный диалог
  | 'successful'          // ✅ Успешно решено
  | 'unsuccessful'        // ❌ Неуспешно
  | 'no_reply'            // 🟡 Нет ответа
  | 'completed'           // ✔️ Завершен

  // + 6 новых тегов для deletion workflow (недавно добавлены):
  | 'deletion_candidate'  // 🎯 Кандидат на удаление отзыва
  | 'deletion_offered'    // 💰 Отправлено предложение компенсации
  | 'deletion_agreed'     // 🤝 Клиент согласился
  | 'deletion_confirmed'  // ✔️ Отзыв удален (600₽ выручка!)
  | 'refund_requested'    // 💸 Запрошен возврат
  | 'spam'                // 🚫 Спам/конкуренты
```

**Итого: 12 "тегов"** (но это НЕ теги, это СТАТУСЫ!)

---

### 2. **Как теги назначаются сейчас:**

#### Вариант А: AI-классификация (автоматически)
- **Endpoint:** `POST /api/stores/:storeId/chats/classify-all`
- **Логика:** AI анализирует историю переписки → возвращает тег
- **Промпт:** `user_settings.prompt_chat_tag` (из БД)
- **Проблема:**
  - ❌ 79% чатов = 'untagged' (AI не запускалась или не смогла классифицировать)
  - ❌ Нет автоматического trigger при получении нового чата
  - ❌ Менеджер должен вручную нажать "Классифицировать" → долго

#### Вариант Б: Ручная установка тега (менеджером)
- **Где:** В детальной карточке чата `/chats/[chatId]`
- **UI:** Dropdown select с 12 тегами
- **Проблема:**
  - ❌ Менеджер должен открыть каждый чат → выбрать тег → сохранить
  - ❌ Долго при 100+ чатах
  - ❌ Субъективная оценка (разные менеджеры = разные теги)

---

### 3. **Что работает плохо:**

#### ❌ Проблема 1: Теги = Статусы (смешение концепций)
Текущие "теги" на самом деле описывают **статус воронки продаж**, а не **категорию проблемы**.

**Пример:**
- `deletion_candidate` → Это **статус воронки** (клиент готов удалить отзыв)
- Но **почему** он готов? Из-за брака? Неправильной доставки? Цены? → Нет тега!

#### ❌ Проблема 2: Нет Kanban/CRM workflow
Менеджер НЕ может:
- Увидеть воронку диалогов (сколько на каждом этапе)
- Перетащить чат из "Непрочитанные" → "В работе" → "Завершен"
- Фильтровать по статусу + сортировать по приоритету

#### ❌ Проблема 3: Нет реальных тегов для категоризации
Менеджер НЕ может:
- Пометить чат как "Брак", "Доставка", "Возврат", "Вопрос о товаре"
- Найти все чаты про "Овощечистка + Брак"
- Понять, какая категория проблем самая частая

---

## 🎯 Предлагаемое решение: Двухуровневая система

### Концепция: **СТАТУС + ТЕГИ**

```
┌─────────────────────────────────────────────────────────────┐
│ УРОВЕНЬ 1: СТАТУС (Status) — Воронка CRM                   │
│ Описывает: На каком этапе обработки находится чат          │
│ Назначается: Автоматически AI + Вручную (drag & drop)      │
│ UI: Kanban Board / Pipeline View                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ УРОВЕНЬ 2: ТЕГИ (Tags) — Категории проблем                 │
│ Описывает: Тип проблемы/запроса клиента                    │
│ Назначается: AI + Вручную (multiple tags allowed)          │
│ UI: Multi-select badges / Tag pills                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 УРОВЕНЬ 1: Статусы (Chat Status) — Воронка CRM

### Рекомендуемые статусы:

```typescript
type ChatStatus =
  | 'inbox'           // 📥 Входящие (новые, непрочитанные)
  | 'in_progress'     // 🔄 В работе (менеджер взял в обработку)
  | 'awaiting_reply'  // ⏳ Ожидание ответа клиента
  | 'resolved'        // ✅ Решено (успешно)
  | 'closed'          // 🔒 Закрыто (завершено, архив)
```

### Kanban Board Layout:

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ 📥 Входящие │ 🔄 В работе │ ⏳ Ожидание │ ✅ Решено   │ 🔒 Закрыто  │
│   (inbox)   │(in_progress)│(await_reply)│ (resolved)  │  (closed)   │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│             │             │             │             │             │
│  Chat #1    │  Chat #5    │  Chat #8    │  Chat #12   │  Chat #20   │
│  🏷️ Брак    │  🏷️ Возврат │  🏷️ Доставка│  🏷️ Вопрос │  🏷️ Спам    │
│  2 мин назад│  15 мин     │  1 час      │  Вчера      │  3 дня      │
│             │             │             │             │             │
│  Chat #2    │  Chat #6    │  Chat #9    │  Chat #13   │  Chat #21   │
│  🏷️ Доставка│  🏷️ Брак    │  🏷️ Возврат │  🏷️ Удаление│             │
│  5 мин назад│  20 мин     │  2 часа     │  Вчера      │             │
│             │             │             │             │             │
│  [+ 23]     │  [+ 8]      │  [+ 5]      │  [+ 42]     │  [+ 156]    │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
    Drag & Drop между колонками →
```

### Автоматические переходы:

```typescript
// Workflow правила:
inbox → in_progress        // Менеджер открыл чат
in_progress → awaiting_reply  // Менеджер отправил сообщение
awaiting_reply → in_progress  // Клиент ответил
in_progress → resolved     // Менеджер нажал "Решено"
resolved → closed          // Автоматически через 7 дней
```

---

## 🏷️ УРОВЕНЬ 2: Теги (Chat Tags) — Категории

### Рекомендуемые теги (множественные):

#### **Категория А: Тип проблемы**
```typescript
type ProblemTag =
  | 'defect'        // 🔧 Брак/дефект
  | 'delivery'      // 📦 Проблема с доставкой
  | 'quality'       // ⚠️ Не соответствует качеству
  | 'size'          // 📏 Не подошел размер
  | 'description'   // 📝 Не соответствует описанию
  | 'damage'        // 💥 Поврежден при доставке
```

#### **Категория Б: Намерение клиента**
```typescript
type IntentTag =
  | 'refund'           // 💸 Хочет возврат денег
  | 'replacement'      // 🔄 Хочет замену товара
  | 'delete_review'    // 🎯 Готов удалить отзыв (600₽ opportunity!)
  | 'upgrade_review'   // ⭐ Готов повысить оценку
  | 'question'         // ❓ Просто вопрос
  | 'complaint'        // 😤 Жалоба без конкретного запроса
```

#### **Категория В: Приоритет (автоматический)**
```typescript
type PriorityTag =
  | 'hot_lead'      // 🔥 Горячий лид (упомянул "удалю отзыв")
  | 'high_value'    // 💎 Дорогой товар (>5000₽)
  | 'repeat_customer' // 🔁 Постоянный клиент (>3 заказов)
  | 'negative_review' // ⚠️ Оставил отзыв 1-2★
```

#### **Категория Г: Специальные**
```typescript
type SpecialTag =
  | 'spam'          // 🚫 Спам/конкуренты
  | 'vip'           // 👑 VIP клиент
  | 'escalated'     // 🚨 Эскалирован в поддержку WB
```

### Как применяются теги:

**Пример чата:**
```
Status: in_progress
Tags: ['defect', 'refund', 'hot_lead', 'high_value']

Перевод:
- Статус: В работе
- Проблема: Брак товара
- Намерение: Хочет возврат
- Приоритет: Упомянул удаление отзыва + Дорогой товар
```

---

## 🎨 UI/UX Recommendations

### 1. Основной вид: **Kanban Board** (по умолчанию)

```tsx
<div className="kanban-container">
  {/* Header с фильтрами */}
  <div className="kanban-header">
    <h1>💬 Чаты ({totalCount})</h1>

    {/* Фильтры по тегам */}
    <TagFilter
      tags={allTags}
      selected={selectedTags}
      onChange={handleTagFilterChange}
    />

    {/* Переключение view */}
    <ViewToggle active="kanban" onToggle={setView} />
  </div>

  {/* Kanban columns */}
  <div className="kanban-board">
    <KanbanColumn status="inbox" title="📥 Входящие" count={23} />
    <KanbanColumn status="in_progress" title="🔄 В работе" count={8} />
    <KanbanColumn status="awaiting_reply" title="⏳ Ожидание" count={5} />
    <KanbanColumn status="resolved" title="✅ Решено" count={42} />
    <KanbanColumn status="closed" title="🔒 Закрыто" count={156} />
  </div>
</div>
```

**Drag & Drop:**
- Перетаскивание чата между колонками → автоматически меняет статус
- Библиотека: `@dnd-kit/core` (уже совместима с Next.js)

---

### 2. Альтернативный вид: **Table View** (для работы с большим объемом)

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead><Checkbox /> Выбрать все</TableHead>
      <TableHead>Клиент</TableHead>
      <TableHead>Товар</TableHead>
      <TableHead>Статус</TableHead>
      <TableHead>Теги</TableHead>
      <TableHead>Последнее сообщение</TableHead>
      <TableHead>Обновлено</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {chats.map(chat => (
      <TableRow key={chat.id}>
        <TableCell><Checkbox /></TableCell>
        <TableCell>{chat.client_name}</TableCell>
        <TableCell>{chat.product_name}</TableCell>
        <TableCell>
          <StatusBadge status={chat.status} />
        </TableCell>
        <TableCell>
          <TagPills tags={chat.tags} />
        </TableCell>
        <TableCell className="truncate">{chat.last_message_text}</TableCell>
        <TableCell>{formatRelativeTime(chat.updated_at)}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### 3. Детальная карточка чата (правая панель)

```tsx
<ChatDetailPanel chatId={selectedChatId}>
  {/* Header */}
  <div className="chat-header">
    <h2>{chat.client_name}</h2>
    <div className="chat-meta">
      <span>Товар: {chat.product_name}</span>
      <span>Последнее сообщение: 5 мин назад</span>
    </div>
  </div>

  {/* Status & Tags */}
  <div className="chat-status-tags">
    {/* Статус - single select */}
    <Select value={chat.status} onChange={handleStatusChange}>
      <SelectItem value="inbox">📥 Входящие</SelectItem>
      <SelectItem value="in_progress">🔄 В работе</SelectItem>
      <SelectItem value="awaiting_reply">⏳ Ожидание ответа</SelectItem>
      <SelectItem value="resolved">✅ Решено</SelectItem>
      <SelectItem value="closed">🔒 Закрыто</SelectItem>
    </Select>

    {/* Теги - multi select */}
    <TagSelector
      tags={allTags}
      selected={chat.tags}
      onChange={handleTagsChange}
      multiple={true}
    />
  </div>

  {/* AI Insights (опционально) */}
  <AIInsightCard>
    <p>🎯 Высокая вероятность удаления отзыва (95%)</p>
    <p>💰 Рекомендуемая компенсация: 500-1000₽</p>
    <Button onClick={generateDeletionOffer}>
      Сгенерировать предложение
    </Button>
  </AIInsightCard>

  {/* Message History */}
  <MessageHistory messages={chat.messages} />

  {/* Reply Box */}
  <ReplyBox chatId={chat.id} />
</ChatDetailPanel>
```

---

## 🤖 AI Integration Strategy

### Когда и как AI назначает статусы/теги:

#### 1. **При синхронизации новых чатов** (event-driven)
```typescript
// src/app/api/stores/[storeId]/chats/update/route.ts

// После sync новых чатов:
for (const newChat of newlyFetchedChats) {
  // AI классификация:
  const { status, tags, priority } = await classifyNewChat({
    chatHistory: newChat.messages,
    productInfo: newChat.product,
    clientHistory: await getClientHistory(newChat.client_name),
  });

  // Сохранить в БД:
  await updateChat(newChat.id, {
    status,        // 'inbox' | 'in_progress' | ...
    tags,          // ['defect', 'refund', 'hot_lead']
    ai_classified: true,
    ai_confidence: priority.confidence,
  });
}
```

#### 2. **Bulk классификация** (ручной trigger менеджером)
```typescript
// POST /api/stores/:storeId/chats/classify-all

// Менеджер нажимает кнопку "Классифицировать все"
// → AI обрабатывает все unclassified чаты
// → Показывает прогресс: "15/100 классифицировано..."
```

#### 3. **Real-time классификация** (при получении нового сообщения)
```typescript
// Webhook от WB → Новое сообщение в чате

// Проверить, изменился ли intent:
const previousTags = chat.tags;
const { tags: newTags } = await classifyChat(chat);

if (hasNewTag(newTags, 'hot_lead')) {
  // 🔥 Клиент упомянул "удалю отзыв"!
  // → Уведомить менеджера
  // → Изменить статус на 'in_progress'
  // → Добавить в приоритетную очередь
}
```

---

## 🗄️ Database Schema Changes

### Новая таблица: `chat_statuses` (опционально, для истории)

```sql
CREATE TABLE chat_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,

  -- Status change
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,  -- 'ai' | user_id
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Context
  reason TEXT,  -- "Client mentioned deletion", "Manager marked resolved", etc.

  INDEX idx_chat_status_history_chat (chat_id, changed_at DESC)
);
```

### Изменения в таблице `chats`:

```sql
ALTER TABLE chats
  -- Переименовать поле (migration)
  RENAME COLUMN tag TO status;  -- 'tag' → 'status'

  -- Добавить новое поле для тегов
  ADD COLUMN tags TEXT[] DEFAULT '{}',  -- Multiple tags: ['defect', 'refund']

  -- AI metadata
  ADD COLUMN ai_classified BOOLEAN DEFAULT FALSE,
  ADD COLUMN ai_confidence DECIMAL(3, 2),  -- 0.95 = 95%
  ADD COLUMN ai_insights JSONB,  -- { "deletion_probability": 0.85, "suggested_compensation": 1000 }

  -- Priority (calculated from tags + product price + review rating)
  ADD COLUMN priority_score INTEGER DEFAULT 0,  -- 0-100

  -- Status update timestamp
  ADD COLUMN status_updated_at TIMESTAMPTZ;

-- Index for Kanban queries
CREATE INDEX idx_chats_status_priority ON chats(store_id, status, priority_score DESC, updated_at DESC);

-- Index for tag filtering
CREATE INDEX idx_chats_tags ON chats USING GIN(tags);
```

### Обновление TypeScript types:

```typescript
// src/db/helpers.ts

export type ChatStatus =
  | 'inbox'
  | 'in_progress'
  | 'awaiting_reply'
  | 'resolved'
  | 'closed';

export type ChatTag =
  // Problem type
  | 'defect' | 'delivery' | 'quality' | 'size' | 'description' | 'damage'
  // Intent
  | 'refund' | 'replacement' | 'delete_review' | 'upgrade_review' | 'question' | 'complaint'
  // Priority
  | 'hot_lead' | 'high_value' | 'repeat_customer' | 'negative_review'
  // Special
  | 'spam' | 'vip' | 'escalated';

export interface Chat {
  id: string;
  store_id: string;
  owner_id: string;

  // Status (single)
  status: ChatStatus;
  status_updated_at: string | null;

  // Tags (multiple)
  tags: ChatTag[];

  // AI
  ai_classified: boolean;
  ai_confidence: number | null;
  ai_insights: {
    deletion_probability?: number;
    suggested_compensation?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
  } | null;

  // Priority
  priority_score: number;

  // ... existing fields ...
}
```

---

## 📊 Migration Plan (From Old to New System)

### Phase 1: Database Migration (Week 1)

```sql
-- Step 1: Rename column
ALTER TABLE chats RENAME COLUMN tag TO status;

-- Step 2: Add new columns
ALTER TABLE chats
  ADD COLUMN tags TEXT[] DEFAULT '{}',
  ADD COLUMN ai_classified BOOLEAN DEFAULT FALSE,
  ADD COLUMN ai_confidence DECIMAL(3, 2),
  ADD COLUMN ai_insights JSONB,
  ADD COLUMN priority_score INTEGER DEFAULT 0,
  ADD COLUMN status_updated_at TIMESTAMPTZ;

-- Step 3: Migrate old "tags" to new "status" + "tags"
UPDATE chats
SET
  -- Map old tag → new status
  status = CASE
    WHEN status = 'untagged' THEN 'inbox'
    WHEN status = 'active' THEN 'in_progress'
    WHEN status = 'no_reply' THEN 'awaiting_reply'
    WHEN status IN ('successful', 'completed') THEN 'resolved'
    WHEN status = 'unsuccessful' THEN 'closed'
    WHEN status = 'deletion_candidate' THEN 'in_progress'  -- Migrate deletion workflow
    WHEN status = 'deletion_offered' THEN 'awaiting_reply'
    WHEN status = 'deletion_agreed' THEN 'resolved'
    WHEN status = 'deletion_confirmed' THEN 'closed'
    WHEN status = 'spam' THEN 'closed'
    ELSE 'inbox'
  END,

  -- Map old tag → new tags array
  tags = CASE
    WHEN status = 'deletion_candidate' THEN ARRAY['delete_review', 'hot_lead']
    WHEN status = 'deletion_offered' THEN ARRAY['delete_review', 'hot_lead']
    WHEN status = 'refund_requested' THEN ARRAY['refund']
    WHEN status = 'spam' THEN ARRAY['spam']
    ELSE ARRAY[]::TEXT[]
  END,

  status_updated_at = updated_at;

-- Step 4: Create indexes
CREATE INDEX idx_chats_status_priority ON chats(store_id, status, priority_score DESC, updated_at DESC);
CREATE INDEX idx_chats_tags ON chats USING GIN(tags);
```

### Phase 2: AI Re-classification (Week 2)

```bash
# Bulk re-classify all chats to assign proper tags
POST /api/stores/:storeId/chats/reclassify-all?mode=full

# Expected output:
{
  "success": true,
  "stats": {
    "total": 234,
    "classified": 220,
    "failed": 14,
    "tag_distribution": {
      "defect": 45,
      "delivery": 32,
      "refund": 67,
      "delete_review": 12,
      "hot_lead": 18,
      ...
    }
  }
}
```

### Phase 3: UI Migration (Week 3-4)

**Week 3: Kanban Board**
- [ ] Implement Kanban layout (5 columns)
- [ ] Drag & Drop functionality
- [ ] Status update API
- [ ] Tag filter UI

**Week 4: Table View + Chat Detail**
- [ ] Table view with multi-select
- [ ] Bulk actions (change status, add tags)
- [ ] Chat detail panel with status/tag selectors
- [ ] AI insights card

---

## 🎯 Key Metrics & Success Criteria

### Before (Current System):
- ❌ 79% чатов = 'untagged' (не обработаны)
- ❌ Среднее время на обработку чата: ~5-10 минут (ручной поиск)
- ❌ Conversion rate (чаты → удаление отзывов): Неизвестно

### After (New System):
- ✅ 95%+ чатов автоматически классифицированы
- ✅ Среднее время на обработку чата: <2 минуты (Kanban + AI insights)
- ✅ Conversion rate: Отслеживается через воронку
- ✅ ROI от чатов: Видим сколько чатов → 600₽ revenue

### KPIs:

```typescript
// Dashboard metrics:
{
  "chats_by_status": {
    "inbox": 23,
    "in_progress": 8,
    "awaiting_reply": 5,
    "resolved": 42,
    "closed": 156
  },

  "hot_leads": 12,  // Теги: 'delete_review' or 'hot_lead'

  "conversion_funnel": {
    "deletion_candidates": 18,      // Tag: 'delete_review'
    "offers_sent": 15,               // Status: 'awaiting_reply' + Tag: 'delete_review'
    "agreed": 8,                     // Status: 'resolved' + Tag: 'delete_review'
    "confirmed_deletions": 7,        // Review actually deleted
    "revenue": 4200                  // 7 × 600₽
  },

  "avg_response_time": "12 minutes",
  "avg_resolution_time": "2.5 hours"
}
```

---

## 💡 Дополнительные рекомендации

### 1. **Smart Notifications (умные уведомления)**

```typescript
// Notify manager when:
if (chat.tags.includes('hot_lead') && chat.status === 'inbox') {
  notify({
    type: 'urgent',
    title: '🔥 Горячий лид!',
    message: `Клиент ${chat.client_name} готов удалить отзыв`,
    action: 'Открыть чат',
    link: `/chats/${chat.id}`,
  });
}
```

### 2. **Priority Queue (приоритетная очередь)**

```typescript
// Sort chats by priority_score:
priority_score =
  (has_tag('hot_lead') ? 50 : 0) +
  (has_tag('high_value') ? 30 : 0) +
  (has_tag('negative_review') ? 20 : 0) +
  (response_time_urgency) +
  (product_price / 1000);

// Display in Kanban sorted by priority_score DESC
```

### 3. **AI-Powered Suggestions**

```tsx
// В чат-карточке:
<AISuggestionCard>
  <h3>🤖 AI Рекомендации:</h3>
  <ul>
    <li>✅ Предложить компенсацию 500-1000₽</li>
    <li>✅ Использовать шаблон "Извинение за брак"</li>
    <li>⚠️ Риск эскалации: Средний</li>
    <li>📊 Вероятность удаления отзыва: 85%</li>
  </ul>
  <Button onClick={applyAISuggestion}>Применить</Button>
</AISuggestionCard>
```

### 4. **Bulk Operations (массовые операции)**

```tsx
// В Table View:
<BulkActionsToolbar selectedCount={selectedChats.length}>
  <Button onClick={() => bulkUpdateStatus('resolved')}>
    ✅ Отметить решенными
  </Button>
  <Button onClick={() => bulkAddTag('spam')}>
    🚫 Пометить как спам
  </Button>
  <Button onClick={() => bulkAssignTo('manager_id')}>
    👤 Назначить менеджеру
  </Button>
</BulkActionsToolbar>
```

---

## 🚀 Implementation Roadmap

### Sprint 1 (Week 1-2): Database + Backend
- [ ] Database migration (status/tags columns)
- [ ] Update TypeScript types
- [ ] API endpoints:
  - `PATCH /api/chats/:chatId/status`
  - `PATCH /api/chats/:chatId/tags`
  - `POST /api/chats/reclassify-all`
- [ ] AI re-classification of existing chats

### Sprint 2 (Week 3-4): UI - Kanban Board
- [ ] Kanban layout (5 columns)
- [ ] Drag & Drop (`@dnd-kit/core`)
- [ ] Status badge components
- [ ] Tag filter UI
- [ ] Chat card component

### Sprint 3 (Week 5-6): UI - Advanced Features
- [ ] Table view with sorting/filtering
- [ ] Multi-select + bulk actions
- [ ] Chat detail panel (status + tags selectors)
- [ ] AI insights card
- [ ] Priority queue sorting

### Sprint 4 (Week 7-8): Polish & Analytics
- [ ] Dashboard metrics
- [ ] Conversion funnel visualization
- [ ] Smart notifications
- [ ] A/B testing AI prompts
- [ ] User training & documentation

---

## ✅ Acceptance Criteria

### Must Have:
1. ✅ Kanban Board с 5 статусами
2. ✅ Drag & Drop между колонками
3. ✅ Multi-tag system (минимум 15 тегов)
4. ✅ AI автоматическая классификация (>90% accuracy)
5. ✅ Фильтрация по статусам + тегам
6. ✅ Приоритетная сортировка

### Should Have:
7. ✅ Table view (альтернативный вид)
8. ✅ Bulk operations
9. ✅ AI insights в карточке чата
10. ✅ Conversion funnel dashboard

### Nice to Have:
11. ⏳ Smart notifications
12. ⏳ Assignee (назначение менеджера)
13. ⏳ SLA tracking (время ответа)
14. ⏳ Chat templates library

---

## 🤔 Open Questions for Discussion

1. **Нужны ли еще теги?**
   Какие категории проблем встречаются чаще всего?

2. **Автоматические переходы статусов?**
   Например: "awaiting_reply" → "in_progress" автоматически при ответе клиента?

3. **Assignee система?**
   Нужно ли назначать чаты конкретным менеджерам?

4. **SLA tracking?**
   Нужно ли отслеживать "Ответить в течение 2 часов"?

5. **Integration с Task Management Center?**
   Автоматически создавать задачу при появлении 'hot_lead' чата?

---

**Prepared by:** Product Manager
**Last Updated:** 2026-01-22
**Status:** 📝 Ready for Review
**Next Step:** Team discussion → Approve → Sprint planning

