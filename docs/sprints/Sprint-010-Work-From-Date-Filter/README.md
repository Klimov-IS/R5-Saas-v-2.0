# Sprint 010 — work_from_date Filter for Extension Tasks

**Дата:** 2026-03-14
**Статус:** Done
**Предыдущий:** Sprint 009 (4-Star Chat Optimization)

---

## Цель

Исключить старые отзывы из задач расширения. Два уровня фильтрации:

1. **Глобальный cutoff WB:** `2023-10-01` — отзывы до этой даты не влияют на рейтинг, жалобы и чаты технически невозможны
2. **Per-product дата:** `product_rules.work_from_date` — дата, с которой кабинет берёт отзывы в работу

До этого фикса расширение получало задачи `statusParses` на **все** отзывы с неизвестным chat_status, включая отзывы 2020-2022 годов — полностью бесполезная работа.

## Изменения

### 1. Query A (statusParses) в tasks/route.ts

Добавлено: `AND r.date >= COALESCE(pr.work_from_date, '2023-10-01')`

### 2. Query E (status_parses_total) в tasks/route.ts

Добавлено: `AND r.date >= COALESCE(pr.work_from_date, '2023-10-01')`

### 3. Q2 (statusParses) в stores/route.ts

Добавлено: `AND r.date >= COALESCE(pr.work_from_date, '2023-10-01')`

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/app/api/extension/stores/[storeId]/tasks/route.ts` | Query A + Query E: date filter |
| `src/app/api/extension/stores/route.ts` | Q2: date filter |

## Не затронуты (защищены транзитивно)

- **Query B (chatOpens):** требует `rc.status = 'rejected'` — жалобы на старые отзывы не создаются
- **Query C (chatLinks):** требует `chat_status_by_review = 'opened'` — чаты по старым отзывам не открываются
- **Query D (complaints):** требует `rc.status = 'draft'` — черновики для старых отзывов не создаются
