# Audit Trail — Chat Status History

**Last Updated:** 2026-03-06
**Status:** Current
**Migration:** 027
**Source of Truth:** This document

---

## Overview

Every chat status/tag change is logged immutably in `chat_status_history`. Tracks **WHO** changed it, **WHERE** the change came from, and **WHAT** changed.

---

## Schema

### New columns on `chats`

| Column | Type | Purpose |
|--------|------|---------|
| `status_changed_by` | TEXT | userId of last change (NULL = system) |
| `closure_type` | VARCHAR(20) | `'manual'` \| `'auto'` \| NULL |

### Table: `chat_status_history` (immutable, insert-only)

```sql
CREATE TABLE chat_status_history (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id        TEXT NOT NULL,
  store_id       TEXT NOT NULL,
  old_status     TEXT,
  new_status     TEXT NOT NULL,
  old_tag        TEXT,
  new_tag        TEXT,
  completion_reason TEXT,
  closure_type   VARCHAR(20),          -- 'manual' | 'auto'
  changed_by     TEXT,                 -- userId (NULL = system/cron)
  change_source  VARCHAR(30) NOT NULL, -- origin of change
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Design:** No FK on `chat_id` — history survives chat deletion.

**Indexes:**
- `idx_csh_chat(chat_id, created_at DESC)` — per-chat timeline
- `idx_csh_store(store_id, created_at DESC)` — per-store analytics
- `idx_csh_changed_by(changed_by) WHERE changed_by IS NOT NULL` — user activity

---

## Change Sources (7 values)

| Source | Description | File |
|--------|-------------|------|
| `tg_app` | User action from TG Mini App | `src/core/services/chat-status-service.ts`, `sequence-service.ts` |
| `web_app` | User action from web dashboard | `src/app/api/stores/[storeId]/chats/[chatId]/status/route.ts` |
| `cron_resolved` | Resolved-review closer cron | `src/lib/cron-jobs.ts` |
| `cron_sequence` | Auto-sequence processor cron | `src/lib/cron-jobs.ts` |
| `sync_dialogue` | Dialogue sync (WB/OZON) | `src/app/api/stores/[storeId]/dialogues/update/route.ts` |
| `extension` | Chrome Extension auto-close | `src/app/api/extension/chat/opened/route.ts` |
| `bulk_action` | Bulk status change from web | `src/app/api/stores/[storeId]/chats/bulk-actions/route.ts` |

---

## Helper Function

**File:** `src/db/helpers.ts:2163`

```typescript
export async function updateChatWithAudit(
  chatId: string,
  updates: Partial<Chat>,
  audit: AuditContext,
  existingChat?: Chat      // optimization: skip SELECT
): Promise<Chat | null>
```

**`AuditContext`:**
```typescript
interface AuditContext {
  changedBy: string | null;  // userId or null for system
  source: ChangeSource;
}
```

**Behavior:**
1. Fetches current chat (skips if `existingChat` provided)
2. Detects status/tag change
3. Sets `status_changed_by`, `closure_type` (auto/manual)
4. Calls `updateChat()` + inserts `chat_status_history` row
5. History insert failure = non-fatal (logged, doesn't throw)

---

## Call Sites (10+)

| Context | Source | Changed By |
|---------|--------|------------|
| TG status/tag change | `tg_app` | userId |
| TG sequence start/resume | `tg_app` | userId |
| Web status change | `web_app` | userId |
| Bulk send + status | `bulk_action` | userId |
| Bulk change status | `bulk_action` | userId |
| Extension auto-close | `extension` | null |
| Dialogue sync auto-close | `sync_dialogue` | null |
| Dialogue sync reopen | `sync_dialogue` | null |
| Dialogue sync transition | `sync_dialogue` | null |
| Sequence processor close | `cron_sequence` | null |
| Resolved-review closer | `cron_resolved` | null |

---

## Key Files

| File | Purpose |
|------|---------|
| `migrations/027_chat_audit_trail.sql` | Migration |
| `src/db/helpers.ts` (lines 2103-2213) | AuditContext, updateChatWithAudit |
| `docs/database-schema.md` | Schema reference |

---

**Last Updated:** 2026-03-06
