# Unified Tasks Endpoint — Документация для расширения

**Дата:** 2026-02-19
**Эндпоинт:** `GET /api/extension/stores/{storeId}/tasks`
**Авторизация:** `Authorization: Bearer wbrm_<token>`

---

## Что это

Единый эндпоинт, который возвращает **ВСЕ задачи** для магазина, сгруппированные по артикулу (nmId). Бекенд — мозг, расширение — исполнитель.

---

## 4 типа задач

### 1. `statusParses` — Парсинг статусов отзывов

**Что:** Отзывы, по которым мы НЕ знаем текущие статусы (чат, жалоба, статус отзыва).
**Критерий:** `chat_status_by_review IS NULL` или `unknown` + товар с активными правилами.
**Действие расширения:** Посмотреть на отзыв → спарсить все статусы → отправить через `POST /api/extension/review-statuses`.
**Лимит:** 500 отзывов.

### 2. `chatOpens` — Открытие новых чатов

**Что:** Отзывы, по которым жалоба ОТКЛОНЕНА WB + чат ДОСТУПЕН + чат ещё не открыт.
**Критерий:** `complaint_status = 'rejected'` + `chat_status = 'available'` + нет записи в `review_chat_links`.
**Действие расширения:** Кликнуть "Чат" → получить URL → отправить через `POST /api/extension/chat/opened`.
**Лимит:** 200 отзывов.

### 3. `chatLinks` — Привязка уже открытых чатов

**Что:** Чат уже ОТКРЫТ (продавцом или ранее), но НЕ связан с отзывом в нашей БД.
**Критерий:** `chat_status = 'opened'` + нет записи в `review_chat_links`.
**Действие расширения:** То же что chatOpens — кликнуть "Чат" → получить URL → отправить через `POST /api/extension/chat/opened`.
**Лимит:** 200 отзывов.

### 4. `complaints` — Подача жалоб

**Что:** Отзывы с готовыми AI-жалобами (draft).
**Критерий:** `review_complaints.status = 'draft'` + `complaint_status IN ('not_sent', 'draft')`.
**Действие расширения:** Подать жалобу с текстом из `complaintText`.
**Лимит:** 500 отзывов.

---

## Формат ответа

```json
{
  "storeId": "abc123",
  "articles": {
    "12345678": {
      "nmId": "12345678",
      "statusParses": [
        {
          "reviewId": "abc123_12345678_xxx",
          "rating": 2,
          "date": "2026-01-15T10:30:00.000Z",
          "authorName": "Иванов",
          "text": "Текст отзыва...",
          "currentComplaintStatus": null,
          "currentChatStatus": null,
          "currentReviewStatus": "published"
        }
      ],
      "chatOpens": [
        {
          "reviewId": "abc123_12345678_yyy",
          "rating": 1,
          "date": "2026-01-10T08:00:00.000Z",
          "authorName": "Петров",
          "text": "Текст отзыва..."
        }
      ],
      "chatLinks": [
        {
          "reviewId": "abc123_12345678_zzz",
          "rating": 3,
          "date": "2026-01-12T14:00:00.000Z",
          "authorName": "Сидоров",
          "text": "Текст отзыва..."
        }
      ],
      "complaints": [
        {
          "reviewId": "abc123_12345678_www",
          "rating": 1,
          "text": "Текст отзыва...",
          "authorName": "Козлов",
          "createdAt": "2026-01-08T09:00:00.000Z",
          "complaintText": {
            "reasonId": 3,
            "reasonName": "Оскорбление",
            "complaintText": "Текст жалобы..."
          }
        }
      ]
    }
  },
  "totals": {
    "statusParses": 150,
    "chatOpens": 12,
    "chatLinks": 5,
    "complaints": 32,
    "articles": 8
  },
  "limits": {
    "maxChatsPerRun": 50,
    "cooldownBetweenChatsMs": 3000
  }
}
```

---

## Рекомендуемый порядок выполнения

1. **statusParses** — сначала узнаём статусы (пассивный парсинг)
2. **chatLinks** — привязываем уже открытые чаты (быстрые победы)
3. **chatOpens** — открываем новые чаты
4. **complaints** — подаём жалобы

---

## Связанные эндпоинты (для отчётности)

| Действие | Эндпоинт |
|----------|----------|
| Отправить распарсенные статусы | `POST /api/extension/review-statuses` |
| Сообщить об открытии чата | `POST /api/extension/chat/opened` |
| Сообщить о найденном якоре | `POST /api/extension/chat/{chatRecordId}/anchor` |
| Сообщить об ошибке | `POST /api/extension/chat/{chatRecordId}/error` |
| Отметить жалобу как отправленную | `POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent` |

---

## Пример curl

```bash
curl -s -H "Authorization: Bearer wbrm_YOUR_TOKEN" \
  "https://rating5.ru/api/extension/stores/YOUR_STORE_ID/tasks" | jq .totals
```
