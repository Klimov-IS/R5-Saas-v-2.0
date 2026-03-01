# TASK-008: Reporting — Schema

> **Статус:** Draft (отложено)
> **Приоритет:** P2
> **Фаза:** Phase 4
> **Sprint:** 003
> **Зависимость:** Phase 3
> **Примечание:** Черновик. Требует отдельного планирования. Зависит от системы учёта удалений.

---

## Goal

Таблицы для хранения отчётов и ленты активности.

## Scope

### Migration 020

**`store_reports`** — сгенерированные отчёты:
- report_type (weekly/monthly/custom)
- period_start/period_end
- data JSONB — snapshot всех метрик на момент генерации
- generated_at

**`store_activity_log`** — лента событий:
- event_type: sync_completed, complaint_filed, complaint_approved, review_deleted, chat_completed, chat_upgraded, sequence_started, sequence_completed, settings_changed
- event_data JSONB — детали
- created_at

### Хуки для записи событий
- В dialogue-sync: запись sync_completed, chat_completed, review_deleted
- В complaint routes: запись complaint_filed, complaint_approved
- В auto-sequence processor: запись sequence_started/completed

## Estimated Effort
- ~3-4 часа (миграция + хуки)
