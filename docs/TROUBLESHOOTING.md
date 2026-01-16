# Troubleshooting Guide - WB Reputation Manager

**Last Updated:** 2026-01-15

---

## Common Issues

### 1. Database Connection Errors

#### Symptom
```
Error: connect ETIMEDOUT
Error: Connection terminated unexpectedly
```

#### Diagnosis

```bash
# Test database connection manually
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT version();"
```

#### Common Causes

**1. Firewall/Security Group Blocking Connection**
- Check Yandex Cloud security group rules
- Ensure port 6432 is open from server IP
- Verify IP whitelist in Yandex Cloud DB settings

**2. Invalid Credentials**
```bash
# Verify environment variables (production server)
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cat /var/www/wb-reputation/.env.production | grep POSTGRES"
```

**3. Connection Pool Exhausted**
```bash
# Check active connections
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname='wb_reputation';"
```

#### Fix

```typescript
// Increase pool size in src/db/pool.ts
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 50,  // Increase if needed
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,  // Increase timeout
});
```

---

### 2. Review Sync Fails (20k Limit)

#### Symptom
```json
{
  "error": "Review API error",
  "details": "Maximum 20,000 reviews can be fetched"
}
```

#### Why This Happens

Wildberries API has a hard limit of 20,000 reviews per request. Some stores (like Тайди Центр) have 1.3M+ reviews.

#### Solution

The app uses **adaptive date chunking** to bypass this limit. Verify it's working:

```bash
# Check logs during sync
pm2 logs wb-reputation | grep "Adaptive chunking"

# Should see:
# [SYNC] Using adaptive chunking: 2020-01-01 → 2020-03-31 (90 days)
# [SYNC] Chunk had 18,500 reviews (near limit), reducing chunk size
```

#### Manual Override

If sync still fails, reduce chunk size in [src/app/api/stores/[storeId]/reviews/update/route.ts](../src/app/api/stores/[storeId]/reviews/update/route.ts):

```typescript
let currentChunkSize = 90;  // Start with 90 days
const minChunkSize = 30;    // Minimum 30 days
const maxChunkSize = 180;   // Maximum 180 days

// Change to more conservative defaults:
let currentChunkSize = 60;  // Start with 60 days
const minChunkSize = 15;    // Minimum 15 days
```

---

### 3. CRON Jobs Not Running

#### Symptom

No `[CRON]` logs after server restart.

#### Diagnosis

```bash
# 1. Check if instrumentation.ts ran
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "pm2 logs wb-reputation | grep INSTRUMENTATION"

# Expected output:
# [INSTRUMENTATION] 🚀 Server starting, initializing cron jobs...
# [INSTRUMENTATION] ✅ Cron jobs initialized successfully

# 2. Verify CRON job registration
pm2 logs wb-reputation | grep "Daily review sync job started"
```

#### Common Causes

**1. Instrumentation Hook Not Enabled**

Check [next.config.mjs](../next.config.mjs):

```javascript
const nextConfig = {
  experimental: {
    instrumentationHook: true,  // MUST be true
  },
};
```

**2. Runtime Not Node.js**

[instrumentation.ts](../instrumentation.ts) only runs in Node.js runtime:

```typescript
if (process.env.NEXT_RUNTIME === 'nodejs') {
  // CRON jobs start here
}
```

Edge runtime won't initialize CRON jobs (this is intentional).

**3. Server Crash During Initialization**

```bash
# Check for errors
pm2 logs wb-reputation --err | grep -E "INIT|CRON"
```

#### Fix

```bash
# Restart PM2 to re-initialize
pm2 reload wb-reputation

# Verify initialization
pm2 logs wb-reputation --lines 100 | grep -E "INSTRUMENTATION|INIT|CRON"
```

---

### 4. PM2 Won't Start

#### Symptom

```
[PM2][ERROR] Script not found: /var/www/wb-reputation/node_modules/next/dist/bin/next
```

#### Diagnosis

```bash
# Check if Next.js is installed
ls -la /var/www/wb-reputation/node_modules/next

# Check ecosystem.config.js
cat /var/www/wb-reputation/ecosystem.config.js
```

#### Fix

```bash
# Reinstall dependencies
cd /var/www/wb-reputation
npm ci --production=false

# Rebuild app
npm run build

# Start PM2
pm2 start ecosystem.config.js
pm2 save
```

---

### 5. API Returns 401 Unauthorized

#### Symptom

```bash
curl http://158.160.217.236/api/stores
# {"error":"Unauthorized"}
```

#### Diagnosis

```bash
# Test with API key
curl -X GET "http://158.160.217.236/api/stores" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Should return store list
```

#### Common Causes

**1. Missing Authorization Header**

All API endpoints require:
```
Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

**2. Wrong API Key Format**

Valid format: `wbrm_*` (prefix required)

**3. API Key Not in Environment**

```bash
# Check .env.production
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cat /var/www/wb-reputation/.env.production | grep API_KEY"

# Should show:
# API_KEY=wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

---

### 6. Build Fails with TypeScript Errors

#### Symptom

```
npm run build
Type error: Property 'X' does not exist on type 'Y'
```

#### Diagnosis

```bash
# Run TypeScript check
npx tsc --noEmit

# See all errors
```

#### Common Causes

**1. Missing Type Definitions**

```bash
# Install missing types
npm install --save-dev @types/node @types/react
```

**2. Strict Mode Violations**

Check `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true
  }
}
```

#### Fix

```typescript
// Add null checks
const store = await getStore(storeId);
if (!store) {
  return NextResponse.json({ error: 'Store not found' }, { status: 404 });
}

// Use type assertions cautiously
const data = result as ExpectedType;
```

---

### 7. High Memory Usage

#### Symptom

```bash
pm2 monit
# Shows >1GB memory per instance
```

#### Diagnosis

```bash
# Check detailed stats
pm2 show wb-reputation

# Monitor over time
pm2 monit
```

#### Common Causes

**1. Large Review Sync (1M+ reviews)**

During full sync, memory usage spikes (expected).

**2. Memory Leaks**

Long-running processes without proper cleanup.

**3. Too Many PM2 Instances**

Currently 2 instances × ~500MB each = 1GB baseline.

#### Fix

**Immediate:**
```bash
# Restart to clear memory
pm2 reload wb-reputation
```

**Long-term:**
```javascript
// ecosystem.config.js - adjust instances
module.exports = {
  apps: [{
    name: 'wb-reputation',
    instances: 1,  // Reduce from 2 to 1 if memory-constrained
    max_memory_restart: '1G',  // Auto-restart at 1GB
  }]
};
```

---

### 8. Nginx 502 Bad Gateway

#### Symptom

Browser shows "502 Bad Gateway" when accessing http://158.160.217.236

#### Diagnosis

```bash
# Check if Next.js is running
pm2 status wb-reputation

# Check if port 3000 is listening
sudo netstat -tulpn | grep 3000

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

#### Common Causes

**1. Next.js Server Not Running**

```bash
# Start PM2
pm2 start ecosystem.config.js
```

**2. Port Mismatch**

Nginx forwards to `localhost:3000`, but Next.js uses different port.

```bash
# Verify PORT in .env.production
cat /var/www/wb-reputation/.env.production | grep PORT
# Should be: PORT=3000
```

**3. Nginx Misconfiguration**

```bash
# Test Nginx config
sudo nginx -t

# Reload if OK
sudo systemctl reload nginx
```

---

### 9. Deepseek API Errors

#### Symptom

```json
{
  "error": "AI generation failed",
  "details": "Invalid API key"
}
```

#### Diagnosis

```bash
# Check Deepseek API key
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cat /var/www/wb-reputation/.env.production | grep DEEPSEEK"

# Test API manually
curl https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

#### Common Causes

**1. Expired/Invalid API Key**

Get new key from https://platform.deepseek.com

**2. Rate Limiting**

Deepseek has request limits. Check:
```bash
# View recent API calls
pm2 logs wb-reputation | grep "Deepseek API"
```

**3. Network Issues**

```bash
# Test connectivity from server
curl -I https://api.deepseek.com
```

---

### 10. Full Sync Takes Too Long

#### Symptom

Full sync for 1M+ review store takes 10+ hours.

#### Why This Happens

- Adaptive chunking creates many small date ranges
- Each chunk = 1 API call + processing time
- 1.3M reviews / 20k per chunk = 65+ chunks × 2-3 minutes each

#### Solutions

**1. Use Incremental Sync Instead**

```bash
# Only fetch new reviews (much faster)
curl -X POST "http://158.160.217.236/api/stores/{storeId}/reviews/update?mode=incremental" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
```

**2. Increase Chunk Size (If Store Has <20k Total)**

Only for small stores. See solution in #2 above.

**3. Run Full Sync During Off-Hours**

CRON job runs at 8:00 AM MSK (production) with incremental sync.

---

## Performance Optimization

### Database Query Slow

```bash
# Check slow queries
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Add Indexes

```sql
-- Example: Add index on reviews.created_at for faster date filtering
CREATE INDEX CONCURRENTLY idx_reviews_created_at ON reviews(created_at);

-- Check existing indexes
\d+ reviews
```

---

## Health Checks

### Quick System Health Check

```bash
#!/bin/bash
echo "=== WB Reputation Manager Health Check ==="
echo ""

# 1. PM2 Status
echo "[1/5] PM2 Status:"
pm2 status wb-reputation
echo ""

# 2. Database Connection
echo "[2/5] Database Connection:"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT COUNT(*) as active_stores FROM stores WHERE status='active';"
echo ""

# 3. Nginx Status
echo "[3/5] Nginx Status:"
sudo systemctl status nginx --no-pager
echo ""

# 4. Disk Space
echo "[4/5] Disk Space:"
df -h /var/www/wb-reputation
echo ""

# 5. Recent Errors
echo "[5/5] Recent Errors (last 50 lines):"
pm2 logs wb-reputation --err --lines 50 --nostream
echo ""

echo "=== Health Check Complete ==="
```

---

## Getting Help

### Logs to Provide

When reporting issues, include:

```bash
# 1. PM2 status
pm2 status

# 2. Last 100 lines of logs
pm2 logs wb-reputation --lines 100 --nostream

# 3. Error logs only
pm2 logs wb-reputation --err --lines 100 --nostream

# 4. Environment info
node --version
npm --version
pm2 --version

# 5. Recent git commits
cd /var/www/wb-reputation && git log --oneline -5
```

### Useful Links

- **Production URL:** http://158.160.217.236
- **GitHub Repo:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **CRON Jobs:** [CRON_JOBS.md](./CRON_JOBS.md)

---

**Last Updated:** 2026-01-15
