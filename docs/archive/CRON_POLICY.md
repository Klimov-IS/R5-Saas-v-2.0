> **ARCHIVED (2026-03-06):** Content merged into [CRON_JOBS.md](../CRON_JOBS.md) — "Development Standards" section

# Политика работы с CRON jobs

**Дата:** 2026-02-08
**Версия:** 1.0
**Статус:** Обязательно к исполнению

---

## Принципы

1. **Идемпотентность** — повторный запуск безопасен
2. **Логирование** — каждый job логирует start/end/errors
3. **Защита от overlap** — нельзя запустить параллельно
4. **Документация** — каждый job описан в CRON_JOBS.md

---

## Запрещено

| Действие | Риск |
|----------|------|
| Добавить cron без документации | Потеря знаний |
| Менять расписание без оценки нагрузки | Перегрузка API/DB |
| Создать job без защиты от overlap | Race conditions |
| Job без логирования | Невозможность диагностики |

---

## Обязательно при добавлении CRON job

### 1. Реализация с защитой

```typescript
const runningJobs: { [key: string]: boolean } = {};

cron.schedule('...', async () => {
  const jobName = 'my-job';

  // Защита от overlap
  if (runningJobs[jobName]) {
    console.log(`[CRON] ⚠️ ${jobName} already running`);
    return;
  }

  runningJobs[jobName] = true;
  const startTime = Date.now();

  try {
    console.log(`[CRON] 🚀 Starting ${jobName}`);
    // ... job logic ...
    console.log(`[CRON] ✅ ${jobName} completed in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`[CRON] ❌ ${jobName} failed:`, error);
  } finally {
    runningJobs[jobName] = false;
  }
});
```

### 2. Регистрация в init-server.ts

```typescript
import { startMyNewJob } from './cron-jobs';

export function initializeServer() {
  // ... existing jobs ...
  startMyNewJob();
}
```

### 3. Документация в CRON_JOBS.md

```markdown
### My New Job

**Job Name:** `my-new-job`
**Schedule:**
- Production: `0 X * * *`
- Development: `*/Y * * * *`

**What It Does:**
1. Step 1
2. Step 2
3. Step 3

**Source:** `src/lib/cron-jobs.ts:XXX`

**Idempotency:** Да/Нет
**Rate Limiting:** X секунд между операциями
**Error Handling:** описание
```

---

## Расписания

### Формат

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── день недели (0-7)
│ │ │ └───── месяц (1-12)
│ │ └─────── день месяца (1-31)
│ └───────── час (0-23)
└─────────── минута (0-59)
```

### Временная зона

Все расписания в **UTC**. MSK = UTC+3.

| MSK | UTC | Cron |
|-----|-----|------|
| 08:00 | 05:00 | `0 5 * * *` |
| 09:00 | 06:00 | `0 6 * * *` |

### Dev vs Prod

```typescript
const schedule = process.env.NODE_ENV === 'production'
  ? '0 5 * * *'      // Production
  : '*/5 * * * *';   // Development
```

---

## Идемпотентность

### Что это

Job можно запустить повторно без побочных эффектов.

### Как достичь

1. **Проверка существующих данных** перед созданием
2. **Upsert** вместо insert
3. **Unique constraints** в БД
4. **Статус-флаги** для отслеживания обработки

### Пример

```typescript
// ❌ Плохо — создаст дубли
await db.insert(complaints).values(newComplaints);

// ✅ Хорошо — идемпотентно
for (const complaint of newComplaints) {
  const exists = await db.select().from(complaints)
    .where(eq(complaints.reviewId, complaint.reviewId));
  if (!exists) {
    await db.insert(complaints).values(complaint);
  }
}
```

---

## Мониторинг

### Логи

```bash
pm2 logs wb-reputation | grep "[CRON]"
```

### API статуса

```bash
curl http://localhost:3000/api/cron/status
```

### Алерты

При ошибках cron — логировать с `[CRON] ❌` prefix для grep.

---

## Связанные документы

- [CRON_JOBS.md](../CRON_JOBS.md) — документация всех jobs
- [DEPLOYMENT.md](../DEPLOYMENT.md) — деплой и restart
- [ADR-003](../decisions/ADR-003-cron-intervals.md) — выбор интервалов

---

**Last Updated:** 2026-02-08
