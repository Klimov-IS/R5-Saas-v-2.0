# TASK-20260218: Редизайн дашборда KPI

## Goal

Переработать дизайн KPI-карточек на главной странице — сделать их выше, информативнее, с несколькими метриками на каждую сущность.

## Current State

Сейчас 4 карточки с одной основной метрикой + subtitle:
- Активных клиентов (51) — +21 за месяц
- Товаров в работе (5 701) — 37% от всех
- Отзывы 1-3 в работе (29 087) — 94% обработано
- На удаление (3 311) — из 11 537 наших

SQL уже использует `product_rules` для корректного подсчёта (коммит `40ed450`).

## Prototype

**HTML-прототип:** [prototype-dashboard.html](../../prototype-dashboard.html)

## Proposed Change

Заменить текущие `InteractiveKPICard` на новые высокие карточки с:

### Карточка 1 — Клиенты
- **Main:** 51 активных
- **Badge:** +21 за февраль
- **Sub-метрики:** WB / OZON / На паузе

### Карточка 2 — Товары
- **Main:** 5 701 в работе
- **Badge:** 37% от всех
- **Sub-метрики:** Жалобы включены / Чаты включены / Всего товаров

### Карточка 3 — Отзывы
- **Main:** 29 087 в работе (1-3)
- **Badge:** 94% обработано
- **Sub-метрики:** Жалоб подано / Одобрено WB / Черновики + progress bar

### Карточка 4 — Диалоги
- **Main:** 3 311 на удаление
- **Badge:** 11 537 наших
- **Sub-метрики:** Кандидаты / Запрос возврата / Согласились-Удалили

## Impact

### DB
- Расширить `getDashboardStats()` — добавить CTE для:
  - Stores: GROUP BY marketplace, COUNT paused
  - Products: COUNT submit_complaints / work_in_chats отдельно
  - Reviews: complaint approval rate, draft count
  - Chats: deletion funnel breakdown (уже есть)

### API
- `GET /api/dashboard/stats` — расширить ответ новыми полями

### UI
- Новый компонент `DashboardKPICard` (или расширить `InteractiveKPICard`)
- Обновить `page.tsx` — новый layout карточек
- Sync-кнопки сохранить

### Cron / AI
- Не затрагивается

## Required Docs Updates
- `docs/reference/api.md` — обновить описание `/api/dashboard/stats`

## Rollout Plan
1. Расширить SQL-запрос + API ответ
2. Создать новый компонент карточки
3. Обновить page.tsx
4. Деплой

## Backout Plan
- Откат к текущим `InteractiveKPICard` — один коммит revert

## Status
- [ ] Прототип согласован
- [ ] SQL расширен
- [ ] Компонент создан
- [ ] Задеплоено
