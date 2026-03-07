# Система фильтров чатов

**Last Updated:** 2026-03-06
**Status:** Current
**Source of Truth:** Statuses — [statuses-reference.md](./reference/statuses-reference.md), Tags — [TAG_CLASSIFICATION.md](./domains/TAG_CLASSIFICATION.md)

---

## Обзор

Система фильтров позволяет быстро находить нужные чаты:

- **Статус** в воронке: `awaiting_reply`, `inbox`, `in_progress`, `closed`
- **Последний отправитель:** клиент или продавец
- **Наличие черновика** ответа
- **Текстовый поиск**

Фильтры **глобальные** — сохраняются при переключении между магазинами.

---

## Статусы (4 статуса)

| Статус | UI-название | Описание |
|--------|------------|----------|
| `awaiting_reply` | Ожидание | Ждём ответа от клиента (дефолт для новых чатов) |
| `inbox` | Входящие | Клиент ответил, нужна реакция |
| `in_progress` | В работе | Продавец работает над чатом |
| `closed` | Закрыто | Диалог завершён (с `completion_reason`) |

**Порядок табов:** Ожидание → Входящие → В работе → Закрытые

> Статус `resolved` был удалён в migration 008.

---

## Теги (4 тега + NULL)

Теги = этапы воронки удаления отзыва (НЕ общая классификация):

| Тег | Назначение |
|-----|-----------|
| `deletion_candidate` | Кандидат на удаление |
| `deletion_offered` | Компенсация предложена |
| `deletion_agreed` | Клиент согласился удалить |
| `deletion_confirmed` | Отзыв подтверждённо удалён |
| `NULL` | Без тега (по умолчанию) |

> AI-классификация тегов отключена (migration 024). Теги устанавливаются regex-классификатором (`src/lib/tag-classifier.ts`) и вручную из TG.

---

## UI компоненты фильтров

### 1. Кнопка "Фильтры" в тулбаре

**Секция 1: "Последний написал"**
- От клиента (`lastSender = 'client'`)
- От нас (`lastSender = 'seller'`)
- Взаимоисключающие (нельзя выбрать оба)

**Секция 2: "С черновиком"**
- С черновиком (`hasDraft = true`)
- Комбинируется с другими фильтрами

### 2. Фильтр по статусам

Кнопки в тулбаре:
- Ожидание (`awaiting_reply`)
- Входящие (`inbox`)
- В работе (`in_progress`)
- Закрыто (`closed`)
- Все (`all`)

Одиночный выбор. По умолчанию: `awaiting_reply`.

### 3. Текстовый поиск

Ищет по: имени клиента, названию товара, тексту последнего сообщения.
Debounce: 300ms (Messenger), мгновенно (Kanban — client-side).

---

## Архитектура фильтрации

### State Management (Zustand)

**Файл:** `src/store/chatsStore.ts`

```typescript
interface ChatsState {
  statusFilter: ChatStatus | 'all';
  lastSender: 'all' | 'client' | 'seller';
  hasDraft: boolean;
  searchQuery: string;
}
```

### Kanban — client-side фильтрация

- Мгновенная (0ms)
- Загружает все чаты один раз
- Query key: `['all-chats', storeId]`

### Messenger/Table — API-side фильтрация

- ~500-1000ms (SQL)
- Query key включает все фильтры
- Pagination работает корректно

**API Endpoint:**
```
GET /api/stores/[storeId]/chats?status=inbox&sender=client&hasDraft=true&search=текст
```

---

## Review-linked фильтрация (TG Mini App)

В TG Mini App используется дополнительная фильтрация — **только чаты с `review_chat_links`**:

```sql
INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
```

Это сокращает ~300K+ чатов до ~700 актуальных (чаты привязанные к отзывам).

---

## См. также

- [KANBAN_QUICK_START.md](./KANBAN_QUICK_START.md) — Kanban board
- [MESSENGER_VIEW_GUIDE.md](./MESSENGER_VIEW_GUIDE.md) — Messenger view
- [TAG_CLASSIFICATION.md](./domains/TAG_CLASSIFICATION.md) — Система тегов
- [statuses-reference.md](./reference/statuses-reference.md) — Все статусы

---

**Last Updated:** 2026-03-06
