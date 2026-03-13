# 🔍 АРХИТЕКТУРНЫЙ АУДИТ: Анализ проблемы дублирования рассылок

**Дата:** 2026-03-13
**Статус:** Критическое выявление системных проблем
**Автор:** Emergency Response Team
**Тип:** Post-Incident Architecture Review

---

## 📋 EXECUTIVE SUMMARY

**Проблема:** Система отправляла по 3-4 сообщения вместо 1 в каждый чат.

**Корневая причина (техническая):**
```
2× main app instances (cluster mode)
+ 1× wb-reputation-cron process
= 3× одновременное выполнение CRON задач
```

**Корневая причина (системная):**
> **Использование in-memory флагов для синхронизации между процессами в cluster mode — фундаментальная архитектурная ошибка**

**Импакт:**
- 2,075 активных sequences отправили дублирующие сообщения
- Негативный customer experience
- Потенциальные жалобы в поддержку WB

**Время существования проблемы:** Минимум 1 месяц (с момента включения cluster mode)

---

## 🎯 КЛЮЧЕВОЙ ВЫВОД

**Это НЕ баг в коде. Это системная проблема в:**

| Уровень | Проблема | Критичность |
|---------|----------|-------------|
| **Архитектура** | In-memory state в cluster mode | 🔴 Критическая |
| **Процессы** | Отсутствие code review | 🟠 Высокая |
| **Testing** | Zero integration tests для production mode | 🟠 Высокая |
| **Документация** | Устаревшая, скрывает проблемы | 🟡 Средняя |
| **Мониторинг** | Нет alerts на дублирование | 🟠 Высокая |

---

## 1. АРХИТЕКТУРНЫЕ ПРОБЛЕМЫ

### 1.1 Проблема: In-Memory State в Cluster Mode

**Где:** [src/lib/init-server.ts:8](src/lib/init-server.ts#L8)

```typescript
let initialized = false;  // ❌ КРИТИЧЕСКАЯ ОШИБКА
```

**Почему это ошибка:**

```
PM2 Cluster Mode (instances: 2):

┌─────────────────────────────────────────┐
│ Process 1 (PID: 12345)                  │
│ Memory: 0x1000                          │
│ initialized = false → true ✓            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Process 2 (PID: 67890)                  │
│ Memory: 0x2000  ← ОТДЕЛЬНАЯ ПАМЯТЬ!     │
│ initialized = false → true ✓            │
└─────────────────────────────────────────┘

Результат: ОБА процесса считают себя единственными!
```

**Последствие:**
- Process 1 запускает CRON ✓
- Process 2 запускает CRON ✓
- wb-reputation-cron запускает CRON ✓
- **= 3× одновременная отправка сообщений**

**Фундаментальная ошибка:**
> **Невозможно синхронизировать процессы через in-memory переменные**

---

### 1.2 Проблема: Нарушение Separation of Concerns

**Текущая архитектура:**

```
ecosystem.config.js:
┌────────────────────────────────────────┐
│ wb-reputation (instances: 2, cluster)  │
│ ├─ HTTP API ✓                          │
│ ├─ Next.js Pages ✓                     │
│ ├─ CRON Jobs ❌ ДОЛЖНО БЫТЬ ОТДЕЛЬНО! │
│ └─ Background tasks ❌                  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ wb-reputation-cron (instances: 1)      │
│ └─ CRON Jobs ✓ (через API вызов)      │
└────────────────────────────────────────┘

Проблема: CRON живёт в ОБОИХ местах!
```

**Правильная архитектура должна быть:**

```
┌────────────────────────────────────────┐
│ wb-reputation (instances: N, cluster)  │
│ ├─ HTTP API ✓                          │
│ ├─ Next.js Pages ✓                     │
│ └─ БЕЗ CRON! ✓                         │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ wb-reputation-worker (instances: 1)    │
│ ├─ CRON Jobs ТОЛЬКО ЗДЕСЬ ✓           │
│ └─ Background tasks ✓                  │
└────────────────────────────────────────┘

Преимущества:
- Масштабирование API независимо от CRON
- Нет риска дублирования
- Простой мониторинг
```

---

### 1.3 Проблема: Множественные способы инициализации

**Обнаружено 3 разных способа запуска CRON:**

```
Способ 1: instrumentation.ts (автоматический)
┌─> instrumentation.ts:register()
└─> init-server.ts:initializeServer()
    └─> startAutoSequenceProcessor()

Способ 2: wb-reputation-cron процесс
┌─> scripts/start-cron.js
└─> POST /api/cron/trigger
    └─> ???  ← КАК РАБОТАЕТ? НЕ ДОКУМЕНТИРОВАНО!

Способ 3: Manual API call (опционально)
└─> POST /api/cron/init
    └─> ???

Проблема: Нет single source of truth!
```

**Последствие:** Невозможно гарантировать "запустится ровно 1 раз"

---

### 1.4 Проблема: Отсутствие Distributed Lock

**Для cluster mode ОБЯЗАТЕЛЬНО нужен distributed lock:**

```typescript
// ❌ НЕПРАВИЛЬНО (текущий код):
let initialized = false;  // in-memory

if (initialized) return;
initialized = true;
startCronJobs();

// ✅ ПРАВИЛЬНО:
import Redis from 'ioredis';
const redis = new Redis(REDIS_URL);

async function initializeServer() {
  // Try to acquire lock (TTL: 5 min)
  const acquired = await redis.set(
    'cron:init:lock',
    process.pid,
    'EX', 300,
    'NX'  // Set if Not eXists
  );

  if (!acquired) {
    console.log('[INIT] Another process already initialized CRON');
    return;
  }

  console.log('[INIT] Lock acquired, initializing CRON...');
  startCronJobs();
}
```

**Сейчас НЕТ:**
- Redis
- Database-level lock
- File-based lock
- **Любого механизма координации между процессами!**

---

## 2. ПРОЦЕССЫ РАЗРАБОТКИ

### 2.1 Отсутствие Architecture Decision Records (ADR)

**Найдено:** [docs/decisions/ADR-001-why-instrumentation-hook.md](docs/decisions/ADR-001-why-instrumentation-hook.md)

**Проблема в ADR:**

```markdown
## Consequences

### Negative
⚠️ PM2 cluster duplication: Each PM2 instance runs instrumentation.ts
```

**Критический пробел:**
- ADR указывает риск ✓
- ADR НЕ указывает решение ❌
- ADR полагается на "concurrency protection in cron-jobs.ts" ❌
- Но эта защита — in-memory флаг! ❌

**Что должно было быть в ADR:**

```markdown
## Mitigation: PM2 Cluster Duplication

**Problem:** With instances > 1, each process runs instrumentation.ts

**Solution Options:**

1. ❌ In-memory flag → IMPOSSIBLE (separate memory per process)
2. ❌ API lock → Race condition still possible
3. ✅ Environment flag: ENABLE_CRON_IN_MAIN_APP
   - Production: false (all CRON in separate fork process)
   - Development: true (CRON in main app for simplicity)

**Decision:** Use option 3 + distributed lock (Redis) for future scaling

**Validation:**
- Deployment checklist: verify ENABLE_CRON_IN_MAIN_APP=false
- Monitor: count CRON init logs (must be exactly 1)
```

**Вывод:** ADR был неполным — риск указан, но решение отсутствует.

---

### 2.2 Code Review практики отсутствуют

**Доказательства:**

**1. Нет упоминаний в git commits:**
```bash
git log --grep="cluster\|instances\|duplication" --oneline
# Результат: ПУСТО
```

**2. Критические изменения без комментариев:**

| Файл | Изменение | Когда | Code review? |
|------|-----------|-------|--------------|
| ecosystem.config.js | `instances: 2` добавлено | ? | ❌ Нет упоминаний |
| instrumentation.ts | CRON auto-init добавлен | 2026-01-14 | ✓ ADR-001, но без митигации |
| init-server.ts | ENABLE_CRON flag добавлен | 2026-03-13 | ❌ Нет PR, нет документации |

**3. Отсутствие PR process:**
- Нет issues "Как должен работать CRON в production?"
- Нет обсуждения архитектуры
- Нет peer review

**Последствие:** Критические архитектурные решения принимаются без review.

---

### 2.3 Deployment Checklist неполный

**Текущий чеклист:** [DEPLOYMENT.md:486-497](DEPLOYMENT.md#L486-L497)

```markdown
## Итоговый чеклист

- [ ] Сервер настроен (Node.js, PM2, Nginx)
- [ ] Проект склонирован из GitHub
- [ ] .env.production создан с корректными данными
- [ ] Зависимости установлены
- [ ] Проект собран
- [ ] PM2 запущен и сохранен
- [ ] Nginx настроен
- [ ] Приложение доступно
- [ ] Логи проверены
```

**ОТСУТСТВУЕТ:**

```markdown
- [ ] ENABLE_CRON_IN_MAIN_APP=false установлен в .env.production
- [ ] PM2 процессы: wb-reputation (2 instances), wb-reputation-cron (1 instance)
- [ ] Проверить логи: только ОДИН [INIT] Starting cron jobs
- [ ] Проверить отсутствие дублирования: pm2 logs | grep -c "[INIT]" → 1
- [ ] Мониторинг CRON: sequences отправляются 1 раз, не 3
```

**Последствие:** Deploy может пройти успешно, но CRON будет дублироваться.

---

## 3. ТЕСТИРОВАНИЕ

### 3.1 Integration Tests отсутствуют

**Что должно быть:**

```typescript
// tests/integration/cron-cluster-mode.test.ts

describe('CRON in cluster mode', () => {
  it('should initialize CRON only once', async () => {
    // Simulate PM2 cluster with 2 instances
    const instance1 = spawnNextJsProcess();
    const instance2 = spawnNextJsProcess();

    await Promise.all([
      instance1.waitForReady(),
      instance2.waitForReady()
    ]);

    // Check logs
    const initLogs = getAllLogs().filter(log => log.includes('[INIT] Starting cron jobs'));

    // ДОЛЖНО БЫТЬ РОВНО 1!
    expect(initLogs.length).toBe(1);
  });

  it('should not send duplicate messages', async () => {
    // Start auto-sequence
    await startSequence({ chatId: 'test-123', storeId: 'store-1' });

    // Wait for first message
    await wait(5000);

    // Check sent messages
    const messages = await getChatMessages('test-123');
    const autoMessages = messages.filter(m => m.is_auto_reply);

    // ДОЛЖНО БЫТЬ РОВНО 1!
    expect(autoMessages.length).toBe(1);
  });
});
```

**Сейчас:** **ZERO integration tests** для CRON.

---

### 3.2 Load Testing отсутствует

**Что НЕ протестировано:**

| Сценарий | Ожидаемое | Фактическое | Тест есть? |
|----------|-----------|-------------|------------|
| 1 instance → CRON init | 1× | 1× ✓ | ❌ |
| 2 instances → CRON init | 1× | **3×** ❌ | ❌ |
| Concurrent sequence send | 1 msg | **3 msg** ❌ | ❌ |
| PM2 restart → CRON re-init | 1× | ? | ❌ |

**Вывод:** Критические сценарии не тестируются.

---

### 3.3 CI/CD отсутствует

**Файлы не найдены:**
- `.github/workflows/test.yml`
- `.github/workflows/deploy.yml`
- `.gitlab-ci.yml`
- `Jenkinsfile`

**Последствие:**
- Нет автоматических тестов при commit
- Нет валидации перед deploy
- Баги попадают в production

---

## 4. ДОКУМЕНТАЦИЯ

### 4.1 README отсутствует

**Файл:** `README.md` — **НЕ СУЩЕСТВУЕТ!**

**Должен содержать:**
```markdown
# WB Reputation Manager

## Architecture Overview

This app uses PM2 cluster mode for API scaling:
- wb-reputation: 2 instances (API + UI)
- wb-reputation-cron: 1 instance (CRON jobs ONLY)
- wb-reputation-tg-bot: 1 instance (Telegram bot)

⚠️ IMPORTANT: CRON jobs run ONLY in wb-reputation-cron process!
Main app (wb-reputation) MUST have ENABLE_CRON_IN_MAIN_APP=false.

## Quick Start
...

## Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md)

## Troubleshooting
- Duplicate messages? Check ENABLE_CRON_IN_MAIN_APP=false
- CRON not running? Check wb-reputation-cron process status
```

**Последствие:** Новые разработчики не понимают архитектуру.

---

### 4.2 DEPLOYMENT.md документирует проблему как "фичу"

**Раздел:** [docs/DEPLOYMENT.md:209-218](docs/DEPLOYMENT.md#L209-L218)

```markdown
**Note:** CRON jobs run **inside** the Next.js process via `instrumentation.ts`.
The `wb-reputation-cron` process is a fallback trigger that ensures CRON init
after server is ready. No duplication — `initializeServer()` has an `initialized` flag.
```

**Проблема:**
- ❌ Утверждает "No duplication"
- ❌ Полагается на in-memory флаг (невозможно в cluster mode)
- ❌ Не объясняет зачем ДВА способа инициализации

**Правильная версия:**

```markdown
**Note:** CRON jobs run in wb-reputation-cron process ONLY.

Main app (wb-reputation) runs with ENABLE_CRON_IN_MAIN_APP=false to prevent
duplicate execution in cluster mode.

Architecture:
- wb-reputation (2 instances): HTTP API + UI
- wb-reputation-cron (1 instance): CRON jobs

⚠️ CRITICAL: If ENABLE_CRON_IN_MAIN_APP is not set to false, CRON will run
in ALL wb-reputation instances → 3× duplicate sends!
```

---

### 4.3 CRON_JOBS.md не адресует cluster mode

**Файл:** [docs/CRON_JOBS.md](docs/CRON_JOBS.md) (1263 lines)

**Хорошее:**
- Подробно описывает каждый CRON job
- Объясняет расписания
- Примеры логов

**Плохое:**
- **Нет раздела "Cluster Mode Safety"**
- Не предупреждает о `instances: 2` опасности
- Не объясняет почему CRON должен быть в отдельном процессе

**Должен быть раздел:**

```markdown
## Cluster Mode Safety

### Problem
With PM2 cluster mode (instances > 1), CRON jobs would run multiple times.

### Solution
Use ENABLE_CRON_IN_MAIN_APP flag:
- Production: false → CRON only in wb-reputation-cron
- Development: true → CRON in main app (single instance)

### Verification
After deployment:
```bash
# Should see exactly ONE initialization
pm2 logs wb-reputation-cron --lines 50 | grep -c "[INIT] Starting cron jobs"
# Output: 1 ✓

# Should NOT see CRON in main app
pm2 logs wb-reputation --lines 50 | grep "[INIT] Starting cron"
# Output: (empty) ✓
```
```

---

## 5. МОНИТОРИНГ

### 5.1 Логи есть, но не используются

**CRON инициализация логируется:**

```
[INSTRUMENTATION] 📂 File loaded at: 2026-03-13T10:00:00Z
[INIT] 🚀 Initializing server at 2026-03-13T10:00:00Z
[INIT] Starting cron jobs...
[CRON] ✅ Auto-sequence processor started (every 30 min)
```

**Проблема:** Если cluster mode с 2 instances, будет:

```
[INIT] Starting cron jobs...  ← Instance 1
[INIT] Starting cron jobs...  ← Instance 2
[INIT] Starting cron jobs...  ← wb-reputation-cron
```

**Никто не смотрел на логи!** ❌

**Решение:**

```bash
# Alert script
INIT_COUNT=$(pm2 logs wb-reputation --lines 100 | grep -c "[INIT] Starting cron jobs")

if [ "$INIT_COUNT" -gt 1 ]; then
  echo "⚠️ ALERT: CRON initialized $INIT_COUNT times (expected: 1)"
  # Send to Telegram/Slack/Email
fi
```

---

### 5.2 Alerts отсутствуют

**Нет мониторинга для:**

| Метрика | Как проверить | Alert есть? |
|---------|---------------|-------------|
| Дублирование CRON init | `grep -c "[INIT]"` в логах | ❌ |
| Дублирование sequences | `COUNT(*) GROUP BY chat_id` | ❌ |
| Дублирование сообщений | Одинаковый text в одном чате < 5 мин | ❌ |
| CRON процесс crashed | `pm2 status wb-reputation-cron` | ❌ |

**Последствие:** Проблемы обнаруживаются только когда пользователь жалуется.

---

### 5.3 Healthcheck недостаточен

**Текущий:** `GET /health` возвращает `200 OK`

**Проблема:** Не проверяет:
- Сколько экземпляров CRON запущено
- Есть ли дублирование
- Активны ли CRON jobs

**Правильный healthcheck:**

```typescript
// app/api/health/route.ts
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),

    // CRON status
    cron: {
      enabled: process.env.ENABLE_CRON_IN_MAIN_APP === 'true',
      initialized: isInitialized(),
      warning: process.env.ENABLE_CRON_IN_MAIN_APP === 'true' && process.env.NODE_ENV === 'production'
        ? '⚠️ CRON should not run in main app in production!'
        : null
    },

    // Cluster info
    cluster: {
      processId: process.pid,
      instanceId: process.env.NODE_APP_INSTANCE,
    }
  };

  return Response.json(health);
}
```

---

## 6. ВРЕМЕННАЯ ШКАЛА ПРОБЛЕМЫ

| Дата | Событие | Файл | Статус |
|------|---------|------|--------|
| 2026-01-14 | ADR-001: Решено использовать instrumentation.ts | `docs/decisions/ADR-001-why-instrumentation-hook.md` | ⚠️ Риск не митигирован |
| ~2026-02-08 | ecosystem.config.js: instances: 2 добавлено | `ecosystem.config.js:9` | ❌ Code review отсутствует |
| 2026-02-25 | DEPLOYMENT.md: документирует "No duplication" | `docs/DEPLOYMENT.md:217` | ❌ Ложное утверждение |
| 2026-03-13 | **ПРОБЛЕМА ОБНАРУЖЕНА** | Production | 🔴 Критическая |
| 2026-03-13 | ENABLE_CRON_IN_MAIN_APP флаг добавлен | `src/lib/init-server.ts:29` | ✅ Hotfix |
| 2026-03-13 | 2,075 sequences остановлены | Database | ✅ Emergency stop |
| 2026-03-13 | CRON процесс остановлен | PM2 | ✅ Рассылка остановлена |

**Вывод:** Проблема существовала минимум **1 месяц** (с момента включения cluster mode).

---

## 7. КОРНЕВЫЕ ПРИЧИНЫ (ROOT CAUSE ANALYSIS)

### 7.1 Технические причины

| # | Причина | Где | Последствие |
|---|---------|-----|-------------|
| 1 | In-memory флаг в cluster mode | `init-server.ts:8` | Невозможна синхронизация |
| 2 | Отсутствие ENABLE_CRON_IN_MAIN_APP в .env | `.env.production` | CRON запускается везде |
| 3 | Cluster mode без distributed lock | `ecosystem.config.js:9` | 2× дублирование |
| 4 | wb-reputation-cron также запускает CRON | `scripts/start-cron.js` | +1× дублирование |

### 7.2 Системные причины (ГЛАВНЫЕ)

| # | Системная проблема | Где | Импакт |
|---|-------------------|-----|--------|
| **1** | **Архитектура: Separation of concerns нарушена** | Вся система | 🔴 Критическая |
| **2** | **Процессы: Code review отсутствует** | Git workflow | 🟠 Высокая |
| **3** | **Testing: Zero integration tests для production mode** | Tests отсутствуют | 🟠 Высокая |
| **4** | **Документация: Устаревшая, скрывает проблемы** | DEPLOYMENT.md | 🟡 Средняя |
| **5** | **Мониторинг: Нет alerts на критические метрики** | Observability | 🟠 Высокая |
| **6** | **Deployment: Checklist неполный** | DEPLOYMENT.md | 🟠 Высокая |

### 7.3 Почему проблема не была обнаружена раньше?

**1. Отсутствие integration tests**
```
Unit tests: ✓ (возможно есть)
Integration tests для cluster mode: ❌ НЕТ
Load tests: ❌ НЕТ
```

**2. Code review не проводился**
```
ecosystem.config.js изменён → instances: 2
Кто review? ❌ Неизвестно
Была ли дискуссия? ❌ Нет
```

**3. Deployment checklist неполный**
```
Checklist проверяет: build, env vars, migrations
Checklist НЕ проверяет: CRON duplication, process count
```

**4. Мониторинг не настроен**
```
Логи есть: ✓
Alerts на дублирование: ❌ НЕТ
```

**5. Документация скрывает проблему**
```
DEPLOYMENT.md утверждает: "No duplication"
Реальность: 3× duplication ❌
```

---

## 8. РЕКОМЕНДАЦИИ

### 8.1 НЕМЕДЛЕННЫЕ (Hotfix - сегодня)

**✅ ВЫПОЛНЕНО:**
- [x] CRON процесс остановлен
- [x] 2,075 sequences остановлены
- [x] ENABLE_CRON_IN_MAIN_APP флаг добавлен в код

**🔄 ТРЕБУЕТСЯ:**

**1. Загрузить исправленный код на production:**

```bash
ssh ubuntu@158.160.229.16
cd /var/www/wb-reputation

# Upload files
# - src/lib/init-server.ts (with ENABLE_CRON_IN_MAIN_APP check)
# - migrations/999_emergency_prevent_duplicate_sequences.sql
# - scripts/EMERGENCY-stop-auto-sequences.mjs
# - scripts/AUDIT-check-duplicate-sends.mjs

# Build
npm run build

# Deploy
pm2 restart all
```

**2. Установить ENABLE_CRON_IN_MAIN_APP=false:**

```bash
# .env.production
echo "ENABLE_CRON_IN_MAIN_APP=false" >> .env.production

# Reload env
pm2 restart all
```

**3. Проверить логи:**

```bash
# Должен быть РОВНО 1 INIT лог
pm2 logs wb-reputation-cron --lines 50 | grep -c "[INIT] Starting cron jobs"
# Output: 1 ✓

# Main app НЕ должен запускать CRON
pm2 logs wb-reputation --lines 50 | grep "[INIT].*CRON jobs DISABLED"
# Output: [INIT] ⚠️  CRON jobs DISABLED in main app ✓
```

**4. Запустить миграцию:**

```bash
cd /var/www/wb-reputation
psql $DATABASE_URL -f migrations/999_emergency_prevent_duplicate_sequences.sql
```

---

### 8.2 КРАТКОСРОЧНЫЕ (Эта неделя)

**1. Создать TASK документ:**

```markdown
# TASK-20260313-CRON-Architecture-Fix

## Статус: In Progress
## Приоритет: P0 (Критический)
## Дата: 2026-03-13

## Проблема
CRON jobs запускаются 3× из-за cluster mode

## Решение
1. ENABLE_CRON_IN_MAIN_APP=false в production
2. Distributed lock (Redis) для будущего масштабирования
3. Обновить документацию
4. Добавить integration tests
5. Настроить мониторинг

## Критерии приёмки
- [ ] Только 1 CRON init в логах
- [ ] No duplicate messages sent
- [ ] Documentation updated
- [ ] Tests added
- [ ] Monitoring configured
```

**2. Обновить DEPLOYMENT.md:**

```markdown
## ⚠️ CRITICAL: CRON Configuration

**MUST SET in .env.production:**
```bash
ENABLE_CRON_IN_MAIN_APP=false  # Main app: API only, NO CRON
```

**Why:** With cluster mode (instances: 2), CRON would run 2× in main app
+ 1× in wb-reputation-cron = 3× duplicate execution!

**Verification after deployment:**
```bash
pm2 logs wb-reputation-cron | grep -c "[INIT] Starting cron jobs"
# MUST output: 1

pm2 logs wb-reputation | grep "[INIT].*CRON jobs DISABLED"
# MUST output: [INIT] ⚠️  CRON jobs DISABLED in main app
```
```

**3. Обновить ADR-001:**

```markdown
## Mitigation: PM2 Cluster Duplication

**Problem:** instances: 2 → each process runs instrumentation.ts

**Solution:** ENABLE_CRON_IN_MAIN_APP environment flag
- Production: false (CRON only in wb-reputation-cron fork)
- Development: true (CRON in main app for simplicity)

**Implementation:**
- [x] Flag check in init-server.ts:29
- [x] Documentation in DEPLOYMENT.md
- [ ] Distributed lock (Redis) for future scaling
- [ ] Integration tests for cluster mode

**Validation:**
```bash
pm2 logs | grep -c "[INIT] Starting cron jobs" → 1 ✓
```
```

**4. Создать README.md:**

```bash
touch README.md
```

```markdown
# WB Reputation Manager

B2B SaaS for Wildberries sellers: reputation management, reviews, complaints, chats.

## Architecture

### PM2 Processes
- **wb-reputation** (2 instances, cluster): HTTP API + Next.js UI
- **wb-reputation-cron** (1 instance, fork): CRON jobs ONLY
- **wb-reputation-tg-bot** (1 instance, fork): Telegram bot

⚠️ **CRITICAL:** CRON runs ONLY in wb-reputation-cron!
Main app MUST have `ENABLE_CRON_IN_MAIN_APP=false` in production.

## Quick Start
See [DEPLOYMENT.md](DEPLOYMENT.md)

## Troubleshooting
- **Duplicate messages?** → Check `ENABLE_CRON_IN_MAIN_APP=false`
- **CRON not running?** → Check `pm2 status wb-reputation-cron`
- **Logs:** `pm2 logs wb-reputation-cron`
```

**5. Добавить deployment validation:**

```bash
# deploy/validate-deployment.sh
#!/bin/bash

echo "🔍 Validating deployment..."

# Check ENABLE_CRON_IN_MAIN_APP
if grep -q "ENABLE_CRON_IN_MAIN_APP=false" .env.production; then
  echo "✅ ENABLE_CRON_IN_MAIN_APP=false"
else
  echo "❌ ERROR: ENABLE_CRON_IN_MAIN_APP must be 'false' in production!"
  exit 1
fi

# Check PM2 processes
CRON_COUNT=$(pm2 jlist | jq '[.[] | select(.name=="wb-reputation-cron")] | length')
if [ "$CRON_COUNT" -eq 1 ]; then
  echo "✅ wb-reputation-cron: 1 instance"
else
  echo "❌ ERROR: wb-reputation-cron must have exactly 1 instance!"
  exit 1
fi

# Check CRON initialization count
sleep 10  # Wait for init
INIT_COUNT=$(pm2 logs wb-reputation-cron --lines 50 --nostream | grep -c "[INIT] Starting cron jobs")
if [ "$INIT_COUNT" -eq 1 ]; then
  echo "✅ CRON initialized exactly once"
else
  echo "❌ ERROR: CRON initialized $INIT_COUNT times (expected: 1)!"
  exit 1
fi

echo "✅ Deployment validation passed!"
```

---

### 8.3 СРЕДНЕСРОЧНЫЕ (Этот месяц)

**1. Добавить integration tests:**

```typescript
// tests/integration/cron/cluster-mode.test.ts
import { spawn } from 'child_process';
import { expect } from '@jest/globals';

describe('CRON в cluster mode', () => {
  it('должен инициализировать CRON ровно 1 раз', async () => {
    // Simulate PM2 cluster: 2 instances
    const instances = [
      spawnNextJs({ instanceId: 0 }),
      spawnNextJs({ instanceId: 1 })
    ];

    await Promise.all(instances.map(i => i.waitForReady()));

    // Count CRON init logs
    const logs = getAllLogs();
    const initLogs = logs.filter(log => log.includes('[INIT] Starting cron jobs'));

    expect(initLogs.length).toBe(1);
  });

  it('НЕ должен отправлять дублирующие сообщения', async () => {
    const chatId = 'test-chat-123';

    // Start auto-sequence
    await db.query(`
      INSERT INTO chat_auto_sequences (id, chat_id, status, current_step, max_steps)
      VALUES ('seq-test', $1, 'active', 0, 15)
    `, [chatId]);

    // Trigger CRON manually
    await triggerCronJobs();

    // Wait for send
    await wait(5000);

    // Check messages
    const messages = await db.query(`
      SELECT * FROM chat_messages
      WHERE chat_id = $1 AND is_auto_reply = TRUE
    `, [chatId]);

    expect(messages.rows.length).toBe(1);  // РОВНО 1 сообщение!
  });
});
```

**2. Настроить мониторинг:**

```typescript
// scripts/monitoring/check-cron-duplication.mjs
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkDuplication() {
  // Check CRON init count
  const { stdout } = await execAsync(
    'pm2 logs wb-reputation-cron --lines 100 --nostream | grep -c "[INIT] Starting cron jobs"'
  );

  const initCount = parseInt(stdout.trim());

  if (initCount > 1) {
    // ALERT!
    await sendAlert({
      severity: 'critical',
      title: '🚨 CRON Duplication Detected',
      message: `CRON initialized ${initCount} times (expected: 1)`,
      action: 'Check ENABLE_CRON_IN_MAIN_APP flag'
    });
  }
}

// Run every 5 minutes
setInterval(checkDuplication, 5 * 60 * 1000);
```

**3. Добавить distributed lock (Redis):**

```typescript
// src/lib/distributed-lock.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function acquireLock(
  key: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const lockValue = process.pid.toString();

  const acquired = await redis.set(
    key,
    lockValue,
    'EX', ttlSeconds,
    'NX'  // Set if Not eXists
  );

  return acquired === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}

// Usage in init-server.ts:
import { acquireLock, releaseLock } from './distributed-lock';

export async function initializeServer() {
  const lockKey = 'cron:init:lock';
  const acquired = await acquireLock(lockKey, 300);

  if (!acquired) {
    console.log('[INIT] Another process already initialized CRON');
    return;
  }

  try {
    console.log('[INIT] Lock acquired, initializing CRON...');
    startCronJobs();
  } finally {
    // Keep lock for 5 min to prevent re-init
    setTimeout(() => releaseLock(lockKey), 5 * 60 * 1000);
  }
}
```

---

### 8.4 ДОЛГОСРОЧНЫЕ (Следующий квартал)

**1. Архитектурный рефакторинг:**

```
Текущая:
┌─ wb-reputation (2 instances) ← API + UI + CRON (bug!)
├─ wb-reputation-cron (1 instance)
└─ wb-reputation-tg-bot (1 instance)

Правильная (Separation of Concerns):
┌─ wb-reputation-api (N instances, cluster) ← ТОЛЬКО API + UI
├─ wb-reputation-worker (1 instance, fork) ← ТОЛЬКО CRON + background jobs
└─ wb-reputation-tg-bot (1 instance, fork) ← ТОЛЬКО Telegram
```

**Преимущества:**
- ✅ Масштабирование API независимо от CRON
- ✅ Невозможно случайно запустить CRON в API
- ✅ Простой мониторинг
- ✅ Distributed lock опционален (не обязателен для 1 worker)

**2. Database-driven CRON (вместо node-cron):**

```typescript
// Вместо:
cron.schedule('*/30 * * * *', autoSequenceProcessor);

// Использовать:
// PostgreSQL pg_cron extension
SELECT cron.schedule(
  'auto-sequence-processor',
  '*/30 * * * *',
  $$SELECT process_auto_sequences()$$
);
```

**Преимущества:**
- ✅ CRON живёт в БД, не в процессе
- ✅ Автоматически не дублируется
- ✅ Можно мониторить через SQL
- ✅ Переживает restart процессов

**3. Observability stack:**

```
Prometheus + Grafana:
- cron_init_count (gauge) → alert if > 1
- cron_job_runs_total (counter) → alert if stale
- auto_sequence_messages_sent (counter) → detect spikes
- chat_duplicate_sequences (gauge) → alert if > 0

Alertmanager:
- Slack/Telegram alerts
- PagerDuty for critical
```

---

## 9. LESSONS LEARNED

### 9.1 Что сделали ПРАВИЛЬНО

✅ **Быстрая реакция на проблему:**
- Emergency stop выполнен за 10 минут
- 2,075 sequences остановлены
- CRON процесс остановлен

✅ **Подробное логирование:**
- Все CRON операции логируются
- Можно проследить инициализацию

✅ **ADR-001 существует:**
- Риск cluster mode был указан
- Хотя митигация отсутствовала

### 9.2 Что сделали НЕПРАВИЛЬНО

❌ **Архитектура:**
- In-memory state в cluster mode
- Separation of concerns нарушена
- Множественные способы инициализации

❌ **Процессы:**
- Code review отсутствует
- ADR неполный (риск без митигации)
- Deployment checklist неполный

❌ **Testing:**
- Zero integration tests для production mode
- Не протестирован cluster mode
- CI/CD отсутствует

❌ **Документация:**
- README отсутствует
- DEPLOYMENT.md документирует ошибку как "фичу"
- CRON_JOBS.md не адресует cluster mode

❌ **Мониторинг:**
- Нет alerts на дублирование
- Healthcheck недостаточен
- Логи не анализируются

### 9.3 Ключевые выводы

**1. In-memory state НЕ работает в cluster mode**
> Фундаментальная архитектурная ошибка. Требует distributed state (Redis/Database).

**2. Separation of Concerns критична**
> CRON должен быть в отдельном процессе, не в API server.

**3. Testing обязателен для production scenarios**
> Cluster mode должен быть протестирован ДО production.

**4. Code review необходим для архитектурных решений**
> `instances: 2` — критическое изменение, требует review.

**5. Документация должна быть честной**
> Не скрывать проблемы, документировать ограничения.

**6. Мониторинг должен быть проактивным**
> Проблемы должны обнаруживаться автоматически, не от пользователей.

---

## 10. ACTION ITEMS

### Ответственность

| # | Action | Ответственный | Дедлайн | Статус |
|---|--------|---------------|---------|--------|
| 1 | Deploy hotfix (ENABLE_CRON_IN_MAIN_APP) | DevOps | Сегодня | 🔄 In Progress |
| 2 | Обновить DEPLOYMENT.md | Tech Lead | Эта неделя | ⏳ Pending |
| 3 | Создать README.md | Tech Lead | Эта неделя | ⏳ Pending |
| 4 | Добавить integration tests | QA Lead | Этот месяц | ⏳ Pending |
| 5 | Настроить мониторинг | DevOps | Этот месяц | ⏳ Pending |
| 6 | Архитектурный рефакторинг | Architect | Q2 2026 | ⏳ Planned |
| 7 | Внедрить CI/CD | DevOps | Q2 2026 | ⏳ Planned |

---

## 11. ЗАКЛЮЧЕНИЕ

**Корневая проблема:**
> Не баг в коде, а **системная проблема в архитектуре, процессах и культуре разработки**.

**Ключевые дефекты:**

1. **Архитектура:** In-memory state в cluster mode — фундаментальная ошибка
2. **Процессы:** Отсутствие code review для критических изменений
3. **Testing:** Zero tests для production scenarios
4. **Документация:** Скрывает проблемы вместо их документирования
5. **Мониторинг:** Проблемы обнаруживаются пользователями, не системой

**Путь вперёд:**

✅ **Immediate:** Deploy hotfix (сегодня)
🔄 **Short-term:** Documentation + validation (эта неделя)
📊 **Mid-term:** Testing + monitoring (этот месяц)
🏗️ **Long-term:** Architecture refactoring (Q2 2026)

---

**Отчёт составлен:** 2026-03-13
**Автор:** Emergency Response Team
**Статус:** Final Review
**Категория:** Post-Incident Architecture Audit

**Требуется срочное внимание:** ✅ ДА
**Критичность:** 🔴 P0 (Critical)

---

## ПРИЛОЖЕНИЯ

### A. Файлы для review

- [x] `src/lib/init-server.ts` — ENABLE_CRON_IN_MAIN_APP check
- [x] `ecosystem.config.js` — instances: 2
- [x] `instrumentation.ts` — auto CRON init
- [ ] `.env.production` — ENABLE_CRON_IN_MAIN_APP=false (ТРЕБУЕТСЯ)
- [x] `docs/decisions/ADR-001-why-instrumentation-hook.md`
- [ ] `DEPLOYMENT.md` — обновить (ТРЕБУЕТСЯ)
- [ ] `README.md` — создать (ТРЕБУЕТСЯ)
- [ ] `docs/CRON_JOBS.md` — добавить Cluster Mode Safety раздел (ТРЕБУЕТСЯ)

### B. Связанные документы

- [START-HERE.md](START-HERE.md) — Quick start guide
- [EMERGENCY-FIX-SUMMARY.md](EMERGENCY-FIX-SUMMARY.md) — Детальный план фикса
- [EMERGENCY-STOP-GUIDE.md](EMERGENCY-STOP-GUIDE.md) — Troubleshooting guide
- [migrations/999_emergency_prevent_duplicate_sequences.sql](migrations/999_emergency_prevent_duplicate_sequences.sql) — DB migration

---

**END OF REPORT**
