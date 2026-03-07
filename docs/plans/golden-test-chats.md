# Golden Test Chats — Refactoring Regression Baseline

> **Дата создания:** 2026-03-05
> **Назначение:** Три реальных чата для smoke-тестирования каждого PR рефакторинга.
> **Как использовать:** После каждого PR-деплоя — открыть каждый golden chat в TMA, выполнить smoke checklist, сравнить результат с baseline.

---

## Инструкция

Перед первым PR нужно зафиксировать snapshot каждого чата:

### Для каждого golden chat выполнить:

1. **GET /api/telegram/chats/{chatId}** → сохранить JSON response
2. **POST /api/telegram/chats/{chatId}/generate-ai** → сохранить `draftReply` текст
3. Записать chat_id, store_id, marketplace, review_rating

### Как выбрать golden chats:

```sql
-- GOLDEN-WB-LOW: WB chat with 1-3★ review, offer_compensation=true
SELECT c.id, c.store_id, rcl.review_rating, pr.offer_compensation
FROM chats c
JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
LEFT JOIN products p ON p.store_id = c.store_id AND c.product_nm_id = p.wb_product_id
LEFT JOIN product_rules pr ON p.id = pr.product_id
WHERE c.marketplace = 'wb'
  AND rcl.review_rating <= 3
  AND pr.offer_compensation = true
  AND c.status != 'closed'
ORDER BY c.last_message_date DESC
LIMIT 1;

-- GOLDEN-WB-HIGH: WB chat with 4-5★ review
SELECT c.id, c.store_id, rcl.review_rating
FROM chats c
JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
WHERE c.marketplace = 'wb'
  AND rcl.review_rating >= 4
  AND c.status != 'closed'
ORDER BY c.last_message_date DESC
LIMIT 1;

-- GOLDEN-OZON: OZON chat with review
SELECT c.id, c.store_id, rcl.review_rating
FROM chats c
JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
WHERE c.marketplace = 'ozon'
  AND c.status != 'closed'
ORDER BY c.last_message_date DESC
LIMIT 1;
```

---

## Golden Chats (зафиксировано 2026-03-05)

### GOLDEN-WB-LOW

| Поле | Значение |
|------|---------|
| chat_id | `1:2cb0bcc9-44b1-c762-26e6-492683265dc3` |
| store_id | `4C61MCXAgWBQkg7VUVjR` |
| store_name | ИП Петрова Г. И. |
| marketplace | wb |
| review_rating | 1 |
| offer_compensation | true |
| max_compensation | 400 |
| compensation_type | cashback |
| complaint_status | rejected |
| review_text | "Сушит кожу очень сильно" |

**GET response snapshot:**
```json
{
  "id": "1:2cb0bcc9-44b1-c762-26e6-492683265dc3",
  "storeId": "4C61MCXAgWBQkg7VUVjR",
  "storeName": "ИП Петрова Г. И.",
  "marketplace": "wb",
  "clientName": "Ирина",
  "productNmId": "277863109",
  "status": "awaiting_reply",
  "tag": "active",
  "reviewRating": 1,
  "reviewDate": "2026-01-30T16:50:00.000Z",
  "complaintStatus": "rejected",
  "offerCompensation": true,
  "maxCompensation": "400",
  "compensationType": "cashback",
  "chatStrategy": "both"
}
```
**AI draft snapshot:** _TODO — выполнить после деплоя_
**Ожидания:** Draft ДОЛЖЕН содержать упоминание компенсации/кешбека/возврата (1★, offer_compensation=true)

---

### GOLDEN-WB-HIGH

| Поле | Значение |
|------|---------|
| chat_id | `1:53bf4726-863e-829d-6207-db6cb85b4561` |
| store_id | `ihMDtYWEY7IXkR3Lm9Pq` |
| store_name | ИП Адамян В. А. |
| marketplace | wb |
| review_rating | 4 |
| offer_compensation | true |
| max_compensation | 300 |
| complaint_status | not_sent |

**GET response snapshot:**
```json
{
  "id": "1:53bf4726-863e-829d-6207-db6cb85b4561",
  "storeId": "ihMDtYWEY7IXkR3Lm9Pq",
  "storeName": "ИП Адамян В. А.",
  "marketplace": "wb",
  "clientName": "Александр",
  "productNmId": "88138483",
  "status": "awaiting_reply",
  "tag": "active",
  "reviewRating": 4,
  "reviewDate": "2024-10-30T08:09:00.000Z",
  "complaintStatus": "not_sent",
  "offerCompensation": true,
  "maxCompensation": "300",
  "compensationType": "cashback",
  "chatStrategy": "both"
}
```
**AI draft snapshot:** _TODO — выполнить после деплоя_
**Ожидания:** Draft НЕ ДОЛЖЕН содержать компенсации; "повышение до 5★" (4★ gating)

---

### GOLDEN-OZON

| Поле | Значение |
|------|---------|
| chat_id | `5e069693-790b-4e4f-b36e-6715d948a605` |
| store_id | `w9TV4UwO5RytEnWC8Zok` |
| store_name | Тайди-Сити |
| marketplace | ozon |
| review_rating | null (нет review_chat_links для OZON) |
| offer_compensation | null |

**GET response snapshot:**
```json
{
  "id": "5e069693-790b-4e4f-b36e-6715d948a605",
  "storeId": "w9TV4UwO5RytEnWC8Zok",
  "storeName": "Тайди-Сити",
  "marketplace": "ozon",
  "clientName": "Покупатель",
  "productNmId": null,
  "status": "in_progress",
  "tag": "active",
  "reviewRating": null,
  "complaintStatus": null,
  "offerCompensation": null
}
```
**AI draft snapshot:** _TODO — выполнить после деплоя_
**Ожидания:** Draft ≤ 1000 символов; обрезан по границе предложения. Без review_chat_links — draft может быть общим

---

## Smoke Checklist Template

Копировать и заполнять для каждого PR:

```
### PR-XX Smoke Test — [дата]

□ GOLDEN-WB-LOW: GET chat detail — все поля совпадают с baseline
□ GOLDEN-WB-LOW: generate-ai — draft содержит компенсацию
□ GOLDEN-WB-HIGH: GET chat detail — все поля совпадают
□ GOLDEN-WB-HIGH: generate-ai — draft БЕЗ компенсации
□ GOLDEN-OZON: GET chat detail — OZON-specific поля
□ GOLDEN-OZON: generate-ai — draft ≤ 1000 символов
□ Queue: /tg → очередь загружается
□ Send: отправить сообщение → "Отправлено"
□ Sequence: запустить → "1-е сообщение отправлено"
□ Status: сменить статус → UI обновился
```
