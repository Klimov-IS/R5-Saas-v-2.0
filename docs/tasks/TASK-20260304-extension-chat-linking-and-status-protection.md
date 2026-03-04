# TASK-20260304: Привязка чатов расширением + защита статусов

**Дата:** 2026-03-04
**Приоритет:** P1
**Статус:** Open
**Назначение:** Задачи для Chrome Extension

---

## Goal

1. Расширение должно привязывать ВСЕ открытые чаты к отзывам через `review_chat_links`
2. Статус `opened` у `chat_status_by_review` должен быть необратимым (защита от WB UI глитчей)

---

## Проблема 1: 291 чат без привязки к отзыву

### Текущее состояние
- В системе 291 чат со статусом "Чат с покупателем по товару..." (системное сообщение)
- У них НЕТ записи в `review_chat_links`
- Это означает: чаты были открыты вручную на WB, НЕ через расширение R5
- Без `review_chat_links`: чаты не попадают в TG очередь, рассылка не может быть запущена

### Причина
Расширение вызывает `POST /api/extension/chat/opened` только когда **само** открывает чат. Если менеджер открыл чат вручную через WB dashboard — расширение не знает об этом.

### Задача расширению: Ретроактивная привязка открытых чатов

**При парсинге страницы отзывов расширение уже видит статус кнопки чата:**
- `chat_not_activated` → чат недоступен
- `chat_available` → чат можно открыть
- `chat_opened` → чат уже открыт

**Требование:** Когда расширение обнаруживает `chat_opened`:

1. Проверить, есть ли уже `review_chat_links` запись для этого отзыва
   - API: `GET /api/extension/chat/check?storeId=X&reviewKey=Y` (нужен новый endpoint)
   - Или: проверять локально, если расширение кеширует
2. Если записи НЕТ — вызвать `POST /api/extension/chat/opened` с контекстом отзыва:
   ```json
   {
     "storeId": "...",
     "reviewContext": {
       "nmId": "...",
       "rating": 3,
       "reviewDate": "2026-01-15T10:30:00Z",
       "reviewKey": "12345_3_2026-01-15T10:30"
     },
     "chatUrl": "https://seller.wildberries.ru/feedback-and-questions/chat?chatId=...",
     "openedAt": "2026-03-04T12:00:00Z"
   }
   ```
3. Backend создаст `review_chat_links` запись → чат попадёт в TG очередь

### Откуда взять данные
- `nmId` — из карточки отзыва на странице
- `rating` — из карточки отзыва (звёзды)
- `reviewDate` — из карточки отзыва (дата публикации)
- `chatUrl` — из атрибута кнопки "Открыть чат" (href или data-атрибут)
- `reviewKey` — формат `{nmId}_{rating}_{dateTruncMin}`

### Важно
- Расширение уже парсит всё это для `review-statuses` endpoint
- Дополнительный парсинг НЕ НУЖЕН — данные уже есть
- Нужна только **логика**: "если `chat_opened` и нет привязки → создать"

---

## Проблема 2: Защита статуса `opened`

### Текущее состояние
WB иногда не прогружает кнопку чата. Расширение видит отсутствие кнопки → отправляет `chat_not_activated` → бэкенд записывает `unavailable`.

### Текущая защита (уже реализована)
Файл: `src/app/api/extension/review-statuses/route.ts`, строки 367-369:

```sql
AND (chat_status_by_review IS NULL
  OR chat_status_by_review != 'opened'
  OR $1::chat_status_by_review = 'opened')
```

**Матрица переходов:**

| Текущий статус | Новый статус | Результат |
|---------------|-------------|-----------|
| `NULL` / `unknown` | любой | ✅ Разрешено |
| `unavailable` | `available` | ✅ Разрешено |
| `available` | `unavailable` | ✅ Разрешено |
| `opened` | `unavailable` | ❌ **ЗАБЛОКИРОВАНО** |
| `opened` | `available` | ❌ **ЗАБЛОКИРОВАНО** |
| `opened` | `opened` | ✅ No-op |

### Правило (для документации)
> **`opened` — необратимый статус.** Если чат хотя бы раз был открыт, статус остаётся `opened` навсегда. Ни расширение, ни API, ни cron не могут понизить его.
>
> **`available` ↔ `unavailable` — обратимые.** Могут меняться свободно (WB может включать/выключать доступ к чату).

### Задача расширению: Не отправлять chat_status, если не уверен
- Если кнопка чата не найдена на странице (DOM не прогрузился) — отправлять `null` (не `chat_not_activated`)
- `chat_not_activated` отправлять ТОЛЬКО если расширение **точно** видит неактивную кнопку (серая, disabled)
- Это снизит количество ложных `unavailable` обновлений

---

## Требуемые изменения на бэкенде

### Новый endpoint (опционально): проверка привязки

```
GET /api/extension/chat/check-link?storeId=X&reviewKey=Y
```

**Response:**
```json
{
  "linked": true,
  "linkId": "uuid",
  "chatId": "1:uuid",
  "status": "message_sent"
}
// или
{
  "linked": false
}
```

**Альтернатива:** расширение может использовать существующий `POST /api/extension/chat/opened` — он идемпотентен (UNIQUE на store_id + review_key), вернёт 200 если запись уже есть.

---

## Impact

| Область | Изменения |
|---------|-----------|
| DB | Нет миграций |
| API | Опционально: новый GET endpoint для проверки привязки |
| Cron | Нет |
| AI | Нет |
| UI | Нет |
| Extension | Новая логика: при парсинге `chat_opened` → вызов `chat/opened` |

---

## Required Docs Updates

- [x] `docs/reference/statuses-reference.md` — добавить `opened` в ENUM, матрицу переходов
- [x] `docs/domains/wb-work-policy.md` — добавить правила привязки чатов
- [x] `docs/reference/EXTENSION_API_COMPLETE.md` — описать новую задачу

---

## Rollout Plan

1. **Бэкенд:** Защита уже реализована, изменений не требуется
2. **Расширение v2.x:** Добавить логику ретроактивной привязки
3. **Мониторинг:** После деплоя расширения — проверить через SQL:
   ```sql
   -- Сколько чатов без привязки осталось
   SELECT COUNT(*) FROM chats c
   LEFT JOIN review_chat_links rcl ON rcl.chat_id = c.id
   WHERE rcl.id IS NULL AND c.status != 'closed'
   AND c.marketplace = 'wb';
   ```

---

## Backout Plan

- Защита статусов — уже в проде, откат не нужен
- Ретроактивная привязка — расширение может откатить версию, записи в `review_chat_links` останутся (не вредят)
