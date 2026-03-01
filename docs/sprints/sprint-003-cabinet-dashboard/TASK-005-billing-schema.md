# TASK-005: Billing — Schema + Модель расчётов

> **Статус:** Draft (отложено)
> **Приоритет:** P1
> **Фаза:** Phase 3
> **Sprint:** 003
> **Зависимость:** Phase 2
> **Примечание:** Черновик. Требует отдельного планирования. Зависит от системы учёта удалений.

---

## Goal

Создать финансовую подсистему: таблицы для тарифов, счетов и оплат. Автоматический расчёт стоимости на основе удалённых отзывов.

## Scope

### Migration 019

**Таблицы:**
- `store_billing` — тариф магазина (1:1 со stores)
  - price_per_deletion, billing_currency, billing_period, billing_email
- `billing_invoices` — выставленные счета
  - period_start/end, deletions_count, total_amount, status (draft/sent/paid/overdue/cancelled)
- `billing_payments` — оплаты
  - amount, payment_date, payment_method, reference_number, invoice_id

### Бизнес-логика расчёта

```
Количество удалений за период =
  COUNT(reviews WHERE store_id = X
    AND deleted_from_wb_at BETWEEN period_start AND period_end)

Сумма = количество * price_per_deletion
Задолженность = SUM(invoices.total_amount WHERE status != 'paid')
              - SUM(payments.amount)
```

### Вопросы к обсуждению (перед реализацией)
1. Считаем ВСЕ удаления или только по R5-жалобам? (filed_by = 'r5')
2. Периодичность: месяц / неделя / по факту?
3. API интеграция с банком — какой банк, какое API?
4. Нужна ли автоматическая отправка счёта на email?

## Impact
- **DB:** Migration 019 (3 новые таблицы)
- **API:** TASK-006
- **UI:** TASK-007
- **Cron:** Возможно автогенерация счетов в конце периода

## Estimated Effort
- ~3-4 часа (миграция + helpers)
