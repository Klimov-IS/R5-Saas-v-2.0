# 🚀 Production Deployment Guide

Полное руководство по деплою WB Reputation Manager на Yandex Cloud.

## 📋 Информация о сервере

- **IP:** `158.160.229.16`
- **OS:** Ubuntu 24.04 LTS
- **Конфигурация:** 2 vCPU, 4GB RAM, 20GB SSD
- **Регион:** ru-central1-d

## 🔑 SSH-подключение

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.229.16
```

## 📦 Шаг 1: Настройка сервера

### 1.1 Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Установка Node.js 22

```bash
# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v22.x.x
npm --version
```

### 1.3 Установка PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Auto-start PM2 on boot
pm2 startup
# Copy and run the command that PM2 outputs
```

### 1.4 Установка Nginx

```bash
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 1.5 Установка Git

```bash
sudo apt install -y git
git --version
```

## 📂 Шаг 2: Клонирование проекта

```bash
# Create app directory
sudo mkdir -p /var/www
sudo chown -R ubuntu:ubuntu /var/www
cd /var/www

# Clone repository
git clone https://github.com/Klimov-IS/R5-Saas-v-2.0.git wb-reputation
cd wb-reputation
```

## 🔧 Шаг 3: Конфигурация приложения

### 3.1 Создать `.env.production`

```bash
nano .env.production
```

Вставьте следующую конфигурацию (замените значения):

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
NEXT_PUBLIC_API_URL=http://158.160.229.16:3000

# Port
PORT=3000

# 🚨 CRITICAL: CRON Jobs Configuration (Added 2026-03-13)
# DO NOT set this variable in production!
# CRON jobs run ONLY in wb-reputation-cron process (see Step 4.5)
# Setting this to 'true' will cause duplicate sends (main app has 2 instances in cluster mode)
# ENABLE_CRON_IN_MAIN_APP=false  # ← DO NOT UNCOMMENT in production!

# Deepseek AI (optional - если будете использовать AI)
# DEEPSEEK_API_KEY=your-key-here
```

Сохраните файл: `Ctrl+X`, затем `Y`, затем `Enter`

### 3.2 Установить зависимости

```bash
npm ci --production=false
```

### 3.3 Собрать проект

```bash
npm run build
```

## 🚀 Шаг 4: Запуск с PM2

### 4.1 PM2 ecosystem файл

Файл `ecosystem.config.js` уже включён в репозиторий. Он содержит все 3 процесса:

```javascript
// ecosystem.config.js (уже в репозитории)
module.exports = {
  apps: [
    {
      name: "wb-reputation",          // Main Next.js app + CRON (after trigger)
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",              // Fork mode (не cluster!) — см. docs/CRON_JOBS.md
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

**Почему fork mode (1 instance), а не cluster (2 instances):**
- `cronJobsStarted` — in-memory флаг, не расшарен между instance'ами cluster
- При cluster mode health check мог попасть на instance без CRON → re-trigger в другом → дубли
- Fork mode исключает эту проблему. 4GB RAM достаточно для 1 instance

### 4.2 Создать директорию для логов

```bash
mkdir -p logs
```

### 4.3 Запустить приложение

```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4.4 Проверить статус

```bash
pm2 status
pm2 logs wb-reputation --lines 50
```

### 4.5 Как работает CRON (архитектура)

**CRON jobs запускаются ТОЛЬКО в main app (`wb-reputation`), но триггерятся через HTTP:**

1. PM2 запускает `wb-reputation` → CRON остаётся ВЫКЛЮЧЕН (ждёт trigger)
2. PM2 запускает `wb-reputation-cron` → POST `/api/cron/trigger` → `forceCron: true` → CRON ВКЛЮЧЁН
3. Каждые 5 мин: health check → если CRON упал → re-trigger

**Проверка (после `pm2 start ecosystem.config.js`):**

```bash
# Должны увидеть 3 процесса
pm2 list

# Ожидаемый вывод:
# ┌─────┬──────────────────────┬─────────┬─────────┐
# │ id  │ name                 │ mode    │ status  │
# ├─────┼──────────────────────┼─────────┼─────────┤
# │ 0   │ wb-reputation        │ fork    │ online  │ ← Main app (1 instance)
# │ 1   │ wb-reputation-tg-bot │ fork    │ online  │ ← Telegram bot
# │ 2   │ wb-reputation-cron   │ fork    │ online  │ ← CRON manager
# └─────┴──────────────────────┴─────────┴─────────┘

# Проверить логи CRON manager
pm2 logs wb-reputation-cron --lines 20 --nostream

# Должны увидеть:
# [START-CRON] ✅ CRON jobs triggered!
# [START-CRON] 💓 Health OK: CRON running

# Проверить main app
pm2 logs wb-reputation --lines 30 --nostream | grep -E "INIT|CRON"

# Должны увидеть:
# [INIT] CRON jobs DISABLED in main app (waiting for /api/cron/trigger)
# [INIT] Starting CRON jobs via /api/cron/trigger (dedicated process)
# [INIT] ✅ CRON jobs started successfully
```

**Подробнее:** см. `docs/CRON_JOBS.md`

## 🌐 Шаг 5: Настройка Nginx

### 5.1 Создать конфигурацию Nginx

```bash
sudo nano /etc/nginx/sites-available/wb-reputation
```

Вставьте:

```nginx
server {
    listen 80;
    server_name 158.160.229.16;

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

### 5.2 Активировать конфигурацию

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

## ✅ Шаг 6: Проверка деплоя

### 6.1 Проверить приложение

```bash
# Check if app is running
pm2 status

# View logs
pm2 logs wb-reputation --lines 100

# Check app health
curl http://localhost:3000
```

### 6.2 Проверить через браузер

Откройте в браузере:
```
http://158.160.229.16
```

Вы должны увидеть главную страницу приложения!

## 🔄 Обновление приложения

Для обновления приложения после изменений в коде:

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

### ✅ Post-Deploy Verification Checklist

**Проверить в течение 5 минут после `pm2 restart all`:**

```bash
# 1. Все 3 процесса online
pm2 list
# → wb-reputation (fork, online), wb-reputation-tg-bot (fork, online), wb-reputation-cron (fork, online)

# 2. CRON triggered успешно
pm2 logs wb-reputation-cron --lines 20 --nostream | grep -E "triggered|Health"
# → [START-CRON] ✅ CRON jobs triggered!
# → [START-CRON] 💓 Health OK: CRON running

# 3. Health check API
curl -s localhost:3000/api/health | python3 -m json.tool
# → "status": "healthy", "cronJobs": { "cronRunning": true }

# 4. Dialogue sync работает
pm2 logs wb-reputation --lines 50 --nostream | grep "dialogue sync"
# → Свежие записи адаптивного sync

# 5. Нет критических ошибок
pm2 logs wb-reputation --lines 50 --nostream | grep -i "error\|failed" | grep -v "backfill"
# → Пусто или некритичные ошибки

# 6. TG bot работает
pm2 logs wb-reputation-tg-bot --lines 10 --nostream
# → Heartbeat или poll entries
```

**Если CRON не запустился:** `pm2 restart wb-reputation-cron` (auto-retrigger через 3s)

**Timing:**
- `pm2 restart all` → CRON downtime ~6s (cron manager auto-retriggers)
- `pm2 restart wb-reputation` → CRON downtime ~5min (health check detects)

### 🤖 Автоматический deploy (рекомендуется)

Для удобства создан скрипт `scripts/deploy.sh`, который выполняет все шаги автоматически:

```bash
cd /var/www/wb-reputation

# Make script executable (once)
chmod +x scripts/deploy.sh

# Run deployment
bash scripts/deploy.sh
```

Скрипт автоматически:
1. ✅ Подтягивает изменения из GitHub
2. ✅ Устанавливает зависимости
3. ✅ Собирает приложение
4. ✅ Перезапускает ОБА PM2 процесса
5. ✅ Проверяет успешность deploy

## 📊 Мониторинг и управление

### PM2 команды

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

### Nginx команды

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

## 🔒 Безопасность (Опционально)

### Настройка Firewall

```bash
# Enable UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (для будущего SSL)
sudo ufw enable

# Check status
sudo ufw status
```

### Automatic Security Updates

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## 🔐 SSL-сертификат (для домена)

Если в будущем подключите домен, установите Let's Encrypt:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (замените your-domain.com на ваш домен)
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

## 🐛 Troubleshooting

### Приложение не запускается

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

### Nginx не работает

```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Проблемы с подключением к PostgreSQL

```bash
# Test database connection from server
cd /var/www/wb-reputation
npx tsx scripts/test-db-connection.ts
```

### CRON jobs запускаются дважды (дубликаты)

**Проблема:** Сообщения отправляются 2-3 раза клиентам.

**Диагностика:**
```bash
# Проверить main app логи
pm2 logs wb-reputation --lines 100 --nostream | grep "CRON\|INIT"

# ❌ ПЛОХО: "Starting cron jobs" в main app
# ✅ ХОРОШО: "CRON jobs DISABLED in main app"

# Проверить сколько процессов запускают CRON
pm2 list | grep -E "wb-reputation|cron"
```

**Решение:**
```bash
# 1. Убедитесь что в .env.production НЕТ строки:
# ENABLE_CRON_IN_MAIN_APP=true

# 2. Перезапустить все процессы
pm2 restart all

# 3. Проверить логи снова
pm2 logs wb-reputation --lines 20 --nostream | grep INIT
# Должно быть: "CRON jobs DISABLED"
```

**Если проблема остается:**
```bash
# Emergency: остановить все CRON
pm2 stop wb-reputation-cron
cd /var/www/wb-reputation
node scripts/EMERGENCY-stop-auto-sequences.mjs

# Запустить только CRON процесс
pm2 start wb-reputation-cron
```

### Проверить использование ресурсов

```bash
# CPU and Memory
htop

# Disk space
df -h

# PM2 monitoring
pm2 monit
```

## 🚨 Emergency Scripts (Добавлено 2026-03-13)

В случае критических проблем с рассылками используйте emergency scripts.

### 1. Остановить все активные рассылки

**Когда использовать:**
- Клиенты получают дубликаты сообщений
- Рассылка отправляет слишком много сообщений
- Нужно срочно остановить все auto-sequences

**Команда:**
```bash
cd /var/www/wb-reputation
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

**Что делает:**
- Останавливает все активные sequences (status = 'stopped')
- Переводит чаты из `awaiting_reply` → `inbox`/`in_progress`
- Логирует количество остановленных sequences

**Ожидаемый вывод:**
```
🚨 ========== EMERGENCY AUTO-SEQUENCE STOP ==========
⚠️  Found 47 active sequences to stop...
✅ Successfully stopped 47 sequences:
   - no_reply_followup: 32 sequences
   - no_reply_followup_4star: 15 sequences
```

### 2. Проверить дубликаты и rapid sends

**Когда использовать:**
- После emergency stop
- Для мониторинга качества рассылок
- Для проверки после deployment

**Команда:**
```bash
cd /var/www/wb-reputation
node scripts/AUDIT-check-duplicate-sends.mjs
```

**Что проверяет:**
- Duplicate messages (одинаковый текст в один чат)
- Multiple active sequences per chat (должно быть max 1)
- Rapid sends (< 5 min между сообщениями)
- Stale processing locks (> 10 min)

**Ожидаемый вывод (здоровая система):**
```
✅ No duplicate messages found in last 24 hours
✅ No duplicate active sequences found
✅ No rapid sends detected (< 5 min apart)
⚠️  Found 2 stale processing locks (> 10 min)
```

### 3. Проверить статус sequences

**Команда:**
```bash
cd /var/www/wb-reputation
node scripts/check-sequences-status.mjs
```

**Что показывает:**
- Distribution by status (active, stopped, completed)
- Recently stopped sequences (last 24h)
- Stop reasons

### 4. Автоматический deployment с проверками

**Рекомендуется для обновлений:**
```bash
cd /var/www/wb-reputation
bash scripts/DEPLOY-EMERGENCY-FIX.sh
```

**Что делает:**
1. Останавливает active sequences (безопасность)
2. Останавливает CRON процесс
3. Запускает audit (before)
4. Билдит новую версию
5. Рестартует main app
6. Запускает CRON процесс
7. Проверяет успешность

**⚠️ Используйте только если:**
- Deployment связан с изменениями в CRON или auto-sequences
- Нужна дополнительная безопасность

Для обычных deployment используйте стандартный `scripts/deploy.sh`.

## 📝 Полезные логи

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

## 🎯 Итоговый чеклист

- [ ] Сервер настроен (Node.js, PM2, Nginx)
- [ ] Проект склонирован из GitHub
- [ ] `.env.production` создан с корректными данными
- [ ] **⚠️ ENABLE_CRON_IN_MAIN_APP НЕ установлена** (или закомментирована)
- [ ] Зависимости установлены (`npm ci`)
- [ ] Проект собран (`npm run build`)
- [ ] **Main app запущен** (`pm2 start ecosystem.config.js`)
- [ ] **CRON процесс запущен** (`pm2 start ecosystem-cron.config.js`)
- [ ] PM2 сохранен (`pm2 save`)
- [ ] **Проверка: Main app CRON disabled** (см. логи)
- [ ] **Проверка: CRON process initialized** (см. логи)
- [ ] Nginx настроен и перезагружен
- [ ] Приложение доступно по IP: http://158.160.229.16
- [ ] Логи проверены (нет критических ошибок)
- [ ] **Emergency scripts протестированы** (AUDIT-check-duplicate-sends.mjs)
- [ ] Firewall настроен (опционально)

## 📚 Related Documents

### Emergency Response (2026-03-13)
- **[Sprint Emergency CRON Fix](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/README.md)** - Полный спринт с исправлением дубликатов
- **[Deployment Report](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/DEPLOYMENT-REPORT-2026-03-13.md)** - Отчет о deployment 2026-03-13
- **[Architecture Audit](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/documentation/ARCHITECTURE-AUDIT-2026-03-13.md)** - Audit системы
- **[Sequence Restart Analysis](docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/SEQUENCE-RESTART-ANALYSIS.md)** - Анализ перезапуска sequences

### Documentation
- **Database Schema:** `docs/database-schema.md` (требует обновления)
- **CRON Jobs:** `docs/CRON_JOBS.md` (будет создан)
- **Troubleshooting:** `docs/TROUBLESHOOTING.md` (будет создан)

### Scripts
- **Emergency Scripts:** `scripts/EMERGENCY-*.mjs`
- **Audit Scripts:** `scripts/AUDIT-*.mjs`
- **Check Scripts:** `scripts/check-*.mjs`

## 🆘 Поддержка

Если возникли проблемы:
1. Проверьте PM2 логи: `pm2 logs wb-reputation` и `pm2 logs wb-reputation-cron`
2. Проверьте Nginx логи: `sudo tail -f /var/log/nginx/error.log`
3. Проверьте системные ресурсы: `htop`
4. Запустите audit: `node scripts/AUDIT-check-duplicate-sends.mjs`
5. Перезапустите процессы: `pm2 restart all`

**Emergency:** Если рассылки дублируются, см. секцию "Emergency Scripts" выше.

---

**Последнее обновление:** 2026-03-14
**Версия:** 2.1 (fork mode, CRON trigger architecture, post-deploy checklist)
