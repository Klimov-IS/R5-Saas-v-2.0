# Audit Results — 2026-03-14

## 1. Production Health Status

**Timestamp:** 2026-03-14 ~11:45 MSK (08:45 UTC)

### 1.1 PM2 Processes

| Process | Mode | Instances | Status | Memory |
|---------|------|-----------|--------|--------|
| wb-reputation | cluster | 2 | online | ~138MB each |
| wb-reputation-cron | fork | 1 | online | ~79MB |
| wb-reputation-tg-bot | fork | 1 | online | ~75MB |
| pm2-logrotate | fork | 1 | online | ~69MB |

**Total RAM:** ~2.0GB used / 3.8GB total (52%). Headroom OK.
**Disk:** 7.4GB used / 19GB total (40%). Headroom OK.

### 1.2 CRON Jobs — All Running

After deployment at 08:33 UTC:
```
[START-CRON] Response: {"cronRunning":true}
[START-CRON] CRON jobs triggered!
[START-CRON] Health check every 300s
```

First health check at 08:38 — false alarm (cluster routing), auto-retriggered.
Second health check at 08:43 — `Health OK: CRON running`.

**Active CRON jobs (11 of 12):**
1. Daily Review Sync (hourly)
2. Adaptive Dialogue Sync (5min/15min/60min)
3. Daily Product Sync (7:00 MSK)
4. Backfill Worker (every 5 min)
5. Google Sheets Export (6:00 MSK)
6. Client Directory Sync (7:30 MSK)
7. Auto-Sequence Processor (every 30 min)
8. Rolling Review Full Sync (3:00 MSK)
9. Midday Review Catchup (13:00 MSK)
10. OZON Hourly Full Sync (9:00-20:00 MSK)
11. Resolved Review Closer (every 30 min)

**Disabled:** Chat Status Transition (manual via TG mini app now)

### 1.3 Data Activity

| Metric | Value | Verdict |
|--------|-------|---------|
| Total chats | 415,325 | - |
| Chats updated last 30 min | 15,926 | Dialogue sync working |
| Total reviews | 3,499,602 | - |
| Reviews updated last hour | 2,946 | Review sync working |
| Active auto-sequences | 1,367 | Running |
| Stopped auto-sequences | 6,224 | From emergency stop 03-13 |
| Completed auto-sequences | 8 | Low — sequences just restarted |
| Duplicate active sequences | **0** | UNIQUE index protecting |

### 1.4 Telegram Notifications

| Type | Total | With tg_message_id | Last sent |
|------|-------|-------------------|-----------|
| client_reply | 3,686 | 3,090 (84%) | 2026-03-14 08:40 |
| success_review_deleted | 119 | 50 (42%) | 2026-03-13 11:17 |
| success_needs_help | 32 | 15 (47%) | 2026-03-12 09:41 |
| success_review_upgraded | 17 | 11 (65%) | 2026-03-11 11:43 |

**After fix (14 Mar):** 100% of new notifications have `tg_message_id` tracked.

Recent notifications (last 30 min):
```
sent_at                  | tg_message_id | type
2026-03-14T08:47:15.236Z | 1918          | client_reply
2026-03-14T08:47:14.922Z | 1917          | client_reply
2026-03-14T08:47:14.607Z | 1916          | client_reply
...all with tg_message_id
```

### 1.5 Errors Found

| Error | Severity | Details |
|-------|----------|---------|
| BACKFILL-WORKER `INTERNAL_API_KEY` | Low | `INTERNAL_API_KEY or CRON_API_KEY not configured`. Complaints still generate via direct DB path. |
| Extension ReviewStatuses syncErrors | Low | 1-2 sync errors per batch out of 99. Transient API failures. |
| Health check false alarm | Medium | First health check at 08:38 saw `cronRunning: false` due to cluster routing. Auto-recovered. |

---

## 2. Architecture Risks

### 2.1 CRITICAL: Cluster Mode + In-Memory CRON State

**Risk level:** HIGH
**Impact:** Potential duplicate CRON jobs running in both cluster instances

**Problem:**
- Main app runs in cluster mode (2 instances, id=0 and id=3)
- `cronJobsStarted` is a module-level `let` variable — each instance has its own copy
- POST `/api/cron/trigger` hits ONE instance (via round-robin) → starts CRON there
- GET health check may hit THE OTHER instance → sees `cronRunning: false` → re-triggers
- Re-trigger POST may hit the other instance → starts SECOND set of CRON jobs

**Evidence:**
```
08:33:28 — POST trigger → instance 0 → cronRunning: true (CRON started here)
08:38:28 — GET health check → instance 3 → cronRunning: false (doesn't know!)
08:38:28 — POST re-trigger → instance ? → if instance 3: SECOND CRON!
                                          → if instance 0: "already running" (safe)
```

**Current mitigations (partial):**
- Auto-sequences have row-level `processing_locked_at` with 10-min TTL
- Unique partial index prevents duplicate active sequences per chat
- But dialogue sync, review sync, product sync have NO duplicate protection

**Why it hasn't exploded yet:**
- Round-robin POST re-trigger has 50% chance of hitting the right instance
- Even if both run, most jobs are idempotent (upserts, not inserts)
- Auto-sequences are protected by DB-level locks

**Solutions (see BACKLOG.md):** Switch to fork mode or standalone CRON process.

### 2.2 MEDIUM: Adaptive Dialogue Sync Uses setTimeout Chain

**Risk level:** MEDIUM

`startAdaptiveDialogueSync()` uses recursive `setTimeout` instead of `cron.schedule`. If the instance hosting the setTimeout chain gets OOM-killed by PM2 (`max_memory_restart: 1G`), the chain breaks.

Health check will re-trigger within 5 minutes, but there's a gap.

This is NOT a problem if we switch to fork mode (1 instance = no ambiguity).

### 2.3 MEDIUM: No External Alerting

**Risk level:** MEDIUM

If all processes die (server reboot, disk full, etc.):
- pm2 will auto-restart processes
- start-cron.js will re-trigger CRON
- But nobody is notified

If start-cron.js itself is stuck or pm2 daemon crashes — silent failure.

**No current alerting to Telegram admin chat for critical failures.**

### 2.4 LOW: Log Growth Rate

At 61 stores with dialogue sync every 5 minutes:
- `out.log` grew 32MB in ~1.5 hours = ~500MB/day
- pm2-logrotate set to 100MB max, 5 retained files
- Effective retention: ~5 hours of logs

This is OK for most cases but may miss overnight errors.

### 2.5 LOW: Backfill Worker API Key

`INTERNAL_API_KEY` or `CRON_API_KEY` not in `.env.production`. Backfill worker logs errors for every batch. Non-critical (complaints generate via other path) but noisy.

### 2.6 LOW: CRON_JOBS.md Documentation Outdated

`CRON_JOBS.md` still shows old `init-server.ts` code (without `forceCron`, `cronJobsStarted`):
```typescript
// DOCUMENTED (outdated):
const enableCronInMainApp = process.env.ENABLE_CRON_IN_MAIN_APP === 'true';
if (!enableCronInMainApp) {
  initialized = true;  // ← THE BUG that killed CRON
  return;
}
```

Doesn't mention:
- `forceCron` parameter
- `isCronRunning()` function
- Health check / auto-retrigger mechanism
- Cluster mode implications

### 2.7 LOW: CLAUDE.md Missing Architecture Details

`CLAUDE.md` (Pilot-entry level) has SSH credentials and PM2 commands but doesn't explain:
- How CRON trigger flow works (start-cron.js → HTTP → init-server.ts)
- Why in-memory state is fragile in cluster mode
- What happens on restart/redeploy
- Health check mechanism

`claude.md` (R5 saas-prod level) documents engineering protocols but doesn't have CRON architecture.

---

## 3. What Was Fixed (2026-03-14)

### Fix 1: init-server.ts — Separate Flags

**Before:**
```typescript
let initialized = false;  // ONE flag for everything

if (!enableCronInMainApp) {
  initialized = true;  // BUG: blocks trigger endpoint too
  return;
}
```

**After:**
```typescript
let initialized = false;      // Server startup completed
let cronJobsStarted = false;  // CRON schedulers actually running

export function initializeServer(options?: { forceCron?: boolean }) {
  // initialized=true on first call (instrumentation.ts)
  // cronJobsStarted=true only when CRON jobs actually start
  // forceCron bypasses ENABLE_CRON_IN_MAIN_APP check
}
```

### Fix 2: /api/cron/trigger — forceCron + cronRunning

**Before:** Checked `isInitialized()` → returned "already initialized" even without CRON.
**After:** Checks `isCronRunning()` → calls `initializeServer({ forceCron: true })` → returns `cronRunning` status.

### Fix 3: start-cron.js — Health Check + Auto-Retrigger

**Before:** One-shot trigger + empty heartbeat (5 min log line, no action).
**After:** Every 5 min: GET `/api/cron/trigger` → if `cronRunning: false` → POST re-trigger.
10 consecutive failures → `process.exit(1)` → PM2 restarts.

### Fix 4: telegram-notifications.ts — Save tg_message_id

**Before:** `await tgSendMessage(...)` — return value discarded.
**After:** `const messageId = await tgSendMessage(...)` → `updateNotificationMessageId()`.

### Fix 5: telegram-helpers.ts — New Function

Added `updateNotificationMessageId(telegramUserId, chatId, tgMessageId)` — updates recent log entries with the Telegram message ID.

---

## 4. Timeline of the Incident

| Date | Event |
|------|-------|
| **Mar 10** | Atomic dedup refactor deployed — `logTelegramNotificationAtomic()` inserts BEFORE send. tg_message_id no longer saved (bug introduced). |
| **Mar 13 12:35** | Emergency fix deployed — `ENABLE_CRON_IN_MAIN_APP` gate added to `init-server.ts`. Stops 3x duplicate sends. |
| **Mar 13 12:35+** | ALL CRON jobs die — trigger endpoint blocked by `initialized=true` when CRON disabled. |
| **Mar 13 evening** | ~1400 auto-sequences restarted manually via scripts. |
| **Mar 14 morning** | Health audit discovers: CRON dead, TG notifications not tracked, no alerts. |
| **Mar 14 11:33 MSK** | Fix deployed: forceCron, cronJobsStarted, health check, tg_message_id. All CRON jobs restored. |

---

## 5. Root Cause Analysis

### Why the emergency fix broke CRON

The emergency fix on March 13 was correct in intent (disable CRON in cluster instances) but had an unintended side effect:

```typescript
initialized = true;  // Line 34 in old init-server.ts
```

This single line made the trigger endpoint think the server was "fully initialized" even though no CRON jobs were running. The trigger endpoint's guard:

```typescript
if (isInitialized()) return "already initialized";
```

...returned success without starting anything.

### Why it wasn't caught

1. **No health check** — start-cron.js did one-shot trigger + heartbeat (no verification)
2. **No alerting** — nobody notified when CRON stopped
3. **Misleading logs** — "Heartbeat: ..." appeared every 5 min, implying everything was OK
4. **No documentation** — CLAUDE.md didn't explain the trigger flow, so the fix author didn't know about the dependency

### Why Claude Code didn't prevent it

The CLAUDE.md instructions said:
> "CRON jobs run ONLY in wb-reputation-cron process"

But didn't explain:
- HOW they run (via HTTP trigger to main app process)
- That `isInitialized()` is the guard in the trigger endpoint
- That setting `initialized=true` early would break the trigger
- That cluster mode means in-memory state isn't shared

**Lesson:** CLAUDE.md must document not just WHAT the architecture is, but HOW components interact and WHAT invariants must be maintained.
