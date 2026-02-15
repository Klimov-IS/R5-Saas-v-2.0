# TASK: Исправления системы генерации жалоб

**Дата:** 2026-02-15
**Приоритет:** Высокий
**Статус:** Реализовано (код), ожидает деплоя
**Компонент:** Complaints, Backfill, AI prompts

---

## Goal

Исправить 3 проблемы в системе генерации жалоб:
1. 45 жалоб сгенерированы на отзывы до 01.10.2023 (запрет WB)
2. Лимит символов снизить с 1000 до 900 (запас от WB hard limit)
3. Ускорить backfill генерацию (batch, daily limit, immediate trigger)

## Current State

- 45 невалидных жалоб: все `pending`, сгенерированы 02.02.2026, до внедрения cutoff-проверки
- Hard limit = 1000, 2 draft-жалобы в диапазоне 900-999 символов
- Backfill: BATCH_SIZE=100, DAILY_LIMIT=2000, задержка 5 мин до первого запуска

## Proposed Changes

### Фаза 1: Очистка + защита БД
- Скрипт `scripts/cleanup-pre-cutoff-complaints.mjs` — удаление 45 невалидных
- Миграция 014: `CHECK (review_date >= '2023-10-01')` — защита на уровне БД

### Фаза 2: Лимит символов 1000 → 900
- `COMPLAINT_HARD_LIMIT`: 1000 → **900**
- `COMPLAINT_SOFT_LIMIT`: 800 → **750**
- AI промпт: 500–800 → **450–750** символов
- Перегенерация draft-жалоб >900 символов после деплоя

### Фаза 3: Ускорение backfill
- `BATCH_SIZE`: 100 → **200**
- `BATCH_DELAY_MS`: 2000 → **1500**
- `MAX_BATCHES_PER_RUN`: 10 → **20**
- `DEFAULT_DAILY_LIMIT`: 2000 → **6000**
- CRON fallback batch: 50 → **200**
- Немедленный запуск `runBackfillWorker(1)` при активации товара

## Impact

- **DB:** CHECK constraint (миграция 014), удаление 45 строк
- **API:** Немедленный запуск backfill при PATCH product status
- **Cron:** Увеличен batch CRON fallback 50→200
- **AI:** Промпт обновлён на 450-750 символов
- **UI:** Без изменений

## Files Changed

| Файл | Изменение |
|------|-----------|
| `src/ai/utils/complaint-text-validator.ts` | HARD_LIMIT 1000→900, SOFT_LIMIT 800→750 |
| `src/ai/prompts/optimized-review-complaint-prompt.ts` | Промпт: 500-800 → 450-750 |
| `src/services/backfill-worker.ts` | BATCH_SIZE 100→200, DELAY 2000→1500, MAX_BATCHES 10→20 |
| `src/db/backfill-helpers.ts` | DEFAULT_DAILY_LIMIT 2000→6000 |
| `src/types/backfill.ts` | DAILY_COMPLAINT_LIMIT 2000→6000, BATCH constants |
| `src/app/api/stores/[storeId]/products/[productId]/status/route.ts` | Immediate backfill trigger |
| `src/lib/cron-jobs.ts` | CRON fallback batch 50→200 |
| `migrations/014_complaint_cutoff_constraint.sql` | CHECK constraint |
| `scripts/cleanup-pre-cutoff-complaints.mjs` | Удаление невалидных |

## Required Docs Updates

- [x] `docs/database-schema.md` — CHECK constraint
- [x] `docs/domains/complaints.md` — лимит 900, daily limit 6000, cutoff
- [x] `docs/CRON_JOBS.md` — batch sizes, removed stores cache
- [x] `docs/tasks/TASK-20260215-complaint-system-fixes.md` — этот файл

## Rollout Plan

1. Скрипт: удалить 45 невалидных жалоб на сервере
2. Миграция 014: CHECK constraint
3. Билд + деплой кода
4. Скрипт: перегенерировать draft >900
5. Мониторинг 48ч

## Backout Plan

- Миграция: `ALTER TABLE review_complaints DROP CONSTRAINT check_review_date_after_cutoff;`
- Код: git revert
- Жалобы: невосстановимы (все были pending, не критично)
