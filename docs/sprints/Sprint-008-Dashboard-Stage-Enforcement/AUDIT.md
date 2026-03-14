# Audit: Dashboard Calculations & Stage Enforcement

**Date:** 2026-03-14
**Sprint:** Sprint-008

---

## 1. Dashboard — Dialogues Column for Stores Without Chat Rules

### Current Behavior

Main page (`src/app/page.tsx:775-789`) shows dialog counts in format `opened / required` via `ProgressCell` component.

**Data source:** `GET /api/dashboard/store-progress` -> `getStoreProgress()` (`src/db/helpers.ts:3500`)

SQL query `DIALOGUES_PROGRESS_SQL` (helpers.ts:3397-3432) joins `products` + `product_rules` + `reviews` + `review_chat_links` for **all active WB stores** where `pr.work_in_chats = TRUE`.

### Problem

For WB stores where **ни один артикул** не имеет `work_in_chats = TRUE`:
- SQL вернет 0 строк для этого магазина
- Но если магазин попал в `PRODUCTS_PROGRESS_SQL` → он добавлен в map с default `dialogues: { opened: 0, required: 0 }`
- UI показывает **`0 / 0`** — бессмысленное число

**Для OZON магазинов:** SQL фильтрует `marketplace = 'wb'`, поэтому OZON магазины не попадают в map → UI показывает `—` (правильно).

### Performance Impact

SQL query `DIALOGUES_PROGRESS_SQL`:
- Выполняется для **всех** активных WB магазинов одним запросом (не по-одному)
- Кэшируется на 15 мин (`STORE_PROGRESS_CACHE_TTL`)
- Pre-warm при загрузке модуля
- **Дополнительная нагрузка от магазинов без чатов: ~0** (INNER JOIN с `pr.work_in_chats = TRUE` отсекает их на уровне SQL)

**Вывод:** Запрос не тратит время на магазины без чат-правил. Проблема чисто **визуальная** — `0/0` вводит в заблуждение.

### Recommended Fix

Если у магазина `dialogues.opened === 0 && dialogues.required === 0` → показывать `—` вместо `0/0`.

Это мгновенно покажет: "в этом кабинете чаты не согласованы".

**Файл:** `src/app/page.tsx:775-789` — добавить проверку перед `ProgressCell`.

---

## 2. Store Stages — Not Enforced in Automation

### Current Stage System

**Таблица:** `stores.stage` (migration 031)

**Этапы (в порядке прогресса):**
```
contract → access_received → cabinet_connected → complaints_submitted → chats_opened → monitoring
```

Плюс: `client_paused`, `client_lost` (альтернативные ветки)

**Файл с типами:** `src/types/stores.ts`

### Problem: Extension Opens Chats Regardless of Stage

**Extension Tasks API** (`src/app/api/extension/stores/[storeId]/tasks/route.ts`):
- Query B (`chatOpens`) проверяет:
  - `pr.work_in_chats = TRUE` ✅
  - `rc.status = 'rejected'` ✅
  - `r.chat_status_by_review = 'available'` ✅
  - `p.work_status = 'active'` ✅
  - НЕ проверяет `stores.stage` ❌

**Результат:** Если кабинет на этапе `complaints_submitted` (ещё до `chats_opened`), но у артикулов `work_in_chats = TRUE` (например, применили defaults) — расширение **начинает открывать чаты**, хотя мы ещё не перешли к этому этапу с клиентом.

### Chat Opening Flow (No Stage Guard)

```
1. Extension → GET /api/extension/stores/{storeId}/tasks
2. Backend → SQL: finds reviews where complaint rejected + work_in_chats + chat available
   → NO check on stores.stage
3. Extension gets chatOpens tasks → opens chats on WB
4. Extension → POST /api/extension/chat/opened → creates review_chat_link
```

### What Should Happen

Чат-задачи должны генерироваться ТОЛЬКО если:
1. `product_rules.work_in_chats = TRUE` (правила согласованы)
2. `stores.stage` >= `chats_opened` (этап не ниже "Открываем чаты")
3. `stores.is_active = TRUE` (кабинет активен)

### Stage Hierarchy for Enforcement

```typescript
const STAGE_ORDER: Record<StoreStage, number> = {
  contract: 0,
  access_received: 1,
  cabinet_connected: 2,
  complaints_submitted: 3,
  chats_opened: 4,
  monitoring: 5,
  client_paused: -1,  // special
  client_lost: -1,    // special
};

function isStageAtLeast(current: StoreStage, required: StoreStage): boolean {
  const currentOrder = STAGE_ORDER[current];
  const requiredOrder = STAGE_ORDER[required];
  return currentOrder >= 0 && requiredOrder >= 0 && currentOrder >= requiredOrder;
}
```

---

## 3. Dashboard Progress — Stage-Aware Display

### Current Columns

| Column | Data Source | Shows |
|--------|-----------|-------|
| Products | `PRODUCTS_PROGRESS_SQL` | active / total |
| Reviews | `REVIEWS_PROGRESS_SQL` | processed / totalInWork |
| Dialogues | `DIALOGUES_PROGRESS_SQL` | opened / required |

### Proposed Enhancement

Для столбца Dialogues — показывать `—` если:
- `store.marketplace === 'ozon'` (уже работает)
- dialogues `required === 0 && opened === 0` (чаты не согласованы)
- `store.stage` < `chats_opened` (этап ещё не дошёл до чатов)

Для столбца Reviews — аналогично, если `store.stage` < `complaints_submitted`.

---

## 4. Summary of Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | Dashboard shows `0/0` for stores without chat rules | Low (visual) | Confusion — unclear if not configured or zero progress |
| 2 | Extension opens chats without stage check | **High** | Chats opened prematurely before client agreement |
| 3 | No stage-aware display logic on dashboard | Low (visual) | Cannot quickly see which stores are in chat phase |
| 4 | `product_rules` defaults enable `work_in_chats = true` | Medium | Applying defaults prematurely enables chat automation |

---

## 5. Files Reference

| File | Role |
|------|------|
| `src/app/page.tsx:775-789` | Dashboard dialog column rendering |
| `src/db/helpers.ts:3397-3432` | `DIALOGUES_PROGRESS_SQL` query |
| `src/db/helpers.ts:3500` | `getStoreProgress()` with 15min cache |
| `src/components/stores/ProgressCell.tsx` | `current/total` display component |
| `src/app/api/extension/stores/[storeId]/tasks/route.ts` | Extension tasks — NO stage check |
| `src/app/api/extension/chat/opened/route.ts` | Chat opened callback |
| `src/app/api/extension/chat/stores/route.ts` | Extension store list with pending chats count |
| `src/types/stores.ts` | `StoreStage` type + labels |
| `migrations/031_add_stores_stage.sql` | Stage column migration |
