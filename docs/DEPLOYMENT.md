# Deployment Guide - WB Reputation Manager

**Last Updated:** 2026-01-15

---

## Production Environment

### Server Details
- **Provider:** Yandex Cloud Compute
- **IP Address:** 158.160.217.236
- **Region:** ru-central1-d
- **OS:** Ubuntu 24.04 LTS
- **Resources:** 2 vCPU, 4GB RAM, 20GB SSD
- **SSH Key:** `~/.ssh/yandex-cloud-wb-reputation`

### Application Configuration
- **Process Manager:** PM2 (3 processes: app cluster x2, cron fork, tg-bot fork)
- **Web Server:** Nginx (reverse proxy)
- **Node.js:** v22.21.0
- **Port:** 3000 (internal), 80 (external via Nginx)

---

## SSH Access

### Connect to Production Server

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
```

### One-Line Commands (from local machine)

Execute commands remotely without keeping SSH session open:

```bash
# Check application status
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 status"

# View recent logs
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation --lines 50 --nostream"

# Check disk space
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "df -h"
```

---

## Deployment Workflow

### Method 1: Automated Update Script (Recommended)

Run from **local machine** (one-line, zero-downtime):

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cd /var/www/wb-reputation && bash deploy/update-app.sh"
```

**What it does:**
1. Pulls latest code from GitHub (`main` branch)
2. Installs/updates dependencies (`npm ci`)
3. Rebuilds Next.js application (`npm run build`)
4. Reloads PM2 with zero-downtime (`pm2 reload`)
5. Shows application status

**Duration:** ~2-3 minutes

---

### Method 2: Manual Deployment (Step-by-Step)

If you need more control or troubleshooting:

```bash
# 1. SSH into server
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# 2. Navigate to project
cd /var/www/wb-reputation

# 3. Pull latest changes
git pull origin main

# 4. Install dependencies (production mode disabled to include devDependencies for build)
npm ci --production=false

# 5. Build application
npm run build

# 6. Reload PM2 (zero-downtime)
pm2 reload wb-reputation

# 7. Check status
pm2 status wb-reputation
pm2 logs wb-reputation --lines 50
```

---

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All changes tested locally (`npm run dev`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Environment variables verified in `.env.production`
- [ ] Database migrations applied (if needed)
- [ ] Git changes committed and pushed to `main` branch
- [ ] Production backup created (optional, for major changes)

---

## Post-Deployment Verification

After deployment, verify these endpoints:

```bash
# Health check
curl http://158.160.217.236/health

# API authentication
curl -X GET "http://158.160.217.236/api/stores" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Check response time
time curl -s http://158.160.217.236 > /dev/null
```

**Expected results:**
- Health endpoint returns 200 OK
- API returns store list (not 401/403)
- Response time < 2 seconds

---

## PM2 Management

### Common Commands

```bash
# View status
pm2 status

# View logs (real-time)
pm2 logs wb-reputation

# View last 100 lines
pm2 logs wb-reputation --lines 100 --nostream

# Monitor resources
pm2 monit

# Restart application (with downtime)
pm2 restart wb-reputation

# Reload application (zero-downtime)
pm2 reload wb-reputation

# Stop application
pm2 stop wb-reputation

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# View detailed info
pm2 info wb-reputation
```

### PM2 Configuration

Located at `/var/www/wb-reputation/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'wb-reputation',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production', PORT: 3000 }
    },
    {
      name: 'wb-reputation-cron',
      script: 'scripts/start-cron.js',
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'wb-reputation-tg-bot',
      script: 'scripts/start-telegram-bot.js',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
```

---

## Nginx Configuration

### Configuration File

Located at `/etc/nginx/sites-available/wb-reputation`:

```nginx
server {
    listen 80;
    server_name 158.160.217.236;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Environment Variables

Production environment variables are in `/var/www/wb-reputation/.env.production`.

**Never commit this file to Git!**

### Key Variables

```bash
# Database (Yandex Managed PostgreSQL)
POSTGRES_HOST=rc1a-xxx.mdb.yandexcloud.net
POSTGRES_PORT=6432
POSTGRES_DATABASE=wb_reputation
POSTGRES_USER=admin_R5
POSTGRES_PASSWORD=***

# AI Service
DEEPSEEK_API_KEY=sk-***

# Telegram Mini App
TELEGRAM_BOT_TOKEN=<token from @BotFather>
TELEGRAM_MINI_APP_URL=https://<your-domain>/tg

# Application
NODE_ENV=production
PORT=3000
API_KEY=wbrm_***
```

### Update Environment Variables

```bash
# Edit .env.production
nano /var/www/wb-reputation/.env.production

# After changes, reload PM2
pm2 reload wb-reputation
```

---

## Database Migrations

If you added new database migrations:

```bash
# SSH into server
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# Navigate to project
cd /var/www/wb-reputation

# Apply migrations manually via psql
# (migrations are in supabase/migrations/)

# Example:
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h rc1a-xxx.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -f supabase/migrations/XXX_migration_name.sql
```

---

## Troubleshooting Deployments

### Build Fails

```bash
# Clear .next cache and rebuild
rm -rf .next
npm run build
```

### PM2 Won't Start

```bash
# Check PM2 logs for errors
pm2 logs wb-reputation --err --lines 100

# Delete PM2 process and restart
pm2 delete wb-reputation
pm2 start ecosystem.config.js
pm2 save
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
pm2 stop wb-reputation
pm2 start wb-reputation
```

### Database Connection Issues

```bash
# Test database connectivity
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h rc1a-xxx.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation \
  -c "SELECT version();"

# Check environment variables are loaded
pm2 env 0  # Show env for first instance
```

---

## Rollback Procedure

If deployment causes issues:

```bash
# 1. SSH into server
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# 2. Navigate to project
cd /var/www/wb-reputation

# 3. Check git log
git log --oneline -10

# 4. Rollback to previous commit
git reset --hard <previous-commit-sha>

# 5. Rebuild and reload
npm ci --production=false
npm run build
pm2 reload wb-reputation

# 6. Verify
pm2 logs wb-reputation
```

---

## CRON Jobs Auto-Start

**IMPORTANT:** CRON jobs are initialized automatically on server start via `instrumentation.ts`.

- **No manual intervention required** after deployment
- CRON jobs start when PM2 reloads the application
- See [CRON_JOBS.md](./CRON_JOBS.md) for details

---

## Telegram Bot Process

TG бот — отдельный PM2 процесс (`wb-reputation-tg-bot`), long-polling, не зависит от Next.js.

### Commands

```bash
# Start bot
pm2 start ecosystem.config.js --only wb-reputation-tg-bot

# View bot logs
pm2 logs wb-reputation-tg-bot --lines 50 --nostream

# Restart bot
pm2 restart wb-reputation-tg-bot

# Stop bot (не влияет на основное приложение)
pm2 stop wb-reputation-tg-bot
```

### Setup (first time)

1. Create bot via [@BotFather](https://t.me/BotFather) → get token
2. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_MINI_APP_URL` to `.env.production`
3. Run `pm2 start ecosystem.config.js --only wb-reputation-tg-bot && pm2 save`
4. Configure Menu Button in BotFather → URL: `https://<domain>/tg`

### Troubleshooting

```bash
# Bot crashing? Check error logs
pm2 logs wb-reputation-tg-bot --err --lines 30

# Common issues:
# - Missing TELEGRAM_BOT_TOKEN → add to .env.production
# - Database connection → check POSTGRES_* vars in .env.production
# - Log permissions → chown ubuntu:ubuntu logs/tg-bot-*.log
```

---

## Monitoring After Deployment

### First 10 Minutes

```bash
# Watch logs in real-time
pm2 logs wb-reputation

# Monitor CPU/memory usage
pm2 monit

# Check for errors
pm2 logs wb-reputation --err
```

### First Hour

- Monitor API response times
- Check CRON job execution (if scheduled)
- Verify database connection stability
- Review Nginx access logs

### Daily Monitoring

```bash
# Check PM2 status
pm2 status

# Review logs for errors
pm2 logs wb-reputation --err --lines 100
```

---

## Emergency Contacts

- **Production URL:** http://158.160.217.236
- **GitHub Repo:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **Documentation:** See `/docs` folder

---

## Quick Reference

| Task | Command |
|------|---------|
| Deploy (one-line) | `ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "cd /var/www/wb-reputation && bash deploy/update-app.sh"` |
| Check status | `ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 status"` |
| View logs | `ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation --lines 50 --nostream"` |
| Restart app | `ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 reload wb-reputation"` |
| TG bot logs | `ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation-tg-bot --lines 50 --nostream"` |
| Restart TG bot | `ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 restart wb-reputation-tg-bot"` |

---

**Last Updated:** 2026-02-10
