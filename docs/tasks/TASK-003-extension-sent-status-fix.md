# TASK-003: Исправление синхронизации статуса отправки жалобы

**Статус:** Реализовано (Backend)
**Дата:** 2026-02-03
**Требуется:** Пересборка расширения

---

## Проблема

При нажатии кнопки "Отправить" в расширении:
1. Жалоба отправлялась на WB
2. **НО** статус не передавался в backend (0 записей со статусом `sent`/`pending` в БД)

### Причина
Расширение вызывало **несуществующий URL**:
```
/api/stores/{storeId}/reviews/{reviewId}/complaint/sent  ❌ НЕ СУЩЕСТВУЕТ
```

Правильный URL:
```
/api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent  ✅
```

---

## Решение

### Изменения в Backend (уже задеплоено)

1. **Унификация статусов:** `sent` → `pending`
   - Статус `sent` удалён
   - При отправке жалобы сразу ставится `pending` (на рассмотрении)
   - Это соответствует WB: после отправки сразу показывается "Проверяем жалобу"

2. **Обновлённые типы:**
```typescript
// src/types/complaints.ts
export type ComplaintStatus =
  | 'draft'        // Черновик
  | 'pending'      // На рассмотрении WB ("Проверяем жалобу")
  | 'approved'     // WB одобрил
  | 'rejected'     // WB отклонил
  | 'reconsidered' // WB пересмотрел
```

3. **API endpoint обновлён:**
   - Endpoint: `POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent`
   - Теперь возвращает `new_status: 'pending'` вместо `'sent'`

---

## Изменения в расширении (требуется пересборка)

### Файл: `src/api/pilot-api.js`

**Строка 191-192:**

```javascript
// БЫЛО:
const url = `${this.baseURL}/api/stores/${targetStoreId}/reviews/${reviewId}/complaint/sent`;

// СТАЛО:
const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/reviews/${reviewId}/complaint/sent`;
```

**Полный контекст (строки 186-192):**
```javascript
async markComplaintAsSent(storeId, reviewId, metadata = {}) {
  await this.initialize();

  // Если storeId не указан, используем текущий
  const targetStoreId = storeId || this.storeId;
  // ВАЖНО: Используем /api/extension/... endpoint (исправлено 2026-02-03)
  const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/reviews/${reviewId}/complaint/sent`;
```

---

## Тестирование

### После пересборки расширения:

1. **Подать жалобу через расширение**
2. **Проверить в консоли браузера:**
   - Должен быть запрос к `/api/extension/stores/.../complaint/sent`
   - Ответ должен содержать `new_status: 'pending'`

3. **Проверить в БД:**
```sql
SELECT complaint_status, COUNT(*)
FROM reviews
WHERE store_id = 'BhWUBJfOFTozPN1EkFml'
GROUP BY complaint_status;
```

Должны появиться записи со статусом `pending`.

---

## API Reference

### POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent

**Headers:**
```
Authorization: Bearer wbrm_<token>
Content-Type: application/json
```

**Body (optional):**
```json
{
  "wb_complaint_id": "12345",
  "sent_at": "2026-02-03T12:00:00.000Z"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Complaint marked as pending (under review)",
  "review_id": "abc123",
  "new_status": "pending",
  "sent_at": "2026-02-03T12:00:00.000Z"
}
```

**Response 400 (не в статусе draft):**
```json
{
  "error": "Bad request",
  "message": "Complaint is not in draft status (current: pending)"
}
```

---

## Связанные коммиты

**Backend:**
- `553fabf` - refactor: Remove 'sent' status, use 'pending' directly

**Файлы изменены:**
- `src/types/complaints.ts` - типы и лейблы
- `src/db/complaint-helpers.ts` - markComplaintAsSent()
- `src/app/api/extension/stores/[storeId]/reviews/[reviewId]/complaint/sent/route.ts` - endpoint
- `src/components/reviews-v2/FilterCard.tsx` - UI фильтры

---

## Checklist для разработчиков расширения

- [ ] Изменить URL в `pilot-api.js:191` на `/api/extension/stores/...`
- [ ] Пересобрать расширение: `npm run build`
- [ ] Установить новую версию в Chrome
- [ ] Протестировать отправку жалобы
- [ ] Проверить что статус `pending` появляется в БД
