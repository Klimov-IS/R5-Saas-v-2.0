# 🔧 CRON JOBS FIX GUIDE

## Проблема

Cron jobs не запускаются автоматически на production из-за того, что Next.js `instrumentation.ts` hook не срабатывает при запуске через PM2.

## Решения (3 способа)

### ✅ Решение 1: Ручной триггер через API (БЫСТРОЕ)

После деплоя вызовите API для запуска cron jobs:

```bash
curl -X POST "http://158.160.217.236/api/cron/trigger" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

**Проверка:**
```bash
curl -X GET "http://158.160.217.236/api/cron/trigger" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

Должен вернуть: `{"initialized": true, ...}`

---

### ✅ Решение 2: Добавить отдельный процесс в PM2 (НАДЁЖНОЕ)

Обновить `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
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
    },
    // ⬇️ НОВЫЙ ПРОЦЕСС ДЛЯ CRON JOBS
    {
      name: 'wb-reputation-cron',
      script: 'scripts/start-cron.js',
      cwd: '/var/www/wb-reputation',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/www/wb-reputation/logs/cron-error.log',
      out_file: '/var/www/wb-reputation/logs/cron-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '500M',
      watch: false
    }
  ]
};
```

**Применить:**
```bash
cd /var/www/wb-reputation
pm2 delete wb-reputation-cron  # Если уже существует
pm2 start ecosystem.config.js
pm2 save
```

---

### ✅ Решение 3: OS-level crontab (BACKUP)

Добавить в crontab как резервный механизм:

```bash
sudo crontab -e -u ubuntu
```

Добавить:

```cron
# WB Reputation Manager - Backup cron jobs
# Every hour - Reviews sync
0 * * * * curl -X POST "http://localhost:3000/api/stores/reviews/update-all" -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" >> /var/www/wb-reputation/logs/cron-backup.log 2>&1

# Every 15 minutes - Dialogues sync
*/15 * * * * curl -X POST "http://localhost:3000/api/stores/dialogues/update-all" -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" >> /var/www/wb-reputation/logs/cron-backup.log 2>&1

# Daily at 7:00 AM MSK (4:00 AM UTC) - Products sync
0 4 * * * curl -X POST "http://localhost:3000/api/stores/products/update-all" -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" >> /var/www/wb-reputation/logs/cron-backup.log 2>&1
```

---

## Шаги исправления на production

### 1. Обновить .env.production на сервере

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
cd /var/www/wb-reputation
nano .env.production
```

Добавить/обновить:

```env
# Для внутренних cron запросов
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 2. Задеплоить изменения

```bash
cd /var/www/wb-reputation
git pull origin main
npm run build
pm2 restart wb-reputation
```

### 3. Проверить логи instrumentation.ts

```bash
pm2 logs wb-reputation --lines 100 | grep INSTRUMENTATION
```

**Ожидаемый вывод:**
```
[INSTRUMENTATION] 📂 File loaded at: 2026-01-19T...
[INSTRUMENTATION] 🔧 register() function called
[INSTRUMENTATION] 🚀 Server starting, initializing cron jobs...
[INSTRUMENTATION] ✅ Cron jobs initialized successfully
```

**Если НЕТ логов** → instrumentation.ts не работает → используйте **Решение 1 или 2**

### 4. Если instrumentation.ts не работает, запустите вручную

**Вариант A: Через API (одноразово после каждого рестарта)**
```bash
curl -X POST "http://158.160.217.236/api/cron/trigger" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

**Вариант B: Добавить PM2 процесс (постоянно)**
Обновите `ecosystem.config.js` как показано в **Решении 2**

### 5. Проверить, что cron jobs работают

```bash
pm2 logs wb-reputation --lines 200 | grep CRON
```

**Ожидаемый вывод:**
```
[INIT] 🚀 Initializing server at 2026-01-19T...
[INIT] Starting cron jobs...
[CRON] Scheduling hourly review sync: 0 * * * *
[CRON] Mode: PRODUCTION (every hour)
[CRON] ✅ Hourly review sync job started successfully
[CRON] 🚀 Starting adaptive dialogue sync job...
[CRON] ✅ Adaptive dialogue sync scheduled (first run in 5 seconds)
[CRON] ✅ Daily product sync job started successfully
```

### 6. Проверить первое выполнение

Подождите 5 секунд (запуск dialogue sync), затем:

```bash
pm2 logs wb-reputation --lines 50 | grep "dialogue sync"
```

Должно появиться:
```
[CRON] 🔄 Starting adaptive dialogue sync at ...
[CRON] Found 49 stores to sync
[CRON] ✅ Dialogue sync completed
```

---

## Мониторинг

### Проверка статуса cron jobs

```bash
# Через API
curl -X GET "http://158.160.217.236/api/cron/status" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"

# Через логи
pm2 logs wb-reputation | grep -E "CRON|INIT"
```

### Проверка последних обновлений

```bash
# Логи PM2
pm2 logs wb-reputation --lines 500 | grep "Successfully synced"

# Или через API
curl -X GET "http://158.160.217.236/api/stores" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
  | jq '.[] | {name, last_review_update_date, total_reviews}'
```

---

## Troubleshooting

### Проблема: 401 Unauthorized при синхронизации

**Причина:** Неверный WB API токен для магазина

**Решение:** Обновить `feedbacks_api_token` в таблице `stores` для конкретного магазина

```sql
UPDATE stores
SET feedbacks_api_token = 'your-new-wb-token'
WHERE id = 'store-id-here';
```

### Проблема: Cron jobs не выполняются

**Проверки:**

1. **Инициализированы ли cron jobs?**
   ```bash
   curl http://158.160.217.236/api/cron/trigger \
     -H "Authorization: Bearer wbrm_..."
   ```

2. **Правильно ли установлен NODE_ENV?**
   ```bash
   pm2 env 0  # Проверить environment для процесса
   ```

3. **Есть ли ошибки в логах?**
   ```bash
   pm2 logs wb-reputation --err --lines 200
   ```

### Проблема: Rate Limit от WB API

Cron jobs уже настроены с задержками:
- 2-3 секунды между магазинами
- 10 секунд между date chunks
- 300ms между батчами

Если всё равно возникает rate limit → увеличить задержки в `cron-jobs.ts`

---

## Рекомендуемое решение

**Для production используйте комбинацию:**

1. ✅ **Решение 2** (PM2 процесс для cron) - основной механизм
2. ✅ **Решение 3** (OS crontab) - резервный механизм
3. ✅ **Решение 1** (API триггер) - для экстренного перезапуска

Это обеспечит **максимальную надёжность** автоматизации.
