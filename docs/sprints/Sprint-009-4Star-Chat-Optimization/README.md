# Sprint 009 — 4-Star Chat Optimization & Stage Guard Completion

**Дата:** 2026-03-14
**Статус:** Done
**Предыдущий:** Sprint 008 (Dashboard Stage Enforcement)

---

## Цель

Завершить stage enforcement для всех endpoint'ов расширения. Sprint 008 покрыл chatOpens/chatLinks, но пропустил:
- statusParses (chat-only рейтинги выдавались до этапа чатов)
- `GET /stores` pendingChats (без проверки stage)
- totalCounts в tasks (chat counts без stage guard)

## Изменения

### 1. Stage guard на statusParses (tasks/route.ts)
- Чат-путь (`work_in_chats AND chat_rating_N`) активен только при `chatTasksAllowed`
- Жалобный путь — без ограничений
- Параметр: `$2 = chatTasksAllowed`

### 2. Stage guard на GET /stores (stores/route.ts)
- Q2 (statusParses): chat-only рейтинги gated by `s.stage IN ('chats_opened', 'monitoring')`
- Q3 (pendingChats): добавлено `AND s.stage IN ('chats_opened', 'monitoring')`
- Q1: добавлено `s.stage` в SELECT

### 3. Stage guard на totalCounts (tasks/route.ts, Query E)
- `chat_opens_total` и `chat_links_total` → `CASE WHEN $2 = TRUE THEN ... ELSE 0 END`
- `status_parses_total` → тот же `$2` guard на чат-путь

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/app/api/extension/stores/[storeId]/tasks/route.ts` | Query A + Query E: `$2 = chatTasksAllowed` |
| `src/app/api/extension/stores/route.ts` | Q1 stage, Q2 chat-only guard, Q3 stage guard |
