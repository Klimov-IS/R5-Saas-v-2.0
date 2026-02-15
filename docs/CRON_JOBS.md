# CRON Jobs Documentation - WB Reputation Manager

**Last Updated:** 2026-02-08

---

## Overview

WB Reputation Manager uses **automated background jobs** (CRON) to sync data from Wildberries API and generate complaints daily with **100% automation**.

**Key Features:**
- Hourly incremental review synchronization
- **Rolling full review sync** (3:00 AM MSK, every day) — 90-day chunks, 3-year coverage in ~12-day cycle
- **Midday review catchup** (13:00 MSK, every day) — chunk 0 only, catches WB API indexing delays
- **Automatic complaint generation** immediately after sync (zero delay)
- **Template-based optimization** for empty reviews (zero AI cost)
- **AI-powered complaints** for reviews with content
- **Active products filter** - only generates complaints for active products
- **3-tier adaptive dialogue sync** — 5min (work hours), 15min (morning/evening), 60min (night)

Jobs are managed using the `node-cron` library and initialize automatically when the Next.js server starts.

---

## Architecture

### Auto-Initialization Flow

```mermaid
graph TD
    A[Next.js Server Starts] --> B[instrumentation.ts executes]
    B --> C[Calls initializeServer]
    C --> D[src/lib/init-server.ts]
    D --> E[startDailyReviewSync]
    E --> F[CRON Job Registered]
    F --> G[Waits for Schedule]
    G --> H{Time Match?}
    H -->|Yes| I[Execute Job]
    H -->|No| G
    I --> J[Sync All Active Stores]
    J --> G
```

**Key Files:**
- [instrumentation.ts](../instrumentation.ts) - Next.js hook (entry point)
- [src/lib/init-server.ts](../src/lib/init-server.ts#L10) - Server initialization
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts#L51) - CRON job definitions

---

## CRON Jobs

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
[CRON] 🚀 Starting daily review sync at 2026-01-16T05:00:00.000Z
========================================

[CRON] Found 43 stores to sync
[CRON] Starting review sync for store: Тайди Центр (UiLCn5HyzRPphSRvR11G)
[CRON] ✅ Successfully synced reviews for Тайди Центр: Synced 150 new reviews
[CRON] Starting auto-complaint generation for Тайди Центр...
[CRON] Found 42 reviews needing complaints for Тайди Центр
[CRON] ✅ Generated complaints for Тайди Центр: 42 total (18 templates, 24 AI), 0 failed
...
========================================
[CRON] ✅ Daily review sync + complaint generation completed
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
2. **Find Reviews Without Complaints** - Query database for reviews without complaints (rating ≤3, active products only)
3. **Smart Generation:**
   - **Empty reviews** (no text, pros, cons) → Use template complaint (0 tokens, instant)
   - **Reviews with content** → Generate AI complaint via Deepseek API
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
Отзыв содержит только числовую оценку без какого-либо текстового описания...
[Full template text]
```

**Reason:** `11 - Отзыв не относится к товару`

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
[AI RAW RESPONSE] Review abc123: Отзыв содержит несоответствие...
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

**Impact:** Reduced from 49 → 43 stores (-12% load reduction)

---

## How CRON Auto-Start Works

### 1. Next.js Instrumentation Hook

When the Next.js server starts, it automatically runs [instrumentation.ts](../instrumentation.ts):

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

### 2. Server Initialization

[src/lib/init-server.ts](../src/lib/init-server.ts) runs once per server start:

```typescript
export function initializeServer() {
  if (initialized) {
    console.log('[INIT] ⏭️  Server already initialized, skipping...');
    return;
  }

  console.log('[INIT] 🚀 Initializing server...');

  // Start cron jobs
  startDailyReviewSync();

  initialized = true;
  console.log('[INIT] ✅ Server initialized successfully');
}
```

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
  console.log('[CRON] ✅ Daily review sync job started successfully');

  return job;
}
```

---

## Deployment Impact

### Does CRON Auto-Start After Deployment?

**YES.** When you deploy:

```bash
# Deploy with update-app.sh
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cd /var/www/wb-reputation && bash deploy/update-app.sh"
```

**What Happens:**
1. `pm2 reload wb-reputation` → restarts Node.js processes
2. Next.js server restarts
3. `instrumentation.ts` runs automatically
4. CRON jobs initialize
5. Jobs wait for scheduled time (8:00 AM MSK)

**No manual intervention required!**

---

## Concurrent Execution Protection

CRON jobs have built-in protection against overlapping runs:

```typescript
const runningJobs: { [jobName: string]: boolean } = {};

cron.schedule('...', async () => {
  const jobName = 'daily-review-sync';

  // Prevent concurrent runs
  if (runningJobs[jobName]) {
    console.log('[CRON] ⚠️  Job already running, skipping this trigger');
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

## Monitoring CRON Jobs

### Check CRON Initialization (Production)

```bash
# SSH into server
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# View PM2 logs (look for [INSTRUMENTATION] and [INIT] logs)
pm2 logs wb-reputation | grep -E "\[INSTRUMENTATION\]|\[INIT\]|\[CRON\]"
```

**Expected Output:**
```
[INSTRUMENTATION] 🚀 Server starting, initializing cron jobs...
[INIT] 🚀 Initializing server at 2026-01-15T10:30:00.000Z
[INIT] Environment: production
[INIT] Starting cron jobs...
[CRON] Scheduling daily review sync: 0 5 * * *
[CRON] Mode: PRODUCTION (8:00 AM MSK)
[CRON] ✅ Daily review sync job started successfully
[INIT] ✅ Server initialized successfully (45ms)
[INSTRUMENTATION] ✅ Cron jobs initialized successfully
```

### Monitor CRON Execution

```bash
# Watch logs in real-time
pm2 logs wb-reputation

# Filter only CRON logs
pm2 logs wb-reputation | grep "\[CRON\]"

# Check specific date/time
pm2 logs wb-reputation --lines 1000 | grep "2026-01-15T05:00"
```

### Check Job Status (API Endpoint)

**Endpoint:** `GET /api/cron/status`

```bash
curl -X GET "http://158.160.217.236/api/cron/status" \
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

### CRON Jobs Not Starting

**Symptom:** No `[CRON]` logs after server restart

**Check:**
```bash
# 1. Verify instrumentation.ts is being executed
pm2 logs wb-reputation | grep "INSTRUMENTATION"

# 2. Check for errors in initialization
pm2 logs wb-reputation --err | grep -E "INIT|CRON"

# 3. Verify Next.js config allows instrumentation
cat next.config.mjs | grep experimental
```

**Expected in `next.config.mjs`:**
```javascript
const nextConfig = {
  experimental: {
    instrumentationHook: true,  // Must be true
  },
};
```

### CRON Job Running But Failing

**Symptom:** `[CRON] ❌ Failed to sync reviews`

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
      console.log(`[CRON] ⚠️  Job ${jobName} already running, skipping`);
      return;
    }

    runningJobs[jobName] = true;
    try {
      console.log('[CRON] 🚀 Starting daily chat sync');

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

      console.log('[CRON] ✅ Daily chat sync completed');
    } catch (error) {
      console.error('[CRON] ❌ Chat sync failed:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Daily chat sync job started');

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
┬ ┬ ┬ ┬ ┬
│ │ │ │ │
│ │ │ │ └─── day of week (0 - 7) (Sunday=0 or 7)
│ │ │ └───── month (1 - 12)
│ │ └─────── day of month (1 - 31)
│ └───────── hour (0 - 23)
└─────────── minute (0 - 59)
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
| Check CRON initialization | `pm2 logs wb-reputation \| grep CRON` |
| View CRON execution logs | `pm2 logs wb-reputation \| grep "daily review sync"` |
| Restart server (re-init CRON) | `pm2 reload wb-reputation` |
| Test job manually | Trigger API endpoint directly |
| Check job schedule | View `src/lib/cron-jobs.ts:54-56` |

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

**Data Exported (per row):**
| Магазин | Артикул WB | Название | Статус | Жалобы | ⭐1-4 | Чаты | ⭐1-4 | Стратегия | Компенсация | Тип | Макс ₽ | Кто платит | Обновлено |

**Triggers:**
1. **CRON** — ежедневно в 6:00 MSK
2. **Manual API** — `POST /api/admin/google-sheets/sync`
3. **Product rules change** — async hook (non-blocking)
4. **Product status change** — async hook (non-blocking)
5. **Store status change** — async hook (non-blocking)

**Configuration (Environment Variables):**
```bash
GOOGLE_SHEETS_SPREADSHEET_ID=1-mxbnv0qkicJMVUCtqDGJH82FhLlDKDvICb-PAVbxfI
GOOGLE_SHEETS_SHEET_NAME=Артикулы ТЗ
GOOGLE_SERVICE_ACCOUNT_EMAIL=r5-automation@r5-wb-bot.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important:** Share the Google Sheet with the Service Account email (role: Editor)

**Source Files:**
- [src/services/google-sheets-sync/](../src/services/google-sheets-sync/) — Sync service
- [src/lib/cron-jobs.ts:518-579](../src/lib/cron-jobs.ts#L518-L579) — CRON job definition
- [src/app/api/admin/google-sheets/sync/route.ts](../src/app/api/admin/google-sheets/sync/route.ts) — Manual sync API

**Example Output:**
```
========================================
[CRON] 📊 Starting Google Sheets sync at 2026-02-08T03:00:00.000Z
========================================

[GoogleSheetsSync] Starting full sync...
[GoogleSheetsSync] Target: 1-mxbnv0qkicJMVUCtqDGJH82FhLlDKDvICb-PAVbxfI / "Артикулы ТЗ"
[GoogleSheetsSync] Found 5 active stores
[GoogleSheetsSync] Store "Тайди Центр": 42 active products
[GoogleSheetsSync] Store "Test Store": 15 active products
[GoogleSheetsSync] Total rows to write: 57
[GoogleSheets] Clearing sheet "Артикулы ТЗ"...
[GoogleSheets] Sheet cleared. Writing 58 rows...
[GoogleSheets] ✅ Successfully wrote 58 rows
[GoogleSheetsSync] ✅ Sync completed in 1250ms

========================================
[CRON] ✅ Google Sheets sync completed
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

**Last Updated:** 2026-02-15

**Production CRON Jobs:**
| Job | Schedule (MSK) | Schedule (UTC) | Description |
|-----|----------------|----------------|-------------|
| Review Sync + Complaints | Every hour | 0 * * * * | Incremental review sync (3h overlap) + auto-generate complaints + retry failed stores |
| **Rolling Review Full Sync** | **3:00 AM daily** | **0 0 * * *** | **Full review sync by 90-day chunks (chunk 0 + 1 rotational, 3-year coverage)** |
| **Midday Review Catchup** | **13:00 daily** | **0 10 * * *** | **Chunk 0 only (last 90 days) — second daily pass to catch WB API delays** |
| Dialogue Sync | Adaptive (3-tier) | 5min work (09-18) / 15min morning-evening / 60min night | Sync chat dialogues |
| Product Sync | 7:00 AM | 0 4 * * * | Sync product catalog (WB + OZON) |
| Backfill Worker | Every 5 min | */5 * * * * | Process complaint backfill queue (BATCH=200, DAILY_LIMIT=6000) |
| Google Sheets Sync | 6:00 AM | 0 3 * * * | Export product rules to Google Sheets |
| Client Directory Sync | 6:30 AM | 30 3 * * * | Sync client directory (upsert) |
| **Auto-Sequence Processor** | Every 30 min (daytime) | */30 * * * * | Send follow-up messages (100/batch, distributed slots 10-17 MSK) |

**Non-CRON Background Process:**
| Process | Type | Description |
|---------|------|-------------|
| **TG Bot** (`wb-reputation-tg-bot`) | PM2 fork | Telegram bot long-polling + push notifications hook in dialogue sync |

**Estimated Daily Cost Savings:** 30-40% via template optimization

---

## 8. Auto-Sequence Processor (Авто-рассылка)

**Job Name:** `auto-sequence-processor`
**Schedule:** `*/30 * * * *` (every 30 minutes, UTC)
**Active hours:** 8:00-22:00 MSK only (skips nighttime)
**Batch limit:** 100 sequences per run

**Two template sets:**
- `no_reply_followup` — negatives (1-2-3 stars), trigger from `no_reply_trigger_phrase`
- `no_reply_followup_4star` — 4-star reviews, trigger from `no_reply_trigger_phrase2`

**What It Does:**
1. Queries `chat_auto_sequences` table for active sequences where `next_send_at <= NOW()` (limit 100)
2. For each pending sequence (safety checks in order):
   a. **Client replied?** → STOP sequence (`client_replied`)
   b. **Chat status valid?** → STOP if not `awaiting_reply` or `inbox` (`status_changed`)
   c. **Seller already sent today?** → SKIP, reschedule to random slot tomorrow (no step advance)
   d. **Max steps reached?** → Send СТОП message (per `sequence_type`) + close chat
   e. Send next follow-up via WB Chat API
   f. Record in `chat_messages`, update chat, advance sequence
3. Rate limits: 3 seconds between sends

### Distributed Time Slots

Messages are **not sent all at once** — they are distributed across the day using weighted time slots to avoid overwhelming managers with responses arriving simultaneously.

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
- When a sequence is created or advanced, `next_send_at` is set to a **random time tomorrow** within a weighted slot (e.g. tomorrow at 11:37 MSK)
- Random minute (0-59) within each hour for additional scatter
- Cron picks up sequences where `next_send_at <= NOW()` — no changes to cron logic needed
- Function: `getNextSlotTime()` in `src/lib/auto-sequence-templates.ts`

**Result:** ~4700 sequences spread as ~700/hr (10-13 MSK) and ~470/hr (14-17 MSK) instead of all at once.

**Dry Run Mode:**
Set `AUTO_SEQUENCE_DRY_RUN=true` in environment. All safety checks run, decisions are logged, but NO messages are sent and NO database changes are made.

Manual dry run script: `node scripts/dry-run-sequences.mjs`

**Triggering a Sequence:**
- Dialogue sync detects trigger phrase in seller message → auto-tag + auto-sequence
- Manual status change to `awaiting_reply` (via PATCH `/api/stores/:storeId/chats/:chatId/status`)
- Templates: `user_settings.no_reply_messages` / `no_reply_messages2`, fallback to defaults

**Stopping Conditions:**
- Client replied (detected in dialogue sync and in cron job)
- Chat status changed away from `awaiting_reply`/`inbox` (checked in cron)
- Seller already sent a message today (skip + reschedule to random slot, not stop)
- All messages sent (14 days) → СТОП message + close

**Database Table:** `chat_auto_sequences`
- See `migrations/005_create_chat_auto_sequences.sql`
- Field `sequence_type` determines template set and stop message

**Source Files:**
- [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) — Cron job definition
- [src/lib/auto-sequence-templates.ts](../src/lib/auto-sequence-templates.ts) — Default templates (2 sets), `getNextSlotTime()` slot distributor
- [src/db/helpers.ts](../src/db/helpers.ts) — CRUD functions (createAutoSequence, advanceSequence, rescheduleSequence, etc.)
- [src/app/api/stores/[storeId]/dialogues/update/route.ts](../src/app/api/stores/%5BstoreId%5D/dialogues/update/route.ts) — Trigger detection (Step 5b)
- [scripts/dry-run-sequences.mjs](../scripts/dry-run-sequences.mjs) — Manual dry run
- [scripts/backfill-and-send.mjs](../scripts/backfill-and-send.mjs) — Batch backfill + immediate send
- [scripts/backfill-store-sequences.mjs](../scripts/backfill-store-sequences.mjs) — Backfill sequences (no send)

---

## 7. Client Directory Sync (Справочник клиентов)

**Job Name:** `client-directory-sync`
**Schedule:**
- **Production:** `30 3 * * *` (6:30 AM MSK / 3:30 AM UTC)
- **Manual:** `POST /api/admin/google-sheets/sync-clients`

**What It Does:**
1. Читает существующие данные листа "Список клиентов"
2. Строит карту `storeId → rowNumber` для upsert
3. Загружает все магазины из БД
4. Загружает папки клиентов из Google Drive (fuzzy-matching по названию)
5. Для каждого магазина:
   - Находит папку Drive по fuzzy-match названия
   - Внутри папки ищет "Отчёт:" и "Скриншоты"
   - Если store есть в таблице → **UPDATE** строки
   - Если нет → **APPEND** новой строки
6. Сохраняет вручную заполненный ИНН (колонка C)

**Стратегия:** Incremental Upsert (не full-rewrite как Product Rules)

**Колонки:**
| # | Колонка | Источник |
|---|---------|----------|
| A | ID магазина | `store.id` |
| B | Название | `store.name` |
| C | ИНН | (заполняется вручную) |
| D | Дата подключения | `store.created_at` |
| E | Статус | `store.status` |
| F | API Main | ✅/❌ |
| G | API Content | ✅/❌ |
| H | API Feedbacks | ✅/❌ |
| I | API Chat | ✅/❌ |
| J | Папка клиента | Google Drive ссылка |
| K | Отчёт | Ссылка на "Отчёт: ..." |
| L | Скриншоты | Ссылка на папку |
| M | Обновлено | Timestamp |

**Source Files:**
- [src/services/google-sheets-sync/client-directory/](../src/services/google-sheets-sync/client-directory/) — Sync module
- [src/app/api/admin/google-sheets/sync-clients/route.ts](../src/app/api/admin/google-sheets/sync-clients/route.ts) — API endpoint

**Google Drive Folder:** `1GelGC6stQVoc5OaJuachXNZtuJvOevyK` (Клиенты)

**Fuzzy Matching Algorithm:**
```typescript
function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/["'«»""'']/g, '')          // Remove quotes
    .replace(/^(ооо|ип|зао|пао)\s*/gi, '') // Remove legal forms
    .replace(/\s+/g, ' ')
    .trim();
}
// Priority: 1) Exact match → 2) Contains → 3) 60%+ word match
```

**Example Output:**
```
[ClientDirectorySync] Starting incremental sync...
[ClientDirectorySync] Target: 1-mxbnv... / "Список клиентов"
[ClientDirectorySync] Found 63 existing rows
[ClientDirectorySync] Mapped 62 existing stores
[ClientDirectorySync] Found 63 stores in database
[ClientDirectorySync] Found 45 client folders in Drive
[ClientDirectorySync] Updates: 62, Appends: 1
[ClientDirectorySync] Updated 806 cells
[ClientDirectorySync] Appended 1 rows
[ClientDirectorySync] ✅ Sync completed in 26728ms
```

**Manual Trigger:**
```bash
# Check status
curl -X GET "http://localhost:9002/api/admin/google-sheets/sync-clients"

# Trigger sync
curl -X POST "http://localhost:9002/api/admin/google-sheets/sync-clients"
```

---

## 9. Rolling Review Full Sync (Полный синк отзывов)

**Job Name:** `rolling-review-full-sync`
**Schedule:**
- **Production:** `0 0 * * *` (3:00 AM MSK / 0:00 UTC, every day including Sunday)
- **Development:** `*/30 * * * *` (every 30 minutes)

**Purpose:** Guarantee complete review coverage across all stores. Incremental sync can miss reviews if server was down, WB API returned errors, or reviews were backdated.

**Strategy:** Each day syncs chunk 0 (last 90 days, ALWAYS) + a rotational chunk (1-11). Full cycle of all 12 chunks completes in ~12 days.

**Chunk Schedule (by dayOfYear % 12):**

| Chunk # | Date Range (days ago) | Description |
|---------|----------------------|-------------|
| 1 | 0–90 | Most recent reviews |
| 2 | 91–180 | |
| 3 | 181–270 | |
| 4 | 271–360 | ~1 year |
| 5 | 361–450 | |
| 6 | 451–540 | |
| 7 | 541–630 | |
| 8 | 631–720 | ~2 years |
| 9 | 721–810 | |
| 10 | 811–900 | |
| 11 | 901–990 | |
| 12 | 991–1080 | ~3 years |

**What It Does:**
1. Determines current chunk index from `dayOfYear % 12`
2. Calculates `dateFrom` and `dateTo` for the 90-day window
3. For each active store: calls `POST /api/stores/{storeId}/reviews/update?mode=full&dateFrom=X&dateTo=Y`
4. Auto-complaint generation triggers automatically after sync (built into API route)
5. Waits 3 seconds between stores

**Key Properties:**
- Does NOT interfere with hourly incremental sync (separate job name, separate concurrency lock)
- Uses existing adaptive chunking logic (splits further if >19k reviews per sub-chunk)
- Runs at 3:00 AM MSK — minimal load on WB API and server
- Estimated duration: 5-20 minutes per run
- **Deletion detection (migration 015):** After syncing each store, compares WB API IDs with DB IDs in the synced date range. Reviews missing from WB are marked as `review_status_wb = 'deleted'`, and their draft complaints are auto-cancelled (`status = 'not_applicable'`). Safeguard: skips if >30% would be marked deleted (likely API issue).

**Source:** [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts)

**Manual Trigger for Specific Date Range:**
```bash
# Sync specific date range for one store (unix timestamps)
curl -X POST "http://localhost:9002/api/stores/{storeId}/reviews/update?mode=full&dateFrom=1700000000&dateTo=1708000000" \
  -H "Authorization: Bearer $API_KEY"
```

---

## 9a. Midday Review Catchup (Дневной досинк отзывов)

**Job Name:** `midday-review-catchup`
**Schedule:**
- **Production:** `0 10 * * *` (13:00 MSK / 10:00 UTC, every day)
- **Development:** `*/45 * * * *` (every 45 minutes)

**Purpose:** Second daily full sync pass for chunk 0 (last 90 days) to catch reviews missed by incremental sync due to WB API indexing delays. Combined with the 3:00 MSK rolling sync, this gives **double coverage** for recent reviews.

**What It Does:**
1. Calculates chunk 0 date range (last 90 days)
2. For each active store: calls full sync API with chunk 0 date range
3. Uses upsert — no duplicates created
4. Waits 3 seconds between stores

**Key Properties:**
- Only processes chunk 0 (no rotational chunks)
- Idempotent via upsert — safe to run alongside other syncs
- Estimated duration: 3-5 minutes for 65 stores
- Auto-complaint generation triggers automatically for new reviews found

**Source:** [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) — `startMiddayReviewCatchup()`

---

## 10. Adaptive Dialogue Sync (3-Tier Schedule)

**Job Name:** `adaptive-dialogue-sync`
**Schedule:** Dynamic (setTimeout-based, not node-cron)

**3-Tier Adaptive Intervals:**

| Time (MSK) | Interval | Purpose |
|-----------|----------|---------|
| 09:00–18:00 | **5 min** | Work hours — high frequency for fast response |
| 06:00–09:00, 18:00–21:00 | 15 min | Morning/evening — moderate frequency |
| 21:00–06:00 | 60 min | Night — low frequency |

**What It Does:**
1. Fetches active chats from WB API for each store
2. Gets new message events (cursor-based pagination)
3. Saves messages, sends Telegram notifications, triggers auto-sequences
4. AI re-classification of updated chats
5. Recalculates interval for next run based on current MSK time

**Load:**
- 43 stores × 2 sec delay = ~90 seconds per cycle
- At 5-min intervals: ~3.5 min headroom (sufficient)

**Source:** [src/lib/cron-jobs.ts](../src/lib/cron-jobs.ts) — `startAdaptiveDialogueSync()`
