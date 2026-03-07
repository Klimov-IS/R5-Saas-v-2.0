# Quick Reference - R5 Reputation Manager

**Last Updated:** 2026-03-06

---

## Production Server Info

| Item | Value |
|------|-------|
| **Domain** | `https://rating5.ru` (via Cloudflare, SSL Full Strict) |
| **IP** | `158.160.229.16` (dynamic — changes on VM stop!) |
| **SSH Key** | `~/.ssh/yandex-cloud-wb-reputation` |
| **User** | `ubuntu` |
| **App Path** | `/var/www/wb-reputation` |
| **Ports** | 3000 (internal), 80+443 (Nginx) |
| **SSL Cert** | `/etc/ssl/rating5/` (expires 2026-09-12) |

---

## PM2 Process Topology (4 processes)

| Process | Mode | Purpose |
|---------|------|---------|
| `wb-reputation` (x2) | cluster | Next.js web app (2 instances) |
| `wb-reputation-cron` | fork | Cron scheduler (triggers `/api/cron/trigger` on start) |
| `wb-reputation-tg-bot` | fork | Telegram bot (long-polling) |

**CRITICAL:** After `pm2 reload wb-reputation`, always also `pm2 restart wb-reputation-cron` — cron schedulers are in-memory and lost on reload.

**WARNING:** PM2 runs as `ubuntu` user — NEVER use `sudo pm2` (creates separate root daemon).

---

## SSH Access

```bash
# Connect to production
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.229.16

# One-line status check
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.229.16 "pm2 status"

# One-line logs (all processes)
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.229.16 "pm2 logs --lines 50 --nostream"
```

---

## Deployment

### One-Command Deploy (Recommended)

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.229.16 \
  "cd /var/www/wb-reputation && bash deploy/update-app.sh"
```

### Manual Deploy

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.229.16

cd /var/www/wb-reputation
git pull origin main
npm ci --production=false
npm run build
pm2 reload wb-reputation
pm2 restart wb-reputation-cron   # CRITICAL: always restart cron after reload
pm2 logs --lines 50 --nostream
```

---

## PM2 Commands

```bash
# Status of ALL processes
pm2 status

# Real-time logs (all processes)
pm2 logs

# Logs for specific process
pm2 logs wb-reputation              # web app
pm2 logs wb-reputation-cron         # cron process
pm2 logs wb-reputation-tg-bot      # telegram bot

# Last 100 lines (no streaming)
pm2 logs wb-reputation --lines 100 --nostream

# Error logs only
pm2 logs wb-reputation --err

# Monitor CPU/memory
pm2 monit

# Reload web app (zero-downtime) + restart cron
pm2 reload wb-reputation && pm2 restart wb-reputation-cron

# Restart specific process
pm2 restart wb-reputation-cron
pm2 restart wb-reputation-tg-bot

# Start all from config
pm2 start ecosystem.config.js

# Save current state
pm2 save
```

---

## Database Access

```bash
# Connect to production database (via Node.js scripts — psql not installed on server)
# Use scripts like: node scripts/run-migration-014.mjs

# Environment variables for DB connection:
# POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB (not POSTGRES_DATABASE!), POSTGRES_USER, POSTGRES_PASSWORD
```

### Useful Queries (run via scripts or pg admin)

```sql
-- Active stores count
SELECT COUNT(*) FROM stores WHERE status='active';

-- Total reviews
SELECT COUNT(*) FROM reviews;

-- Reviews by store (top 10)
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

-- Chat status distribution
SELECT status, COUNT(*) FROM chats GROUP BY status;

-- Active auto-sequences
SELECT status, COUNT(*) FROM chat_auto_sequences GROUP BY status;
```

---

## API Testing

### Authentication

Three auth methods:
1. **JWT** — httpOnly cookie `r5_token` (web dashboard)
2. **Bearer** — `Authorization: Bearer wbrm_*` (Extension API)
3. **Telegram** — `X-Telegram-Init-Data` header (TG Mini App)

### Common Endpoints

```bash
# Health check
curl https://rating5.ru/health

# List all stores (requires JWT cookie or Bearer token)
curl -X GET "https://rating5.ru/api/stores" \
  -H "Authorization: Bearer wbrm_YOUR_TOKEN"

# Sync products
curl -X POST "https://rating5.ru/api/stores/{storeId}/products/update" \
  -H "Authorization: Bearer wbrm_YOUR_TOKEN"

# Incremental review sync
curl -X POST "https://rating5.ru/api/stores/{storeId}/reviews/update?mode=incremental" \
  -H "Authorization: Bearer wbrm_YOUR_TOKEN"
```

---

## CRON Jobs Summary

| Job | Schedule | Description |
|-----|----------|-------------|
| Nightly full sync | `0 19 * * *` (22:00 MSK) | All 12 chunks, parallel |
| Midday catchup | `0 10 * * *` (13:00 MSK) | Chunk 0 only |
| Dialogue sync (WB) | Adaptive 5/15/60 min | 3-tier: work/transition/night |
| OZON chat sync | 5 min + hourly full | Hybrid: unread + safety net |
| Auto-sequence processor | Every 30 min | 8:00-22:00 MSK |
| Resolved-review closer | Every 30 min (:15/:45) | Auto-close on resolved reviews |
| Product Rules → Sheets | `0 3 * * *` (6:00 MSK) | Google Sheets sync |
| Client Directory → Sheets | `30 4 * * *` (7:30 MSK) | Google Sheets sync |

See [CRON_JOBS.md](./CRON_JOBS.md) for full details.

---

## Nginx

```bash
# Test configuration
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Config location
/etc/nginx/sites-available/wb-reputation

# SSL cert location
/etc/ssl/rating5/
```

---

## File Locations

| Item | Path |
|------|------|
| Application | `/var/www/wb-reputation` |
| Environment | `/var/www/wb-reputation/.env.local` |
| PM2 Config | `/var/www/wb-reputation/ecosystem.config.js` |
| Update Script | `/var/www/wb-reputation/deploy/update-app.sh` |
| Nginx Config | `/etc/nginx/sites-available/wb-reputation` |
| SSL Certs | `/etc/ssl/rating5/` |
| Nginx Logs | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| SSH Key | `~/.ssh/yandex-cloud-wb-reputation` (local machine) |

---

## Links

- **Production URL:** https://rating5.ru
- **GitHub:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **Deployment Guide:** [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **CRON Jobs:** [CRON_JOBS.md](./CRON_JOBS.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Development:** [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Database Schema:** [database-schema.md](./database-schema.md)

---

**Last Updated:** 2026-03-06
