# ADR-002: Filter CRON Jobs to Active Stores Only

**Status:** Accepted
**Date:** 2026-01-14
**Decision Makers:** Development Team
**Technical Story:** [Previous session - CRON optimization]

---

## Context

The daily CRON job syncs reviews for all stores in the database. Initially, it synced **49 stores**, but some stores are inactive (test accounts, closed shops, or paused subscriptions).

### Problem

Syncing inactive stores:
- Wastes API quota (Wildberries API calls)
- Wastes server resources (CPU, memory, database writes)
- Increases CRON job duration (~2 minutes longer)
- Clutters logs with unnecessary sync operations

### Current Situation

Before this change:
```typescript
// src/db/helpers.ts (old code)
export async function getAllStores(): Promise<Store[]> {
  const result = await query<Store>(
    "SELECT * FROM stores ORDER BY name"  // Returns ALL stores (49)
  );
  return result.rows;
}
```

**CRON job execution:**
- 49 stores × ~2 seconds each = ~98 seconds (~1.6 minutes)
- 6 stores were inactive (test accounts)

---

## Decision

**We will modify `getAllStores()` to return only stores with `status = 'active'`.**

### Implementation

**File:** [src/db/helpers.ts:370-376](../../src/db/helpers.ts#L370-L376)

```typescript
export async function getAllStores(): Promise<Store[]> {
  // Only return active stores for CRON jobs and automated operations
  const result = await query<Store>(
    "SELECT * FROM stores WHERE status = 'active' ORDER BY name"
  );
  return result.rows;
}
```

### Database Schema

The `stores` table already has a `status` column:

```sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',  -- active | inactive | paused
  -- ... other fields ...
);
```

**Status Values:**
- `active` - Store is operational, should be synced
- `inactive` - Store closed or deleted, skip sync
- `paused` - Subscription paused, skip sync

---

## Considered Alternatives

### Alternative 1: Filter in CRON Job Logic

```typescript
// src/lib/cron-jobs.ts
const stores = await dbHelpers.getAllStores();
const activeStores = stores.filter(s => s.status === 'active');

for (const store of activeStores) {
  await syncStoreReviews(store.id, store.name);
}
```

**Pros:**
- Keeps `getAllStores()` generic (returns ALL stores)
- Filter logic is explicit in CRON job

**Cons:**
- ❌ Fetches unnecessary data from database
- ❌ Filter logic must be repeated everywhere (CRON, API endpoints, etc.)
- ❌ Easy to forget filter → accidental sync of inactive stores

**Rejected:** Inefficient, error-prone.

---

### Alternative 2: Separate Function `getActiveStores()`

```typescript
// src/db/helpers.ts
export async function getAllStores(): Promise<Store[]> {
  // Returns ALL stores
}

export async function getActiveStores(): Promise<Store[]> {
  // Returns only active stores
}
```

**Pros:**
- Keeps `getAllStores()` truly generic
- Explicit function names

**Cons:**
- ❌ Two functions with 90% identical code
- ❌ Developers might call wrong function accidentally
- ❌ In practice, we NEVER want to sync inactive stores

**Rejected:** Unnecessary complexity, no real benefit.

---

### Alternative 3: Add Optional Parameter `statusFilter`

```typescript
// src/db/helpers.ts
export async function getAllStores(statusFilter?: string): Promise<Store[]> {
  let sql = "SELECT * FROM stores";
  if (statusFilter) {
    sql += ` WHERE status = '${statusFilter}'`;  // (properly sanitized in real code)
  }
  sql += " ORDER BY name";

  const result = await query<Store>(sql);
  return result.rows;
}

// Usage:
const activeStores = await getAllStores('active');
const allStores = await getAllStores();  // No filter
```

**Pros:**
- Flexible
- Single function handles all cases

**Cons:**
- ⚠️ SQL injection risk if not properly sanitized
- ⚠️ Still allows accidental fetch of inactive stores (forgot to pass param)
- ⚠️ More complex function signature

**Rejected:** Over-engineered for our use case.

---

## Consequences

### Positive

✅ **Performance improvement:** 49 → 43 stores (-12% load reduction)
✅ **Faster CRON execution:** ~98s → ~86s (~12 seconds faster)
✅ **Reduced API quota usage:** 6 fewer WB API calls per sync
✅ **Cleaner logs:** No unnecessary sync messages for inactive stores
✅ **Database efficiency:** Smaller result set, less network transfer
✅ **Default-safe:** By default, only active stores are processed

### Negative

⚠️ **Function name misleading:** `getAllStores()` no longer returns **all** stores
⚠️ **No way to get inactive stores:** If needed for admin dashboard, must query directly

### Mitigation

**For misleading function name:**
- Add clear JSDoc comment:
  ```typescript
  /**
   * Get all ACTIVE stores (status = 'active')
   * Used by CRON jobs and automated operations.
   * Excludes inactive and paused stores.
   */
  export async function getAllStores(): Promise<Store[]> {
    // ...
  }
  ```

**For accessing inactive stores:**
- Create dedicated query when needed:
  ```typescript
  // Admin dashboard only
  export async function getAllStoresIncludingInactive(): Promise<Store[]> {
    const result = await query<Store>("SELECT * FROM stores ORDER BY name");
    return result.rows;
  }
  ```

---

## Impact Analysis

### Before (49 stores)

```
CRON Job Execution:
- Duration: ~98 seconds
- API calls: 49 (one per store)
- Active stores synced: 43
- Inactive stores synced: 6 (wasted)
```

### After (43 stores)

```
CRON Job Execution:
- Duration: ~86 seconds (-12 seconds, -12%)
- API calls: 43 (one per store)
- Active stores synced: 43
- Inactive stores synced: 0
```

### Production Verification

Tested on production server (2026-01-14):

```bash
# Before change
curl -s http://localhost:3000/api/stores \
  -H "Authorization: Bearer wbrm_xxx" | jq 'length'
# Output: 49

# After change
curl -s http://localhost:3000/api/stores \
  -H "Authorization: Bearer wbrm_xxx" | jq 'length'
# Output: 43
```

**CRON logs (3 successful runs):**
```
[CRON] Found 43 stores to sync  ← Was 49 before
[CRON] Duration: 86s  ← Was ~98s before
[CRON] Success: 43/43 stores
```

---

## Database Queries

### Mark Store as Inactive

```sql
-- Admin operation: Deactivate a store
UPDATE stores
SET status = 'inactive', updated_at = NOW()
WHERE id = 'store_id_here';
```

### Reactivate Store

```sql
-- Admin operation: Reactivate a store
UPDATE stores
SET status = 'active', updated_at = NOW()
WHERE id = 'store_id_here';
```

### View All Stores by Status

```sql
-- Admin dashboard query
SELECT
  status,
  COUNT(*) as count
FROM stores
GROUP BY status
ORDER BY status;

-- Expected output:
-- active   | 43
-- inactive | 5
-- paused   | 1
```

---

## API Impact

This change affects any endpoint that calls `getAllStores()`:

**Affected Endpoints:**
1. `GET /api/stores` - Now returns only active stores
2. CRON job `daily-review-sync` - Syncs only active stores
3. Any bulk operations - Process only active stores

**Not Affected:**
- `GET /api/stores/:storeId` - Can still access inactive store by ID
- Database direct queries - Status column still exists

---

## Future Considerations

### If We Need Inactive Stores in UI

**Option 1: Add query parameter**
```typescript
// GET /api/stores?include_inactive=true
export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';

  if (includeInactive) {
    const result = await query("SELECT * FROM stores ORDER BY name");
    return NextResponse.json(result.rows);
  }

  const stores = await getAllStores();  // Active only
  return NextResponse.json(stores);
}
```

**Option 2: Separate admin endpoint**
```typescript
// GET /api/admin/stores/all
export async function GET(request: NextRequest) {
  const result = await query("SELECT * FROM stores ORDER BY status, name");
  return NextResponse.json(result.rows);
}
```

---

## Related Decisions

- [ADR-001: Instrumentation Hook](./ADR-001-why-instrumentation-hook.md) - CRON auto-start
- [ADR-003: CRON Intervals](./ADR-003-cron-intervals.md) - Why 5 min dev, daily prod

---

## References

- **Implementation:** [src/db/helpers.ts:370-376](../../src/db/helpers.ts#L370-L376)
- **CRON Job:** [src/lib/cron-jobs.ts:79](../../src/lib/cron-jobs.ts#L79)
- **Database Schema:** [docs/database-schema.md](../database-schema.md)

---

**Last Updated:** 2026-01-15
**Production Impact:** -12% load reduction, 43 active stores
