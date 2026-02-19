# Unified Tasks Endpoint — Документация для расширения

**Дата:** 2026-02-19 (v1.1)
**Эндпоинт:** `GET /api/extension/stores/{storeId}/tasks`
**Авторизация:** `Authorization: Bearer wbrm_<token>`

---

## Что это

Единый эндпоинт, который возвращает **ВСЕ задачи** для магазина, сгруппированные по артикулу (nmId). Бекенд — мозг, расширение — исполнитель.

**Пагинация:** Один GET = один прогон. После выполнения задач — повторный GET. Бекенд автоматически исключит выполненные. Offset не нужен.

**Обратная совместимость:** Старые эндпоинты (`GET /complaints`, `GET /chat/rules`) остаются и работают параллельно.

---

## 3 типа задач

### 1. `statusParses` — Полный парсинг отзывов

**Что:** Отзывы, по которым мы НЕ знаем текущие статусы (чат, жалоба, статус отзыва).
**Критерий:** `chat_status_by_review IS NULL` или `unknown` + товар с активными правилами (complaint_rating_* или chat_rating_*).
**Действие расширения:** Посмотреть на отзыв → спарсить ВСЕ статусы → отправить через `POST /api/extension/review-statuses`. Парсите все видимые на странице, не только целевые — это бесплатно и полезно.
**Лимит:** 500 отзывов.
**Сортировка:** Старые первыми (date ASC).

### 2. `chatOpens` — Открытие и привязка чатов

**Что:** Объединённый массив из двух подтипов:
- `type: "link"` — чат уже открыт, но не привязан (идут ПЕРВЫМИ — быстрые победы)
- `type: "open"` — чат доступен, жалоба отклонена → нужно открыть новый чат

**Критерий link:** `chat_status = 'opened'` + нет записи в `review_chat_links`.
**Критерий open:** `complaint_status = 'rejected'` + `chat_status = 'available'` + нет записи в `review_chat_links`.
**Действие расширения:** Кликнуть "Чат" → получить URL → отправить через `POST /api/extension/chat/opened`. Физическое действие одинаковое для обоих типов.
**Лимит:** 400 суммарно (200 link + 200 open).
**Сортировка:** links первыми, внутри — старые первыми (date ASC).

### 3. `complaints` — Подача жалоб

**Что:** Отзывы с готовыми AI-жалобами (draft).
**Критерий:** `review_complaints.status = 'draft'` + `complaint_status IN ('not_sent', 'draft')`.
**Действие расширения:** Подать жалобу с текстом из `complaintText`. `reasonId` — число (11–20), это ID причины жалобы WB.
**Лимит:** 500 отзывов.
**Сортировка:** Старые первыми (date ASC).

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
          "reviewKey": "12345678_2_2026-01-15T10:30",
          "rating": 2,
          "date": "2026-01-15T10:30:37.000Z",
          "authorName": "Иванов",
          "text": "Текст отзыва...",
          "currentComplaintStatus": null,
          "currentChatStatus": null,
          "currentReviewStatus": "published"
        }
      ],
      "chatOpens": [
        {
          "type": "link",
          "reviewId": "abc123_12345678_zzz",
          "reviewKey": "12345678_3_2026-01-12T14:00",
          "rating": 3,
          "date": "2026-01-12T14:00:00.000Z",
          "authorName": "Сидоров",
          "text": "Текст отзыва..."
        },
        {
          "type": "open",
          "reviewId": "abc123_12345678_yyy",
          "reviewKey": "12345678_1_2026-01-10T08:00",
          "rating": 1,
          "date": "2026-01-10T08:00:00.000Z",
          "authorName": "Петров",
          "text": "Текст отзыва..."
        }
      ],
      "complaints": [
        {
          "reviewId": "abc123_12345678_www",
          "reviewKey": "12345678_1_2026-01-08T09:00",
          "rating": 1,
          "text": "Текст отзыва...",
          "authorName": "Козлов",
          "createdAt": "2026-01-08T09:00:00.000Z",
          "complaintText": {
            "reasonId": 16,
            "reasonName": "Нецензурная лексика, угрозы, оскорбления",
            "complaintText": "Текст жалобы..."
          }
        }
      ]
    }
  },
  "totals": {
    "statusParses": 150,
    "chatOpens": 17,
    "chatOpensNew": 12,
    "chatLinks": 5,
    "complaints": 32,
    "articles": 8
  },
  "limits": {
    "maxChatsPerRun": 50,
    "maxComplaintsPerRun": 300,
    "cooldownBetweenChatsMs": 3000,
    "cooldownBetweenComplaintsMs": 1000
  }
}
```

---

## Ключевые поля

| Поле | Тип | Описание |
|------|-----|----------|
| `reviewId` | string | Внутренний ID бекенда. Используйте при отчёте обратно. |
| `reviewKey` | string | Ключ для DOM-матчинга: `{nmId}_{rating}_{YYYY-MM-DDTHH:mm}`. Совпадает с форматом в `POST /review-statuses`. |
| `date` | string | Полный ISO timestamp. Бекенд сравнивает с точностью до минуты. |
| `type` | "open" \| "link" | Только в `chatOpens`. "link" = привязка существующего, "open" = новый чат. |
| `reasonId` | number | 11–20, ID причины жалобы WB. Число, не строка. |

---

## Рекомендуемый порядок выполнения

1. **statusParses** — сначала узнаём статусы (пассивный парсинг, парсим ВСЁ видимое)
2. **chatOpens (type: "link")** — привязываем уже открытые чаты (быстрые победы)
3. **chatOpens (type: "open")** — открываем новые чаты
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
