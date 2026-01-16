# ADR-003: CRON Interval - 5 Minutes Dev, Daily Production

**Status:** Accepted
**Date:** 2026-01-14
**Decision Makers:** Development Team
**Technical Story:** [Previous session - CRON interval optimization]

---

## Context

The daily review sync CRON job needs different execution schedules for development vs production environments.

### Problem

**Production Requirements:**
- Sync reviews once per day (minimize WB API usage)
- Run during off-peak hours (8:00 AM MSK)
- Process 43 stores × ~2 seconds = ~86 seconds total duration

**Development Requirements:**
- Frequent testing (see CRON job behavior quickly)
- Reasonable interval (not too spammy)
- Avoid job overlap (job duration < interval)

### Initial Implementation

First attempt used **2-minute interval** for development:

```typescript
// src/lib/cron-jobs.ts (old code)
const cronSchedule = process.env.NODE_ENV === 'production'
  ? '0 5 * * *'      // 8:00 AM MSK daily
  : '*/2 * * * *';   // Every 2 minutes (PROBLEM!)
```

**Issue:** Full sync takes ~4 minutes for 43 stores. With 2-minute interval, jobs overlapped:

```
00:00 - Job 1 starts
00:02 - Job 2 starts (Job 1 still running!)
00:04 - Job 1 finishes, Job 3 starts (Job 2 still running!)
```

Even with concurrency protection, this triggered many "already running" log messages.

---

## Decision

**Development CRON interval: 5 minutes (increased from 2 minutes)**

### Implementation

**File:** [src/lib/cron-jobs.ts:54-56](../../src/lib/cron-jobs.ts#L54-L56)

```typescript
const cronSchedule = process.env.NODE_ENV === 'production'
  ? '0 5 * * *'      // 8:00 AM MSK daily (5:00 UTC)
  : '*/5 * * * *';   // Every 5 minutes for testing
```

**Timezone:** UTC (configured in `cron.schedule` options)

---

## Rationale

### Why 5 Minutes?

**Timing Analysis:**
- Full sync duration: ~4 minutes (43 stores × 2 seconds + API overhead)
- 5-minute interval gives ~1 minute buffer
- Prevents job overlap (even if sync is slightly slower)
- Still frequent enough for testing (12 executions per hour)

**Formula:**
```
interval > max_job_duration + buffer
5 minutes > 4 minutes + 1 minute ✓
```

### Why 8:00 AM MSK (5:00 UTC) for Production?

**Chosen for:**
- **Off-peak hours:** Most Russian users sleeping or commuting
- **Before business hours:** Fresh data available by 9 AM when sellers check dashboard
- **After midnight:** New reviews from previous day are fully indexed by WB
- **Stable time:** MSK doesn't have daylight saving time changes (UTC+3 year-round)

---

## Considered Alternatives

### Alternative 1: Keep 2-Minute Interval (Status Quo)

```typescript
const cronSchedule = '*/2 * * * *';  // Every 2 minutes
```

**Pros:**
- Faster testing feedback
- More frequent syncs

**Cons:**
- ❌ Job overlap (job takes 4 min, interval is 2 min)
- ❌ Spammy logs with "already running" messages
- ❌ Potential race conditions
- ❌ Wastes CPU checking "is job running?" every 2 minutes

**Rejected:** Causes overlap, unreliable for testing.

---

### Alternative 2: 10-Minute Interval

```typescript
const cronSchedule = '*/10 * * * *';  // Every 10 minutes
```

**Pros:**
- ✅ Large buffer (10 min > 4 min job duration)
- ✅ Less CPU usage
- ✅ Cleaner logs

**Cons:**
- ⚠️ Slower testing feedback (wait 10 min to see next run)
- ⚠️ Only 6 runs per hour

**Not Chosen:** Too infrequent for active development/testing.

---

### Alternative 3: Manual Trigger Only (No Auto-Run in Dev)

```typescript
const cronSchedule = process.env.NODE_ENV === 'production'
  ? '0 5 * * *'
  : null;  // No CRON in development

// Developer must call API manually:
// curl -X POST http://localhost:9002/api/stores/{id}/reviews/update
```

**Pros:**
- ✅ No wasted resources during development
- ✅ Full control over when sync happens

**Cons:**
- ❌ Can't test CRON auto-start behavior
- ❌ Must remember to manually trigger for testing
- ❌ Harder to test "what happens if CRON fails?"

**Not Chosen:** Defeats purpose of testing CRON automation.

---

### Alternative 4: Hourly in Production (Instead of Daily)

```typescript
const cronSchedule = process.env.NODE_ENV === 'production'
  ? '0 * * * *'      // Every hour
  : '*/5 * * * *';
```

**Pros:**
- More up-to-date review data
- Faster response to new reviews

**Cons:**
- ❌ 24× more WB API calls (24 per day vs 1 per day)
- ❌ Higher server load (24 × 86 seconds = 34 minutes of sync per day)
- ❌ Most reviews come during business hours (8 AM - 8 PM), not overnight
- ❌ Wildberries API rate limits might be hit

**Rejected:** Overkill, wastes resources, no real benefit.

---

## Consequences

### Positive

✅ **No job overlap:** 5-minute interval > 4-minute job duration
✅ **Clean logs:** No "already running" spam
✅ **Fast enough for testing:** 12 runs per hour
✅ **Resource efficient:** 1-minute idle time between jobs
✅ **Production optimal:** Daily sync is sufficient for business needs

### Negative

⚠️ **Longer wait for testing:** 5 minutes vs 2 minutes (acceptable trade-off)

---

## Concurrency Protection

Even with proper interval, we still have concurrency protection (defense-in-depth):

```typescript
// src/lib/cron-jobs.ts
const runningJobs: { [jobName: string]: boolean } = {};

cron.schedule(cronSchedule, async () => {
  const jobName = 'daily-review-sync';

  // Prevent concurrent runs (in case job takes longer than expected)
  if (runningJobs[jobName]) {
    console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
    return;
  }

  runningJobs[jobName] = true;
  const startTime = Date.now();

  try {
    // ... sync logic ...
  } finally {
    runningJobs[jobName] = false;
  }
});
```

**Why Both Interval Spacing AND Concurrency Protection?**
- Interval spacing: Primary defense (prevents normal overlap)
- Concurrency protection: Failsafe (if sync takes unexpectedly long)

---

## Production Verification

### Tested Scenarios

**1. Normal Execution (Dev Mode)**
```
[CRON] Mode: TESTING (every 5 min)
[CRON] Found 43 stores to sync

05:00 - Job starts
05:04 - Job finishes (duration: 4min 12s)
05:05 - Next job starts (no overlap ✓)
```

**2. Slow Execution (Network Issues)**
```
05:00 - Job starts
05:06 - Job still running (took longer than expected)
05:05 - Next trigger → "already running, skipping" ✓
05:07 - Job finishes
05:10 - Next job starts normally
```

**3. Production (Daily Sync)**
```
[CRON] Mode: PRODUCTION (8:00 AM MSK)
[CRON] Scheduling daily review sync: 0 5 * * *

2026-01-15 05:00 UTC (08:00 MSK) - Job runs
Duration: 1min 26s (43 stores)
Next run: 2026-01-16 05:00 UTC (08:00 MSK)
```

---

## Monitoring

### Check CRON Execution Frequency (Dev Mode)

```bash
# Count CRON runs in last hour
pm2 logs wb-reputation --nostream | grep "Starting daily review sync" | tail -15

# Should see ~12 runs per hour (every 5 minutes)
```

### Verify No Overlap

```bash
# Look for "already running" messages
pm2 logs wb-reputation | grep "already running"

# Should be empty (or very rare if sync occasionally takes >5 min)
```

---

## Future Considerations

### If Stores Grow to 100+

Current: 43 stores × 2 sec = ~86 seconds

Future: 100 stores × 2 sec = ~200 seconds (~3.3 minutes)

**Still OK with 5-minute interval** (3.3 min < 5 min)

### If Stores Grow to 200+

200 stores × 2 sec = ~400 seconds (~6.7 minutes)

**Problem:** 6.7 min > 5 min interval

**Solutions:**
1. Increase dev interval to 10 minutes: `*/10 * * * *`
2. Reduce delay between stores: 1 second instead of 2
3. Implement parallel processing (risky with WB API rate limits)
4. Switch to queue system (Bull/BullMQ)

---

## CRON Schedule Reference

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Our Schedules:**
- Production: `0 5 * * *` → "At 05:00 UTC every day"
- Development: `*/5 * * * *` → "Every 5 minutes"

---

## Related Decisions

- [ADR-001: Instrumentation Hook](./ADR-001-why-instrumentation-hook.md) - CRON auto-start
- [ADR-002: Active Stores Filter](./ADR-002-active-stores-filter.md) - Only sync 43 stores (not 49)

---

## References

- **Implementation:** [src/lib/cron-jobs.ts:54-56](../../src/lib/cron-jobs.ts#L54-L56)
- **Testing Results:** PM2 logs from 3 successful dev runs (2026-01-14)
- **node-cron Docs:** https://www.npmjs.com/package/node-cron

---

**Last Updated:** 2026-01-15
**Production Schedule:** Daily at 8:00 AM MSK (0 5 * * * UTC)
**Development Schedule:** Every 5 minutes (*/5 * * * *)
**Job Duration:** ~86 seconds (43 active stores)
