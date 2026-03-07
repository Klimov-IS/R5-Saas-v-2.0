# TASK: Расширение не передаёт chatId в URL при открытии чата

**Дата:** 2026-03-06
**Приоритет:** HIGH
**Статус:** Open

---

## Проблема

При нажатии "Написать покупателю" расширение вызывает `POST /api/extension/chat/opened` с полем `chatUrl`.

**Ожидание:**
```
https://seller.wildberries.ru/chat-with-clients?chatId=357021de-916e-764e-182c-05dd0a1fddf2
```

**Реальность (79 случаев):**
```
https://seller.wildberries.ru/chat-with-clients
```

URL берётся **до** того, как WB загрузит конкретный чат и обновит адресную строку параметром `?chatId=`.

---

## Последствия

1. Сервер не может извлечь `chatId` из URL → создаётся `review_chat_link` с `chat_id = NULL`
2. Dialogue sync не может сопоставить ссылку с чатом (нет UUID для матчинга)
3. Чат **не виден** в TG Mini App (фильтр `INNER JOIN review_chat_links` требует `chat_id IS NOT NULL`)
4. Менеджер открыл чат, написал покупателю, но в TG этот чат не появился

---

## Масштаб

| Метрика | Значение |
|---------|----------|
| Всего review_chat_links | 2 895 |
| Работают нормально (chat_id != NULL) | 2 816 (97.3%) |
| **Битые (chat_id = NULL)** | **79 (2.7%)** |
| Затронуто магазинов | 6 |

### Затронутые магазины

| Магазин | Битых ссылок |
|---------|-------------|
| ИП Тургунов Ф. Ф. | 57 |
| ИП Васильев М. Н. | 7 |
| ИП Авакова Л. П. | 6 |
| ИП Петрова Г. И. | 4 |
| ИП Воинов | 4 |
| ИП Бойко Р. В. (MS) | 1 |

Все 79 записей имеют `status = 'anchor_not_found'`.

---

## Что нужно исправить в расширении

### Требование

Расширение должно передавать `chatUrl` с параметром `?chatId=UUID`. Это значит:

1. **Дождаться** загрузки чата на странице WB (URL обновится)
2. **Перечитать** `window.location.href` после загрузки чата
3. Передать обновлённый URL в API

### Варианты реализации

**Вариант A — Polling URL:**
После клика "Написать покупателю" → poll `window.location.href` каждые 500ms до появления `chatId=` в URL (timeout 10 сек).

**Вариант B — MutationObserver:**
Слушать изменение URL через `popstate` / `hashchange` / History API.

**Вариант C — Извлечь chatId из DOM:**
WB может рендерить chatId в DOM-элементе чата. Найти и передать отдельным полем.

### Валидация

Перед отправкой на сервер проверить:
```javascript
if (!chatUrl.includes('chatId=') && !chatUrl.includes('/chats/')) {
  // URL не содержит chatId — дождаться или показать ошибку
  console.warn('chatUrl does not contain chatId, retrying...');
}
```

---

## Серверный API (без изменений)

API `POST /api/extension/chat/opened` уже корректно обрабатывает URL с `chatId`:
- `extractChatIdFromUrl(chatUrl)` — парсит UUID из `?chatId=` или `/chats/`
- `createReviewChatLink({..., chat_id})` — сохраняет в БД
- `reconcileChatWithLink()` — dialogue sync дополняет формат `1:UUID`

**Серверная сторона менять не нужно.**

---

## Cleanup (серверная сторона — R5 команда)

После фикса расширения, R5 команда удалит 79 битых записей:
```sql
DELETE FROM review_chat_links
WHERE chat_id IS NULL
  AND chat_url NOT LIKE '%chatId=%'
  AND chat_url NOT LIKE '%/chats/%';
```

Эти отзывы попадут заново в задачи через API, и расширение пересоздаст связки с корректным URL.
