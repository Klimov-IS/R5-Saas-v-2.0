# TASK: Защита от пропуска отзывов при синхронизации

**Дата:** 2026-02-15
**Приоритет:** Высокий
**Статус:** Реализовано, ожидает деплоя
**Компонент:** CRON, Review Sync, WB API

---

## Goal

Устранить проблему пропуска отзывов при синхронизации с WB API. Часть отзывов регулярно не загружается через инкрементальный sync, что приводит к отсутствию жалоб на свежие отзывы.

## Current State

- Инкрементальный sync: каждый час, overlap 1 час
- Rolling full sync: 3:00 MSK, **только Пн-Сб** (воскресенье — gap)
- Нет retry при ошибках WB API (429, timeout)
- Нет второго дневного прохода chunk 0

## Root Cause Analysis

1. **Воскресный gap** — rolling sync не работает в воскресенье
2. **WB API задержка индексации** — overlap 1 час недостаточен
3. **Rate limiting без retry** — упавшие stores пропускаются
4. **Одноразовый проход chunk 0** — только в 3:00 MSK

## Changes

### 1. Rolling sync каждый день (включая вс)
- `src/lib/cron-jobs.ts`: `0 0 * * 1-6` → `0 0 * * *`

### 2. Midday review catchup (13:00 MSK)
- `src/lib/cron-jobs.ts`: новая `startMiddayReviewCatchup()` — chunk 0 only
- `src/lib/init-server.ts`: регистрация нового job

### 3. Overlap инкрементального sync 1ч → 3ч
- `src/app/api/stores/[storeId]/reviews/update/route.ts`: `-3600 * 1000` → `-3 * 3600 * 1000`

### 4. Retry для failed stores
- `src/lib/cron-jobs.ts`: retry 1 раз с задержкой 5 сек после основного цикла

## Impact

- **DB:** Нет изменений (upsert, idempotent)
- **API:** Нет изменений
- **Cron:** 1 новый job (midday catchup), расписание rolling sync расширено, retry добавлен
- **AI:** Нет изменений
- **UI:** Нет изменений

## Required Docs Updates

- [x] `docs/CRON_JOBS.md` — midday catchup, rolling sync daily, retry, overlap 3h
- [x] `docs/tasks/TASK-20260215-review-sync-protection.md` — этот файл

## Rollout Plan

1. Билд + деплой кода
2. Проверить PM2 логи: midday catchup registered
3. Мониторинг 24ч: все stores имеют свежие отзывы

## Backout Plan

- Код: git revert
- Данных не теряется (all changes are additive)
