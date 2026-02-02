# TASK-002: Оптимизация фильтров страницы отзывов

**Статус:** Запланировано
**Приоритет:** Высокий
**Создано:** 2026-02-02

---

## Проблемы

### 1. Фильтры не сохраняются

**Текущее поведение:**
- Фильтры хранятся в `useState` (локально в компоненте)
- При переключении магазина — фильтры сбрасываются
- При переключении таба (Товары → Отзывы) — фильтры сбрасываются
- При F5 — фильтры сбрасываются

**Ожидаемое поведение (как в Чатах):**
- Фильтры сохраняются при переключении магазина
- Фильтры сохраняются при переходе между табами
- Опционально: фильтры сохраняются после F5

### 2. Медленное переключение фильтров

**Текущее поведение:**
- Каждое изменение фильтра → новый запрос на сервер
- Задержка 200-500ms на каждое переключение
- Spinner при каждом изменении фильтра
- Неудобно для пользователя

**Ожидаемое поведение (как в Чатах):**
- Загрузка ВСЕХ данных один раз
- Фильтрация на клиенте (0ms переключение)
- Мгновенный отклик интерфейса

---

## Сравнительный анализ

### Текущая архитектура

| Компонент | Чаты | Отзывы |
|-----------|------|--------|
| **Хранение фильтров** | Zustand (`chatsStore.ts`) | useState (локально) |
| **Загрузка данных** | Все 500 записей, фильтр на клиенте | По запросу с фильтрами на сервере |
| **Скорость фильтрации** | 0ms (клиент) | 200-500ms (сервер) |
| **Сохранение при смене магазина** | ✅ Да | ❌ Нет |

### Код: Чаты (правильно)

```typescript
// src/store/chatsStore.ts
export const useChatsStore = create<ChatsState>()((set, get) => ({
  // Фильтры глобальные - сохраняются между магазинами
  statusFilter: 'all',
  setStatusFilter: (status) => set({ statusFilter: status }),
  // ...
}));

// src/app/stores/[storeId]/chats/page.tsx
const { statusFilter, lastSender } = useChatsStore();

// Загрузка ВСЕХ чатов (без фильтров в queryKey)
const { data: allChatsData } = useQuery({
  queryKey: ['all-chats', storeId], // ✅ Без фильтров
  queryFn: async () => {
    // Загружаем ВСЕ 500 чатов
  },
});

// Фильтрация на клиенте (мгновенно)
const filteredChats = allChats.filter((chat) => {
  if (statusFilter !== 'all' && chat.status !== statusFilter) return false;
  // ...
});
```

### Код: Отзывы (проблема)

```typescript
// src/app/stores/[storeId]/reviews/page.tsx

// Фильтры локальные - сбрасываются при переходах
const [filters, setFilters] = useState<FilterState>({
  ratings: [1, 2, 3],
  // ...
});

// Каждое изменение фильтра = новый запрос
const { data } = useQuery({
  queryKey: ['reviews-v2', storeId, skip, take, filters], // ❌ Фильтры в queryKey
  queryFn: () => fetchReviewsData(storeId, skip, take, filters),
});
```

---

## Решение

### Шаг 1: Создать Zustand store для отзывов

**Файл:** `src/store/reviewsStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ReviewsFilterState {
  ratings: number[];
  complaintStatuses: string[];
  productStatuses: string[];
  reviewStatusesWB: string[];
  search: string;
}

interface ReviewsState {
  // Pagination
  skip: number;
  take: number;
  setSkip: (skip: number) => void;
  setTake: (take: number) => void;

  // Filters (global across stores)
  filters: ReviewsFilterState;
  setFilters: (filters: ReviewsFilterState) => void;
  setRatings: (ratings: number[]) => void;
  setComplaintStatuses: (statuses: string[]) => void;
  setProductStatuses: (statuses: string[]) => void;
  setReviewStatusesWB: (statuses: string[]) => void;
  setSearch: (search: string) => void;
  resetFilters: () => void;

  // Selection
  selectedReviews: Set<string>;
  toggleReviewSelection: (id: string) => void;
  selectAllReviews: (ids: string[]) => void;
  clearSelection: () => void;
}

const DEFAULT_FILTERS: ReviewsFilterState = {
  ratings: [1, 2, 3],
  complaintStatuses: [],
  productStatuses: ['active'],
  reviewStatusesWB: [],
  search: '',
};

export const useReviewsStore = create<ReviewsState>()(
  persist(
    (set, get) => ({
      // Pagination
      skip: 0,
      take: 50,
      setSkip: (skip) => set({ skip }),
      setTake: (take) => set({ take, skip: 0 }), // Reset to first page

      // Filters
      filters: DEFAULT_FILTERS,
      setFilters: (filters) => set({ filters, skip: 0 }),
      setRatings: (ratings) => set((state) => ({
        filters: { ...state.filters, ratings },
        skip: 0,
      })),
      setComplaintStatuses: (complaintStatuses) => set((state) => ({
        filters: { ...state.filters, complaintStatuses },
        skip: 0,
      })),
      setProductStatuses: (productStatuses) => set((state) => ({
        filters: { ...state.filters, productStatuses },
        skip: 0,
      })),
      setReviewStatusesWB: (reviewStatusesWB) => set((state) => ({
        filters: { ...state.filters, reviewStatusesWB },
        skip: 0,
      })),
      setSearch: (search) => set((state) => ({
        filters: { ...state.filters, search },
        skip: 0,
      })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, skip: 0 }),

      // Selection
      selectedReviews: new Set(),
      toggleReviewSelection: (id) => set((state) => {
        const newSet = new Set(state.selectedReviews);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { selectedReviews: newSet };
      }),
      selectAllReviews: (ids) => set({ selectedReviews: new Set(ids) }),
      clearSelection: () => set({ selectedReviews: new Set() }),
    }),
    {
      name: 'reviews-storage',
      partialize: (state) => ({
        filters: state.filters,
        take: state.take,
      }),
    }
  )
);
```

### Шаг 2: Клиентская фильтрация (как в чатах)

**Изменить:** `src/app/stores/[storeId]/reviews/page.tsx`

```typescript
// БЫЛО: Загрузка с фильтрами на сервере
const { data } = useQuery({
  queryKey: ['reviews-v2', storeId, skip, take, filters],
  queryFn: () => fetchReviewsData(storeId, skip, take, filters),
});

// СТАЛО: Загрузка ВСЕХ данных, фильтрация на клиенте
const { data: allReviewsData } = useQuery({
  queryKey: ['all-reviews', storeId], // ✅ Без фильтров
  queryFn: async () => {
    // Загружаем ВСЕ отзывы (до 2000)
    const response = await fetch(`/api/stores/${storeId}/reviews?take=2000&rating=all`);
    return response.json();
  },
  staleTime: 5 * 60 * 1000,
});

// Мгновенная фильтрация на клиенте
const filteredReviews = useMemo(() => {
  if (!allReviewsData?.data) return [];

  return allReviewsData.data.filter((review) => {
    // Rating filter
    if (filters.ratings.length > 0 && !filters.ratings.includes(review.rating)) {
      return false;
    }
    // Complaint status filter
    if (filters.complaintStatuses.length > 0 &&
        !filters.complaintStatuses.includes(review.complaint_status || 'not_sent')) {
      return false;
    }
    // Product status filter
    if (filters.productStatuses.length > 0) {
      const isActive = review.product?.is_active !== false;
      if (filters.productStatuses.includes('active') && !isActive) return false;
      if (filters.productStatuses.includes('inactive') && isActive) return false;
    }
    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      const matchesText = review.text?.toLowerCase().includes(query);
      const matchesProduct = review.product?.name?.toLowerCase().includes(query);
      if (!matchesText && !matchesProduct) return false;
    }
    return true;
  });
}, [allReviewsData, filters]);

// Пагинация на клиенте
const paginatedReviews = filteredReviews.slice(skip, skip + take);
```

### Шаг 3: Обновить FilterCard компонент

**Изменить:** `src/components/reviews-v2/FilterCard.tsx`

```typescript
// Использовать Zustand вместо props
import { useReviewsStore } from '@/store/reviewsStore';

export function FilterCard() {
  const { filters, setRatings, setComplaintStatuses } = useReviewsStore();

  // Фильтры теперь из store, не из props
}
```

---

## Оценка производительности

### До оптимизации

| Действие | Время |
|----------|-------|
| Переключение рейтинга | 200-500ms |
| Переключение статуса | 200-500ms |
| Поиск (debounced) | 300-600ms |
| Смена магазина | Фильтры сбрасываются |

### После оптимизации

| Действие | Время |
|----------|-------|
| Переключение рейтинга | **0ms** |
| Переключение статуса | **0ms** |
| Поиск | **0ms** (без debounce) |
| Смена магазина | Фильтры сохраняются |

---

## Ограничения

1. **Лимит 2000 отзывов** — для магазинов с >2000 отзывов нужна серверная пагинация
   - Решение: Гибридный подход — первые 2000 на клиенте, остальные с сервера

2. **Память браузера** — 2000 отзывов ≈ 2-5 MB RAM
   - Это приемлемо для современных браузеров

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/store/reviewsStore.ts` | **Создать** — Zustand store |
| `src/app/stores/[storeId]/reviews/page.tsx` | Использовать store + клиентская фильтрация |
| `src/components/reviews-v2/FilterCard.tsx` | Использовать store вместо props |
| `src/components/layout/StoreSelector.tsx` | Сбросить selection при смене магазина |

---

## Чеклист реализации

- [ ] Создать `src/store/reviewsStore.ts`
- [ ] Обновить `reviews/page.tsx` — использовать store
- [ ] Изменить загрузку данных — все отзывы без фильтров
- [ ] Добавить клиентскую фильтрацию с `useMemo`
- [ ] Обновить `FilterCard.tsx` — использовать store
- [ ] Добавить persist для сохранения при F5
- [ ] Обновить `StoreSelector.tsx` — сбросить selection
- [ ] Тестирование на магазине с 1000+ отзывами
- [ ] Деплой и мониторинг производительности

---

## Связанные файлы

- `src/store/chatsStore.ts` — референс для реализации
- `src/app/stores/[storeId]/chats/page.tsx` — референс клиентской фильтрации
- `src/app/stores/[storeId]/reviews/page.tsx` — основной файл для изменения
- `src/components/reviews-v2/FilterCard.tsx` — компонент фильтров
