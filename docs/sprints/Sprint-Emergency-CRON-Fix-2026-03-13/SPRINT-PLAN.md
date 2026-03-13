# 🚨 Sprint: Emergency CRON Fix & Architecture Stabilization

**Дата создания:** 2026-03-13
**Спринт:** Emergency Response → Stabilization
**Длительность:** 2 недели (2026-03-13 → 2026-03-27)
**Приоритет:** 🔴 КРИТИЧЕСКИЙ

---

## 📊 Обзор

### Проблема
Система отправляла **4 сообщения в магазин за несколько минут** вместо 1 сообщения в день из-за тройного выполнения CRON задач.

### Корневая причина
**Архитектурный дефект:** In-memory состояние в кластерном режиме PM2 (2 инстанса main app + 1 cron процесс = 3× дубликаты).

### Последствия
- ❌ 2,075 активных последовательностей создавали дубликаты
- ❌ Спам пользователям (4 сообщения вместо 1)
- ❌ Репутационный ущерб
- ❌ Потенциальная блокировка WB API

---

## 🎯 Цели спринта

### 1. Немедленная стабилизация (День 1-2)
- ✅ Остановить активные рассылки
- ✅ Задеплоить hotfix на production
- ✅ Проверить отсутствие дубликатов

### 2. Краткосрочные улучшения (День 3-7)
- 📚 Обновить документацию
- 🔒 Внедрить защиту на уровне БД
- 📊 Настроить мониторинг
- ✅ Провести code review процесс

### 3. Долгосрочная стабилизация (День 8-14)
- 🏗️ Рефакторинг архитектуры
- 🧪 Создать integration tests
- 📖 Документировать решения
- 🛡️ Предотвращение подобных ситуаций

---

## 📅 Детальный план по дням

### **День 1-2: Emergency Response** ✅ (ЗАВЕРШЕНО)

**Статус:** ✅ Выполнено 2026-03-13

#### Задачи:
- [x] Подключиться к production серверу
- [x] Остановить `wb-reputation-cron` процесс
- [x] Остановить 2,075 активных sequences
- [x] Провести аудит системы
- [x] Создать emergency scripts
- [x] Исправить `src/lib/init-server.ts` (ENABLE_CRON_IN_MAIN_APP флаг)
- [x] Создать миграцию для предотвращения дубликатов

#### Результат:
- ✅ Рассылки остановлены
- ✅ Hotfix готов к деплою
- ✅ Аудит завершен (ARCHITECTURE-AUDIT-2026-03-13.md)

---

### **День 3: Production Deployment** 🚀

**Ответственный:** DevOps + Backend
**Дедлайн:** 2026-03-14 EOD

#### Задачи:
1. **Деплой hotfix на production**
   - [ ] Задеплоить исправленный `src/lib/init-server.ts`
   - [ ] Запустить миграцию `999_emergency_prevent_duplicate_sequences.sql`
   - [ ] Рестартовать PM2 процессы
   - [ ] Проверить логи (CRON disabled в main app)

2. **Верификация**
   - [ ] Запустить `AUDIT-check-duplicate-sends.mjs`
   - [ ] Проверить через 30 мин (только 1 лог, не 3)
   - [ ] Мониторинг 24 часа

3. **Документация деплоя**
   - [ ] Записать результаты в `DEPLOYMENT-LOG.md`
   - [ ] Обновить `DEPLOYMENT.md` с новыми инструкциями

**Acceptance Criteria:**
- ✅ Main app logs: "CRON jobs DISABLED"
- ✅ CRON process logs: "Auto-sequence processor started"
- ✅ Audit clean: no duplicates
- ✅ Only 1 send log per 30 min (not 3)

---

### **День 4-5: Database Protection & Monitoring** 🔒

**Ответственный:** Backend + DBA
**Дедлайн:** 2026-03-16 EOD

#### Задачи:

1. **Database-level защита** (Priority: HIGH)
   - [ ] Создать UNIQUE INDEX на `chat_auto_sequences`
     ```sql
     CREATE UNIQUE INDEX idx_unique_active_sequence_per_chat
     ON chat_auto_sequences (chat_id)
     WHERE status = 'active';
     ```
   - [ ] Создать helper function `start_auto_sequence_safe()`
   - [ ] Обновить код для использования safe function
   - [ ] Тесты для constraint violation

2. **Job locking механизм** (Priority: MEDIUM)
   - [ ] Создать таблицу `cron_job_locks`
   - [ ] Реализовать `acquireLock()` / `releaseLock()`
   - [ ] Интегрировать в `src/lib/cron-jobs.ts`
   - [ ] Cleanup stale locks (> 30 min)

3. **Monitoring views**
   - [ ] `v_duplicate_sequences` (уже создан в миграции)
   - [ ] `v_rapid_sends` (< 5 min между сообщениями)
   - [ ] `v_stale_locks` (> 30 min)

4. **Alerting setup**
   - [ ] Email alert при обнаружении дубликатов
   - [ ] Telegram bot notification
   - [ ] Daily audit report (cron)

**Acceptance Criteria:**
- ✅ Database отклоняет попытки создать дубликат
- ✅ Job lock работает корректно
- ✅ Alerts настроены и тестированы

---

### **День 6-7: Documentation Update** 📚

**Ответственный:** Tech Lead + DevOps
**Дедлайн:** 2026-03-18 EOD

#### Задачи:

1. **Обновить существующую документацию**
   - [ ] `DEPLOYMENT.md` → добавить секцию про ENABLE_CRON_IN_MAIN_APP
   - [ ] `docs/database-schema.md` → добавить новые индексы и views
   - [ ] `ecosystem.config.js` → комментарии про cluster mode risks
   - [ ] `README.md` → обновить architecture diagram

2. **Создать новые документы**
   - [ ] `docs/CRON_JOBS.md` → полное описание всех CRON задач
   - [ ] `docs/TROUBLESHOOTING.md` → emergency procedures
   - [ ] `docs/MONITORING.md` → что мониторить, как реагировать
   - [ ] `docs/CODE_REVIEW_CHECKLIST.md` → обязательные проверки

3. **Lessons Learned**
   - [ ] `docs/POSTMORTEM-2026-03-13.md` → detailed analysis
   - [ ] Что пошло не так
   - [ ] Что помогло решить
   - [ ] Как предотвратить в будущем

**Acceptance Criteria:**
- ✅ Вся документация актуальна
- ✅ Новый разработчик может понять систему
- ✅ Emergency procedures задокументированы

---

### **День 8-10: Code Review Process** ✅

**Ответственный:** Tech Lead
**Дедлайн:** 2026-03-21 EOD

#### Задачи:

1. **Установить процесс code review**
   - [ ] GitHub branch protection rules (require review)
   - [ ] Code review checklist в PR template
   - [ ] Назначить reviewers по компонентам

2. **Architectural review для критичных изменений**
   - [ ] Checklist для архитектурных решений:
     - Cluster mode compatibility?
     - Database consistency?
     - Error handling?
     - Monitoring/logging?
   - [ ] Обязательный review для:
     - CRON jobs
     - Scheduled tasks
     - Distributed state
     - Database migrations

3. **Automated checks**
   - [ ] Pre-commit hooks (linting, type checking)
   - [ ] CI pipeline (build, tests)
   - [ ] PR checklist (automated checks)

**Acceptance Criteria:**
- ✅ PR template создан
- ✅ Branch protection rules активны
- ✅ Architectural checklist готов

---

### **День 11-12: Integration Tests** 🧪

**Ответственный:** QA + Backend
**Дедлайн:** 2026-03-24 EOD

#### Задачи:

1. **Setup integration test framework**
   - [ ] Установить test environment (Docker?)
   - [ ] Конфигурация test database
   - [ ] Test data fixtures

2. **Critical path tests**
   - [ ] Test: Auto-sequence не создает дубликаты
   - [ ] Test: Job lock предотвращает параллельное выполнение
   - [ ] Test: CRON запускается только в cron процессе
   - [ ] Test: Message sending rate limit

3. **Edge cases**
   - [ ] Test: Multiple processes trying to start sequence
   - [ ] Test: Process crash во время обработки
   - [ ] Test: Network timeout scenarios
   - [ ] Test: Database constraint violations

4. **CI Integration**
   - [ ] Интегрировать тесты в CI pipeline
   - [ ] Auto-run on PR
   - [ ] Block merge если тесты падают

**Acceptance Criteria:**
- ✅ 10+ integration tests написано
- ✅ Tests проходят в CI
- ✅ Coverage > 70% для critical paths

---

### **День 13-14: Architecture Refactoring** 🏗️

**Ответственный:** Senior Backend
**Дедлайн:** 2026-03-27 EOD

#### Задачи:

1. **Separation of Concerns**
   - [ ] Выделить CRON логику в отдельный модуль
   - [ ] Clear boundaries между main app и cron
   - [ ] Документировать границы модулей

2. **Stateless design**
   - [ ] Audit всех in-memory state usage
   - [ ] Переместить state в PostgreSQL где нужно
   - [ ] Redis для distributed cache (если требуется)

3. **Distributed system best practices**
   - [ ] Idempotency для всех critical operations
   - [ ] Transaction boundaries
   - [ ] Retry logic with exponential backoff

4. **Code cleanup**
   - [ ] Удалить deprecated code
   - [ ] Rename confusing variables
   - [ ] Add JSDoc comments

**Acceptance Criteria:**
- ✅ Архитектура соответствует best practices
- ✅ No in-memory state in cluster-incompatible locations
- ✅ Code clean и понятен

---

## 📊 Backlog Items (Post-Sprint)

### Medium Priority
- [ ] Rate limiter для WB API calls
- [ ] Message queue (Bull/BullMQ) для async tasks
- [ ] Admin dashboard для monitoring
- [ ] Structured logging (Winston/Pino)

### Low Priority
- [ ] Performance optimization
- [ ] Load testing
- [ ] Multi-region deployment readiness
- [ ] Auto-scaling policies

---

## 🎯 Success Metrics

### Immediate (Day 1-3)
- ✅ Zero duplicate sends в production
- ✅ CRON runs только в 1 процессе
- ✅ Audit reports clean

### Short-term (Week 1)
- ✅ Database constraints защищают от дубликатов
- ✅ Monitoring & alerts работают
- ✅ Documentation полная и актуальная

### Long-term (Week 2)
- ✅ Integration tests покрывают critical paths
- ✅ Code review process установлен
- ✅ Архитектура stable и maintainable

---

## 🚦 Risk Management

### High Risk Items
1. **Production deployment может сломать existing workflows**
   - Mitigation: Staging environment testing
   - Rollback plan готов

2. **Database migration может упасть**
   - Mitigation: Backup before migration
   - Test на staging first

3. **CRON может не запуститься после fix**
   - Mitigation: Monitoring alerts
   - Manual verification process

---

## 📞 Escalation Path

### Critical Issues (< 1 hour response)
- Production down
- Duplicate sends detected after fix
- Database corruption

**Contact:** Tech Lead + DevOps on-call

### High Priority (< 4 hours)
- CRON not running
- Tests failing in CI
- Monitoring alerts

**Contact:** Backend team lead

### Medium Priority (< 24 hours)
- Documentation issues
- Minor bugs
- Feature requests

**Contact:** Sprint owner

---

## 📁 Related Files

### Emergency Scripts (этот sprint)
- [emergency-scripts/EMERGENCY-stop-auto-sequences.mjs](emergency-scripts/EMERGENCY-stop-auto-sequences.mjs)
- [emergency-scripts/AUDIT-check-duplicate-sends.mjs](emergency-scripts/AUDIT-check-duplicate-sends.mjs)
- [emergency-scripts/DEPLOY-EMERGENCY-FIX.sh](emergency-scripts/DEPLOY-EMERGENCY-FIX.sh)

### Migrations
- [migrations/999_emergency_prevent_duplicate_sequences.sql](migrations/999_emergency_prevent_duplicate_sequences.sql)

### Documentation
- [documentation/ARCHITECTURE-AUDIT-2026-03-13.md](documentation/ARCHITECTURE-AUDIT-2026-03-13.md)
- [documentation/START-HERE.md](documentation/START-HERE.md)
- [documentation/EMERGENCY-FIX-SUMMARY.md](documentation/EMERGENCY-FIX-SUMMARY.md)
- [documentation/EMERGENCY-STOP-GUIDE.md](documentation/EMERGENCY-STOP-GUIDE.md)

### Code Changes
- `src/lib/init-server.ts` - ENABLE_CRON_IN_MAIN_APP flag
- `src/lib/cron-jobs.ts` - (planned refactoring)
- `ecosystem.config.js` - (documentation update)

---

## ✅ Sprint Checklist

### Week 1: Stabilization
- [ ] Day 1-2: Emergency Response ✅
- [ ] Day 3: Production Deployment
- [ ] Day 4-5: Database Protection
- [ ] Day 6-7: Documentation Update

### Week 2: Prevention
- [ ] Day 8-10: Code Review Process
- [ ] Day 11-12: Integration Tests
- [ ] Day 13-14: Architecture Refactoring

---

**Создано:** 2026-03-13
**Обновлено:** 2026-03-13
**Версия:** 1.0
**Статус:** 🟢 ACTIVE
