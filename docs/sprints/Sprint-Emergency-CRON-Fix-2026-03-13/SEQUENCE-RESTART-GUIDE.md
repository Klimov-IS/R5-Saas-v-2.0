# 🔄 Sequence Restart Guide - Post-Emergency

**Дата:** 2026-03-13
**Статус:** Остановлено 2,075 sequences во время emergency stop
**Цель:** Безопасный перезапуск рассылок по кабинетам

---

## 📋 Процедура перезапуска

### Шаг 1: Анализ остановленных sequences

Запустите скрипт анализа для получения полной картины:

```bash
ssh ubuntu@158.160.229.16
cd /var/www/wb-reputation
node scripts/analyze-stopped-sequences.mjs
```

**Что покажет скрипт:**
- ✅ Общая статистика (сколько остановлено, какие кабинеты)
- ✅ Разбивка по кабинетам (количество, прогресс)
- ✅ Разбивка по типам sequences
- ✅ Сообщения отправленные сегодня (потенциальные дубли)
- ✅ Рекомендации по перезапуску
- ✅ Команды для перезапуска по каждому кабинету

**Пример вывода:**
```
📊 OVERALL STATISTICS:
─────────────────────────────────────────────────────────────
Total stopped sequences: 2075
Stores affected: 12
Chats affected: 2075
First stopped: 2026-03-13 12:15:00
Last stopped: 2026-03-13 12:15:30

📦 BREAKDOWN BY STORE:
─────────────────────────────────────────────────────────────
1. Тайди Центр
   Store ID: abc123
   Sequences: 450 | Chats: 450
   Progress: avg=2.3, min=0, max=6
   Distribution: step_0=12, step_1-2=380, step_3-4=45, step_5+=13

...
```

---

### Шаг 2: Проверка текущего состояния (ВАЖНО!)

Перед перезапуском убедитесь, что:

#### 2.1. CRON работает корректно (без дублей)

```bash
# Проверить логи за последние 30 минут
pm2 logs wb-reputation-cron --lines 200 | grep "Auto-sequence"

# Должна быть ОДНА запись каждые 30 минут (не 3!)
# ✅ Хорошо:
[CRON] 📨 Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors

# ❌ Плохо (если видите 3 записи - НЕ ПЕРЕЗАПУСКАЙТЕ!):
[CRON] 📨 Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors
[CRON] 📨 Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors
[CRON] 📨 Auto-sequence: 5 sent, 0 stopped, 10 skipped, 0 errors
```

#### 2.2. Нет дубликатов в базе

```bash
node scripts/AUDIT-check-duplicate-sends.mjs

# Ожидаемый результат:
# ✅ No duplicate messages found
# ✅ No duplicate active sequences
# ✅ No rapid sends detected
```

#### 2.3. Database protection работает

```bash
# Подключитесь к БД
psql $DATABASE_URL

# Проверьте UNIQUE INDEX
SELECT indexname FROM pg_indexes
WHERE tablename = 'chat_auto_sequences'
  AND indexname = 'idx_unique_active_sequence_per_chat';

# Должен вернуть: idx_unique_active_sequence_per_chat

# Проверьте view (должен быть пустым!)
SELECT * FROM v_duplicate_sequences;

# Должен вернуть 0 rows
```

---

### Шаг 3: Выбор кабинета для перезапуска

**Стратегия:** Начинайте с кабинетов с высоким прогрессом (step 5+)

**Критерии выбора:**
1. ✅ **High Priority:** Sequences с current_step >= 5 (уже отправлено 5+ сообщений)
2. ⚠️  **Medium Priority:** Sequences с current_step 3-4 (умеренный прогресс)
3. ❌ **Low Priority:** Sequences с current_step 0-2 (лучше создать новые)

**Из вывода analyze-stopped-sequences.mjs выберите кабинет:**

```
📋 STORES FOR MANUAL RESTART:
─────────────────────────────────────────────────────────────
1. Тайди Центр
   Command: node scripts/restart-sequences-by-store.mjs "abc123"
```

---

### Шаг 4: Dry Run (предварительный просмотр)

**ВСЕГДА** сначала запускайте в DRY_RUN режиме!

```bash
# Default: DRY_RUN=true (безопасно)
node scripts/restart-sequences-by-store.mjs "abc123"

# Или явно указать:
DRY_RUN=true node scripts/restart-sequences-by-store.mjs "abc123"
```

**Скрипт покажет:**
- ✅ Сколько sequences будет перезапущено
- ✅ Распределение по прогрессу (current_step)
- ✅ Какие sequences отфильтрованы и почему:
  - Client replied (клиент ответил - пропустить)
  - Messages sent today (сегодня уже отправлялись - пропустить)
  - Chat closed (чат закрыт - пропустить)
  - Already has active sequence (уже есть активная - пропустить)
- ✅ Первые 10 sequences с деталями

**Пример вывода:**
```
🛡️  Applying safety filters...

Safety Filter Results:
  ✅ Safe to restart: 13
  ⚠️  Client replied (skip): 5
  ⚠️  Messages sent today (skip): 2
  ⚠️  Chat closed (skip): 3
  ⚠️  Already has active sequence (skip): 0

📊 Distribution of safe sequences by progress:
   Step 6: 5 sequences
   Step 5: 8 sequences

📋 Sequences to restart (first 10):
─────────────────────────────────────────────────────────────
1. Chat: Анна (Платье летнее)
   Progress: 6/15 (type: no_reply_followup_30d)
   Last sent: 2026-03-10 14:23:00
   Status: awaiting_reply

...
```

---

### Шаг 5: Проверка результатов Dry Run

**Проверьте:**

1. ✅ Количество sequences для перезапуска разумное (не тысячи!)
2. ✅ Нет sequences с messages_sent_today > 0
3. ✅ Все sequences имеют current_step >= 3 (по умолчанию)
4. ✅ Нет дубликатов (already_active = 0)

**Если всё ОК — переходите к выполнению:**

---

### Шаг 6: Выполнение перезапуска

```bash
# ВНИМАНИЕ: Это внесёт изменения в БД!
DRY_RUN=false node scripts/restart-sequences-by-store.mjs "abc123"
```

**Скрипт выполнит:**
1. Найдёт все остановленные sequences для кабинета
2. Применит safety filters (client replied, sent today, chat closed, duplicates)
3. Обновит каждый безопасный sequence:
   - `status = 'active'`
   - `stop_reason = NULL`
   - `next_send_at = tomorrow + random hour (10-17 MSK)`
   - `updated_at = NOW()`

**Пример вывода:**
```
🚀 Restarting sequences...

✅ Restarted: Анна (step 6/15, next send: 2026-03-14T10:23:00.000Z)
✅ Restarted: Мария (step 5/15, next send: 2026-03-14T12:45:00.000Z)
...

═══════════════════════════════════════════════════════════════
📊 RESTART SUMMARY:
   ✅ Successfully restarted: 13
   ❌ Failed: 0
   ⏭️  Skipped (safety filters): 10
═══════════════════════════════════════════════════════════════
```

---

### Шаг 7: Мониторинг после перезапуска

**Сразу после перезапуска:**

```bash
# 1. Проверить что sequences стали active
psql $DATABASE_URL -c "
SELECT
  status,
  COUNT(*) as count,
  MIN(next_send_at) as earliest_send,
  MAX(next_send_at) as latest_send
FROM chat_auto_sequences
WHERE store_id = 'abc123'
  AND updated_at > NOW() - INTERVAL '5 minutes'
GROUP BY status;
"

# Ожидаемый результат:
#  status  | count | earliest_send       | latest_send
# ---------+-------+---------------------+---------------------
#  active  |    13 | 2026-03-14 10:15:00 | 2026-03-14 16:45:00
```

**Через 24 часа (когда отправятся сообщения):**

```bash
# 2. Проверить что нет дубликатов
node scripts/AUDIT-check-duplicate-sends.mjs

# 3. Проверить логи CRON
pm2 logs wb-reputation-cron --lines 100 | grep "Auto-sequence"

# Должна быть ОДНА запись каждые 30 минут
```

**Через 48 часов:**

```bash
# 4. Проверить прогресс sequences
psql $DATABASE_URL -c "
SELECT
  current_step,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_sent_at)) / 86400) as avg_days_since_last
FROM chat_auto_sequences
WHERE store_id = 'abc123'
  AND status = 'active'
GROUP BY current_step
ORDER BY current_step;
"
```

---

## ⚙️ Опции скрипта restart-sequences-by-store.mjs

### MIN_STEP - минимальный прогресс

По умолчанию перезапускаются только sequences с `current_step >= 3`.

**Изменить фильтр:**

```bash
# Перезапустить только sequences с прогрессом >= 5
MIN_STEP=5 DRY_RUN=true node scripts/restart-sequences-by-store.mjs "abc123"

# Перезапустить ВСЕ sequences (не рекомендуется!)
MIN_STEP=0 DRY_RUN=true node scripts/restart-sequences-by-store.mjs "abc123"
```

### DRY_RUN - режим предварительного просмотра

```bash
# Dry run (default) - НЕ вносит изменения
DRY_RUN=true node scripts/restart-sequences-by-store.mjs "abc123"
node scripts/restart-sequences-by-store.mjs "abc123"  # same

# Execute - ВНОСИТ изменения
DRY_RUN=false node scripts/restart-sequences-by-store.mjs "abc123"
```

---

## 🛡️ Safety Features (встроенная защита)

Скрипт restart-sequences-by-store.mjs имеет **многоуровневую защиту**:

### 1. Database-Level Protection (migration 999)

- ✅ **UNIQUE INDEX** `idx_unique_active_sequence_per_chat`
  - Невозможно создать 2 active sequences для одного чата
  - Ошибка на уровне PostgreSQL

### 2. Application-Level Filters

- ✅ **Client replied** - Пропускает sequences где клиент уже ответил
- ✅ **Messages sent today** - Пропускает чаты где сегодня уже отправлялись auto-messages
- ✅ **Chat closed** - Пропускает чаты со статусом `closed`
- ✅ **Already active** - Пропускает чаты с уже активной sequence

### 3. Time-Based Protection

- ✅ **next_send_at = tomorrow** - Следующее сообщение НЕ РАНЬШЕ завтра
- ✅ **Random time distribution** - Сообщения распределены в рабочие часы (10-17 MSK)
- ✅ **No same-day sends** - Фильтрует sequences с messages_sent_today > 0

### 4. Progress-Based Filtering

- ✅ **MIN_STEP >= 3** (default) - Только sequences с существенным прогрессом
- ✅ **Prevents low-value restarts** - Sequences с 0-2 шагами лучше создать заново

---

## 📊 Рекомендуемая последовательность

### День 1 (сегодня, 2026-03-13):

**Цель:** Анализ и подготовка

1. ✅ Запустить `analyze-stopped-sequences.mjs`
2. ✅ Проверить CRON работает без дублей
3. ✅ Запустить audit script
4. ✅ Выбрать 1-2 кабинета с высоким прогрессом (step 5+)
5. ✅ Запустить dry run для выбранных кабинетов

**НЕ перезапускайте sequences сегодня** - подождите до завтра, чтобы избежать same-day sends.

### День 2 (завтра, 2026-03-14):

**Цель:** Первый тестовый перезапуск

1. ✅ Выбрать 1 кабинет с ~10-20 sequences (step 5+)
2. ✅ Dry run для проверки
3. ✅ Выполнить перезапуск (`DRY_RUN=false`)
4. ✅ Мониторить 24 часа

### День 3 (2026-03-15):

**Цель:** Проверка первого кабинета

1. ✅ Запустить audit script
2. ✅ Проверить логи CRON
3. ✅ Убедиться нет дублей

**Если всё ОК:**
- Перезапустить ещё 2-3 кабинета
- Продолжить мониторинг

**Если есть проблемы:**
- Остановить перезапуск
- Запустить emergency stop
- Исследовать проблему

### Дни 4-7 (2026-03-16 - 2026-03-19):

**Цель:** Постепенный перезапуск остальных кабинетов

1. ✅ Перезапускать по 3-5 кабинетов в день
2. ✅ Мониторить каждый перезапуск
3. ✅ Запускать audit script ежедневно

---

## 🚨 Emergency: Что делать если обнаружены дубли

Если во время мониторинга обнаружены дубликаты:

### 1. Немедленно остановить все sequences:

```bash
node scripts/EMERGENCY-stop-auto-sequences.mjs
```

### 2. Проверить CRON процесс:

```bash
pm2 logs wb-reputation-cron | grep "Auto-sequence"

# Должна быть ОДНА запись каждые 30 минут!
```

### 3. Проверить main app (не должен запускать CRON):

```bash
pm2 logs wb-reputation | grep "CRON jobs DISABLED"

# Должно быть: "[INIT] ⚠️  CRON jobs DISABLED in main app"
```

### 4. Запустить полный audit:

```bash
node scripts/AUDIT-check-duplicate-sends.mjs
```

### 5. Связаться с разработчиком

Если проблема не в CRON процессах - возможно database protection не работает.

---

## 📝 Логирование

Все скрипты логируют результаты. Сохраняйте вывод для истории:

```bash
# Сохранить анализ
node scripts/analyze-stopped-sequences.mjs > logs/sequence-analysis-$(date +%Y%m%d).txt

# Сохранить dry run
node scripts/restart-sequences-by-store.mjs "abc123" > logs/restart-dryrun-abc123-$(date +%Y%m%d).txt

# Сохранить выполнение
DRY_RUN=false node scripts/restart-sequences-by-store.mjs "abc123" > logs/restart-execute-abc123-$(date +%Y%m%d).txt
```

---

## ✅ Checklist: Готовность к перезапуску

Перед перезапуском любого кабинета убедитесь:

- [ ] ✅ CRON процесс работает корректно (одна запись каждые 30 мин)
- [ ] ✅ Main app НЕ запускает CRON (`CRON jobs DISABLED` в логах)
- [ ] ✅ Audit script не показывает дубликатов
- [ ] ✅ Database protection работает (UNIQUE INDEX + view пустой)
- [ ] ✅ Запущен analyze-stopped-sequences.mjs
- [ ] ✅ Выбран кабинет с разумным количеством sequences (<50)
- [ ] ✅ Запущен dry run и результаты проверены
- [ ] ✅ Нет sequences с messages_sent_today > 0
- [ ] ✅ Все sequences имеют current_step >= 3 (или выбран MIN_STEP)

---

## 📚 Связанные документы

- [SEQUENCE-RESTART-ANALYSIS.md](SEQUENCE-RESTART-ANALYSIS.md) - Детальный анализ 2,075 остановленных sequences
- [DEPLOYMENT-REPORT-2026-03-13.md](DEPLOYMENT-REPORT-2026-03-13.md) - Отчёт о deployment emergency fix
- [BACKLOG.md](BACKLOG.md) - Sprint backlog с задачами
- [CRON_JOBS.md](../../CRON_JOBS.md) - Документация CRON процессов

---

**Создано:** 2026-03-13
**Автор:** Claude Code Assistant
**Статус:** Active Guide
**Следующее обновление:** После первого successful restart
