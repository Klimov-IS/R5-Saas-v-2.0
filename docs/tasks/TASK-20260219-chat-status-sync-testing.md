# Chat Status Sync — Инструкция для тестирования

**Дата:** 2026-02-19
**Статус:** Задеплоено на продакшен
**Миграция:** 017_add_chat_status_opened.sql

---

## Что сделано

Бэкенд теперь принимает и обрабатывает поле `chatStatus` при синхронизации статусов отзывов. Расширение **уже парсит** кнопку чата и **уже отправляет** `chatStatus` — бэкенд ранее его игнорировал, теперь сохраняет.

**Изменения на стороне расширения: НЕ ТРЕБУЮТСЯ.**

---

## Что парсит расширение (уже реализовано)

Файл: `src/contents/complaints/dom/data-extractor.js` → метод `getChatStatus(row)`

| Состояние кнопки | Значение от расширения | Значение в БД |
|---|---|---|
| Кнопка disabled (прозрачная) | `chat_not_activated` | `unavailable` |
| Кнопка серая (luminance >= 0.4) | `chat_available` | `available` |
| Кнопка чёрная (luminance < 0.4) | `chat_opened` | `opened` |
| Кнопка не найдена | `null` | `unknown` |

---

## API контракт

### POST /api/extension/review-statuses

Это **текущий** эндпоинт, который расширение использует при синхронизации статусов (через `StatusSyncService`).

**Request:**
```json
{
  "storeId": "7kKX9WgLvOPiXYIHk6hi",
  "parsedAt": "2026-02-19T12:00:00.000Z",
  "reviews": [
    {
      "reviewKey": "649502497_1_2026-01-07T20:09",
      "productId": "649502497",
      "rating": 1,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "statuses": ["Виден", "Выкуп"],
      "canSubmitComplaint": true,
      "chatStatus": "chat_available"
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "received": 1,
    "created": 1,
    "updated": 0,
    "errors": 0,
    "synced": 0,
    "chatStatusSynced": 1,
    "syncErrors": 0
  },
  "message": "Статусы успешно синхронизированы"
}
```

Новое поле в ответе: **`chatStatusSynced`** — количество отзывов, у которых был обновлён `chat_status_by_review` в таблице `reviews`.

---

## Как данные попадают в систему

```
Расширение парсит кнопку чата (DataExtractor.getChatStatus)
    ↓
StatusSyncService._formatReviewForAPI() — добавляет chatStatus
    ↓
POST /api/extension/review-statuses
    ↓
Бэкенд:
  1. Сохраняет chatStatus в таблицу review_statuses_from_extension
  2. Маппит chatStatus → chat_status_by_review (ENUM в PostgreSQL)
  3. Обновляет таблицу reviews (SET chat_status_by_review = ...)
    ↓
UI: Вкладка "Отзывы" → фильтр "Статус чата"
```

---

## Тестирование

### Шаг 1: Проверить что расширение парсит чат-статус

1. Открыть WB seller cabinet → Отзывы → любой товар
2. Открыть DevTools (F12) → Console
3. Выполнить:
```js
// Найти строки отзывов
const rows = document.querySelectorAll('tr, [class*="Row"]');
rows.forEach((row, i) => {
  const status = window.DataExtractor?.getChatStatus(row);
  if (status) console.log(`Row ${i}: chatStatus = ${status}`);
});
```
4. Должны увидеть значения: `chat_not_activated`, `chat_available`, или `chat_opened`

### Шаг 2: Проверить что расширение отправляет chatStatus

1. Открыть DevTools → Network
2. Запустить диагностику жалоб (обычный workflow расширения)
3. Найти POST-запрос на `/api/extension/review-statuses`
4. В Request Body проверить что у отзывов есть поле `chatStatus`

**Пример из Network:**
```json
{
  "reviewKey": "187489568_2_2026-02-10T08:15",
  "productId": "187489568",
  "rating": 2,
  "reviewDate": "2026-02-10T08:15:00.000Z",
  "statuses": ["Виден"],
  "canSubmitComplaint": true,
  "chatStatus": "chat_available"   // ← это поле
}
```

### Шаг 3: Проверить ответ бэкенда

В Response Body должно быть поле `chatStatusSynced` > 0:
```json
{
  "success": true,
  "data": {
    "received": 25,
    "created": 0,
    "updated": 25,
    "errors": 0,
    "synced": 3,
    "chatStatusSynced": 18,
    "syncErrors": 0
  }
}
```

### Шаг 4: Проверить в UI

1. Открыть https://rating5.ru/stores/{storeId}/reviews
2. В панели фильтров найти дропдаун **"Статус чата"**
3. Выбрать "Доступен" или "Открыт"
4. Убедиться, что отзывы фильтруются корректно

### Шаг 5: Проверить через GET API (опционально)

```
GET /api/extension/review-statuses?storeId={storeId}&limit=10
Authorization: Bearer {token}
```

В ответе у каждого отзыва должно быть поле `chatStatus`:
```json
{
  "reviewKey": "649502497_1_2026-01-07T20:09",
  "chatStatus": "chat_available",
  ...
}
```

---

## Возможные проблемы

| Проблема | Причина | Решение |
|---|---|---|
| `chatStatus: null` в запросе | Кнопка чата не найдена на странице | Проверить `ElementFinder.findChatButton(row)` — может быть изменился DOM WB |
| `chatStatusSynced: 0` в ответе | Отзывы из расширения не матчатся с reviews в БД | Матчинг по `store_id + product_id + rating + DATE_TRUNC('minute', date)` — проверить что отзыв существует в базе |
| Фильтр "Статус чата" пустой | Статусы ещё не синхронизированы | Запустить диагностику расширения хотя бы раз для загрузки данных |
| Все отзывы показывают "Неизвестно" | Расширение не передаёт chatStatus или передаёт null | Проверить версию расширения — `getChatStatus` добавлен в data-extractor.js |

---

## Что дальше (Фаза 2)

После успешного тестирования синхронизации статусов чата переходим к:
- Открытие чатов из расширения
- Передача содержимого чатов
- Интеграция с существующими Chat API endpoints (Sprint 002)
