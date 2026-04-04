# рџљЂ Production Deployment Guide

РџРѕР»РЅРѕРµ СЂСѓРєРѕРІРѕРґСЃС‚РІРѕ РїРѕ РґРµРїР»РѕСЋ WB Reputation Manager РЅР° Yandex Cloud.

## рџ“‹ РРЅС„РѕСЂРјР°С†РёСЏ Рѕ СЃРµСЂРІРµСЂРµ

- **IP:** `158.160.139.99`
- **OS:** Ubuntu 24.04 LTS
- **РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ:** 2 vCPU, 4GB RAM, 20GB SSD
- **Р РµРіРёРѕРЅ:** ru-central1-d

## рџ”‘ SSH-РїРѕРґРєР»СЋС‡РµРЅРёРµ

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.139.99
```

## рџ“¦ РЁР°Рі 1: РќР°СЃС‚СЂРѕР№РєР° СЃРµСЂРІРµСЂР°

### 1.1 РћР±РЅРѕРІР»РµРЅРёРµ СЃРёСЃС‚РµРјС‹

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 РЈСЃС‚Р°РЅРѕРІРєР° Node.js 22

```bash
# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v22.x.x
npm --version
```

### 1.3 РЈСЃС‚Р°РЅРѕРІРєР° PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Auto-start PM2 on boot
pm2 startup
# Copy and run the command that PM2 outputs
```

### 1.4 РЈСЃС‚Р°РЅРѕРІРєР° Nginx

```bash
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 1.5 РЈСЃС‚Р°РЅРѕРІРєР° Git

```bash
sudo apt install -y git
git --version
```

## рџ“‚ РЁР°Рі 2: РљР»РѕРЅРёСЂРѕРІР°РЅРёРµ РїСЂРѕРµРєС‚Р°

```bash
# Create app directory
sudo mkdir -p /var/www
sudo chown -R ubuntu:ubuntu /var/www
cd /var/www

# Clone repository
git clone https://github.com/Klimov-IS/R5-Saas-v-2.0.git wb-reputation
cd wb-reputation
```

## рџ”§ РЁР°Рі 3: РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ РїСЂРёР»РѕР¶РµРЅРёСЏ

### 3.1 РЎРѕР·РґР°С‚СЊ `.env.production`

```bash
nano .env.production
```

Р’СЃС‚Р°РІСЊС‚Рµ СЃР»РµРґСѓСЋС‰СѓСЋ РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ (Р·Р°РјРµРЅРёС‚Рµ Р·РЅР°С‡РµРЅРёСЏ):

```env
# Node Environment
NODE_ENV=production

# PostgreSQL (Yandex Managed Database)
POSTGRES_HOST=rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net
POSTGRES_PORT=6432
POSTGRES_DATABASE=wb_reputation
POSTGRES_USER=admin_R5
POSTGRES_PASSWORD=MyNewPass123

# Next.js
NEXT_PUBLIC_API_URL=http://158.160.139.99:3000

# Port
PORT=3000

# рџљЁ CRITICAL: CRON Jobs Configuration (Added 2026-03-13)
# DO NOT set this variable in production!
# CRON jobs run ONLY in wb-reputation-cron process (see Step 4.5)
# Setting this to 'true' will cause duplicate sends (main app has 2 instances in cluster mode)
# ENABLE_CRON_IN_MAIN_APP=false  # в†ђ DO NOT UNCOMMENT in production!

# Deepseek AI (optional - РµСЃР»Рё Р±СѓРґРµС‚Рµ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ AI)
# DEEPSEEK_API_KEY=your-key-here
```

РЎРѕС…СЂР°РЅРёС‚Рµ С„Р°Р№Р»: `Ctrl+X`, Р·Р°С‚РµРј `Y`, Р·Р°С‚РµРј `Enter`

### 3.2 РЈСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё

```bash
npm ci --production=false
```

### 3.3 РЎРѕР±СЂР°С‚СЊ РїСЂРѕРµРєС‚

```bash
npm run build
```

## рџљЂ РЁР°Рі 4: Р—Р°РїСѓСЃРє СЃ PM2

### 4.1 PM2 ecosystem С„Р°Р№Р»

Р¤Р°Р№Р» `ecosystem.config.js` СѓР¶Рµ РІРєР»СЋС‡С‘РЅ РІ СЂРµРїРѕР·РёС‚РѕСЂРёР№. РћРЅ СЃРѕРґРµСЂР¶РёС‚ РІСЃРµ 3 РїСЂРѕС†РµСЃСЃР°:

```javascript
// ecosystem.config.js (СѓР¶Рµ РІ СЂРµРїРѕР·РёС‚РѕСЂРёРё)
module.exports = {
  apps: [
    {
      name: "wb-reputation",          // Main Next.js app + CRON (after trigger)
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",              // Fork mode (РЅРµ cluster!) вЂ” СЃРј. docs/CRON_JOBS.md
      // ...
    },
    {
      name: "wb-reputation-tg-bot",   // Telegram bot
      script: "scripts/start-telegram-bot.js",
      // ...
    },
    {
      name: "wb-reputation-cron",     // CRON manager: triggers + monitors CRON via HTTP
      script: "scripts/start-cron.js",
      // ...
    }
  ]
};
```

**РџРѕС‡РµРјСѓ fork mode (1 instance), Р° РЅРµ cluster (2 instances):**
- `cronJobsStarted` вЂ” in-memory С„Р»Р°Рі, РЅРµ СЂР°СЃС€Р°СЂРµРЅ РјРµР¶РґСѓ instance'Р°РјРё cluster
- РџСЂРё cluster mode health check РјРѕРі РїРѕРїР°СЃС‚СЊ РЅР° instance Р±РµР· CRON в†’ re-trigger РІ РґСЂСѓРіРѕРј в†’ РґСѓР±Р»Рё
- Fork mode РёСЃРєР»СЋС‡Р°РµС‚ СЌС‚Сѓ РїСЂРѕР±Р»РµРјСѓ. 4GB RAM РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РґР»СЏ 1 instance

### 4.2 РЎРѕР·РґР°С‚СЊ РґРёСЂРµРєС‚РѕСЂРёСЋ РґР»СЏ Р»РѕРіРѕРІ

```bash
mkdir -p logs
```

### 4.3 Р—Р°РїСѓСЃС‚РёС‚СЊ РїСЂРёР»РѕР¶РµРЅРёРµ

```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4.4 РџСЂРѕРІРµСЂРёС‚СЊ СЃС‚Р°С‚СѓСЃ

```bash
pm2 status
pm2 logs wb-reputation --lines 50
```

### 4.5 РљР°Рє СЂР°Р±РѕС‚Р°РµС‚ CRON (Р°СЂС…РёС‚РµРєС‚СѓСЂР°)

**CRON jobs Р·Р°РїСѓСЃРєР°СЋС‚СЃСЏ РўРћР›Р¬РљРћ РІ main app (`wb-reputation`), РЅРѕ С‚СЂРёРіРіРµСЂСЏС‚СЃСЏ С‡РµСЂРµР· HTTP:**

1. PM2 Р·Р°РїСѓСЃРєР°РµС‚ `wb-reputation` в†’ CRON РѕСЃС‚Р°С‘С‚СЃСЏ Р’Р«РљР›Р®Р§Р•Рќ (Р¶РґС‘С‚ trigger)
2. PM2 Р·Р°РїСѓСЃРєР°РµС‚ `wb-reputation-cron` в†’ POST `/api/cron/trigger` в†’ `forceCron: true` в†’ CRON Р’РљР›Р®Р§РЃРќ
3. РљР°Р¶РґС‹Рµ 5 РјРёРЅ: health check в†’ РµСЃР»Рё CRON СѓРїР°Р» в†’ re-trigger

**РџСЂРѕРІРµСЂРєР° (РїРѕСЃР»Рµ `pm2 start ecosystem.config.js`):**

```bash
# Р”РѕР»Р¶РЅС‹ СѓРІРёРґРµС‚СЊ 3 РїСЂРѕС†РµСЃСЃР°
pm2 list

# РћР¶РёРґР°РµРјС‹Р№ РІС‹РІРѕРґ:
# в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
# в”‚ id  в”‚ name                 в”‚ mode    в”‚ status  в”‚
# в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
# в”‚ 0   в”‚ wb-reputation        в”‚ fork    в”‚ online  в”‚ в†ђ Main app (1 instance)
# в”‚ 1   в”‚ wb-reputation-tg-bot в”‚ fork    в”‚ online  в”‚ в†ђ Telegram bot
# в”‚ 2   в”‚ wb-reputation-cron   в”‚ fork    в”‚ online  в”‚ в†ђ CRON manager
# в””в”Ђв”Ђв”Ђв”Ђв”Ђв”ґв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ґв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ґв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

# РџСЂРѕРІРµСЂРёС‚СЊ Р»РѕРіРё CRON manager
pm2 logs wb-reputation-cron --lines 20 --nostream

# Р”РѕР»Р¶РЅС‹ СѓРІРёРґРµС‚СЊ:
# [START-CRON] вњ… CRON jobs triggered!
# [START-CRON] рџ’“ Health OK: CRON running

# РџСЂРѕРІРµСЂРёС‚СЊ main app
pm2 logs wb-reputation --lines 30 --nostream | grep -E "INIT|CRON"

# Р”РѕР»Р¶РЅС‹ СѓРІРёРґРµС‚СЊ:
# [INIT] CRON jobs DISABLED in main app (waiting for /api/cron/trigger)
# [INIT] Starting CRON jobs via /api/cron/trigger (dedicated process)
# [INIT] вњ… CRON jobs started successfully
```

**РџРѕРґСЂРѕР±РЅРµРµ:** СЃРј. `docs/CRON_JOBS.md`

## рџЊђ РЁР°Рі 5: РќР°СЃС‚СЂРѕР№РєР° Nginx

### 5.1 РЎРѕР·РґР°С‚СЊ РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ Nginx

```bash
sudo nano /etc/nginx/sites-available/wb-reputation
```

Р’СЃС‚Р°РІСЊС‚Рµ:

```nginx
server {
    listen 80;
    server_name 158.160.139.99;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Static files cache
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, max-age=3600, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
```

### 5.2 РђРєС‚РёРІРёСЂРѕРІР°С‚СЊ РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/wb-reputation /etc/nginx/sites-enabled/

# Remove default config
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## вњ… РЁР°Рі 6: РџСЂРѕРІРµСЂРєР° РґРµРїР»РѕСЏ

### 6.1 РџСЂРѕРІРµСЂРёС‚СЊ РїСЂРёР»РѕР¶РµРЅРёРµ

```bash
# Check if app is running
pm2 status

# View logs
pm2 logs wb-reputation --lines 100

# Check app health
curl http://localhost:3000
```

### 6.2 РџСЂРѕРІРµСЂРёС‚СЊ С‡РµСЂРµР· Р±СЂР°СѓР·РµСЂ

РћС‚РєСЂРѕР№С‚Рµ РІ Р±СЂР°СѓР·РµСЂРµ:
```
http://158.160.139.99
```

Р’С‹ РґРѕР»Р¶РЅС‹ СѓРІРёРґРµС‚СЊ РіР»Р°РІРЅСѓСЋ СЃС‚СЂР°РЅРёС†Сѓ РїСЂРёР»РѕР¶РµРЅРёСЏ!

## рџ”„ РћР±РЅРѕРІР»РµРЅРёРµ РїСЂРёР»РѕР¶РµРЅРёСЏ

Р”Р»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРёР»РѕР¶РµРЅРёСЏ РїРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёР№ РІ РєРѕРґРµ:

```bash
cd /var/www/wb-reputation

# Pull latest changes
git pull origin main

# Install dependencies (if package.json changed)
npm ci --production=false

# Rebuild application
npm run build

# Restart ALL PM2 processes
pm2 restart all
```

### вњ… Post-Deploy Verification Checklist

**РџСЂРѕРІРµСЂРёС‚СЊ РІ С‚РµС‡РµРЅРёРµ 5 РјРёРЅСѓС‚ РїРѕСЃР»Рµ `pm2 restart all`:**

```bash
# 1. Р’СЃРµ 3 РїСЂРѕС†РµСЃСЃР° online
pm2 list
# в†’ wb-reputation (fork, online), wb-reputation-tg-bot (fork, online), wb-reputation-cron (fork, online)

# 2. CRON triggered СѓСЃРїРµС€РЅРѕ
pm2 logs wb-reputation-cron --lines 20 --nostream | grep -E "triggered|Health"
# в†’ [START-CRON] вњ… CRON jobs triggered!
# в†’ [START-CRON] рџ’“ Health OK: CRON running

# 3. Health check API
curl -s localhost:3000/api/health | python3 -m json.tool
# в†’ "status": "healthy", "cronJobs": { "cronRunning": true }

# 4. Dialogue sync СЂР°Р±РѕС‚Р°РµС‚
pm2 logs wb-reputation --lines 50 --nostream | grep "dialogue sync"
# в†’ РЎРІРµР¶РёРµ Р·Р°РїРёСЃРё Р°РґР°РїС‚РёРІРЅРѕРіРѕ sync

# 5. РќРµС‚ РєСЂРёС‚РёС‡РµСЃРєРёС… РѕС€РёР±РѕРє
pm2 logs wb-reputation --lines 50 --nostream | grep -i "error\|failed" | grep -v "backfill"
# в†’ РџСѓСЃС‚Рѕ РёР»Рё РЅРµРєСЂРёС‚РёС‡РЅС‹Рµ РѕС€РёР±РєРё

# 6. TG bot СЂР°Р±РѕС‚Р°РµС‚
pm2 logs wb-reputation-tg-bot --lines 10 --nostream
# в†’ Heartbeat РёР»Рё poll entries
```

**Р•СЃР»Рё CRON РЅРµ Р·Р°РїСѓСЃС‚РёР»СЃСЏ:** `pm2 restart wb-reputation-cron` (auto-retrigger С‡РµСЂРµР· 3s)

**Timing:**
- `pm2 restart all` в†’ CRON downtime ~6s (cron manager auto-retriggers)
- `pm2 restart wb-reputation` в†’ CRON downtime ~5min (health check detects)

### рџ¤– РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ deploy (СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ)

Р”Р»СЏ СѓРґРѕР±СЃС‚РІР° СЃРѕР·РґР°РЅ СЃРєСЂРёРїС‚ `scripts/deploy.sh`, РєРѕС‚РѕСЂС‹Р№ РІС‹РїРѕР»РЅСЏРµС‚ РІСЃРµ С€Р°РіРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё:

```bash
cd /var/www/wb-reputation

# Make script executable (once)
chmod +x scripts/deploy.sh

# Run deployment
bash scripts/deploy.sh
```

РЎРєСЂРёРїС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё:
1. вњ… РџРѕРґС‚СЏРіРёРІР°РµС‚ РёР·РјРµРЅРµРЅРёСЏ РёР· GitHub
2. вњ… РЈСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё
3. вњ… РЎРѕР±РёСЂР°РµС‚ РїСЂРёР»РѕР¶РµРЅРёРµ
4. вњ… РџРµСЂРµР·Р°РїСѓСЃРєР°РµС‚ РћР‘Рђ PM2 РїСЂРѕС†РµСЃСЃР°
5. вњ… РџСЂРѕРІРµСЂСЏРµС‚ СѓСЃРїРµС€РЅРѕСЃС‚СЊ deploy

## рџ“Љ РњРѕРЅРёС‚РѕСЂРёРЅРі Рё СѓРїСЂР°РІР»РµРЅРёРµ

### PM2 РєРѕРјР°РЅРґС‹

```bash
# Show status
pm2 status

# Show detailed info
pm2 show wb-reputation

# View logs
pm2 logs wb-reputation
pm2 logs wb-reputation --lines 200
pm2 logs wb-reputation --err  # Only errors

# Restart
pm2 restart wb-reputation

# Stop
pm2 stop wb-reputation

# Start
pm2 start wb-reputation

# Reload (zero-downtime)
pm2 reload wb-reputation

# Monitor resources
pm2 monit

# CRON process commands
pm2 logs wb-reputation-cron         # View CRON logs
pm2 logs wb-reputation-cron --err   # Only CRON errors
pm2 restart wb-reputation-cron      # Restart CRON
pm2 stop wb-reputation-cron         # Stop CRON (emergencies only!)
```

### Nginx РєРѕРјР°РЅРґС‹

```bash
# Test config
sudo nginx -t

# Reload config
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log
```

## рџ”’ Р‘РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ (РћРїС†РёРѕРЅР°Р»СЊРЅРѕ)

### РќР°СЃС‚СЂРѕР№РєР° Firewall

```bash
# Enable UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (РґР»СЏ Р±СѓРґСѓС‰РµРіРѕ SSL)
sudo ufw enable

# Check status
sudo ufw status
```

### Automatic Security Updates

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## рџ”ђ SSL-СЃРµСЂС‚РёС„РёРєР°С‚ (РґР»СЏ РґРѕРјРµРЅР°)

Р•СЃР»Рё РІ Р±СѓРґСѓС‰РµРј РїРѕРґРєР»СЋС‡РёС‚Рµ РґРѕРјРµРЅ, СѓСЃС‚Р°РЅРѕРІРёС‚Рµ Let's Encrypt:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (Р·Р°РјРµРЅРёС‚Рµ your-domain.com РЅР° РІР°С€ РґРѕРјРµРЅ)
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

## рџђ› Troubleshooting

### РџСЂРёР»РѕР¶РµРЅРёРµ РЅРµ Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ

```bash
# Check PM2 logs
pm2 logs wb-reputation --err

# Check if port 3000 is in use
sudo netstat -tulpn | grep :3000

# Kill process on port 3000
sudo kill -9 $(sudo lsof -t -i:3000)

# Restart
pm2 restart wb-reputation
```

### Nginx РЅРµ СЂР°Р±РѕС‚Р°РµС‚

```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### РџСЂРѕР±Р»РµРјС‹ СЃ РїРѕРґРєР»СЋС‡РµРЅРёРµРј Рє PostgreSQL

```bash
# Test database connection from server
cd /var/www/wb-reputation
npx tsx scripts/test-db-connection.ts
```

### CRON jobs Р·Р°РїСѓСЃРєР°СЋС‚СЃСЏ РґРІР°Р¶РґС‹ (РґСѓР±Р»РёРєР°С‚С‹)

**РџСЂРѕР±Р»РµРјР°:** РЎРѕРѕР±С‰РµРЅРёСЏ РѕС‚РїСЂР°РІР»СЏСЋС‚СЃСЏ 2-3 СЂР°Р·Р° РєР»РёРµРЅС‚Р°Рј.

**Р”РёР°РіРЅРѕСЃС‚РёРєР°:**
```bash
# РџСЂРѕРІРµСЂРёС‚СЊ main app Р»РѕРіРё
pm2 logs wb-reputation --lines 100 --nostream | grep "CRON\|INIT"

# вќЊ РџР›РћРҐРћ: "Starting cron jobs" РІ main app
# вњ… РҐРћР РћРЁРћ: "CRON jobs DISABLED in main app"

# РџСЂРѕРІРµСЂРёС‚СЊ СЃРєРѕР»СЊРєРѕ РїСЂРѕС†РµСЃСЃРѕРІ Р·Р°РїСѓСЃРєР°СЋС‚ CRON
pm2 list | grep -E "wb-reputation|cron"
```

**Р РµС€РµРЅРёРµ:**
```bash
# 1. РЈР±РµРґРёС‚РµСЃСЊ С‡С‚Рѕ РІ .env.production РќР•Рў СЃС‚СЂРѕРєРё:
# ENABLE_CRON_IN_MAIN_APP=true

# 2. РџРµСЂРµР·Р°РїСѓСЃС‚РёС‚СЊ РІСЃРµ РїСЂРѕС†РµСЃСЃС‹
pm2 restart all

# 3. РџСЂРѕРІРµСЂРёС‚СЊ Р»РѕРіРё СЃРЅРѕРІР°
pm2 logs wb-reputation --lines 20 --nostream | grep INIT
# Р”РѕР»Р¶РЅРѕ Р±С‹С‚СЊ: "CRON jobs DISABLED"
```

**Р•СЃР»Рё РїСЂРѕР±Р»РµРјР° РѕСЃС‚Р°РµС‚СЃСЏ:**
```bash
# Emergency: РѕСЃС‚Р°РЅРѕРІРёС‚СЊ РІСЃРµ CRON
pm2 stop wb-reputation-cron
cd /var/www/wb-reputation
node scripts/EMERGENCY-stop-auto-sequences.mjs

# Р—Р°РїСѓСЃС‚РёС‚СЊ С‚РѕР»СЊРєРѕ CRON РїСЂРѕС†РµСЃСЃ
pm2 start wb-reputation-cron
```

### РџСЂРѕРІРµСЂРёС‚СЊ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ СЂРµСЃСѓСЂСЃРѕРІ

```bash
# CPU and Memory
htop

# Disk space
df -h

# PM2 monitoring
pm2 monit
```

## рџљЁ Emergency Scripts (Р”РѕР±Р°РІР»РµРЅРѕ 2026-03-13)

Р’ СЃР»СѓС‡Р°Рµ РєСЂРёС‚РёС‡РµСЃРєРёС… РїСЂРѕР±Р»РµРј СЃ СЂР°СЃСЃС‹Р»РєР°РјРё РёСЃРїРѕР»СЊР·СѓР№С‚Рµ emergency scripts.

### 1. РћСЃС‚Р°РЅРѕРІРёС‚СЊ РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ СЂР°СЃСЃС‹Р»РєРё

**РљРѕРіРґР° РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ:**
- РљР»РёРµРЅС‚С‹ РїРѕР»СѓС‡Р°СЋС‚ РґСѓР±Р»РёРєР°С‚С‹ СЃРѕРѕР±С‰РµРЅРёР№
- Р Р°СЃСЃС‹Р»РєР° РѕС‚РїСЂР°РІР»СЏРµС‚ СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёР№
- РќСѓР¶РЅРѕ СЃСЂРѕС‡РЅРѕ РѕСЃС‚Р°РЅРѕРІРёС‚СЊ РІСЃРµ auto-sequences

**РљРѕРјР°РЅРґР°:**
```bash
cd /var/www/wb-reputation
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

**Р§С‚Рѕ РґРµР»Р°РµС‚:**
- РћСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ sequences (status = 'stopped')
- РџРµСЂРµРІРѕРґРёС‚ С‡Р°С‚С‹ РёР· `awaiting_reply` в†’ `inbox`/`in_progress`
- Р›РѕРіРёСЂСѓРµС‚ РєРѕР»РёС‡РµСЃС‚РІРѕ РѕСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹С… sequences

**РћР¶РёРґР°РµРјС‹Р№ РІС‹РІРѕРґ:**
```
рџљЁ ========== EMERGENCY AUTO-SEQUENCE STOP ==========
вљ пёЏ  Found 47 active sequences to stop...
вњ… Successfully stopped 47 sequences:
   - no_reply_followup: 32 sequences
   - no_reply_followup_4star: 15 sequences
```

### 2. РџСЂРѕРІРµСЂРёС‚СЊ РґСѓР±Р»РёРєР°С‚С‹ Рё rapid sends

**РљРѕРіРґР° РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ:**
- РџРѕСЃР»Рµ emergency stop
- Р”Р»СЏ РјРѕРЅРёС‚РѕСЂРёРЅРіР° РєР°С‡РµСЃС‚РІР° СЂР°СЃСЃС‹Р»РѕРє
- Р”Р»СЏ РїСЂРѕРІРµСЂРєРё РїРѕСЃР»Рµ deployment

**РљРѕРјР°РЅРґР°:**
```bash
cd /var/www/wb-reputation
node scripts/AUDIT-check-duplicate-sends.mjs
```

**Р§С‚Рѕ РїСЂРѕРІРµСЂСЏРµС‚:**
- Duplicate messages (РѕРґРёРЅР°РєРѕРІС‹Р№ С‚РµРєСЃС‚ РІ РѕРґРёРЅ С‡Р°С‚)
- Multiple active sequences per chat (РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ max 1)
- Rapid sends (< 5 min РјРµР¶РґСѓ СЃРѕРѕР±С‰РµРЅРёСЏРјРё)
- Stale processing locks (> 10 min)

**РћР¶РёРґР°РµРјС‹Р№ РІС‹РІРѕРґ (Р·РґРѕСЂРѕРІР°СЏ СЃРёСЃС‚РµРјР°):**
```
вњ… No duplicate messages found in last 24 hours
вњ… No duplicate active sequences found
вњ… No rapid sends detected (< 5 min apart)
вљ пёЏ  Found 2 stale processing locks (> 10 min)
```

### 3. РџСЂРѕРІРµСЂРёС‚СЊ СЃС‚Р°С‚СѓСЃ sequences

**РљРѕРјР°РЅРґР°:**
```bash
cd /var/www/wb-reputation
node scripts/check-sequences-status.mjs
```

**Р§С‚Рѕ РїРѕРєР°Р·С‹РІР°РµС‚:**
- Distribution by status (active, stopped, completed)
- Recently stopped sequences (last 24h)
- Stop reasons

### 4. РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ deployment СЃ РїСЂРѕРІРµСЂРєР°РјРё

**Р РµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёР№:**
```bash
cd /var/www/wb-reputation
bash scripts/DEPLOY-EMERGENCY-FIX.sh
```

**Р§С‚Рѕ РґРµР»Р°РµС‚:**
1. РћСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ active sequences (Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ)
2. РћСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ CRON РїСЂРѕС†РµСЃСЃ
3. Р—Р°РїСѓСЃРєР°РµС‚ audit (before)
4. Р‘РёР»РґРёС‚ РЅРѕРІСѓСЋ РІРµСЂСЃРёСЋ
5. Р РµСЃС‚Р°СЂС‚СѓРµС‚ main app
6. Р—Р°РїСѓСЃРєР°РµС‚ CRON РїСЂРѕС†РµСЃСЃ
7. РџСЂРѕРІРµСЂСЏРµС‚ СѓСЃРїРµС€РЅРѕСЃС‚СЊ

**вљ пёЏ РСЃРїРѕР»СЊР·СѓР№С‚Рµ С‚РѕР»СЊРєРѕ РµСЃР»Рё:**
- Deployment СЃРІСЏР·Р°РЅ СЃ РёР·РјРµРЅРµРЅРёСЏРјРё РІ CRON РёР»Рё auto-sequences
- РќСѓР¶РЅР° РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅР°СЏ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ

Р”Р»СЏ РѕР±С‹С‡РЅС‹С… deployment РёСЃРїРѕР»СЊР·СѓР№С‚Рµ СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ `scripts/deploy.sh`.

## рџ“ќ РџРѕР»РµР·РЅС‹Рµ Р»РѕРіРё

```bash
# Application logs
pm2 logs wb-reputation

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
```

## рџЋЇ РС‚РѕРіРѕРІС‹Р№ С‡РµРєР»РёСЃС‚

- [ ] РЎРµСЂРІРµСЂ РЅР°СЃС‚СЂРѕРµРЅ (Node.js, PM2, Nginx)
- [ ] РџСЂРѕРµРєС‚ СЃРєР»РѕРЅРёСЂРѕРІР°РЅ РёР· GitHub
- [ ] `.env.production` СЃРѕР·РґР°РЅ СЃ РєРѕСЂСЂРµРєС‚РЅС‹РјРё РґР°РЅРЅС‹РјРё
- [ ] **вљ пёЏ ENABLE_CRON_IN_MAIN_APP РќР• СѓСЃС‚Р°РЅРѕРІР»РµРЅР°** (РёР»Рё Р·Р°РєРѕРјРјРµРЅС‚РёСЂРѕРІР°РЅР°)
- [ ] Р—Р°РІРёСЃРёРјРѕСЃС‚Рё СѓСЃС‚Р°РЅРѕРІР»РµРЅС‹ (`npm ci`)
- [ ] РџСЂРѕРµРєС‚ СЃРѕР±СЂР°РЅ (`npm run build`)
- [ ] **Main app Р·Р°РїСѓС‰РµРЅ** (`pm2 start ecosystem.config.js`)
- [ ] **CRON РїСЂРѕС†РµСЃСЃ Р·Р°РїСѓС‰РµРЅ** (`pm2 start ecosystem-cron.config.js`)
- [ ] PM2 СЃРѕС…СЂР°РЅРµРЅ (`pm2 save`)
- [ ] **РџСЂРѕРІРµСЂРєР°: Main app CRON disabled** (СЃРј. Р»РѕРіРё)
- [ ] **РџСЂРѕРІРµСЂРєР°: CRON process initialized** (СЃРј. Р»РѕРіРё)
- [ ] Nginx РЅР°СЃС‚СЂРѕРµРЅ Рё РїРµСЂРµР·Р°РіСЂСѓР¶РµРЅ
- [ ] РџСЂРёР»РѕР¶РµРЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ РїРѕ IP: http://158.160.139.99
- [ ] Р›РѕРіРё РїСЂРѕРІРµСЂРµРЅС‹ (РЅРµС‚ РєСЂРёС‚РёС‡РµСЃРєРёС… РѕС€РёР±РѕРє)
- [ ] **Emergency scripts РїСЂРѕС‚РµСЃС‚РёСЂРѕРІР°РЅС‹** (AUDIT-check-duplicate-sends.mjs)
- [ ] Firewall РЅР°СЃС‚СЂРѕРµРЅ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)

## рџ“љ Related Documents

### Emergency Response (2026-03-13)
- **[Sprint Emergency CRON Fix](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/README.md)** - РџРѕР»РЅС‹Р№ СЃРїСЂРёРЅС‚ СЃ РёСЃРїСЂР°РІР»РµРЅРёРµРј РґСѓР±Р»РёРєР°С‚РѕРІ
- **[Deployment Report](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/DEPLOYMENT-REPORT-2026-03-13.md)** - РћС‚С‡РµС‚ Рѕ deployment 2026-03-13
- **[Architecture Audit](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/documentation/ARCHITECTURE-AUDIT-2026-03-13.md)** - Audit СЃРёСЃС‚РµРјС‹
- **[Sequence Restart Analysis](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/SEQUENCE-RESTART-ANALYSIS.md)** - РђРЅР°Р»РёР· РїРµСЂРµР·Р°РїСѓСЃРєР° sequences

### Documentation
- **Database Schema:** `docs/database-schema.md` (С‚СЂРµР±СѓРµС‚ РѕР±РЅРѕРІР»РµРЅРёСЏ)
- **CRON Jobs:** `docs/CRON_JOBS.md` (Р±СѓРґРµС‚ СЃРѕР·РґР°РЅ)
- **Troubleshooting:** `docs/TROUBLESHOOTING.md` (Р±СѓРґРµС‚ СЃРѕР·РґР°РЅ)

### Scripts
- **Emergency Scripts:** `scripts/EMERGENCY-*.mjs`
- **Audit Scripts:** `scripts/AUDIT-*.mjs`
- **Check Scripts:** `scripts/check-*.mjs`

## рџ† РџРѕРґРґРµСЂР¶РєР°

Р•СЃР»Рё РІРѕР·РЅРёРєР»Рё РїСЂРѕР±Р»РµРјС‹:
1. РџСЂРѕРІРµСЂСЊС‚Рµ PM2 Р»РѕРіРё: `pm2 logs wb-reputation` Рё `pm2 logs wb-reputation-cron`
2. РџСЂРѕРІРµСЂСЊС‚Рµ Nginx Р»РѕРіРё: `sudo tail -f /var/log/nginx/error.log`
3. РџСЂРѕРІРµСЂСЊС‚Рµ СЃРёСЃС‚РµРјРЅС‹Рµ СЂРµСЃСѓСЂСЃС‹: `htop`
4. Р—Р°РїСѓСЃС‚РёС‚Рµ audit: `node scripts/AUDIT-check-duplicate-sends.mjs`
5. РџРµСЂРµР·Р°РїСѓСЃС‚РёС‚Рµ РїСЂРѕС†РµСЃСЃС‹: `pm2 restart all`

**Emergency:** Р•СЃР»Рё СЂР°СЃСЃС‹Р»РєРё РґСѓР±Р»РёСЂСѓСЋС‚СЃСЏ, СЃРј. СЃРµРєС†РёСЋ "Emergency Scripts" РІС‹С€Рµ.

---

**РџРѕСЃР»РµРґРЅРµРµ РѕР±РЅРѕРІР»РµРЅРёРµ:** 2026-03-14
**Р’РµСЂСЃРёСЏ:** 2.1 (fork mode, CRON trigger architecture, post-deploy checklist)
