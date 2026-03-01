# TASK-010: Activity Feed — Лента событий в кабинете

> **Статус:** Draft (отложено)
> **Приоритет:** P2
> **Фаза:** Phase 4
> **Sprint:** 003
> **Зависимость:** TASK-008
> **Примечание:** Черновик. Требует отдельного планирования. Зависит от системы учёта удалений.

---

## Goal

Лента последних событий в кабинете: синхронизации, жалобы, удаления, чаты — в хронологическом порядке.

## Scope

### API
```
GET /api/stores/[storeId]/activity?limit=20&offset=0
```

Возвращает массив событий из `store_activity_log`, новые сверху.

### UI: ActivityFeedCard

```
┌─ 📅 Последние события ─────────────────────┐
│                                              │
│  ● Синхронизация отзывов завершена           │
│    Сегодня, 14:30 · +12 новых отзывов       │
│                                              │
│  ● Подано 3 жалобы                           │
│    Сегодня, 13:15 · Автоматически           │
│                                              │
│  ● 2 отзыва удалены с WB                    │
│    Сегодня, 11:40 · Жалобы одобрены         │
│                                              │
│  ● Рейтинг повышен: 2★ → 5★                │
│    Вчера, 18:45 · Чат завершён              │
│                                              │
└──────────────────────────────────────────────┘
```

### Цвета точек по типу события
- sync_completed → зелёный
- complaint_filed → синий
- complaint_approved → зелёный
- review_deleted → фиолетовый
- chat_completed → зелёный
- chat_upgraded → зелёный
- sequence_completed → жёлтый
- settings_changed → серый

### Запись событий (хуки в существующий код)

Места для вставки `INSERT INTO store_activity_log`:
- `src/cron/dialogue-sync.ts` — sync_completed, review_deleted
- `src/app/api/stores/[storeId]/complaints/route.ts` — complaint_filed
- Cron complaint status check — complaint_approved, complaint_rejected
- `src/cron/auto-sequence-processor.ts` — sequence_completed

## Estimated Effort
- ~4-5 часов (хуки + API + UI)
