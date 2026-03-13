# 🚨 СРОЧНО: Остановка крон-рассылки

**Дата:** 2026-03-13
**Проблема:** По 4 сообщения в магазин за несколько минут
**Статус:** ✅ Фикс готов к деплою

---

## ⚡ ЧТО ДЕЛАТЬ ПРЯМО СЕЙЧАС (5 минут)

### 1️⃣ Подключитесь к production серверу

```bash
ssh your-production-server
cd /var/www/wb-reputation
```

---

### 2️⃣ Остановите все активные рассылки (EMERGENCY STOP)

```bash
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

**Ожидаемый результат:**
```
🚨 ========== EMERGENCY AUTO-SEQUENCE STOP ==========
⚠️  Found 47 active sequences to stop...
✅ Successfully stopped 47 sequences
```

**Что произошло:**
- ✅ Все активные авто-последовательности остановлены
- ✅ Новые сообщения НЕ будут отправляться
- ✅ Чаты переведены из `awaiting_reply` в `inbox`/`in_progress`

---

### 3️⃣ Остановите CRON процесс

```bash
pm2 stop wb-reputation-cron
```

**Проверьте статус:**
```bash
pm2 list
```

Должны увидеть:
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

## 🎯 ЧТО ПРОИЗОШЛО (Корневая причина)

**Нашёл проблему:** У вас **3 процесса** отправляют одни и те же сообщения:

1. **Main app (instance 1)** - cluster mode
2. **Main app (instance 2)** - cluster mode
3. **wb-reputation-cron** - отдельный процесс

**Файл-виновник:** [src/lib/init-server.ts:29](src/lib/init-server.ts#L29)

```typescript
// БЫЛО (запускалось в КАЖДОМ instance главного приложения):
export function initializeServer() {
  startAutoSequenceProcessor(); // ← 2× duplicate!
}
```

**Результат:** Каждое сообщение отправляется 3 раза!

---

## ✅ ЧТО Я ИСПРАВИЛ

### Изменение 1: Отключил CRON в главном приложении

**Файл:** [src/lib/init-server.ts](src/lib/init-server.ts)

```typescript
// СТАЛО (теперь проверяет переменную окружения):
export function initializeServer() {
  const enableCronInMainApp = process.env.ENABLE_CRON_IN_MAIN_APP === 'true';

  if (!enableCronInMainApp) {
    console.log('[INIT] ⚠️  CRON jobs DISABLED in main app');
    return; // ← Выход без запуска CRON
  }

  // Код ниже выполнится только если явно включено
  startAutoSequenceProcessor();
}
```

**Теперь:**
- ✅ Production: CRON работает **ТОЛЬКО** в `wb-reputation-cron` процессе
- ✅ Main app: CRON **отключен** (не запускается)
- ✅ Локальная разработка: можно включить через `ENABLE_CRON_IN_MAIN_APP=true`

---

### Изменение 2: Создал emergency скрипты

1. **EMERGENCY-stop-auto-sequences.mjs** - остановка всех рассылок
2. **AUDIT-check-duplicate-sends.mjs** - проверка дубликатов
3. **DEPLOY-EMERGENCY-FIX.sh** - автоматический деплой фикса

---

### Изменение 3: Создал миграцию для предотвращения

**Файл:** [migrations/999_emergency_prevent_duplicate_sequences.sql](migrations/999_emergency_prevent_duplicate_sequences.sql)

**Что делает:**
- ✅ Добавляет UNIQUE INDEX для предотвращения дубликатов
- ✅ Создает helper function `start_auto_sequence_safe()`
- ✅ Создает monitoring view `v_duplicate_sequences`
- ✅ Очищает старые блокировки (> 30 мин)

---

## 📋 ПОЛНЫЙ ДЕПЛОЙ (Выберите один вариант)

### ВАРИАНТ A: Автоматический (Рекомендуется) ⭐

```bash
# На production сервере
cd /var/www/wb-reputation
bash DEPLOY-EMERGENCY-FIX.sh
```

**Скрипт делает всё автоматически:**
1. ✅ Останавливает активные sequences
2. ✅ Останавливает CRON процесс
3. ✅ Запускает audit (сохраняет в logs/)
4. ✅ Билдит новую версию
5. ✅ Перезапускает main app
6. ✅ Запускает CRON процесс

**Время:** 3-5 минут

---

### ВАРИАНТ B: Вручную (Пошагово)

Если хотите контролировать каждый шаг:

#### Шаг 1: Остановите sequences (УЖЕ СДЕЛАНО ✅)

```bash
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

#### Шаг 2: Остановите CRON (УЖЕ СДЕЛАНО ✅)

```bash
pm2 stop wb-reputation-cron
```

#### Шаг 3: Audit (для истории)

```bash
mkdir -p logs
node scripts/AUDIT-check-duplicate-sends.mjs > logs/audit-before-fix-$(date +%Y%m%d-%H%M%S).txt
```

#### Шаг 4: Загрузите новый код

```bash
# Если код в Git
git pull origin main

# Или загрузите файлы вручную через scp/sftp:
# - src/lib/init-server.ts (исправленный)
# - scripts/EMERGENCY-stop-auto-sequences.mjs (новый)
# - scripts/AUDIT-check-duplicate-sends.mjs (новый)
# - migrations/999_emergency_prevent_duplicate_sequences.sql (новый)
```

#### Шаг 5: Запустите миграцию

```bash
psql $DATABASE_URL -f migrations/999_emergency_prevent_duplicate_sequences.sql
```

**Ожидаемый вывод:**
```
NOTICE: Cleaned up 0 duplicate active sequences
NOTICE: Released 3 stale processing locks (>30 min old)
NOTICE: ✅ Migration complete: Duplicate sequence prevention installed
```

#### Шаг 6: Билд и рестарт

```bash
# Билд
npm run build

# Рестарт main app (теперь без CRON)
pm2 restart wb-reputation

# Проверьте логи
pm2 logs wb-reputation --lines 20
```

**Должны увидеть:**
```
[INIT] ⚠️  CRON jobs DISABLED in main app (use wb-reputation-cron process)
[INIT] 💡 To enable in main app (local dev only): set ENABLE_CRON_IN_MAIN_APP=true
```

#### Шаг 7: Запустите CRON процесс

```bash
pm2 start wb-reputation-cron

# Проверьте логи
pm2 logs wb-reputation-cron --lines 50
```

**Должны увидеть:**
```
[START-CRON] ✅ Response: { success: true, message: 'Cron jobs initialized' }
[CRON] ✅ Auto-sequence processor started (every 30 min)
```

---

## ✅ ПРОВЕРКА (Через 30 минут)

### 1. Проверьте логи CRON процесса

```bash
pm2 logs wb-reputation-cron | grep "Auto-sequence"
```

**Должны увидеть (ОДИН раз, НЕ 3 раза):**
```
[CRON] 📨 Auto-sequence: 5 sent, 2 stopped, 3 skipped, 0 errors (42s)
```

---

### 2. Запустите audit снова

```bash
node scripts/AUDIT-check-duplicate-sends.mjs
```

**Ожидаемый результат:**
```
✅ No duplicate messages found in last 24 hours
✅ No duplicate active sequences found
✅ No rapid sends detected
```

---

### 3. Проверьте PM2 процессы

```bash
pm2 list
```

**Должно быть:**
- `wb-reputation`: 2 instances (cluster), `online` ✅
- `wb-reputation-tg-bot`: 1 instance, `online` ✅
- `wb-reputation-cron`: 1 instance, `online` ✅

---

### 4. Проверьте БД

```sql
-- Должно вернуть 0 rows (нет дубликатов)
SELECT chat_id, COUNT(*)
FROM chat_auto_sequences
WHERE status = 'active'
GROUP BY chat_id
HAVING COUNT(*) > 1;

-- Или используйте view
SELECT * FROM v_duplicate_sequences;
-- Должно быть пусто
```

---

## 🎯 ФИНАЛЬНЫЙ ЧЕКЛИСТ

После деплоя, убедитесь:

- [ ] **Emergency stop выполнен** - активные sequences остановлены
- [ ] **CRON процесс перезапущен** - `pm2 list` показывает `online`
- [ ] **Main app логи** - показывают "CRON jobs DISABLED"
- [ ] **CRON логи** - показывают "Auto-sequence processor started"
- [ ] **Миграция запущена** - UNIQUE INDEX создан
- [ ] **Через 30 мин:** один лог о рассылке (НЕ 3)
- [ ] **Audit чистый** - нет дубликатов
- [ ] **PM2 процессы** - все 3 процесса `online`

---

## 📁 ВАЖНЫЕ ФАЙЛЫ

### Исправления
- ✅ [src/lib/init-server.ts](src/lib/init-server.ts) - отключен CRON в main app
- ✅ [migrations/999_emergency_prevent_duplicate_sequences.sql](migrations/999_emergency_prevent_duplicate_sequences.sql) - защита от дубликатов

### Emergency Scripts
- 🚨 [scripts/EMERGENCY-stop-auto-sequences.mjs](scripts/EMERGENCY-stop-auto-sequences.mjs)
- 🔍 [scripts/AUDIT-check-duplicate-sends.mjs](scripts/AUDIT-check-duplicate-sends.mjs)
- 🚀 [DEPLOY-EMERGENCY-FIX.sh](DEPLOY-EMERGENCY-FIX.sh)

### Документация
- 📖 [EMERGENCY-FIX-SUMMARY.md](EMERGENCY-FIX-SUMMARY.md) - полное описание проблемы и решения
- 📖 [EMERGENCY-STOP-GUIDE.md](EMERGENCY-STOP-GUIDE.md) - подробный гайд по остановке
- 📖 [ecosystem.config.js](ecosystem.config.js) - конфигурация PM2

---

## 🆘 ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК

### Откат (Rollback)

```bash
# 1. Остановите CRON процесс
pm2 stop wb-reputation-cron

# 2. Временно включите CRON в main app
export ENABLE_CRON_IN_MAIN_APP=true
pm2 restart wb-reputation --update-env

# 3. Проверьте логи
pm2 logs wb-reputation | grep CRON
```

**Примечание:** Откат всё равно будет иметь дубликаты (2× main app instances), но хотя бы CRON будет работать.

---

### Telegram для связи

Если нужна помощь:
- 📱 Telegram: @your_telegram (если есть)
- 📧 Email: your@email.com (если есть)

---

## ⏰ ТАЙМЛАЙН

**Сейчас (0 мин):** Остановите sequences + CRON процесс ✅
**+5 мин:** Деплой фикса (автоматически или вручную)
**+10 мин:** Проверка логов и PM2
**+40 мин:** Проверка первой рассылки (через 30 мин после старта)
**+24 часа:** Мониторинг стабильности

---

**Создано:** 2026-03-13
**Статус:** ✅ ГОТОВО К ДЕПЛОЮ
**Приоритет:** 🔴 КРИТИЧЕСКИЙ

---

# 🚀 НАЧНИТЕ ЗДЕСЬ

```bash
# 1. Подключитесь к серверу
ssh your-production-server
cd /var/www/wb-reputation

# 2. Автоматический деплой (РЕКОМЕНДУЕТСЯ)
bash DEPLOY-EMERGENCY-FIX.sh

# ИЛИ ручной деплой (если нужен контроль)
# См. "ВАРИАНТ B: Вручную" выше
```

---

**Удачи! 🍀**
