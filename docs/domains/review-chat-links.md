# Review-Chat Links

**Last Updated:** 2026-03-06
**Status:** Current
**Migrations:** 016 (table), 026 (uniqueness fix)
**Source of Truth:** This document

---

## Business Invariant

**1 Review = 1 Chat** across all marketplaces. One review maps to exactly one chat. A buyer with multiple reviews → multiple chats, but each chat is about ONE review.

---

## Table Schema

```sql
CREATE TABLE review_chat_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Review side
  review_id       TEXT REFERENCES reviews(id) ON DELETE SET NULL,
  review_key      TEXT NOT NULL,        -- "{nmId}_{rating}_{dateTruncMin}"
  review_nm_id    TEXT NOT NULL,        -- WB product nmID
  review_rating   INTEGER NOT NULL,     -- 1-5
  review_date     TIMESTAMPTZ NOT NULL,

  -- Chat side
  chat_id         TEXT REFERENCES chats(id) ON DELETE SET NULL,
  chat_url        TEXT NOT NULL,        -- Full WB chat URL

  -- Status tracking
  status          TEXT NOT NULL DEFAULT 'chat_opened',

  -- Timestamps
  opened_at       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(store_id, review_key)
);

-- Migration 026: enforce 1 chat = 1 review
CREATE UNIQUE INDEX idx_rcl_unique_chat_per_store
  ON review_chat_links (chat_id, store_id)
  WHERE chat_id IS NOT NULL;
```

**Nullable FKs:** `review_id` and `chat_id` use `SET NULL` on delete — link survives even if review/chat is deleted.

---

## How Links Are Created (3 Sources)

### Source 1: Chrome Extension

**API:** `POST /api/extension/chat/opened`

Extension opens chat from WB reviews page → creates link with `chat_url` and review context. `chat_id` initially NULL (populated by reconciliation).

### Source 2: Dialogue Sync Reconciliation (Step 3.5)

**File:** `src/app/api/stores/[storeId]/dialogues/update/route.ts`

When dialogue sync fetches active chats, `reconcileChatWithLink()` matches pending links by `chat_url` → sets `chat_id`. Auto-tags `deletion_candidate`.

### Source 3: Review Fuzzy Match

Extension provides `nmId + rating + reviewDate`. `matchReviewByContext()` fuzzy-matches (±2 min) → sets `review_id`.

---

## Migration 026: Uniqueness Fix

**Problem:** 56 chats had 2+ review_chat_links pointing to different reviews. No uniqueness constraint on `(chat_id, store_id)`.

**Fix:**
1. Deleted all records in duplicate groups (conservative: re-link via extension)
2. Added partial unique index `idx_rcl_unique_chat_per_store`

---

## TG Queue Filtering

**Principle:** TG Mini App shows ONLY chats with `review_chat_links` record.

```sql
-- WB: INNER JOIN (review-linked only)
INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id

-- Excludes resolved reviews
WHERE NOT (r.complaint_status = 'approved'
  OR r.review_status_wb IN ('excluded','unpublished','hidden','deleted')
  OR r.rating_excluded = TRUE)
```

**Effect:** ~700 actionable chats vs 300K+ total.

**Enriched data from links:**
- `review_rating`, `review_date` (from rcl)
- `complaint_status`, `review_status_wb` (from LEFT JOIN reviews)
- `offer_compensation`, `max_compensation` (from product_rules)

---

## Review Resolution Detection

**Function:** `isReviewResolvedForChat(chatId)` → `{ resolved, reason }`

**Resolved conditions (any = resolved):**
- `complaint_status = 'approved'`
- `review_status_wb IN ('excluded', 'unpublished', 'temporarily_hidden', 'deleted')`
- `rating_excluded = true`

**Used by:** auto-sequence stop conditions, sequence start guards, cron resolved-review closer

---

## Key Helpers (`src/db/review-chat-link-helpers.ts`)

| Function | Purpose |
|----------|---------|
| `createReviewChatLink(input)` | Create (idempotent on review_key), auto-tag `deletion_candidate` |
| `reconcileChatWithLink(chatId, storeId)` | Match pending link, set chat_id |
| `findLinkByChatId(chatId)` | Get review context for chat |
| `isReviewResolvedForChat(chatId)` | Check if linked review is resolved |
| `matchReviewByContext(storeId, nmId, rating, date)` | Fuzzy match (±2 min) |
| `closeLinkedChatsForReview(reviewId, reason)` | Auto-close chat, stop sequences |

---

## Workflow Timeline

```
1. Extension opens chat from review page
   └─ Creates review_chat_link (chat_id=NULL, review_id=matched)

2. Dialogue sync fetches active WB chats
   └─ reconcileChatWithLink() → sets chat_id, tags deletion_candidate

3. Auto-sequence launcher checks
   └─ If rating 1-3★ + no active sequence → creates 30-day sequence

4. TG queue shows chat with review rating + product info

5. Review resolves (complaint approved / review deleted)
   └─ closeLinkedChatsForReview() → close chat, stop sequence
```

---

## See Also

- [audit-trail.md](./audit-trail.md) — Status change logging
- [auto-sequences.md](./auto-sequences.md) — Sequence system
- [TAG_CLASSIFICATION.md](./TAG_CLASSIFICATION.md) — Tag system
- [telegram-mini-app.md](./telegram-mini-app.md) — TG queue filtering

---

**Last Updated:** 2026-03-06
