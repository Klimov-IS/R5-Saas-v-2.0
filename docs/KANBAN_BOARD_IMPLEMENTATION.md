# Kanban Board для чатов — План реализации

**Дата создания:** 2026-01-22
**Последнее обновление:** 2026-01-26 09:55
**Статус:** ✅ COMPLETED (MVP + Quick Win #1 готовы)
**Цель:** Создать Kanban Board (воронку) для управления чатами с Drag & Drop

---

## 📋 Обзор задачи

### Что делаем:
Реализуем **Kanban Board** с 5 колонками статусов для управления чатами:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│📥 Входящие│🔄 В работе│⏳ Ожидание│✅ Решено │🔒 Закрыто│
│  (inbox)  │(in_progress)│(awaiting_reply)│(resolved)│(closed)│
│   (23)    │    (8)    │    (5)    │   (42)   │  (156)   │
└──────────┴──────────┴──────────┴──────────┴──────────┘
       ↑ Drag & Drop между колонками
```

### Почему важно:
1. **Текущая проблема:** 79% чатов = 'untagged' (не обработаны)
2. **Нет видимости воронки:** Менеджер не видит, на каком этапе находится чат
3. **Нет Drag & Drop:** Менеджер должен вручную открывать каждый чат и менять тег
4. **Смешение концепций:** "Теги" на самом деле описывают статусы воронки

### Результат:
- ✅ Kanban Board с 5 колонками
- ✅ Drag & Drop для быстрого изменения статуса
- ✅ Счетчики чатов в каждой колонке
- ✅ Миграция данных без потерь (старые теги → новые статусы)

---

## 🗄️ Этап 1: Миграция базы данных

### 1.1 Добавить поле `status`

```sql
-- Добавить новое поле "status" (воронка CRM)
ALTER TABLE chats
  ADD COLUMN status TEXT DEFAULT 'inbox' CHECK (status IN ('inbox', 'in_progress', 'awaiting_reply', 'resolved', 'closed'));

-- Добавить timestamp для отслеживания изменений
ALTER TABLE chats
  ADD COLUMN status_updated_at TIMESTAMPTZ DEFAULT NOW();
```

### 1.2 Миграция данных (старые теги → новые статусы)

```sql
-- Мигрировать старые "tags" → новые "status"
UPDATE chats SET status = CASE
  -- Старые базовые теги
  WHEN tag = 'untagged' THEN 'inbox'          -- Не обработан → Входящие
  WHEN tag = 'active' THEN 'in_progress'      -- Активный → В работе
  WHEN tag = 'no_reply' THEN 'awaiting_reply' -- Нет ответа → Ожидание
  WHEN tag = 'successful' THEN 'resolved'     -- Успешный → Решено
  WHEN tag = 'completed' THEN 'closed'        -- Завершен → Закрыто
  WHEN tag = 'unsuccessful' THEN 'closed'     -- Неуспешный → Закрыто

  -- Deletion workflow теги
  WHEN tag = 'deletion_candidate' THEN 'in_progress'   -- Кандидат → В работе
  WHEN tag = 'deletion_offered' THEN 'awaiting_reply'  -- Предложено → Ожидание
  WHEN tag = 'deletion_agreed' THEN 'resolved'         -- Согласился → Решено
  WHEN tag = 'deletion_confirmed' THEN 'closed'        -- Подтверждено → Закрыто
  WHEN tag = 'refund_requested' THEN 'in_progress'     -- Возврат → В работе
  WHEN tag = 'spam' THEN 'closed'                      -- Спам → Закрыто

  ELSE 'inbox' -- Fallback
END,
status_updated_at = updated_at;
```

### 1.3 Переименовать старое поле (для истории)

```sql
-- Переименовать старое поле "tag" → "legacy_tag" (для истории)
ALTER TABLE chats RENAME COLUMN tag TO legacy_tag;
```

### 1.4 Создать индексы

```sql
-- Index для быстрой фильтрации по статусу
CREATE INDEX idx_chats_status ON chats(store_id, status, updated_at DESC);

-- Index для Kanban Board queries
CREATE INDEX idx_chats_kanban ON chats(store_id, status, status_updated_at DESC, updated_at DESC);
```

### 1.5 Обновить TypeScript типы

```typescript
// src/db/helpers.ts

// Новый тип для статусов (воронка CRM)
export type ChatStatus =
  | 'inbox'           // 📥 Входящие (новые, непрочитанные)
  | 'in_progress'     // 🔄 В работе (менеджер взял в обработку)
  | 'awaiting_reply'  // ⏳ Ожидание ответа клиента
  | 'resolved'        // ✅ Решено (успешно)
  | 'closed';         // 🔒 Закрыто (завершено, архив)

// Старый тип (для legacy_tag)
export type ChatTag =
  | 'untagged' | 'active' | 'successful' | 'unsuccessful'
  | 'no_reply' | 'completed' | 'deletion_candidate'
  | 'deletion_offered' | 'deletion_agreed' | 'deletion_confirmed'
  | 'refund_requested' | 'spam';

// Обновленный интерфейс Chat
export interface Chat {
  id: string;
  store_id: string;
  owner_id: string;

  // NEW: Status (воронка CRM)
  status: ChatStatus;
  status_updated_at: string;

  // OLD: Legacy tag (для истории)
  legacy_tag?: ChatTag | null;

  // ... остальные поля ...
  client_name: string;
  product_nm_id?: string | null;
  product_name?: string | null;
  last_message_date?: string | null;
  last_message_text?: string | null;
  last_message_sender?: 'client' | 'seller' | null;
  created_at: string;
  updated_at: string;
}
```

---

## 🎨 Этап 2: HTML Прототип (СОГЛАСОВАНИЕ)

### 2.1 Создать файл `kanban-board-prototype.html`

**Цель:** Статический HTML для согласования дизайна перед React реализацией

**Расположение:** `c:\Users\79025\Desktop\проекты\R5\Pilot-entry\R5 saas-prod\prototypes\kanban-board-prototype.html`

### 2.2 Дизайн согласно UI Design System

**Цветовая палитра:**
```css
/* Статус badges */
--inbox-bg: #EFF6FF;          /* blue-50 */
--inbox-text: #3B82F6;        /* blue-500 */

--in-progress-bg: #FEF3C7;    /* amber-100 */
--in-progress-text: #F59E0B;  /* amber-500 */

--awaiting-bg: #FEF2F2;       /* red-50 */
--awaiting-text: #EF4444;     /* red-500 */

--resolved-bg: #F0FDF4;       /* green-50 */
--resolved-text: #22C55E;     /* green-500 */

--closed-bg: #F1F5F9;         /* slate-100 */
--closed-text: #64748B;       /* slate-500 */
```

**Layout:**
- Ширина колонки: `280px` (фиксированная)
- Gap между колонками: `16px`
- Высота карточки чата: `auto` (min: 120px)
- Border radius: `8px` (cards), `12px` (columns)

### 2.3 Структура HTML прототипа

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Kanban Board — Чаты</title>
  <style>
    /* Tailwind-like styles */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #F8FAFC;
      padding: 24px;
    }

    .kanban-container {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      padding-bottom: 16px;
    }

    .kanban-column {
      min-width: 280px;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .column-title {
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .column-count {
      background: #F1F5F9;
      color: #64748B;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
    }

    .chat-card {
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px;
      cursor: grab;
      transition: all 0.2s;
    }

    .chat-card:hover {
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      border-color: #CBD5E1;
    }

    .chat-card:active {
      cursor: grabbing;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 8px;
    }

    .client-name {
      font-size: 14px;
      font-weight: 600;
      color: #1E293B;
    }

    .chat-time {
      font-size: 11px;
      color: #94A3B8;
    }

    .product-name {
      font-size: 12px;
      color: #64748B;
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .last-message {
      font-size: 13px;
      color: #475569;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .chat-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .message-count {
      font-size: 11px;
      color: #94A3B8;
    }

    .status-badge {
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1 style="margin-bottom: 24px; font-size: 24px; font-weight: 700; color: #0F172A;">
    💬 Чаты — Kanban Board
  </h1>

  <div class="kanban-container">
    <!-- Column 1: Inbox -->
    <div class="kanban-column">
      <div class="column-header">
        <div class="column-title">📥 Входящие</div>
        <div class="column-count">23</div>
      </div>

      <!-- Chat Card Example -->
      <div class="chat-card">
        <div class="chat-header">
          <div class="client-name">Иван П.</div>
          <div class="chat-time">2 мин</div>
        </div>
        <div class="product-name">📦 Скатерть льняная 140x220</div>
        <div class="last-message">
          Товар пришел с браком, есть дырка. Хочу вернуть деньги.
        </div>
        <div class="chat-footer">
          <div class="message-count">3 сообщения</div>
          <div class="status-badge" style="background: #EFF6FF; color: #3B82F6;">
            Новый
          </div>
        </div>
      </div>

      <!-- Add more cards... -->
    </div>

    <!-- Column 2: In Progress -->
    <div class="kanban-column">
      <div class="column-header">
        <div class="column-title">🔄 В работе</div>
        <div class="column-count">8</div>
      </div>

      <div class="chat-card">
        <div class="chat-header">
          <div class="client-name">Мария С.</div>
          <div class="chat-time">15 мин</div>
        </div>
        <div class="product-name">📦 Ножи кухонные набор 5шт</div>
        <div class="last-message">
          Я: Отправим замену в течение 2 дней. Трек-номер сообщим.
        </div>
        <div class="chat-footer">
          <div class="message-count">7 сообщений</div>
          <div class="status-badge" style="background: #FEF3C7; color: #F59E0B;">
            В работе
          </div>
        </div>
      </div>
    </div>

    <!-- Column 3: Awaiting Reply -->
    <div class="kanban-column">
      <div class="column-header">
        <div class="column-title">⏳ Ожидание</div>
        <div class="column-count">5</div>
      </div>

      <div class="chat-card">
        <div class="chat-header">
          <div class="client-name">Алексей К.</div>
          <div class="chat-time">2 часа</div>
        </div>
        <div class="product-name">📦 Овощечистка керамическая</div>
        <div class="last-message">
          Я: Готовы предложить компенсацию 500₽. Напишите, если согласны.
        </div>
        <div class="chat-footer">
          <div class="message-count">12 сообщений</div>
          <div class="status-badge" style="background: #FEF2F2; color: #EF4444;">
            Ожидание
          </div>
        </div>
      </div>
    </div>

    <!-- Column 4: Resolved -->
    <div class="kanban-column">
      <div class="column-header">
        <div class="column-title">✅ Решено</div>
        <div class="column-count">42</div>
      </div>

      <div class="chat-card">
        <div class="chat-header">
          <div class="client-name">Елена Д.</div>
          <div class="chat-time">Вчера</div>
        </div>
        <div class="product-name">📦 Посуда набор 24 предмета</div>
        <div class="last-message">
          Клиент: Спасибо, замена пришла! Все отлично!
        </div>
        <div class="chat-footer">
          <div class="message-count">5 сообщений</div>
          <div class="status-badge" style="background: #F0FDF4; color: #22C55E;">
            Решено
          </div>
        </div>
      </div>
    </div>

    <!-- Column 5: Closed -->
    <div class="kanban-column">
      <div class="column-header">
        <div class="column-title">🔒 Закрыто</div>
        <div class="column-count">156</div>
      </div>

      <div class="chat-card" style="opacity: 0.6;">
        <div class="chat-header">
          <div class="client-name">Спам</div>
          <div class="chat-time">3 дня</div>
        </div>
        <div class="product-name">—</div>
        <div class="last-message">
          МЫ УДАЛЯЕМ ОТЗЫВЫ ЗА 500Р ПИШИТЕ В ТЕЛЕГРАМ
        </div>
        <div class="chat-footer">
          <div class="message-count">1 сообщение</div>
          <div class="status-badge" style="background: #F1F5F9; color: #64748B;">
            Спам
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

### 2.4 Чек-лист для согласования:

- [ ] Ширина колонок удобна? (280px фикс)
- [ ] Цвета статусов понятны?
- [ ] Информация в карточках достаточна?
- [ ] Нужны ли дополнительные элементы (теги, приоритет, assignee)?
- [ ] Размер шрифтов читаем?
- [ ] Нужен ли индикатор "drag handle"?

---

## ⚛️ Этап 3: React компоненты

### 3.1 Обновить Zustand store

```typescript
// src/store/chatsStore.ts

import { create } from 'zustand';

export type ViewMode = 'table' | 'messenger' | 'kanban'; // ADD 'kanban'

export type ChatStatus =
  | 'inbox'
  | 'in_progress'
  | 'awaiting_reply'
  | 'resolved'
  | 'closed';

interface ChatsState {
  // View Mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Active Chat
  activeChatId: string | null;
  setActiveChatId: (chatId: string | null) => void;

  // Filters
  statusFilter: ChatStatus | 'all'; // CHANGED from 'tagFilter'
  setStatusFilter: (status: ChatStatus | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Kanban-specific
  draggedChatId: string | null;
  setDraggedChatId: (chatId: string | null) => void;

  // ... rest of state
}

export const useChatsStore = create<ChatsState>((set, get) => ({
  viewMode: 'table',
  setViewMode: (mode) => set({ viewMode: mode }),

  activeChatId: null,
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),

  statusFilter: 'all',
  setStatusFilter: (status) => set({ statusFilter: status }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  draggedChatId: null,
  setDraggedChatId: (chatId) => set({ draggedChatId: chatId }),

  // ... rest of implementation
}));
```

### 3.2 Компонент `KanbanBoardView.tsx`

```typescript
// src/components/chats/KanbanBoardView.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { ChatKanbanCard } from './ChatKanbanCard';
import { useChatsStore } from '@/store/chatsStore';
import type { Chat, ChatStatus } from '@/db/helpers';
import { Loader2 } from 'lucide-react';

interface KanbanBoardViewProps {
  storeId: string;
}

export function KanbanBoardView({ storeId }: KanbanBoardViewProps) {
  const { draggedChatId, setDraggedChatId, searchQuery } = useChatsStore();

  // Fetch chats
  const { data, isLoading, error } = useQuery({
    queryKey: ['chats-kanban', storeId, searchQuery],
    queryFn: async () => {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || '';
      const response = await fetch(
        `/api/stores/${storeId}/chats?search=${searchQuery}`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    },
  });

  const chats: Chat[] = data?.data || [];

  // Group chats by status
  const chatsByStatus: Record<ChatStatus, Chat[]> = {
    inbox: chats.filter(c => c.status === 'inbox'),
    in_progress: chats.filter(c => c.status === 'in_progress'),
    awaiting_reply: chats.filter(c => c.status === 'awaiting_reply'),
    resolved: chats.filter(c => c.status === 'resolved'),
    closed: chats.filter(c => c.status === 'closed'),
  };

  // Handle drag end
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const chatId = active.id;
    const newStatus = over.id as ChatStatus;

    // Update chat status via API
    await updateChatStatus(storeId, chatId, newStatus);

    setDraggedChatId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-8">
        Ошибка загрузки чатов
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={(e) => setDraggedChatId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedChatId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn
          status="inbox"
          title="📥 Входящие"
          chats={chatsByStatus.inbox}
          color="blue"
        />
        <KanbanColumn
          status="in_progress"
          title="🔄 В работе"
          chats={chatsByStatus.in_progress}
          color="amber"
        />
        <KanbanColumn
          status="awaiting_reply"
          title="⏳ Ожидание"
          chats={chatsByStatus.awaiting_reply}
          color="red"
        />
        <KanbanColumn
          status="resolved"
          title="✅ Решено"
          chats={chatsByStatus.resolved}
          color="green"
        />
        <KanbanColumn
          status="closed"
          title="🔒 Закрыто"
          chats={chatsByStatus.closed}
          color="slate"
        />
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedChatId ? (
          <ChatKanbanCard
            chat={chats.find(c => c.id === draggedChatId)!}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

async function updateChatStatus(
  storeId: string,
  chatId: string,
  status: ChatStatus
) {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || '';
  await fetch(`/api/stores/${storeId}/chats/${chatId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
}
```

### 3.3 Компонент `KanbanColumn.tsx`

```typescript
// src/components/chats/KanbanColumn.tsx

'use client';

import { useDroppable } from '@dnd-kit/core';
import { ChatKanbanCard } from './ChatKanbanCard';
import type { Chat, ChatStatus } from '@/db/helpers';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: ChatStatus;
  title: string;
  chats: Chat[];
  color: 'blue' | 'amber' | 'red' | 'green' | 'slate';
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  amber: 'bg-amber-50 border-amber-200',
  red: 'bg-red-50 border-red-200',
  green: 'bg-green-50 border-green-200',
  slate: 'bg-slate-50 border-slate-200',
};

export function KanbanColumn({ status, title, chats, color }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-w-[280px] bg-white border rounded-xl p-4 flex flex-col gap-3 transition-all',
        isOver && colorMap[color]
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          {title}
        </h3>
        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
          {chats.length}
        </span>
      </div>

      {/* Chat Cards */}
      <div className="flex flex-col gap-3 min-h-[400px]">
        {chats.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">
            Нет чатов
          </div>
        ) : (
          chats.map(chat => (
            <ChatKanbanCard key={chat.id} chat={chat} />
          ))
        )}
      </div>
    </div>
  );
}
```

### 3.4 Компонент `ChatKanbanCard.tsx`

```typescript
// src/components/chats/ChatKanbanCard.tsx

'use client';

import { useDraggable } from '@dnd-kit/core';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Chat } from '@/db/helpers';
import { cn } from '@/lib/utils';

interface ChatKanbanCardProps {
  chat: Chat;
  isDragging?: boolean;
}

export function ChatKanbanCard({ chat, isDragging }: ChatKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: chat.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'bg-white border border-slate-200 rounded-lg p-3 cursor-grab transition-all hover:shadow-md hover:border-slate-300',
        isDragging && 'opacity-50 cursor-grabbing'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="font-semibold text-sm text-slate-900">
          {chat.client_name}
        </div>
        <div className="text-xs text-slate-500">
          {formatDistanceToNow(new Date(chat.updated_at), {
            addSuffix: true,
            locale: ru
          })}
        </div>
      </div>

      {/* Product */}
      {chat.product_name && (
        <div className="text-xs text-slate-600 mb-2 truncate">
          📦 {chat.product_name}
        </div>
      )}

      {/* Last Message */}
      {chat.last_message_text && (
        <div className="text-sm text-slate-700 line-clamp-2 mb-2">
          {chat.last_message_text}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Сообщений: 3</span>
        {chat.last_message_sender === 'client' && (
          <span className="text-blue-600 font-medium">Новое</span>
        )}
      </div>
    </div>
  );
}
```

---

## 🔌 Этап 4: API Endpoint

### 4.1 Создать `PATCH /api/stores/[storeId]/chats/[chatId]/status`

```typescript
// src/app/api/stores/[storeId]/chats/[chatId]/status/route.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    // Verify API key
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { storeId, chatId } = params;
    const { status } = await request.json();

    // Validate status
    const validStatuses = ['inbox', 'in_progress', 'awaiting_reply', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update chat status
    const updatedChat = await dbHelpers.updateChat(chatId, {
      status,
      status_updated_at: new Date().toISOString(),
    });

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      chat: updatedChat,
    });

  } catch (error: any) {
    console.error('[API ERROR] Update chat status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🔗 Этап 5: Интеграция

### 5.1 Обновить `ChatsToolbar.tsx`

```typescript
// Добавить кнопку "Kanban" в view toggle

<div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
  <button onClick={() => setViewMode('table')}>
    <Table className="w-4 h-4" /> Таблица
  </button>
  <button onClick={() => setViewMode('messenger')}>
    <MessageSquare className="w-4 h-4" /> Чат
  </button>
  {/* NEW */}
  <button onClick={() => setViewMode('kanban')}>
    <LayoutGrid className="w-4 h-4" /> Kanban
  </button>
</div>
```

### 5.2 Обновить `ChatsPage.tsx`

```typescript
// src/app/stores/[storeId]/chats/page.tsx

import { KanbanBoardView } from '@/components/chats/KanbanBoardView';

export default function ChatsPage() {
  const { viewMode } = useChatsStore();

  return (
    <>
      <ChatsToolbar storeId={storeId} />

      {/* Messenger View */}
      {viewMode === 'messenger' && <MessengerView storeId={storeId} />}

      {/* Table View */}
      {viewMode === 'table' && <ChatsTableView storeId={storeId} />}

      {/* NEW: Kanban View */}
      {viewMode === 'kanban' && <KanbanBoardView storeId={storeId} />}
    </>
  );
}
```

---

## 📦 Этап 6: Установка зависимостей

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

---

## ✅ Чек-лист реализации

### Database Migration ✅ DONE
- [x] Добавлено поле `status` в таблицу `chats` (migration 003)
- [x] Мигрированы данные (tag → status)
- [x] Переименовано поле `tag` → `legacy_tag`
- [x] Созданы индексы (`idx_chats_status`, `idx_chats_kanban`)
- [x] Обновлены TypeScript типы (`ChatStatus`, `Chat` interface)
- [x] **BUGFIX:** Исправлена миграция 003 через migration 004 (19,155 чатов обновлено)
- [x] **BUGFIX:** Исправлен `/dialogues/update` endpoint (использование `legacy_tag` вместо `tag`)

### HTML Prototype ✅ DONE
- [x] Создан файл `kanban-board-prototype-v3.html`
- [x] Дизайн соответствует UI Design System
- [x] Все 5 колонок отображаются корректно
- [x] **СОГЛАСОВАНО с заказчиком** ✅
- [x] Добавлен dropdown для draft preview
- [x] Реализованы Quick Actions (Generate, Edit, Regenerate, Send)
- [x] Inline sender prefix (Клиент: / Вы:)

### React Components ✅ DONE
- [x] Создан `KanbanBoardView.tsx` (src/components/chats/)
- [x] Создан `KanbanColumn.tsx` (src/components/chats/)
- [x] Создан `ChatKanbanCard.tsx` (src/components/chats/)
- [x] Обновлен `chatsStore.ts` (добавлен viewMode: 'kanban')

### Drag & Drop ✅ DONE
- [x] Установлен `@dnd-kit/core` и `@dnd-kit/sortable`
- [x] Реализовано перетаскивание между колонками
- [x] API endpoint `PATCH /api/stores/[storeId]/chats/[chatId]/status` работает
- [x] Обновление UI после drag & drop (onRefresh)

### Integration ✅ DONE
- [x] Добавлена кнопка "Канбан" в `ChatsToolbar` (lucide-react LayoutGrid icon)
- [x] Условный рендеринг в `ChatsPage`
- [x] Переключение между видами работает (table / messenger / kanban)
- [x] **BUGFIX:** Исправлена загрузка всех чатов для Kanban (отдельный query `all-chats`)
- [x] Тестирование на production данных (магазин "Эмуна РУ" - 32 чата)

### 🐛 Критические баги (исправлены)

1. **Migration 003 не обновила чаты**
   - Проблема: `WHERE status IS NULL OR status = 'inbox'` блокировало обновление
   - Решение: Migration 004 с `WHERE TRUE` (обновлено 19,155 чатов)

2. **API endpoint использовал несуществующее поле `tag`**
   - Проблема: `/dialogues/update` пытался сохранить `tag` вместо `legacy_tag`
   - Решение: 3 места исправлено (строки 68, 200, 240)

3. **Kanban отображал только 1 чат из 32**
   - Проблема: `ChatsPage` использовал запрос `take=1` для Kanban
   - Решение: Добавлен отдельный query `all-chats` с `take=500` и `enabled: viewMode === 'kanban'`

---

## 📊 Текущий статус (2026-01-22 18:30)

### ✅ Что реализовано (MVP ГОТОВ)

1. **База данных** - полностью мигрирована
   - Новое поле `status` с 5 статусами Kanban
   - Старое поле `tag` переименовано в `legacy_tag` (сохранено для истории)
   - 19,155 чатов успешно мигрировано
   - Созданы индексы для быстрых запросов

2. **UI/UX Дизайн** - полностью согласован
   - HTML прототип v3 с dropdown draft preview
   - Quick Actions кнопки (Generate, Edit, Regenerate, Send)
   - Inline sender prefix (Клиент: / Вы:)
   - Waiting time badges для долгих ожиданий

3. **React компоненты** - реализованы и работают
   - `KanbanBoardView` - главный компонент с DnD
   - `KanbanColumn` - колонка со счетчиком
   - `ChatKanbanCard` - карточка чата с dropdown
   - Интеграция с `ChatsPage` и `ChatsToolbar`

4. **Drag & Drop** - полностью работает
   - Перетаскивание между колонками
   - API endpoint обновляет статус в БД
   - UI обновляется после изменения

5. **Тестирование** - пройдено
   - Протестировано на магазине "Эмуна РУ" (32 чата)
   - Все чаты корректно распределяются по колонкам
   - Drag & drop работает без ошибок

### 🎯 Что осталось сделать (Future Enhancements)

#### ✅ Quick Win #1: Completion Reason Tags (ЗАВЕРШЕНО 2026-01-26)

**Статус:** ✅ COMPLETED

**Что реализовано:**
1. ✅ Добавлена колонка `completion_reason` в таблицу `chats` (migration 005)
2. ✅ Создан `CompletionReasonModal` с 8 причинами закрытия:
   - `review_deleted` (🗑️ Отзыв удален)
   - `review_upgraded` (⭐ Отзыв дополнен)
   - `no_reply` (🔇 Нет ответа)
   - `old_dialog` (⏰ Старый диалог)
   - `not_our_issue` (❓ Не наш вопрос)
   - `spam` (🚫 Спам)
   - `negative` (😠 Негатив)
   - `other` (📋 Другое)
3. ✅ Модальное окно появляется при:
   - Drag-and-drop чата в колонку "Закрыто"
   - Bulk action "Закрыть" для нескольких чатов
4. ✅ Фильтр по причинам закрытия в `ChatsToolbar`
5. ✅ Badges причин закрытия на карточках закрытых чатов
6. ✅ Простая архитектура drag-and-drop: `useDraggable` + `useDroppable` (вместо `useSortable` + `SortableContext`)

**Технические детали:**
- `DraggableKanbanCard.tsx` - простой компонент с `useDraggable` hook
- `KanbanColumn.tsx` - использует `useDroppable` без `SortableContext`
- `CompletionReasonModal.tsx` - модальное окно с 8 кнопками-иконками
- API endpoint обновлен для приема `completion_reason` параметра
- Zustand store расширен с `completionReasonFilter`

**Файлы:**
- `src/components/chats/DraggableKanbanCard.tsx` (NEW)
- `src/components/chats/CompletionReasonModal.tsx` (NEW)
- `src/components/chats/KanbanBoardView.tsx` (MODIFIED)
- `src/components/chats/KanbanColumn.tsx` (MODIFIED)
- `src/components/chats/ChatKanbanCard.tsx` (MODIFIED)
- `src/components/chats/ChatsToolbar.tsx` (MODIFIED)
- `src/store/chatsStore.ts` (MODIFIED)
- `src/db/helpers.ts` (MODIFIED)
- `migrations/005_add_completion_reason.sql` (NEW)

**Commit:** `feat: Add drag-and-drop with completion reason tags for chats` (031380f)

---

#### Priority 1: Критические улучшения (1-2 дня)

1. **Bulk Actions в Kanban** 🟡 PARTIALLY DONE
   - [x] Checkbox для выбора множества чатов (DONE)
   - [x] Кнопка "Изменить статус всех выбранных" (DONE)
   - [x] Модальное окно для выбора причины при bulk close (DONE - Quick Win #1)
   - [ ] Кнопка "Сгенерировать ответы для всех выбранных"
   - [ ] Кнопка "Отправить все выбранные"
   - **Файлы:** `ChatKanbanCard.tsx`, `KanbanBoardView.tsx`, API endpoint `/bulk-actions`

2. **Функциональность Quick Actions** 🔴 HIGH PRIORITY
   - [ ] Кнопка "Generate" - генерация ответа через AI
   - [ ] Кнопка "Edit" - редактирование draft
   - [ ] Кнопка "Regenerate" - повторная генерация (оранжевая)
   - [ ] Кнопка "Send" - отправка в WB API
   - [ ] Кнопка "Open" - переход к чату в MessengerView
   - **Файлы:** `ChatKanbanCard.tsx`, integration с существующими API

3. **Dropdown Draft Preview** 🟡 MEDIUM PRIORITY
   - [ ] Клик по карточке разворачивает/сворачивает draft текст
   - [ ] Rotating ▼ иконка при toggle
   - [ ] Smooth transition анимация
   - **Файлы:** `ChatKanbanCard.tsx` (useState для collapsed state)

#### Priority 2: Улучшения UX (3-5 дней)

4. **Waiting Time Badges** 🟡 MEDIUM PRIORITY
   - [ ] Показывать "Ждет ответа 3 дня" для статуса `awaiting_reply`
   - [ ] Красный badge при >3 дней ожидания
   - [ ] Расчет времени от `status_updated_at`
   - **Файлы:** `ChatKanbanCard.tsx`

5. **Фильтры в Kanban** 🟢 LOW PRIORITY
   - [ ] Поиск по имени клиента
   - [ ] Фильтр по товару
   - [ ] Фильтр по дате последнего сообщения
   - **Файлы:** `ChatsToolbar.tsx`, `KanbanBoardView.tsx`

6. **Автоматические переходы статусов** 🟢 LOW PRIORITY
   - [ ] CRON job: `resolved` → `closed` через 7 дней
   - [ ] Auto: `inbox` → `in_progress` при открытии чата
   - **Файлы:** Новый CRON script, `/dialogues/update` endpoint

7. **Счетчики и метрики** 🟢 LOW PRIORITY
   - [ ] Реальный счетчик сообщений в чате (сейчас hardcoded = 1)
   - [ ] Время в текущем статусе
   - [ ] Приоритет чата (high_value, negative_review)
   - **Файлы:** `ChatKanbanCard.tsx`, API response

#### Priority 3: Продвинутые фичи (1-2 недели)

8. **Legacy Tags Display** 🔵 FUTURE
   - [ ] Показывать `legacy_tag` как бейджик (deletion_candidate, spam, etc.)
   - [ ] Цветовое кодирование legacy тегов
   - **Файлы:** `ChatKanbanCard.tsx`

9. **Keyboard Shortcuts** 🔵 FUTURE
   - [ ] Arrow keys для навигации между чатами
   - [ ] 1-5 для быстрого изменения статуса
   - [ ] G для генерации, S для отправки, E для редактирования
   - **Файлы:** `KanbanBoardView.tsx` (useEffect + keyboard listeners)

10. **Analytics Dashboard** 🔵 FUTURE
    - [ ] Время нахождения в каждом статусе (метрики воронки)
    - [ ] Conversion rate по статусам
    - [ ] Top products по жалобам
    - **Файлы:** Новая страница `/stores/[storeId]/analytics`

---

## 🎯 Рекомендуемый план на следующую сессию

### Сессия 1: Bulk Actions + Quick Actions (2-3 часа)
1. Реализовать Bulk Actions (checkbox, toolbar с кнопками)
2. Подключить Quick Actions к существующим API endpoints
3. Протестировать на production данных

### Сессия 2: Dropdown + Waiting Time (1-2 часа)
1. Реализовать dropdown draft preview с анимацией
2. Добавить waiting time badges для `awaiting_reply`
3. Улучшить UI/UX (transitions, hover states)

### Сессия 3: Фильтры + Автоматика (2-3 часа)
1. Добавить поиск и фильтры в Kanban
2. Настроить CRON для автоматических переходов статусов
3. Финальное тестирование и деплой на продакшн

---

## 📦 Файлы, созданные/измененные

### Созданные файлы
- `migrations/003_add_chat_status.sql`
- `migrations/004_fix_chat_status.sql`
- `prototypes/kanban-board-prototype-v3.html`
- `src/components/chats/KanbanBoardView.tsx`
- `src/components/chats/KanbanColumn.tsx`
- `src/components/chats/ChatKanbanCard.tsx`
- `src/app/api/stores/[storeId]/chats/[chatId]/status/route.ts`
- `src/app/api/stores/[storeId]/chats/bulk-actions/route.ts`
- `docs/KANBAN_BOARD_IMPLEMENTATION.md`

### Измененные файлы
- `src/db/helpers.ts` (типы, функции updateChatStatus)
- `src/store/chatsStore.ts` (viewMode: 'kanban')
- `src/components/chats/ChatsToolbar.tsx` (кнопка Канбан)
- `src/app/stores/[storeId]/chats/page.tsx` (интеграция Kanban view)
- `src/app/api/stores/[storeId]/chats/route.ts` (возвращает status)
- `src/app/api/stores/[storeId]/dialogues/update/route.ts` (использует legacy_tag)
- `package.json` (зависимости @dnd-kit/core, @dnd-kit/sortable)

---

**Создано:** 2026-01-22
**Последнее обновление:** 2026-01-22 18:30
**Автор:** AI Product Manager
**Статус:** ✅ MVP COMPLETED - Ready for Enhancement Phase
