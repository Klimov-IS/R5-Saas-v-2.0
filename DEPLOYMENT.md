# 🚀 Production Deployment Guide

Полное руководство по деплою WB Reputation Manager на Yandex Cloud.

## 📋 Информация о сервере

- **IP:** `158.160.217.236`
- **OS:** Ubuntu 24.04 LTS
- **Конфигурация:** 2 vCPU, 4GB RAM, 20GB SSD
- **Регион:** ru-central1-d

## 🔑 SSH-подключение

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
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
NEXT_PUBLIC_API_URL=http://158.160.217.236:3000

# Port
PORT=3000

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

### 4.1 Создать PM2 ecosystem файл

```bash
nano ecosystem.config.js
```

Вставьте:

```javascript
module.exports = {
  apps: [{
    name: 'wb-reputation',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/var/www/wb-reputation',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/wb-reputation/logs/error.log',
    out_file: '/var/www/wb-reputation/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
```

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

## 🌐 Шаг 5: Настройка Nginx

### 5.1 Создать конфигурацию Nginx

```bash
sudo nano /etc/nginx/sites-available/wb-reputation
```

Вставьте:

```nginx
server {
    listen 80;
    server_name 158.160.217.236;

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
http://158.160.217.236
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

# ⚠️ ВАЖНО: Restart BOTH PM2 processes (main app + cron jobs)
pm2 restart all

# Alternative: restart each process separately
# pm2 restart wb-reputation && pm2 restart wb-reputation-cron

# Check status
pm2 status

# Verify CRON jobs started
sleep 10
pm2 logs wb-reputation --lines 50 | grep CRON
```

**⚠️ Критически важно:**
- ВСЕГДА используйте `pm2 restart all` после deploy
- Это перезапускает как main app, так и CRON jobs процесс
- Если перезапустить только `wb-reputation`, CRON jobs остановятся!

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

### Проверить использование ресурсов

```bash
# CPU and Memory
htop

# Disk space
df -h

# PM2 monitoring
pm2 monit
```

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
- [ ] Зависимости установлены (`npm ci`)
- [ ] Проект собран (`npm run build`)
- [ ] PM2 запущен и сохранен (`pm2 start` + `pm2 save`)
- [ ] Nginx настроен и перезагружен
- [ ] Приложение доступно по IP: http://158.160.217.236
- [ ] Логи проверены (нет критических ошибок)
- [ ] Firewall настроен (опционально)

## 🆘 Поддержка

Если возникли проблемы:
1. Проверьте PM2 логи: `pm2 logs wb-reputation`
2. Проверьте Nginx логи: `sudo tail -f /var/log/nginx/error.log`
3. Проверьте системные ресурсы: `htop`
4. Перезапустите приложение: `pm2 restart wb-reputation`
