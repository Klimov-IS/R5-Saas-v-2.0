# 🎯 Next Steps: Sprint Emergency CRON Fix

**Текущее время:** 2026-03-13 12:50 UTC (15:50 MSK)
**Статус:** 7/9 P0 задач завершено (78%)
**Следующий milestone:** Верификация через 15 минут (13:05 UTC)

---

## ✅ Что уже сделано (сегодня)

### P0 (Critical) - Emergency Response
- ✅ P0-1.1: Подключение к production
- ✅ P0-1.2: Остановка 2,075 active sequences
- ✅ P0-1.3: Hotfix в src/lib/init-server.ts
- ✅ P0-1.4: Создание миграции (UNIQUE INDEX + helpers)
- ✅ P0-1.5: Deploy hotfix на production
- ✅ P0-1.6: Запуск миграции в production DB
- ✅ P0-1.7: Restart PM2 процессов

**Progress:** 7/9 (78%) ✅

---

## ⏰ Сейчас (следующие 30 минут)

### P0-1.8: Верификация deployment (13:05 UTC / 16:05 MSK)

**Ждем:** Первый запуск auto-sequence processor после deployment

**Команды для проверки:**
```bash
# 1. Проверить логи CRON (в 13:05 UTC)
ssh ubuntu@158.160.229.16
pm2 logs wb-reputation-cron --lines 100 | grep "Auto-sequence"

# Ожидаемый результат:
# ✅ ОДНА запись (НЕ 3):
# [CRON] 📨 Auto-sequence: X sent, Y stopped, Z skipped, 0 errors

# 2. Запустить audit
cd /var/www/wb-reputation
node scripts/AUDIT-check-duplicate-sends.mjs

# Ожидаемый результат:
# ✅ No duplicate messages found
# ✅ No duplicate active sequences
# ✅ No rapid sends detected
```

**Acceptance Criteria:**
- ✅ Только 1 лог о рассылке (не 3)
- ✅ No duplicates в audit
- ✅ No errors в PM2 logs

**Время:** 15 минут
**Ответственный:** User + Claude

---

## 📅 Сегодня (остаток дня)

### P0-1.9: Мониторинг production (24 часа)

**Задачи:**
1. Проверять логи каждые 2 часа
2. Следить за PM2 процессами (все должны быть online)
3. Мониторить ошибки в error logs

**Команды:**
```bash
# Каждые 2 часа
pm2 list
pm2 logs wb-reputation-cron --lines 50 --nostream | grep -E "(Auto-sequence|ERROR)"

# Если есть проблемы
pm2 logs wb-reputation-cron --err --lines 200
```

**Дедлайн:** 2026-03-14 12:35 UTC (через 24 часа)

---

## 🚀 Следующие задачи (можно начать сейчас)

Пока ждем верификацию, можем параллельно работать над P1 (High Priority) задачами:

### Option 1: EPIC-3 - Monitoring & Alerting (можно делать параллельно)

**P1-3.1: Создать monitoring views** ⏳ Ready
- Файл: `migrations/100_create_monitoring_views.sql`
- Время: 30 минут

**Что создать:**
```sql
-- View: Rapid sends (< 5 min apart)
CREATE OR REPLACE VIEW v_rapid_sends AS ...

-- View: Stale processing locks (> 30 min)
CREATE OR REPLACE VIEW v_stale_locks AS ...

-- View: Sequences by status (dashboard)
CREATE OR REPLACE VIEW v_sequences_dashboard AS ...
```

**Польза:** Упростит мониторинг, можно запросами проверять состояние системы

---

### Option 2: EPIC-4 - Documentation Update (не требует production)

**P1-4.1: Обновить DEPLOYMENT.md** ⏳ Ready
- Добавить секцию про ENABLE_CRON_IN_MAIN_APP
- Документировать новые emergency scripts
- Обновить PM2 процессы (теперь CRON отдельный)
- Время: 30 минут

**P1-4.2: Обновить database-schema.md** ⏳ Ready
- Добавить новый UNIQUE INDEX
- Документировать helper functions
- Добавить monitoring views
- Время: 20 минут

**P1-4.5: Создать docs/CRON_JOBS.md** ⏳ Ready
- Список всех CRON jobs
- Расписание запуска
- Что делает каждый job
- Как включить/выключить
- Время: 1 час

---

### Option 3: EPIC-2 - Database Protection (частично уже сделано)

**P1-2.5: Создать таблицу cron_job_locks** ⏳ Ready
- Предотвращение параллельного запуска CRON jobs
- Advisory locks на уровне PostgreSQL
- Время: 1 час

**Код:**
```sql
-- migrations/101_create_cron_job_locks.sql
CREATE TABLE cron_job_locks (
  job_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT,  -- process ID or hostname
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cron_locks_expires ON cron_job_locks(expires_at);
```

---

## 🎯 Рекомендуемый план (сейчас → вечер)

### Сейчас (12:50 - 13:05 UTC): Подготовка к верификации
- [ ] Подготовить команды для проверки
- [ ] Начать работу над документацией (EPIC-4)

### 13:05 - 13:20 UTC: Верификация P0-1.8 ⭐
- [ ] Проверить логи CRON
- [ ] Запустить audit script
- [ ] Убедиться, что нет дубликатов
- [ ] ✅ Закрыть P0-1.8 как completed

### 13:20 - 15:00 UTC: EPIC-4 - Documentation
- [ ] P1-4.1: Обновить DEPLOYMENT.md
- [ ] P1-4.2: Обновить database-schema.md
- [ ] P1-4.5: Создать CRON_JOBS.md

### 15:00 - 17:00 UTC: EPIC-3 - Monitoring
- [ ] P1-3.1: Создать monitoring views
- [ ] P1-3.2: Тестировать views
- [ ] Deploy views на production

### Вечер: EPIC-2 - Advanced Protection
- [ ] P1-2.5: Создать cron_job_locks table
- [ ] P1-2.6: Реализовать acquireLock() / releaseLock()

---

## 📊 Sprint Progress Tracking

| EPIC | Tasks Total | Completed | In Progress | Remaining | Progress |
|------|-------------|-----------|-------------|-----------|----------|
| EPIC-1: Emergency | 9 | 7 | 1 | 1 | 78% |
| EPIC-2: DB Protection | 9 | 1 | 0 | 8 | 11% |
| EPIC-3: Monitoring | 7 | 0 | 0 | 7 | 0% |
| EPIC-4: Documentation | 9 | 0 | 0 | 9 | 0% |
| **Total Week 1** | 34 | 8 | 1 | 25 | 24% |

**Target for today:** Complete P0 (EPIC-1) + Start P1 (EPIC-3, EPIC-4)

---

## 🚦 Decision Points

### Вопрос 1: С чего начать после верификации?

**Варианты:**
- A) **Documentation** (EPIC-4) - безопасно, не требует production changes
- B) **Monitoring views** (EPIC-3) - полезно для мониторинга, минимальный риск
- C) **Job locks** (EPIC-2) - более сложно, требует тестирования

**Рекомендация:** **A → B → C** (от простого к сложному)

### Вопрос 2: Когда деплоить новые изменения?

**Рекомендация:**
- Monitoring views: Сегодня вечером (после верификации 24ч не обязательна)
- Job locks: Завтра (после 24ч мониторинга P0)
- Documentation: Можно коммитить сразу (не влияет на production)

---

## 📝 Quick Commands Reference

```bash
# Проверка статуса
ssh ubuntu@158.160.229.16 "pm2 list"

# Логи CRON
ssh ubuntu@158.160.229.16 "pm2 logs wb-reputation-cron --lines 100 --nostream"

# Audit
ssh ubuntu@158.160.229.16 "cd /var/www/wb-reputation && node scripts/AUDIT-check-duplicate-sends.mjs"

# Проверка sequences
ssh ubuntu@158.160.229.16 "cd /var/www/wb-reputation && node scripts/check-sequences-status.mjs"
```

---

## 🎯 Today's Goals

**Must Have (P0):**
- ✅ Deploy emergency fix (DONE)
- ⏳ Verify fix works (13:05 UTC)
- ⏳ Start 24h monitoring

**Should Have (P1):**
- ⏳ Update documentation (3-4 docs)
- ⏳ Create monitoring views

**Nice to Have:**
- ⏳ Start job locks implementation

---

## 🆘 If Something Goes Wrong

### Rollback Plan
```bash
# На production
pm2 stop wb-reputation-cron
export ENABLE_CRON_IN_MAIN_APP=true
pm2 restart wb-reputation --update-env
pm2 logs wb-reputation | grep CRON
```

**Note:** Вернет дубликаты (2× main app), но CRON будет работать.

---

**Следующий update:** После верификации в 13:05 UTC
**Prepared by:** Claude Code Assistant
**Status:** ✅ READY TO PROCEED
