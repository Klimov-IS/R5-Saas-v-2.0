# Quick Reference - WB Reputation Manager

**Last Updated:** 2026-01-15

---

## Production Server Info

| Item | Value |
|------|-------|
| **IP** | 158.160.217.236 |
| **SSH Key** | `~/.ssh/yandex-cloud-wb-reputation` |
| **User** | ubuntu |
| **App Path** | `/var/www/wb-reputation` |
| **Port** | 3000 (internal), 80 (external) |
| **PM2 App Name** | wb-reputation |

---

## SSH Access

```bash
# Connect to production
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# One-line status check
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 status"

# One-line logs
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation --lines 50 --nostream"
```

---

## Deployment

### One-Command Deploy (Recommended)

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cd /var/www/wb-reputation && bash deploy/update-app.sh"
```

### Manual Deploy

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

cd /var/www/wb-reputation
git pull origin main
npm ci --production=false
npm run build
pm2 reload wb-reputation
pm2 logs wb-reputation
```

---

## PM2 Commands

```bash
# Status
pm2 status

# Real-time logs
pm2 logs wb-reputation

# Last 100 lines (no streaming)
pm2 logs wb-reputation --lines 100 --nostream

# Error logs only
pm2 logs wb-reputation --err

# Monitor CPU/memory
pm2 monit

# Reload (zero-downtime)
pm2 reload wb-reputation

# Restart (with downtime)
pm2 restart wb-reputation

# Stop
pm2 stop wb-reputation

# Start
pm2 start ecosystem.config.js

# Detailed info
pm2 info wb-reputation

# Save current state
pm2 save
```

---

## Database Access

```bash
# Connect to production database
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation

# Quick query (one-line)
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT COUNT(*) FROM stores WHERE status='active';"
```

### Useful Queries

```sql
-- Active stores count
SELECT COUNT(*) FROM stores WHERE status='active';

-- Total reviews
SELECT COUNT(*) FROM reviews;

-- Reviews by store
SELECT s.name, COUNT(r.id) as review_count
FROM stores s
LEFT JOIN reviews r ON s.id = r.store_id
WHERE s.status = 'active'
GROUP BY s.id, s.name
ORDER BY review_count DESC
LIMIT 10;

-- Recent sync activity
SELECT name, last_review_sync_at, total_reviews
FROM stores
WHERE status='active'
ORDER BY last_review_sync_at DESC
LIMIT 10;

-- CRON job logs (if logged to DB)
SELECT * FROM logs
WHERE event_type = 'cron_sync'
ORDER BY created_at DESC
LIMIT 20;
```

---

## API Testing

### Authentication

All endpoints require:
```
Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

### Common Endpoints

```bash
# Health check
curl http://158.160.217.236/health

# List all stores
curl -X GET "http://158.160.217.236/api/stores" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Get store details
curl -X GET "http://158.160.217.236/api/stores/{storeId}" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Sync products
curl -X POST "http://158.160.217.236/api/stores/{storeId}/products/update" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Incremental review sync
curl -X POST "http://158.160.217.236/api/stores/{storeId}/reviews/update?mode=incremental" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Full review sync (use cautiously for large stores)
curl -X POST "http://158.160.217.236/api/stores/{storeId}/reviews/update?mode=full" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Get reviews (with filters)
curl -X GET "http://158.160.217.236/api/stores/{storeId}/reviews?rating=1&hasAnswer=false&limit=20" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Sync chats
curl -X POST "http://158.160.217.236/api/stores/{storeId}/dialogues/update" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Classify chats
curl -X POST "http://158.160.217.236/api/stores/{storeId}/chats/classify-all?limit=50" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Generate AI reply for review
curl -X POST "http://158.160.217.236/api/stores/{storeId}/reviews/{reviewId}/generate-reply" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Generate complaint for review
curl -X POST "http://158.160.217.236/api/stores/{storeId}/reviews/{reviewId}/generate-complaint" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
```

---

## CRON Jobs

### Check CRON Status

```bash
# View CRON initialization logs
pm2 logs wb-reputation | grep -E "INSTRUMENTATION|INIT|CRON"

# Check if CRON job is running
pm2 logs wb-reputation | grep "Daily review sync job started"

# View CRON execution logs
pm2 logs wb-reputation | grep "daily review sync"
```

### CRON Schedule

| Environment | Schedule | Description |
|-------------|----------|-------------|
| Production | `0 5 * * *` | Daily at 8:00 AM MSK (5:00 UTC) |
| Development | `*/5 * * * *` | Every 5 minutes |

**Stores synced:** Only `status='active'` stores (currently 43)

---

## Nginx

```bash
# Test configuration
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# Status
sudo systemctl status nginx

# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

---

## Git

```bash
# Check current branch and status
cd /var/www/wb-reputation
git status
git branch

# View recent commits
git log --oneline -10

# Discard local changes (before pulling)
git reset --hard HEAD

# Pull latest changes
git pull origin main

# View diff before pulling
git fetch
git diff main origin/main
```

---

## Environment Variables

```bash
# View production environment
cat /var/www/wb-reputation/.env.production

# Check specific variable
cat /var/www/wb-reputation/.env.production | grep POSTGRES_HOST

# Edit environment (use with caution)
nano /var/www/wb-reputation/.env.production

# After editing, reload PM2
pm2 reload wb-reputation
```

---

## Monitoring

### Quick Health Check Script

```bash
#!/bin/bash
echo "=== Quick Health Check ==="
echo "[1/4] PM2 Status:"
pm2 status wb-reputation
echo ""

echo "[2/4] API Health:"
curl -s http://localhost:3000/health | jq || echo "Health endpoint failed"
echo ""

echo "[3/4] Active Stores:"
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -t -c "SELECT COUNT(*) FROM stores WHERE status='active';"
echo ""

echo "[4/4] Recent Errors:"
pm2 logs wb-reputation --err --lines 10 --nostream
echo ""
echo "=== Done ==="
```

### Performance Check

```bash
# CPU and memory usage
pm2 monit

# Disk space
df -h /var/www/wb-reputation

# Network connections
sudo netstat -tulpn | grep :3000

# Process details
pm2 show wb-reputation
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs for errors
pm2 logs wb-reputation --err --lines 100

# Delete and restart
pm2 delete wb-reputation
pm2 start /var/www/wb-reputation/ecosystem.config.js
pm2 save
```

### Database Connection Issues

```bash
# Test connection
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT version();"

# Check active connections
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname='wb_reputation';"
```

### Build Fails

```bash
cd /var/www/wb-reputation

# Clear cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Port Already in Use

```bash
# Find process on port 3000
sudo lsof -i :3000

# Kill if needed
pm2 stop wb-reputation
pm2 start wb-reputation
```

---

## Local Development

```bash
# Clone repository
git clone https://github.com/Klimov-IS/R5-Saas-v-2.0.git
cd R5-Saas-v-2.0

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run dev server
npm run dev

# Access at http://localhost:9002
```

---

## File Locations

| Item | Path |
|------|------|
| Application | `/var/www/wb-reputation` |
| Environment | `/var/www/wb-reputation/.env.production` |
| PM2 Config | `/var/www/wb-reputation/ecosystem.config.js` |
| Update Script | `/var/www/wb-reputation/deploy/update-app.sh` |
| Nginx Config | `/etc/nginx/sites-available/wb-reputation` |
| Nginx Logs | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| SSH Key | `~/.ssh/yandex-cloud-wb-reputation` (local machine) |

---

## Important Store IDs (Examples)

```bash
# Тайди Центр (largest store: 1.3M+ reviews)
UiLCn5HyzRPphSRvR11G

# ИП Соколов А.А. (test store)
TwKRrPji2KhTS8TmYJlD

# Another test store
0rCKlFCdrT7L3B2ios45
```

---

## Links

- **Production URL:** http://158.160.217.236
- **GitHub:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **CRON Jobs:** [CRON_JOBS.md](./CRON_JOBS.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Development:** [DEVELOPMENT.md](./DEVELOPMENT.md)

---

**Last Updated:** 2026-01-15
