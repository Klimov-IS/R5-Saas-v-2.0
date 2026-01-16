# ADR-001: Why Use Next.js Instrumentation Hook for CRON Auto-Start

**Status:** Accepted
**Date:** 2026-01-14
**Decision Makers:** Development Team
**Technical Story:** [Previous session context - CRON auto-start implementation]

---

## Context

We need background CRON jobs to run daily review syncs automatically. The challenge: how to ensure CRON jobs start reliably when the application deploys, without manual intervention after every deployment.

### Problem

Before this decision, CRON jobs had to be manually started after each deployment:
```bash
# Manual process (NOT desired)
pm2 reload wb-reputation
# Then manually trigger CRON start... (how? separate process? API call?)
```

### Requirements

1. CRON jobs must start automatically on server boot
2. CRON jobs must re-initialize after each deployment (PM2 reload)
3. No manual intervention required
4. Must work with PM2 cluster mode (2 instances)
5. Must be environment-aware (different schedules for dev/prod)

---

## Decision

**We will use Next.js 14's `instrumentation.ts` hook to initialize CRON jobs automatically.**

### Implementation

**File:** [instrumentation.ts](../../instrumentation.ts)

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[INSTRUMENTATION] 🚀 Server starting, initializing cron jobs...');

    const { initializeServer } = await import('./src/lib/init-server');
    initializeServer();

    console.log('[INSTRUMENTATION] ✅ Cron jobs initialized successfully');
  }
}
```

**Configuration:** [next.config.mjs](../../next.config.mjs)

```javascript
const nextConfig = {
  experimental: {
    instrumentationHook: true,  // Enable instrumentation
  },
};
```

---

## Considered Alternatives

### Alternative 1: Separate CRON Process with PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'wb-reputation',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2,
    },
    {
      name: 'wb-reputation-cron',  // Separate CRON process
      script: 'src/lib/cron-worker.js',
      instances: 1,
    }
  ]
};
```

**Pros:**
- Clear separation of concerns
- CRON runs in isolated process
- Easier to debug CRON-specific issues

**Cons:**
- ❌ Two processes to manage
- ❌ More complex deployment (need to start both)
- ❌ Need separate health checks
- ❌ CRON process can't access Next.js API routes directly
- ❌ Duplicate environment loading

**Rejected:** Too much operational complexity for our use case.

---

### Alternative 2: API Route Trigger on Startup

```typescript
// src/app/api/cron/init/route.ts
export async function POST(request: NextRequest) {
  startDailyReviewSync();
  return NextResponse.json({ success: true });
}
```

Then call from deployment script:
```bash
pm2 reload wb-reputation
sleep 5  # Wait for server to start
curl -X POST http://localhost:3000/api/cron/init
```

**Pros:**
- Uses existing API infrastructure
- Easy to trigger manually for testing

**Cons:**
- ❌ Requires deployment script modification
- ❌ Race condition: API might not be ready when called
- ❌ Requires authentication (or creates security hole if unauthenticated)
- ❌ Not automatic (forgot to call? CRON won't start)
- ❌ Doesn't work with PM2 cluster (which instance to call?)

**Rejected:** Too fragile, not truly automatic.

---

### Alternative 3: PM2 Ecosystem Hooks

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'wb-reputation',
    script: 'node_modules/next/dist/bin/next',
    post_update: ['npm run init-cron'],  // PM2 hook
  }]
};
```

**Pros:**
- PM2-native solution
- Runs after deployment

**Cons:**
- ❌ `post_update` hook not reliable in all PM2 versions
- ❌ Doesn't run on server boot (only on `pm2 reload`)
- ❌ Requires separate script file
- ❌ Hard to debug (PM2 hook errors are opaque)

**Rejected:** Unreliable, doesn't cover all startup scenarios.

---

### Alternative 4: Custom Server with Express

```typescript
// server.js
const express = require('express');
const next = require('next');
const { startDailyReviewSync } = require('./src/lib/cron-jobs');

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Initialize CRON on server start
  startDailyReviewSync();

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(3000);
});
```

**Pros:**
- Full control over server lifecycle
- Easy to add custom middleware
- CRON starts exactly when server is ready

**Cons:**
- ❌ Breaks Next.js built-in optimizations
- ❌ More boilerplate code to maintain
- ❌ Have to manually handle Edge runtime vs Node.js
- ❌ Loses Next.js 14+ features (Turbopack, etc.)

**Rejected:** Overkill, breaks Next.js conventions.

---

## Consequences

### Positive

✅ **Zero manual intervention:** CRON jobs start automatically on every deployment
✅ **PM2 cluster compatible:** Each PM2 instance initializes, but CRON has concurrency protection
✅ **Next.js native:** Uses official Next.js API (instrumentation hook)
✅ **Environment-aware:** Automatically uses correct schedule (dev vs prod)
✅ **Simple deployment:** `pm2 reload wb-reputation` → CRON auto-starts
✅ **Easy to debug:** Clear log messages in PM2 logs
✅ **Idempotent:** Can be called multiple times safely (initialization guard)

### Negative

⚠️ **Experimental API:** `instrumentationHook` is still experimental in Next.js 14
⚠️ **PM2 cluster duplication:** Each PM2 instance runs `instrumentation.ts` (but we handle this with concurrency protection)
⚠️ **Not obvious:** Developers might not know where CRON starts (needs documentation)

### Mitigation

**For experimental API:**
- Next.js 14 has stable instrumentation (not truly experimental anymore)
- If removed in future, we can switch to Alternative 4 (custom server)

**For PM2 cluster duplication:**
```typescript
// src/lib/cron-jobs.ts
const runningJobs: { [jobName: string]: boolean } = {};

cron.schedule('...', async () => {
  if (runningJobs[jobName]) {
    console.log('[CRON] Already running, skipping');
    return;  // Prevent concurrent execution
  }
  runningJobs[jobName] = true;
  // ... job logic ...
});
```

**For discoverability:**
- Documented in [CRON_JOBS.md](../CRON_JOBS.md)
- Clear log messages: `[INSTRUMENTATION]`, `[INIT]`, `[CRON]`
- This ADR explains the decision

---

## Verification

After implementing this decision:

```bash
# 1. Deploy to production
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cd /var/www/wb-reputation && bash deploy/update-app.sh"

# 2. Check logs for auto-initialization
pm2 logs wb-reputation | grep -E "INSTRUMENTATION|INIT|CRON"

# Expected output:
# [INSTRUMENTATION] 🚀 Server starting, initializing cron jobs...
# [INIT] 🚀 Initializing server at 2026-01-14T...
# [CRON] Scheduling daily review sync: 0 5 * * *
# [CRON] ✅ Daily review sync job started successfully
# [INSTRUMENTATION] ✅ Cron jobs initialized successfully
```

**Result:** ✅ CRON jobs start automatically, no manual intervention needed.

---

## Related Decisions

- [ADR-002: Active Stores Filter](./ADR-002-active-stores-filter.md) - Why we filter stores by status
- [ADR-003: CRON Intervals](./ADR-003-cron-intervals.md) - Why 5 min dev, daily prod

---

## References

- **Next.js Instrumentation Docs:** https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
- **Implementation:** [instrumentation.ts](../../instrumentation.ts)
- **CRON Jobs:** [src/lib/cron-jobs.ts](../../src/lib/cron-jobs.ts)
- **Server Init:** [src/lib/init-server.ts](../../src/lib/init-server.ts)

---

**Last Updated:** 2026-01-15
