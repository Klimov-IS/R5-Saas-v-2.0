# TASK-002: Cabinet UI — Frontend таб

> **Статус:** Planning
> **Приоритет:** P0
> **Фаза:** Phase 1 (MVP)
> **Sprint:** 003
> **Зависимость:** TASK-001 (API)

---

## Goal

Создать страницу `stores/[storeId]/cabinet/page.tsx` и добавить таб "Кабинет" первым в навигации. Отображает данные из `GET /api/stores/[storeId]/cabinet`.

## Current State

- 4 таба: Товары, Отзывы, Чаты, AI
- Навигация в `stores/[storeId]/layout.tsx`
- Прототип: `docs/sprints/sprint-003-cabinet-dashboard/prototype-cabinet-tab.html`

## Proposed Change

### 1. Добавить таб в layout.tsx

```typescript
// stores/[storeId]/layout.tsx — tabs array
const tabs = [
  { href: `/stores/${storeId}/cabinet`, label: 'Кабинет', icon: Briefcase },  // NEW
  { href: `/stores/${storeId}/products`, label: 'Товары', icon: Package },
  { href: `/stores/${storeId}/reviews`, label: 'Отзывы', icon: Star },
  { href: `/stores/${storeId}/chats`, label: 'Чаты', icon: MessageSquare },
  { href: `/stores/${storeId}/ai`, label: 'AI', icon: Sparkles },
];
```

### 2. Редирект по умолчанию

`stores/[storeId]/page.tsx` — изменить redirect с `/products` на `/cabinet`

### 3. Новая страница: `stores/[storeId]/cabinet/page.tsx`

**Структура компонента:**

```
CabinetPage
├── StoreIdentityCard        — имя, статус, синхронизации
├── KPIRow (4 карточки)      — товары, отзывы, чаты, жалобы
├── TwoColumns
│   ├── ComplaintsSection     — поданые/одобренные/отклонённые + удалённые
│   └── ChatStatusSection    — Phase 2 placeholder + авто-цепочки
├── TwoColumns
│   ├── ReviewRulesSection   — правила из product_rules
│   └── RatingBreakdown      — бары 1-5★
├── TwoColumns
│   ├── AIConfigSummary      — инструкции, FAQ, гайды, расходы
│   └── TelegramSection      — статус, уведомления, очередь
└── PlaceholderSections       — Google Drive, Реквизиты, Биллинг (Phase 2-3)
```

### 4. Секции Phase 1 (полная реализация)

**StoreIdentityCard:**
- Аватар (градиент, первые буквы)
- Имя + marketplace badge
- Статус (active/paused/stopped) — badge с цветом
- Дата подключения
- Статус синхронизаций (3 строки: товары/отзывы/чаты)

**KPIRow:**
- 4 карточки в grid, стиль как InteractiveKPICard на главной
- Товары (total / active), Отзывы 1-3★ (из total), Чаты (total / active по tag_counts), Жалобы (filed + % approved)

**ComplaintsSection:**
- 3 больших числа: подано / одобрено / отклонено
- Progress bar: % одобрения
- Отдельный блок: "Удалено с WB" — крупное число

**RatingBreakdown:**
- 5 горизонтальных баров (1-5★)
- Под ними 3 мини-карточки: всего / негативных / средний рейтинг

**ReviewRulesSection:**
- Список правил в виде иконка + текст
- Данные агрегированы из product_rules

**AIConfigSummary:**
- Список карточек: инструкции (длина + preview), FAQ (count), гайды (count), модель, расходы
- Ссылка "Настроить →" ведёт на таб AI

**TelegramSection:**
- Подключён / уведомления вкл / последнее уведомление / очередь

### 5. Placeholder-секции (Phase 2-3)

Секции с dashed border и текстом "Будет доступно в следующем обновлении":
- Статус работы чатов (Phase 2)
- Google Drive ссылки (Phase 2)
- Реквизиты компании (Phase 2)
- Заметки (Phase 2)
- Стоимость услуг (Phase 3)
- Лента событий (Phase 4)

### 6. Prefetch в layout.tsx

Добавить prefetch cabinet данных наравне с products/reviews/chats/ai.

## Impact

### DB
- Нет изменений

### API
- Потребляет TASK-001 endpoint

### Cron
- Нет

### AI
- Нет

### UI
- Новая страница: `src/app/stores/[storeId]/cabinet/page.tsx`
- Изменение: `src/app/stores/[storeId]/layout.tsx` (таб + prefetch)
- Изменение: `src/app/stores/[storeId]/page.tsx` (redirect)

## Required Docs Updates
- `docs/reference/ARCHITECTURE.md` — добавить cabinet page

## Rollout Plan
1. Добавить таб в layout.tsx
2. Изменить redirect в page.tsx
3. Создать cabinet/page.tsx с Phase 1 секциями
4. Добавить placeholder секции Phase 2-4
5. Добавить prefetch
6. Тест: открыть 3 магазина, проверить все метрики
7. Deploy

## Backout Plan
- Удалить cabinet/ папку
- Убрать таб из layout.tsx
- Вернуть redirect на /products

## Estimated Effort
- ~4-5 часов (UI + стилизация по прототипу)
