# TASK-20260210: Telegram Mini App для управления чатами

## Goal

Создать Telegram Mini App, который позволяет менеджеру обрабатывать чаты с покупателями WB за минимальное время. Приходит пуш в Telegram при ответе клиента → менеджер открывает Mini App → видит чат + AI-черновик → нажимает одну из 4 кнопок: Отправить / Пересоздать / Закрыть / Пропустить.

**Ключевое преимущество:** бэкенд уже готов (API чатов, AI-генерация, отправка, смена статуса). Mini App — это новый мобильный фронтенд + TG бот для push-уведомлений.

## Current State

- Веб-кабинет: канбан, мессенджер, таблица чатов
- API: полный CRUD для чатов (fetch, send, generate-ai, status)
- Dialogue sync: cron каждые 15-60 мин через WB API (polling)
- AI: Deepseek генерирует draft_reply, хранится в chats.draft_reply
- Auth: Bearer token через user_settings.api_key (wbrm_* формат)
- PM2: 2 app instances (cluster) + 1 cron (fork)
- Нет TG-интеграции, нет бота, нет зависимостей для Telegram

## Proposed Change

### Архитектура

```
TG Bot (PM2 fork)          Next.js App (PM2 cluster x2)
  │                              │
  ├─ /start, /link, /stop       ├─ /tg (Mini App pages)
  ├─ Long-polling                ├─ /api/telegram/* (API для Mini App)
  └─ Отправка пушей             └─ /api/stores/* (существующие API)
```

### Новые таблицы

| Таблица | Назначение |
|---------|-----------|
| `telegram_users` | Связь TG аккаунта с R5 юзером (1:1) |
| `telegram_notifications_log` | Лог отправленных push-уведомлений (дедупликация) |

### Новые API endpoints

| Endpoint | Метод | Назначение |
|----------|-------|-----------|
| `/api/telegram/auth/verify` | POST | Валидация initData → userId + stores |
| `/api/telegram/queue` | GET | Единая очередь чатов через все магазины |
| `/api/telegram/chats/[chatId]` | GET | Чат + сообщения (proxy) |
| `/api/telegram/chats/[chatId]/send` | POST | Отправить сообщение (proxy) |
| `/api/telegram/chats/[chatId]/generate-ai` | POST | Сгенерировать черновик (proxy) |
| `/api/telegram/chats/[chatId]/status` | PATCH | Сменить статус (proxy) |

### Команды бота

| Команда | Действие |
|---------|---------|
| `/start` | Приветствие + инструкция |
| `/link wbrm_<key>` | Привязка TG к R5 аккаунту |
| `/stop` | Отключить уведомления |
| `/status` | Статус привязки |

---

## Impact Analysis

### DB
- **Новые таблицы:** `telegram_users`, `telegram_notifications_log` (миграция 009)
- **Существующие таблицы:** без изменений

### API
- **Новые:** 6 endpoints под `/api/telegram/*`
- **Существующие:** без изменений (proxy вызывает DB helpers напрямую)

### Cron
- **Модификация:** `dialogues/update/route.ts` — добавить хук уведомлений при `sender='client'`
- **Новый PM2 процесс:** `wb-reputation-tg-bot` (long-polling)

### AI
- **Без изменений.** Используется существующий `generate-chat-reply-flow`

### UI
- **Новые страницы:** `/tg` (очередь), `/tg/chat/[chatId]` (действия)
- **Новые компоненты:** 8 компонентов в `src/components/telegram/`
- **Существующий UI:** без изменений

---

## Implementation Plan

### Phase 1: Foundation
1. Миграция 009 (telegram_users + telegram_notifications_log)
2. `src/db/telegram-helpers.ts` — CRUD
3. `src/lib/telegram-auth.ts` — HMAC валидация initData
4. `scripts/start-telegram-bot.js` — бот с командами /start, /link, /stop, /status
5. `ecosystem.config.js` — добавить PM2 процесс бота

### Phase 2: Notifications
6. `src/lib/telegram-notifications.ts` — отправка пушей, дедуп, батчинг
7. Хук в `dialogues/update/route.ts` — вызов уведомлений при sender='client'

### Phase 3: Mini App — Queue
8. `src/app/(telegram)/layout.tsx` — TG SDK, мобильный layout
9. `POST /api/telegram/auth/verify` — авторизация Mini App
10. `GET /api/telegram/queue` — единая очередь
11. `src/app/(telegram)/tg/page.tsx` — UI очереди
12. Компоненты: TgQueueCard, TgStoreBadge, TgEmptyState

### Phase 4: Mini App — Chat Actions
13. Proxy API routes (5 endpoints)
14. `src/app/(telegram)/tg/chat/[chatId]/page.tsx` — экран чата
15. Компоненты: TgChatView, TgActionBar, TgCompletionSheet

### Phase 5: Polish + Deploy
16. Haptic, Back button, тема TG
17. Документация
18. Deploy + BotFather config

---

## Required Docs Updates

- [ ] `docs/database-schema.md` — добавить telegram_users, telegram_notifications_log
- [ ] `docs/CRON_JOBS.md` — хук уведомлений в dialogue sync
- [ ] `docs/reference/ARCHITECTURE.md` — TG бот архитектура
- [ ] `DEPLOYMENT.md` — PM2 процесс бота, env vars

## Rollout Plan

1. Создать бота в BotFather
2. Добавить TELEGRAM_BOT_TOKEN в .env.production
3. Запустить миграцию 009
4. Deploy код
5. PM2 start tg-bot
6. Настроить Mini App URL в BotFather
7. Тест с реальным пользователем

## Backout Plan

1. PM2 stop tg-bot
2. Откат кода (git revert)
3. Таблицы telegram_* можно оставить (не влияют на основную систему)

## Risks

| Риск | Вероятность | Митигация |
|------|------------|----------|
| Задержка уведомлений (15-60 мин) | Высокая | Приемлемо для MVP, можно уменьшить интервал |
| TG API rate limit | Низкая | Natural rate limiting в sync |
| Бот упал | Низкая | PM2 autorestart, изолирован от основного приложения |
| initData replay | Низкая | Проверка auth_date < 24 часа |

## Dependencies (npm)

| Пакет | Зачем |
|-------|-------|
| `node-telegram-bot-api` | TG Bot API (long-polling + sendMessage) |
