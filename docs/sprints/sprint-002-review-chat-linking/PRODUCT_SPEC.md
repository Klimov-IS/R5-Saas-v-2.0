# Product Spec: Связка Отзыв ↔ Чат (Review-Chat Linking)

> **Версия:** 1.0
> **Дата:** 2026-02-16
> **Автор:** Product Team
> **Sprint:** 002

---

## 1. Executive Summary

Реализация двусторонней связки между отзывами и чатами WB через Chrome-расширение Rating5. Расширение работает как мост между двумя изолированными системами WB, собирая контекст отзыва и передавая его бэкенду вместе с данными чата.

**Результат:** полный жизненный цикл каждого негативного отзыва отслеживается от создания до разрешения.

---

## 2. Бизнес-контекст

### 2.1 Текущий workflow (AS-IS)

```
Покупатель оставляет отзыв 1-3⭐
    ↓
Sync: отзыв попадает в систему R5
    ↓
AI генерирует жалобу → отправляется через расширение
    ↓
WB отклоняет жалобу
    ↓
──── РАЗРЫВ ────
    ↓
Менеджер ВРУЧНУЮ ищет чат с покупателем
Не знает, по какому отзыву чат
Не может отследить результат
```

### 2.2 Целевой workflow (TO-BE)

```
Покупатель оставляет отзыв 1-3⭐
    ↓
Sync: отзыв попадает в систему R5
    ↓
AI генерирует жалобу → отправляется через расширение
    ↓
WB отклоняет жалобу
    ↓
Расширение открывает чат по этому отзыву
    ↓
Бэкенд получает связку: review_id ↔ chat_id
    ↓
AI генерирует персонализированное предложение
(знает текст отзыва, рейтинг, историю жалобы)
    ↓
Auto-sequence ведёт переписку
    ↓
Покупатель удаляет/изменяет отзыв
    ↓
Система фиксирует результат, закрывает цикл
```

### 2.3 Бизнес-метрики (KPI)

| Метрика | Текущее | Целевое | Как измерим |
|---------|---------|---------|-------------|
| Связанных чатов с отзывами | 0% | >80% обработанных | `review_chat_links` count |
| Время от отклонения жалобы до открытия чата | Неизвестно | <24ч | Timestamp diff |
| Конверсия чат → удаление отзыва | Неизвестно | Будет baseline | linked chats where review deleted |
| ROI компенсаций | Неизвестно | Будет baseline | compensation_amount / deleted_reviews |

---

## 3. Функциональные требования

### 3.1 Backend API для расширения

**Расширение получает:**
- Список магазинов с чат-правилами
- Правила по артикулам: какие отзывы обрабатывать (active, chatEnabled, starsAllowed)
- Условие: статус жалобы = "отклонена" (`requiredComplaintStatus: "rejected"`)

**Расширение отправляет:**
- Контекст отзыва (`nmId`, `rating`, `reviewDate`, `reviewKey`)
- URL открытого чата (`chatUrl`)
- Системное сообщение WB (`systemMessageText`, `parsedNmId`)
- Статусы прогресса (`CHAT_OPENED` → `ANCHOR_FOUND` → `MESSAGE_SENT`)

### 3.2 Хранение связки

Система должна хранить и поддерживать связку:

```
review (id, nmId, rating, date)
    ↕ (через review_chat_links или прямой FK)
chat (id, chatUrl, systemMessage)
```

**Требования:**
- Один отзыв = максимум один активный чат
- Идемпотентность: повторная отправка не создаёт дубль
- Reconciliation: связка должна работать с чатами из dialogue sync

### 3.3 Reconciliation с Dialogue Sync

Текущий dialogue sync создаёт записи в `chats` из WB Chat API. Расширение сообщает об открытии чата раньше. Нужен merge:

```
Расширение: POST /chat/opened → создаёт preliminary record
                                 (reviewKey + chatUrl)
    ↓ (через 5-60 мин)
Dialogue Sync: подтягивает чат из WB API
    ↓
Reconciliation: match по chat_id из URL → обогащает
                существующую запись review-связкой
```

### 3.4 AI Enrichment (Фаза 2)

Когда связка есть, AI-потоки получают дополнительный контекст:

| AI Flow | Текущий контекст | + Новый контекст |
|---------|-----------------|------------------|
| generate-chat-reply | store, product, rules | + review text, rating, date |
| generate-deletion-offer | store, product, compensation | + review text, complaint history |
| classify-chat-tag | messages | + review rating (для точности) |

### 3.5 Автоматизации (Фаза 2-3)

| Автоматизация | Триггер | Действие |
|---------------|---------|----------|
| Auto-sequence при открытии чата | `CHAT_OPENED` + linked review | Создать sequence с правильным типом (по рейтингу) |
| Закрытие чата при удалении отзыва | review `deleted_from_wb_at` IS NOT NULL | tag → `deletion_confirmed`, status → `closed` |
| Уведомление в Telegram | Клиент ответил в linked чате | "Ответ по отзыву на 2⭐ на Футболку" |

---

## 4. Условие открытия чата: `requiredComplaintStatus = "rejected"`

Это ключевое продуктовое решение:

```
Путь 1 (бесплатный): Жалоба → WB удовлетворяет → Отзыв удалён ✓ (стоимость: ~$0.0001 AI)
Путь 2 (платный):    Жалоба → WB отклоняет → Чат → Компенсация → Удаление ✓ (стоимость: 50-500₽)
```

Мы **никогда не открываем чат, если жалоба ещё не отклонена**. Это:
- Оптимизирует юнит-экономику (бесплатный путь первым)
- Исключает дублирование усилий
- Даёт чёткую точку перехода в workflow

---

## 5. Data Model

### 5.1 Вариант A: Отдельная таблица связки (рекомендуемый)

```sql
CREATE TABLE review_chat_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id),

  -- Review side
  review_id TEXT REFERENCES reviews(id),       -- может быть NULL до reconciliation
  review_key TEXT NOT NULL,                     -- nmId_rating_date (от расширения)
  review_nm_id TEXT NOT NULL,
  review_rating INTEGER NOT NULL,
  review_date TIMESTAMPTZ NOT NULL,

  -- Chat side
  chat_id TEXT REFERENCES chats(id),           -- может быть NULL до dialogue sync
  chat_url TEXT NOT NULL,
  system_message_text TEXT,
  parsed_nm_id TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'chat_opened',
  -- chat_opened → anchor_found → message_sent → completed / error
  message_type TEXT,                            -- 'A' (1-3⭐) / 'B' (4⭐) / NULL
  message_sent_at TIMESTAMPTZ,

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(store_id, review_key)                  -- один отзыв = один чат
);
```

**Плюсы:**
- Не ломает существующие таблицы `reviews` и `chats`
- Оба FK nullable — работает до reconciliation
- Чистая история: когда открыт чат, когда найден anchor, когда отправлено сообщение

### 5.2 Вариант B: Колонки на таблице `chats`

```sql
ALTER TABLE chats ADD COLUMN linked_review_id TEXT REFERENCES reviews(id);
ALTER TABLE chats ADD COLUMN review_key TEXT;
ALTER TABLE chats ADD COLUMN chat_url_wb TEXT;
ALTER TABLE chats ADD COLUMN system_message_text TEXT;
ALTER TABLE chats ADD COLUMN link_status TEXT; -- opened / anchor_found / message_sent
```

**Плюсы:** Проще, нет JOIN-ов.
**Минусы:** Засоряет таблицу `chats`, не все чаты имеют связку.

### 5.3 Рекомендация

**Вариант A** — отдельная таблица. Причины:
- Чистое разделение ответственности
- Не все чаты приходят от расширения (есть organic chats)
- Удобно для аналитики (отдельная таблица = отдельные запросы)
- Легко расширять (добавлять compensation_amount, resolution_type и т.д.)

---

## 6. Определение `reviewKey`

Расширение формирует ключ для идентификации отзыва:

```
reviewKey = "{nmId}_{rating}_{date_truncated_to_minute}"
Пример:   "649502497_2_2026-01-07T20:09"
```

### 6.1 Риск коллизии

Два отзыва с одинаковым nmId, рейтингом и минутой — маловероятно, но возможно.

### 6.2 Matching с `reviews` таблицей

Для reconciliation нужен match:
```sql
SELECT id FROM reviews
WHERE product_nm_id = :nmId
  AND rating = :rating
  AND date >= :reviewDate - interval '1 minute'
  AND date <= :reviewDate + interval '1 minute'
  AND store_id = :storeId
ORDER BY date ASC
LIMIT 1;
```

### 6.3 Улучшение (если расширение может)

Если расширение может парсить WB review ID из DOM — это идеальный ключ.
Тогда `review_key = wb_review_id`, и matching становится тривиальным.

---

## 7. API Endpoints (Summary)

Полный контракт: [API_CHATS_CONTRACT.md](../../reference/extension-chat-api.md)

| # | Method | Endpoint | Фаза | Назначение |
|---|--------|----------|-------|------------|
| 1 | GET | `/api/extension/chat/stores` | MVP | Магазины с чат-правилами |
| 2 | GET | `/api/extension/chat/stores/{id}/rules` | MVP | Правила по артикулам |
| 3 | POST | `/api/extension/chat/opened` | MVP | Фиксация открытия чата |
| 4 | POST | `/api/extension/chat/{id}/anchor` | MVP | Фиксация системного сообщения |
| 5 | POST | `/api/extension/chat/{id}/message-sent` | Sprint 2 | Фиксация отправки сообщения |
| 6 | POST | `/api/extension/chat/{id}/error` | Sprint 2 | Логирование ошибок |

---

## 8. Фазы реализации

### Фаза 1 — MVP Backend (1-2 дня)
1. Миграция БД: `review_chat_links`
2. API endpoints 1-4
3. Reconciliation logic (match extension chat → dialogue sync chat)
4. Тесты

### Фаза 2 — AI Enrichment (1 день)
1. Передача review context в `generate-chat-reply`
2. Передача review context в `generate-deletion-offer`
3. Авто-создание auto-sequence при linked chat

### Фаза 3 — Analytics & UI (2-3 дня)
1. Полная воронка: отзыв → жалоба → чат → удаление
2. Виджет отзыва в карточке чата
3. Дашборд конверсии
4. Обогащённые Telegram-уведомления

---

## 9. Acceptance Criteria

### MVP
- [ ] Расширение получает список магазинов и правила через API
- [ ] Расширение фиксирует открытие чата → бэкенд создаёт `review_chat_link`
- [ ] Расширение фиксирует системное сообщение → бэкенд подтверждает связку
- [ ] Повторная отправка того же `reviewKey` не создаёт дубль
- [ ] Dialogue sync при обнаружении чата обогащает `review_chat_link.chat_id`

### AI Enrichment
- [ ] При генерации ответа в linked чате AI получает текст отзыва
- [ ] Deletion offer учитывает конкретный рейтинг из связанного отзыва
- [ ] Auto-sequence создаётся автоматически для linked chats

### Analytics
- [ ] Менеджер видит текст отзыва в карточке чата
- [ ] Менеджер видит статус чата в карточке отзыва
- [ ] Есть метрика: конверсия linked chat → deleted review

---

## 10. Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| `reviewKey` не уникален | Низкая | Fuzzy match + ручная верификация |
| WB изменит DOM чата | Средняя | Версионирование селекторов в расширении |
| Dialogue sync создаст дубль | Высокая | Reconciliation по chat_id из URL |
| Расширение не найдёт system message | Средняя | Fallback: связка без anchor, ручная верификация |
| Масштаб: 65 магазинов × ручной запуск | Высокая | Приоритизация магазинов, батч-обработка |

---

## 11. Вне скоупа (Out of Scope)

- Автоматическая отправка сообщений без участия менеджера (этика + ToS)
- OZON review-chat linking (другой marketplace, другой workflow)
- Обратная связка: из чата найти отзыв (только из отзыва → в чат)
- Массовое ретро-связывание существующих чатов с отзывами
