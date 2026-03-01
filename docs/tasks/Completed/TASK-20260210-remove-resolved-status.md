# TASK-20260210: Remove 'resolved' status, reorder Kanban columns

## Goal

Убрать статус `resolved` из системы чатов. Он дублирует `closed` по смыслу.
Новый порядок колонок канбана: **Входящие → Ожидание → В работе → Закрыто** (4 колонки).

## Current State

- 5 ChatStatus: `inbox | in_progress | awaiting_reply | resolved | closed`
- `resolved` используется в **14 файлах**, ~34 упоминаний
- Колонки канбана: inbox → in_progress → awaiting_reply → resolved → closed
- В `closed` нельзя перенести без `completion_reason` (8 причин)
- В `resolved` можно перенести без причины
- Миграция 003 маппит `successful` и `deletion_agreed` теги → `resolved`
- Миграция `004_close_resolved_chats.sql` ставит `resolved` при удалении/обновлении отзыва

## Proposed Change

### Новая модель статусов (4 статуса)

```
ChatStatus = 'inbox' | 'in_progress' | 'awaiting_reply' | 'closed'
```

### Новый порядок колонок канбана

| # | Status | Title | Описание |
|---|--------|-------|----------|
| 1 | `inbox` | Входящие | Новые чаты |
| 2 | `awaiting_reply` | Ожидание | Ждём ответа клиента |
| 3 | `in_progress` | В работе | Менеджер обрабатывает |
| 4 | `closed` | Закрыто | Завершённые (всегда с причиной) |

### Миграция данных

```sql
-- Шаг 1: Чаты со статусом 'resolved' БЕЗ completion_reason → переносим в 'in_progress'
UPDATE chats
SET status = 'in_progress', status_updated_at = NOW()
WHERE status = 'resolved' AND completion_reason IS NULL;

-- Шаг 2: Чаты со статусом 'resolved' С completion_reason → переносим в 'closed'
UPDATE chats
SET status = 'closed', status_updated_at = NOW()
WHERE status = 'resolved' AND completion_reason IS NOT NULL;

-- Шаг 3: Обновляем CHECK constraint
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_status_check;
ALTER TABLE chats ADD CONSTRAINT chats_status_check
  CHECK (status IN ('inbox', 'in_progress', 'awaiting_reply', 'closed'));
```

---

## Impact Analysis

### 1. DB (миграция 008)

| Что | Действие |
|-----|----------|
| `chats.status` CHECK constraint | Убрать `resolved` из допустимых значений |
| Существующие `resolved` чаты без причины | → `in_progress` |
| Существующие `resolved` чаты с причиной | → `closed` |
| Индексы `idx_chats_kanban`, `idx_chats_closed_analytics` | Не требуют изменений |

### 2. Backend Types (2 файла)

| Файл | Строка | Изменение |
|------|--------|-----------|
| `src/db/helpers.ts` | L22 | Убрать `'resolved'` из `ChatStatus` union |
| `src/types/chats.ts` | L21 | Убрать `'resolved'` из `ChatStatus` union |

### 3. API (1 файл)

| Файл | Строка | Изменение |
|------|--------|-----------|
| `src/app/api/stores/[storeId]/chats/[chatId]/status/route.ts` | L26 | Убрать `'resolved'` из `validStatuses` |

### 4. UI Components (6 файлов)

| Файл | Что менять |
|------|-----------|
| `src/components/chats/KanbanBoardView.tsx` | COLUMNS: убрать resolved, переставить порядок; `chatsByStatus`: убрать resolved; `grid-cols-5` → `grid-cols-4` |
| `src/components/chats/ChatPreviewModal.tsx` | STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS, ALL_STATUSES: убрать resolved |
| `src/components/chats/ConversationPanel.tsx` | STATUS_LABELS, STATUS_COLORS: убрать resolved; убрать `key === 'resolved'` в цветах |
| `src/components/chats/ChatKanbanCard.tsx` | STATUS_LABELS, STATUS_COLORS: убрать resolved |
| `src/components/chats/ChatsToolbar.tsx` | STATUS_LABELS, STATUS_EMOJIS: убрать resolved |
| `src/components/chats/KanbanColumn.tsx` | COLUMN_COLORS, COLUMN_HEADER_COLORS: убрать resolved |

### 5. State & Page (2 файла)

| Файл | Что менять |
|------|-----------|
| `src/app/stores/[storeId]/chats/page.tsx` | `statusStats` reducer: убрать `resolved: 0` из initialValue |
| `src/store/chatsStore.ts` | Проверить — если нет явного упоминания `resolved`, не требует изменений |

### 6. Cron Jobs

| Файл | Что менять |
|------|-----------|
| `src/lib/cron-jobs.ts` | Не содержит `resolved` — **без изменений** |
| Маппинг `successful` → `resolved` | Больше не актуален (was in migration 003/004, уже выполнены) |

### 7. Миграции (3 файла — только документировать)

| Файл | Действие |
|------|---------|
| `migrations/003_add_chat_status.sql` | Оставить как есть (историческая миграция, уже выполнена) |
| `migrations/004_fix_chat_status.sql` | Оставить как есть |
| `migrations/004_close_resolved_chats.sql` | Оставить как есть |

### 8. Документация (4 файла)

| Файл | Действие |
|------|---------|
| `docs/database-schema.md` | Обновить список статусов (4 вместо 5) |
| `docs/product-specs/CHAT_STATUS_AND_TAGGING_SYSTEM.md` | Обновить спецификацию |
| `docs/product-specs/KANBAN_BOARD_IMPLEMENTATION.md` | Обновить спецификацию |
| `docs/reference/statuses-reference.md` | Обновить если существует |

---

## Implementation Plan (порядок выполнения)

### Phase 1: DB Migration (миграция 008)

1. Создать `migrations/008_remove_resolved_status.sql`
2. Мигрировать `resolved` чаты → `in_progress` или `closed`
3. Обновить CHECK constraint
4. Выполнить на проде

### Phase 2: Backend Types + API

5. `src/db/helpers.ts` — убрать `'resolved'` из `ChatStatus`
6. `src/types/chats.ts` — убрать `'resolved'` из `ChatStatus`
7. `src/app/api/.../status/route.ts` — убрать из `validStatuses`

### Phase 3: UI Components

8. `KanbanBoardView.tsx` — COLUMNS (новый порядок, 4 колонки), chatsByStatus, grid-cols-4
9. `KanbanColumn.tsx` — COLUMN_COLORS, COLUMN_HEADER_COLORS
10. `ChatKanbanCard.tsx` — STATUS_LABELS, STATUS_COLORS
11. `ChatPreviewModal.tsx` — STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS, ALL_STATUSES
12. `ConversationPanel.tsx` — STATUS_LABELS, STATUS_COLORS
13. `ChatsToolbar.tsx` — STATUS_LABELS, STATUS_EMOJIS

### Phase 4: Page & State

14. `page.tsx` — statusStats reducer
15. Проверить `chatsStore.ts`

### Phase 5: Build & Deploy

16. TypeScript check
17. Build
18. Deploy to production

### Phase 6: Documentation

19. `docs/database-schema.md`
20. `docs/product-specs/CHAT_STATUS_AND_TAGGING_SYSTEM.md`
21. `docs/product-specs/KANBAN_BOARD_IMPLEMENTATION.md`

---

## Required Docs Updates

- [x] `docs/tasks/TASK-20260210-remove-resolved-status.md` (этот файл)
- [ ] `docs/database-schema.md` — 4 статуса вместо 5
- [ ] `docs/product-specs/CHAT_STATUS_AND_TAGGING_SYSTEM.md` — новый список статусов
- [ ] `docs/product-specs/KANBAN_BOARD_IMPLEMENTATION.md` — 4 колонки, новый порядок

## Rollout Plan

1. Миграция 008 на проде (безопасно — только UPDATE + ALTER CONSTRAINT)
2. Деплой нового кода
3. Верификация: канбан показывает 4 колонки в правильном порядке
4. Проверить: нет чатов со статусом `resolved` в БД

## Backout Plan

1. Откатить код (git revert)
2. Вернуть CHECK constraint: `ALTER TABLE chats DROP CONSTRAINT chats_status_check; ALTER TABLE chats ADD CONSTRAINT chats_status_check CHECK (status IN ('inbox', 'in_progress', 'awaiting_reply', 'resolved', 'closed'));`
3. Чаты, перенесённые в `in_progress` или `closed`, остаются (не критично)

## Risks

- **Низкий**: Чаты с `resolved` без причины переносятся в `in_progress` — менеджер увидит их снова и обработает
- **Низкий**: Чаты с `resolved` + причина переносятся в `closed` — уже были фактически завершены
- **Средний**: Если пользователь привык к колонке "Решено" — может потребоваться объяснение
