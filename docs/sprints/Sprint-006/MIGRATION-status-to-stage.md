# Migration Plan: Status → Stage

**Sprint:** 006 - Store Lifecycle Management
**Дата создания:** 2026-03-11
**Статус:** Planning (не начато)

---

## Контекст

**Проблема:** Поле `stores.status` (5 значений) слишком грубое для отражения реального прогресса работы с клиентом.

**Решение:** Новое поле `stores.stage` (8 значений) с более детальными этапами lifecycle клиента.

**Текущая ситуация:**
- ✅ Поле `stage` добавлено (migration 031)
- ✅ Backfill выполнен (82 магазина)
- ✅ UI компоненты созданы (StageBadge, StageSelector)
- ✅ API endpoint `/api/stores/:id/stage` работает
- ⚠️ Вся система все еще использует `status` для бизнес-логики

**Критичная проблема:** Один статус `'active'` маппится на **4 разных этапа**:
```
'active' → { cabinet_connected, complaints_submitted, chats_opened, monitoring }
```

Это означает, что простая замена `status` на `stage` невозможна без логики маппинга.

---

## Маппинг: Status ↔ Stage

### Forward Mapping (Status → Stage)

```typescript
const STATUS_TO_STAGE_MAP: Record<StoreStatus, StoreStage[]> = {
  'active': [
    'cabinet_connected',    // Кабинет подключён
    'complaints_submitted', // Поданы жалобы
    'chats_opened',         // Открыты чаты
    'monitoring',           // Текущий контроль
  ],
  'trial': [
    'cabinet_connected',
    'complaints_submitted',
    'chats_opened',
    'monitoring',
  ],
  'paused': ['client_paused'],   // Клиент на паузе
  'stopped': ['client_lost'],    // Клиент потерян
  'archived': ['client_lost'],   // Клиент потерян
};
```

### Reverse Mapping (Stage → Status)

```typescript
const STAGE_TO_STATUS_MAP: Record<StoreStage, StoreStatus> = {
  'contract': 'active',              // Договор = активен (есть токен)
  'access_received': 'active',       // Получены доступы = активен
  'cabinet_connected': 'active',     // Кабинет подключён = активен
  'complaints_submitted': 'active',  // Поданы жалобы = активен
  'chats_opened': 'active',          // Открыты чаты = активен
  'monitoring': 'active',            // Текущий контроль = активен
  'client_paused': 'paused',         // Клиент на паузе
  'client_lost': 'stopped',          // Клиент потерян
};
```

---

## Стратегия Миграции: Dual-Read Period

**Подход:** Поддерживаем оба поля одновременно в течение 2-3 месяцев.

### Фаза 0: Preparation (DONE)
- ✅ Добавлено поле `stage` (migration 031)
- ✅ Backfill выполнен
- ✅ UI создан (Phase 3)

### Фаза 1: Dual-Write (LOW RISK)
**Цель:** При изменении `status` автоматически обновляем `stage` (и наоборот).

**Задачи:**
1. Создать middleware функцию для синхронизации:
   ```typescript
   function syncStatusAndStage(
     currentStatus: StoreStatus,
     currentStage: StoreStage,
     updates: { status?: StoreStatus; stage?: StoreStage }
   ): { status: StoreStatus; stage: StoreStage }
   ```

2. Интегрировать в `updateStore()`:
   ```typescript
   export async function updateStore(id: string, updates: Partial<Store>) {
     // Auto-sync status ↔ stage
     if (updates.status && !updates.stage) {
       updates.stage = getStageForStatus(updates.status, currentStage);
     }
     if (updates.stage && !updates.status) {
       updates.status = STAGE_TO_STATUS_MAP[updates.stage];
     }

     // ... existing update logic
   }
   ```

3. Обновить оба endpoint:
   - `PATCH /api/stores/:id/status` → также обновляет stage
   - `PATCH /api/stores/:id/stage` → также обновляет status

**ETA:** 4 часа

---

### Фаза 2: Dual-Read UI (LOW RISK)
**Цель:** UI показывает `stage`, но система все еще фильтрует по `status`.

**Задачи:**
1. Обновить UI компоненты для показа `stage`:
   - Главная страница: показываем StageBadge вместо status badge
   - Cabinet: показываем StageBadge вместо status badge
   - Team page: показываем stage

2. Обновить фильтры на главной странице:
   - Добавить stage filter dropdown
   - Оставить status filter (временно)

**Файлы:**
- `src/app/page.tsx`
- `src/app/stores/[storeId]/cabinet/page.tsx`
- `src/app/team/page.tsx`

**ETA:** 3 часа

---

### Фаза 3: Dual-Read Business Logic (MEDIUM RISK)
**Цель:** Бизнес-логика проверяет И `status` И `stage` (defensive).

**Задачи:**

**3.1 Active Store Detection**

Заменить:
```typescript
// OLD
WHERE status IN ('active', 'trial')
```

На:
```typescript
// NEW (defensive — проверяем оба поля)
WHERE status IN ('active', 'trial')
  AND stage NOT IN ('client_lost', 'client_paused')
```

**Места (из audit):**
1. `src/db/helpers.ts:3200` — Complaint eligibility
2. `src/db/helpers.ts:3253` — Active store IDs
3. `src/db/helpers.ts:3257` — Active store count
4. `src/db/helpers.ts:3258` — New stores count
5. `src/app/page.tsx:342` — Active filter
6. `src/app/page.tsx:526` — Dashboard stat

**3.2 Extension & Auth**

Обновить:
```typescript
// OLD
WHERE status = 'active'

// NEW
WHERE status = 'active' AND stage NOT IN ('client_lost', 'client_paused')
```

**Места:**
- `src/db/auth-helpers.ts:230` — Access control
- `src/db/auth-helpers.ts:327` — Manager assignment
- `src/db/extension-helpers.ts:499, 512` — Extension stores
- `src/app/api/extension/stores/route.ts:163, 189`

**3.3 CRON Jobs**

Обновить:
```typescript
// OLD
WHERE status = 'active'

// NEW
WHERE stage IN ('cabinet_connected', 'complaints_submitted', 'chats_opened', 'monitoring')
```

**Места:**
- `src/db/helpers.ts:452` — getAllStores()
- `src/lib/cron-jobs.ts:907` — Auto-sequence cleanup
- `src/services/google-sheets-sync/sync-service.ts:79` — Sheets sync

**ETA:** 6 часов

**Risk:** MEDIUM — может сломать автоматизацию, нужно тестировать на staging.

---

### Фаза 4: Stage-Primary (HIGH RISK)
**Цель:** Вся логика переключается на `stage`, `status` становится вторичным.

**Задачи:**

**4.1 Удалить defensive checks**

```typescript
// OLD (Phase 3)
WHERE status IN ('active', 'trial') AND stage NOT IN ('client_lost', 'client_paused')

// NEW (Phase 4)
WHERE stage IN ('cabinet_connected', 'complaints_submitted', 'chats_opened', 'monitoring')
```

**4.2 Обновить все 52 места из audit**

Систематически проходим каждую категорию:
1. Database queries (15 мест)
2. Business logic (8 мест)
3. Status updates (12 мест)
4. UI components (12 мест)

**4.3 Создать helper функции**

```typescript
// helpers.ts
export function isActiveStore(store: Store): boolean {
  return ['cabinet_connected', 'complaints_submitted', 'chats_opened', 'monitoring'].includes(store.stage);
}

export function isOperationalStage(stage: StoreStage): boolean {
  return !['client_lost', 'client_paused', 'contract', 'access_received'].includes(stage);
}
```

**ETA:** 12 часов

**Risk:** HIGH — затрагивает критичную бизнес-логику.

---

### Фаза 5: Status Deprecation (LOW RISK)
**Цель:** Убираем поле `status` из системы.

**Задачи:**

**5.1 Удалить UI для status**
- Убрать status dropdown filters
- Убрать status endpoint `/api/stores/:id/status`

**5.2 Удалить TypeScript types**
```typescript
// Remove
export type StoreStatus = 'active' | 'paused' | 'stopped' | 'trial' | 'archived';

// Update Store interface
export interface Store {
  // status: StoreStatus;  // REMOVED
  stage: StoreStage;
}
```

**5.3 Database migration**
```sql
-- Migration 032: Remove stores.status field

-- 1. Drop constraint
ALTER TABLE stores DROP CONSTRAINT IF EXISTS chk_store_status;

-- 2. Drop column
ALTER TABLE stores DROP COLUMN IF EXISTS status;

-- 3. Create trigger to prevent re-adding
-- (optional, for safety)
```

**5.4 Cleanup**
- Удалить все status-related код
- Обновить документацию
- Обновить Google Sheets mapping

**ETA:** 4 часа

**Risk:** LOW — к этому моменту status не используется нигде.

---

## Детальный Backlog

### Sprint 007: Dual-Write (Фаза 1-2)

**ETA:** 1 неделя
**Risk:** LOW

#### Task 7.1: Sync Middleware
- Создать `src/lib/status-stage-sync.ts`
- Функции: `syncStatusToStage()`, `syncStageToStatus()`
- Unit tests для всех маппингов

#### Task 7.2: Update `updateStore()`
- Интегрировать sync middleware
- Обновить оба API endpoints
- E2E тесты

#### Task 7.3: UI Migration (Display Only)
- Показывать StageBadge везде
- Оставить status filter работающим
- Добавить stage filter (опционально)

---

### Sprint 008: Dual-Read Logic (Фаза 3)

**ETA:** 1.5 недели
**Risk:** MEDIUM

#### Task 8.1: Active Store Detection
**Файлы:** 6 мест в `src/db/helpers.ts` + 2 в `src/app/page.tsx`

**Подзадачи:**
- 8.1.1: Обновить complaint eligibility query
- 8.1.2: Обновить dashboard stats queries (3 места)
- 8.1.3: Обновить frontend active filter
- 8.1.4: Обновить dashboard stat fallback
- 8.1.5: Unit tests для всех изменений

#### Task 8.2: Extension & Auth
**Файлы:** 2 в `auth-helpers.ts`, 2 в `extension-helpers.ts`, 2 в API routes

**Подзадачи:**
- 8.2.1: Обновить access control queries
- 8.2.2: Обновить extension store lists
- 8.2.3: E2E тесты для extension
- 8.2.4: Security audit

#### Task 8.3: CRON Jobs
**Файлы:** `helpers.ts`, `cron-jobs.ts`, `sync-service.ts`

**Подзадачи:**
- 8.3.1: Обновить getAllStores()
- 8.3.2: Обновить auto-sequence cleanup
- 8.3.3: Обновить Google Sheets sync
- 8.3.4: Smoke tests на staging

#### Task 8.4: Staging Testing
- Deploy на staging
- Запустить full sync cycle
- Проверить extension работу
- Проверить CRON jobs
- Проверить auth/access control

---

### Sprint 009: Stage-Primary (Фаза 4)

**ETA:** 2 недели
**Risk:** HIGH

#### Task 9.1: Helper Functions
- Создать `isActiveStore()`, `isOperationalStage()`
- Export из helpers.ts
- Использовать везде в коде

#### Task 9.2: Database Queries Migration
**15 мест из audit**

**Подзадачи:**
- 9.2.1: Критичные queries (6 файлов)
- 9.2.2: Высокоприоритетные queries (3 файла)
- 9.2.3: Среднеприоритетные queries (2 файла)
- 9.2.4: SQL миграция для view/функций (если есть)

#### Task 9.3: Business Logic Migration
**8 мест из audit**

#### Task 9.4: Status Update Logic Migration
**12 мест из audit**

**Ключевое изменение:**
- Status endpoint deprecated (404 или redirect)
- Все обновления через stage endpoint

#### Task 9.5: UI Components Migration
**12 мест из audit**

- Убрать все status dropdown
- Заменить на stage selector везде

#### Task 9.6: Comprehensive Testing
- Unit tests (100% coverage новых функций)
- Integration tests (API endpoints)
- E2E tests (UI flows)
- Load tests (performance regression)

---

### Sprint 010: Status Deprecation (Фаза 5)

**ETA:** 1 неделя
**Risk:** LOW

#### Task 10.1: UI Cleanup
- Удалить StatusDropdown component
- Удалить StatusMultiSelect component
- Удалить status-related modals

#### Task 10.2: API Cleanup
- Delete `/api/stores/:id/status` endpoint
- Update API documentation

#### Task 10.3: TypeScript Cleanup
- Remove StoreStatus type
- Update Store interface
- Remove status from all type definitions

#### Task 10.4: Database Migration 032
```sql
-- Migration 032: Remove stores.status

ALTER TABLE stores DROP CONSTRAINT IF EXISTS chk_store_status;
ALTER TABLE stores DROP COLUMN IF EXISTS status;
```

#### Task 10.5: Documentation Update
- database-schema.md
- ARCHITECTURE.md
- store-lifecycle.md
- Google Sheets mapping docs

---

## Timeline

```
Week 1-2   : Sprint 007 (Dual-Write)        ✅ Safe, quick wins
Week 3-4   : Sprint 008 (Dual-Read Logic)   ⚠️  Staging testing critical
Week 5-8   : Sprint 009 (Stage-Primary)     🔴 High risk, extensive testing
Week 9-10  : Sprint 010 (Deprecation)       ✅ Safe cleanup
```

**Total:** 10 недель (~2.5 месяца)

---

## Success Criteria

### Sprint 007 (Dual-Write)
- ✅ Изменение status автоматически обновляет stage
- ✅ Изменение stage автоматически обновляет status
- ✅ Никаких регрессий в UI/UX
- ✅ 100% backward compatibility

### Sprint 008 (Dual-Read Logic)
- ✅ Все CRON jobs работают корректно
- ✅ Extension синхронизирует правильные магазины
- ✅ Access control не сломан
- ✅ Dashboard stats корректны

### Sprint 009 (Stage-Primary)
- ✅ Status поле не используется нигде в коде (grep verification)
- ✅ Все тесты зеленые (unit + integration + E2E)
- ✅ Performance не ухудшилась (load tests)
- ✅ Staging работает 1+ неделю без проблем

### Sprint 010 (Deprecation)
- ✅ Status поле удалено из БД
- ✅ StoreStatus type удален из TypeScript
- ✅ Документация обновлена
- ✅ Production работает 2+ недели стабильно

---

## Risks & Mitigation

### Risk 1: CRON jobs ломаются после Фазы 3
**Probability:** MEDIUM
**Impact:** HIGH
**Mitigation:**
- Extensive staging testing
- Feature flag для rollback
- Monitor CRON job success rates после deploy

### Risk 2: Extension перестает синхронизировать магазины
**Probability:** MEDIUM
**Impact:** CRITICAL
**Mitigation:**
- E2E тесты для extension перед каждым deploy
- Canary deployment (5% users first)
- Rollback plan готов

### Risk 3: Access control regression (security)
**Probability:** LOW
**Impact:** CRITICAL
**Mitigation:**
- Security audit перед Фазой 3
- Separate security testing environment
- Manual verification after deploy

### Risk 4: Performance degradation (dual checks)
**Probability:** LOW
**Impact:** MEDIUM
**Mitigation:**
- Load testing на staging
- DB indexes на оба поля
- Query optimization review

---

## Rollback Strategy

### Фаза 1-2 (Dual-Write, UI)
**Rollback:** Trivial — revert commits, redeploy
- Status field не тронут
- Backward compatible

### Фаза 3 (Dual-Read Logic)
**Rollback:** Medium difficulty
- Revert DB query changes
- Feature flag: `USE_STAGE_FIELD=false`
- Redeploy + restart CRON

### Фаза 4 (Stage-Primary)
**Rollback:** Difficult but possible
- Restore status endpoint
- Revert all 52 changes
- Feature flag: `STAGE_MIGRATION_ENABLED=false`
- Requires full regression testing

### Фаза 5 (Deprecation)
**Rollback:** NOT POSSIBLE — status column deleted
- Must be 100% confident before this phase
- Minimum 1 month stability period required

---

## Decision Points

### Go/No-Go Gates

**Gate 1:** Before Sprint 008 (Dual-Read Logic)
- ✅ Dual-write working flawlessly (1+ week)
- ✅ No production incidents
- ✅ Staging tests all pass

**Gate 2:** Before Sprint 009 (Stage-Primary)
- ✅ Dual-read working on production (2+ weeks)
- ✅ CRON jobs stable
- ✅ Extension working correctly
- ✅ No access control issues

**Gate 3:** Before Sprint 010 (Deprecation)
- ✅ Stage-primary working on production (1+ month)
- ✅ Status field verified unused (grep check)
- ✅ All stakeholders approve
- ✅ Full backup created

---

## Alternative Approaches (Considered & Rejected)

### Approach A: Big Bang Migration
**Idea:** Заменить все status на stage за один sprint.
**Rejected:** Слишком рискованно — 52 места, критичная бизнес-логика.

### Approach B: Keep Both Fields Forever
**Idea:** Поддерживать оба поля параллельно.
**Rejected:** Technical debt, confusing для developers, 2x maintenance cost.

### Approach C: Create status_v2 Field
**Idea:** Добавить новое поле status_v2 вместо stage.
**Rejected:** Naming confusion, не решает фундаментальную проблему маппинга.

---

## Communication Plan

### Week 0 (Before Sprint 007)
- Презентация плана всей команде
- Q&A session
- Утверждение timeline

### Week 2 (After Sprint 007)
- Sprint review: Dual-write результаты
- Demo новых UI компонентов

### Week 4 (After Sprint 008)
- Sprint review: Dual-read результаты
- CRON jobs stability report
- Decision: Go/No-Go для Sprint 009

### Week 8 (After Sprint 009)
- Sprint review: Stage-primary результаты
- Comprehensive testing report
- Decision: Go/No-Go для Sprint 010

### Week 10 (After Sprint 010)
- Migration complete announcement
- Retrospective
- Documentation finalization

---

## Post-Migration

### Monitoring (First Month)
- Daily CRON job success rate checks
- Weekly extension sync verification
- Bi-weekly dashboard stats audit
- 24/7 error rate monitoring

### Documentation
- Update all domain docs
- Update API docs
- Create migration postmortem
- Update training materials

### Cleanup
- Archive old status-related code
- Delete deprecated endpoints
- Clean up feature flags
- Update database schema docs

---

**END OF MIGRATION PLAN**

**Next Steps:**
1. Review и approval от команды
2. Create Jira/Linear tickets для Sprint 007
3. Setup staging environment
4. Begin Sprint 007 execution
