# Backlog — Post-Audit Hardening Tasks

**Created:** 2026-03-14
**Source:** [AUDIT-RESULTS.md](AUDIT-RESULTS.md)
**Priority:** P0 = do now, P1 = this week, P2 = next sprint, P3 = nice to have

---

## P0 — Critical (do now)

### TASK-001: Fix cluster mode CRON duplication risk

**Problem:** Cluster mode (2 instances) + in-memory `cronJobsStarted` flag = health check may trigger CRON in both instances.

**Evidence:** First health check at 08:38 saw `cronRunning: false` and re-triggered. This means the GET hit instance 3 (where CRON isn't running). The POST re-trigger could have started a second set of CRON jobs in instance 3.

**Solution (choose one):**

**Option A — Switch to fork mode (1 instance) [RECOMMENDED]**
- Change `ecosystem.config.js`: `instances: 1, exec_mode: 'fork'`
- Simplest fix. Server has 4GB RAM — enough for 1 instance + CRON + TG bot (~400MB total)
- No cluster routing issues, no state fragmentation
- Tradeoff: no zero-downtime restarts (brief 2-3s gap on restart)

**Option B — Standalone CRON process (no HTTP trigger)**
- `start-cron.js` imports `cron-jobs.ts` directly and runs CRON in its own Node.js process
- No dependency on main app for CRON execution
- More complex: needs TypeScript compilation, shared DB config
- Tradeoff: CRON process becomes heavier (~100MB+ with all job dependencies)

**Option C — File-based lock**
- Before starting CRON: check `/tmp/r5-cron.lock` (PID file)
- If lock exists and PID alive → skip
- If lock stale → acquire and start
- Tradeoff: fragile, filesystem race conditions possible

**Files to modify:**
- `ecosystem.config.js` (Option A)
- OR `scripts/start-cron.js` + new `scripts/cron-runner.ts` (Option B)

**Estimated effort:** 30 min (Option A) / 2-3 hours (Option B)

---

## P1 — Important (this week)

### TASK-002: Update CRON_JOBS.md documentation

**Problem:** `CRON_JOBS.md` shows outdated code snippets from before the fix. Still references old `initialized` flag pattern without `forceCron` or `cronJobsStarted`.

**What to update:**
- [ ] Code snippet in "Code Protection" section → new `initializeServer({ forceCron })` pattern
- [ ] Add "Health Check Mechanism" section describing start-cron.js auto-retrigger
- [ ] Add "Restart Behavior" section: what happens when PM2 restarts each process
- [ ] Update Mermaid diagram to show the forceCron flow
- [ ] Add "Cluster Mode Warning" note about in-memory state

**Files:** `docs/CRON_JOBS.md`

**Estimated effort:** 30 min

---

### TASK-003: Update CLAUDE.md with CRON architecture internals

**Problem:** CLAUDE.md tells Claude Code to use SSH and PM2 commands but doesn't explain HOW CRON trigger works or WHAT invariants to maintain.

**What to add (section "CRON Architecture Internals"):**

```
### CRON Trigger Flow (Updated 2026-03-14)

1. PM2 starts main app (cluster, 2 instances) → instrumentation.ts → initializeServer()
   → sets initialized=true, CRON stays OFF
2. PM2 starts wb-reputation-cron (fork, 1 instance) → scripts/start-cron.js
   → waits for server → POST /api/cron/trigger → initializeServer({ forceCron: true })
   → starts all CRON jobs in ONE main app instance
3. Every 5 min: start-cron.js → GET /api/cron/trigger → checks cronRunning
4. If cronRunning=false → POST re-trigger (auto-recovery)

### Key Invariants (NEVER violate)

- CRON jobs must run in EXACTLY 1 process
- cronJobsStarted is in-memory — lost on process restart
- Cluster instances do NOT share memory
- init-server.ts must allow forceCron even if initialized=true
- start-cron.js must have health check, not just one-shot trigger

### On restart/redeploy

pm2 restart all:
1. Main app instances restart → cronJobsStarted=false (CRON dies)
2. start-cron.js restarts → waits 3s → POST trigger → CRON restarts
3. Max CRON downtime: ~13 seconds

pm2 restart wb-reputation (main app only):
1. Main app restarts → cronJobsStarted=false
2. start-cron.js is still running → health check in max 5 min → re-triggers
3. Max CRON downtime: ~5 minutes
```

**Files:** `Pilot-entry/.claude/CLAUDE.md` (the project-level instructions file that's always loaded)

**Estimated effort:** 20 min

---

### TASK-004: Add admin Telegram alerting for critical failures

**Problem:** If CRON dies and auto-recovery also fails — nobody is notified. Silent failure for hours/days.

**Solution:** In `start-cron.js` health check, after N consecutive failures (e.g., 3), send a Telegram message to admin chat:

```javascript
async function healthCheck() {
  // ...existing logic...
  if (consecutiveFailures >= 3 && consecutiveFailures % 3 === 0) {
    await sendAdminAlert(
      `⚠️ CRON health check failed ${consecutiveFailures} times! Last error: ${error.message}`
    );
  }
}

async function sendAdminAlert(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID; // new env var
  if (!botToken || !adminChatId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: adminChatId, text, parse_mode: 'HTML' }),
  });
}
```

**New env var:** `TELEGRAM_ADMIN_CHAT_ID` — Telegram chat ID of the admin/owner who should receive alerts.

**Files:** `scripts/start-cron.js`, `.env.production`

**Estimated effort:** 30 min

---

### TASK-005: Fix backfill worker INTERNAL_API_KEY

**Problem:** Backfill worker logs 5+ errors per run:
```
[BACKFILL-WORKER] Batch error: INTERNAL_API_KEY or CRON_API_KEY not configured
```

**Solution:** Either:
- Add `INTERNAL_API_KEY` or `CRON_API_KEY` to `.env.production`
- Or disable the API call path in backfill worker if it's not needed

**Files:** `.env.production`, possibly `src/lib/cron-jobs.ts` (backfill section)

**Estimated effort:** 10 min

---

## P2 — Improvement (next sprint)

### TASK-006: Increase pm2-logrotate retention

**Problem:** At ~500MB/day log output, 100MB limit with 5 retained files = ~5 hours of log retention.

**Solution:**
```bash
pm2 set pm2-logrotate:retain 15
pm2 set pm2-logrotate:max_size 50M
```

This gives: 15 files * 50MB = 750MB total, ~36 hours of retention. Better for overnight debugging.

**Alternative:** Reduce log verbosity — don't log every successful store sync, only errors and summaries.

**Estimated effort:** 5 min (config change) or 1-2 hours (log verbosity reduction)

---

### TASK-007: Add structured health endpoint

**Problem:** Currently health info is only available via `/api/cron/trigger` which requires API key auth. No simple health check for monitoring tools.

**Solution:** Add `/api/health` endpoint (no auth required) that returns:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "cronRunning": true,
  "lastDialogueSync": "2026-03-14T08:47:00Z",
  "lastReviewSync": "2026-03-14T08:00:00Z",
  "activeSequences": 1367,
  "version": "2.0.0"
}
```

Can be used by external monitoring (UptimeRobot, etc.) to detect issues.

**Files:** `src/app/api/health/route.ts` (new)

**Estimated effort:** 1 hour

---

### TASK-008: Document restart/redeploy procedure with verification

**Problem:** DEPLOYMENT.md doesn't clearly state what to verify after deploy. This led to the CRON being dead for 24+ hours without detection.

**Solution:** Add "Post-Deploy Verification Checklist" to DEPLOYMENT.md:

```
## Post-Deploy Checklist

After `pm2 restart all`, verify within 5 minutes:

1. [ ] `pm2 list` — all 4 processes online
2. [ ] CRON trigger: `curl localhost:3000/api/cron/trigger -H 'Auth...'` → cronRunning: true
3. [ ] Dialogue sync: `pm2 logs wb-reputation --lines 50 | grep 'dialogue sync'` → recent entries
4. [ ] No errors: `pm2 logs wb-reputation --lines 50 | grep -i error` → clean
5. [ ] TG bot: `pm2 logs wb-reputation-tg-bot --lines 10` → heartbeat present
```

**Files:** `DEPLOYMENT.md`

**Estimated effort:** 15 min

---

### TASK-009: Add Sprint-Emergency resolution notes

**Problem:** Sprint-Emergency-CRON-Fix-2026-03-13 documents the problem and initial fix, but not the final resolution (forceCron fix deployed on 2026-03-14).

**Solution:** Add `RESOLUTION-2026-03-14.md` to Sprint-Emergency folder with:
- What was still broken after emergency fix
- How it was fully resolved
- Link to Sprint-007 audit

**Files:** `docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/RESOLUTION-2026-03-14.md` (new)

**Estimated effort:** 15 min

---

## P3 — Nice to Have

### TASK-010: Standalone CRON process (eliminate HTTP trigger dependency)

**Problem:** Current architecture: CRON jobs run inside main app process, triggered via HTTP. This means CRON depends on main app being healthy, cluster routing being predictable, and in-memory state being preserved.

**Solution:** Move CRON jobs to a standalone Node.js process that:
- Imports cron-jobs.ts directly
- Runs its own node-cron schedulers
- Connects to DB independently
- No HTTP dependency on main app

**Tradeoff:** Requires TypeScript compilation setup for the standalone process, shared config management, and possibly duplicating some initialization code.

**This becomes unnecessary if TASK-001 Option A (fork mode) is chosen** — fork mode eliminates the cluster routing problem entirely.

**Estimated effort:** 4-6 hours

---

### TASK-011: Dialogue sync idempotency audit

**Problem:** If CRON runs in 2 instances (cluster bug), dialogue sync and review sync will execute twice per cycle. While most operations use upserts, there may be side effects:
- Double TG notifications (mitigated by atomic dedup)
- Double WB API calls (rate limit risk)
- Double backfill job creation

**Solution:** Audit all CRON jobs for side effects when executed twice concurrently. Add distributed locks (DB-based) where needed.

**Estimated effort:** 2-3 hours

---

## Summary

| Priority | Tasks | Completed | Total Effort |
|----------|-------|-----------|-------------|
| P0 | 1 task | 1/1 DONE | 30 min |
| P1 | 4 tasks | 4/4 DONE | ~1.5 hours |
| P2 | 4 tasks | 0/4 | ~2.5 hours |
| P3 | 2 tasks | 0/2 | ~8 hours |
| **Total** | **11 tasks** | **5/11** | **~12.5 hours** |

**Completed (2026-03-14):**
- TASK-001 (P0) — switched to fork mode, deployed, verified
- TASK-002 (P1) — CRON_JOBS.md updated with new architecture
- TASK-003 (P1) — CLAUDE.md updated with CRON internals
- TASK-004 (P1) — Telegram admin alerting added to start-cron.js
- TASK-005 (P1) — Backfill worker now falls back to NEXT_PUBLIC_API_KEY

**Note for TASK-004:** Requires `TELEGRAM_ADMIN_CHAT_ID` env var on production server. Without it, alerts silently skip. Add via:
```bash
# On production server, add to .env.production:
TELEGRAM_ADMIN_CHAT_ID=<admin-chat-id>
```

**Remaining (P2+P3):** as capacity allows
