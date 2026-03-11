# Sprint-006 Backlog — Store Lifecycle & Stage System

**Sprint Goal:** Внедрить систему этапов (stages) работы с клиентом и спланировать полный переход с технических статусов (status) на бизнес-этапы (stages).

**Status:** Planning
**Start Date:** TBD
**Target Completion:** TBD

---

## Executive Summary

### Что делаем:

**Phase 1-3:** Добавляем поле `stores.stage` + UI для управления этапами
**Phase 4-5:** Аудит всех использований `stores.status` + план миграции
**Phase 6:** Интеграция с новыми метриками (из AUDIT-stores-metrics-modernization.md)

### Почему:

Текущее поле `stores.status` не информативно для операционного управления:
- `active` / `paused` / `stopped` — только технические состояния
- Не показывают где клиент в воркфлоу
- Не помогают менеджерам понять прогресс

Новое поле `stores.stage` решает это:
- 8 этапов работы с клиентом (от "Договор" до "Клиент потерян")
- Операционная видимость: где клиент, что делать дальше
- Основа для analytics, notifications, automation

### Конечная цель:

Полностью заменить `stores.status` на `stores.stage` во всей системе (extensions, cron, API, UI).

---

## Scope & Constraints

### In Scope:
✅ Добавление поля `stores.stage`
✅ UI для отображения и управления этапами
✅ API для изменения этапа
✅ Domain документация (`store-lifecycle.md`)
✅ Audit всех использований `stores.status`
✅ Детальный план миграции status → stage

### Out of Scope (Phase 2 / Sprint-007):
❌ Автоматические переходы между этапами
❌ Реализация миграции status → stage (только планирование)
❌ Stage-based notifications/alerts
❌ Analytics dashboard по этапам
❌ Audit trail для изменений stage (`store_stage_history` table)

### Dependencies:
- ⚠️ Может конфликтовать с AUDIT-stores-metrics-modernization.md (те же таблицы)
- Рекомендация: сделать этот Sprint-006 первым, метрики потом

---

## Phase 1: Foundation — Добавление поля Stage

**Goal:** Добавить поле `stores.stage` в DB + backfill начальных значений

---

### Task 1.1: Migration 028 — Add stores.stage

**File:** `migrations/028_add_stores_stage.sql`

**SQL:**
```sql
-- Add stage column
ALTER TABLE stores
  ADD COLUMN stage VARCHAR(50) DEFAULT 'cabinet_connected';

-- Add constraint
ALTER TABLE stores
  ADD CONSTRAINT stores_stage_check
    CHECK (stage IN (
      'contract',
      'access_received',
      'cabinet_connected',
      'complaints_submitted',
      'chats_opened',
      'monitoring',
      'client_paused',
      'client_lost'
    ));

-- Create index for filtering/sorting
CREATE INDEX idx_stores_stage ON stores(stage)
  WHERE stage IS NOT NULL;

-- Add comment
COMMENT ON COLUMN stores.stage IS 'Этап работы с клиентом (business lifecycle stage)';
```

**Rollback:**
```sql
ALTER TABLE stores DROP CONSTRAINT stores_stage_check;
DROP INDEX idx_stores_stage;
ALTER TABLE stores DROP COLUMN stage;
```

**ETA:** 15 minutes

---

### Task 1.2: Backfill Initial Values

**Goal:** Установить начальные значения `stage` для существующих stores на основе логики

**Logic:**

```typescript
// Pseudo-code для backfill скрипта
for each store:
  if (store.status === 'archived'):
    stage = 'client_lost'

  else if (store.status === 'stopped'):
    stage = 'client_lost'

  else if (store.status === 'paused'):
    stage = 'client_paused'

  else if (store.api_token === null || store.api_token === ''):
    stage = 'contract'

  else if (product_count === 0 && total_reviews === 0):
    stage = 'access_received'

  else if (chats_opened > 0):
    stage = 'chats_opened'  // or 'monitoring' if progress >80%

  else if (reviews_processed > 0):
    stage = 'complaints_submitted'

  else:
    stage = 'cabinet_connected'
```

**Script:** `scripts/backfill-stores-stage.mjs`

```javascript
import { getPool } from '../src/db/helpers.mjs';

const pool = await getPool();

// Get all stores
const { rows: stores } = await pool.query('SELECT * FROM stores');

for (const store of stores) {
  let stage;

  // Determine stage based on current state
  if (['archived', 'stopped'].includes(store.status)) {
    stage = 'client_lost';
  } else if (store.status === 'paused') {
    stage = 'client_paused';
  } else if (!store.api_token) {
    stage = 'contract';
  } else {
    // Check data presence
    const { rows: productCount } = await pool.query(
      'SELECT COUNT(*) FROM products WHERE store_id = $1',
      [store.id]
    );
    const hasProducts = productCount[0].count > 0;

    const { rows: chatCount } = await pool.query(
      'SELECT COUNT(DISTINCT chat_id) FROM review_chat_links WHERE store_id = $1',
      [store.id]
    );
    const hasChats = chatCount[0].count > 0;

    if (!hasProducts && store.total_reviews === 0) {
      stage = 'access_received';
    } else if (hasChats) {
      stage = 'chats_opened';
    } else if (store.total_reviews > 0) {
      stage = 'complaints_submitted';
    } else {
      stage = 'cabinet_connected';
    }
  }

  // Update store
  await pool.query(
    'UPDATE stores SET stage = $1 WHERE id = $2',
    [stage, store.id]
  );

  console.log(`Store ${store.name}: stage set to ${stage}`);
}

console.log('Backfill completed');
process.exit(0);
```

**Run:**
```bash
node scripts/backfill-stores-stage.mjs
```

**ETA:** 30 minutes

---

### Task 1.3: Update TypeScript Types

**Files:**
- `src/types/stores.ts`
- `src/db/helpers.ts`

**Changes:**

**`src/types/stores.ts`:**
```typescript
export type StoreStage =
  | 'contract'
  | 'access_received'
  | 'cabinet_connected'
  | 'complaints_submitted'
  | 'chats_opened'
  | 'monitoring'
  | 'client_paused'
  | 'client_lost';

export const STORE_STAGE_LABELS: Record<StoreStage, string> = {
  contract: 'Договор',
  access_received: 'Получены доступы',
  cabinet_connected: 'Кабинет подключён',
  complaints_submitted: 'Поданы жалобы',
  chats_opened: 'Открыты чаты',
  monitoring: 'Текущий контроль',
  client_paused: 'Клиент на паузе',
  client_lost: 'Клиент потерян',
};

export interface Store {
  id: string;
  name: string;
  marketplace: 'wb' | 'ozon';
  status: StoreStatus;
  stage: StoreStage;  // NEW
  // ... existing fields
}
```

**`src/db/helpers.ts`:**
Update `getStores()` query to include `stage` field.

**ETA:** 20 minutes

---

## Phase 2: API & Backend

**Goal:** Создать API endpoints для управления этапами

---

### Task 2.1: Update getStores() Helper

**File:** `src/db/helpers.ts`

**Changes:**
```typescript
export async function getStores(ownerId?: string): Promise<Store[]> {
  const pool = await getPool();

  const query = `
    WITH product_counts AS (
      SELECT store_id, COUNT(*)::int AS cnt
      FROM products
      GROUP BY store_id
    )
    SELECT
      s.id,
      s.name,
      s.marketplace,
      s.status,
      s.stage,  -- NEW
      s.api_token,
      -- ... other fields
      COALESCE(pc.cnt, 0) AS product_count
    FROM stores s
    LEFT JOIN product_counts pc ON pc.store_id = s.id
    ${ownerId ? 'WHERE s.owner_id = $1' : ''}
    ORDER BY s.created_at DESC
  `;

  const { rows } = ownerId
    ? await pool.query(query, [ownerId])
    : await pool.query(query);

  return rows as Store[];
}
```

**ETA:** 10 minutes

---

### Task 2.2: Create PATCH /api/stores/:id/stage Endpoint

**File:** `src/app/api/stores/[storeId]/stage/route.ts`

**Code:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { updateStore, getStoreById } from '@/db/helpers';
import { StoreStage } from '@/types/stores';

const VALID_STAGES: StoreStage[] = [
  'contract',
  'access_received',
  'cabinet_connected',
  'complaints_submitted',
  'chats_opened',
  'monitoring',
  'client_paused',
  'client_lost',
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  // Auth check
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { storeId } = params;

  // Check if user has access to this store
  const store = await getStoreById(storeId);
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // TODO: Check if user is owner/admin or has access to this store (manager role)
  // if (auth.role === 'manager') {
  //   const hasAccess = await checkManagerStoreAccess(auth.userId, storeId);
  //   if (!hasAccess) {
  //     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  //   }
  // }

  // Parse body
  const { stage } = await req.json();

  // Validate stage
  if (!stage || !VALID_STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
      { status: 400 }
    );
  }

  // Update stage
  await updateStore(storeId, { stage });

  // TODO (Phase 2): Log stage change to store_stage_history table

  return NextResponse.json({ success: true, stage });
}
```

**ETA:** 30 minutes

---

### Task 2.3: Add Stage Validation (Optional)

**File:** `src/lib/store-validation.ts` (new)

**Code:**
```typescript
import { StoreStage } from '@/types/stores';

/**
 * Validates if stage transition is allowed
 * Optional: can be used for strict workflow enforcement
 */
export function isStageTransitionAllowed(
  currentStage: StoreStage,
  newStage: StoreStage
): { allowed: boolean; reason?: string } {

  // For Phase 1: Allow all transitions (manual control)
  return { allowed: true };

  // Future: Add strict rules
  // const FORBIDDEN_TRANSITIONS = [
  //   { from: 'client_lost', to: 'monitoring' },
  // ];
  //
  // const forbidden = FORBIDDEN_TRANSITIONS.find(
  //   t => t.from === currentStage && t.to === newStage
  // );
  //
  // if (forbidden) {
  //   return { allowed: false, reason: 'Cannot revive lost client to monitoring' };
  // }
  //
  // return { allowed: true };
}
```

**Usage in endpoint:**
```typescript
const validation = isStageTransitionAllowed(store.stage, stage);
if (!validation.allowed) {
  return NextResponse.json(
    { error: validation.reason },
    { status: 400 }
  );
}
```

**Decision:** На Phase 1 не делаем валидацию, даём менеджерам полную свободу.

**ETA:** 20 minutes (если решим делать)

---

## Phase 3: UI Implementation

**Goal:** Добавить отображение и управление этапами в Web Dashboard

---

### Task 3.1: Create StageBadge Component

**File:** `src/components/ui/StageBadge.tsx` (new)

**Code:**
```typescript
import { StoreStage, STORE_STAGE_LABELS } from '@/types/stores';
import { Badge } from '@/components/ui/badge';

const STAGE_COLORS: Record<StoreStage, string> = {
  contract: 'bg-blue-100 text-blue-700 border-blue-300',
  access_received: 'bg-purple-100 text-purple-700 border-purple-300',
  cabinet_connected: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  complaints_submitted: 'bg-orange-100 text-orange-700 border-orange-300',
  chats_opened: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  monitoring: 'bg-green-100 text-green-700 border-green-300',
  client_paused: 'bg-gray-100 text-gray-700 border-gray-300',
  client_lost: 'bg-red-100 text-red-700 border-red-300',
};

const STAGE_EMOJI: Record<StoreStage, string> = {
  contract: '📄',
  access_received: '🔑',
  cabinet_connected: '✅',
  complaints_submitted: '📋',
  chats_opened: '💬',
  monitoring: '🟢',
  client_paused: '⏸️',
  client_lost: '🔴',
};

interface StageBadgeProps {
  stage: StoreStage;
  showEmoji?: boolean;
}

export function StageBadge({ stage, showEmoji = true }: StageBadgeProps) {
  return (
    <Badge className={STAGE_COLORS[stage]} variant="outline">
      {showEmoji && <span className="mr-1">{STAGE_EMOJI[stage]}</span>}
      {STORE_STAGE_LABELS[stage]}
    </Badge>
  );
}
```

**ETA:** 20 minutes

---

### Task 3.2: Create StageSelector Component

**File:** `src/components/ui/StageSelector.tsx` (new)

**Code:**
```typescript
import { StoreStage, STORE_STAGE_LABELS } from '@/types/stores';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STAGES: StoreStage[] = [
  'contract',
  'access_received',
  'cabinet_connected',
  'complaints_submitted',
  'chats_opened',
  'monitoring',
  'client_paused',
  'client_lost',
];

interface StageSelectorProps {
  value: StoreStage;
  onChange: (stage: StoreStage) => void;
  disabled?: boolean;
}

export function StageSelector({ value, onChange, disabled }: StageSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {STORE_STAGE_LABELS[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**ETA:** 20 minutes

---

### Task 3.3: Update Main Stores Page

**File:** `src/app/page.tsx`

**Changes:**

**Add stage column to table:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Название</TableHead>
      <TableHead>Маркетплейс</TableHead>
      <TableHead>Статус</TableHead>
      <TableHead>Этап</TableHead>  {/* NEW */}
      <TableHead>Товары</TableHead>
      <TableHead>Отзывы</TableHead>
      <TableHead>Чаты</TableHead>
      <TableHead>Действия</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {stores.map((store) => (
      <TableRow key={store.id}>
        <TableCell>{store.name}</TableCell>
        <TableCell>{store.marketplace.toUpperCase()}</TableCell>
        <TableCell>
          <Badge>{store.status}</Badge>
        </TableCell>
        <TableCell>
          {/* NEW: Stage display + selector */}
          <StageSelector
            value={store.stage}
            onChange={(stage) => handleStageChange(store.id, stage)}
          />
        </TableCell>
        {/* ... rest of cells */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Add handler:**
```typescript
const handleStageChange = async (storeId: string, stage: StoreStage) => {
  try {
    const response = await fetch(`/api/stores/${storeId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });

    if (!response.ok) {
      throw new Error('Failed to update stage');
    }

    // Invalidate query to refetch stores
    queryClient.invalidateQueries(['stores']);

    toast.success(`Этап изменён на "${STORE_STAGE_LABELS[stage]}"`);
  } catch (error) {
    toast.error('Ошибка при изменении этапа');
    console.error(error);
  }
};
```

**ETA:** 1 hour

---

### Task 3.4: Add Stage Filters in Sidebar

**File:** `src/app/page.tsx`

**Changes:**

**Add filter UI:**
```tsx
<div className="filters-sidebar">
  {/* Existing status filters */}
  <div className="filter-group">
    <h3>Статус</h3>
    <Checkbox label="Активные" ... />
    <Checkbox label="На паузе" ... />
    {/* ... */}
  </div>

  {/* NEW: Stage filters */}
  <div className="filter-group">
    <h3>Этап работы</h3>
    {STAGES.map((stage) => (
      <Checkbox
        key={stage}
        label={STORE_STAGE_LABELS[stage]}
        checked={selectedStages.includes(stage)}
        onChange={() => toggleStageFilter(stage)}
      />
    ))}
  </div>
</div>
```

**Add filter logic:**
```typescript
const [selectedStages, setSelectedStages] = useState<StoreStage[]>([]);

const toggleStageFilter = (stage: StoreStage) => {
  setSelectedStages(prev =>
    prev.includes(stage)
      ? prev.filter(s => s !== stage)
      : [...prev, stage]
  );
};

const filteredStores = stores.filter(store => {
  // Existing filters...

  // Stage filter
  if (selectedStages.length > 0 && !selectedStages.includes(store.stage)) {
    return false;
  }

  return true;
});
```

**ETA:** 45 minutes

---

### Task 3.5: Add Stage Sorting

**File:** `src/app/page.tsx`

**Changes:**

**Add sort option:**
```tsx
<Select value={sortBy} onValueChange={setSortBy}>
  <SelectItem value="date">По дате обновления</SelectItem>
  <SelectItem value="name_asc">По названию А-Я</SelectItem>
  <SelectItem value="name_desc">По названию Я-А</SelectItem>
  <SelectItem value="stage">По этапу</SelectItem>  {/* NEW */}
  <SelectItem value="products">По количеству товаров</SelectItem>
  {/* ... */}
</Select>
```

**Add sort logic:**
```typescript
const STAGE_ORDER: Record<StoreStage, number> = {
  contract: 1,
  access_received: 2,
  cabinet_connected: 3,
  complaints_submitted: 4,
  chats_opened: 5,
  monitoring: 6,
  client_paused: 7,
  client_lost: 8,
};

const sortedStores = [...filteredStores].sort((a, b) => {
  if (sortBy === 'stage') {
    return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
  }
  // ... other sort logic
});
```

**ETA:** 30 minutes

---

### Task 3.6: Update Tooltips & Help Text

**File:** `src/app/page.tsx`

**Add tooltips:**
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      <InfoIcon className="h-4 w-4 ml-2" />
    </TooltipTrigger>
    <TooltipContent>
      <p>Этап работы с клиентом отражает текущий прогресс</p>
      <p>Менеджер переставляет этап вручную</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**ETA:** 20 minutes

---

**Total Phase 3 ETA:** 3-4 hours

---

## Phase 4: Status Audit

**Goal:** Найти все места где используется `stores.status` и определить стратегию миграции

---

### Task 4.1: Code Search for stores.status

**Tools:**
- `grep -r "stores.status" src/`
- `grep -r "status =" src/` (в контексте stores)
- VSCode global search: `status`

**Expected locations:**
1. **Extensions** (Chrome Extension repo)
   - Status check before syncing

2. **Cron jobs**
   - `/api/cron/products/update`
   - `/api/cron/reviews/update`
   - `/api/cron/dialogues/update`

3. **API endpoints**
   - `GET /api/stores`
   - Dashboard stats

4. **UI**
   - Dashboard filters
   - Store cards

5. **DB helpers**
   - `getStores()`
   - Store creation/update

**Deliverable:** Create document `docs/sprints/Sprint-006/STATUS-AUDIT.md` with:
```markdown
# Status Audit Results

## Summary
Found 47 uses of stores.status across codebase

## By Category

### Extensions (15 uses)
- File: extension/background.js:123
  Usage: if (store.status === 'active') { sync() }
  Migration strategy: Replace with stage check

### Cron Jobs (8 uses)
- ...

### API Endpoints (12 uses)
- ...

### UI (12 uses)
- ...
```

**ETA:** 2 hours

---

### Task 4.2: Categorize by Migration Strategy

**For each usage, determine:**

**Category A: Can replace with stage immediately**
- Example: UI filters, dashboard display
- Strategy: Replace `status` with `stage` in next sprint

**Category B: Need logic adjustment**
- Example: `status === 'active'` → `stage NOT IN ('client_lost', 'client_paused')`
- Strategy: Create helper function `isStoreActive(store)`

**Category C: Keep status (at least short-term)**
- Example: Extensions (need extension update first)
- Strategy: Parallel approach, migrate extensions separately

**Deliverable:** Add to `STATUS-AUDIT.md`:
```markdown
## Migration Categories

### Category A (Direct replacement): 18 uses
...

### Category B (Logic adjustment): 22 uses
...

### Category C (Keep for now): 7 uses
...
```

**ETA:** 2 hours

---

### Task 4.3: Create Helper Functions

**File:** `src/lib/store-helpers.ts` (new)

**Code:**
```typescript
import { Store, StoreStage } from '@/types/stores';

/**
 * Checks if store is active (system should work with it)
 * Replaces: store.status === 'active' || store.status === 'trial'
 */
export function isStoreActive(store: Store): boolean {
  // Version 1: Based on status (current)
  // return ['active', 'trial'].includes(store.status);

  // Version 2: Based on stage (future)
  return !['client_lost', 'client_paused'].includes(store.stage);
}

/**
 * Checks if store should be synced by cron jobs
 */
export function shouldSyncStore(store: Store): boolean {
  return isStoreActive(store);
}

/**
 * Checks if extensions should work with this store
 */
export function isStoreReadyForExtension(store: Store): boolean {
  // Extensions need at least cabinet_connected stage
  return isStoreActive(store) &&
         !['contract', 'access_received'].includes(store.stage);
}
```

**Usage example:**
```typescript
// Before:
const activeStores = stores.filter(s => s.status === 'active');

// After:
const activeStores = stores.filter(s => isStoreActive(s));
```

**ETA:** 1 hour

---

**Total Phase 4 ETA:** 5 hours

---

## Phase 5: Status → Stage Migration Plan

**Goal:** Детальный план поэтапной миграции

---

### Task 5.1: Extension Migration Plan

**Current state:**
- Chrome Extension checks `store.status === 'active'` before syncing
- Extension repo separate from main repo

**Migration steps:**

1. **Phase 5.1.1: Add stage field to extension**
   - Update extension API types to include `stage`
   - Extension continues using `status` for now

2. **Phase 5.1.2: Add helper to extension**
   - Create `isStoreActive(store)` in extension
   - Use helper instead of direct status check

3. **Phase 5.1.3: Switch to stage**
   - Update helper to use `stage` instead of `status`
   - Test thoroughly

4. **Phase 5.1.4: Remove status dependency**
   - Remove `status` field from extension types
   - Confirm no breaking changes

**Timeline:** 2 weeks after Sprint-006 completion

**Risk:** Extensions in wild may not auto-update
**Mitigation:** Keep `status` field populated for 6 months

**ETA for planning:** 1 hour

---

### Task 5.2: Cron Jobs Migration Plan

**Current cron jobs:**
1. `/api/cron/products/update` — syncs products
2. `/api/cron/reviews/update` — syncs reviews
3. `/api/cron/dialogues/update` — syncs chats
4. `/api/cron/stores/metrics` — updates metrics (future)

**Current logic:**
```typescript
const activeStores = await pool.query(`
  SELECT * FROM stores
  WHERE status IN ('active', 'trial')
`);
```

**Migration steps:**

1. **Phase 5.2.1: Add helper functions**
   - Use `isStoreActive(store)` in cron jobs
   - Keep SQL using `status` for now

2. **Phase 5.2.2: Update SQL queries**
   - Change WHERE clause to stage-based:
   ```sql
   WHERE stage NOT IN ('client_lost', 'client_paused')
   ```

3. **Phase 5.2.3: Test thoroughly**
   - Verify all 65 stores sync correctly
   - Monitor for 1 week

4. **Phase 5.2.4: Remove status checks**
   - Remove old status-based logic
   - Update comments/docs

**Timeline:** 1 week after extension migration

**ETA for planning:** 1 hour

---

### Task 5.3: API Endpoints Migration Plan

**Affected endpoints:**
1. `GET /api/stores` — returns stores list
2. `GET /api/dashboard/stats` — dashboard KPIs
3. Store creation/update endpoints

**Migration steps:**

1. **Phase 5.3.1: Add stage to all responses**
   - Already done in Phase 2

2. **Phase 5.3.2: Update filters**
   - Dashboard stats: filter by stage instead of status
   ```typescript
   // Before:
   const activeStores = stores.filter(s => s.status === 'active');

   // After:
   const activeStores = stores.filter(s => isStoreActive(s));
   ```

3. **Phase 5.3.3: Deprecate status filters**
   - Remove status-based query params
   - Replace with stage-based

4. **Phase 5.3.4: Remove status from responses (optional)**
   - Keep for backward compatibility or remove entirely

**Timeline:** Same sprint as cron migration

**ETA for planning:** 30 minutes

---

### Task 5.4: UI Migration Plan

**Affected pages:**
1. Main stores dashboard (`src/app/page.tsx`)
2. Individual store pages
3. Dashboard stats cards

**Migration steps:**

1. **Phase 5.4.1: Add stage display**
   - Already done in Phase 3

2. **Phase 5.4.2: Keep both status and stage visible**
   - Show both fields temporarily
   - Educate users on difference

3. **Phase 5.4.3: Deprecate status column**
   - Remove status column from main table
   - Keep stage only

4. **Phase 5.4.4: Update all filters/sorts**
   - Replace status filters with stage filters
   - Already done in Phase 3

**Timeline:** Same sprint as API migration

**ETA for planning:** 30 minutes

---

### Task 5.5: Define Rollout Timeline

**Proposed timeline:**

| Week | Phase | Tasks |
|------|-------|-------|
| Week 1-2 | Sprint-006 (current) | Phase 1-3: Add stage field + UI |
| Week 3 | Sprint-006 | Phase 4: Status audit |
| Week 4 | Sprint-006 | Phase 5: Migration planning |
| Week 5-6 | Sprint-007 | Extension migration |
| Week 7 | Sprint-007 | Cron jobs migration |
| Week 8 | Sprint-007 | API/UI migration |
| Week 9 | Sprint-007 | Testing & monitoring |
| Week 10+ | Sprint-008 | Deprecate status field (optional) |

**Milestones:**
- ✅ Week 2: Stage field live, managers can use it
- ✅ Week 6: Extensions using stage
- ✅ Week 8: Backend fully migrated to stage
- ✅ Week 10: Status field deprecated

**ETA for planning:** 30 minutes

---

### Task 5.6: Define Rollback Strategy

**Rollback scenarios:**

**Scenario A: Migration breaks extensions**
- **Action:** Revert extension update, keep using status
- **Time to rollback:** 1 hour

**Scenario B: Cron jobs fail after migration**
- **Action:** Revert cron SQL queries to status-based
- **Time to rollback:** 30 minutes

**Scenario C: Data inconsistency (status ≠ stage)**
- **Action:** Re-run backfill script to sync status ↔ stage
- **Time to rollback:** 1 hour

**Safety measures:**
1. Keep `status` field populated even after migration
2. Add monitoring alerts for sync failures
3. Test on staging environment first
4. Deploy during low-traffic hours
5. Have DB backup before each phase

**ETA for planning:** 30 minutes

---

**Total Phase 5 ETA:** 4 hours (planning only, not implementation)

---

## Phase 6: Metrics Integration

**Goal:** Интегрировать stage system с новыми метриками из AUDIT-stores-metrics-modernization.md

---

### Task 6.1: Review Metrics Audit Document

**File:** `docs/sprints/Sprint-006/AUDIT-stores-metrics-modernization.md`

**Key metrics:**
- 📦 Товары: активные / всего
- ⭐ Отзывы: обработанные / всего
- 💬 Чаты: открытые / требуемые

**ETA:** 30 minutes (reading)

---

### Task 6.2: Show Stage + Metrics Together in UI

**Goal:** Unified card showing stage + progress metrics

**Proposed UI:**
```
┌────────────────────────────────────────┐
│ HANIBANI                          [WB] │
│                                        │
│ 🎯 Этап: 🟢 Текущий контроль          │  ← Stage badge
│                                        │
│ 📦 Товары:   38 / 45    (84%) ████▒   │  ← Metrics
│ ⭐ Отзывы:   890 / 1100 (81%) ████▒   │
│ 💬 Чаты:     210 / 210  (100%) █████  │
│                                        │
│ [Изменить этап ▼] [Sync] [View]       │
└────────────────────────────────────────┘
```

**Implementation:**
```tsx
<StoreCard>
  <StoreHeader name={store.name} marketplace={store.marketplace} />

  {/* Stage display */}
  <div className="stage-section">
    <Label>🎯 Этап:</Label>
    <StageBadge stage={store.stage} />
    <StageSelector
      value={store.stage}
      onChange={(stage) => handleStageChange(store.id, stage)}
    />
  </div>

  {/* Metrics display */}
  <MetricsSection>
    <MetricRow
      icon="📦"
      label="Товары"
      current={store.active_products_count}
      total={store.total_products}
    />
    <MetricRow
      icon="⭐"
      label="Отзывы"
      current={store.reviews_processed}
      total={store.reviews_to_process}
    />
    <MetricRow
      icon="💬"
      label="Чаты"
      current={store.chats_opened}
      total={store.chats_required}
    />
  </MetricsSection>
</StoreCard>
```

**ETA:** 2 hours

---

### Task 6.3: Stage-Based Analytics (Optional, Future)

**Ideas for future sprints:**

1. **Conversion Funnel:**
   - How many stores move from `contract` to `monitoring`?
   - Where do we lose stores? (drop-off analysis)

2. **Time-to-Stage:**
   - Average time from `contract` to `monitoring`
   - Identify slow-moving stores

3. **Stage Distribution:**
   - Pie chart: how many stores at each stage?
   - Trend over time

4. **Alerts:**
   - Store stuck at `cabinet_connected` for >7 days → alert manager
   - Store at `client_paused` for >30 days → risk of churn

**Not implementing in Sprint-006, just documenting ideas.**

**ETA:** 30 minutes (documentation only)

---

**Total Phase 6 ETA:** 3 hours

---

## Testing & Deployment

### Task 7.1: Integration Tests

**Test scenarios:**

1. **Stage CRUD:**
   - Create store with default stage
   - Update stage via API
   - Read stage in getStores()

2. **Stage validation:**
   - Try invalid stage value → expect 400 error
   - Try unauthorized stage change → expect 401/403

3. **UI flow:**
   - Change stage via dropdown
   - Filter by stage
   - Sort by stage

4. **Backfill:**
   - Run backfill script on test DB
   - Verify all stores have correct initial stage

**ETA:** 2 hours

---

### Task 7.2: Manual Testing Checklist

**Checklist:**
- [ ] Migration 028 runs without errors
- [ ] Backfill script sets correct initial stages
- [ ] getStores() returns stage field
- [ ] PATCH /api/stores/:id/stage works
- [ ] Stage badge displays correctly
- [ ] Stage selector changes stage
- [ ] Stage filters work
- [ ] Stage sorting works
- [ ] Invalid stage returns 400 error
- [ ] Unauthorized change returns 401/403

**ETA:** 1 hour

---

### Task 7.3: Deployment Plan

**Steps:**

1. **Pre-deploy:**
   - [ ] DB backup
   - [ ] Test migration on staging DB
   - [ ] Verify rollback SQL works

2. **Deploy:**
   - [ ] SSH to server
   - [ ] `git pull`
   - [ ] Run migration 028
   - [ ] Run backfill script
   - [ ] `npm run build`
   - [ ] `pm2 reload wb-reputation`
   - [ ] Verify app starts

3. **Post-deploy:**
   - [ ] Check all stores have stage field
   - [ ] Test stage change via UI
   - [ ] Monitor error logs for 24h
   - [ ] Notify team that stage system is live

**ETA:** 1 hour

---

### Task 7.4: Monitoring & Rollback

**Monitoring:**
- Watch PM2 logs for errors
- Check /api/stores response includes stage
- Verify stage changes are logged (future: audit table)

**Rollback plan:**
If critical issues:
```bash
# Rollback migration
psql -d $DB_NAME -f migrations/028_rollback.sql

# Revert code
git revert HEAD
npm run build
pm2 reload wb-reputation
```

**ETA:** 30 minutes (setup monitoring)

---

**Total Testing & Deployment ETA:** 4.5 hours

---

## Summary

### Total Estimated Time:

| Phase | Tasks | ETA |
|-------|-------|-----|
| Phase 1: Foundation | 3 tasks | 1.5 hours |
| Phase 2: API & Backend | 3 tasks | 1.5 hours |
| Phase 3: UI Implementation | 6 tasks | 3.5 hours |
| Phase 4: Status Audit | 3 tasks | 5 hours |
| Phase 5: Migration Planning | 6 tasks | 4 hours |
| Phase 6: Metrics Integration | 3 tasks | 3 hours |
| Phase 7: Testing & Deployment | 4 tasks | 4.5 hours |
| **TOTAL** | **28 tasks** | **~23 hours** |

**Sprint duration:** 1-2 weeks

---

## Dependencies & Blockers

### Dependencies:
- ✅ No external dependencies
- ✅ Can run in parallel with other sprints (if no table conflicts)

### Potential blockers:
- ⚠️ Conflict with AUDIT-stores-metrics-modernization.md (same `stores` table)
- **Resolution:** Run Sprint-006 first, then metrics modernization

---

## Success Criteria

### Phase 1-3 (MVP):
- ✅ `stores.stage` field exists and populated
- ✅ UI shows stage badge
- ✅ Managers can change stage via dropdown
- ✅ Filters and sorting work
- ✅ All 65 stores have correct initial stage

### Phase 4-5 (Planning):
- ✅ Complete audit of all `status` usages
- ✅ Detailed migration plan documented
- ✅ Helper functions created
- ✅ Timeline and rollback strategy defined

### Phase 6 (Integration):
- ✅ Stage + metrics displayed together
- ✅ UI is clean and informative

---

## Out of Scope (Future Sprints)

❌ Automatic stage transitions (based on metrics)
❌ Stage change audit trail (`store_stage_history` table)
❌ Stage-based notifications/alerts
❌ Analytics dashboard (conversion funnel, time-to-stage)
❌ Actual implementation of status → stage migration (just planning)

These will be addressed in Sprint-007 and beyond.

---

## Files to Create/Modify

### New Files:
- `migrations/028_add_stores_stage.sql`
- `scripts/backfill-stores-stage.mjs`
- `src/app/api/stores/[storeId]/stage/route.ts`
- `src/components/ui/StageBadge.tsx`
- `src/components/ui/StageSelector.tsx`
- `src/lib/store-helpers.ts`
- `src/lib/store-validation.ts` (optional)
- `docs/domains/store-lifecycle.md` ✅ (already created)
- `docs/sprints/Sprint-006/BACKLOG.md` ✅ (this file)
- `docs/sprints/Sprint-006/STATUS-AUDIT.md` (to be created in Phase 4)

### Modified Files:
- `src/types/stores.ts` — add StoreStage type
- `src/db/helpers.ts` — update getStores()
- `src/app/page.tsx` — add stage column, filters, sorting
- `docs/database-schema.md` — update after migration

---

## Notes

- Этот Sprint закладывает фундамент для полного перехода на stage-based систему
- Не спешим удалять `status` — миграция будет постепенной
- Managers получат видимость прогресса работы с клиентами
- База для analytics и automation в будущих спринтах

---

**Next Step:** Review this backlog with team, adjust estimates, assign tasks, begin Phase 1.
