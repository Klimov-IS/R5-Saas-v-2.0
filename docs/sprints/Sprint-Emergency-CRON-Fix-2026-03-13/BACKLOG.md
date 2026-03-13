# 📋 Sprint Backlog: Emergency CRON Fix

**Sprint:** Emergency Response → Stabilization
**Период:** 2026-03-13 → 2026-03-27
**Обновлено:** 2026-03-13

---

## 🔥 CRITICAL (P0) - Немедленное выполнение

### ✅ EPIC-1: Emergency Stop & Hotfix Deployment
**Статус:** ✅ ЗАВЕРШЕНО (частично - требуется production deploy)
**Дедлайн:** 2026-03-14

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P0-1.1 | Подключиться к production и остановить CRON процесс | ✅ Done | DevOps | 10 мин |
| P0-1.2 | Остановить 2,075 active sequences через emergency script | ✅ Done | Backend | 15 мин |
| P0-1.3 | Исправить src/lib/init-server.ts (ENABLE_CRON_IN_MAIN_APP) | ✅ Done | Backend | 30 мин |
| P0-1.4 | Создать миграцию 999_emergency_prevent_duplicate_sequences.sql | ✅ Done | Backend | 1 час |
| P0-1.5 | **Задеплоить hotfix на production** | ⏳ To Do | DevOps | 30 мин |
| P0-1.6 | **Запустить миграцию в production DB** | ⏳ To Do | DBA | 15 мин |
| P0-1.7 | **Рестартовать PM2 процессы с новым кодом** | ⏳ To Do | DevOps | 10 мин |
| P0-1.8 | Верификация: проверить логи через 30 мин | ⏳ To Do | Backend | 30 мин |
| P0-1.9 | Мониторинг 24 часа после деплоя | ⏳ To Do | DevOps | 1 день |

**Acceptance Criteria:**
- ✅ Main app logs: "CRON jobs DISABLED in main app"
- ✅ wb-reputation-cron logs: "Auto-sequence processor started"
- ✅ Audit script shows: "No duplicate messages found"
- ✅ Only ONE send log per 30 min (not 3×)

**Estimated Total:** 4 часа + 24ч monitoring

---

## 🔴 HIGH (P1) - Первая неделя

### EPIC-2: Database-Level Protection
**Статус:** 📝 Ready to Start
**Дедлайн:** 2026-03-16

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P1-2.1 | Создать UNIQUE INDEX на chat_auto_sequences | ⏳ To Do | DBA | 30 мин |
| P1-2.2 | Создать helper function start_auto_sequence_safe() | ⏳ To Do | Backend | 1 час |
| P1-2.3 | Обновить код для использования safe function | ⏳ To Do | Backend | 2 часа |
| P1-2.4 | Unit tests для constraint violation handling | ⏳ To Do | Backend | 1 час |
| P1-2.5 | Создать таблицу cron_job_locks | ⏳ To Do | DBA | 30 мин |
| P1-2.6 | Реализовать acquireLock() / releaseLock() | ⏳ To Do | Backend | 2 часа |
| P1-2.7 | Интегрировать lock в src/lib/cron-jobs.ts | ⏳ To Do | Backend | 1 час |
| P1-2.8 | Cleanup stale locks (> 30 min) автоматически | ⏳ To Do | Backend | 1 час |
| P1-2.9 | Тесты для job locking механизма | ⏳ To Do | Backend | 1 час |

**Estimated Total:** 10 часов

---

### EPIC-3: Monitoring & Alerting
**Статус:** 📝 Ready to Start
**Дедлайн:** 2026-03-16

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P1-3.1 | Создать view v_rapid_sends (< 5 min) | ⏳ To Do | DBA | 30 мин |
| P1-3.2 | Создать view v_stale_locks (> 30 min) | ⏳ To Do | DBA | 30 мин |
| P1-3.3 | Setup Email alerts при дубликатах | ⏳ To Do | DevOps | 1 час |
| P1-3.4 | Setup Telegram bot notifications | ⏳ To Do | Backend | 2 часа |
| P1-3.5 | Daily audit report (cron job) | ⏳ To Do | DevOps | 1 час |
| P1-3.6 | Dashboard для monitoring views | ⏳ To Do | Frontend | 3 часа |
| P1-3.7 | Test alerting system | ⏳ To Do | QA | 1 час |

**Estimated Total:** 9 часов

---

### EPIC-4: Documentation Update
**Статус:** 📝 Ready to Start
**Дедлайн:** 2026-03-18

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P1-4.1 | Обновить DEPLOYMENT.md (добавить ENABLE_CRON_IN_MAIN_APP) | ⏳ To Do | DevOps | 30 мин |
| P1-4.2 | Обновить docs/database-schema.md (новые индексы) | ⏳ To Do | Backend | 30 мин |
| P1-4.3 | Добавить комментарии в ecosystem.config.js | ⏳ To Do | DevOps | 15 мин |
| P1-4.4 | Обновить README.md (architecture diagram) | ⏳ To Do | Tech Lead | 1 час |
| P1-4.5 | Создать docs/CRON_JOBS.md | ⏳ To Do | Backend | 2 часа |
| P1-4.6 | Создать docs/TROUBLESHOOTING.md | ⏳ To Do | DevOps | 1 час |
| P1-4.7 | Создать docs/MONITORING.md | ⏳ To Do | DevOps | 1 час |
| P1-4.8 | Создать docs/CODE_REVIEW_CHECKLIST.md | ⏳ To Do | Tech Lead | 1 час |
| P1-4.9 | Написать docs/POSTMORTEM-2026-03-13.md | ⏳ To Do | Tech Lead | 2 часа |

**Estimated Total:** 9.5 часов

---

## 🟠 MEDIUM (P2) - Вторая неделя

### EPIC-5: Code Review Process
**Статус:** 📝 Ready to Start
**Дедлайн:** 2026-03-21

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P2-5.1 | Setup GitHub branch protection rules | ⏳ To Do | DevOps | 30 мин |
| P2-5.2 | Создать PR template с checklist | ⏳ To Do | Tech Lead | 30 мин |
| P2-5.3 | Назначить reviewers по компонентам | ⏳ To Do | Tech Lead | 15 мин |
| P2-5.4 | Создать architectural review checklist | ⏳ To Do | Tech Lead | 1 час |
| P2-5.5 | Setup pre-commit hooks (linting, type check) | ⏳ To Do | DevOps | 1 час |
| P2-5.6 | Configure CI pipeline (build, tests) | ⏳ To Do | DevOps | 2 часа |
| P2-5.7 | Документировать code review process | ⏳ To Do | Tech Lead | 1 час |

**Estimated Total:** 6 часов

---

### EPIC-6: Integration Tests
**Статус:** 📝 Ready to Start
**Дедлайн:** 2026-03-24

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P2-6.1 | Setup test environment (Docker compose) | ⏳ To Do | DevOps | 2 часа |
| P2-6.2 | Configure test database с fixtures | ⏳ To Do | Backend | 1 час |
| P2-6.3 | Test: Auto-sequence не создает дубликаты | ⏳ To Do | Backend | 2 часа |
| P2-6.4 | Test: Job lock предотвращает параллельное выполнение | ⏳ To Do | Backend | 2 часа |
| P2-6.5 | Test: CRON только в cron процессе | ⏳ To Do | Backend | 1 час |
| P2-6.6 | Test: Message sending rate limit | ⏳ To Do | Backend | 1 час |
| P2-6.7 | Test: Multiple processes create sequence (race condition) | ⏳ To Do | Backend | 2 часа |
| P2-6.8 | Test: Process crash во время обработки | ⏳ To Do | Backend | 2 часа |
| P2-6.9 | Test: Network timeout scenarios | ⏳ To Do | Backend | 1 час |
| P2-6.10 | Test: Database constraint violations | ⏳ To Do | Backend | 1 час |
| P2-6.11 | Интегрировать tests в CI pipeline | ⏳ To Do | DevOps | 1 час |
| P2-6.12 | Block PR merge если tests fail | ⏳ To Do | DevOps | 30 мин |

**Estimated Total:** 16.5 часов

---

### EPIC-7: Architecture Refactoring
**Статус:** 📝 Ready to Start
**Дедлайн:** 2026-03-27

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P2-7.1 | Выделить CRON логику в отдельный модуль | ⏳ To Do | Senior Backend | 3 часа |
| P2-7.2 | Документировать границы между main app и cron | ⏳ To Do | Tech Lead | 1 час |
| P2-7.3 | Audit всех in-memory state usage | ⏳ To Do | Backend | 2 часа |
| P2-7.4 | Переместить state в PostgreSQL где нужно | ⏳ To Do | Backend | 4 часа |
| P2-7.5 | Рассмотреть Redis для distributed cache | ⏳ To Do | Senior Backend | 2 часа |
| P2-7.6 | Обеспечить idempotency для critical operations | ⏳ To Do | Backend | 3 часа |
| P2-7.7 | Определить transaction boundaries | ⏳ To Do | Backend | 2 часа |
| P2-7.8 | Добавить retry logic с exponential backoff | ⏳ To Do | Backend | 2 часа |
| P2-7.9 | Code cleanup: удалить deprecated code | ⏳ To Do | Backend | 2 часа |
| P2-7.10 | Добавить JSDoc comments для всех public functions | ⏳ To Do | Backend | 3 часа |

**Estimated Total:** 24 часа

---

## 🟡 LOW (P3) - Post-Sprint Backlog

### EPIC-8: Advanced Improvements
**Статус:** 💡 Proposed
**Дедлайн:** TBD

| ID | Задача | Статус | Ответственный | Время |
|---|---|---|---|---|
| P3-8.1 | Rate limiter для WB API calls | 💡 Proposed | Backend | 3 часа |
| P3-8.2 | Message queue (Bull/BullMQ) для async tasks | 💡 Proposed | Senior Backend | 8 часов |
| P3-8.3 | Admin dashboard для real-time monitoring | 💡 Proposed | Full-stack | 16 часов |
| P3-8.4 | Structured logging (Winston/Pino) | 💡 Proposed | Backend | 4 часа |
| P3-8.5 | Performance optimization (query optimization) | 💡 Proposed | Backend | 8 часов |
| P3-8.6 | Load testing (k6 or Artillery) | 💡 Proposed | QA | 8 часов |
| P3-8.7 | Multi-region deployment readiness | 💡 Proposed | DevOps | 16 часов |
| P3-8.8 | Auto-scaling policies (PM2 + Yandex Cloud) | 💡 Proposed | DevOps | 8 часов |

**Estimated Total:** 71 часов (следующий спринт)

---

## 📊 Velocity & Capacity Planning

### Текущая команда:
- **Backend Developers:** 2 человека × 40 часов/неделя = 80 часов
- **DevOps:** 1 человек × 20 часов/неделя = 20 часов
- **QA:** 1 человек × 20 часов/неделя = 20 часов
- **Tech Lead:** 1 человек × 10 часов/неделя (code review) = 10 часов

**Total Capacity:** 130 часов/неделя × 2 недели = **260 часов**

### Распределение по приоритетам:
- **P0 (Critical):** 4 часа + 24ч monitoring ✅
- **P1 (High):** 38.5 часов
- **P2 (Medium):** 46.5 часов
- **P3 (Low):** 71 часов (post-sprint)

**Total P0-P2:** 89 часов (34% capacity) - **Реалистично** ✅

---

## 🎯 Daily Standup Template

### Вопросы:
1. **Что сделано вчера?**
2. **Что планируется сегодня?**
3. **Есть ли блокеры?**

### Формат отчета:
```
[P0-1.5] Задеплоил hotfix на production - ✅ DONE
[P1-2.1] Создание UNIQUE INDEX - ⏳ IN PROGRESS
[Blocker] Нужен доступ к production DB для миграции
```

---

## 📈 Progress Tracking

| Epic | Tasks | Completed | In Progress | To Do | Progress |
|---|---|---|---|---|---|
| EPIC-1: Emergency Stop | 9 | 4 | 5 | 0 | 44% |
| EPIC-2: DB Protection | 9 | 0 | 0 | 9 | 0% |
| EPIC-3: Monitoring | 7 | 0 | 0 | 7 | 0% |
| EPIC-4: Documentation | 9 | 0 | 0 | 9 | 0% |
| EPIC-5: Code Review | 7 | 0 | 0 | 7 | 0% |
| EPIC-6: Integration Tests | 12 | 0 | 0 | 12 | 0% |
| EPIC-7: Refactoring | 10 | 0 | 0 | 10 | 0% |

**Overall Sprint Progress:** 6.3% (4 из 63 задач)

---

## 🔄 Workflow Statuses

- 💡 **Proposed** - Идея, требует обсуждения
- 📝 **Ready to Start** - Задача готова к выполнению
- ⏳ **To Do** - В backlog, можно брать в работу
- 🏗️ **In Progress** - Активно разрабатывается
- 🔍 **In Review** - Code review
- 🧪 **Testing** - QA testing
- ✅ **Done** - Завершено и deployed
- ❌ **Blocked** - Есть блокер
- ⏸️ **On Hold** - Приостановлено

---

## 🚨 Blockers & Dependencies

### Current Blockers:
1. **P0-1.5: Production deployment**
   - Waiting: User approval для deployment
   - ETA: 2026-03-14

### Dependencies:
- P1-2.3 depends on P1-2.2 (safe function)
- P1-3.6 depends on P1-3.1, P1-3.2 (monitoring views)
- P2-6.11 depends on P2-6.1-6.10 (tests)
- P2-7.* can start in parallel after P1 tasks complete

---

## 📝 Notes & Decisions

### 2026-03-13:
- ✅ **Decision:** Disable CRON in main app, use dedicated wb-reputation-cron process
- ✅ **Decision:** Database-level protection via UNIQUE INDEX (preferred over app-level only)
- ✅ **Decision:** 2-week sprint to stabilize + prevent future issues
- ⏳ **Pending:** Approval для production deployment

### Future Considerations:
- Redis для distributed locks (если PostgreSQL locks недостаточно)
- Message queue (Bull) для async processing (обсудить в Sprint 2)
- Auto-scaling для CRON процесса при большой нагрузке

---

## 📞 Contact & Support

### Sprint Owner:
- **Name:** Tech Lead
- **Telegram:** @tech_lead
- **Availability:** Mon-Fri 10:00-19:00 MSK

### Emergency Contact:
- **Production Issues:** DevOps on-call
- **Database Issues:** DBA
- **Critical Bugs:** Tech Lead (24/7)

---

## 📁 Related Documents

- [SPRINT-PLAN.md](SPRINT-PLAN.md) - Детальный план спринта
- [documentation/ARCHITECTURE-AUDIT-2026-03-13.md](documentation/ARCHITECTURE-AUDIT-2026-03-13.md) - Аудит системы
- [documentation/START-HERE.md](documentation/START-HERE.md) - Quick start guide
- [emergency-scripts/](emergency-scripts/) - Emergency tools
- [migrations/](migrations/) - Database migrations

---

**Последнее обновление:** 2026-03-13 23:00 MSK
**Версия:** 1.0
**Статус:** 🟢 ACTIVE
