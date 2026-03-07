# Database vs Business Logic Audit Report

**Date:** 2026-03-06
**Sprint:** 005 — Documentation Audit
**Task:** TASK-docs-003
**Auditor:** Claude Code (Principal Software Architect)
**Status:** Completed

---

## Executive Summary

The R5 SaaS database schema **largely supports the business logic** but has accumulated significant documentation drift and structural debt. The audit found:

- **4 undocumented tables** (`complaint_backfill_jobs`, `complaint_daily_limits`, `manager_tasks`, `review_statuses_from_extension`)
- **4 ENUM types out of sync** between `database-schema.md` and actual production schema
- **5 missing FK constraints** on child tables (`store_faq`, `store_guides`, `chat_auto_sequences`)
- **~16 legacy columns** that should be evaluated for removal
- **3 missing CHECK constraints** on status/tag/reason fields
- **Documentation-vs-Reality gap** is the #1 risk — code is correct, docs are stale

**Severity Distribution:**
| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 14 |
| LOW | 8 |

---

## Phase 1 — Domain Model Reconstruction

### Core Entities (from canonical docs)

| Entity | Description | Key Relationships | Key Invariants |
|--------|-------------|-------------------|----------------|
| **User** | Auth identity | 1:N stores, 1:1 settings, 1:1 telegram | Email unique |
| **Organization** | Multi-user group | Has members, owns stores | Owner immutable |
| **Store** | Marketplace account (WB/OZON) | N products, N chats, 1 org | `marketplace` discriminator |
| **Product** | Catalog item | 1:1 product_rules, N reviews | Unique per (store_id, wb_product_id) |
| **ProductRules** | Per-product config | 1:1 product | Controls complaint/chat automation |
| **Review** | Customer feedback | 1:1 complaint, N:1 product | From WB/OZON API + Extension |
| **ReviewComplaint** | AI complaint draft | 1:1 review (UNIQUE) | Immutable after send; WB: 1 per review forever |
| **ComplaintDetails** | Approved complaints | N:1 review (optional) | Source of truth for billing; from Extension |
| **Chat** | Dialogue with buyer | N messages, N sequences | Linked to review via review_chat_links |
| **ChatMessage** | Single message | N:1 chat | `sender` = client/seller |
| **ChatAutoSequence** | Auto-followup series | N:1 chat | Manual start only; 4 types |
| **ChatStatusHistory** | Audit log | Refs chat (no FK) | Immutable, insert-only |
| **ReviewChatLink** | Review↔Chat bridge | N:1 review, N:1 chat | 1 review = 1 chat (invariant) |
| **Question** | WB product question | N:1 store | WB-only, no marketplace column |
| **StoreFaq** | AI FAQ context | N:1 store (no FK!) | Active/inactive toggle |
| **StoreGuide** | AI guide context | N:1 store (no FK!) | Active/inactive toggle |
| **UserSettings** | AI config per user | 1:1 user (PK=user_id) | Prompts, API keys |
| **AiLog** | AI usage tracking | N:1 store | Cost analysis, debugging |
| **TelegramUser** | TG↔R5 link | 1:1 user | Unique on both sides |
| **TelegramNotificationLog** | Dedup log | N:1 telegram_user | 1-hour dedup window |

### Undocumented Entities (exist in migrations, not in `database-schema.md`)

| Entity | Migration | Purpose |
|--------|-----------|---------|
| **ComplaintBackfillJob** | `20260208_001` | Queue for bulk complaint generation |
| **ComplaintDailyLimit** | `20260208_001` | Per-store daily generation limits |
| **ManagerTask** | `002` | Task assignment for managers |
| **ReviewStatusesFromExtension** | `20260201_001` | Extension status batch sync staging |

### System Invariants (from docs)

| # | Invariant | Enforcement | Status |
|---|-----------|-------------|--------|
| 1 | 1 review = max 1 complaint | `UNIQUE(review_id)` on `review_complaints` | **Enforced** |
| 2 | 1 review = 1 chat | `UNIQUE(store_id, review_key)` + partial `UNIQUE(chat_id, store_id)` | **Enforced** (migration 026) |
| 3 | 1 product = 1 product_rules | `UNIQUE(product_id)` on `product_rules` | **Enforced** |
| 4 | 1 user = 1 user_settings | PK = user_id (references users) | **Enforced** |
| 5 | 1 user = 1 telegram_user | `UNIQUE(user_id)` + `UNIQUE(telegram_id)` | **Enforced** |
| 6 | Complaint immutable after send | App code only (no DB trigger) | **Partial** — no DB constraint |
| 7 | Chat tag forward-only | App code (`canAutoOverwriteTag`) | **Partial** — no DB constraint |
| 8 | Review date >= 2023-10-01 for complaints | `CHECK` on `review_complaints.review_date` | **Enforced** |
| 9 | WB: 1 complaint per review forever | `UNIQUE(review_id)` prevents duplicates | **Enforced** |
| 10 | OZON: no complaints | App code only | **Not enforced** — no DB constraint blocking OZON complaints |
| 11 | `opened` status irreversible | App code (SQL guard in route) | **Partial** — no DB trigger |

---

## Phase 2 — Database Structure Map

### Tables by Domain (actual state, including undocumented)

| # | Table | Domain | Purpose | Documented |
|---|-------|--------|---------|:----------:|
| 1 | `users` | Auth | Users | ✅ |
| 2 | `organizations` | Auth | Multi-user groups | ✅ |
| 3 | `org_members` | Auth | User↔Org with roles | ✅ |
| 4 | `member_store_access` | Auth | Manager store permissions | ✅ |
| 5 | `invites` | Auth | Registration tokens | ✅ |
| 6 | `stores` | Core | Marketplace accounts | ✅ |
| 7 | `products` | Core | Catalog items | ✅ |
| 8 | `reviews` | Core | Customer reviews | ✅ |
| 9 | `review_complaints` | Complaints | AI drafts | ✅ |
| 10 | `complaint_details` | Complaints | Approved by WB | ✅ |
| 11 | `complaint_backfill_jobs` | Complaints | Backfill queue | ❌ |
| 12 | `complaint_daily_limits` | Complaints | Daily generation caps | ❌ |
| 13 | `chats` | Communication | Dialogues | ✅ |
| 14 | `chat_messages` | Communication | Messages | ✅ |
| 15 | `chat_auto_sequences` | Communication | Auto-followup | ✅ |
| 16 | `chat_status_history` | Audit | Status change log | ✅ |
| 17 | `review_chat_links` | Linking | Review↔Chat bridge | ✅ |
| 18 | `questions` | Communication | WB product questions | ✅ |
| 19 | `store_faq` | AI Config | Per-store FAQ | ✅ |
| 20 | `store_guides` | AI Config | Per-store guides | ✅ |
| 21 | `user_settings` | Config | AI prompts, API keys | ✅ |
| 22 | `product_rules` | Config | Per-product rules | ✅ |
| 23 | `ai_logs` | Analytics | AI usage tracking | ✅ |
| 24 | `telegram_users` | Telegram | TG↔R5 user link | ✅ |
| 25 | `telegram_notifications_log` | Telegram | Dedup log | ✅ |
| 26 | `manager_tasks` | Operations | Task assignment | ❌ |
| 27 | `review_statuses_from_extension` | Extension | Batch status staging | ❌ |

### ENUM Types — Documentation vs Reality

| ENUM | Documented Values | Actual Values (production) | Mismatch |
|------|-------------------|---------------------------|:--------:|
| `review_status_wb` | visible, unpublished, excluded, unknown | + `deleted`, `temporarily_hidden` (mig 015/023) | ⚠️ |
| `product_status_by_review` | purchased, refused, not_specified, unknown | + `returned`, `return_requested` (mig 023) | ⚠️ |
| `chat_status_by_review` | unavailable, available, unknown | + `opened` (mig 017) | ⚠️ |
| `complaint_status` | not_sent..reconsidered | + `not_applicable` (mig 015) | ⚠️ |
| `work_status_enum` | not_working, active, paused, completed | ✅ matches | ✅ |
| `chat_strategy_enum` | upgrade_to_5, delete, both | ✅ matches | ✅ |

---

## Phase 3 — Domain vs Database Alignment

### Alignment Issues

| # | Entity | Expected (from docs) | Actual (in DB) | Severity | Status |
|---|--------|---------------------|----------------|----------|--------|
| 1 | `chats.tag` | `NULL` default, 4 values + NULL, CHECK constraint | Migration 024 confirms: DROP NOT NULL, DROP DEFAULT, ADD CHECK | **HIGH** | **Schema doc STALE** — shows `NOT NULL DEFAULT 'untagged'` |
| 2 | `chats.status` | 4 values: inbox, in_progress, awaiting_reply, closed | Migration 003 CHECK includes `resolved` (removed mig 008) | **MEDIUM** | Need to verify CHECK constraint updated |
| 3 | `chats.completion_reason` | 11 documented values (review_deleted, review_upgraded, ...) | No CHECK constraint | **LOW** | App-enforced only |
| 4 | `stores.status` | active, paused, stopped, trial, archived | `VARCHAR(20) DEFAULT 'active'`, no CHECK | **LOW** | App-enforced only |
| 5 | `store_faq.store_id` | FK to stores | `TEXT NOT NULL` — **no FK** | **MEDIUM** | Missing referential integrity |
| 6 | `store_guides.store_id` | FK to stores | `TEXT NOT NULL` — **no FK** | **MEDIUM** | Missing referential integrity |
| 7 | `chat_auto_sequences.store_id` | FK to stores | `TEXT NOT NULL` — **no FK** | **MEDIUM** | Missing referential integrity |
| 8 | `chat_auto_sequences.owner_id` | FK to users | `TEXT NOT NULL` — **no FK** | **MEDIUM** | Missing referential integrity |
| 9 | `questions.product_nm_id` | Link to products via nmId | `INTEGER` — but `products.wb_product_id` is `TEXT` | **MEDIUM** | Type mismatch prevents FK |
| 10 | OZON: no complaints | Business rule: OZON has no complaint mechanism | No DB constraint blocking OZON review_complaints | **LOW** | App-enforced only |
| 11 | `review_complaints.status` CHECK | Should match `complaint_status` ENUM | CHECK lists 6 values, ENUM has 8 (missing `not_sent`, `not_applicable`) | **LOW** | Different valid ranges |
| 12 | `complaint_backfill_jobs` | Referenced in complaints.md | Table exists but NOT in database-schema.md | **HIGH** | Documentation gap |
| 13 | `complaint_daily_limits` | Part of backfill system | Table exists but NOT in database-schema.md | **HIGH** | Documentation gap |
| 14 | `manager_tasks` | Operations table | Table exists but NOT in database-schema.md | **MEDIUM** | Documentation gap |
| 15 | `review_statuses_from_extension` | Extension staging table | Table exists but NOT in database-schema.md | **MEDIUM** | Documentation gap |

### ENUM Documentation Drift

**Root cause:** `database-schema.md` shows original CREATE TYPE statements but ENUM values were added via `ALTER TYPE ... ADD VALUE` in migrations 015, 017, 023. The schema doc was never updated.

**Impact:** Developers referencing `database-schema.md` will miss valid ENUM values, potentially causing bugs in new code.

---

## Phase 4 — Data Integrity Risks

| # | Risk | Table(s) | Severity | Description |
|---|------|----------|----------|-------------|
| 1 | **Orphan FAQ records** | `store_faq` | MEDIUM | No FK on `store_id` — if store deleted, FAQ records remain |
| 2 | **Orphan guide records** | `store_guides` | MEDIUM | Same as above |
| 3 | **Orphan sequences** | `chat_auto_sequences` | MEDIUM | `store_id` and `owner_id` have no FK — orphan records possible |
| 4 | **Type mismatch** | `questions` ↔ `products` | MEDIUM | `questions.product_nm_id` is INTEGER, `products.wb_product_id` is TEXT — cannot create FK |
| 5 | **No FK on notification chat_id** | `telegram_notifications_log` | LOW | `chat_id` TEXT, references R5 chat but no FK constraint |
| 6 | **No FK on backfill jobs** | `complaint_backfill_jobs` | MEDIUM | `product_id`, `store_id`, `owner_id` have no FK constraints |
| 7 | **Stale completion_reason** | `chats` | LOW | 11 values in app code, no CHECK — invalid values technically possible |
| 8 | **`chats.status` CHECK may include 'resolved'** | `chats` | MEDIUM | Migration 003 added CHECK with 'resolved'; migration 008 supposedly removed it — needs verification |
| 9 | **OZON complaints possible** | `review_complaints` | LOW | No constraint blocking `review_complaints` for OZON marketplace reviews |
| 10 | **reviews.is_product_active stale** | `reviews` | MEDIUM | Denormalized from `products.is_active` but no trigger/auto-sync — can drift |

### Positive Integrity Findings

| Invariant | Mechanism | Assessment |
|-----------|-----------|------------|
| 1 review = 1 complaint | UNIQUE(review_id) | **Strong** |
| 1 review = 1 chat link | UNIQUE(store_id, review_key) + partial UNIQUE(chat_id, store_id) | **Strong** (fixed migration 026) |
| 1 product = 1 rules | UNIQUE(product_id) | **Strong** |
| Review date cutoff | CHECK(review_date >= '2023-10-01') on review_complaints | **Strong** |
| Cascade deletes | ON DELETE CASCADE on most child tables | **Strong** |
| Audit trail survives chat deletion | No FK on chat_status_history.chat_id | **Intentional, correct** |

---

## Phase 5 — Normalization Analysis

### Denormalization Issues

| # | Issue | Tables | Severity | Assessment |
|---|-------|--------|----------|------------|
| 1 | **Legacy complaint fields on reviews** | `reviews` | MEDIUM | `complaint_text`, `complaint_sent_date`, `draft_reply`, `draft_reply_thread_id`, `complaint_generated_at`, `complaint_reason_id`, `complaint_category` — 7 columns duplicated from `review_complaints` table. Trigger only manages `has_complaint`/`has_complaint_draft`. Legacy fields are deadweight. |
| 2 | **Legacy auto-reply JSONB on chats** | `chats` | MEDIUM | `sent_no_reply_messages`, `sent_no_reply_messages2` — legacy tracking replaced by `chat_auto_sequences` table. Still written to but redundant. |
| 3 | **`owner_id` in all child tables** | All | LOW | `reviews`, `products`, `chats`, `chat_messages`, `review_complaints`, `questions`, `ai_logs` all duplicate `owner_id`. **Intentional** for query performance — avoids JOIN to stores. Acceptable trade-off at current scale. |
| 4 | **`reviews.is_product_active`** | `reviews` | MEDIUM | Denormalized from `products.is_active`. No trigger or automatic sync. Updated manually in review sync code. Can drift if product status changes between syncs. |
| 5 | **Denormalized counts on stores** | `stores` | LOW | `total_reviews`, `total_chats`, `chat_tag_counts` (JSONB). Updated during sync. Standard performance optimization. |
| 6 | **`reviews` table overloaded** | `reviews` | MEDIUM | 50+ columns spanning: WB API data, OZON API data, Extension-parsed statuses, legacy complaint fields, denormalized flags, deletion detection. Consider vertical partitioning. |
| 7 | **Legacy OpenAI fields** | `user_settings` | LOW | `assistant_chat_reply`, `assistant_chat_tag`, `assistant_question_reply`, `assistant_review_complaint`, `assistant_review_reply` — 5 unused columns from pre-Deepseek era. |
| 8 | **Legacy no_reply fields** | `user_settings` | LOW | `no_reply_messages`, `no_reply_trigger_phrase`, `no_reply_stop_message` (×2) — 6 fields superseded by `auto-sequence-templates.ts`. Still referenced but functionally dead. |
| 9 | **Snapshot pattern (review_complaints)** | `review_complaints` | LOW | `review_rating`, `review_text`, `review_date`, `product_name`, `product_vendor_code`, `product_is_active` — **intentional snapshots**. Correct design for historical accuracy. Not a normalization issue. |

### JSON Fields Assessment

| Table | Column | Type | Contents | Risk |
|-------|--------|------|----------|------|
| `stores` | `chat_tag_counts` | JSONB | `{tag: count}` | LOW — performance cache |
| `chats` | `sent_no_reply_messages` | JSONB | `[{text, sentAt}]` | MEDIUM — legacy, should migrate |
| `chats` | `sent_no_reply_messages2` | JSONB | `[{text, sentAt}]` | MEDIUM — legacy, should migrate |
| `chat_auto_sequences` | `messages` | JSONB | `[{day, text}]` | LOW — template storage, appropriate |
| `reviews` | `answer` | JSONB | WB seller response object | LOW — flexible external data |
| `reviews` | `photo_links` | JSONB | Array of URLs | LOW — flexible external data |
| `complaint_backfill_jobs` | `metadata` | JSONB | Job context | LOW — appropriate |
| `user_settings` | `no_reply_messages` | JSONB | Message templates | MEDIUM — legacy |

---

## Phase 6 — Index and Performance Analysis

### Missing Indexes

| # | Table | Missing Index | Query Pattern | Priority |
|---|-------|--------------|---------------|----------|
| 1 | `chats` | `(store_id, status, last_message_date DESC)` | TG queue ordering by status + recency | HIGH |
| 2 | `chat_auto_sequences` | `(store_id)` | Cron queries filtering by store | MEDIUM |
| 3 | `review_chat_links` | Composite `(store_id, chat_id)` | JOIN pattern in TG queue: `rcl.chat_id = c.id AND rcl.store_id = c.store_id` | MEDIUM |
| 4 | `chat_status_history` | `(change_source, created_at DESC)` | Analytics: actions by source | LOW |

### Potentially Redundant Indexes

| # | Index | Table | Reason |
|---|-------|-------|--------|
| 1 | `idx_users_email` | `users` | `email` already has UNIQUE constraint (implicit index) |
| 2 | `idx_product_rules_product` | `product_rules` | `product_id` already has UNIQUE constraint |
| 3 | `idx_complaints_review` | `review_complaints` | `review_id` already has UNIQUE constraint |

### Documentation Gaps (indexes exist but not in schema doc)

| Index | Created In | Table |
|-------|-----------|-------|
| `idx_chats_status` | Migration 003 | `chats(store_id, status, updated_at DESC)` |
| `idx_chats_kanban` | Migration 003 | `chats(store_id, status, status_updated_at DESC, updated_at DESC)` |
| All `complaint_backfill_jobs` indexes | Migration 20260208_001 | 5 indexes |
| `idx_daily_limits_date` | Migration 20260208_001 | `complaint_daily_limits(date)` |

### Index Efficiency Notes

- **Partial indexes well-used:** `WHERE complaint_status = 'not_sent'`, `WHERE status = 'draft'`, `WHERE status = 'active'`, `WHERE error IS NOT NULL` — good use of partial indexes for targeted queries
- **Covering indexes present:** `idx_reviews_default_filter` covers the main reviews filter query
- **OZON-specific indexes:** `idx_products_ozon_product_id`, `idx_reviews_ozon_sku` — correct for OZON product linking
- **Recommendation:** Run `pg_stat_user_indexes` to identify zero-scan indexes for potential removal

---

## Phase 7 — Architectural Technical Debt

### HIGH Priority

| # | Debt | Impact | Effort |
|---|------|--------|--------|
| 1 | **Schema doc drift from reality** | Developers write code against stale docs; 4 ENUM types and 4 tables out of sync | Low (doc update) |
| 2 | **`chats.status` CHECK constraint uncertainty** | Migration 003 set CHECK including 'resolved', migration 008 may have removed it — unknown current state | Low (verify + fix) |
| 3 | **Missing FKs on store_faq, store_guides** | Orphan records accumulate if stores deleted | Low (ALTER TABLE) |

### MEDIUM Priority

| # | Debt | Impact | Effort |
|---|------|--------|--------|
| 4 | **Legacy complaint columns on reviews** | 7 unused columns consuming storage, confusing schema | Medium (data migration) |
| 5 | **Legacy auto-reply JSONB on chats** | 2 columns (`sent_no_reply_messages`, `sent_no_reply_messages2`) — superseded | Medium (verify no reads, then drop) |
| 6 | **`questions` table lacks marketplace support** | No `marketplace` column, `product_nm_id` is INTEGER (all other tables use TEXT) | Medium (migration) |
| 7 | **`reviews.is_product_active` sync gap** | No trigger — depends on sync code to keep updated. Product deactivation between syncs = stale data | Medium (trigger or periodic sync) |
| 8 | **`review_statuses_from_extension` undocumented** | Table exists, purpose unclear from schema alone | Low (document or archive) |

### LOW Priority

| # | Debt | Impact | Effort |
|---|------|--------|--------|
| 9 | **OpenAI assistant fields in user_settings** | 5 unused columns from deprecated provider | Low |
| 10 | **Legacy no_reply template fields** | 6 fields in user_settings superseded by auto-sequence-templates.ts | Low |
| 11 | **`manager_tasks` table** | Created in migration 002, unclear if actively used | Low (verify usage) |
| 12 | **`chats.status_updated_at`** | Created in migration 003, not documented in schema doc | Low |
| 13 | **No marketplace constraint on OZON complaints** | OZON reviews can theoretically have review_complaints records | Low (app prevents this) |

### Mixed Responsibility Tables

| Table | Responsibilities | Assessment |
|-------|-----------------|------------|
| `reviews` | WB API data + OZON API data + Extension statuses + Legacy complaint fields + Denormalized flags + Deletion detection + Rating exclusion | **Overloaded** — 50+ columns. Vertical partitioning candidate. |
| `user_settings` | API keys + AI prompts + Legacy auto-reply templates + Legacy OpenAI fields | **Mixed** — active + dead columns coexist |
| `stores` | Identity + API tokens (WB+OZON) + Sync status (4 subsystems × 3 fields) + Denormalized counts + AI config + Org link | **Acceptable** — wide but logically cohesive |

---

## Phase 8 — Refactoring Opportunities

### Priority 1: Documentation Sync (0 risk, immediate value)

**Action:** Update `database-schema.md` to reflect actual production state.

| What | Details |
|------|---------|
| Update ENUM definitions | Add `deleted`, `temporarily_hidden` to `review_status_wb`; `returned`, `return_requested` to `product_status_by_review`; `opened` to `chat_status_by_review`; `not_applicable` to `complaint_status` |
| Update `chats.tag` | Change from `NOT NULL DEFAULT 'untagged'` to nullable with CHECK constraint (migration 024) |
| Add missing tables | `complaint_backfill_jobs`, `complaint_daily_limits`, `manager_tasks`, `review_statuses_from_extension` |
| Add missing indexes | `idx_chats_status`, `idx_chats_kanban`, backfill indexes |
| Update `statuses-reference.md` | Add missing ENUM values from migrations 015, 017, 023 |

### Priority 2: Referential Integrity (low risk, one migration)

```sql
-- Add missing FKs (safe — only prevents future orphans)
ALTER TABLE store_faq
  ADD CONSTRAINT fk_store_faq_store FOREIGN KEY (store_id)
  REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE store_guides
  ADD CONSTRAINT fk_store_guides_store FOREIGN KEY (store_id)
  REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE chat_auto_sequences
  ADD CONSTRAINT fk_sequences_store FOREIGN KEY (store_id)
  REFERENCES stores(id) ON DELETE CASCADE;

-- Verify no orphans first:
-- SELECT sf.id FROM store_faq sf LEFT JOIN stores s ON s.id = sf.store_id WHERE s.id IS NULL;
```

### Priority 3: CHECK Constraints (low risk)

```sql
-- Completion reason — prevent invalid values
ALTER TABLE chats ADD CONSTRAINT chk_completion_reason
  CHECK (completion_reason IS NULL OR completion_reason IN (
    'review_deleted', 'review_upgraded', 'review_resolved',
    'temporarily_hidden', 'refusal', 'no_reply',
    'old_dialog', 'not_our_issue', 'spam', 'negative', 'other'
  ));

-- Store status — prevent invalid values
ALTER TABLE stores ADD CONSTRAINT chk_store_status
  CHECK (status IN ('active', 'paused', 'stopped', 'trial', 'archived'));

-- Verify current CHECK on chats.status includes correct 4 values
-- (may need to DROP + re-ADD if 'resolved' still present)
```

### Priority 4: Legacy Column Cleanup (medium risk, requires verification)

**Step 1: Verify no reads in application code**
```bash
# Check if legacy complaint columns on reviews are still read
grep -r "complaint_text\|complaint_sent_date\|complaint_generated_at\|complaint_reason_id\|complaint_category" src/ --include="*.ts" --include="*.tsx"

# Check if legacy auto-reply JSONB is still read
grep -r "sent_no_reply_messages" src/ --include="*.ts" --include="*.tsx"

# Check if OpenAI assistant fields are used
grep -r "assistant_chat_reply\|assistant_chat_tag\|assistant_question_reply\|assistant_review_complaint\|assistant_review_reply" src/ --include="*.ts" --include="*.tsx"
```

**Step 2: If unused, drop in batches**
```sql
-- Batch 1: Legacy complaint columns (reviews)
ALTER TABLE reviews
  DROP COLUMN IF EXISTS complaint_text,
  DROP COLUMN IF EXISTS complaint_sent_date,
  DROP COLUMN IF EXISTS complaint_generated_at,
  DROP COLUMN IF EXISTS complaint_reason_id,
  DROP COLUMN IF EXISTS complaint_category;

-- Batch 2: Legacy auto-reply JSONB (chats)
ALTER TABLE chats
  DROP COLUMN IF EXISTS sent_no_reply_messages,
  DROP COLUMN IF EXISTS sent_no_reply_messages2;

-- Batch 3: OpenAI assistant fields (user_settings)
ALTER TABLE user_settings
  DROP COLUMN IF EXISTS assistant_chat_reply,
  DROP COLUMN IF EXISTS assistant_chat_tag,
  DROP COLUMN IF EXISTS assistant_question_reply,
  DROP COLUMN IF EXISTS assistant_review_complaint,
  DROP COLUMN IF EXISTS assistant_review_reply;
```

### Priority 5: Questions Table Alignment (medium risk)

```sql
-- Add marketplace support to match other tables
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS marketplace TEXT NOT NULL DEFAULT 'wb';

-- Fix type mismatch: INTEGER → TEXT for product linking consistency
ALTER TABLE questions
  ALTER COLUMN product_nm_id TYPE TEXT USING product_nm_id::TEXT;
```

### Priority 6: Index Optimization (low risk)

```sql
-- Add missing high-value index for TG queue
CREATE INDEX CONCURRENTLY idx_chats_store_status_date
  ON chats(store_id, status, last_message_date DESC);

-- Add store index for sequence cron
CREATE INDEX CONCURRENTLY idx_sequences_store
  ON chat_auto_sequences(store_id);

-- Drop redundant indexes (after verifying with pg_stat_user_indexes)
-- DROP INDEX idx_users_email;        -- covered by UNIQUE
-- DROP INDEX idx_product_rules_product; -- covered by UNIQUE
-- DROP INDEX idx_complaints_review;     -- covered by UNIQUE
```

### Priority 7: Future Considerations (deferred)

| Item | When | Why |
|------|------|-----|
| Partition `reviews` by date | When > 5M reviews | Large table performance |
| Add `is_product_active` trigger | If stale data causes bugs | Auto-sync with products |
| OZON marketplace constraint on complaints | If data integrity needed | Prevent impossible records |
| Vertical split of `reviews` table | When column count impacts queries | 50+ columns is borderline |

---

## Appendix: Documentation Update Checklist

Based on this audit, the following docs need updates:

| Document | What to Update |
|----------|---------------|
| `database-schema.md` | ENUM values, chats.tag definition, 4 missing tables, missing indexes |
| `reference/statuses-reference.md` | Add `deleted`, `temporarily_hidden`, `returned`, `return_requested`, `opened`, `not_applicable` |
| `domains/complaints.md` | Clarify `complaint_backfill_jobs` existence vs documentation |
| `CRON_JOBS.md` | Verify backfill worker cron is documented |

---

**Last Updated:** 2026-03-06
**Auditor:** Claude Code (Principal Software Architect)
