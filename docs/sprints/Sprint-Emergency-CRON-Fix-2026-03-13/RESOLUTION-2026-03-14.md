# Resolution: Emergency CRON Fix — Final Resolution

**Date:** 2026-03-14
**Sprint:** Sprint-Emergency-CRON-Fix-2026-03-13
**Status:** RESOLVED

---

## What Was Still Broken After Emergency Fix (2026-03-13)

The emergency fix on 2026-03-13 added an `ENABLE_CRON_IN_MAIN_APP` gate to `init-server.ts`. This correctly prevented CRON from running in cluster instances, but introduced a new problem:

**The `initialized` flag blocked `/api/cron/trigger` from starting CRON.**

Flow:
1. `instrumentation.ts` → `initializeServer()` → `initialized = true`, CRON off
2. `start-cron.js` → POST `/api/cron/trigger` → calls `initializeServer()`
3. `initializeServer()` sees `initialized === true` → returns early → **CRON never starts**

**Result:** ALL CRON jobs were dead from 2026-03-13 12:35 onwards:
- No dialogue sync → no TG notifications
- No review sync → no complaint generation
- No auto-sequence processing

---

## How It Was Fully Resolved (2026-03-14)

### Fix 1: Two-flag initialization (`init-server.ts`)

Separated `initialized` (server startup) from `cronJobsStarted` (CRON actually running). Added `forceCron` option that bypasses `ENABLE_CRON_IN_MAIN_APP` check:

```typescript
let initialized = false;
let cronJobsStarted = false;

export function initializeServer(options?: { forceCron?: boolean }) {
  if (initialized && (!options?.forceCron || cronJobsStarted)) return;
  initialized = true;

  const enableCron = options?.forceCron || process.env.ENABLE_CRON_IN_MAIN_APP === 'true';
  if (!enableCron) return;
  if (cronJobsStarted) return;

  // Start all CRON jobs...
  cronJobsStarted = true;
}
```

### Fix 2: CRON trigger endpoint (`route.ts`)

Updated to use `forceCron: true` and expose `isCronRunning()`:
- POST: `initializeServer({ forceCron: true })` — starts CRON regardless of env var
- GET: returns `{ cronRunning: boolean }` — used by health check

### Fix 3: Health check with auto-retrigger (`start-cron.js`)

Replaced one-shot heartbeat with active health monitoring:
- Every 5 min: GET `/api/cron/trigger` → check `cronRunning`
- If `cronRunning: false` → POST re-trigger (auto-recovery)
- 10 consecutive failures → exit (PM2 restarts)

### Fix 4: Fork mode (`ecosystem.config.js`)

Changed from `cluster: 2 instances` to `fork: 1 instance`. Eliminates the root cause entirely — no more cluster routing issues with in-memory state.

### Fix 5: Telegram admin alerting (`start-cron.js`)

Added TG alerts to admin after 3+ consecutive health check failures. Prevents silent CRON death going unnoticed for hours/days.

### Fix 6: Backfill worker API key (`backfill-worker.ts`)

Added `NEXT_PUBLIC_API_KEY` as fallback for `INTERNAL_API_KEY || CRON_API_KEY`, eliminating recurring error logs.

---

## Verification (2026-03-14)

After deployment:
- `pm2 list` → 3 processes online (fork mode)
- `curl /api/cron/trigger` → `cronRunning: true`
- Dialogue sync active (61 stores)
- TG admin alerting tested (message delivered to @KlimovIS)
- Memory usage: ~392MB total (well within 4GB)

---

## Related Documents

- [Sprint-007 System Health Audit](../Sprint-007-System-Health-Audit-2026-03-14/AUDIT-RESULTS.md) — Full audit that led to these fixes
- [Sprint-007 Backlog](../Sprint-007-System-Health-Audit-2026-03-14/BACKLOG.md) — Task tracking (P0+P1 complete)
- [CRON_JOBS.md](../../CRON_JOBS.md) — Updated architecture documentation

---

## Timeline

| Time | Event |
|------|-------|
| 2026-03-13 ~12:00 | Duplicate sends discovered (3x per CRON cycle) |
| 2026-03-13 12:35 | Emergency fix deployed (`ENABLE_CRON_IN_MAIN_APP` gate) |
| 2026-03-13 12:35+ | ALL CRON jobs dead (unintended side effect) |
| 2026-03-14 08:33 | System health audit starts |
| 2026-03-14 08:38 | Root cause identified (two flags needed, not one) |
| 2026-03-14 ~09:00 | Fix deployed: forceCron + health check + fork mode |
| 2026-03-14 ~09:05 | CRON verified running, dialogue sync active |
| 2026-03-14 ~10:00 | P1 tasks completed: docs, alerting, backfill fix |
| 2026-03-14 ~11:00 | TG admin alerting configured and tested |

**Total CRON downtime:** ~20 hours (2026-03-13 12:35 → 2026-03-14 ~09:00)
