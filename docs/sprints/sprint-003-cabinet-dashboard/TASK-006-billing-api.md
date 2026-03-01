# TASK-006: Billing — API endpoints

> **Статус:** Draft (отложено)
> **Приоритет:** P1
> **Фаза:** Phase 3
> **Sprint:** 003
> **Зависимость:** TASK-005
> **Примечание:** Черновик. Требует отдельного планирования. Зависит от системы учёта удалений.

---

## Goal

API для управления биллингом: настройка тарифа, создание счетов, учёт оплат, расчёт задолженности.

## Scope

### Endpoints

```
GET    /api/stores/[storeId]/billing              — тариф + сводка
PUT    /api/stores/[storeId]/billing/settings     — обновить тариф (price_per_deletion, period)
GET    /api/stores/[storeId]/billing/invoices      — список счетов
POST   /api/stores/[storeId]/billing/invoices      — создать счёт (auto-calculate)
PATCH  /api/stores/[storeId]/billing/invoices/[id] — обновить статус (sent/paid/cancelled)
GET    /api/stores/[storeId]/billing/payments      — список оплат
POST   /api/stores/[storeId]/billing/payments      — записать оплату
GET    /api/stores/[storeId]/billing/summary       — итого: начислено / оплачено / долг
```

### Auto-calculate invoice

При создании счёта:
1. Указывается period_start/period_end
2. API считает `COUNT(reviews WHERE deleted_from_wb_at BETWEEN ...)`
3. Умножает на price_per_deletion из store_billing
4. Создаёт invoice со status=draft

### DB helpers
- `src/db/billing-helpers.ts`

## Estimated Effort
- ~4-5 часов
