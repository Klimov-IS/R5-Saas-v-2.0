# Система фильтров чатов

**Дата создания:** 2026-01-22
**Статус:** ✅ Реализовано

---

## Обзор

Система фильтров позволяет быстро находить нужные чаты по различным критериям:
- Статус в воронке (inbox, in_progress, awaiting_reply, resolved, closed)
- Последний отправитель (клиент или продавец)
- Наличие черновика ответа
- Текстовый поиск

**Важно:** Фильтры **глобальные** и применяются ко всем магазинам. При переключении между магазинами фильтры сохраняются.

---

## UI компоненты

### 1. Кнопка "Фильтры" в тулбаре

Заменила старую кнопку "Последний ответ". Содержит два раздела:

#### Секция 1: "Последний написал"
**Цель:** Показать чаты, где последнее сообщение от клиента или от продавца

**Опции:**
- 💬 **От клиента** (`lastSender = 'client'`)
- 📤 **От нас** (`lastSender = 'seller'`)

**Логика:**
- Взаимоисключающие чекбоксы (нельзя выбрать оба)
- Если выбран "От клиента", второй автоматически снимается
- Если оба сняты → `lastSender = 'all'` (показать все)

**Реализация:**
```typescript
const handleLastSenderToggle = (sender: 'client' | 'seller') => {
  if (lastSender === sender) {
    setLastSender('all'); // Снять выбор
  } else {
    setLastSender(sender); // Выбрать новый
  }
};
```

#### Секция 2: "С черновиком"
**Цель:** Показать только чаты с сохраненными черновиками ответов

**Опции:**
- 📝 **С черновиком** (`hasDraft = true`)

**Логика:**
- Обычный чекбокс (не взаимоисключающий)
- Можно комбинировать с другими фильтрами
- Если снят → `hasDraft = false` (показать все)

**Реализация:**
```typescript
const handleDraftToggle = () => {
  setHasDraft(!hasDraft);
};
```

### 2. Фильтр по статусам

**Где:** Тулбар (кнопки статусов)

**Опции:**
- 📥 Входящие (inbox)
- 🔄 В работе (in_progress)
- ⏳ Ожидание (awaiting_reply)
- ✅ Решено (resolved)
- 🔒 Закрыто (closed)
- 📋 Все (all)

**Логика:**
- Одиночный выбор (radio button behavior)
- По умолчанию: "Все"

### 3. Текстовый поиск

**Где:** Тулбар (поле "Поиск...")

**Что ищет:**
- Имя клиента
- Название товара
- Текст последнего сообщения

**Оптимизация:**
- Debounce 300ms (MessengerView)
- Мгновенная фильтрация (Kanban - client-side)

---

## Архитектура

### State Management (Zustand)

**Файл:** `src/store/chatsStore.ts`

**Глобальные фильтры:**
```typescript
interface ChatsState {
  // Status filter (NEW - Kanban statuses)
  statusFilter: ChatStatus | 'all';
  setStatusFilter: (status: ChatStatus | 'all') => void;

  // Last sender filter (NEW - replaces old senderFilter)
  lastSender: LastSenderFilter; // 'all' | 'client' | 'seller'
  setLastSender: (sender: LastSenderFilter) => void;

  // Draft filter (NEW)
  hasDraft: boolean;
  setHasDraft: (value: boolean) => void;

  // Text search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}
```

**Важные изменения:**
- ❌ Удалено: `senderFilter` (старое название)
- ✅ Добавлено: `lastSender` (новое название)
- ✅ Добавлено: `hasDraft`
- ❌ Удалено: Per-store localStorage (фильтры теперь глобальные)

### Фильтрация данных

#### Вариант 1: Client-side (Kanban)

**Где:** `src/app/stores/[storeId]/chats/page.tsx`

**Преимущества:**
- ⚡ Мгновенная фильтрация (0ms)
- 🚀 Нет лишних API запросов

**Реализация:**
```typescript
const filteredChats = allChats.filter((chat: any) => {
  // Status filter
  if (statusFilter !== 'all' && chat.status !== statusFilter) return false;

  // Last Sender filter
  if (lastSender === 'client' && chat.lastMessageSender !== 'client') return false;
  if (lastSender === 'seller' && chat.lastMessageSender !== 'seller') return false;

  // Draft filter
  if (hasDraft && !chat.draftReply) return false;

  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    const matchesClient = chat.clientName?.toLowerCase().includes(query);
    const matchesProduct = chat.productName?.toLowerCase().includes(query);
    const matchesMessage = chat.lastMessageText?.toLowerCase().includes(query);
    if (!matchesClient && !matchesProduct && !matchesMessage) return false;
  }

  return true;
});
```

#### Вариант 2: API-side (Messenger, Table)

**Где:**
- `src/app/api/stores/[storeId]/chats/route.ts` (API endpoint)
- `src/db/helpers.ts` (SQL запросы)

**Преимущества:**
- 📊 Меньше данных передается по сети
- 🎯 Pagination работает корректно

**API Endpoint:**
```typescript
// GET /api/stores/[storeId]/chats?status=inbox&sender=client&hasDraft=true&search=текст

const status = searchParams.get('status') as ChatStatus | 'all' || 'all';
const sender = searchParams.get('sender') as 'all' | 'client' | 'seller' || 'all';
const hasDraft = searchParams.get('hasDraft') === 'true';
const search = searchParams.get('search') || '';
```

**SQL фильтрация:**
```typescript
// src/db/helpers.ts - getChatsByStoreWithPagination()

// Filter by status
if (options?.status) {
  whereClauses.push(`c.status = $${paramIndex++}`);
  params.push(options.status);
}

// Filter by last message sender
if (options?.sender && options.sender !== 'all') {
  whereClauses.push(`c.last_message_sender = $${paramIndex++}`);
  params.push(options.sender);
}

// Filter by draft reply
if (options?.hasDraft) {
  whereClauses.push(`c.draft_reply IS NOT NULL AND c.draft_reply != ''`);
}

// Search
if (options?.search && options.search.trim()) {
  whereClauses.push(`(c.last_message_text ILIKE $${paramIndex} OR c.client_name ILIKE $${paramIndex})`);
  params.push(`%${options.search.trim()}%`);
  paramIndex++;
}
```

---

## Hooks и API

### React Query Hooks

**Файл:** `src/hooks/useChats.ts`

#### useChats (Table View)
```typescript
const { data } = useChats({
  storeId,
  status: statusFilter,
  sender: lastSender,
  hasDraft,
  search: searchQuery,
  skip: 0,
  take: 50,
});
```

#### useChatsInfinite (Messenger View)
```typescript
const { data } = useChatsInfinite({
  storeId,
  status: statusFilter,
  sender: lastSender,
  hasDraft,
  search: debouncedSearchQuery, // Debounced!
  take: 50,
});
```

### Query Keys

**Важно:** Query keys включают все фильтры для корректного кеширования:

```typescript
// Table View
queryKey: ['chats', storeId, skip, take, status, sender, tag, search, hasDraft]

// Messenger View (Infinite Scroll)
queryKey: ['chats-infinite', storeId, status, sender, tag, search, hasDraft]

// Kanban View (load all, filter on client)
queryKey: ['all-chats', storeId] // NO filters - load all!
```

---

## Компоненты

### ChatsToolbar.tsx

**Изменения:**
- ❌ Удалено: кнопка "Последний ответ"
- ✅ Добавлено: кнопка "Фильтры" с двумя секциями
- ✅ Добавлено: `handleLastSenderToggle()`
- ✅ Добавлено: `handleDraftToggle()`

### MessengerView.tsx

**Изменения:**
```typescript
// Before
const { statusFilter, senderFilter, searchQuery } = useChatsStore();

// After
const { statusFilter, lastSender, hasDraft, searchQuery } = useChatsStore();
```

### ChatsTableView.tsx

**Изменения:**
```typescript
// Before
const { statusFilter, senderFilter, searchQuery } = useChatsStore();

// After
const { statusFilter, lastSender, hasDraft, searchQuery } = useChatsStore();
```

### page.tsx (Kanban)

**Изменения:**
```typescript
// Before
const { statusFilter, senderFilter, searchQuery } = useChatsStore();

// After
const { statusFilter, lastSender, hasDraft, searchQuery } = useChatsStore();
```

---

## Миграция и Breaking Changes

### Переименование полей

**State (Zustand):**
- `senderFilter` → `lastSender`

**Причина:**
- Более точное название (фильтр показывает, кто **последний написал**)
- Избежание путаницы с новым фильтром `hasDraft`

### Удаление per-store настроек

**До:**
```typescript
// Фильтры сохранялись для каждого магазина отдельно
loadStoreSettings(storeId);
saveStoreSettings(storeId, { statusFilter, senderFilter, searchQuery });
```

**После:**
```typescript
// Фильтры глобальные
// При переключении магазинов фильтры сохраняются
setCurrentStoreId(storeId); // Only reset temp state (selection, active chat)
```

**Причина:** Пользователь запросил глобальные фильтры

---

## Производительность

### Kanban (Client-side)
- ⚡ **0ms** - мгновенная фильтрация
- 📦 Загружает все чаты один раз
- ✅ Query key: `['all-chats', storeId]` (без фильтров)
- ♻️ Cache time: 2 минуты

### Messenger/Table (API-side)
- 🔄 ~500-1000ms - запрос к БД с фильтрацией
- 📊 Загружает только отфильтрованные данные
- ✅ Query key: включает все фильтры
- 🎯 Pagination работает корректно
- ⏱️ Debounce search: 300ms (Messenger)

---

## Troubleshooting

### Проблема: Фильтры не применяются в Канбане

**Решение:** Проверьте, что фильтрация происходит на клиенте:
```typescript
// page.tsx должен содержать:
const filteredChats = allChats.filter((chat) => {
  // ... фильтрация
});
```

### Проблема: Фильтры не работают в Messenger/Table

**Решение:** Проверьте, что хуки передают все параметры:
```typescript
useChatsInfinite({
  storeId,
  status: statusFilter,
  sender: lastSender,
  hasDraft, // ✅ Не забыть!
  search: debouncedSearchQuery,
});
```

### Проблема: При переключении магазина фильтры сбрасываются

**Решение:** Убедитесь, что в `StoreSelector.tsx` вызывается:
```typescript
useChatsStore.getState().resetTemporaryState(); // ✅ Правильно
// НЕ resetState() - такого метода нет!
```

---

## См. также

- [KANBAN_QUICK_START.md](./KANBAN_QUICK_START.md) - Kanban board guide
- [MESSENGER_VIEW_GUIDE.md](./MESSENGER_VIEW_GUIDE.md) - Messenger view guide
- [CHAT_STATUS_AND_TAGGING_SYSTEM.md](./CHAT_STATUS_AND_TAGGING_SYSTEM.md) - Status system design

---

**Создано:** 2026-01-22
**Статус:** ✅ Актуально
