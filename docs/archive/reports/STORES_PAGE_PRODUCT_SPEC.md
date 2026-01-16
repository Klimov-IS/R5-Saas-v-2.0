# 📋 Продуктовая спецификация: Главная страница управления кабинетами

> **Product Manager:** Claude
> **Дата создания:** 8 января 2025
> **Статус:** Ready for Development
> **Приоритет:** P0 (Critical)
> **Прототип:** `wb-reputation V 1.0/prototypes/stores-management-v2.html`

---

## 🎯 Product Vision

**Главная страница** - это центральная точка управления всеми магазинами Wildberries в системе WB Reputation Manager.

### Ключевые принципы:
1. **Минимализм** - каждый элемент должен быть функциональным
2. **Интуитивность** - действия должны быть очевидны без обучения
3. **Эффективность** - быстрый доступ ко всем критичным операциям
4. **Масштабируемость** - дизайн должен работать для 10 и для 500 магазинов

---

## 📐 Архитектура страницы

```
┌─────────────────────────────────────────────────────────┐
│ 🏪 Кабинеты                                             │
│ Управление магазинами Wildberries                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [🏪 51] [📦 4,247] [⭐ 558,298] [💬 15,924]            │
│ ↑ Interactive KPI Cards (hover to reveal actions)       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🏪 Список магазинов (51)                                │
│                                                          │
│ [🔍 Поиск...] [Активные ▼] [Сортировка ▼]              │
│                                                          │
│ ┌────────────────────────────────────────────────────┐ │
│ │ МАГАЗИН  ТОВАРЫ  ОТЗЫВЫ  ДИАЛОГИ  СТАТУС  ДЕЙСТВИЯ │ │
│ │ ───────────────────────────────────────────────────│ │
│ │ ИП...    📦 0    ⭐ 0    💬 0    🟢 Активен  [🔄]  │ │
│ │ (click on name to navigate to store details)      │ │
│ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🧩 Компоненты и фичи

### 1. **Header (Page Title)**

#### Внешний вид:
```
🏪 Кабинеты
Управление рейтингом на маркетплейсе Wildberries
```

#### Спецификация:
- **H1:** "🏪 Кабинеты" (font-size: 24px, weight: 700)
- **Subtitle:** "Управление рейтингом на маркетплейсе Wildberries" (font-size: 14px, color: muted)
- **Отступы:** margin-bottom: 32px

#### Поведение:
- Статичный элемент, без интерактива

---

### 2. **Interactive KPI Cards** 🔥 (Main Feature)

#### Концепция:
Каждая KPI карточка - это не просто статистика, а **быстрая кнопка действия**. При hover показывается overlay с иконкой действия и tooltip.

---

#### 2.1. **Всего магазинов**

**Визуал:**
```
┌──────────────────────┐
│ 🏪  Всего магазинов  │
│     51               │
└──────────────────────┘
```

**Hover состояние:**
```
┌──────────────────────┐
│ [➕] ← Blue overlay  │
│     51               │
└──────────────────────┘
    ↓ tooltip
"Добавить магазин"
```

**Спецификация:**
- **Иконка:** Store icon (синий круг фон)
- **Label:** "Всего магазинов"
- **Value:** Динамическое число (count всех stores)
- **Action Icon:** Plus (+)
- **Tooltip:** "Добавить магазин"

**Поведение:**
- **На hover:**
  - Background становится светло-серым
  - Карточка поднимается на 2px
  - Иконка покрывается синим overlay (opacity: 0.95)
  - Появляется белая иконка "+"
  - Снизу показывается tooltip
- **На click:**
  - Открывается модальное окно "Добавить новый магазин"
  - Форма с полями: название, API токен, статус

**API Integration:**
- **Data Source:** `GET /api/stores` → `response.length`
- **Action:** `openAddStoreModal()` → Modal component

**Technical Details:**
```typescript
// React component
<KPICard
  icon={<StoreIcon />}
  label="Всего магазинов"
  value={stores.length}
  action="add"
  actionTooltip="Добавить магазин"
  onClick={openAddStoreModal}
/>
```

---

#### 2.2. **Всего товаров**

**Визуал:**
```
┌──────────────────────┐
│ 📦  Всего товаров    │
│     4,247            │
└──────────────────────┘
```

**Hover состояние:**
```
┌──────────────────────┐
│ [🔄] ← Blue overlay  │
│     4,247            │
└──────────────────────┘
    ↓ tooltip
"Синхронизировать товары"
```

**Спецификация:**
- **Иконка:** Package icon (фиолетовый круг фон)
- **Label:** "Всего товаров"
- **Value:** Сумма всех product_count по всем stores
- **Action Icon:** Refresh/Sync (🔄)
- **Tooltip:** "Синхронизировать товары"

**Поведение:**
- **На hover:** Аналогично KPI #1, но с иконкой refresh
- **На click:**
  - Показать confirmation dialog: "Запустить синхронизацию товаров для всех магазинов?"
  - При подтверждении → запустить массовую синхронизацию
  - Показать progress indicator
  - После завершения → toast notification с результатами

**API Integration:**
- **Data Source:** `GET /api/stores` → `sum(store.product_count)`
- **Action:** `POST /api/stores/products/update-all`

**Expected API Response:**
```json
{
  "success": true,
  "results": [
    {
      "storeId": "xxx",
      "storeName": "ИП Иванов",
      "status": "success",
      "productsAdded": 12,
      "productsUpdated": 145,
      "totalProducts": 157
    },
    ...
  ],
  "summary": {
    "total": 51,
    "success": 48,
    "errors": 3,
    "totalProductsSynced": 4247
  }
}
```

**Technical Details:**
```typescript
async function handleSyncAllProducts() {
  if (!confirm('Запустить синхронизацию товаров для всех магазинов?')) return;

  setIsLoading(true);
  try {
    const response = await fetch('/api/stores/products/update-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const data = await response.json();

    // Show results toast
    toast.success(`Синхронизировано: ${data.summary.success}/${data.summary.total} магазинов`);

    // Refresh store list
    queryClient.invalidateQueries(['stores']);
  } catch (error) {
    toast.error('Ошибка синхронизации');
  } finally {
    setIsLoading(false);
  }
}
```

---

#### 2.3. **Всего отзывов**

**Визуал:**
```
┌──────────────────────┐
│ ⭐  Всего отзывов    │
│     558,298          │
└──────────────────────┘
```

**Hover состояние:**
```
┌──────────────────────┐
│ [🔄] ← Blue overlay  │
│     558,298          │
└──────────────────────┘
    ↓ tooltip
"Обновить отзывы (Incremental)"
```

**Спецификация:**
- **Иконка:** Star icon (серый круг фон)
- **Label:** "Всего отзывов"
- **Value:** Сумма всех total_reviews по всем stores
- **Action Icon:** Refresh/Sync (🔄)
- **Tooltip:** "Обновить отзывы (Incremental)"

**Поведение:**
- **На hover:** Аналогично предыдущим KPI
- **На click:**
  - Запустить **incremental** синхронизацию отзывов для всех магазинов
  - Incremental режим загружает только новые отзывы с последней синхронизации
  - Confirmation dialog + progress indicator
  - Toast с результатами

**API Integration:**
- **Data Source:** `GET /api/stores` → `sum(store.total_reviews)`
- **Action:** `POST /api/stores/reviews/update-all?mode=incremental`

**Business Logic:**
- **Incremental mode** - быстрее, используется для регулярных обновлений
- **Full mode** - медленнее, для initial sync или если были проблемы
- По умолчанию для KPI используем Incremental

**Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "storeId": "xxx",
      "storeName": "ИП Иванов",
      "status": "success",
      "newReviews": 5,
      "totalReviews": 1234
    },
    ...
  ],
  "summary": {
    "total": 51,
    "success": 50,
    "errors": 1,
    "newReviewsSynced": 127
  }
}
```

---

#### 2.4. **Всего диалогов**

**Визуал:**
```
┌──────────────────────┐
│ 💬  Всего диалогов   │
│     15,924           │
└──────────────────────┘
```

**Hover состояние:**
```
┌──────────────────────┐
│ [🔄] ← Blue overlay  │
│     15,924           │
└──────────────────────┘
    ↓ tooltip
"Обновить диалоги"
```

**Спецификация:**
- **Иконка:** Chat icon (синий круг фон)
- **Label:** "Всего диалогов"
- **Value:** Сумма всех total_chats по всем stores
- **Action Icon:** Refresh/Sync (🔄)
- **Tooltip:** "Обновить диалоги"

**Поведение:**
- **На hover:** Аналогично предыдущим KPI
- **На click:**
  - Запустить синхронизацию диалогов для всех магазинов
  - Confirmation dialog + progress indicator
  - Toast с результатами

**API Integration:**
- **Data Source:** `GET /api/stores` → `sum(store.total_chats)`
- **Action:** `POST /api/stores/dialogues/update-all`

---

### 3. **Filters Bar**

#### Внешний вид:
```
[🔍 Поиск по названию магазина...] [Активные ▼] [Сортировка: По дате ▼]
```

---

#### 3.1. **Search Input**

**Спецификация:**
- **Placeholder:** "🔍 Поиск по названию магазина..."
- **Width:** flex: 1, min-width: 300px
- **Debounce:** 300ms

**Поведение:**
- **On input:**
  - Фильтровать список магазинов по названию (case-insensitive)
  - Поиск работает в реальном времени с debounce 300ms
  - Показывать количество найденных: "Список магазинов (12)"
  - Если ничего не найдено → Empty state

**Technical Details:**
```typescript
const [searchQuery, setSearchQuery] = useState('');
const debouncedSearch = useDebounce(searchQuery, 300);

const filteredStores = useMemo(() => {
  if (!debouncedSearch) return stores;

  return stores.filter(store =>
    store.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
}, [stores, debouncedSearch]);
```

---

#### 3.2. **Status Filter (Multi-select)** 🔥

**Визуал (closed):**
```
┌─────────────┐
│ Активные  ▼ │
└─────────────┘
```

**Визуал (opened):**
```
┌─────────────────────────┐
│ Активные              ▼ │
└─────────────────────────┘
  ┌─────────────────────────┐
  │ ☑ 🟢 Активные           │
  │ ☐ 🟡 На паузе           │
  │ ☐ 🔴 Остановлены        │
  │ ☐ 🔵 Тестовые           │
  │ ☐ ⚫ Архивные           │
  └─────────────────────────┘
```

**Спецификация:**
- **Тип:** Custom multi-select dropdown с чекбоксами
- **Default:** Только "Активные" checked
- **Min-width:** 200px

**Логика отображения label:**

| Выбрано статусов | Label кнопки |
|------------------|--------------|
| 0 | "Все статусы" |
| 1 | Название статуса (напр. "Активные") |
| 2-4 | "Выбрано: **N**" (с синим бейджем) |
| 5 (все) | "Все статусы" |

**Поведение:**
- **On click:** Открыть dropdown
- **On checkbox change:**
  - Обновить label кнопки
  - Отфильтровать список магазинов
  - Обновить счетчик "Список магазинов (N)"
- **On click outside:** Закрыть dropdown

**Статусы:**
```typescript
type StoreStatus = 'active' | 'paused' | 'stopped' | 'trial' | 'archived';

const STATUSES = [
  { value: 'active', label: 'Активные', color: '#10b981', defaultChecked: true },
  { value: 'paused', label: 'На паузе', color: '#f59e0b', defaultChecked: false },
  { value: 'stopped', label: 'Остановлены', color: '#ef4444', defaultChecked: false },
  { value: 'trial', label: 'Тестовые', color: '#3b82f6', defaultChecked: false },
  { value: 'archived', label: 'Архивные', color: '#6b7280', defaultChecked: false },
];
```

**Technical Details:**
```typescript
const [selectedStatuses, setSelectedStatuses] = useState<StoreStatus[]>(['active']);

const filteredByStatus = useMemo(() => {
  if (selectedStatuses.length === 0 || selectedStatuses.length === 5) {
    return filteredStores; // Все статусы = без фильтра
  }

  return filteredStores.filter(store =>
    selectedStatuses.includes(store.status)
  );
}, [filteredStores, selectedStatuses]);
```

---

#### 3.3. **Sort Dropdown**

**Спецификация:**
- **Тип:** Standard select dropdown
- **Default:** "Сортировка: По дате добавления ↓"

**Опции:**
```typescript
const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Сортировка: По дате добавления ↓' },
  { value: 'name_asc', label: 'По названию A-Z' },
  { value: 'name_desc', label: 'По названию Z-A' },
  { value: 'products_desc', label: 'По количеству товаров ↓' },
  { value: 'reviews_desc', label: 'По количеству отзывов ↓' },
  { value: 'chats_desc', label: 'По количеству диалогов ↓' },
];
```

**Поведение:**
- **On change:** Пересортировать список магазинов

**Technical Details:**
```typescript
const sortedStores = useMemo(() => {
  const sorted = [...filteredByStatus];

  switch (sortBy) {
    case 'date_desc':
      return sorted.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case 'name_asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'products_desc':
      return sorted.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
    case 'reviews_desc':
      return sorted.sort((a, b) => (b.total_reviews || 0) - (a.total_reviews || 0));
    case 'chats_desc':
      return sorted.sort((a, b) => (b.total_chats || 0) - (a.total_chats || 0));
    default:
      return sorted;
  }
}, [filteredByStatus, sortBy]);
```

---

### 4. **Stores Table**

#### Структура:

| Колонка | Ширина | Сортируемая | Описание |
|---------|--------|-------------|----------|
| **Магазин** | 25% | ✅ | Название + дата добавления |
| **Товары** | 12% | ✅ | Badge с счетчиком |
| **Отзывы** | 12% | ✅ | Badge с счетчиком |
| **Диалоги** | 12% | ✅ | Badge с счетчиком |
| **Статус** | 15% | ✅ | Dropdown badge |
| **Действия** | 24% | ❌ | Иконки действий |

---

#### 4.1. **Колонка "Магазин"** (Clickable)

**Визуал:**
```
ИП Тургунов Ф. Ф.
Добавлен: Вчера, 14:23
```

**Спецификация:**
- **Line 1:** Название магазина (font-weight: 600)
- **Line 2:** Дата добавления (font-size: 12px, color: muted)
- **Cursor:** pointer

**Поведение:**
- **On click:** Navigate to `/stores/[storeId]`
- **On hover:**
  - Название становится синим (color: primary)
  - Показать underline (optional)

**Technical Details:**
```typescript
<td
  className="store-name-cell cursor-pointer"
  onClick={() => router.push(`/stores/${store.id}`)}
>
  <div className="store-name">{store.name}</div>
  <div className="store-meta">
    Добавлен: {formatRelativeDate(store.created_at)}
  </div>
</td>
```

**Date Formatting:**
```typescript
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) return 'Сегодня, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diffInHours < 48) return 'Вчера, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
```

---

#### 4.2. **Колонки с счетчиками** (Товары, Отзывы, Диалоги)

**Визуал:**
```
📦 2,642    ⭐ 125,432    💬 4,521
```

**Спецификация:**
- **Тип:** Badge с иконкой
- **Format:** Number with comma separators for thousands
- **Colors:**
  - Товары: фиолетовый фон (var(--category-products-bg))
  - Отзывы: серый фон (var(--category-reviews-bg))
  - Диалоги: синий фон (var(--category-chats-bg))

**Поведение:**
- Статичные элементы (без hover/click)

**Technical Details:**
```typescript
function formatNumber(num: number): string {
  return num.toLocaleString('ru-RU');
}

<td>
  <Badge variant="purple" icon={<PackageIcon />}>
    {formatNumber(store.product_count || 0)}
  </Badge>
</td>
```

---

#### 4.3. **Колонка "Статус"** (Interactive Dropdown) 🔥

**Визуал (closed):**
```
🟢 Активен ▼
```

**Визуал (opened):**
```
🟢 Активен ▼
  ┌─────────────────┐
  │ 🟢 Активен      │ ← Highlighted if current
  │ 🟡 На паузе     │
  │ 🔴 Остановлен   │
  │ 🔵 Тестовый     │
  │ ⚫ Архивный     │
  └─────────────────┘
```

**Спецификация:**
- **Тип:** Custom dropdown badge
- **Cursor:** pointer
- **5 статусов** с цветными точками

**Дизайн статусов:**

| Статус | Цвет | Background | Точка | Описание |
|--------|------|------------|-------|----------|
| **Активен** | #10b981 | rgba(16, 185, 129, 0.15) | 🟢 | Магазин работает, все автоматизации включены |
| **На паузе** | #f59e0b | rgba(245, 158, 11, 0.15) | 🟡 | Временная приостановка (отпуск, межсезонье) |
| **Остановлен** | #ef4444 | rgba(239, 68, 68, 0.15) | 🔴 | Клиент отказался от услуг |
| **Тестовый** | #3b82f6 | rgba(59, 130, 246, 0.15) | 🔵 | Пробный период 14 дней |
| **Архивный** | #6b7280 | rgba(107, 114, 128, 0.15) | ⚫ | Скрыт из основного списка (по умолчанию в фильтре не показывается) |

**Поведение:**
- **On click:** Открыть dropdown
- **On item click:**
  - Закрыть dropdown
  - Отправить API запрос на изменение статуса
  - Optimistic update: сразу обновить UI
  - Если ошибка → rollback и показать toast error
  - Если успех → показать toast success
- **On click outside:** Закрыть dropdown

**API Integration:**
```typescript
PATCH /api/stores/[storeId]/status
Body: { status: "paused" }
Response: { data: { id, name, status, updated_at } }
```

**Technical Details:**
```typescript
async function handleStatusChange(storeId: string, newStatus: StoreStatus) {
  const previousStatus = store.status;

  // Optimistic update
  queryClient.setQueryData(['stores'], (old: Store[]) =>
    old.map(s => s.id === storeId ? { ...s, status: newStatus } : s)
  );

  try {
    const response = await fetch(`/api/stores/${storeId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) throw new Error('Failed to update status');

    toast.success('Статус обновлен');
    queryClient.invalidateQueries(['stores']);
  } catch (error) {
    // Rollback on error
    queryClient.setQueryData(['stores'], (old: Store[]) =>
      old.map(s => s.id === storeId ? { ...s, status: previousStatus } : s)
    );
    toast.error('Ошибка обновления статуса');
  }
}
```

**Business Rules:**

1. **Переход "Активен" → "Архивный":**
   - Показать confirmation: "Магазин будет скрыт из основного списка. Продолжить?"
   - После архивации магазин исчезает из списка (если фильтр "Активные")

2. **Переход "Архивный" → "Активен":**
   - Восстанавливаем магазин в активное состояние
   - Магазин появляется в списке

3. **Переход "Активен" → "Остановлен":**
   - Показать warning: "Все автоматизации будут отключены. Продолжить?"
   - Отключаются: синхронизация, AI-генерация, отправка данных в WB

4. **Любой статус → "Тестовый":**
   - Устанавливаем лимиты: AI-генерация 100/день, 1 магазин
   - Пробный период 14 дней

---

#### 4.4. **Колонка "Действия"** (Icon Buttons with Tooltips)

**Визуал:**
```
[📦] [⭐] [💬] [✏️]
 ↑    ↑    ↑    ↑
hover для tooltip
```

**Спецификация:**
- **4 иконки** в ряд
- **Size:** 32x32px каждая
- **Gap:** 8px между иконками
- **Tooltip:** Появляется сверху при hover

**Действия:**

| Иконка | Tooltip | Action | API |
|--------|---------|--------|-----|
| 📦 | "Обновить товары" | Синхронизация товаров для магазина | `POST /api/stores/[storeId]/products/update` |
| ⭐ | "Обновить отзывы" | Синхронизация отзывов (incremental) | `POST /api/stores/[storeId]/reviews/update?mode=incremental` |
| 💬 | "Обновить диалоги" | Синхронизация диалогов | `POST /api/stores/[storeId]/dialogues/update` |
| ✏️ | "Редактировать" | Открыть модальное окно редактирования | Modal component |

**Поведение иконки:**
- **Default:** color: muted (#64748b)
- **On hover:**
  - Background: светло-серый (var(--color-border-light))
  - Color: foreground (#0f172a)
  - Transform: translateY(-1px)
  - Показать tooltip сверху

**Technical Details:**
```typescript
<div className="action-icons">
  <ActionIcon
    icon={<PackageIcon />}
    tooltip="Обновить товары"
    onClick={() => handleSyncProducts(store.id)}
    loading={syncingProducts[store.id]}
  />

  <ActionIcon
    icon={<StarIcon />}
    tooltip="Обновить отзывы"
    onClick={() => handleSyncReviews(store.id)}
    loading={syncingReviews[store.id]}
  />

  <ActionIcon
    icon={<MessageSquareIcon />}
    tooltip="Обновить диалоги"
    onClick={() => handleSyncChats(store.id)}
    loading={syncingChats[store.id]}
  />

  <ActionIcon
    icon={<EditIcon />}
    tooltip="Редактировать"
    onClick={() => openEditStoreModal(store)}
  />
</div>
```

**Loading State:**
```typescript
// Во время синхронизации показываем spinner вместо иконки
{syncingProducts[store.id] ? (
  <Spinner size="sm" />
) : (
  <PackageIcon />
)}
```

**API Response Handling:**
```typescript
async function handleSyncProducts(storeId: string) {
  setSyncingProducts(prev => ({ ...prev, [storeId]: true }));

  try {
    const response = await fetch(`/api/stores/${storeId}/products/update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const data = await response.json();

    if (data.status === 'success') {
      toast.success(`Синхронизировано: ${data.productsAdded} новых товаров`);
      queryClient.invalidateQueries(['stores']);
    } else {
      toast.error(data.message || 'Ошибка синхронизации');
    }
  } catch (error) {
    toast.error('Ошибка синхронизации товаров');
  } finally {
    setSyncingProducts(prev => ({ ...prev, [storeId]: false }));
  }
}
```

---

### 5. **Модальное окно "Добавить магазин"**

#### Trigger:
- Клик на KPI "Всего магазинов"

#### Внешний вид:
```
┌────────────────────────────────────┐
│ Добавить новый магазин          [×]│
├────────────────────────────────────┤
│                                    │
│ Название магазина *                │
│ [ИП Иванов А. А.            ]     │
│                                    │
│ API Token (WB) *                   │
│ [eyJhbGciOiJFUzI1NiIsImtpZC...]   │
│                                    │
│ Content API Token                  │
│ [Если отличается от основного]     │
│                                    │
│ Feedbacks API Token                │
│ [Если отличается от основного]     │
│                                    │
│ Chat API Token                     │
│ [Если отличается от основного]     │
│                                    │
│ Статус *                           │
│ [Активен ▼]                        │
│                                    │
├────────────────────────────────────┤
│              [Отмена] [Добавить]   │
└────────────────────────────────────┘
```

#### Поля формы:

| Поле | Тип | Обязательность | Валидация | Placeholder |
|------|-----|----------------|-----------|-------------|
| **Название магазина** | Text | ✅ Required | Min 3 chars | "ИП Иванов А. А." |
| **API Token (WB)** | Text | ✅ Required | JWT format | "eyJhbGciOi..." |
| **Content API Token** | Text | ❌ Optional | JWT format | "Если отличается от основного" |
| **Feedbacks API Token** | Text | ❌ Optional | JWT format | "Если отличается от основного" |
| **Chat API Token** | Text | ❌ Optional | JWT format | "Если отличается от основного" |
| **Статус** | Select | ✅ Required | Enum | Default: "Активен" |

#### Статус Dropdown опции:
```typescript
const STATUS_OPTIONS = [
  { value: 'active', label: 'Активен' },
  { value: 'trial', label: 'Тестовый' },
  { value: 'paused', label: 'На паузе' },
];
// Note: "Остановлен" и "Архивный" недоступны при создании
```

#### Валидация:

**Название магазина:**
- Минимум 3 символа
- Максимум 100 символов
- Не должно быть дубликатов (проверка на бэкенде)

**API Token:**
- Формат JWT (regex: `/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/`)
- Проверка валидности токена на WB API (опционально, при сохранении)

#### Поведение:

**При клике "Отмена":**
- Закрыть модальное окно
- Сбросить форму

**При клике "Добавить":**
1. **Валидация формы:**
   - Проверить обязательные поля
   - Проверить формат токена
   - Если ошибки → показать под полями

2. **Генерация ID:**
   ```typescript
   function generateStoreId(): string {
     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
     let id = '';
     for (let i = 0; i < 20; i++) {
       id += chars.charAt(Math.floor(Math.random() * chars.length));
     }
     return id;
   }
   ```

3. **API Request:**
   ```typescript
   POST /api/stores
   Body: {
     id: generateStoreId(),
     name: "ИП Иванов А. А.",
     apiToken: "eyJhbGciOi...",
     contentApiToken: "eyJhbGciOi..." || null,
     feedbacksApiToken: "eyJhbGciOi..." || null,
     chatApiToken: "eyJhbGciOi..." || null,
     status: "active"
   }
   ```

4. **Response Handling:**
   - **Success (201):**
     - Закрыть модальное окно
     - Показать toast: "Магазин добавлен успешно"
     - Invalidate queries для обновления списка
     - Опционально: предложить запустить первичную синхронизацию
   - **Error (400/500):**
     - Показать ошибку под формой
     - Не закрывать модальное окно

5. **Post-Creation Flow (опционально):**
   ```
   ┌────────────────────────────────────┐
   │ Магазин добавлен успешно!        │
   │                                    │
   │ Запустить первичную синхронизацию? │
   │                                    │
   │ [Пропустить] [Синхронизировать]    │
   └────────────────────────────────────┘
   ```

   При клике "Синхронизировать":
   - Запустить параллельно:
     - Синхронизация товаров
     - Синхронизация отзывов (full)
     - Синхронизация диалогов
   - Показать progress modal
   - После завершения → navigate to store page

---

### 6. **Модальное окно "Редактировать магазин"**

#### Trigger:
- Клик на иконку ✏️ в колонке "Действия"

#### Отличия от "Добавить магазин":
- **Title:** "Редактировать магазин"
- **ID:** Не редактируется (hidden field)
- **Поля предзаполнены** текущими значениями
- **Кнопка:** "Сохранить" вместо "Добавить"
- **API:** `PUT /api/stores/[storeId]` вместо `POST /api/stores`

#### API Request:
```typescript
PUT /api/stores/[storeId]
Body: {
  name: "ИП Иванов А. А. (обновлено)",
  apiToken: "eyJhbGciOi...",
  contentApiToken: "eyJhbGciOi..." || null,
  feedbacksApiToken: "eyJhbGciOi..." || null,
  chatApiToken: "eyJhbGciOi..." || null
}
// Note: статус не редактируется через эту форму (для статуса есть dropdown в таблице)
```

---

## 🔌 API Endpoints Summary

### Existing Endpoints (Already Working):

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/stores` | Получить список всех магазинов | ✅ Working |
| `POST` | `/api/stores` | Создать новый магазин | ✅ Working |
| `GET` | `/api/stores/[storeId]` | Получить данные магазина | ✅ Working |
| `PUT` | `/api/stores/[storeId]` | Обновить магазин | ✅ Working |
| `DELETE` | `/api/stores/[storeId]` | Удалить магазин | ✅ Working (но не используется) |
| `POST` | `/api/stores/products/update-all` | Массовая синхронизация товаров | ✅ Working |
| `POST` | `/api/stores/reviews/update-all` | Массовая синхронизация отзывов | ✅ Working |
| `POST` | `/api/stores/dialogues/update-all` | Массовая синхронизация диалогов | ✅ Working |
| `POST` | `/api/stores/[storeId]/products/update` | Синхронизация товаров для магазина | ✅ Working |
| `POST` | `/api/stores/[storeId]/reviews/update` | Синхронизация отзывов для магазина | ✅ Working |
| `POST` | `/api/stores/[storeId]/dialogues/update` | Синхронизация диалогов для магазина | ✅ Working |

### New Endpoints (Need to Create):

| Method | Endpoint | Description | Priority |
|--------|----------|-------------|----------|
| `PATCH` | `/api/stores/[storeId]/status` | Изменить статус магазина | **P0** |

---

## 🗄️ Database Changes

### Новые колонки в таблице `stores`:

```sql
-- Add status column
ALTER TABLE stores
ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- Add constraint for valid statuses
ALTER TABLE stores
ADD CONSTRAINT stores_status_check
CHECK (status IN ('active', 'paused', 'stopped', 'trial', 'archived'));

-- Add index for filtering
CREATE INDEX idx_stores_status ON stores(status);
```

### Обновить SQL запрос в `getStores()`:

```sql
SELECT
  s.*,
  (SELECT COUNT(*) FROM products WHERE store_id = s.id) as product_count
FROM stores s
ORDER BY s.created_at DESC;
```

---

## 📊 TypeScript Types

### Update `Store` interface:

```typescript
export type StoreStatus = 'active' | 'paused' | 'stopped' | 'trial' | 'archived';

export interface Store {
  id: string;
  name: string;
  api_token: string;
  content_api_token?: string | null;
  feedbacks_api_token?: string | null;
  chat_api_token?: string | null;
  owner_id: string;
  status: StoreStatus; // NEW
  product_count?: number; // NEW (computed)
  total_reviews?: number;
  total_chats?: number;
  chat_tag_counts?: Record<ChatTag, number> | null;
  last_product_update_status?: UpdateStatus | null;
  last_product_update_date?: string | null;
  last_review_update_status?: UpdateStatus | null;
  last_review_update_date?: string | null;
  last_chat_update_status?: UpdateStatus | null;
  last_chat_update_date?: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## 🎨 Component Architecture

### React Components Structure:

```
src/app/page.tsx (Main Page)
├── PageHeader
├── KPICardsSection
│   ├── KPICard (x4) - Interactive
│   │   ├── KPIIcon
│   │   ├── KPIContent
│   │   └── KPIActionOverlay
│   └── KPIDivider
├── StoresSection
│   ├── FiltersBar
│   │   ├── SearchInput
│   │   ├── StatusMultiSelect
│   │   │   ├── StatusFilterButton
│   │   │   └── StatusFilterDropdown
│   │   │       └── StatusFilterItem (x5)
│   │   └── SortSelect
│   └── StoresTable
│       ├── TableHeader
│       └── TableBody
│           └── StoreRow (repeated)
│               ├── StoreNameCell (clickable)
│               ├── CountBadge (x3)
│               ├── StatusDropdown
│               │   ├── StatusBadge (clickable)
│               │   └── StatusDropdownMenu
│               │       └── StatusOption (x5)
│               └── ActionsCell
│                   └── ActionIcon (x4)
├── AddStoreModal
│   ├── ModalHeader
│   ├── ModalBody
│   │   └── StoreForm
│   │       ├── FormField (x6)
│   │       └── FormValidation
│   └── ModalFooter
└── EditStoreModal (similar to AddStoreModal)
```

---

## 🚀 Implementation Plan

### Phase 1: Backend (Database + API) - 1 день

**Tasks:**
1. ✅ Создать SQL миграцию для добавления `status` колонки
2. ✅ Обновить TypeScript типы (`Store` interface)
3. ✅ Обновить `getStores()` helper для подсчета `product_count`
4. ✅ Создать endpoint `PATCH /api/stores/[storeId]/status`
5. ✅ Обновить `GET /api/stores` для возврата `product_count`
6. ✅ Добавить валидацию статусов в API
7. ✅ Написать unit тесты для нового endpoint

**Acceptance Criteria:**
- API endpoint работает и возвращает корректные данные
- `product_count` корректно вычисляется для каждого магазина
- Изменение статуса работает с валидацией
- Все существующие тесты проходят

---

### Phase 2: Frontend Components (UI) - 2 дня

#### Day 1: KPI Cards + Filters

**Tasks:**
1. ✅ Создать `KPICard` component с hover эффектами
2. ✅ Реализовать интерактивные действия для KPI
3. ✅ Создать `StatusMultiSelect` component
4. ✅ Реализовать логику фильтрации по статусам
5. ✅ Добавить search и sort функционал
6. ✅ Стилизация согласно дизайн-системе

**Acceptance Criteria:**
- KPI карточки показывают hover overlay с иконками
- Клик на KPI запускает соответствующее действие
- Мультиселект статусов работает корректно
- Фильтры и сортировка работают без багов

#### Day 2: Table + Modals

**Tasks:**
1. ✅ Обновить `StoreList` component с новой структурой
2. ✅ Реализовать `StatusDropdown` в таблице
3. ✅ Создать `ActionIcon` components с tooltips
4. ✅ Создать `AddStoreModal` и `EditStoreModal`
5. ✅ Реализовать валидацию форм
6. ✅ Добавить loading states для всех действий

**Acceptance Criteria:**
- Таблица отображает все данные корректно
- Клик на название магазина → навигация работает
- Статус можно изменить через dropdown
- Иконки действий работают с tooltips
- Модальные окна открываются/закрываются корректно

---

### Phase 3: Integration (API + UI) - 1 день

**Tasks:**
1. ✅ Подключить React Query для data fetching
2. ✅ Реализовать все API вызовы с error handling
3. ✅ Добавить optimistic updates для изменения статусов
4. ✅ Реализовать toast notifications для всех действий
5. ✅ Добавить loading spinners для синхронизаций
6. ✅ Настроить кэширование и invalidation запросов

**Acceptance Criteria:**
- Все данные загружаются с сервера
- Ошибки обрабатываются gracefully
- Loading states показываются корректно
- Оптимистичные обновления работают
- Cache invalidation работает правильно

---

### Phase 4: Testing + Polish - 1 день

**Tasks:**
1. ✅ Протестировать все user flows
2. ✅ Проверить responsive design (mobile/tablet)
3. ✅ Оптимизировать производительность
4. ✅ Добавить accessibility (keyboard navigation, ARIA labels)
5. ✅ Проверить edge cases (пустые состояния, ошибки)
6. ✅ Финальная полировка UI/UX

**Acceptance Criteria:**
- Все функции работают на mobile/tablet
- Нет performance issues при 50+ магазинах
- Keyboard navigation работает
- Empty states и error states отображаются корректно

---

## 📈 Success Metrics (KPIs)

### User Experience Metrics:
- **Time to sync all stores:** < 30 секунд для 50 магазинов
- **Page load time:** < 2 секунды
- **Click to navigate:** < 300ms response time
- **Filter response time:** < 100ms (with debounce)

### Business Metrics:
- **User satisfaction:** 4.5+ из 5 звезд
- **Feature adoption:** 80%+ пользователей используют bulk actions
- **Error rate:** < 1% failed syncs
- **Support tickets:** Снижение на 30% (благодаря интуитивному UI)

---

## 🔒 Security Considerations

1. **API Authentication:**
   - Все endpoints защищены Bearer token
   - Валидация API key на каждом запросе

2. **Input Validation:**
   - Санитизация всех user inputs
   - XSS protection
   - SQL injection prevention

3. **Rate Limiting:**
   - Bulk operations: max 1 request per 10 seconds
   - Single store sync: max 5 requests per minute

4. **Data Privacy:**
   - API токены не показываются в UI (маскируются)
   - Логи не содержат sensitive data

---

## 🐛 Known Limitations & Future Improvements

### Current Limitations:
1. **Нет pagination** - все магазины загружаются сразу
   - **Limit:** До 100 магазинов комфортно
   - **Future:** Добавить виртуализацию списка

2. **Синхронизация блокирует UI**
   - **Current:** Показываем spinner
   - **Future:** WebSocket для real-time updates

3. **Нет bulk status change**
   - **Current:** Только по одному магазину
   - **Future:** Checkbox selection + bulk actions

### Future Enhancements:
- [ ] Добавить bulk selection (checkbox в таблице)
- [ ] Реализовать drag-and-drop сортировку
- [ ] Добавить "Избранное" для быстрого доступа
- [ ] Экспорт в CSV/Excel
- [ ] Advanced filters (по дате, по количеству товаров, etc.)
- [ ] Dashboard analytics (графики, тренды)
- [ ] Scheduled syncs (автоматическая синхронизация по расписанию)

---

## 📝 Notes for Developers

### Code Style:
- **TypeScript strict mode** обязателен
- **ESLint + Prettier** для форматирования
- **Component naming:** PascalCase
- **Function naming:** camelCase
- **Commits:** Conventional Commits format

### Performance Optimization:
```typescript
// Use React.memo for heavy components
export const StoreRow = React.memo(({ store }) => {
  // ...
});

// Use useMemo for expensive calculations
const filteredStores = useMemo(() => {
  return stores.filter(/* ... */);
}, [stores, filters]);

// Use useCallback for event handlers
const handleSync = useCallback((storeId: string) => {
  // ...
}, []);
```

### Error Handling Pattern:
```typescript
try {
  const response = await fetch(/* ... */);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  toast.success('Операция выполнена успешно');
  return data;
} catch (error) {
  console.error('[StoresPage] Error:', error);
  toast.error(error.message || 'Произошла ошибка');
  throw error;
}
```

---

## ✅ Definition of Done

**Считается завершенным, когда:**

1. ✅ Все компоненты реализованы согласно спецификации
2. ✅ Все API endpoints работают и протестированы
3. ✅ UI/UX соответствует прототипу
4. ✅ Все интерактивные элементы работают корректно
5. ✅ Loading states и error handling реализованы
6. ✅ Responsive design работает на всех устройствах
7. ✅ Code review пройден
8. ✅ QA тестирование пройдено
9. ✅ Документация обновлена
10. ✅ Deployed to production

---

## 🎉 Заключение

Эта страница - **сердце WB Reputation Manager**. Она должна быть:
- **Быстрой** - загрузка за секунды, действия мгновенны
- **Интуитивной** - новый пользователь понимает за 30 секунд
- **Мощной** - все критичные действия в один клик
- **Красивой** - современный, минималистичный дизайн

**Приоритет реализации:** P0 (Critical)
**Estimated effort:** 5 дней разработки + 1 день QA
**Target release:** Sprint 02 (15-19 января 2025)

---

**Ready to start development!** 🚀
