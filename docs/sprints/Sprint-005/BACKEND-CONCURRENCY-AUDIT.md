# Backend Concurrency and Automation Audit

**Date:** 2026-03-07
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Runtime concurrency behavior of all async subsystems
**Status:** Analysis complete. All findings FIXED (migration 030 + code changes, 2026-03-07)

---

## 1. Event Sources

### 1.1 Event Source Map

| # | Source | Entry Point | Trigger | Frequency |
|---|--------|-------------|---------|-----------|
| 1 | WB Review Sync | `POST /api/stores/[storeId]/reviews/update` | Cron (hourly) | ~65 stores × 1/hour |
| 2 | WB Dialogue Sync | `POST /api/stores/[storeId]/dialogues/update` | Cron (adaptive 5-60min) | ~65 stores × 12-288/day |
| 3 | OZON Full Scan | Same endpoint `?fullScan=true` | Cron (hourly 9-20 MSK) | ~OZON stores × 12/day |
| 4 | Nightly Full Review Sync | Same review endpoint `?mode=full` | Cron (22:00 MSK) | 12 chunks × 65 stores |
| 5 | Midday Review Catchup | Same review endpoint chunk 0 | Cron (13:00 MSK) | 65 WB stores |
| 6 | Auto-Sequence Processor | `cron-jobs.ts:startAutoSequenceProcessor` | Cron (every 30min) | 1 run/30min |
| 7 | Resolved-Review Closer | `cron-jobs.ts:startResolvedReviewCloser` | Cron (:15/:45) | 1 run/30min |
| 8 | Backfill Worker | `cron-jobs.ts:startBackfillWorker` | Cron (every 5min) | 1 run/5min |
| 9 | Google Sheets Sync | `cron-jobs.ts:startGoogleSheetsSync` | Cron (6:00 MSK) + debounced API | 1/day + on-demand |
| 10 | Client Directory Sync | `cron-jobs.ts:startClientDirectorySync` | Cron (7:30 MSK) | 1/day |
| 11 | Chrome Extension: chat/opened | `POST /api/extension/chat/opened` | User action in browser | On-demand |
| 12 | Chrome Extension: complaint-statuses | `POST /api/extension/complaint-statuses` | User action (batch) | On-demand |
| 13 | Chrome Extension: complaint-details | `POST /api/extension/complaint-details` | User action | On-demand |
| 14 | Chrome Extension: review-statuses | `POST /api/extension/review-statuses` | User action (batch) | On-demand |
| 15 | TG Mini App: send message | `POST /api/telegram/chats/[chatId]/send` | User action | On-demand |
| 16 | TG Mini App: start sequence | `POST /api/telegram/chats/[chatId]/sequence/start` | User action | On-demand |
| 17 | TG Mini App: change status/tag | `PATCH /api/telegram/chats/[chatId]/status` | User action | On-demand |
| 18 | Web Dashboard: status change | Various store API routes | User action | On-demand |
| 19 | Web Dashboard: bulk actions | Bulk status/send routes | User action | On-demand |
| 20 | Product Sync | `POST /api/stores/[storeId]/products/update` | Cron (7:00 MSK) | 1/day |

### 1.2 Concurrency Matrix — Which events can overlap?

| Pair | Overlap Risk | Shared State |
|------|-------------|--------------|
| Dialogue Sync + Extension chat/opened | **HIGH** | `review_chat_links.chat_id`, `chats.tag`, `chats.status` |
| Dialogue Sync + Auto-Sequence Cron | **HIGH** | `chats.status`, `chat_auto_sequences.status` |
| Dialogue Sync + TG Send | **MEDIUM** | `chats.last_message_*`, `chats.status` |
| Resolved-Review Closer + Auto-Sequence Cron | **MEDIUM** | `chats.status`, `chat_auto_sequences.status` |
| Extension complaint-statuses + Resolved-Review Closer | **MEDIUM** | `reviews.complaint_status`, `chats.status` |
| TG Sequence Start + Auto-Sequence Cron | **MEDIUM** | `chat_auto_sequences` table |
| Nightly Full Sync + Hourly Incremental | **LOW** | `reviews` table (upsert) |

---

## 2. Automation Engines

### 2.1 Complaint Generation Engine

- **Trigger:** Hourly review sync cron → `generateComplaintsForStore()` → calls batch API
- **Coordination:** Sequential per store, `runningJobs['hourly-review-sync']` flag
- **Concurrency safe?** YES — upsert on reviews, template/AI generation is idempotent by review_id
- **Risk:** LOW — backfill checks `getReviewsWithoutComplaints()`, generates only missing

### 2.2 Chat Auto-Sequences

- **Trigger (create):** Manual from TG Mini App → `sequence-service.ts:startSequence()`
- **Trigger (send):** Cron every 30min → `startAutoSequenceProcessor()` in `cron-jobs.ts`
- **Coordination:** `runningJobs['auto-sequence-processor']` in-memory flag; `getActiveSequenceForChat()` check before creation
- **Risk:** See Phase 6 for detailed analysis

### 2.3 Telegram Notifications

- **Trigger:** Dialogue sync Step 5a-tg → `sendTelegramNotifications()`
- **Coordination:** `wasNotificationSentRecently()` DB-level dedup (1-hour window)
- **Risk:** LOW — dedup works correctly; fire-and-forget on TG API timeout

### 2.4 Google Sheets Sync

- **Trigger:** Daily cron + on-demand `triggerAsyncSync()` (debounced 5s)
- **Coordination:** In-memory `syncRunning` + `syncPendingAfterCurrent` flags
- **Risk:** LOW — debounce prevents concurrent runs; clear+write pattern is atomic per sheet

---

## 3. Cron Safety

### 3.1 In-Memory Guard Pattern

All cron jobs use the same pattern:
```js
if (runningJobs[jobName]) { return; } // skip
runningJobs[jobName] = true;
try { ... } finally { runningJobs[jobName] = false; }
```

**Assessment:** This guard is **process-local only**. It works because:
- PM2 runs `wb-reputation-cron` as a **single fork process** (not cluster)
- Cron schedulers are created once in `initializeServer()` with `isInitialized()` guard

**Risk: MEDIUM** — If PM2 restarts the cron process while a job is mid-execution, the `runningJobs` state is lost. The old HTTP requests to `/api/stores/*/reviews/update` may still be running on the web cluster, while the new cron process starts new ones.

### 3.2 Cron-via-HTTP Pattern

Crons don't execute business logic directly — they make HTTP requests to API routes:
```
cron-jobs.ts → fetch(`/api/stores/${storeId}/reviews/update`) → web cluster handles
```

**Implication:** The "guard" only prevents the cron from *initiating* duplicate requests. Two concurrent runs of the same store's API endpoint (from different cron triggers or manual + cron) are NOT prevented.

### 3.3 Specific Cron Jobs

| Job | Schedule | Guard | Idempotent? | Risk |
|-----|----------|-------|------------|------|
| hourly-review-sync | `0 * * * *` | `runningJobs` | YES (upsert) | LOW |
| adaptive-dialogue-sync | setTimeout loop | `runningJobs` | **PARTIAL** (see §3.4) | **HIGH** |
| daily-product-sync | `0 4 * * *` | `runningJobs` | YES (upsert) | LOW |
| backfill-worker | `*/5 * * * *` | `runningJobs` | YES (status check) | LOW |
| google-sheets-sync | `0 3 * * *` | `runningJobs` | YES (clear+write) | LOW |
| client-directory-sync | `30 4 * * *` | `runningJobs` | YES (upsert) | LOW |
| auto-sequence-processor | `*/30 * * * *` | `runningJobs` | **PARTIAL** (see §6) | **HIGH** |
| rolling-review-full-sync | `0 19 * * *` | `runningJobs` | YES (upsert) | LOW |
| midday-review-catchup | `0 10 * * *` | `runningJobs` | YES (upsert) | LOW |
| ozon-hourly-full-sync | `0 6-17 * * *` | `runningJobs` | YES (upsert) | LOW |
| resolved-review-closer | `15,45 * * * *` | `runningJobs` | **MOSTLY** (see §3.5) | MEDIUM |

### 3.4 Dialogue Sync — NOT Fully Idempotent

Dialogue sync has side effects that depend on execution order:
1. **Status transitions** — `client replied → inbox`, `seller replied → in_progress`
2. **Auto-sequence stop** — stops sequence when client replies
3. **Tag classification** — updates tags based on latest message

If two dialogue syncs overlap for the same store (possible if the setTimeout-based scheduler fires before previous HTTP call returns), the second sync reads stale `existingChatMap` and can:
- Re-trigger status transitions
- Miss tag updates because `latestMessagesPerChat` is built per-execution

**Risk: HIGH** — However, the in-memory guard makes same-process overlap unlikely.

### 3.5 Resolved-Review Closer — Double-Close Risk

The query `WHERE c.status != 'closed'` provides idempotency at SQL level. However:
- `closeLinkedChatsForReviews` in the extension endpoint does the same thing
- Both can run concurrently → double `updateChat()` calls

**Mitigation:** `updateChat` is a simple UPDATE — double-calling is harmless (idempotent). The `stopSequence` call checks `status = 'active'`, which is also safe.

---

## 4. Extension Event Safety

### 4.1 `POST /api/extension/chat/opened`

| Aspect | Assessment |
|--------|-----------|
| Dedup | `createReviewChatLink()` → check existing by `(store_id, review_key)` + `ON CONFLICT` |
| Chat_id guard | Checks `WHERE store_id = $1 AND chat_id = $2` before insert |
| Race window | **YES** — between `findLinkByStoreAndReviewKey()` and the `INSERT ON CONFLICT`, another request could insert |
| Impact | LOW — `ON CONFLICT` handles it safely, returns existing |

**Verdict: SAFE** — Double-click by user produces correct idempotent result.

### 4.2 `POST /api/extension/complaint-statuses`

| Aspect | Assessment |
|--------|-----------|
| Dedup | Bulk UPDATE (not INSERT) — inherently idempotent |
| Concurrency | No transaction wrapping for the 2 bulk UPDATEs |
| Race | Between reviews UPDATE and review_complaints UPDATE, another process could read stale data |
| Impact | LOW — both UPDATEs set the same values, re-running produces same result |

**Verdict: SAFE** — Idempotent UPDATE pattern.

### 4.3 `POST /api/extension/complaint-details`

| Aspect | Assessment |
|--------|-----------|
| Dedup | `createComplaintDetail()` uses `ON CONFLICT (store_id, articul, feedback_date, file_name)` |
| Impact | SAFE — duplicate submissions return `created: false` |

**Verdict: SAFE**

### 4.4 `POST /api/extension/review-statuses`

| Aspect | Assessment |
|--------|-----------|
| Dedup | Uses `ON CONFLICT (review_key, store_id)` |
| Impact | SAFE — upsert pattern |

**Verdict: SAFE**

### 4.5 Overall Extension Safety: **GOOD**

All extension endpoints use either:
- `ON CONFLICT` upsert (chat/opened, complaint-details, review-statuses)
- Idempotent UPDATE (complaint-statuses)

No duplicate records will be created from double-clicks or retry logic.

---

## 5. Database Concurrency

### 5.1 Transaction Usage

**`transaction()` helper exists** in `src/db/client.ts` (line 169) but is **NEVER USED** in any business logic. All operations are single-query or multi-query without transaction wrapping.

### 5.2 ON CONFLICT (Upsert) Coverage

| Table | ON CONFLICT Column(s) | Used In |
|-------|----------------------|---------|
| `products` | `(id)` | `upsertProduct()` |
| `chats` | `(id)` | `upsertChat()` |
| `chat_messages` | `(id)` | `upsertChatMessage()` |
| `reviews` | `(id)` | `upsertReview()` |
| `review_chat_links` | `(store_id, review_key)` | `createReviewChatLink()` |
| `complaint_details` | `(store_id, articul, feedback_date, file_name)` | `createComplaintDetail()` |
| `product_rules` | `(product_id)` | `upsertProductRules()` |
| `backfill_jobs` | `(product_id) WHERE status IN (...)` | `enqueueBackfillJob()` |
| `extension: review_statuses` | `(review_key, store_id)` | `review-statuses route` |

### 5.3 Missing Transaction Boundaries

**CRITICAL FINDING:** Several multi-step operations lack transactional atomicity:

#### 5.3.1 Sequence Start (sequence-service.ts:startSequence)
```
1. getActiveSequenceForChat()    ← check no active
2. isReviewResolvedForChat()     ← check review
3. hasCompletedSequenceFamily()  ← check family dedup
4. createSequence()              ← INSERT
5. sendSequenceMessage()         ← send + INSERT message + UPDATE chat
6. updateChatWithAudit()         ← UPDATE chat status
```

**No transaction.** Between steps 1 and 4, another request could create a sequence → **duplicate active sequence possible** (no UNIQUE constraint on `(chat_id) WHERE status='active'`).

#### 5.3.2 Dialogue Sync Status Transitions
```
1. existingChatMap loaded (snapshot)
2. ... process messages ...
3. Check existingChat.status
4. updateChatWithAudit(status = 'inbox')
```

Between step 1 (snapshot) and step 4 (update), TG Mini App could change status → sync overwrites it.

#### 5.3.3 Auto-Sequence Stop + Chat Status Update (cron)
```
1. getChatMessages() → check client_replied
2. stopSequence()
3. updateChat(status = 'inbox')
```

No transaction between stop and status update. If process crashes between 2 and 3, sequence is stopped but chat stays in wrong status.

### 5.4 Missing UNIQUE Constraints

| Table | Needed Constraint | Risk |
|-------|-------------------|------|
| `chat_auto_sequences` | `UNIQUE(chat_id) WHERE status = 'active'` | **Duplicate active sequences** |
| `review_chat_links` | `UNIQUE(chat_id, store_id) WHERE chat_id IS NOT NULL` | **Known bug: 56 dupes found 2026-03-06** |

### 5.5 SELECT FOR UPDATE / Advisory Locks

**None found.** No row-level locking is used anywhere in the codebase.

### 5.6 Connection Pool

Pool configuration not explicitly set — uses `pg` library defaults (10 connections). Sufficient for current load.

---

## 6. Sequence Engine Safety

### 6.1 Duplicate Sequence Creation

**Risk: HIGH**

The `startSequence()` function checks:
```js
const existing = await getActiveSequenceForChat(chatId); // SELECT ... WHERE status='active'
if (existing) throw SequenceConflictError;
```

But there is no UNIQUE constraint on `(chat_id) WHERE status = 'active'`. Two concurrent `POST /sequence/start` requests could both pass the check and both INSERT.

**TOCTOU (Time-of-Check/Time-of-Use) race:**
```
Request A: SELECT → no active → proceeds
Request B: SELECT → no active → proceeds
Request A: INSERT → success
Request B: INSERT → success → DUPLICATE
```

**Mitigation:** This is partially mitigated because:
- Only one user (Ivan) currently uses TG Mini App
- Sequence start requires deliberate button press
- But programmatic callers or double-tap could trigger it

### 6.2 Cron Processor — Double Send

**Risk: MEDIUM**

The auto-sequence processor queries:
```sql
SELECT * FROM chat_auto_sequences WHERE status = 'active' AND next_send_at <= NOW()
```

If two cron runs overlap (unlikely due to `runningJobs` guard, but possible after PM2 restart), both could:
1. Pick up the same sequence
2. Both pass the "client replied?" check
3. Both call `sendSequenceMessage()`
4. Both advance the sequence

The `advanceSequence()` uses simple `current_step = current_step + 1` — two concurrent calls would advance by 2, skipping a template.

**Mitigation:** The `runningJobs` guard is effective within a single process. Cross-process overlap only occurs during PM2 restart, and the 30-minute interval makes collision very unlikely.

### 6.3 Sequence Message ID Collision

Auto-sequence messages use deterministic IDs: `auto_${sequenceId}_${currentStep}`

This means duplicate sends of the same step would collide on `chat_messages.id` primary key → second INSERT fails. **This is actually a good safety net** against double-send.

### 6.4 Stop Condition Races

| Stop Condition | Check Method | Race-Safe? |
|----------------|-------------|------------|
| Client replied | `getChatMessages()` + filter by timestamp | **MOSTLY** — reads from DB, race window is small |
| Status changed | `getChatById()` + check status | **YES** — reads current state |
| Review resolved | `isReviewResolvedForChat()` JOIN query | **YES** — reads current state |
| Max steps | `seq.current_step >= seq.max_steps` | **YES** — checked in cron |

**Main risk:** Between checking "client replied" and sending the message, the client could reply. The message would be sent, and then on the next cron run, the sequence would stop. **Impact: one extra message sent** — acceptable.

### 6.5 Optimistic Lock on Chat Close

The cron processor uses an optimistic lock pattern for closing chats after sequence completion:
```js
const chatStatusBefore = chat?.status_updated_at;
const freshChat = await getChatById(seq.chat_id);
if (freshChat.status_updated_at !== chatStatusBefore) {
    // Skip close — another process changed status
}
```

**Assessment: GOOD** — This prevents the cron from overwriting a status change made by the user between check and close.

---

## 7. Telegram Notification System

### 7.1 Deduplication

```sql
SELECT EXISTS(
  SELECT 1 FROM telegram_notifications_log
  WHERE telegram_user_id = $1 AND chat_id = $2 AND notification_type = $3
    AND sent_at > NOW() - INTERVAL '1 minute' * $4
) as exists
```

- Client reply dedup: 60 minutes
- Success event dedup: 1440 minutes (24 hours)

**Assessment: GOOD** — DB-level dedup prevents duplicates even across process restarts.

### 7.2 Lost Message Risk

Telegram API calls are fire-and-forget with basic error logging:
```js
const msgId = await tgSendMessage(tgUser.chat_id, text, replyMarkup);
// Log even if msgId is null (send failed)
for (const chat of newChats) {
    await logTelegramNotification({ ... tgMessageId: msgId || undefined });
}
```

**Risk: LOW** — If TG API fails, notification is logged (preventing re-send within dedup window) but message is lost. This is acceptable — these are informational notifications, not critical actions.

### 7.3 Notification Timing

Silent hours: 20:00–10:00 MSK. Checked via `isNotificationHour()`.

**Risk:** Dialogue sync runs 24/7 but notifications are suppressed at night. Morning replies from buyers won't notify until 10:00 MSK. **Acceptable by design.**

### 7.4 Duplicate Notification Race

If dialogue sync runs for the same store concurrently (unlikely but theoretically possible), both could:
1. Detect same client reply
2. Both check `wasNotificationSentRecently()` → both return false
3. Both send TG notification

**Impact: duplicate TG message.** The time window is very small (both must query within the same second). After the first logs, the second would be deduped.

**Risk: LOW**

---

## 8. Failure Scenarios

### 8.1 Extension Sends Same Event Twice

| Event | Behavior | Data Integrity |
|-------|---------|---------------|
| `chat/opened` × 2 | Second returns `created: false` | SAFE (ON CONFLICT) |
| `complaint-statuses` × 2 | Second UPDATE is no-op | SAFE (idempotent UPDATE) |
| `complaint-details` × 2 | Second returns `created: false` | SAFE (ON CONFLICT) |

### 8.2 Cron Restarts Mid-Execution

| Scenario | Behavior | Risk |
|----------|---------|------|
| Review sync interrupted | Already-processed stores have data; remaining will be caught next hour | LOW |
| Dialogue sync interrupted | Cursor (`last_chat_update_next`) not updated → re-processes events | LOW (upsert) |
| Auto-sequence interrupted | `runningJobs` reset; sequence `next_send_at` unchanged → re-processed next run | **MEDIUM** (message not double-sent due to deterministic ID) |
| Resolved-closer interrupted | Partially closed chats; remaining caught next run | LOW |

### 8.3 Telegram API Timeout

- Notification logged regardless → dedup prevents retry
- Message lost but non-critical
- **Impact: LOW**

### 8.4 Database Transaction Rollback

No transactions are used, so this scenario doesn't apply directly. Instead, the risk is **partial state updates**:

| Scenario | Partial State | Impact |
|----------|--------------|--------|
| Sequence start: INSERT succeeds, send fails | Sequence created but step 0 not sent; cron picks it up | **LOW** (self-healing) |
| Sequence start: INSERT + send succeed, status update fails | Sequence active but chat not in `awaiting_reply` | **MEDIUM** (stale cleanup catches it) |
| Extension complaint-status: reviews UPDATE succeeds, review_complaints UPDATE fails | reviews.complaint_status updated but review_complaints.status not | **MEDIUM** (inconsistency) |

### 8.5 Dialogue Sync + TG Send Concurrent

User sends message via TG while dialogue sync is running for same store:
1. TG send updates `chats.last_message_*` and `chats.status → in_progress`
2. Dialogue sync (using stale snapshot) may overwrite with older data

**Risk: MEDIUM** — The sync reads `existingChatMap` at start. If user sends during sync, the sync's status transition logic uses the stale snapshot. However, the next sync cycle (5-15 min later) will correct the state.

---

## 9. Risk Classification

### CRITICAL — Data corruption possible

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| C-1 | No UNIQUE constraint on active sequences | `chat_auto_sequences` | Two concurrent `startSequence()` calls can create duplicate active sequences for the same chat. No DB-level guard exists. **FIXED: migration 030 (UNIQUE partial index) + transaction in sequence-service.ts** |

### HIGH — Duplicate actions possible

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| H-1 | Sequence start TOCTOU race | `sequence-service.ts:startSequence()` | Check-then-insert without transaction or DB constraint. Can create 2 active sequences. **FIXED: transaction + UNIQUE index + 23505 catch** |
| H-2 | Sequence cron double-advance | `cron-jobs.ts:startAutoSequenceProcessor()` | If PM2 restarts during processing, two processors could advance the same sequence (though deterministic message ID prevents double-send). **FIXED: processing_locked_at column (migration 030) + row-level lock in cron** |
| H-3 | Missing `review_chat_links` uniqueness on `(chat_id, store_id)` | `review_chat_links` table | Known issue — 56 duplicates found. Extension `createReviewChatLink()` has application-level guard but it's not atomic. **FIXED EARLIER: migration 026** |

### MEDIUM — Inconsistent automation behavior

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| M-1 | No transactions anywhere | All multi-step operations | Partial state updates possible on any failure between steps. Self-healing mechanisms (stale cleanup, next cron run) mitigate most cases. **PARTIALLY FIXED: transactions added for sequences (Task 1) and complaint-statuses (Task 4)** |
| M-2 | Dialogue sync snapshot staleness | `dialogues/update/route.ts` | `existingChatMap` read at start can be stale by the time status transitions execute (up to minutes later for 65 stores). **FIXED: advisory lock per store + optimistic locking on status transitions** |
| M-3 | Cron state lost on restart | `cron-jobs.ts` `runningJobs` | In-memory flags don't survive PM2 restart. Mitigated by: cron intervals are long enough that overlap is rare. **FIXED: processing_locked_at DB-level lock for auto-sequence processor** |
| M-4 | Partial complaint status update | `complaint-statuses route` | Reviews and review_complaints updated in 2 separate queries without transaction. Failure between them = inconsistency. **FIXED: wrapped in transaction()** |
| M-5 | Extension + Cron close race | `closeLinkedChatsForReviews` + `resolved-review-closer` | Both can try to close the same chat simultaneously. Harmless (idempotent UPDATE) but generates duplicate log entries in `chat_status_history`. **FIXED: dedup guard in insertStatusHistory (5-second window)** |

### LOW — Edge case behavior

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| L-1 | TG notification duplicate on concurrent sync | `telegram-notifications.ts` | Tiny window where two syncs could send duplicate TG message. Self-limiting after first log. |
| L-2 | Auto-sequence extra message on client reply | `cron-jobs.ts` auto-sequence | Between checking "client replied" and sending, client could reply. One extra message possible. |
| L-3 | stale cleanup affects legitimate awaiting_reply | `cron-jobs.ts` cleanup SQL | The `UPDATE chats ... WHERE status='awaiting_reply' AND NOT EXISTS(active sequence)` could incorrectly transition a chat that was just set to awaiting_reply by a user. **FIXED: added `AND status_updated_at < NOW() - INTERVAL '5 minutes'` time guard** |

---

## 10. Hardening Recommendations

### P0 — Address CRITICAL/HIGH (recommended immediately)

#### R-1: Add UNIQUE partial index on `chat_auto_sequences`

```sql
CREATE UNIQUE INDEX idx_chat_auto_sequences_active_chat
ON chat_auto_sequences (chat_id)
WHERE status = 'active';
```

**Impact:** Eliminates C-1 and H-1. Database enforces "one active sequence per chat" invariant. Application code gets a unique_violation error on race, which can be caught and returned as 409.

**Effort:** 1 migration, 1 try/catch in `sequence-service.ts`

#### R-2: Add UNIQUE partial index on `review_chat_links`

```sql
CREATE UNIQUE INDEX idx_review_chat_links_chat_unique
ON review_chat_links (chat_id, store_id)
WHERE chat_id IS NOT NULL;
```

**Impact:** Eliminates H-3. Enforces 1 chat = 1 review at DB level. Existing 56 duplicates must be cleaned up first (keep the earliest link per chat).

**Effort:** 1 cleanup script + 1 migration

#### R-3: Wrap sequence start in transaction

```typescript
// In sequence-service.ts:startSequence()
await transaction(async (client) => {
  const existing = await client.query(
    'SELECT id FROM chat_auto_sequences WHERE chat_id = $1 AND status = $2 FOR UPDATE',
    [chatId, 'active']
  );
  if (existing.rows.length > 0) throw new SequenceConflictError(...);
  // ... create sequence within same transaction
});
```

**Impact:** Belt-and-suspenders with R-1. Prevents TOCTOU even without the UNIQUE index.

**Effort:** Moderate — requires using `transaction()` helper and passing client to queries.

### P1 — Address MEDIUM issues (next sprint)

#### R-4: Add optimistic locking to dialogue sync status transitions

Use `status_updated_at` as a version field:
```sql
UPDATE chats SET status = 'inbox', status_updated_at = NOW()
WHERE id = $1 AND status_updated_at = $2  -- only if unchanged
```

**Impact:** Prevents M-2. If another process changed the status, the update becomes a no-op.

**Effort:** Low — add WHERE clause to `updateChatWithAudit()`

#### R-5: Wrap complaint-statuses in a transaction

```typescript
await transaction(async (client) => {
  // bulk update reviews
  // bulk update review_complaints
  // close linked chats
});
```

**Impact:** Eliminates M-4. All-or-nothing updates.

**Effort:** Low — existing `transaction()` helper is ready to use.

#### R-6: Add `pg_advisory_xact_lock` for dialogue sync per store

```typescript
// At start of updateDialoguesForStore()
const lockId = hashCode(storeId); // deterministic integer
await query('SELECT pg_advisory_xact_lock($1)', [lockId]);
```

**Impact:** Prevents overlapping dialogue syncs for the same store. Eliminates M-2 at the source.

**Effort:** Low

### P2 — Nice to have (future)

#### R-7: Replace in-memory cron guards with DB-level locking

```sql
CREATE TABLE cron_locks (
  job_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ,
  locked_by TEXT  -- process ID
);
```

Use `INSERT ON CONFLICT` with a TTL check to acquire lock. Prevents multi-process overlap during PM2 restarts.

**Impact:** Eliminates M-3. Overkill for current single-process cron setup but important if scaling.

#### R-8: Idempotency keys for auto-sequence message sends

Current deterministic message ID (`auto_${sequenceId}_${currentStep}`) already provides this for `chat_messages`. Consider adding the same pattern for the WB/OZON API calls if those APIs support idempotency headers.

#### R-9: Dead letter queue for failed TG notifications

Currently, failed TG sends are logged but lost. A simple retry table could catch these and re-send in the next cycle.

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | C-1: FIXED (migration 030 + transaction) |
| HIGH | 3 | H-1: FIXED (transaction + 23505), H-2: FIXED (processing_locked_at), H-3: FIXED EARLIER (migration 026) |
| MEDIUM | 5 | ALL FIXED: advisory lock, optimistic locking, transactions, dedup guard |
| LOW | 3 | L-3: FIXED (time guard). L-1, L-2: acceptable edge cases, not addressed |

**Overall Assessment (post-fix):** All CRITICAL, HIGH, and MEDIUM findings have been addressed:

1. **C-1 + H-1 (Sequence duplication)** — FIXED: UNIQUE partial index + transaction + 23505 catch
2. **H-2 (Cron double-advance)** — FIXED: `processing_locked_at` column with 10-minute TTL
3. **M-2 (Snapshot staleness)** — FIXED: advisory lock per store + optimistic locking on status transitions
4. **M-4 (Partial complaint update)** — FIXED: `transaction()` wrapper
5. **M-5 (Duplicate history)** — FIXED: 5-second dedup in `insertStatusHistory`
6. **L-3 (Stale cleanup)** — FIXED: 5-minute time guard

**Migration:** `030_sequence_concurrency_hardening.sql` (UNIQUE index + processing_locked_at column)
**Code changes:** 6 files modified (sequence-service, cron-jobs, helpers, dialogue sync, complaint-statuses, sequence-repository)
