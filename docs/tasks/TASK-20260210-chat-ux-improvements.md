# TASK-20260210: Chat UX Improvements (3 improvements)

## Goal
Улучшить UX работы с чатами в канбан-доске и мессенджере:
- **A**: Маркировка авто-рассылочных сообщений в UI (бот vs менеджер)
- **B**: Модальное окно просмотра чата из канбан-карточки
- **C**: Отображение статуса канбана в Messenger View + смена статуса из чата

## Current State
- Авто-сообщения (`sender='seller'`) **неотличимы** от ручных в `chat_messages` — единственный маркер: ID с префиксом `auto_`
- В канбане нет клика → просмотр чата (нужно переключаться на Messenger View)
- В Messenger View (ConversationPanel) нет индикатора статуса канбана

Ключевые файлы:
- `src/types/chats.ts` — ChatMessage (frontend)
- `src/db/helpers.ts:160` — ChatMessage (backend), `createChatMessage`, `getChatMessages`
- `src/lib/cron-jobs.ts:736` — auto-sequence создаёт сообщения с `auto_` ID
- `src/components/chats/MessageBubble.tsx` — отображение пузыря
- `src/components/chats/ChatKanbanCard.tsx` — карточка канбана
- `src/components/chats/KanbanBoardView.tsx` — доска канбана
- `src/components/chats/ConversationPanel.tsx` — панель чата
- `src/app/api/stores/[storeId]/chats/[chatId]/route.ts` — API одного чата

## Proposed Changes

### A: Маркировка авто-сообщений
1. **DB migration**: `ALTER TABLE chat_messages ADD COLUMN is_auto_reply BOOLEAN DEFAULT FALSE`
2. **Backend**:
   - Добавить `is_auto_reply` в интерфейс `ChatMessage` (db/helpers.ts)
   - В `createChatMessage` поддержать новое поле
   - В cron-jobs.ts при создании автосообщений ставить `is_auto_reply: true`
3. **API**: Включить `isAutoReply` в маппинг GET /chats/[chatId]
4. **Frontend type**: Добавить `isAutoReply?: boolean` в `ChatMessage`
5. **UI (MessageBubble)**: Для `isAutoReply=true` — иконка 🤖, подпись «Авто-рассылка», другой цвет фона

### B: Модальное окно чата из канбана
1. **Новый компонент** `ChatPreviewModal.tsx` — загружает и показывает историю сообщений
2. **ChatKanbanCard** — добавить onClick → открыть модалку
3. **DraggableKanbanCard** — разделить клик vs drag (по distance)
4. **KanbanBoardView** — state для выбранного чата + рендер модалки

### C: Статус канбана в Messenger
1. **ConversationPanel** — добавить badge статуса + dropdown для смены
2. **API**: Использовать существующий PATCH /chats/[chatId]/status
3. **Индикатор авто-рассылки** — если есть активная sequence, показать прогресс

## Impact
- **DB**: +1 колонка `is_auto_reply` в `chat_messages` (migration)
- **API**: Расширение GET /chats/[chatId] — обратно совместимо
- **Cron**: +1 поле при createChatMessage — обратно совместимо
- **AI**: Не затронут
- **UI**: 3 компонента изменены + 1 новый

## Required Docs Updates
- `docs/database-schema.md` — новое поле `is_auto_reply`
- `docs/domains/chats-ai.md` — обновить информацию о маркировке

## Rollout Plan
1. Миграция БД (безопасно — DEFAULT FALSE, nullable)
2. Backend + API
3. Frontend UI
4. Backfill: `UPDATE chat_messages SET is_auto_reply = TRUE WHERE id LIKE 'auto_%'`

## Backout Plan
- Поле `is_auto_reply` — просто игнорировать на фронте (DEFAULT FALSE)
- Модалка — отдельный компонент, можно удалить
- Badge статуса — независимый UI элемент
