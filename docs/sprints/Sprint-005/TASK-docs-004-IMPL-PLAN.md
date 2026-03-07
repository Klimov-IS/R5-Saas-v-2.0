# Implementation Plan: Concurrency Hardening

**Source:** [BACKEND-CONCURRENCY-AUDIT.md](./BACKEND-CONCURRENCY-AUDIT.md)
**Date:** 2026-03-07
**Status:** Approved

---

## Context

Backend Concurrency Audit (TASK-docs-004) выявил 1 CRITICAL, 3 HIGH и 5 MEDIUM проблем.
H-3 (RCL dupes) уже закрыт миграцией 026. Остаётся 8 находок для реализации.

Цель: закрыть все выявленные risk items через миграции, транзакции и точечные правки кода.
Код не переписываем — добавляем защитные механизмы к существующей логике.

---

## Task 1: UNIQUE partial index на `chat_auto_sequences` (C-1 + H-1)

**Проблема:** Нет DB-level гарантии "один active sequence на chat". TOCTOU-гонка в `startSequence()`.

**Файлы:**
- `migrations/030_sequence_concurrency_hardening.sql` (новый)
- `src/core/services/sequence-service.ts` (правка)
- `src/db/client.ts` (только import — `transaction()` уже есть)

**Шаги:**

1. **Миграция 030** — UNIQUE partial index:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_sequences_one_active_per_chat
  ON chat_auto_sequences (chat_id)
  WHERE status = 'active';
```

2. **Обернуть `startSequence()` в транзакцию** — использовать существующий `transaction()` из `src/db/client.ts`:
   - Внутри транзакции: `SELECT ... FOR UPDATE` на `chat_auto_sequences WHERE chat_id AND status = 'active'`
   - Если найден → throw `SequenceConflictError`
   - INSERT новой последовательности внутри той же транзакции
   - sendSequenceMessage и updateChatWithAudit — **вне транзакции** (внешний API вызов не в транзакции)

3. **Catch `unique_violation`** (code `23505`) при INSERT — конвертировать в `SequenceConflictError(409)` как fallback.

---

## Task 2: Advisory lock для dialogue sync (M-2)

**Проблема:** Две синхронизации одного магазина могут пересечься. `existingChatMap` устаревает.

**Файлы:**
- `src/app/api/stores/[storeId]/dialogues/update/route.ts` (правка)

**Шаги:**

1. В начале `updateDialoguesForStore()` — `pg_try_advisory_lock(hash(storeId))`
2. Если lock не получен → return "already running, skipped"
3. В конце (finally) — `pg_advisory_unlock(hash(storeId))`
4. Хелпер `hashStoreId()` — deterministic int из storeId

---

## Task 3: Optimistic locking для status transitions (M-2)

**Проблема:** Dialogue sync перезаписывает status, не проверяя, изменился ли он другим процессом.

**Файлы:**
- `src/db/helpers.ts` — новая функция `updateChatStatusOptimistic()`

**Шаги:**

1. Функция с WHERE `status_updated_at = $expectedUpdatedAt`
2. В dialogue sync — заменить прямые `updateChatWithAudit()` на optimistic-вариант
3. 0 rows → log + skip (другой процесс уже изменил)

---

## Task 4: Транзакция для complaint-statuses (M-4)

**Проблема:** Два UPDATE (reviews + review_complaints) без транзакции.

**Файлы:**
- `src/app/api/extension/complaint-statuses/route.ts` (правка)

**Шаги:**

1. Обернуть шаги 5-7 в `transaction()` из `@/db/client`
2. Адаптировать `closeLinkedChatsForReviews()` — optional `client` параметр

---

## Task 5: Processing lock для cron sequences (M-3 + H-2)

**Проблема:** `runningJobs` теряется при PM2 restart. Cron может дважды обработать sequence.

**Файлы:**
- `migrations/030_sequence_concurrency_hardening.sql` (дополнить)
- `src/lib/cron-jobs.ts` (правка)

**Шаги:**

1. Колонка `processing_locked_at TIMESTAMPTZ` в миграции 030
2. Atomic lock: `UPDATE ... SET processing_locked_at = NOW() WHERE (NULL OR > 10min TTL) RETURNING *`
3. Unlock после обработки: `SET processing_locked_at = NULL`

---

## Task 6: Dedup chat_status_history (M-5)

**Проблема:** Двойное закрытие чата создаёт дубликаты в audit log.

**Файлы:**
- `src/db/helpers.ts` — правка `updateChatWithAudit()`

**Шаги:**

1. Проверка: если `old_status === new_status` → не вставлять запись в `chat_status_history`

---

## Task 7: Stale cleanup time guard (L-3)

**Проблема:** Cleanup SQL может сбросить `awaiting_reply`, установленный пользователем секунду назад.

**Файлы:**
- `src/lib/cron-jobs.ts` (правка)

**Шаги:**

1. Добавить `AND status_updated_at < NOW() - INTERVAL '5 minutes'` к cleanup query

---

## Порядок реализации

| # | Task | Severity | Тип |
|---|------|----------|-----|
| 1 | UNIQUE index + transaction sequences | C-1, H-1 | Migration + Code |
| 2 | Advisory lock dialogue sync | M-2 | Code |
| 3 | Optimistic locking status transitions | M-2 | Code |
| 4 | Transaction complaint-statuses | M-4 | Code |
| 5 | Processing lock cron sequences | M-3, H-2 | Migration + Code |
| 6 | Dedup chat_status_history | M-5 | Code |
| 7 | Stale cleanup time guard | L-3 | Code |

Миграция: одна — `030_sequence_concurrency_hardening.sql` (Task 1 + Task 5).

---

## Verification

1. SQL: 2 active sequences → unique_violation
2. 2 parallel dialogue syncs → second skipped
3. complaint-statuses endpoint regression test
4. `processing_locked_at` lifecycle
5. `npm run build` passes
