# Аудит Использования Поля `stores.status`

**Дата:** 2026-03-11
**Sprint:** 006 - Store Lifecycle Management
**Цель:** Полная инвентаризация использования `stores.status` для планирования миграции на `stores.stage`

---

## Executive Summary

Обнаружено **52 использования** поля `stores.status` в **25 файлах** кодовой базы.

**Критическая находка:** Система использует паттерн **`('active', 'trial')`** в 7 ключевых местах, трактуя эти два статуса как функционально идентичные "операционные магазины". Этот паттерн должен быть сохранен при миграции.

**Валидные значения:** `'active'`, `'paused'`, `'stopped'`, `'trial'`, `'archived'`

---

## Категория 1: Запросы к БД (КРИТИЧНО)

### 1.1 Фильтрация Активных Магазинов

**Файл:** `src/db/helpers.ts`

**Строка 452-460:** `getAllStores()` — используется CRON jobs
```typescript
"SELECT * FROM stores WHERE status = 'active' AND marketplace = $1 ORDER BY name"
```
- **Воздействие:** КРИТИЧНО — контролирует какие магазины синхронизируются
- **Назначение:** Фильтр для автоматизации

---

**Строка 3200:** Подходящие для жалоб магазины
```typescript
WHERE p.store_id IN (SELECT id FROM stores WHERE status IN ('active', 'trial'))
```
- **Воздействие:** КРИТИЧНО — контролирует автоматизацию жалоб
- **Назначение:** Только активные/trial магазины участвуют в auto-complaints
- **Паттерн:** Dual-status check

---

**Строка 3253-3258:** Статистика активных магазинов (Dashboard)
```typescript
active_store_ids AS (
  SELECT id FROM stores WHERE status IN ('active', 'trial')
),
store_stats AS (
  COUNT(*) FILTER (WHERE status IN ('active', 'trial')) AS active_stores,
  COUNT(*) FILTER (WHERE status IN ('active', 'trial') AND created_at >= date_trunc('month', CURRENT_DATE)) AS new_stores_this_month,
```
- **Воздействие:** ВЫСОКОЕ — KPI дэшборда
- **Паттерн:** Тройное использование `('active', 'trial')`

---

### 1.2 Контроль Доступа

**Файл:** `src/db/auth-helpers.ts`

**Строка 230:** `getAccessibleStoreIds()` — security boundary
```typescript
'SELECT id FROM stores WHERE org_id = $1 AND status = \'active\''
```
- **Воздействие:** КРИТИЧНО — безопасность
- **Назначение:** Определяет доступные пользователю магазины
- **Примечание:** Возвращает только 'active'

**Строка 327:** `registerUserFromInvite()` — автоназначение магазинов
```typescript
SELECT id FROM stores WHERE org_id = $1 AND status = 'active'
```
- **Воздействие:** ВЫСОКОЕ — onboarding
- **Назначение:** Новые менеджеры наследуют активные магазины организации

---

### 1.3 Chrome Extension API

**Файл:** `src/db/extension-helpers.ts`

**Строка 499, 512:** `getStoresForExtension()`
```typescript
SELECT id, name, marketplace, total_reviews
FROM stores
WHERE id = ANY($1::text[]) AND status = 'active'
ORDER BY name ASC
```
- **Воздействие:** КРИТИЧНО — синхронизация расширения
- **Назначение:** Расширение синхронизирует только активные магазины

---

**Файл:** `src/app/api/extension/stores/route.ts`

**Строка 163, 189:** Список магазинов для расширения
```typescript
WHERE s.owner_id = $1 AND s.status = 'active'
```
- **Воздействие:** ВЫСОКОЕ — UI расширения
- **Назначение:** Показывает только активные в списке

---

### 1.4 Google Sheets Sync

**Файл:** `src/services/google-sheets-sync/sync-service.ts`

**Строка 79:** `getActiveStores()`
```typescript
SELECT * FROM stores WHERE status = 'active' ORDER BY name
```
- **Воздействие:** СРЕДНЕЕ — отчетность
- **Назначение:** Синхронизация активных магазинов в Google Sheets

---

### 1.5 CRON Jobs

**Файл:** `src/lib/cron-jobs.ts`

**Строка 907:** Очистка автопоследовательностей
```typescript
AND store_id IN (SELECT id FROM stores WHERE status = 'active')
```
- **Воздействие:** СРЕДНЕЕ — предотвращает обработку чатов неактивных магазинов
- **Назначение:** Фиксит `awaiting_reply` чатов только для активных

---

## Категория 2: Бизнес-логика и Фильтрация

### 2.1 Фильтрация в UI (Web Dashboard)

**Файл:** `src/app/page.tsx`

**Строка 81:** Дефолтный фильтр
```typescript
const [selectedStatuses, setSelectedStatuses] = useState<StoreStatus[]>(['active']);
```
- **Воздействие:** СРЕДНЕЕ — UX default
- **Назначение:** По умолчанию показываем только активные

**Строка 132:** Client-side фильтр
```typescript
filtered = filtered.filter((store) => selectedStatuses.includes(store.status));
```
- **Воздействие:** СРЕДНЕЕ — контроль пользователя
- **Назначение:** Multi-select dropdown

**Строка 342, 526:** Подсчет активных магазинов
```typescript
const activeStores = stores.filter(s => s.status === 'active' || s.status === 'trial');
```
- **Воздействие:** СРЕДНЕЕ — UI stat card
- **Паттерн:** Dual-status check

---

### 2.2 Страница Кабинета

**Файл:** `src/app/stores/[storeId]/cabinet/page.tsx`

**Строка 87:** Маппинг лейблов
```typescript
const statusInfo = statusLabels[store.status] || statusLabels.active;
```
- **Воздействие:** НИЗКОЕ — только UI
- **Назначение:** Русская локализация статуса

**Строка 129-141:** Стилизация бейджа статуса (2 использования)
```typescript
...(store.status === 'active' || store.status === 'trial'
  ? { background: '#d1fae5', color: '#059669' }  // зеленый
  : store.status === 'paused'
    ? { background: '#fef3c7', color: '#d97706' }  // оранжевый
    : { background: '#fee2e2', color: '#ef4444' }  // красный
),
```
- **Воздействие:** НИЗКОЕ — визуал
- **Паттерн:** active/trial = зеленый

---

## Категория 3: Обновление Статусов

### 3.1 Status Update Endpoint

**Файл:** `src/app/api/stores/[storeId]/status/route.ts`

**Строка 12, 52:** Валидация и документация
```typescript
* Body: { status: 'active' | 'paused' | 'stopped' | 'trial' | 'archived' }

const validStatuses: StoreStatus[] = ['active', 'paused', 'stopped', 'trial', 'archived'];
```
- **Воздействие:** КРИТИЧНО — validation gate
- **Назначение:** Предотвращает невалидные значения

---

### 3.2 Создание Магазинов

**Файл:** `src/db/helpers.ts`
**Строка 484:** Дефолт при создании
```typescript
store.status || 'active',
```

**Файл:** `src/app/api/stores/ozon/create/route.ts`
**Строка 97:** OZON onboarding
```typescript
status: 'active',
```

**Файл:** `src/app/api/stores/route.ts`
**Строка 147:** WB onboarding
```typescript
status: 'active',
```
- **Воздействие:** КРИТИЧНО — дефолтное значение
- **Назначение:** Новые магазины всегда 'active'

---

## Категория 4: Определения Типов

**Файл:** `src/db/helpers.ts`

**Строка 26:** TypeScript type
```typescript
export type StoreStatus = 'active' | 'paused' | 'stopped' | 'trial' | 'archived';
```
- **Воздействие:** КРИТИЧНО — type safety всей кодовой базы

**Строка 77:** Store interface
```typescript
status: StoreStatus;
```
- **Воздействие:** КРИТИЧНО — data model

---

**Файл:** `migrations/028_schema_integrity_improvements.sql`

**Строка 80-84:** DB constraint
```sql
ALTER TABLE stores ADD CONSTRAINT chk_store_status
  CHECK (status IN ('active', 'paused', 'stopped', 'trial', 'archived'));
```
- **Воздействие:** КРИТИЧНО — database integrity

---

## Критичные Паттерны

### Паттерн 1: Active/Trial Эквивалентность

**7 мест трактуют `'active'` и `'trial'` как функционально идентичные:**

**Backend (Database queries):**
1. `src/db/helpers.ts:3200` — Подходящесть для жалоб
2. `src/db/helpers.ts:3253` — Active store IDs
3. `src/db/helpers.ts:3257` — Подсчет активных
4. `src/db/helpers.ts:3258` — Новые магазины этого месяца

**Frontend (UI):**
5. `src/app/page.tsx:342` — Фильтр активных
6. `src/app/page.tsx:526` — Dashboard stat
7. `src/app/stores/[storeId]/cabinet/page.tsx:129, 138` — Стилизация бейджа

**Вывод:** Любая миграция ДОЛЖНА сохранить эту dual-status логику или обновить все 7 мест.

---

### Паттерн 2: Дефолт = 'active'

**Все пути создания магазинов дефолтят на `'active'`:**

1. `src/db/helpers.ts:484` — `createStore()` fallback
2. `src/app/api/stores/route.ts:147` — WB создание
3. `src/app/api/stores/ozon/create/route.ts:97` — OZON создание
4. UI компоненты (AddStoreModal, EditStoreModal, BulkActionsBar)

**Вывод:** 'active' — канонический "операционный" статус.

---

### Паттерн 3: Status Filter = Access Control

**Extension и auth используют status = 'active' как security boundary:**

1. `src/db/auth-helpers.ts:230` — Доступные пользователю магазины
2. `src/db/auth-helpers.ts:327` — Автоназначение менеджерам
3. `src/db/extension-helpers.ts:499, 512` — Список магазинов расширения
4. `src/app/api/extension/stores/route.ts:163, 189` — Extension API

**Вывод:** Неактивные магазины эффективно скрыты от пользователей и автоматизации.

---

## Маппинг: Status → Stage

Согласно бизнес-логике пользователя:

```
'active' = 4 этапа:
  - cabinet_connected (Кабинет подключён)
  - complaints_submitted (Поданы жалобы)
  - chats_opened (Открыты чаты)
  - monitoring (Текущий контроль)

'trial' = те же 4 этапа (но возможно с ограничениями)

'paused' → client_paused (Клиент на паузе)

'stopped' → client_lost (Клиент потерян)
'archived' → client_lost (Клиент потерян)
```

**Проблема:** Один статус 'active' маппится на 4 разных этапа!

**Решение:** Dual-read период — проверяем И status И stage:
```typescript
// OLD: WHERE status IN ('active', 'trial')
// NEW: WHERE (status IN ('active', 'trial') AND stage NOT IN ('client_lost', 'client_paused'))
```

---

## Summary Table

| Категория | Файлов | Использований | Воздействие | Сложность Миграции |
|-----------|--------|--------------|------------|-------------------|
| Запросы к БД | 6 | 15 | КРИТИЧНО | ВЫСОКАЯ |
| Бизнес-логика | 4 | 8 | СРЕДНЕЕ | СРЕДНЯЯ |
| Обновление статусов | 7 | 12 | КРИТИЧНО | ВЫСОКАЯ |
| Определения типов | 3 | 5 | КРИТИЧНО | НИЗКАЯ |
| UI компоненты | 5 | 12 | НИЗКОЕ-СРЕДНЕЕ | НИЗКАЯ |
| **ИТОГО** | **25 файлов** | **52 места** | **MIXED** | **ВЫСОКАЯ** |

---

## Файлы Требующие Изменений

### КРИТИЧНЫЕ (Система не будет работать без изменений):
1. `src/db/helpers.ts` (4 места)
2. `src/db/auth-helpers.ts` (2 места)
3. `src/db/extension-helpers.ts` (2 места)
4. `src/lib/cron-jobs.ts` (1 место)
5. `src/app/api/extension/stores/route.ts` (2 места)
6. `src/app/api/extension/chat/stores/route.ts` (2 места)

### ВЫСОКИЙ ПРИОРИТЕТ (Система работает, но данные некорректны):
7. `src/app/page.tsx` (4 места)
8. `src/app/stores/[storeId]/cabinet/page.tsx` (4 места)
9. `src/services/google-sheets-sync/sync-service.ts` (1 место)

### СРЕДНИЙ ПРИОРИТЕТ (UX ухудшается):
10. `src/app/api/stores/[storeId]/status/route.ts` (3 места)
11. `src/components/stores/*` (5 файлов, 6 мест)

### НИЗКИЙ ПРИОРИТЕТ (Будущая очистка):
12. Определения типов (могут сосуществовать во время миграции)
13. Документация

---

## Рекомендации по Миграции

См. **MIGRATION-status-to-stage.md** для детального плана миграции.

**Ключевые принципы:**
1. **Dual-read период** — поддерживаем оба поля 2+ месяца
2. **Постепенный переход** — начинаем с UI, заканчиваем критичными запросами
3. **Сохранение паттернов** — active/trial эквивалентность должна быть сохранена
4. **Rollback готовность** — каждый этап должен быть откатываемым

---

**END OF AUDIT**
