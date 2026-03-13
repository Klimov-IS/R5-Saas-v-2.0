# 🚨 EMERGENCY: Auto-Sequence Duplicate Sending - STOP GUIDE

**Проблема:** Система отправляет по 4 сообщения в магазин за несколько минут

**Дата:** 2026-03-13
**Статус:** 🔴 КРИТИЧНО - Требуется немедленная остановка

---

## 🎯 IMMEDIATE ACTION - Шаги для немедленной остановки

### Шаг 1: Остановить все активные авто-последовательности

```bash
# Подключитесь к production серверу через SSH
ssh your-server

# Перейдите в директорию проекта
cd /var/www/wb-reputation

# Запустите emergency скрипт
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

**Что делает скрипт:**
- ✅ Находит все активные `chat_auto_sequences`
- ✅ Останавливает их с причиной `emergency_stop`
- ✅ Обновляет статусы чатов с `awaiting_reply` → `inbox`/`in_progress`
- ✅ Предотвращает отправку новых сообщений

---

### Шаг 2: Остановить CRON процесс (временно)

```bash
# Остановите только cron процесс (оставьте главное приложение работать)
pm2 stop wb-reputation-cron

# Проверьте статус
pm2 list
```

**Ожидаемый результат:**
```
┌─────┬──────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                 │ status  │ restart │ uptime   │
├─────┼──────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ wb-reputation        │ online  │ 2       │ 5h       │
│ 1   │ wb-reputation-tg-bot │ online  │ 0       │ 5h       │
│ 2   │ wb-reputation-cron   │ stopped │ 0       │ 0s       │ ← STOPPED
└─────┴──────────────────────┴─────────┴─────────┴──────────┘
```

---

### Шаг 3: Запустить AUDIT для диагностики

```bash
# Проверьте дубликаты и проблемы
node scripts/AUDIT-check-duplicate-sends.mjs > audit-report-$(date +%Y%m%d-%H%M).txt

# Посмотрите отчет
cat audit-report-*.txt
```

**Что проверяет скрипт:**
1. ❌ Дубликаты сообщений (одинаковый текст в один чат несколько раз)
2. ❌ Несколько активных sequences для одного чата
3. ❌ Быстрые отправки (< 5 мин между сообщениями)
4. ⚠️  Застрявшие блокировки обработки
5. 📊 Статистика рассылки за последние 24 часа

---

## 🔍 DIAGNOSIS - Возможные причины проблемы

### Причина 1: Несколько экземпляров CRON процесса

**Проверка:**
```bash
pm2 list | grep cron
ps aux | grep "start-cron.js"
```

**Ожидается:** 1 процесс
**Если больше:** Есть дубликаты! Нужно убить лишние.

**Решение:**
```bash
# Остановите ВСЕ cron процессы
pm2 delete wb-reputation-cron

# Перезапустите ОДИН раз
pm2 start ecosystem.config.js --only wb-reputation-cron
```

---

### Причина 2: Cluster Mode для главного приложения

В [ecosystem.config.js:9](ecosystem.config.js#L9) указано:
```js
instances: 2,  // ← 2 экземпляра главного приложения
exec_mode: "cluster",
```

**Проблема:** Если CRON запускается через `instrumentation.ts`, то каждый из 2 экземпляров запустит свой CRON!

**Проверка:**
```bash
# Посмотрите логи главного приложения
pm2 logs wb-reputation --lines 100 | grep "CRON.*Auto-sequence"

# Если видите одинаковые логи 2 раза - это проблема!
```

**Решение:** CRON должен быть в отдельном процессе (уже так), но нужно убедиться, что он НЕ запускается из instrumentation.ts

---

### Причина 3: Нет concurrency protection

**Проверка кода:** [src/lib/cron-jobs.ts:629-633](src/lib/cron-jobs.ts#L629-L633)

```typescript
if (runningJobs[jobName]) {
  console.log(`[CRON] ⚠️  Auto-sequence processor already running, skipping`);
  return;
}
runningJobs[jobName] = true;
```

**Проблема:** `runningJobs` - это in-memory объект. Если 2 процесса работают → у каждого свой `runningJobs` → защита не работает!

**Решение:** Нужна database-level блокировка (уже есть `processing_locked_at` для отдельных sequences, но нет для всего job).

---

### Причина 4: PM2 restart spike

**Проверка:**
```bash
pm2 logs wb-reputation-cron --lines 200 | grep "Starting manual cron"
```

Если видите несколько "Starting" за короткое время → PM2 перезапускал процесс несколько раз.

**Причины перезапусков:**
- Crash из-за ошибки
- `max_restarts: 10` + `autorestart: true` → автоматический рестарт
- Deployment script запустил несколько раз

---

## 🛠️ FIXES - Постоянные решения

### Fix 1: Включить DRY RUN режим (временно)

Добавьте в `.env.production`:
```bash
AUTO_SEQUENCE_DRY_RUN=true
```

Перезапустите cron:
```bash
pm2 restart wb-reputation-cron
```

**Результат:** Cron будет работать, но НЕ будет отправлять сообщения (только логи).

---

### Fix 2: Добавить database-level job lock

**Новая таблица:** `cron_job_locks`

```sql
CREATE TABLE IF NOT EXISTS cron_job_locks (
  job_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT NOT NULL,  -- process.pid или hostname
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cron_locks_expires ON cron_job_locks(expires_at);
```

**Логика:**
```typescript
// Before running job
const lockResult = await query(
  `INSERT INTO cron_job_locks (job_name, locked_at, locked_by, expires_at)
   VALUES ($1, NOW(), $2, NOW() + INTERVAL '30 minutes')
   ON CONFLICT (job_name) DO UPDATE
     SET locked_at = NOW(), locked_by = $2, expires_at = NOW() + INTERVAL '30 minutes'
     WHERE cron_job_locks.expires_at < NOW()  -- Only lock if expired
   RETURNING job_name`,
  ['auto-sequence-processor', process.pid]
);

if (lockResult.rows.length === 0) {
  console.log('[CRON] Job locked by another process, skipping');
  return;
}
```

---

### Fix 3: Убрать CRON из instrumentation.ts

**Проверьте:** [instrumentation.ts](instrumentation.ts)

Если там есть вызовы `startAutoSequenceProcessor()` → удалите их!

CRON должен запускаться **ТОЛЬКО** из `wb-reputation-cron` процесса, **НЕ** из главного приложения.

---

### Fix 4: Добавить rate limiter для отправки

**Идея:** Глобальный лимит на отправку сообщений (например, не более 1 сообщения в минуту на чат).

**Новая таблица:** `message_send_rate_limits`

```sql
CREATE TABLE IF NOT EXISTS message_send_rate_limits (
  chat_id TEXT PRIMARY KEY,
  last_send_at TIMESTAMPTZ NOT NULL,
  send_count INTEGER DEFAULT 1
);

-- Before sending message, check:
SELECT last_send_at FROM message_send_rate_limits
WHERE chat_id = $1 AND last_send_at > NOW() - INTERVAL '1 minute';

-- If found → skip send
```

---

## 📊 MONITORING - После фикса

### Проверка 1: Логи автоматической рассылки

```bash
# Смотрите логи в реальном времени
pm2 logs wb-reputation-cron --lines 0

# Ожидаете увидеть каждые 30 минут:
# [CRON] 📨 Auto-sequence: X sent, Y stopped, Z skipped, 0 errors
```

**Тревога если:**
- Видите duplicate логи (один и тот же sequence ID отправляется дважды)
- Видите errors > 0 постоянно
- Видите "already running" каждые 30 секунд

---

### Проверка 2: Database queries

```sql
-- Проверьте нет ли чатов с несколькими активными sequences
SELECT chat_id, COUNT(*)
FROM chat_auto_sequences
WHERE status = 'active'
GROUP BY chat_id
HAVING COUNT(*) > 1;

-- Проверьте нет ли дубликатов сообщений за последний час
SELECT chat_id, text, COUNT(*), ARRAY_AGG(timestamp)
FROM chat_messages
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND sender = 'seller'
  AND is_auto_reply = TRUE
GROUP BY chat_id, text
HAVING COUNT(*) > 1;
```

---

### Проверка 3: PM2 process count

```bash
pm2 list
```

**Ожидаемое:**
- `wb-reputation`: 2 instances (cluster mode) ✅
- `wb-reputation-tg-bot`: 1 instance ✅
- `wb-reputation-cron`: 1 instance ✅ (НЕ 2, НЕ 3!)

---

## 📝 NEXT STEPS

После остановки рассылки:

1. ✅ Запустите emergency скрипт (остановка sequences)
2. ✅ Остановите cron процесс (pm2 stop)
3. ✅ Запустите audit скрипт (проверка дубликатов)
4. 📊 Проанализируйте отчет
5. 🔧 Примените нужные фиксы
6. 🧪 Включите DRY_RUN режим
7. ▶️  Перезапустите cron
8. 👀 Мониторьте логи 1 час
9. ✅ Выключите DRY_RUN если все ОК

---

**Created:** 2026-03-13
**Author:** Emergency Response Team
**Related Files:**
- [scripts/EMERGENCY-stop-auto-sequences.mjs](scripts/EMERGENCY-stop-auto-sequences.mjs)
- [scripts/AUDIT-check-duplicate-sends.mjs](scripts/AUDIT-check-duplicate-sends.mjs)
- [src/lib/cron-jobs.ts](src/lib/cron-jobs.ts)
- [ecosystem.config.js](ecosystem.config.js)
