# 🚨 Emergency Fix: Auto-Sequence Duplicate Sends

**Date:** 2026-03-13
**Status:** ✅ FIX READY FOR DEPLOYMENT
**Severity:** 🔴 CRITICAL

---

## 📋 Problem Summary

**Reported Issue:**
Система отправляет **по 4 сообщения в магазин за несколько минут** вместо 1 сообщения в день.

**Root Cause:**
**3 процесса** запускают одни и те же CRON задачи параллельно:

1. **Main app instance #1** (cluster mode): `instrumentation.ts` → `init-server.ts` → `startAutoSequenceProcessor()`
2. **Main app instance #2** (cluster mode): Same as above
3. **wb-reputation-cron process**: `scripts/start-cron.js` → Same cron jobs

**Result:** Each auto-sequence processed 3× → Messages sent 3× to same chat!

**Affected File:** [src/lib/init-server.ts:29](src/lib/init-server.ts#L29)

---

## 🔧 Solution Implemented

### Change 1: Disable CRON in Main App (Production)

**File:** [src/lib/init-server.ts](src/lib/init-server.ts)

**Before:**
```typescript
export function initializeServer() {
  // ...
  console.log('[INIT] Starting cron jobs...');
  startAutoSequenceProcessor(); // ← Runs in EACH cluster instance!
  // ...
}
```

**After:**
```typescript
export function initializeServer() {
  // ...
  const enableCronInMainApp = process.env.ENABLE_CRON_IN_MAIN_APP === 'true';

  if (!enableCronInMainApp) {
    console.log('[INIT] ⚠️  CRON jobs DISABLED in main app (use wb-reputation-cron process)');
    initialized = true;
    return; // ← Exit early, don't start cron
  }

  // Only runs if ENABLE_CRON_IN_MAIN_APP=true (for local dev)
  startAutoSequenceProcessor();
  // ...
}
```

**Environment Variable:**
- **Production:** `ENABLE_CRON_IN_MAIN_APP` NOT set (defaults to false) → CRON disabled in main app ✅
- **Local Dev:** Set `ENABLE_CRON_IN_MAIN_APP=true` in `.env.local` if needed for testing

---

### Change 2: Emergency Stop Script

**File:** [scripts/EMERGENCY-stop-auto-sequences.mjs](scripts/EMERGENCY-stop-auto-sequences.mjs)

**Purpose:** Immediately stop ALL active auto-sequences before deploying fix.

**Usage:**
```bash
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

**What it does:**
1. Finds all `chat_auto_sequences` with `status = 'active'`
2. Updates them to `status = 'stopped'`, `stopped_reason = 'emergency_stop'`
3. Updates chat statuses: `awaiting_reply` → `inbox`/`in_progress`
4. Reports summary of stopped sequences

---

### Change 3: Audit Script

**File:** [scripts/AUDIT-check-duplicate-sends.mjs](scripts/AUDIT-check-duplicate-sends.mjs)

**Purpose:** Detect duplicate sends and diagnose issues.

**Usage:**
```bash
node scripts/AUDIT-check-duplicate-sends.mjs
```

**Checks:**
1. ❌ Duplicate messages (same text sent multiple times to one chat)
2. ❌ Multiple active sequences for same chat (should be max 1)
3. ❌ Rapid sends (< 5 min between messages)
4. ⚠️  Stale processing locks (stuck > 10 min)
5. 📊 Statistics (messages sent, chats affected, avg per chat)

---

## 🚀 Deployment Steps

### Prerequisites

1. **SSH Access** to production server
2. **PM2 Installed** on server
3. **Node.js** v18+ installed
4. **Database Access** (PostgreSQL connection working)

---

### OPTION A: Automated Deployment (Recommended)

```bash
# On production server
cd /var/www/wb-reputation

# Run automated deployment script
bash DEPLOY-EMERGENCY-FIX.sh
```

**Script does:**
1. ✅ Stops all active sequences (emergency script)
2. ✅ Stops CRON process temporarily
3. ✅ Runs audit (saves to `logs/`)
4. ✅ Builds new Next.js version
5. ✅ Restarts main app (CRON disabled)
6. ✅ Starts CRON process (single source)

**Expected Duration:** 3-5 minutes

---

### OPTION B: Manual Deployment (Step-by-Step)

#### Step 1: Stop Active Sequences

```bash
cd /var/www/wb-reputation
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

**Expected Output:**
```
🚨 ========== EMERGENCY AUTO-SEQUENCE STOP ==========
⚠️  Found 47 active sequences to stop...
✅ Successfully stopped 47 sequences:
   - no_reply_followup: 32 sequences
   - no_reply_followup_4star: 15 sequences
```

---

#### Step 2: Stop CRON Process

```bash
pm2 stop wb-reputation-cron
pm2 list
```

**Expected Output:**
```
┌─────┬──────────────────────┬─────────┐
│ id  │ name                 │ status  │
├─────┼──────────────────────┼─────────┤
│ 0   │ wb-reputation        │ online  │
│ 1   │ wb-reputation-tg-bot │ online  │
│ 2   │ wb-reputation-cron   │ stopped │ ← STOPPED ✅
└─────┴──────────────────────┴─────────┘
```

---

#### Step 3: Run Audit (Before Fix)

```bash
mkdir -p logs
node scripts/AUDIT-check-duplicate-sends.mjs > logs/audit-before-fix-$(date +%Y%m%d-%H%M%S).txt
cat logs/audit-before-fix-*.txt
```

**Review for:**
- Duplicate messages count
- Multiple active sequences per chat
- Rapid sends (< 5 min)

---

#### Step 4: Pull Latest Code & Build

```bash
# Pull fix from git
git pull origin main

# Or manually upload fixed files:
# - src/lib/init-server.ts
# - scripts/EMERGENCY-stop-auto-sequences.mjs
# - scripts/AUDIT-check-duplicate-sends.mjs

# Build Next.js
npm run build
```

---

#### Step 5: Restart Main App

```bash
pm2 restart wb-reputation

# Check logs (should see CRON disabled message)
pm2 logs wb-reputation --lines 20
```

**Expected Log:**
```
[INIT] ⚠️  CRON jobs DISABLED in main app (use wb-reputation-cron process)
[INIT] 💡 To enable in main app (local dev only): set ENABLE_CRON_IN_MAIN_APP=true
```

---

#### Step 6: Start CRON Process

```bash
pm2 start wb-reputation-cron

# Monitor logs
pm2 logs wb-reputation-cron --lines 50
```

**Expected Log:**
```
[START-CRON] ✅ Response: { success: true, message: 'Cron jobs initialized' }
[CRON] ✅ Auto-sequence processor started (every 30 min)
```

---

#### Step 7: Verify (30 Minutes Later)

Wait for next auto-sequence run (every 30 minutes).

**Check logs:**
```bash
pm2 logs wb-reputation-cron | grep "Auto-sequence"
```

**Expected Log (should appear ONCE, not 3×):**
```
[CRON] 📨 Auto-sequence: 5 sent, 2 stopped, 3 skipped, 0 errors (42s)
```

**Run audit again:**
```bash
node scripts/AUDIT-check-duplicate-sends.mjs > logs/audit-after-fix-$(date +%Y%m%d-%H%M%S).txt
cat logs/audit-after-fix-*.txt
```

**Expected:**
- ✅ No duplicate messages
- ✅ No multiple active sequences per chat
- ✅ No rapid sends

---

## 📊 Verification Checklist

After deployment, verify:

- [ ] **PM2 Processes:**
  - `wb-reputation`: 2 instances (cluster), status = `online`
  - `wb-reputation-tg-bot`: 1 instance, status = `online`
  - `wb-reputation-cron`: 1 instance, status = `online`

- [ ] **Main App Logs:**
  - Contains: `[INIT] ⚠️  CRON jobs DISABLED in main app`
  - Does NOT contain: `[CRON] ✅ Auto-sequence processor started`

- [ ] **CRON Process Logs:**
  - Contains: `[CRON] ✅ Auto-sequence processor started`
  - Auto-sequence log appears every 30 min (ONCE, not multiple times)

- [ ] **Database Check:**
  ```sql
  -- Should return 0 rows
  SELECT chat_id, COUNT(*)
  FROM chat_auto_sequences
  WHERE status = 'active'
  GROUP BY chat_id
  HAVING COUNT(*) > 1;
  ```

- [ ] **Audit Report (After Fix):**
  - No duplicate messages detected
  - No rapid sends (< 5 min)
  - No stale processing locks

---

## 🔄 Rollback Plan (If Issues)

If deployment causes issues:

```bash
# Step 1: Stop CRON process
pm2 stop wb-reputation-cron

# Step 2: Enable CRON in main app (temporary)
export ENABLE_CRON_IN_MAIN_APP=true
pm2 restart wb-reputation --update-env

# Step 3: Monitor logs
pm2 logs wb-reputation | grep CRON
```

**Note:** Rollback still has duplicate issue (2× main app instances), but at least cron will run.

**Proper fix:** Reduce main app to 1 instance:
```bash
pm2 scale wb-reputation 1  # Reduce from 2 → 1 instance
```

---

## 📝 Post-Deployment Tasks

1. **Monitor for 24 hours:**
   - Check `pm2 logs wb-reputation-cron` every few hours
   - Look for errors, duplicates, or "already running" messages

2. **Run daily audit:**
   ```bash
   # Add to crontab
   0 10 * * * cd /var/www/wb-reputation && node scripts/AUDIT-check-duplicate-sends.mjs > logs/audit-daily-$(date +\%Y\%m\%d).txt
   ```

3. **Update documentation:**
   - Add note to `docs/CRON_JOBS.md` about ENABLE_CRON_IN_MAIN_APP variable
   - Document new emergency scripts in `docs/TROUBLESHOOTING.md`

4. **Alert setup (optional):**
   - Set up monitoring for duplicate sequences
   - Alert if `COUNT(*) > 1` for same `chat_id` in `chat_auto_sequences`

---

## 🛡️ Prevention Measures

To prevent this in future:

### 1. Add Database-Level Unique Constraint

```sql
-- Prevent multiple active sequences per chat
CREATE UNIQUE INDEX idx_unique_active_sequence_per_chat
ON chat_auto_sequences (chat_id)
WHERE status = 'active';
```

**Benefit:** Database will reject attempts to create duplicate active sequences.

---

### 2. Add Database-Level Job Lock

See [EMERGENCY-STOP-GUIDE.md](EMERGENCY-STOP-GUIDE.md#fix-2-add-database-level-job-lock) for implementation.

**Benefit:** Even if multiple processes start cron, only one will acquire lock.

---

### 3. Add Rate Limiter for Message Sends

**Implementation:** Before sending message, check last send time:

```typescript
const lastSendResult = await query(
  `SELECT last_send_at FROM message_send_rate_limits
   WHERE chat_id = $1 AND last_send_at > NOW() - INTERVAL '1 minute'`,
  [chatId]
);

if (lastSendResult.rows.length > 0) {
  console.log('[RATE-LIMIT] Skipping send, message sent < 1 min ago');
  return { sent: false, error: 'rate_limited' };
}
```

---

### 4. Update Deployment Docs

Add warning to deployment guide:

> ⚠️ **IMPORTANT:** In production, cron jobs run ONLY in `wb-reputation-cron` process.
> Main app (`wb-reputation`) should have `ENABLE_CRON_IN_MAIN_APP` unset (defaults to false).

---

## 📁 Related Files

- **Fix:** [src/lib/init-server.ts](src/lib/init-server.ts)
- **Emergency Scripts:**
  - [scripts/EMERGENCY-stop-auto-sequences.mjs](scripts/EMERGENCY-stop-auto-sequences.mjs)
  - [scripts/AUDIT-check-duplicate-sends.mjs](scripts/AUDIT-check-duplicate-sends.mjs)
- **Deployment:** [DEPLOY-EMERGENCY-FIX.sh](DEPLOY-EMERGENCY-FIX.sh)
- **Documentation:**
  - [EMERGENCY-STOP-GUIDE.md](EMERGENCY-STOP-GUIDE.md)
  - [docs/CRON_JOBS.md](docs/CRON_JOBS.md)
  - [ecosystem.config.js](ecosystem.config.js)

---

## 🎯 Success Criteria

Deployment is successful when:

✅ Only 1 process (wb-reputation-cron) runs cron jobs
✅ Main app logs show "CRON jobs DISABLED in main app"
✅ Auto-sequence messages sent ONCE per run (not 3×)
✅ Audit report shows NO duplicates
✅ No chat has multiple active sequences
✅ No rapid sends (< 5 min apart)

---

**Author:** Emergency Response Team
**Date:** 2026-03-13
**Approved By:** [To be filled]
**Deployed By:** [To be filled]
**Deployment Date:** [To be filled]
