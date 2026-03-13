# 🚨 Sprint: Emergency CRON Fix & Architecture Stabilization

**Дата:** 2026-03-13
**Статус:** 🟢 ACTIVE
**Приоритет:** 🔴 КРИТИЧЕСКИЙ

---

## 📋 Быстрая навигация

### 🎯 Планирование
- **[SPRINT-PLAN.md](SPRINT-PLAN.md)** - Детальный план спринта (2 недели, разбивка по дням)
- **[BACKLOG.md](BACKLOG.md)** - Приоритизированный backlog с оценками времени

### 📚 Документация
- **[documentation/ARCHITECTURE-AUDIT-2026-03-13.md](documentation/ARCHITECTURE-AUDIT-2026-03-13.md)** - Полный аудит системы (1000+ строк)
- **[documentation/START-HERE.md](documentation/START-HERE.md)** - Quick start для emergency deployment
- **[documentation/EMERGENCY-FIX-SUMMARY.md](documentation/EMERGENCY-FIX-SUMMARY.md)** - Краткое описание проблемы и решения
- **[documentation/EMERGENCY-STOP-GUIDE.md](documentation/EMERGENCY-STOP-GUIDE.md)** - Troubleshooting guide

### 🛠️ Emergency Scripts
- **[emergency-scripts/EMERGENCY-stop-auto-sequences.mjs](emergency-scripts/EMERGENCY-stop-auto-sequences.mjs)** - Остановить все активные рассылки
- **[emergency-scripts/AUDIT-check-duplicate-sends.mjs](emergency-scripts/AUDIT-check-duplicate-sends.mjs)** - Проверка дубликатов
- **[emergency-scripts/DEPLOY-EMERGENCY-FIX.sh](emergency-scripts/DEPLOY-EMERGENCY-FIX.sh)** - Автоматический деплой фикса

### 🗄️ Database Migrations
- **[migrations/999_emergency_prevent_duplicate_sequences.sql](migrations/999_emergency_prevent_duplicate_sequences.sql)** - UNIQUE INDEX + защита от дубликатов

---

## 🎯 Цель спринта

### Проблема
Система отправляла **4 сообщения в магазин за несколько минут** вместо 1 сообщения в день.

### Корневая причина
**Архитектурный дефект:** 3 процесса (2× main app cluster + 1× cron) запускали одни и те же CRON задачи параллельно.

### Решение
1. **Немедленно (День 1-2):** Остановить рассылки + задеплоить hotfix
2. **Краткосрочно (Неделя 1):** Database protection + мониторинг + документация
3. **Долгосрочно (Неделя 2):** Code review process + integration tests + рефакторинг

---

## 📊 Структура папок

```
Sprint-Emergency-CRON-Fix-2026-03-13/
├── README.md                           ← Вы здесь
├── SPRINT-PLAN.md                      ← План на 2 недели
├── BACKLOG.md                          ← Приоритизированные задачи
│
├── documentation/                      ← Документация аудита
│   ├── ARCHITECTURE-AUDIT-2026-03-13.md
│   ├── START-HERE.md
│   ├── EMERGENCY-FIX-SUMMARY.md
│   └── EMERGENCY-STOP-GUIDE.md
│
├── emergency-scripts/                  ← Аварийные скрипты
│   ├── EMERGENCY-stop-auto-sequences.mjs
│   ├── AUDIT-check-duplicate-sends.mjs
│   └── DEPLOY-EMERGENCY-FIX.sh
│
└── migrations/                         ← Database migrations
    └── 999_emergency_prevent_duplicate_sequences.sql
```

---

## ✅ Прогресс спринта

### Week 1: Stabilization (День 1-7)
- [x] **День 1-2:** Emergency Response - ✅ ЗАВЕРШЕНО
  - Остановлено 2,075 активных sequences
  - Создан hotfix (ENABLE_CRON_IN_MAIN_APP flag)
  - Проведен architecture audit
- [ ] **День 3:** Production Deployment - ⏳ В ОЖИДАНИИ
- [ ] **День 4-5:** Database Protection & Monitoring
- [ ] **День 6-7:** Documentation Update

### Week 2: Prevention (День 8-14)
- [ ] **День 8-10:** Code Review Process Setup
- [ ] **День 11-12:** Integration Tests
- [ ] **День 13-14:** Architecture Refactoring

**Overall Progress:** 6.3% (4 из 63 задач)

---

## 🔥 Критические задачи (СЕЙЧАС)

### ⏳ P0-1.5: Production Deployment (2026-03-14)
```bash
# На production сервере
cd /var/www/wb-reputation
bash emergency-scripts/DEPLOY-EMERGENCY-FIX.sh
```

**Что делает:**
1. Останавливает активные sequences
2. Билдит новую версию
3. Рестартует PM2 процессы
4. Проверяет успешность деплоя

**Ожидаемый результат:**
- ✅ Main app logs: "CRON jobs DISABLED"
- ✅ CRON process logs: "Auto-sequence processor started"
- ✅ Только 1 send log per 30 min (не 3×)

---

## 📖 Для новых разработчиков

### С чего начать?

1. **Прочитайте аудит:**
   - [documentation/ARCHITECTURE-AUDIT-2026-03-13.md](documentation/ARCHITECTURE-AUDIT-2026-03-13.md)
   - Понять корневую причину и системные проблемы

2. **Ознакомьтесь с планом:**
   - [SPRINT-PLAN.md](SPRINT-PLAN.md) - детальный план
   - [BACKLOG.md](BACKLOG.md) - задачи с оценками

3. **Изучите emergency procedures:**
   - [documentation/START-HERE.md](documentation/START-HERE.md)
   - [documentation/EMERGENCY-STOP-GUIDE.md](documentation/EMERGENCY-STOP-GUIDE.md)

4. **Возьмите задачу из backlog:**
   - Статус: ⏳ **To Do**
   - Приоритет: Начните с **P1 (High)**
   - Обновите статус: 🏗️ **In Progress**

---

## 🎯 Key Metrics

### Immediate Success Criteria (Week 1)
- ✅ Zero duplicate sends в production
- ✅ CRON runs только в 1 процессе
- ✅ Database constraints защищают от дубликатов
- ✅ Monitoring & alerts работают

### Long-term Success Criteria (Week 2+)
- ✅ Integration tests покрывают critical paths (>70%)
- ✅ Code review process установлен
- ✅ Архитектура stable и maintainable
- ✅ Документация полная и актуальная

---

## 🚨 Emergency Contacts

### Production Issues (< 1 hour)
- **DevOps:** @devops_oncall
- **Tech Lead:** @tech_lead

### High Priority (< 4 hours)
- **Backend Team Lead:** @backend_lead

### Sprint Questions
- **Sprint Owner:** Tech Lead
- **Telegram:** @tech_lead
- **Availability:** Mon-Fri 10:00-19:00 MSK

---

## 📁 Related Files (за пределами этой папки)

### Code Changes
- `../../src/lib/init-server.ts` - Основной фикс (ENABLE_CRON_IN_MAIN_APP)
- `../../src/lib/cron-jobs.ts` - CRON логика (плановый рефакторинг)
- `../../ecosystem.config.js` - PM2 конфигурация

### Deployment
- `../../DEPLOYMENT.md` - Production deployment guide
- `../../.env.production` - Environment variables

### Database
- `../../docs/database-schema.md` - Schema documentation
- `../../migrations/` - All migrations

---

## 🔄 Changelog

### 2026-03-13
- ✅ Создан sprint folder structure
- ✅ Перемещены все файлы аудита и emergency scripts
- ✅ Создан SPRINT-PLAN.md (детальный план)
- ✅ Создан BACKLOG.md (приоритизированные задачи)
- ✅ EPIC-1 (Emergency Response) частично завершен (4/9 задач)

---

## 📝 Notes

### Важные решения:
1. **CRON отключен в main app** - запускается только в `wb-reputation-cron` процессе
2. **Database-level protection** - UNIQUE INDEX предотвращает дубликаты
3. **2-week sprint** - stabilization + prevention measures
4. **Integration tests обязательны** - для critical paths

### Следующие шаги:
1. ⏳ **Production deployment** (ждем approval)
2. Database protection (UNIQUE INDEX + job locks)
3. Monitoring & alerting setup
4. Documentation update

---

**Создано:** 2026-03-13
**Обновлено:** 2026-03-13
**Версия:** 1.0
**Статус:** 🟢 ACTIVE
