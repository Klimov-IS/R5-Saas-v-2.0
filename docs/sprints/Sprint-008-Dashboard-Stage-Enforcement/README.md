# Sprint 008 — Dashboard & Stage Enforcement

**Date:** 2026-03-14
**Status:** IN PROGRESS

---

## Context

Аудит главной страницы (кабинеты) и системы этапов работы выявил:

1. Dashboard показывает `0/0` в столбце "Диалоги" для магазинов без чат-правил — должен показывать `—`
2. Расширение открывает чаты без проверки этапа кабинета — может открыть чаты на этапе "Подаём жалобы" (до "Открываем чаты")
3. `stores.stage` — чисто информационное поле, не влияет на автоматизацию

## Documents

| File | Description |
|------|-------------|
| [AUDIT.md](AUDIT.md) | Полный аудит: dashboard расчёты, stage система, extension API |

## Backlog

| # | Task | Priority | Status |
|---|------|----------|--------|
| TASK-1 | Dashboard: `0/0` → `—` для магазинов без чат-правил | P1 | Pending |
| TASK-2 | Extension API: stage guard для chat tasks | P0 | Pending |
| TASK-3 | `isStageAtLeast()` utility в types/stores.ts | P1 | Pending |
| TASK-4 | Audit script: преждевременно открытые чаты | P1 | Pending |
| TASK-5 | Deploy & verify | P1 | Pending |
