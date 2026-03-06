# TASK-20260306: Enforce 1 Chat = 1 Review in review_chat_links

## Goal

Добавить `UNIQUE(chat_id, store_id)` constraint в `review_chat_links`, чтобы исключить привязку нескольких отзывов к одному чату. Бизнес-правило: **1 отзыв = 1 чат** (всегда, все маркетплейсы).

## Current State

- Таблица `review_chat_links` имеет `UNIQUE(store_id, review_key)`, но **нет** `UNIQUE(chat_id, store_id)`
- Найдено **56 чатов** с дублирующимися ссылками (2 review_chat_links на 1 chat_id)
- Причина: Extension может отправить один `chatUrl` для разных `reviewKey`, а `reconcileChatWithLink()` обновляет ВСЕ строки, матчащие URL
- Docs: `docs/AUDIT_TELEGRAM_MINI_APPS.md`, `docs/AUDIT_FINDINGS_SUMMARY.md`

## Proposed Change

### Migration 026

1. **Удалить ВСЕ дубли** (обе записи, не одну) — чтобы задача вернулась в Extension для корректной привязки
2. **Добавить partial unique index**: `UNIQUE(chat_id, store_id) WHERE chat_id IS NOT NULL`

### Code Changes

1. **`createReviewChatLink()`** — добавить pre-check: если `chat_id` уже привязан к другому отзыву в store, вернуть existing
2. **`reconcileChatWithLink()`** — ограничить UPDATE одной строкой (`LIMIT 1` через subquery)

## Impact

### DB
- Migration 026: DELETE дублей + CREATE UNIQUE INDEX
- ~112 строк удалятся (56 пар дублей)

### API
- Нет изменений в API контрактах
- `createReviewChatLink()` вернёт existing вместо создания дубля

### Cron
- `startResolvedReviewCloser()` — без изменений, constraint гарантирует корректность
- `startAutoSequenceProcessor()` — без изменений

### AI
- `findLinkByChatId()` — теперь гарантированно 0 или 1 результат (было неопределённо)

### UI
- Extension получит задачи на привязку удалённых дублей обратно
- TG/Web — без изменений

## Required Docs Updates

- `docs/reference/database-schema.md` — добавить constraint
- `MEMORY.md` — обновить раздел review_chat_links

## Rollout Plan

1. Применить миграцию 026
2. Деплой с code changes
3. Перезапуск PM2

## Backout Plan

- `DROP INDEX idx_rcl_unique_chat` — откатывает constraint
- Дубли не восстанавливаются (нет необходимости)
