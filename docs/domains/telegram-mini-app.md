# Telegram Mini App

**Last Updated:** 2026-03-06
**Status:** Current
**Bot:** `@R5_chat_bot`
**Source of Truth:** This document

---

## Architecture

**Bot:** Standalone Node.js process, PM2 fork (`wb-reputation-tg-bot`), long-polling (30s timeout)

**Script:** `scripts/start-telegram-bot.js` — no Next.js imports, direct `pg` Pool

**Mini App UI:** `src/app/(telegram)/tg/` — Next.js pages with inline styles (no Tailwind)

**Proxy API:** `src/app/api/telegram/` — 10 routes, HMAC auth

---

## Bot Commands

| Command | Purpose |
|---------|---------|
| `/start` | Welcome + deep link support (`wbrm_*` auto-link, `inv_*` auto-register) |
| `/link <api_key>` | Link R5 account by API key |
| `/stop` | Disable notifications |
| `/start_notifications` | Re-enable notifications |
| `/status` | Show account info + stats |
| `/unlink` | Unlink TG account |

---

## Auth Flow

**File:** `src/lib/telegram-auth.ts`

1. Parse Telegram `initData` query string
2. HMAC-SHA256: `secret = HMAC("WebAppData", botToken)`, `hash = HMAC(dataCheckString, secret)`
3. Compare with provided hash
4. Check freshness (default 24h)
5. DB lookup: `telegram_users` → userId

**Dev mode:** `TELEGRAM_DEV_MODE=true` + `dev_user:<userId>` bypasses HMAC

**API auth:** `authenticateTgApiRequest()` — tries JWT first, falls back to `X-Telegram-Init-Data` header

---

## Database Tables (Migration 009)

### `telegram_users` (1:1 with users)

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | TEXT UNIQUE | FK → users |
| `telegram_id` | BIGINT UNIQUE | Telegram user ID |
| `chat_id` | BIGINT | Telegram chat ID (for sending) |
| `is_notifications_enabled` | BOOLEAN | Default TRUE |

### `telegram_notifications_log` (dedup)

| Column | Type | Purpose |
|--------|------|---------|
| `telegram_user_id` | TEXT | FK → telegram_users |
| `chat_id` | TEXT | R5 chat ID |
| `notification_type` | TEXT | `client_reply`, `success_*` |
| `sent_at` | TIMESTAMPTZ | For dedup checks |

---

## Queue Page

**File:** `src/app/(telegram)/tg/page.tsx`

**Principle:** Shows ONLY review-linked chats (`INNER JOIN review_chat_links`)

**Features:**
- Status tabs: Ожидание → Входящие → В работе → Закрытые
- Store filter (multi-select) + Rating filter (1-5★)
- Infinite scroll (50/page), sessionStorage cache (10 min)
- Bulk actions: AI generate, send, close, sequence start
- Auto-refresh every 5 min

**Card (`TgQueueCard.tsx`):**
- Client name, product, rating stars, message preview
- Tag + sequence action card (gray #F9FAFB)
- Cashback chip (hidden for 4★+)

---

## Chat Detail Page

**File:** `src/app/(telegram)/tg/chat/[chatId]/page.tsx`

**Layout:** Header (56px) → Messages (flex-1) → Composer (sticky)

**Composer buttons:**
1. **Send** (green) — sends message to WB/OZON
2. **AI ответ** (blue) — generates draft via Deepseek
3. **⋮ Menu** — sequence start/stop, next chat, close

**Info sheet (bottom modal):**
- Context: strategy, cashback, complaint/review status
- Funnel: 4-step deletion workflow with interactive dots
- Sequence: active/stopped status, start/stop buttons
- Product details: nmId, review date/text

---

## API Routes (`/api/telegram/`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/verify` | Validate initData, return stores |
| POST | `/auth/login` | Email+password → JWT |
| GET | `/queue` | Review-linked chat queue |
| GET | `/chats/[chatId]` | Chat detail + messages |
| PATCH | `/chats/[chatId]/status` | Change status/tag |
| POST | `/chats/[chatId]/send` | Send message |
| POST | `/chats/[chatId]/generate-ai` | Generate AI draft |
| GET | `/chats/[chatId]/sequence` | Sequence status |
| POST | `/chats/[chatId]/sequence/start` | Start sequence |
| POST | `/chats/[chatId]/sequence/stop` | Stop sequence |

---

## Notifications

**File:** `src/lib/telegram-notifications.ts`

**Types:**
- **Digest** (`client_reply`): 1h dedup, up to 5 chats, "Открыть очередь" button
- **Success** (`success_*`): 24h dedup, per-event, "Открыть чат" button

**Silent hours:** 20:00-10:00 MSK

**Hook:** Dialogue sync Step 5a-tg (non-blocking)

---

## Design System

**Framework:** Inline styles only (no Tailwind in TG)

**Colors:** Primary #2563EB, Success #10B981, Danger #EF4444, Background #F7F8FA

**Components:** Cards (16px radius), bottom-sheet modals (20px radius top), gradient buttons

**Haptic:** `Telegram.WebApp.HapticFeedback.notificationOccurred(type)`

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/start-telegram-bot.js` | Bot process (standalone) |
| `src/lib/telegram-auth.ts` | HMAC validation |
| `src/lib/telegram-notifications.ts` | Notification dispatch |
| `src/db/telegram-helpers.ts` | DB CRUD |
| `src/lib/telegram-auth-context.tsx` | React auth context |
| `src/app/(telegram)/tg/page.tsx` | Queue page |
| `src/app/(telegram)/tg/chat/[chatId]/page.tsx` | Chat detail |
| `migrations/009_telegram_integration.sql` | Tables |

---

**Last Updated:** 2026-03-06
