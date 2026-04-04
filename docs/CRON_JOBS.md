# CRON Jobs Documentation - WB Reputation Manager

**Last Updated:** 2026-03-14
**Architecture Update:** 2026-03-14 (fork mode + health check + forceCron)

---

## CRON Architecture (Updated 2026-03-14)

### Production Architecture

**Production Architecture:**
```
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ PM2 Processes                                               в”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚ вњ… wb-reputation (fork, 1 instance)                         в”‚
в”‚    в†’ CRON: DISABLED at startup (via ENABLE_CRON_IN_MAIN_APP)в”‚
в”‚    в†’ CRON: ENABLED via POST /api/cron/trigger (forceCron)  в”‚
в”‚    в†’ Handles: HTTP requests + CRON jobs (after trigger)     в”‚
в”‚                                                              в”‚
в”‚ вњ… wb-reputation-cron (fork, 1 instance)                    в”‚
в”‚    в†’ Triggers CRON in main app via HTTP POST                в”‚
в”‚    в†’ Monitors CRON health every 5 min (auto-retrigger)     в”‚
в”‚    в†’ Does NOT run CRON jobs itself                          в”‚
в”‚                                                              в”‚
в”‚ вњ… wb-reputation-tg-bot (fork, 1 instance)                  в”‚
в”‚    в†’ Telegram bot long-polling                              в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
```

### CRON Trigger Flow

```mermaid
sequenceDiagram
    participant PM2
    participant MainApp as wb-reputation (fork)
    participant CronMgr as wb-reputation-cron

    PM2->>MainApp: start
    MainApp->>MainApp: instrumentation.ts в†’ initializeServer()
    Note over MainApp: initialized=true, cronJobsStarted=false

    PM2->>CronMgr: start
    CronMgr->>CronMgr: waitForServer(3s)
    CronMgr->>MainApp: POST /api/cron/trigger
    MainApp->>MainApp: initializeServer({ forceCron: true })
    Note over MainApp: cronJobsStarted=true, 11 jobs started
    MainApp-->>CronMgr: { cronRunning: true }

    loop Every 5 minutes
        CronMgr->>MainApp: GET /api/cron/trigger
        alt cronRunning: true
            MainApp-->>CronMgr: Health OK
        else cronRunning: false (app restarted)
            MainApp-->>CronMgr: cronRunning: false
            CronMgr->>MainApp: POST /api/cron/trigger (re-trigger)
        end
    end
```

### Key Invariants (NEVER violate)

1. **CRON jobs must run in EXACTLY 1 process** вЂ” the main app instance
2. `cronJobsStarted` is in-memory вЂ” lost on process restart
3. `initialized` and `cronJobsStarted` are **separate flags** (never conflate them)
4. `init-server.ts` must allow `forceCron` even if `initialized=true`
5. `start-cron.js` must have health check, not just one-shot trigger

### Two Flags in init-server.ts

```typescript
let initialized = false;      // Server startup completed (instrumentation.ts ran)
let cronJobsStarted = false;  // CRON schedulers are actually running

export function initializeServer(options?: { forceCron?: boolean }) {
  // initialized=true on first call (instrumentation.ts)
  // cronJobsStarted=true only when CRON jobs actually start
  // forceCron bypasses ENABLE_CRON_IN_MAIN_APP check
}

export function isInitialized(): boolean { return initialized; }
export function isCronRunning(): boolean { return cronJobsStarted; }
```

### On Restart / Redeploy

**`pm2 restart all`:**
1. Main app restarts в†’ `cronJobsStarted=false` (CRON dies)
2. `start-cron.js` restarts в†’ waits 3s в†’ POST trigger в†’ CRON restarts
3. Max CRON downtime: ~6 seconds

**`pm2 restart wb-reputation` (main app only):**
1. Main app restarts в†’ `cronJobsStarted=false`
2. `start-cron.js` is still running в†’ health check in max 5 min в†’ re-triggers
3. Max CRON downtime: ~5 minutes

**`pm2 restart wb-reputation-cron` (cron manager only):**
1. CRON jobs continue running in main app (unaffected)
2. `start-cron.js` restarts в†’ POST trigger в†’ sees "already running" в†’ OK
3. Max CRON downtime: 0 seconds

### Why Fork Mode (Changed 2026-03-14)

Previously main app ran in cluster mode (2 instances). This caused a critical risk:
- `cronJobsStarted` is per-instance (in-memory, not shared)
- Health check GET could hit instance without CRON в†’ sees `cronRunning: false`
- Re-trigger POST could start SECOND set of CRON jobs in the other instance

**Solution:** Switched to fork mode (1 instance). 4GB RAM is sufficient.
**Tradeoff:** No zero-downtime restarts (2-3s gap on restart).

### Verification

```bash
# Should see ONLY ONE log entry per job execution
pm2 logs wb-reputation-cron | grep "Auto-sequence"

# Health check status
curl -s localhost:3000/api/cron/trigger -H 'Authorization: Bearer API_KEY'
# в†’ { "cronRunning": true, "initialized": true }
```

**Related Documents:**
- [Sprint-007 Audit](sprints/Sprint-007-System-Health-Audit-2026-03-14/AUDIT-RESULTS.md)
- [Sprint-Emergency CRON Fix](sprints/Sprint-Emergency-CRON-Fix-2026-03-13/SPRINT-PLAN.md)

---

## Overview

WB Reputation Manager uses **automated background jobs** (CRON) to sync data from Wildberries API and generate complaints daily with **100% automation**.

**Key Features:**
- Hourly incremental review synchronization
- **Nightly full review sync** (22:00 MSK, every day) вЂ” all 12 chunks (3 years), parallel (concurrency=5)
- **Midday review catchup** (13:00 MSK, every day) вЂ” chunk 0 only, catches WB API indexing delays
- **Automatic complaint generation** immediately after sync (zero delay)
- **Template-based optimization** for empty reviews (zero AI cost)
- **AI-powered complaints** for reviews with content
- **Active products filter** - only generates complaints for active products
- **3-tier adaptive dialogue sync** вЂ” 5min (work hours), 15min (morning/evening), 60min (night)
- **OZON hybrid chat sync** вЂ” unread-only every 5min + hourly full scan safety net (9:00-20:00 MSK)

Jobs are managed using the `node-cron` library and initialize automatically when the Next.js server starts.

---

## Architecture

### Initialization Flow (Updated 2026-03-14)

```mermaid
graph TD
    A[PM2 starts wb-reputation] --> B[instrumentation.ts]
    B --> C["initializeServer()"]
    C --> D{"ENABLE_CRON_IN_MAIN_APP?"}
    D -->|"false (production)"| E["initialized=true, CRON OFF"]
    D -->|"true (local dev)"| F["Start all CRON jobs"]

    G[PM2 starts wb-reputation-cron] --> H[scripts/start-cron.js]
    H --> I[Wait for server ready]
    I --> J["POST /api/cron/trigger"]
    J --> K["initializeServer({ forceCron: true })"]
    K --> F
    F --> L["cronJobsStarted=true"]

    H --> M["setInterval(healthCheck, 5min)"]
    M --> N["GET /api/cron/trigger"]
    N --> O{"cronRunning?"}
    O -->|true| P["Health OK"]
    O -->|false| J
```

**Key Files:**
- [instrumentation.ts](../instrumentation.ts) - Next.js hook (startup, sets `initialized=true`)
- [src/lib/init-server.ts](../src/lib/init-server.ts) - Two flags: `initialized` + `cronJobsStarted`, `forceCron` option
- [src/app/api/cron/trigger/route.ts](../src/app/api/cron/trigger/route.ts) - POST triggers CRON, GET checks health
- [scripts/start-cron.js](../scripts/start-cron.js) - CRON process manager with health check + auto-retrigger
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) - CRON job definitions (11 active jobs)

---

## CRON Jobs

### 0. OZON Hybrid Chat Sync (Unread-Only + Hourly Full Scan)

OZON chat sync uses a **two-tier strategy** to maximize speed while ensuring no messages are missed:

**Tier 1 вЂ” Fast unread-only scan (every 5 min via adaptive dialogue sync):**
- Calls `getChatList(unread_only=true)` в†’ returns 0-20 chats with new buyer messages
- Processes only those chats (getChatHistory + AI classification)
- Completes in seconds instead of 5 minutes

**Tier 2 вЂ” Hourly full scan (safety net):**
- Calls `getChatList()` for ALL 156K+ OPENED chats
- Needed because: if a seller reads a chat in OZON dashboard before R5 syncs,
  it loses its "unread" flag and would be missed by Tier 1
- Uses incremental skip (`ozon_last_message_id`) вЂ” only actually processes changed chats
- Runs **9:00-20:00 MSK**, all days including weekends

**Job Name:** `ozon-hourly-full-sync`
**Schedule:**
- **Production:** `0 6-17 * * *` (every hour 9:00-20:00 MSK = 6:00-17:00 UTC)
- **Development:** `*/20 * * * *` (every 20 minutes)

**Source:** [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) вЂ” `syncStoreDialoguesFull()` + `startOzonHourlyFullSync()`

**API endpoint called:** `POST /api/stores/{storeId}/dialogues/update?fullScan=true`

**Expected output (full scan):**
```
[CRON] рџ”Ќ Starting OZON hourly full scan at 2026-02-17T06:00:00.000Z
[CRON] Found 1 OZON stores to full-scan
[OZON-CHATS] Starting chat sync for store xxx (mode: FULL SCAN)
[OZON-CHATS] Found 156864 BUYER_SELLER chats (FULL SCAN)
[OZON-CHATS] Seeded 0 chats, skipped 156863 unchanged, processed 1 new
[CRON] вњ… Full scan HANIBANI: OZON chats synced: 1 processed
[CRON] Stores: 1/1 success, 0 errors
```

---

### 1. Hourly Review Sync + Auto-Complaint Generation (100% Automation)

**Job Name:** `hourly-review-sync`
**Schedule:**
- **Production:** `0 * * * *` (every hour, on the hour)
- **Development:** `*/5 * * * *` (every 5 minutes)

**What It Does:**
1. Fetches all **active** stores from database
2. For each store:
   - Calls incremental review sync API (3-hour overlap window to catch WB indexing delays)
   - **Immediately generates complaints for new reviews** (only for active products)
   - Uses template-based complaints for empty reviews (zero AI cost)
   - Uses AI for reviews with text content
3. Waits 2 seconds between stores (rate limiting)
4. **Retries failed stores once** after main loop (handles transient WB API 429/timeouts)
5. Logs success/error counts + complaint generation stats

**Source:** [src/lib/cron-jobs.ts:51-121](../src/lib/cron-jobs.ts#L51-L121)

**Example Output:**
```
========================================
[CRON] рџљЂ Starting daily review sync at 2026-01-16T05:00:00.000Z
========================================

[CRON] Found 43 stores to sync
[CRON] Starting review sync for store: РўР°Р№РґРё Р¦РµРЅС‚СЂ (UiLCn5HyzRPphSRvR11G)
[CRON] вњ… Successfully synced reviews for РўР°Р№РґРё Р¦РµРЅС‚СЂ: Synced 150 new reviews
[CRON] Starting auto-complaint generation for РўР°Р№РґРё Р¦РµРЅС‚СЂ...
[CRON] Found 42 reviews needing complaints for РўР°Р№РґРё Р¦РµРЅС‚СЂ
[CRON] вњ… Generated complaints for РўР°Р№РґРё Р¦РµРЅС‚СЂ: 42 total (18 templates, 24 AI), 0 failed
...
========================================
[CRON] вњ… Daily review sync + complaint generation completed
[CRON] Duration: 284s
[CRON] Stores synced: 43/43
[CRON] Errors: 0
[CRON] Complaints generated: 512 total
[CRON]   - Templates: 201 (zero cost)
[CRON]   - AI generated: 311
[CRON]   - Failed: 3
========================================
```

---

## Automated Complaint Generation

### How It Works

The CRON job now includes **automatic complaint generation** immediately after each store's review sync:

1. **Review Sync** - Fetch new reviews from Wildberries API
2. **Find Reviews Without Complaints** - Query database for reviews without complaints (rating в‰¤3, active products only)
3. **Smart Generation:**
   - **Empty reviews** (no text, pros, cons) в†’ Use template complaint (0 tokens, instant)
   - **Reviews with content** в†’ Generate AI complaint via Deepseek API
4. **Save to Database** - Store complaint with status `draft`

### Template-Based Optimization

**Purpose:** Save AI tokens and cost for empty reviews

**Criteria for Template Usage:**
- Review has NO text
- Review has NO pros
- Review has NO cons
- Review rating is 1-2 stars

**Template Complaint:**
```
РћС‚Р·С‹РІ СЃРѕРґРµСЂР¶РёС‚ С‚РѕР»СЊРєРѕ С‡РёСЃР»РѕРІСѓСЋ РѕС†РµРЅРєСѓ Р±РµР· РєР°РєРѕРіРѕ-Р»РёР±Рѕ С‚РµРєСЃС‚РѕРІРѕРіРѕ РѕРїРёСЃР°РЅРёСЏ...
[Full template text]
```

**Reason:** `11 - РћС‚Р·С‹РІ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє С‚РѕРІР°СЂСѓ`

**Cost Savings:**
- AI cost: ~$0.0005-0.001 per complaint
- Template cost: **$0** (zero tokens)
- Estimated 30-40% of reviews use templates

**Source:** [src/ai/utils/complaint-templates.ts](../src/ai/utils/complaint-templates.ts)

### Active Products Filter

Only generates complaints for reviews on **active products** (`is_active = true`).

**Why?** Inactive products cannot receive complaints on Wildberries, so we avoid wasting tokens.

**Implementation:** [src/db/helpers.ts:1796-1842](../src/db/helpers.ts#L1796-L1842)

```typescript
export async function getReviewsWithoutComplaints(
  storeId: string,
  maxRating: number = 3,
  limit: number = 50,
  activeProductsOnly: boolean = true
): Promise<string[]>
```

### Enhanced Logging

**AI Input Logging:**
```
[AI INPUT] Generating complaint for review: {
  reviewId: 'abc123',
  rating: 1,
  hasText: false,
  hasPros: false,
  hasCons: false,
  textLength: 0
}
```

**Template Usage Logging:**
```
[TEMPLATE] Using template for empty review (zero AI cost)
[TEMPLATE] Review abc123: rating=1, text=empty, pros=empty, cons=empty
```

**AI Response Logging:**
```
[AI RAW RESPONSE] Review abc123: РћС‚Р·С‹РІ СЃРѕРґРµСЂР¶РёС‚ РЅРµСЃРѕРѕС‚РІРµС‚СЃС‚РІРёРµ...
```

---

## Configuration

### Schedules

Configured in [src/lib/cron-jobs.ts:54-56](../src/lib/cron-jobs.ts#L54-L56):

```typescript
const cronSchedule = process.env.NODE_ENV === 'production'
  ? '0 * * * *'      // Every hour (incremental)
  : '*/5 * * * *';   // Every 5 minutes for testing
```

**Why 5 minutes in dev?**
Full sync cycle takes ~4 minutes for 43 stores. This prevents job overlap (concurrent execution protection is built-in).

### Store Filtering

Only **active** stores are synced. This filter was added to reduce load:

**Source:** [src/db/helpers.ts:370-376](../src/db/helpers.ts#L370-L376)

```typescript
export async function getAllStores(): Promise<Store[]> {
  // Only return active stores for CRON jobs
  const result = await query<Store>(
    "SELECT * FROM stores WHERE status = 'active' ORDER BY name"
  );
  return result.rows;
}
```

**Impact:** Reduced from 49 в†’ 43 stores (-12% load reduction)

---

## How CRON Auto-Start Works (Updated 2026-03-14)

### Production: HTTP Trigger + Health Check

CRON jobs run inside the main Next.js process (`wb-reputation`), but are **triggered remotely** by the `wb-reputation-cron` manager process via HTTP.

**Step 1 вЂ” Main app starts (CRON OFF):**
1. PM2 starts `wb-reputation` (fork mode, 1 instance)
2. `instrumentation.ts` в†’ `initializeServer()` в†’ `initialized=true`
3. `ENABLE_CRON_IN_MAIN_APP` is NOT set в†’ CRON stays OFF
4. `cronJobsStarted` remains `false`

**Step 2 вЂ” CRON manager triggers (CRON ON):**
1. PM2 starts `wb-reputation-cron` в†’ `scripts/start-cron.js`
2. Waits for main app to be ready (up to 60s)
3. `POST /api/cron/trigger` в†’ `initializeServer({ forceCron: true })`
4. Main app starts all 11 CRON jobs в†’ `cronJobsStarted=true`

**Step 3 вЂ” Health monitoring (auto-recovery):**
1. Every 5 minutes: `GET /api/cron/trigger` в†’ checks `cronRunning`
2. If `cronRunning: false` (e.g. main app restarted) в†’ re-triggers via POST
3. 10 consecutive failures в†’ `process.exit(1)` в†’ PM2 restarts cron manager

**Code:** [src/lib/init-server.ts](../src/lib/init-server.ts)
```typescript
let initialized = false;
let cronJobsStarted = false;

export function initializeServer(options?: { forceCron?: boolean }) {
  if (initialized && (!options?.forceCron || cronJobsStarted)) return;
  initialized = true;

  const enableCron = options?.forceCron || process.env.ENABLE_CRON_IN_MAIN_APP === 'true';
  if (!enableCron) return; // CRON stays off

  if (cronJobsStarted) return;
  // Start all CRON jobs...
  cronJobsStarted = true;
}
```

**Health Check:** [scripts/start-cron.js](../scripts/start-cron.js)
```javascript
async function healthCheck() {
  const response = await fetch(`${baseUrl}/api/cron/trigger`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await response.json();
  if (!data.cronRunning) {
    await triggerCronJobs(); // re-trigger
  }
}
setInterval(healthCheck, 5 * 60 * 1000);
```

---

### Local Development

**Option 1: Use dedicated CRON process (recommended)**
```bash
# Terminal 1: Main app
npm run dev

# Terminal 2: CRON process
node scripts/start-cron.js
```

**Option 2: Enable CRON in main app (quick testing)**
```bash
# .env.local
ENABLE_CRON_IN_MAIN_APP=true

npm run dev
```

вљ пёЏ **Warning:** Do NOT set `ENABLE_CRON_IN_MAIN_APP=true` in production `.env`!

### 3. CRON Job Registration

[src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) registers the job with `node-cron`:

```typescript
export function startDailyReviewSync() {
  const job = cron.schedule('0 5 * * *', async () => {
    // Job logic here
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] вњ… Daily review sync job started successfully');

  return job;
}
```

---

## Deployment Impact (Updated 2026-03-14)

### Does CRON Auto-Start After Deployment?

**YES, automatically.** The `wb-reputation-cron` process handles triggering and recovery.

**What Happens on `pm2 restart all`:**

1. Main app restarts в†’ `cronJobsStarted=false` (CRON dies)
2. `wb-reputation-cron` restarts в†’ waits 3s в†’ POST trigger в†’ CRON restarts
3. Max CRON downtime: ~6 seconds

**Verification After Deploy:**
```bash
# 1. All processes online
pm2 list

# 2. CRON triggered
pm2 logs wb-reputation-cron --lines 20 --nostream | grep "CRON"
# Should see: "CRON jobs triggered!"

# 3. Health check
curl -s localhost:3000/api/cron/trigger -H 'Authorization: Bearer API_KEY'
# Should see: { "cronRunning": true }

# 4. CRON jobs running in main app
pm2 logs wb-reputation --lines 50 --nostream | grep "CRON"
# Should see: "Starting CRON jobs via /api/cron/trigger"
```

**No manual intervention required** вЂ” health check auto-recovers within 5 minutes

---

## Concurrent Execution Protection

CRON jobs have built-in protection against overlapping runs:

```typescript
const runningJobs: { [jobName: string]: boolean } = {};

cron.schedule('...', async () => {
  const jobName = 'daily-review-sync';

  // Prevent concurrent runs
  if (runningJobs[jobName]) {
    console.log('[CRON] вљ пёЏ  Job already running, skipping this trigger');
    return;
  }

  runningJobs[jobName] = true;
  try {
    // ... job logic ...
  } finally {
    runningJobs[jobName] = false;
  }
});
```

**Why This Matters:**
- Dev mode runs every 5 minutes
- Full sync takes ~4 minutes
- Protection prevents 2 jobs running simultaneously

---

## Monitoring CRON Jobs (Updated 2026-03-14)

### Check CRON Initialization (Production)

```bash
# SSH into server
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.139.99

# View CRON manager logs
pm2 logs wb-reputation-cron --lines 30 --nostream

# View main app CRON logs
pm2 logs wb-reputation --lines 50 --nostream | grep -E "\[INIT\]|\[CRON\]"

# Health check via API
curl -s localhost:3000/api/cron/trigger -H 'Authorization: Bearer API_KEY'
```

**Expected Output (wb-reputation-cron):**
```
[START-CRON] CRON process manager starting...
[START-CRON] Server is ready
[START-CRON] POST http://localhost:3000/api/cron/trigger
[START-CRON] Response: {"cronRunning":true}
[START-CRON] CRON jobs triggered!
[START-CRON] Health check every 300s
[START-CRON] Health OK: CRON running | 2026-03-14T09:00:00.000Z
```

**Expected Output (wb-reputation main app):**
```
[INIT] Initializing server at 2026-03-14T08:33:00.000Z
[INIT] CRON jobs DISABLED in main app (waiting for /api/cron/trigger)
[API CRON TRIGGER] CRON trigger requested
[INIT] Starting CRON jobs via /api/cron/trigger (dedicated process)
[CRON] Daily review sync job started successfully
[CRON] Auto-sequence processor job started
[CRON] Resolved-review closer job started
...
[INIT] CRON jobs started successfully
```

### Monitor CRON Execution

```bash
# Watch CRON process logs in real-time
pm2 logs wb-reputation-cron

# Filter only CRON execution logs
pm2 logs wb-reputation-cron | grep "\[CRON\]"

# Check specific job execution
pm2 logs wb-reputation-cron --lines 500 | grep "Auto-sequence"

# Check for errors
pm2 logs wb-reputation-cron --err --lines 100
```

### Verify No Duplicates

```bash
# Run audit script
cd /var/www/wb-reputation
node scripts/AUDIT-check-duplicate-sends.mjs

# Expected output:
# вњ… No duplicate messages found
# вњ… No duplicate active sequences
# вњ… No rapid sends detected
```

### Check Job Status (API Endpoint)

**Endpoint:** `GET /api/cron/status`

```bash
curl -X GET "http://158.160.139.99/api/cron/status" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
```

**Response:**
```json
{
  "totalJobs": 1,
  "runningJobs": [],
  "allJobs": [
    {
      "name": "daily-review-sync",
      "running": true
    }
  ]
}
```

---

## Manual CRON Trigger (Development)

For testing, you can trigger sync manually:

```bash
# Incremental sync for one store
curl -X POST "http://localhost:9002/api/stores/{storeId}/reviews/update?mode=incremental" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Full sync for one store (use cautiously)
curl -X POST "http://localhost:9002/api/stores/{storeId}/reviews/update?mode=full" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
```

**Note:** There's no dedicated "trigger all stores now" endpoint. CRON job handles this automatically.

---

## Troubleshooting

### рџљЁ Duplicate Auto-Sequence Sends (NEW - Added 2026-03-13)

**Symptom:** Clients receive same auto-sequence message 2-3 times within minutes

**Root Cause:** CRON running in multiple processes simultaneously:
- 2Г— main app instances (cluster mode) + 1Г— cron process = 3Г— sends

**Diagnostic:**
```bash
# Check how many times auto-sequence ran
pm2 logs wb-reputation-cron --lines 200 | grep -A 2 "Auto-sequence"

# вќЊ BAD: See 3 entries at same timestamp
[CRON] рџ“Ё Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors
[CRON] рџ“Ё Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors
[CRON] рџ“Ё Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors

# вњ… GOOD: See 1 entry
[CRON] рџ“Ё Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors
```

**Fix:**
1. **Verify CRON disabled in main app:**
   ```bash
   # Should show "CRON jobs DISABLED"
   pm2 logs wb-reputation --lines 50 | grep "CRON jobs"
   ```

2. **Check environment variable:**
   ```bash
   # Should NOT see ENABLE_CRON_IN_MAIN_APP=true
   pm2 env 0 | grep ENABLE_CRON
   ```

3. **If duplicates still occur:**
   ```bash
   # Emergency stop all sequences
   cd /var/www/wb-reputation
   node scripts/EMERGENCY-stop-auto-sequences.mjs

   # Restart CRON process
   pm2 restart wb-reputation-cron

   # Wait 30 min, verify single execution
   pm2 logs wb-reputation-cron | grep "Auto-sequence"
   ```

4. **Audit for damage:**
   ```bash
   node scripts/AUDIT-check-duplicate-sends.mjs
   ```

---

### CRON Jobs Not Starting

**Symptom:** No `[CRON]` logs after server restart

**Check (in order):**
```bash
# 1. All processes online?
pm2 list

# 2. CRON manager triggered successfully?
pm2 logs wb-reputation-cron --lines 20 --nostream | grep -E "triggered|failed|Health"

# 3. Health check API
curl -s localhost:3000/api/cron/trigger -H 'Authorization: Bearer API_KEY'
# в†’ { "cronRunning": true } = OK
# в†’ { "cronRunning": false } = CRON not running, check main app logs

# 4. Main app CRON status
pm2 logs wb-reputation --lines 50 --nostream | grep -E "\[INIT\]|\[CRON\]"
```

**If CRON not running:**
```bash
# Restart CRON manager (will re-trigger)
pm2 restart wb-reputation-cron

# Or restart everything
pm2 restart all
```

**If processes not in PM2:**
```bash
cd /var/www/wb-reputation
pm2 start ecosystem.config.js
pm2 save
```

### CRON Job Running But Failing

**Symptom:** `[CRON] вќЊ Failed to sync reviews`

**Common Causes:**
1. **Database connection issues**
   ```bash
   # Test DB connection
   PGPASSWORD="$POSTGRES_PASSWORD" psql \
     -h rc1a-xxx.mdb.yandexcloud.net \
     -p 6432 \
     -U admin_R5 \
     -d wb_reputation \
     -c "SELECT COUNT(*) FROM stores WHERE status='active';"
   ```

2. **API authentication issues**
   ```bash
   # Verify API key in environment
   pm2 env 0 | grep API_KEY

   # Test API endpoint
   curl -X GET "http://localhost:3000/api/stores" \
     -H "Authorization: Bearer $API_KEY"
   ```

3. **WB API rate limiting**
   - Check logs for HTTP 429 errors
   - Increase delay between stores (currently 2 seconds)
   - Modify in [src/lib/cron-jobs.ts:92](../src/lib/cron-jobs.ts#L92)

### Job Runs But No Reviews Synced

**Check:**
1. Store has `status = 'active'` in database
2. Store has valid WB API tokens
3. Store actually has new reviews on Wildberries

```sql
-- Check store configuration
SELECT id, name, status, total_reviews, last_review_sync_at
FROM stores
WHERE status = 'active';
```

---

## Adding New CRON Jobs

### Example: Daily Chat Sync

**1. Add job function in `src/lib/cron-jobs.ts`:**

```typescript
export function startDailyChatSync() {
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 6 * * *'      // 9:00 AM MSK daily (1 hour after reviews)
    : '*/10 * * * *';  // Every 10 minutes for testing

  console.log(`[CRON] Scheduling daily chat sync: ${cronSchedule}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'daily-chat-sync';

    if (runningJobs[jobName]) {
      console.log(`[CRON] вљ пёЏ  Job ${jobName} already running, skipping`);
      return;
    }

    runningJobs[jobName] = true;
    try {
      console.log('[CRON] рџљЂ Starting daily chat sync');

      const stores = await dbHelpers.getAllStores();

      for (const store of stores) {
        // Call chat sync API
        await fetch(`${baseUrl}/api/stores/${store.id}/dialogues/update`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('[CRON] вњ… Daily chat sync completed');
    } catch (error) {
      console.error('[CRON] вќЊ Chat sync failed:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] вњ… Daily chat sync job started');

  return job;
}
```

### Telegram Notification Hook

Dialogue sync includes a **non-blocking hook** (Step 5a-tg) that sends Telegram push notifications:

1. After processing `latestMessagesPerChat`, collects all chats where `sender === 'client'`
2. Calls `sendTelegramNotifications(storeId, clientReplyChats)`
3. For each chat:
   - Finds TG user linked to store owner
   - Checks dedup (no duplicate within 1 hour)
   - Sends formatted push with inline "Open chat" button
4. Batching: 1-5 individual pushes, 6+ grouped summary

**Non-blocking:** Wrapped in try/catch, errors logged but don't affect sync.

**Source:** `src/lib/telegram-notifications.ts`

**2. Register in `src/lib/init-server.ts`:**

```typescript
import { startDailyReviewSync, startDailyChatSync } from './cron-jobs';

export function initializeServer() {
  // ... existing code ...

  console.log('[INIT] Starting cron jobs...');
  startDailyReviewSync();
  startDailyChatSync();  // Add new job

  // ... rest of code ...
}
```

**3. Deploy and verify:**

```bash
# Deploy to production
bash deploy/update-app.sh

# Check logs for new job initialization
pm2 logs wb-reputation | grep "chat sync"
```

---

## CRON Schedule Reference

### Syntax

```
* * * * *
в”¬ в”¬ в”¬ в”¬ в”¬
в”‚ в”‚ в”‚ в”‚ в”‚
в”‚ в”‚ в”‚ в”‚ в””в”Ђв”Ђв”Ђ day of week (0 - 7) (Sunday=0 or 7)
в”‚ в”‚ в”‚ в””в”Ђв”Ђв”Ђв”Ђв”Ђ month (1 - 12)
в”‚ в”‚ в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ day of month (1 - 31)
в”‚ в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ hour (0 - 23)
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ minute (0 - 59)
```

### Common Patterns

| Schedule | Description |
|----------|-------------|
| `0 5 * * *` | Daily at 8:00 AM MSK (5:00 UTC) |
| `0 6 * * *` | Daily at 9:00 AM MSK (6:00 UTC) |
| `*/5 * * * *` | Every 5 minutes |
| `*/30 * * * *` | Every 30 minutes |
| `0 */2 * * *` | Every 2 hours |
| `0 0 * * 0` | Every Sunday at midnight |
| `0 0 1 * *` | First day of every month |

### Timezone Handling

All schedules use **UTC timezone** (configured in `node-cron`).

**MSK (Moscow Time) = UTC+3**

| MSK Time | UTC Time | CRON Schedule |
|----------|----------|---------------|
| 8:00 AM | 5:00 AM | `0 5 * * *` |
| 9:00 AM | 6:00 AM | `0 6 * * *` |
| 12:00 PM | 9:00 AM | `0 9 * * *` |

---

## Performance Considerations

### Current Load (Production)

- **43 active stores**
- **~2 seconds per store** (API call + delay)
- **Total duration:** ~86 seconds (~1.5 minutes)
- **Runs once daily at 8:00 AM MSK**

### Scaling Considerations

If you add more stores or jobs:

1. **Increase delay between stores** (avoid WB API rate limits)
2. **Stagger job schedules** (don't run all at same time)
3. **Monitor PM2 memory usage** (`pm2 monit`)
4. **Consider queue system** (for 100+ stores, use Bull/BullMQ)

### Resource Usage

```bash
# Check memory/CPU during CRON execution
pm2 monit

# Check process stats
pm2 show wb-reputation
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Check CRON initialization | `pm2 logs wb-reputation-cron \| grep CRON` (changed 2026-03-13) |
| View CRON execution logs | `pm2 logs wb-reputation-cron \| grep "Auto-sequence"` |
| Restart CRON process | `pm2 restart wb-reputation-cron` |
| Test job manually | Trigger API endpoint directly |
| Check job schedule | View `src/lib/cron-jobs.ts` |
| Check duplicate sends | `node scripts/AUDIT-check-duplicate-sends.mjs` |
| Emergency stop sequences | `node scripts/EMERGENCY-stop-auto-sequences.mjs` |

---

## Emergency Scripts (Added 2026-03-13)

### 1. EMERGENCY-stop-auto-sequences.mjs

**Purpose:** Immediately stop all active auto-sequences and transition chats to safe state.

**Usage:**
```bash
cd /var/www/wb-reputation
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

**What It Does:**
1. Finds all active sequences (`status = 'active'`)
2. Sets `status = 'stopped'`, `stop_reason = 'emergency_stop_YYYY-MM-DD'`
3. Transitions chats from `awaiting_reply` в†’ `inbox` or `in_progress` (based on existing `tag`)
4. Logs affected chat IDs and sequences

**When to Use:**
- Duplicate sends detected
- CRON malfunction
- Need to pause all automation immediately

**Source:** [scripts/EMERGENCY-stop-auto-sequences.mjs](../scripts/EMERGENCY-stop-auto-sequences.mjs)

**Example Output:**
```
рџљЁ EMERGENCY: Stopping all active auto-sequences

Found 2,075 active sequences to stop
вњ… Stopped 2,075 sequences
вњ… Updated chat statuses:
   - awaiting_reply в†’ inbox: 1,200 chats
   - awaiting_reply в†’ in_progress: 875 chats

Stop reason: emergency_stop_2026-03-13
All sequences stopped successfully!
```

---

### 2. AUDIT-check-duplicate-sends.mjs

**Purpose:** Audit database for duplicate message sends and active sequences.

**Usage:**
```bash
cd /var/www/wb-reputation
node scripts/AUDIT-check-duplicate-sends.mjs
```

**What It Checks:**
1. **Duplicate messages** - same chat, sender, text within 30 minutes
2. **Duplicate active sequences** - multiple active sequences for same chat
3. **Rapid sends** - auto-sequence messages sent <5 minutes apart
4. **Stale processing locks** - sequences stuck in processing state

**Source:** [scripts/AUDIT-check-duplicate-sends.mjs](../scripts/AUDIT-check-duplicate-sends.mjs)

**Example Output:**
```
рџ”Ќ Auditing for duplicate auto-sequence sends...

вњ… No duplicate messages found in last 24 hours
вњ… No duplicate active sequences found
вњ… No rapid sends detected (all в‰Ґ5min apart)
вљ пёЏ  Found 2 stale processing locks (released)

Audit complete!
```

---

### 3. Database Migration 999 (Emergency Protection)

**Applied:** 2026-03-13 during emergency deployment

**What It Created:**

1. **UNIQUE INDEX:** `idx_unique_active_sequence_per_chat`
   - Prevents multiple active sequences for same chat at database level
   - Constraint: `(chat_id) WHERE status = 'active'`

2. **Helper Function:** `start_auto_sequence_safe()`
   - Safe wrapper for creating sequences
   - Automatically stops existing active sequence before creating new one
   - Usage: `SELECT start_auto_sequence_safe($1, $2, $3, $4, $5, $6, $7);`

3. **Monitoring View:** `v_duplicate_sequences`
   - Shows chats with multiple active sequences (should always return 0 rows)
   - Query: `SELECT * FROM v_duplicate_sequences;`

**Migration File:** [migrations/999_emergency_prevent_duplicate_sequences.sql](../migrations/999_emergency_prevent_duplicate_sequences.sql)

**Verification:**
```sql
-- Should return 0 rows (no duplicates)
SELECT * FROM v_duplicate_sequences;

-- Check index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'chat_auto_sequences'
  AND indexname = 'idx_unique_active_sequence_per_chat';
```

---

### 4. Sequence Restart Analysis

After emergency stop (2026-03-13), 2,075 sequences were stopped.

**Distribution by current_step:**
| Step | Count | Already Sent | Next Message |
|------|-------|--------------|--------------|
| 0 | 43 | 0 messages | messages[0] (1st) |
| 1 | 706 | 1 message | messages[1] (2nd) |
| 2 | 1,007 | 2 messages | messages[2] (3rd) |
| 3 | 28 | 3 messages | messages[3] (4th) |
| 4 | 114 | 4 messages | messages[4] (5th) |
| 5 | 50 | 5 messages | messages[5] (6th) |
| 6 | 127 | 6 messages | messages[6] (7th) |

**Status:** вЏёпёЏ POSTPONED - see [SEQUENCE-RESTART-ANALYSIS.md](sprints/Sprint-Emergency-CRON-Fix-2026-03-13/SEQUENCE-RESTART-ANALYSIS.md)

**Decision:** Do NOT restart stopped sequences. Create new sequences manually from TG Mini App as needed.

**Why:**
- 85% of stopped sequences had only 0-2 messages sent (low progress)
- New sequences (20) already created post-emergency
- No risk of spam or unexpected messages to clients
- Full control over which chats get new sequences

---

---

## 6. Google Sheets Sync (Product Rules Export)

**Job Name:** `google-sheets-sync`
**Schedule:**
- **Production:** `0 3 * * *` (6:00 AM MSK / 3:00 AM UTC)
- **Development:** `*/30 * * * *` (every 30 minutes)

**What It Does:**
1. Exports all active product rules from all active stores to Google Sheets
2. Full sync strategy: clear and rewrite entire sheet on every sync
3. Provides management visibility into active stores and their configurations

**Data Exported (per row, 22 columns A-V):**
| РњР°РіР°Р·РёРЅ | РђСЂС‚РёРєСѓР» WB | РќР°Р·РІР°РЅРёРµ | РЎС‚Р°С‚СѓСЃ | Р–Р°Р»РѕР±С‹ | в­ђ1-4 | Р§Р°С‚С‹ | в­ђ1-4 | РЎС‚СЂР°С‚РµРіРёСЏ | РљРѕРјРїРµРЅСЃР°С†РёСЏ | РўРёРї | РњР°РєСЃ в‚Ѕ | РљС‚Рѕ РїР»Р°С‚РёС‚ | РћР±РЅРѕРІР»РµРЅРѕ | Р Р°Р±РѕС‚Р°РµРј РѕС‚ | РљРѕРјРјРµРЅС‚Р°СЂРёР№ |

**Columns U-V (migration 025):**
- **Column U (Р Р°Р±РѕС‚Р°РµРј РѕС‚):** Per-product cutoff date (`product_rules.work_from_date`), formatted DD.MM.YYYY. Default: 01.10.2023.
- **Column V (РљРѕРјРјРµРЅС‚Р°СЂРёР№):** Manager comment (`product_rules.comment`) from DB. Single source of truth вЂ” no manual comment preservation needed.

**Triggers:**
1. **CRON** вЂ” РµР¶РµРґРЅРµРІРЅРѕ РІ 6:00 MSK
2. **Manual API** вЂ” `POST /api/admin/google-sheets/sync`
3. **Product rules change** вЂ” async hook (non-blocking, debounced 5 sec)
4. **Product status change** вЂ” async hook (non-blocking, debounced 5 sec)
5. **Store status change** вЂ” async hook (non-blocking, debounced 5 sec)

**Debounce & Deduplication (async triggers):**
- Triggers 3-5 РёСЃРїРѕР»СЊР·СѓСЋС‚ `triggerAsyncSync()` СЃ 5-СЃРµРєСѓРЅРґРЅС‹Рј debounce
- Р•СЃР»Рё СЃРёРЅРє СѓР¶Рµ Р·Р°РїСѓС‰РµРЅ, РЅРѕРІС‹Р№ СЃС‚Р°РІРёС‚СЃСЏ РІ РѕС‡РµСЂРµРґСЊ (1 pending РјР°РєСЃРёРјСѓРј)
- 10 РёР·РјРµРЅРµРЅРёР№ Р·Р° 1 РјРёРЅСѓС‚Сѓ в†’ 1-2 СЃРёРЅРєР° РІРјРµСЃС‚Рѕ 10

**Retry (Google API):**
- Р’СЃРµ Google API РІС‹Р·РѕРІС‹ РѕР±С‘СЂРЅСѓС‚С‹ РІ `withRetry()` (3 РїРѕРїС‹С‚РєРё, exponential backoff: 1/2/4 СЃРµРє)
- РќРµ СЂРµС‚СЂР°РёС‚ 4xx РѕС€РёР±РєРё (РєСЂРѕРјРµ 429 rate limit)

**Configuration (Environment Variables):**
```bash
GOOGLE_SHEETS_SPREADSHEET_ID=1-mxbnv0qkicJMVUCtqDGJH82FhLlDKDvICb-PAVbxfI
GOOGLE_SHEETS_SHEET_NAME=РђСЂС‚РёРєСѓР»С‹ РўР—
GOOGLE_SERVICE_ACCOUNT_EMAIL=r5-automation@r5-wb-bot.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Secondary sheets (optional, 1:1 copies for СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ)
GOOGLE_SHEETS_SECONDARY_SPREADSHEET_ID=...
GOOGLE_SHEETS_SECONDARY_SHEETS=Sheet1,Sheet2  # comma-separated
```

**Important:** Share the Google Sheet with the Service Account email (role: Editor)

**Source Files:**
- [src/services/google-sheets-sync/](../src/services/google-sheets-sync/) вЂ” Sync service
- [src/services/google-sheets-sync/sheets-client.ts](../src/services/google-sheets-sync/sheets-client.ts) вЂ” Google API client (JWT auth, retry)
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) вЂ” CRON job definition
- [src/app/api/admin/google-sheets/sync/route.ts](../src/app/api/admin/google-sheets/sync/route.ts) вЂ” Manual sync API

**Example Output:**
```
========================================
[CRON] Starting Google Sheets sync at 2026-02-08T03:00:00.000Z
========================================

[GoogleSheetsSync] Starting full sync...
[GoogleSheetsSync] Target: 1-mxbnv0qkicJMVUCtqDGJH82FhLlDKDvICb-PAVbxfI / "РђСЂС‚РёРєСѓР»С‹ РўР—"
[GoogleSheetsSync] Found 5 active stores
[GoogleSheetsSync] Store "РўР°Р№РґРё Р¦РµРЅС‚СЂ": 42 active products
[GoogleSheetsSync] Store "Test Store": 15 active products
[GoogleSheetsSync] Total rows to write: 57
[GoogleSheetsSync] Preserved 12 comments from column U
[GoogleSheets] Clearing sheet "РђСЂС‚РёРєСѓР»С‹ РўР—"...
[GoogleSheets] Sheet cleared. Writing 58 rows...
[GoogleSheets] Successfully wrote 58 rows
[GoogleSheetsSync] Restored 12 comments
[GoogleSheetsSync] Sync completed in 1250ms

========================================
[CRON] Google Sheets sync completed
[CRON] Duration: 1250ms
[CRON] Stores: 5, Products: 57
[CRON] Rows written: 58
========================================
```

**Manual Trigger:**
```bash
# Check status
curl -X GET "http://localhost:9002/api/admin/google-sheets/sync"

# Trigger sync
curl -X POST "http://localhost:9002/api/admin/google-sheets/sync"
```

---

## 7. Client Directory Sync (РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ)

**Job Name:** `client-directory-sync`
**Schedule:**
- **Production:** `30 4 * * *` (7:30 AM MSK / 4:30 AM UTC вЂ” after Product Rules sync at 6:00)
- **Development:** `*/30 * * * *` (every 30 minutes)

**What It Does:**
1. Syncs all stores (active + inactive) to sheet "РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ" via **upsert** strategy
2. Updates existing rows (matched by store ID in column A)
3. Appends new rows for newly created stores
4. **Preserves INN** (СЂСѓС‡РЅРѕР№ РІРІРѕРґ, column C) вЂ” never overwritten
5. Matches stores to Google Drive folders via fuzzy name matching
6. Extracts links to report and screenshots folder from Drive

**Data Exported (per row, 13 columns A-M):**
| ID РјР°РіР°Р·РёРЅР° | РќР°Р·РІР°РЅРёРµ | РРќРќ (manual) | Р”Р°С‚Р° РїРѕРґРєР»СЋС‡РµРЅРёСЏ | РЎС‚Р°С‚СѓСЃ | API | Content API | Feedbacks API | Chat API | РџР°РїРєР° РєР»РёРµРЅС‚Р° | РћС‚С‡С‘С‚ | РЎРєСЂРёРЅС€РѕС‚С‹ | РћР±РЅРѕРІР»РµРЅРѕ |

**Triggers:**
1. **CRON** вЂ” РµР¶РµРґРЅРµРІРЅРѕ РІ 7:30 MSK
2. **Manual API** вЂ” `POST /api/admin/google-sheets/sync-clients`
3. **After store onboarding** вЂ” fire-and-forget (WB + OZON)

**Source Files:**
- [src/services/google-sheets-sync/client-directory/](../src/services/google-sheets-sync/client-directory/) вЂ” Sync service
- [src/services/google-sheets-sync/client-directory/drive-matcher.ts](../src/services/google-sheets-sync/client-directory/drive-matcher.ts) вЂ” Fuzzy folder matching
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) вЂ” CRON job definition
- [src/app/api/admin/google-sheets/sync-clients/route.ts](../src/app/api/admin/google-sheets/sync-clients/route.ts) вЂ” Manual sync API

**Manual Trigger:**
```bash
curl -X POST "http://localhost:9002/api/admin/google-sheets/sync-clients"
```

---

## Summary

**Architecture:** Single unified CRON task (8:00 AM MSK) handles both review sync AND complaint generation

**Key Improvements (2026-01-16):**
1. **100% Automation** - Complaints generated immediately after sync (zero delay)
2. **Template Optimization** - 30-40% cost savings on empty reviews
3. **Active Products Filter** - Only generates complaints for active products
4. **Enhanced Logging** - Full visibility into AI inputs, outputs, template usage

**Files Modified:**
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) - Integrated complaint generation into daily sync
- [src/lib/init-server.ts](../src/lib/init-server.ts) - Removed separate 9:00 task
- [src/db/helpers.ts](../src/db/helpers.ts) - Added active products filter
- [src/ai/utils/complaint-templates.ts](../src/ai/utils/complaint-templates.ts) - Template system
- [src/ai/flows/generate-review-complaint-flow.ts](../src/ai/flows/generate-review-complaint-flow.ts) - Template integration + logging

---

**Last Updated:** 2026-03-14

**Production CRON Jobs:**
| Job | Schedule (MSK) | Schedule (UTC) | Description |
|-----|----------------|----------------|-------------|
| Review Sync + Complaints | Every hour | 0 * * * * | Incremental review sync (WB + OZON) + auto-generate complaints + retry failed stores |
| **Nightly Full Review Sync** | **22:00 daily** | **0 19 * * *** | **WB: 12 chunks (3 years), concurrency=5; OZON: single full cursor sync** |
| **Midday Review Catchup** | **13:00 daily** | **0 10 * * *** | **WB-only, chunk 0 (last 90 days) вЂ” second daily pass to catch WB API delays** |
| Dialogue Sync | Adaptive (3-tier) | 5min work (09-18) / 15min morning-evening / 60min night | Sync chat dialogues (WB + OZON) |
| Product Sync | 7:00 AM | 0 4 * * * | Sync product catalog (WB + OZON) |
| Backfill Worker | Every 5 min | */5 * * * * | Process complaint backfill queue (BATCH=200, DAILY_LIMIT=6000) |
| Google Sheets Sync | 6:00 AM | 0 3 * * * | Export product rules to Google Sheets (22 cols A-V, clear+write, comments from DB) |
| Client Directory Sync | 7:30 AM | 30 4 * * * | Sync client directory to "РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ" (upsert, preserves INN) |
| **Auto-Sequence Processor** | Every 30 min (daytime) | */30 * * * * | Send follow-up messages (100/batch, distributed slots 10-17 MSK) |
| **Resolved-Review Closer** | Every 30 min (:15/:45) | 15,45 * * * * | Auto-close chats with resolved reviews (200/batch) |
| ~~Chat Status Transition~~ | ~~Every 30 min~~ | ~~*/30 * * * *~~ | **DISABLED (2026-02-28):** Was auto-moving `in_progress в†’ awaiting_reply` after 2 days. Disabled вЂ” sequences are now manual only |

**Non-CRON Background Process:**
| Process | Type | Description |
|---------|------|-------------|
| **CRON Manager** (`wb-reputation-cron`) | PM2 fork | Triggers CRON in main app via HTTP, monitors health every 5 min |
| **TG Bot** (`wb-reputation-tg-bot`) | PM2 fork | Telegram bot long-polling + push notifications hook in dialogue sync |

**Estimated Daily Cost Savings:** 30-40% via template optimization

---

## 8. Auto-Sequence Processor (РђРІС‚Рѕ-СЂР°СЃСЃС‹Р»РєР°)

> **РћР±РЅРѕРІР»РµРЅРѕ 2026-02-28:** Р’СЃРµ auto-launch РјРµС…Р°РЅРёР·РјС‹ СѓРґР°Р»РµРЅС‹. Р Р°СЃСЃС‹Р»РєРё Р·Р°РїСѓСЃРєР°СЋС‚СЃСЏ **С‚РѕР»СЊРєРѕ РІСЂСѓС‡РЅСѓСЋ** РёР· TG Mini App (РєРЅРѕРїРєР° "Р—Р°РїСѓСЃС‚РёС‚СЊ СЂР°СЃСЃС‹Р»РєСѓ"). РљСЂРѕРЅ `transitionStaleInProgressChats` РѕС‚РєР»СЋС‡С‘РЅ.

**Job Name:** `auto-sequence-processor`
**Schedule:** `*/30 * * * *` (every 30 minutes, UTC)
**Active hours:** 8:00-22:00 MSK only (skips nighttime)
**Batch limit:** 100 sequences per run

**Sequence types (Р°РєС‚СѓР°Р»СЊРЅС‹Рµ):**
- `no_reply_followup_30d` вЂ” negatives (1-3в…), 15 msgs every 2 days (~30 days)
- `no_reply_followup_4star_30d` вЂ” 4в… reviews, 10 msgs every 3 days (~30 days)

> Legacy: `no_reply_followup` / `no_reply_followup_4star` вЂ” СЃС‚Р°СЂР°СЏ 14-РґРЅРµРІРЅР°СЏ СЃРёСЃС‚РµРјР°.

**What It Does:**
1. Queries `chat_auto_sequences` table for active sequences where `next_send_at <= NOW()` (limit 100)
2. For each pending sequence (safety checks in order):
   a. **Client replied?** в†’ STOP sequence (`client_replied`), chat в†’ `inbox`
   b. **Review resolved?** в†’ STOP sequence (`review_resolved`) if complaint approved / review excluded / rating excluded
   c. **Chat status valid?** в†’ STOP if not `awaiting_reply` or `inbox` (`status_changed`)
   d. **Seller already sent today?** в†’ SKIP, reschedule to random slot (no step advance)
   e. **Max steps reached?** в†’ Send РЎРўРћРџ message (per `sequence_type`) + close chat (`no_reply`)
   f. Send next follow-up via WB Chat API
   g. Record in `chat_messages`, update chat, advance sequence
   h. **Audit trail (migration 027):** All status/tag changes written to `chat_status_history` with `change_source = 'cron_sequence'`, `closure_type = 'auto'`
3. Rate limits: 3 seconds between sends

**Review-resolved check (step 2b):** Before each message send, checks `isReviewResolvedForChat()`:
- `complaint_status = 'approved'` вЂ” WB accepted complaint
- `review_status_wb IN ('excluded','unpublished','temporarily_hidden','deleted')`
- `rating_excluded = true` вЂ” transparent stars

### Р—Р°РїСѓСЃРє СЂР°СЃСЃС‹Р»РѕРє (MANUAL ONLY, СЃ 2026-02-28)

Р Р°СЃСЃС‹Р»РєРё СЃРѕР·РґР°СЋС‚СЃСЏ **С‚РѕР»СЊРєРѕ РІСЂСѓС‡РЅСѓСЋ** РёР· TG Mini App:
- РњРµРЅРµРґР¶РµСЂ РѕС‚РєСЂС‹РІР°РµС‚ С‡Р°С‚ в†’ РЅР°Р¶РёРјР°РµС‚ "Р—Р°РїСѓСЃС‚РёС‚СЊ СЂР°СЃСЃС‹Р»РєСѓ"
- API: `POST /api/telegram/chats/[chatId]/sequence/start`
- РЎРѕР·РґР°С‘С‚ sequence + СЃС‚Р°РІРёС‚ `tag='deletion_candidate'`, `status='awaiting_reply'`

> **РЈРґР°Р»РµРЅРѕ:** auto-launch РёР· dialogue sync (Step 5b trigger phrase detection), auto-launch РёР· OZON sync (Step 3.5), auto-create РїСЂРё СЃРјРµРЅРµ СЃС‚Р°С‚СѓСЃР° РЅР° `awaiting_reply` РёР· РІРµР±-РґР°С€Р±РѕСЂРґР°. Р¤Р°Р№Р» `auto-sequence-launcher.ts` вЂ” dead code, РЅРµ РІС‹Р·С‹РІР°РµС‚СЃСЏ.

### Р—Р°С‰РёС‚Р° СЃС‚Р°С‚СѓСЃР° awaiting_reply

Dialogue sync РїСЂРё РѕР±РЅР°СЂСѓР¶РµРЅРёРё seller message РќР• РїРµСЂРµРІРѕРґРёС‚ `awaiting_reply` в†’ `in_progress`, РµСЃР»Рё `getActiveSequenceForChat()` РІРѕР·РІСЂР°С‰Р°РµС‚ Р°РєС‚РёРІРЅСѓСЋ СЂР°СЃСЃС‹Р»РєСѓ. Р‘РµР· СЌС‚РѕРіРѕ РєР°Р¶РґРѕРµ Р°РІС‚Рѕ-СЃРѕРѕР±С‰РµРЅРёРµ cron-Р° СЃР±СЂР°СЃС‹РІР°Р»Рѕ Р±С‹ СЃС‚Р°С‚СѓСЃ.

### Distributed Time Slots

Messages are distributed across the day using weighted time slots.

| Slot (MSK) | Weight | Share |
|------------|--------|-------|
| 10:00 | 15 | 15% |
| 11:00 | 15 | 15% |
| 12:00 | 15 | 15% |
| 13:00 | 15 | 15% |
| 14:00 | 10 | 10% |
| 15:00 | 10 | 10% |
| 16:00 | 10 | 10% |
| 17:00 | 10 | 10% |

**How it works:**
- When a sequence is created or advanced, `next_send_at` is set to a **random time** within a weighted slot
- For 30d sequences: next send = current day + interval (2 days for negatives, 3 days for 4в…)
- Random minute (0-59) within each hour for additional scatter
- Function: `getNextSlotTime(dayOffset)` in `src/lib/auto-sequence-templates.ts`

**Dry Run Mode:**
Set `AUTO_SEQUENCE_DRY_RUN=true` in environment. All safety checks run, decisions are logged, but NO messages are sent and NO database changes are made.

**Stopping Conditions:**
- Client replied (detected in dialogue sync and in cron job)
- Review resolved (complaint approved / review excluded вЂ” checked before each send)
- Chat status changed away from `awaiting_reply`/`inbox` (checked in cron)
- Seller already sent a message today (skip + reschedule, not stop)
- All messages sent в†’ РЎРўРћРџ message + close (for base sequences only; funnel sequences just stop)

**Sequence Types (as of 2026-03-01):**

| sequence_type | Msgs | Period | Tag | Purpose |
|---|---|---|---|---|
| `no_reply_followup_30d` | 15 | ~30 РґРЅРµР№ | `deletion_candidate` | Р‘Р°Р·РѕРІР°СЏ СЂР°СЃСЃС‹Р»РєР° (1-3в…) |
| `no_reply_followup_4star_30d` | 10 | ~30 РґРЅРµР№ | `deletion_candidate` | Р‘Р°Р·РѕРІР°СЏ СЂР°СЃСЃС‹Р»РєР° (4в…) |
| `offer_reminder` | 5 | ~14 РґРЅРµР№ | `deletion_offered` | РќР°РїРѕРјРёРЅР°РЅРёРµ РѕР± РѕС„С„РµСЂРµ |
| `agreement_followup` | 4 | ~10 РґРЅРµР№ | `deletion_agreed` | РќР°РїРѕРјРёРЅР°РЅРёРµ РѕР± РёРЅСЃС‚СЂСѓРєС†РёРё |

**Database Table:** `chat_auto_sequences`
- See `migrations/005_create_chat_auto_sequences.sql`
- Field `sequence_type` determines template set, interval, and stop message

**Source Files:**
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) вЂ” Cron job definition
- [src/lib/auto-sequence-templates.ts](../src/lib/auto-sequence-templates.ts) вЂ” Default templates (30D + funnel sets), `TAG_SEQUENCE_CONFIG` mapping, `getNextSlotTime()` slot distributor
- [src/lib/auto-sequence-launcher.ts](../src/lib/auto-sequence-launcher.ts) вЂ” Auto-launch logic (`maybeStartAutoSequence`) вЂ” DEAD CODE
- [src/db/helpers.ts](../src/db/helpers.ts) вЂ” CRUD functions (createAutoSequence, advanceSequence, etc.)
- [src/db/review-chat-link-helpers.ts](../src/db/review-chat-link-helpers.ts) вЂ” `isReviewResolvedForChat()` guard
- [src/app/api/stores/[storeId]/dialogues/update/route.ts](../src/app/api/stores/%5BstoreId%5D/dialogues/update/route.ts) вЂ” Auto-launch trigger (Step 3.5) + awaiting_reply protection
- [scripts/backfill-auto-sequences-30d.mjs](../scripts/backfill-auto-sequences-30d.mjs) вЂ” Batch backfill 30d sequences
- [scripts/migrate-chat-statuses.mjs](../scripts/migrate-chat-statuses.mjs) вЂ” One-time status migration (2026-02-28)
- [scripts/_check_sequences.mjs](../scripts/_check_sequences.mjs) вЂ” Diagnostic script
- [src/lib/auto-sequence-sender.ts](../src/lib/auto-sequence-sender.ts) вЂ” Shared sender utility (used by both API immediate send + cron processor)

---

## 8a. Resolved-Review Closer (РђРІС‚Рѕ-Р·Р°РєСЂС‹С‚РёРµ resolved РѕС‚Р·С‹РІРѕРІ)

**Job Name:** `resolved-review-closer`
**Schedule:** `15,45 * * * *` (every 30 min, offset at :15/:45 to avoid collision with auto-sequence processor)
**Added:** 2026-03-02

**What It Does:**
Auto-closes chats linked to reviews that no longer affect store rating:
1. Queries non-closed chats where linked review is "resolved"
2. Sets `status = 'closed'`, `completion_reason` = `'review_resolved'` or `'temporarily_hidden'` (CASE-based)
3. Stops active auto-sequences with appropriate reason
4. **Audit trail (migration 027):** Writes to `chat_status_history` with `change_source = 'cron_resolved'`, `closure_type = 'auto'`

**Resolved conditions:**
- `complaint_status = 'approved'` вЂ” complaint accepted by WB
- `review_status_wb IN ('excluded', 'unpublished', 'temporarily_hidden', 'deleted')` вЂ” review hidden/removed
- `rating_excluded = TRUE` вЂ” "transparent stars" (don't affect rating)

**Differentiated completion_reason (added 2026-03-03):**
- `review_status_wb = 'temporarily_hidden'` в†’ `completion_reason = 'temporarily_hidden'` (separate for statistics)
- All other resolved conditions в†’ `completion_reason = 'review_resolved'`

> **Note:** This cron is a **safety net** (layer 3). Layers 1-2 (Extension chat/opened + Dialogue sync Step 3.5b) close resolved chats instantly. See `docs/domains/chats-ai.md` for full 3-layer architecture.

**Batch limit:** 200 chats per run (safety for first deploy with backlog)

**Source Files:**
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) вЂ” `startResolvedReviewCloser()`
- [src/lib/init-server.ts](../src/lib/init-server.ts) вЂ” Registration

---

## 7. Client Directory Sync (РЎРїСЂР°РІРѕС‡РЅРёРє РєР»РёРµРЅС‚РѕРІ)

**Job Name:** `client-directory-sync`
**Schedule:**
- **Production:** `30 3 * * *` (6:30 AM MSK / 3:30 AM UTC)
- **Manual:** `POST /api/admin/google-sheets/sync-clients`

**What It Does:**
1. Р§РёС‚Р°РµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РґР°РЅРЅС‹Рµ Р»РёСЃС‚Р° "РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ"
2. РЎС‚СЂРѕРёС‚ РєР°СЂС‚Сѓ `storeId в†’ rowNumber` РґР»СЏ upsert
3. Р—Р°РіСЂСѓР¶Р°РµС‚ РІСЃРµ РјР°РіР°Р·РёРЅС‹ РёР· Р‘Р”
4. Р—Р°РіСЂСѓР¶Р°РµС‚ РїР°РїРєРё РєР»РёРµРЅС‚РѕРІ РёР· Google Drive (fuzzy-matching РїРѕ РЅР°Р·РІР°РЅРёСЋ)
5. Р”Р»СЏ РєР°Р¶РґРѕРіРѕ РјР°РіР°Р·РёРЅР°:
   - РќР°С…РѕРґРёС‚ РїР°РїРєСѓ Drive РїРѕ fuzzy-match РЅР°Р·РІР°РЅРёСЏ
   - Р’РЅСѓС‚СЂРё РїР°РїРєРё РёС‰РµС‚ "РћС‚С‡С‘С‚:" Рё "РЎРєСЂРёРЅС€РѕС‚С‹"
   - Р•СЃР»Рё store РµСЃС‚СЊ РІ С‚Р°Р±Р»РёС†Рµ в†’ **UPDATE** СЃС‚СЂРѕРєРё
   - Р•СЃР»Рё РЅРµС‚ в†’ **APPEND** РЅРѕРІРѕР№ СЃС‚СЂРѕРєРё
6. РЎРѕС…СЂР°РЅСЏРµС‚ РІСЂСѓС‡РЅСѓСЋ Р·Р°РїРѕР»РЅРµРЅРЅС‹Р№ РРќРќ (РєРѕР»РѕРЅРєР° C)

**РЎС‚СЂР°С‚РµРіРёСЏ:** Incremental Upsert (РЅРµ full-rewrite РєР°Рє Product Rules)

**РљРѕР»РѕРЅРєРё:**
| # | РљРѕР»РѕРЅРєР° | РСЃС‚РѕС‡РЅРёРє |
|---|---------|----------|
| A | ID РјР°РіР°Р·РёРЅР° | `store.id` |
| B | РќР°Р·РІР°РЅРёРµ | `store.name` |
| C | РРќРќ | (Р·Р°РїРѕР»РЅСЏРµС‚СЃСЏ РІСЂСѓС‡РЅСѓСЋ) |
| D | Р”Р°С‚Р° РїРѕРґРєР»СЋС‡РµРЅРёСЏ | `store.created_at` |
| E | РЎС‚Р°С‚СѓСЃ | `store.status` |
| F | API Main | вњ…/вќЊ |
| G | API Content | вњ…/вќЊ |
| H | API Feedbacks | вњ…/вќЊ |
| I | API Chat | вњ…/вќЊ |
| J | РџР°РїРєР° РєР»РёРµРЅС‚Р° | Google Drive СЃСЃС‹Р»РєР° |
| K | РћС‚С‡С‘С‚ | РЎСЃС‹Р»РєР° РЅР° "РћС‚С‡С‘С‚: ..." |
| L | РЎРєСЂРёРЅС€РѕС‚С‹ | РЎСЃС‹Р»РєР° РЅР° РїР°РїРєСѓ |
| M | РћР±РЅРѕРІР»РµРЅРѕ | Timestamp |

**Source Files:**
- [src/services/google-sheets-sync/client-directory/](../src/services/google-sheets-sync/client-directory/) вЂ” Sync module
- [src/app/api/admin/google-sheets/sync-clients/route.ts](../src/app/api/admin/google-sheets/sync-clients/route.ts) вЂ” API endpoint

**Google Drive Folder:** `1GelGC6stQVoc5OaJuachXNZtuJvOevyK` (РљР»РёРµРЅС‚С‹)

**Fuzzy Matching Algorithm:**
```typescript
function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/["'В«В»""'']/g, '')          // Remove quotes
    .replace(/^(РѕРѕРѕ|РёРї|Р·Р°Рѕ|РїР°Рѕ)\s*/gi, '') // Remove legal forms
    .replace(/\s+/g, ' ')
    .trim();
}
// Priority: 1) Exact match в†’ 2) Contains в†’ 3) 60%+ word match
```

**Example Output:**
```
[ClientDirectorySync] Starting incremental sync...
[ClientDirectorySync] Target: 1-mxbnv... / "РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ"
[ClientDirectorySync] Found 63 existing rows
[ClientDirectorySync] Mapped 62 existing stores
[ClientDirectorySync] Found 63 stores in database
[ClientDirectorySync] Found 45 client folders in Drive
[ClientDirectorySync] Updates: 62, Appends: 1
[ClientDirectorySync] Updated 806 cells
[ClientDirectorySync] Appended 1 rows
[ClientDirectorySync] вњ… Sync completed in 26728ms
```

**Manual Trigger:**
```bash
# Check status
curl -X GET "http://localhost:9002/api/admin/google-sheets/sync-clients"

# Trigger sync
curl -X POST "http://localhost:9002/api/admin/google-sheets/sync-clients"
```

---

## 9. Nightly Full Review Sync (РџРѕР»РЅС‹Р№ СЃРёРЅРє РѕС‚Р·С‹РІРѕРІ)

**Job Name:** `rolling-review-full-sync`
**Schedule:**
- **Production:** `0 19 * * *` (22:00 MSK / 19:00 UTC, every day including Sunday)
- **Development:** `*/30 * * * *` (every 30 minutes)

**Purpose:** Guarantee complete review coverage across all stores. Processes ALL 12 chunks every night вЂ” full 3-year history refreshed daily.

**Strategy:** Every night processes all 12 chunks (0-11) sequentially. Within each chunk, stores are processed in parallel (concurrency=5) with 5-minute timeout per store. Estimated duration: ~1-2 hours (within 22:00-07:00 MSK window).

**Chunk Layout (each 90 days):**

| Chunk # | Date Range (days ago) | Description |
|---------|----------------------|-------------|
| 0 | 0вЂ“90 | Most recent reviews |
| 1 | 91вЂ“180 | |
| 2 | 181вЂ“270 | |
| 3 | 271вЂ“360 | ~1 year |
| 4 | 361вЂ“450 | |
| 5 | 451вЂ“540 | |
| 6 | 541вЂ“630 | |
| 7 | 631вЂ“720 | ~2 years |
| 8 | 721вЂ“810 | |
| 9 | 811вЂ“900 | |
| 10 | 901вЂ“990 | |
| 11 | 991вЂ“1080 | ~3 years |

**What It Does:**
1. **OZON stores** synced first (one full sync per store вЂ” OZON API has no date-range filter, uses cursor pagination)
2. **WB stores:** Iterates through all 12 chunks (0-11)
3. For each chunk: calculates `dateFrom` and `dateTo` for the 90-day window
4. Processes WB stores in parallel (concurrency=5, 15-min timeout per store)
5. Calls `POST /api/stores/{storeId}/reviews/update?mode=full&dateFrom=X&dateTo=Y`
6. Auto-complaint generation triggers automatically after sync (built into API route)

**Key Properties:**
- **Multi-marketplace:** WB stores use 12-chunk date-range sync; OZON stores do single full cursor-based sync
- Does NOT interfere with hourly incremental sync (separate job name, separate concurrency lock)
- Uses existing adaptive chunking logic (splits further if >19k reviews per sub-chunk)
- Runs at 22:00 MSK вЂ” minimal user activity, 9-hour window until morning
- Parallel processing: concurrency=5 stores, 15-min timeout per store
- Estimated duration: ~1-2 hours for all 12 chunks across ~47 WB stores + a few minutes for OZON stores
- **Deletion detection (migration 015):** After syncing each store, compares WB API IDs with DB IDs in the synced date range. Reviews missing from WB are marked as `review_status_wb = 'deleted'`, and their draft complaints are auto-cancelled (`status = 'not_applicable'`). Safeguard: skips if >30% would be marked deleted (likely API issue).

**Source:** [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts)

**Manual Trigger for Specific Date Range:**
```bash
# Sync specific date range for one store (unix timestamps)
curl -X POST "http://localhost:3000/api/stores/{storeId}/reviews/update?mode=full&dateFrom=1700000000&dateTo=1708000000" \
  -H "Authorization: Bearer $API_KEY"
```

---

## 9a. Midday Review Catchup (Р”РЅРµРІРЅРѕР№ РґРѕСЃРёРЅРє РѕС‚Р·С‹РІРѕРІ)

**Job Name:** `midday-review-catchup`
**Schedule:**
- **Production:** `0 10 * * *` (13:00 MSK / 10:00 UTC, every day)
- **Development:** `*/45 * * * *` (every 45 minutes)

**Purpose:** Second daily full sync pass for chunk 0 (last 90 days) to catch reviews missed by incremental sync due to WB API indexing delays. Combined with the 22:00 MSK nightly sync, this gives **double coverage** for recent reviews.

**What It Does:**
1. Calculates chunk 0 date range (last 90 days)
2. For each active **WB** store: calls full sync API with chunk 0 date range
3. Uses upsert вЂ” no duplicates created
4. Waits 3 seconds between stores

**Key Properties:**
- **WB-only:** OZON stores are excluded (OZON API has no date-range filter; covered by hourly incremental + nightly full sync)
- Only processes chunk 0 (no rotational chunks)
- Idempotent via upsert вЂ” safe to run alongside other syncs
- Estimated duration: 3-5 minutes for ~65 WB stores
- Auto-complaint generation triggers automatically for new reviews found

**Source:** [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) вЂ” `startMiddayReviewCatchup()`

---

## Development Standards (CRON Policy)

> Merged from: `_rules/CRON_POLICY.md`

### Principles

1. **Idempotency** вЂ” re-running a job must be safe (no duplicates, no side effects)
2. **Logging** вЂ” every job logs `[CRON] start/end/errors` with duration
3. **Overlap protection** вЂ” concurrent runs prevented via `runningJobs` flags
4. **Documentation** вЂ” every job documented in this file

### Prohibited

| Action | Risk |
|--------|------|
| Add cron without documentation | Knowledge loss |
| Change schedule without load assessment | API/DB overload |
| Create job without overlap protection | Race conditions |
| Job without logging | Impossible to diagnose |

### Checklist: Adding a New CRON Job

1. Implement with overlap protection pattern (see "Concurrent Execution Protection" section)
2. Register in `src/lib/init-server.ts`
3. Document in this file (CRON_JOBS.md) with: job name, schedule (prod/dev), what it does, source file, idempotency guarantee, error handling
4. Use UTC timezone, note MSK equivalent in comments
5. Use dev-vs-prod schedule pattern:
```typescript
const schedule = process.env.NODE_ENV === 'production'
  ? '0 5 * * *'      // Production (MSK = UTC+3)
  : '*/5 * * * *';   // Development (fast iteration)
```

### Idempotency Pattern

```typescript
// Check before creating
const exists = await db.query('SELECT 1 FROM table WHERE key = $1', [key]);
if (!exists.rows.length) {
  await db.query('INSERT INTO table ...', [values]);
}
```

---

## 10. Adaptive Dialogue Sync (3-Tier Schedule)

**Job Name:** `adaptive-dialogue-sync`
**Schedule:** Dynamic (setTimeout-based, not node-cron)

**3-Tier Adaptive Intervals:**

| Time (MSK) | Interval | Purpose |
|-----------|----------|---------|
| 09:00вЂ“18:00 | **5 min** | Work hours вЂ” high frequency for fast response |
| 06:00вЂ“09:00, 18:00вЂ“21:00 | 15 min | Morning/evening вЂ” moderate frequency |
| 21:00вЂ“06:00 | 60 min | Night вЂ” low frequency |

**What It Does (per store):**

| Step | Name | Description |
|------|------|-------------|
| 1 | Fetch events | WB: cursor-based `chats/events`; OZON: `getChatList()` |
| 2 | Save messages | Upsert `chat_messages`, update `chats.last_message_*` |
| 3 | AI classification | `classifyChatDeletion()` for chats with new client messages |
| **3.5** | **Reconciliation** | `reconcileChatWithLink()` вЂ” fills `review_chat_links.chat_id` by matching chat URL patterns. Extracts UUID from WB URL, maps to `rcl.chat_url` |
| **3.5b** | **Instant resolved-close** | Checks ALL synced chats via `isReviewResolvedForChat()`. Closes resolved chats immediately (`review_resolved` or `temporarily_hidden`), stops active sequences. Added 2026-03-03 |
| 4 | Status updates | Tag changes, counter updates |
| **5a-tg** | **TG notifications** | Sends push to linked TG users. **Filtered:** WB only for chats with `review_chat_links` record; OZON only for `product_nm_id IS NOT NULL` |
| ~~5b~~ | ~~Auto-sequence trigger~~ | **REMOVED (2026-02-28).** Was: detects trigger phrases в†’ creates sequences. Now: sequences started manually from TG mini app only |
| 6 | Interval recalc | Sets next run timeout based on MSK time tier |

**Load:**
- 43 stores Г— 2 sec delay = ~90 seconds per cycle
- At 5-min intervals: ~3.5 min headroom (sufficient)

**Source:** [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) вЂ” `startAdaptiveDialogueSync()`
