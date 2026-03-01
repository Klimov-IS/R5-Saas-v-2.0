# TASK: Интеграция вызова mark-sent endpoint при подаче жалобы

**Дата:** 2026-02-08
**Приоритет:** Высокий
**Команда:** Extension Team

---

## Проблема

При подаче жалобы через расширение, endpoint для отметки жалобы как отправленной **не вызывается**:

```
POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent
```

### Последствия

1. `review_complaints.status` остаётся `draft` вместо `pending`
2. Счётчик `draftComplaintsCount` в списке магазинов показывает неверное число
3. Повторный парсинг статусов через `review-statuses` исправляет ситуацию, но с задержкой

---

## Текущий flow

```
1. Расширение получает жалобу: GET /api/extension/stores/{storeId}/complaints
2. Пользователь подаёт жалобу через WB интерфейс
3. ❌ НЕ вызывается: POST .../complaint/sent
4. При следующем парсинге: POST /api/extension/review-statuses (исправляет статус)
```

## Ожидаемый flow

```
1. Расширение получает жалобу: GET /api/extension/stores/{storeId}/complaints
2. Пользователь подаёт жалобу через WB интерфейс
3. ✅ Расширение определяет успешную подачу
4. ✅ ВЫЗЫВАЕТСЯ: POST .../complaint/sent
5. Статус сразу обновляется на 'pending'
```

---

## Задача для Extension Team

### 1. Проанализировать код подачи жалобы

- Найти место где происходит submit жалобы в WB
- Определить как расширение узнаёт об успешной подаче
- Проверить есть ли вызов `/complaint/sent` и почему он не срабатывает

### 2. Добавить проверки перед вызовом

Вызывать endpoint **ТОЛЬКО** если:

```javascript
// Псевдокод
if (complaintSubmittedSuccessfully) {
  // Проверки:
  // 1. WB показал "Жалоба отправлена" / "Проверяем жалобу"
  // 2. Форма жалобы закрылась без ошибки
  // 3. Кнопка "Пожаловаться" стала неактивной

  await fetch(`/api/extension/stores/${storeId}/reviews/${reviewId}/complaint/sent`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      wb_complaint_id: extractedId // если удалось извлечь
    })
  });
}
```

### 3. Критерии успешной подачи жалобы

Возможные индикаторы на странице WB:

| Индикатор | Селектор (примерный) |
|-----------|---------------------|
| Текст "Проверяем жалобу" | `.complaint-status`, `.review-complaint` |
| Кнопка стала disabled | `button[disabled]` |
| Появился статус в списке | `.status-badge` |
| Модалка закрылась | отсутствие `.modal-complaint` |

---

## API Reference

### Endpoint

```http
POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent
Authorization: Bearer wbrm_<token>
Content-Type: application/json

{
  "wb_complaint_id": "12345"  // опционально, ID жалобы в WB
}
```

### Response

```json
{
  "success": true,
  "message": "Complaint marked as pending (under review)",
  "review_id": "abc123",
  "new_status": "pending"
}
```

### Возможные ошибки

| Код | Причина |
|-----|---------|
| 400 | Жалоба не в статусе draft |
| 401 | Неверный токен |
| 404 | Отзыв не найден |

---

## Acceptance Criteria

- [ ] Найдена причина почему endpoint не вызывается
- [ ] Добавлена логика определения успешной подачи жалобы
- [ ] Endpoint вызывается ТОЛЬКО при реальной подаче (не при ошибках)
- [ ] Добавлено логирование для отладки
- [ ] Протестировано на 3+ жалобах

---

## Контакт

При вопросах по API — обращаться к backend команде.
