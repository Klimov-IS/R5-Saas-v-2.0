# Auto-Sequence System

**Last Updated:** 2026-03-06
**Status:** Current
**Migration:** 005
**Source of Truth:** This document

---

## Overview

Automated multi-message sequences for follow-up with buyers. **Manual activation only** (from TG Mini App). First message sent immediately, rest via cron.

---

## Sequence Types

### Base Sequences (30-day, rating-based)

| Type | Rating | Messages | Interval | Family |
|------|--------|----------|----------|--------|
| `no_reply_followup_30d` | 1-3★ | 15 msgs | ~2 days | `no_reply_followup` |
| `no_reply_followup_4star_30d` | 4★ | 10 msgs | ~3 days | `no_reply_followup_4star` |

### Tag-Based Funnel Sequences

| Type | Tag | Messages | Duration | Purpose |
|------|-----|----------|----------|---------|
| `offer_reminder` | `deletion_offered` | 5 msgs | ~14 days | Remind about compensation offer |
| `agreement_followup` | `deletion_agreed` | 4 msgs | ~10 days | Remind about review deletion |

**Config:** `TAG_SEQUENCE_CONFIG` in `src/lib/auto-sequence-templates.ts`

---

## Table: `chat_auto_sequences`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `chat_id` | TEXT NOT NULL | FK → chats (CASCADE) |
| `store_id` | TEXT NOT NULL | Store ID |
| `owner_id` | TEXT NOT NULL | User who started |
| `sequence_type` | VARCHAR(50) | Type identifier |
| `messages` | JSONB | `[{day, text}]` template array |
| `current_step` | INT (0) | 0-indexed position |
| `max_steps` | INT | Total messages |
| `status` | VARCHAR(20) | `active` \| `paused` \| `completed` \| `stopped` |
| `stop_reason` | VARCHAR(50) | Why stopped |
| `next_send_at` | TIMESTAMPTZ | Scheduled send time |
| `last_sent_at` | TIMESTAMPTZ | Last message timestamp |

**Stop reasons:** `client_replied`, `status_changed`, `review_resolved`, `manual`, `send_failed`, `missing_reply_sign`

---

## Activation (Manual Only)

**API:** `POST /api/telegram/chats/[chatId]/sequence/start`

**Body:** `{ sequenceType?: string }` — omit for auto-detect by rating

**Behavior:**
1. Check no active sequence (409 if exists)
2. Check review not resolved (400 if resolved)
3. Check family dedup (no completed same-family)
4. Create sequence record
5. **Send first message immediately** (Day 0)
6. Set chat status → `awaiting_reply`

**Other endpoints:**
- `GET /api/telegram/chats/[chatId]/sequence` — current status
- `POST /api/telegram/chats/[chatId]/sequence/stop` — manual stop

---

## Cron Processing

### Auto-Sequence Processor

**Schedule:** Every 30 min (:00, :30)
**Window:** 8:00-22:00 MSK only
**Limit:** 100 pending sequences per run

**Per-sequence checks (in order):**
1. Client replied since start? → stop (`client_replied`), move to `inbox`
2. Chat status invalid? → stop (`status_changed`)
3. Review resolved? → stop (`review_resolved`)
4. Seller sent today (MSK)? → reschedule tomorrow (no step advance)
5. All steps done? → complete, close chat (`no_reply`)
6. Send message → advance step, schedule next

**Rate limit:** 3-second delay between sends

### Resolved-Review Closer

**Schedule:** Every 30 min (:15, :45) — offset from processor
**Limit:** 200 chats per run

Auto-closes chats where linked review is resolved (complaint approved, excluded, hidden, deleted, rating_excluded). Stops active sequences.

---

## Send Timing

**Business hours:** 10:00-17:00 MSK (weighted random)
**Day 0:** If before 17:00 MSK → send today, else tomorrow

**Weights:** 10:00-13:00 = 15% each, 14:00-17:00 = 10% each

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auto-sequence-templates.ts` | Templates, TAG_SEQUENCE_CONFIG, send slots |
| `src/lib/auto-sequence-sender.ts` | Shared send logic |
| `src/lib/auto-sequence-launcher.ts` | Auto-launch logic (dialogue sync) |
| `src/lib/cron-jobs.ts` | Processor + resolved-review closer |
| `src/core/services/sequence-service.ts` | TG API domain service |
| `src/app/api/telegram/chats/[chatId]/sequence/` | TG API endpoints |
| `migrations/005_create_chat_auto_sequences.sql` | Table schema |

---

## See Also

- [chats-ai.md](./chats-ai.md) — AI generation for chat replies
- [TAG_CLASSIFICATION.md](./TAG_CLASSIFICATION.md) — Tag system (deletion workflow)
- [audit-trail.md](./audit-trail.md) — Status change logging
- [review-chat-links.md](./review-chat-links.md) — Review-chat associations

---

**Last Updated:** 2026-03-06
