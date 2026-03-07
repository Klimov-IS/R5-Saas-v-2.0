# Kanban Board — Быстрый старт

**Last Updated:** 2026-03-06
**Status:** Current
**Source of Truth:** Statuses — [statuses-reference.md](./reference/statuses-reference.md)

---

## Что реализовано

- Kanban board с Drag & Drop (@dnd-kit/core)
- 4 колонки статусов (Ожидание, Входящие, В работе, Закрыто)
- Client-side фильтрация (мгновенная)
- Массовые операции
- Audit trail — каждое изменение статуса логируется в `chat_status_history`

---

## Колонки статусов

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ ⏳ Ожидание  │ 📥 Входящие  │ 🔄 В работе  │ 🔒 Закрыто   │
│(awaiting_re.)│   (inbox)    │(in_progress) │   (closed)   │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Ждём ответа  │ Клиент       │ Продавец     │ Диалог       │
│ от клиента   │ ответил      │ отвечает     │ завершён     │
└──────────────┴──────────────┴──────────────┴──────────────┘
       ↑ Drag & Drop между колонками
```

**Порядок:** Ожидание → Входящие → В работе → Закрытые (дефолт = `awaiting_reply`)

---

## Как использовать

### 1. Переключение в режим Kanban

На странице `/stores/[storeId]/chats` в тулбаре кнопки:
- Таблица — табличный вид
- Мессенджер — мессенджер-подобный
- Канбан — Kanban board

### 2. Drag & Drop

- Зажмите карточку чата
- Перетащите в другую колонку
- Статус обновится автоматически
- Изменение записывается в `chat_status_history` (audit trail, migration 027)

### 3. Информация на карточке

- Имя клиента
- Название товара
- Последнее сообщение (preview)
- Время обновления
- Счётчик сообщений
- Индикатор черновика

### 4. Фильтры

Работают во ВСЕХ режимах (Таблица, Мессенджер, Канбан):

- **По статусу** — кнопки в тулбаре
- **По отправителю** — от клиента / от нас
- **С черновиком** — только чаты с AI-черновиками
- **Текстовый поиск** — по клиенту, товару, сообщению

---

## Tag vs Status

Два параллельных поля:

| Поле | Назначение | Значения |
|------|-----------|----------|
| `status` | CRM-воронка (где чат в процессе) | `awaiting_reply`, `inbox`, `in_progress`, `closed` |
| `tag` | Этап воронки удаления | `deletion_candidate`, `deletion_offered`, `deletion_agreed`, `deletion_confirmed`, `NULL` |

**Теги НЕ влияют на колонки Kanban.** Kanban показывает только `status`.

---

## Audit Trail (migration 027)

Каждое изменение статуса/тега записывается:

- **`chat_status_history`** — иммутабельный лог изменений
- **`chats.status_changed_by`** — кто изменил (userId или NULL для системы)
- **`chats.closure_type`** — `'manual'` | `'auto'` (для закрытий)
- **`change_source`** — откуда: `web_app`, `tg_app`, `cron_resolved`, `cron_sequence`, `sync_dialogue`, `extension`, `bulk_action`

---

## Техническая информация

### Компоненты

- `src/components/chats/KanbanBoardView.tsx` — главный контейнер
- `src/components/chats/KanbanColumn.tsx` — колонка
- `src/components/chats/ChatKanbanCard.tsx` — карточка чата

### API Endpoints

```
GET   /api/stores/[storeId]/chats                    # Список чатов
PATCH /api/stores/[storeId]/chats/[chatId]/status    # Изменение статуса
POST  /api/stores/[storeId]/chats/bulk-actions       # Массовые операции
```

### State & Data

- **Zustand** (`chatsStore`) — режим, фильтры, выбранные чаты
- **React Query** — `['all-chats', storeId]` (без фильтров, client-side filtering)
- **Drag & Drop** — @dnd-kit/core

---

## См. также

- [FILTERS_SYSTEM.md](./FILTERS_SYSTEM.md) — Система фильтров
- [MESSENGER_VIEW_GUIDE.md](./MESSENGER_VIEW_GUIDE.md) — Messenger view
- [statuses-reference.md](./reference/statuses-reference.md) — Все статусы

---

**Last Updated:** 2026-03-06
