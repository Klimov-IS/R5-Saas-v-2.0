# TASK: Fix Cron Job Auto-Initialization (WB Reputation Manager)

**Project:** WB Reputation Manager v2.0 (Next.js 14 + PostgreSQL)
**Priority:** P0 (Critical - Production Impact)
**Estimated effort:** 2-4 hours
**Status:** Ready for implementation

---

## Problem Statement

**Current state:**
- ❌ Cron jobs (daily review sync) do NOT start automatically when Next.js server starts
- ❌ After server restart or deployment, cron is NOT running
- ❌ Daily sync at 8:00 AM MSK does NOT execute unless manually triggered via `GET /api/cron/init`
- ❌ No visibility into whether cron is running or not

**Root cause:**
Next.js 14 App Router has no standard server initialization hook that runs on process start. The existing `initializeServer()` function exists but is never called automatically.

**Business impact:**
- Reviews are NOT synced daily → data becomes stale
- Users don't see new reviews → poor UX
- Manual intervention required after each deployment → operational burden

---

## Goal

Implement automatic cron job initialization when Next.js server starts, with proper visibility and monitoring.

**Success criteria:**
1. ✅ Cron job starts automatically on server boot (no manual trigger needed)
2. ✅ Status endpoint shows cron is running after server restart
3. ✅ Daily sync executes at 8:00 AM MSK in production
4. ✅ Test mode (every 2 min) works in development
5. ✅ Logs clearly show cron initialization and execution

---

## Scope (must implement)

### A) Add Next.js Instrumentation Hook

**File:** `instrumentation.ts` (root of project)

**Implementation:**
1. Create instrumentation hook that runs once on server startup
2. Call `initializeServer()` only in Node.js runtime (skip Edge)
3. Add proper error handling and logging
4. Ensure idempotency (don't re-initialize if already running)

**Requirements:**
- Must work with Next.js 14 App Router
- Must respect `NEXT_RUNTIME` environment variable
- Must log initialization status to console
- Must handle errors gracefully (don't crash server)

---

### B) Enable Instrumentation in Next.js Config

**File:** `next.config.js`

**Changes:**
1. Enable `experimental.instrumentationHook` flag
2. Add comment explaining why it's needed
3. Ensure backward compatibility with existing config

---

### C) Improve Cron Initialization Logging

**File:** `src/lib/init-server.ts`

**Improvements:**
1. Add detailed startup logs with timestamps
2. Log cron schedule (production vs development)
3. Log expected next execution time
4. Add error handling with actionable messages

**Example output:**
```
[INIT] 🚀 Initializing server at 2026-01-15T12:00:00.000Z
[INIT] Environment: production
[CRON] Scheduling daily review sync: 0 5 * * * (8:00 AM MSK)
[CRON] Next execution: 2026-01-16T05:00:00.000Z
[CRON] ✅ Daily review sync job started successfully
[INIT] ✅ Server initialized successfully
```

---

### D) Add Health Check Endpoint

**File:** `src/app/api/health/route.ts` (new)

**Endpoint:**
```
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T12:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": "connected",
    "cronJobs": {
      "initialized": true,
      "jobs": [
        {
          "name": "daily-review-sync",
          "schedule": "0 5 * * *",
          "running": true,
          "lastRun": "2026-01-15T05:00:00.000Z",
          "nextRun": "2026-01-16T05:00:00.000Z"
        }
      ]
    }
  }
}
```

**Purpose:**
- Monitor cron status without authentication
- Use in Docker health checks
- Debugging and troubleshooting

---

### E) Improve Cron Status Endpoint

**File:** `src/app/api/cron/status/route.ts` (update)

**Enhancements:**
1. Add authentication (API token required)
2. Include more detailed information:
   - Schedule (cron expression)
   - Last execution timestamp
   - Next execution timestamp
   - Running jobs count
   - Error state if any
3. Add proper error responses

---

### F) Add Database Logging Table (optional but recommended)

**Migration:** `supabase/migrations/YYYYMMDD_cron_logs.sql` (new)

**Table:** `cron_execution_logs`
```sql
CREATE TABLE IF NOT EXISTS cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'success', 'error')),
  stores_synced INTEGER,
  stores_failed INTEGER,
  duration_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cron_logs_job_started ON cron_execution_logs(job_name, started_at DESC);
```

**Purpose:**
- Historical tracking of cron executions
- Debugging failed syncs
- Performance monitoring
- Alerting (if sync hasn't run in 25 hours)

---

## Implementation Plan

### Phase 1: Local Development & Testing (1-2 hours)

**Steps:**
1. ✅ Create `instrumentation.ts` in project root
2. ✅ Update `next.config.js` with experimental flag
3. ✅ Improve logging in `init-server.ts`
4. ✅ Create health check endpoint
5. ✅ Update cron status endpoint
6. ✅ Test on local server:
   ```bash
   npm run dev:fresh
   ```
7. ✅ Verify cron started:
   ```bash
   curl http://localhost:9002/api/health
   curl http://localhost:9002/api/cron/status \
     -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
   ```
8. ✅ Wait for cron execution (2 min in dev mode)
9. ✅ Check logs for cron output
10. ✅ Restart server and verify auto-initialization

---

### Phase 2: Git Commit & Documentation (30 min)

**Steps:**
1. ✅ Review all changes
2. ✅ Create comprehensive commit message:
   ```
   feat: Add automatic cron job initialization on server startup

   Problem:
   - Cron jobs were not starting automatically after server restart
   - Manual trigger via /api/cron/init was required
   - No visibility into cron status

   Solution:
   - Added Next.js instrumentation hook (instrumentation.ts)
   - Enabled experimentalInstrumentationHook in next.config.js
   - Improved initialization logging
   - Added /api/health endpoint for monitoring
   - Enhanced /api/cron/status with more details

   Testing:
   - Tested on local dev server (npm run dev:fresh)
   - Verified cron starts automatically
   - Verified daily sync executes in dev mode (every 2 min)
   - Checked health endpoint returns correct status

   Files changed:
   - instrumentation.ts (new)
   - next.config.js (updated)
   - src/lib/init-server.ts (improved logging)
   - src/app/api/health/route.ts (new)
   - src/app/api/cron/status/route.ts (enhanced)

   Next steps:
   - Deploy to production
   - Monitor cron execution logs
   - Set up alerting if cron fails
   ```

3. ✅ Update documentation:
   - Add section in README.md about cron jobs
   - Document health check endpoint
   - Add troubleshooting guide

4. ✅ Commit and push:
   ```bash
   git add .
   git commit -m "feat: Add automatic cron job initialization on server startup"
   git push origin main
   ```

---

### Phase 3: Production Deployment (1-2 hours)

**Pre-deployment checklist:**
- [ ] All tests pass locally
- [ ] Cron auto-starts on local server restart
- [ ] Health endpoint returns correct status
- [ ] Code reviewed (self-review or peer review)
- [ ] No console errors in logs
- [ ] Environment variables correct in production

**Deployment steps:**

1. ✅ **SSH to production server:**
   ```bash
   ssh user@production-server
   cd /path/to/wb-reputation-manager
   ```

2. ✅ **Pull latest code:**
   ```bash
   git pull origin main
   ```

3. ✅ **Install dependencies (if needed):**
   ```bash
   npm install
   ```

4. ✅ **Build production bundle:**
   ```bash
   npm run build
   ```

5. ✅ **Restart Next.js server:**
   ```bash
   # Option 1: PM2 restart
   pm2 restart wb-reputation-manager

   # Option 2: Systemd restart
   sudo systemctl restart wb-reputation-manager

   # Option 3: Docker restart
   docker-compose restart app
   ```

6. ✅ **Verify cron started (within 30 seconds):**
   ```bash
   curl https://your-domain.com/api/health | jq

   # Expected output:
   # {
   #   "status": "healthy",
   #   "services": {
   #     "cronJobs": {
   #       "initialized": true,
   #       "jobs": [...]
   #     }
   #   }
   # }
   ```

7. ✅ **Check server logs:**
   ```bash
   # PM2
   pm2 logs wb-reputation-manager --lines 50

   # Systemd
   sudo journalctl -u wb-reputation-manager -n 50 -f

   # Docker
   docker-compose logs -f --tail=50 app
   ```

   **Expected logs:**
   ```
   [INIT] 🚀 Initializing server at 2026-01-15T12:00:00.000Z
   [CRON] Scheduling daily review sync: 0 5 * * *
   [CRON] Mode: PRODUCTION (8:00 AM MSK)
   [CRON] ✅ Daily review sync job started successfully
   [INIT] ✅ Server initialized successfully
   ```

8. ✅ **Wait for next scheduled execution (8:00 AM MSK tomorrow):**
   - Set reminder to check logs at 8:00 AM MSK
   - Expected log output:
     ```
     ========================================
     [CRON] 🚀 Starting daily review sync at 2026-01-16T05:00:00.000Z
     ========================================
     [CRON] Found 2 stores to sync
     [CRON] Starting review sync for store: Магазин 1 (...)
     ...
     ```

9. ✅ **Monitor database for updates:**
   ```sql
   -- Check last sync times
   SELECT
     name,
     last_review_update_status,
     last_review_update_date,
     EXTRACT(EPOCH FROM (NOW() - last_review_update_date))/3600 as hours_ago
   FROM stores
   ORDER BY last_review_update_date DESC;

   -- Should show last_review_update_date within last 1-2 hours after 8 AM MSK
   ```

10. ✅ **Set up monitoring alert (optional):**
    - Ping health endpoint every 5 minutes
    - Alert if `cronJobs.initialized = false`
    - Alert if last sync > 25 hours ago

---

### Phase 4: Post-Deployment Validation (30 min)

**Validation checklist:**

- [ ] Health endpoint accessible: `https://your-domain.com/api/health`
- [ ] Cron status shows initialized: `cronJobs.initialized = true`
- [ ] Server logs show initialization messages
- [ ] No errors in logs
- [ ] First daily sync executed successfully (wait until 8:00 AM MSK + 15 min)
- [ ] Database shows updated `last_review_update_date` for all stores
- [ ] All stores have `last_review_update_status = 'success'`
- [ ] Review counts updated: `total_reviews` increased

**If validation fails:**

1. **Check logs for errors:**
   ```bash
   pm2 logs wb-reputation-manager --err --lines 100
   ```

2. **Manually trigger cron to test:**
   ```bash
   curl -X GET https://your-domain.com/api/cron/init
   ```

3. **Check individual store sync:**
   ```bash
   curl -X POST https://your-domain.com/api/stores/{storeId}/reviews/update?mode=incremental \
     -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
   ```

4. **Rollback if critical:**
   ```bash
   git revert HEAD
   git push origin main
   # Re-deploy previous version
   ```

---

## Required Tests

### Unit Tests

**File:** `tests/unit/cron-initialization.test.ts` (new)

```typescript
describe('Cron Initialization', () => {
  it('should initialize cron job without errors', () => {
    expect(() => initializeServer()).not.toThrow();
  });

  it('should not re-initialize if already initialized', () => {
    initializeServer();
    const consoleSpy = jest.spyOn(console, 'log');
    initializeServer();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('already initialized')
    );
  });

  it('should return correct cron schedule in production', () => {
    process.env.NODE_ENV = 'production';
    const status = getJobsStatus();
    expect(status.totalJobs).toBeGreaterThan(0);
  });
});
```

---

### Integration Tests

**File:** `tests/integration/cron-execution.test.ts` (new)

```typescript
describe('Cron Execution Integration', () => {
  it('should execute daily sync successfully', async () => {
    // Trigger manual sync
    const response = await fetch('/api/cron/init');
    expect(response.ok).toBe(true);

    // Wait for execution (in test mode: 2 min)
    await new Promise(resolve => setTimeout(resolve, 130000)); // 2 min 10 sec

    // Check database
    const stores = await db.query('SELECT * FROM stores');
    expect(stores.rows.every(s => s.last_review_update_date !== null)).toBe(true);
  });

  it('should update health endpoint after initialization', async () => {
    await fetch('/api/cron/init');

    const health = await fetch('/api/health').then(r => r.json());
    expect(health.services.cronJobs.initialized).toBe(true);
    expect(health.services.cronJobs.jobs.length).toBeGreaterThan(0);
  });
});
```

---

## Documentation Updates

### 1. README.md

Add section:

```markdown
## Cron Jobs

### Daily Review Sync

**Schedule:**
- **Production:** Every day at 8:00 AM MSK (5:00 AM UTC)
- **Development:** Every 2 minutes (for testing)

**What it does:**
- Fetches new reviews from WB API for all stores
- Updates `last_review_update_date` and `total_reviews`
- Logs execution status to console

**How to check if running:**
```bash
# Health check (no auth)
curl http://localhost:9002/api/health | jq '.services.cronJobs'

# Detailed status (requires API token)
curl http://localhost:9002/api/cron/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Manual trigger:**
```bash
curl -X GET http://localhost:9002/api/cron/init
```

**Troubleshooting:**
- If cron is not running after server start, check logs for initialization errors
- Restart server: `pm2 restart wb-reputation-manager`
- Check database: Ensure `last_review_update_date` is recent
```

---

### 2. DEPLOYMENT.md (new)

Create comprehensive deployment guide with cron validation steps.

---

## Definition of Done

**Technical checklist:**
- [ ] `instrumentation.ts` created and calls `initializeServer()`
- [ ] `next.config.js` enables `instrumentationHook`
- [ ] Improved logging in `init-server.ts`
- [ ] Health check endpoint `/api/health` created
- [ ] Cron status endpoint `/api/cron/status` enhanced
- [ ] Unit tests pass
- [ ] Integration tests pass (manual or automated)

**Local testing checklist:**
- [ ] Cron starts automatically on `npm run dev:fresh`
- [ ] Health endpoint returns `cronJobs.initialized = true`
- [ ] Cron executes in dev mode (every 2 min)
- [ ] Logs show initialization and execution messages
- [ ] Server restart preserves cron initialization

**Production deployment checklist:**
- [ ] Code committed to git with detailed message
- [ ] Code pushed to `main` branch
- [ ] Pulled latest code on production server
- [ ] Built production bundle (`npm run build`)
- [ ] Restarted server (PM2/systemd/Docker)
- [ ] Health endpoint returns healthy status
- [ ] Server logs show cron initialization
- [ ] Waited for 8:00 AM MSK execution
- [ ] Database shows updated sync times
- [ ] All stores have `status = 'success'`

**Documentation checklist:**
- [ ] README.md updated with cron section
- [ ] DEPLOYMENT.md created (or updated)
- [ ] API docs updated for `/api/health`
- [ ] Troubleshooting guide added

**No scope creep:**
- ❌ Do NOT implement UI for cron management
- ❌ Do NOT add email notifications for cron failures
- ❌ Do NOT implement multiple cron jobs (only review sync)
- ❌ Do NOT add database logging table (optional, defer to later)
- ❌ Do NOT change cron schedule logic (keep existing: 8 AM MSK prod, 2 min dev)

---

## Files Changed

**New files:**
1. `instrumentation.ts` - Server initialization hook
2. `src/app/api/health/route.ts` - Health check endpoint
3. `tests/unit/cron-initialization.test.ts` - Unit tests
4. `tests/integration/cron-execution.test.ts` - Integration tests
5. `DEPLOYMENT.md` - Deployment guide (optional)

**Modified files:**
1. `next.config.js` - Enable instrumentation hook
2. `src/lib/init-server.ts` - Improve logging
3. `src/lib/cron-jobs.ts` - Add next execution time logging
4. `src/app/api/cron/status/route.ts` - Enhanced response
5. `README.md` - Add cron documentation

**Total:** 5 new files, 5 modified files

---

## Commands to Run

### Development:
```bash
# Fresh start
npm run dev:fresh

# Check health
curl http://localhost:9002/api/health | jq

# Check cron status
curl http://localhost:9002/api/cron/status \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" | jq

# Run tests
npm test
```

### Production:
```bash
# On production server
cd /path/to/project
git pull origin main
npm install
npm run build
pm2 restart wb-reputation-manager

# Verify
curl https://your-domain.com/api/health | jq
pm2 logs wb-reputation-manager --lines 50
```

---

## Success Metrics

**After implementation:**
- ✅ Zero manual interventions needed after deployment
- ✅ Daily sync executes at 8:00 AM MSK every day
- ✅ 100% of stores sync successfully (or errors logged)
- ✅ Health endpoint returns healthy status 24/7
- ✅ Server restarts don't break cron functionality

**Long-term:**
- Monitor cron execution success rate (target: >99%)
- Track average sync duration (baseline: 30-60 seconds per store)
- Alert if sync hasn't run in 25 hours

---

## Risk Assessment

**Low risk:**
- ✅ Uses Next.js official instrumentation hook (stable in 14.x)
- ✅ Non-breaking changes (backward compatible)
- ✅ Graceful degradation (if cron fails to start, API still works)
- ✅ Easy rollback (revert git commit)

**Mitigation:**
- Test thoroughly in local environment first
- Deploy during low-traffic hours
- Monitor logs for 24 hours after deployment
- Have rollback plan ready

---

**Ready to implement!** 🚀
