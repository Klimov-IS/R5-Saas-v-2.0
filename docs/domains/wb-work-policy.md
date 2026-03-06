# Политика работы с Wildberries

**Дата:** 2026-03-04
**Версия:** 1.0
**Назначение:** Обязательные правила работы с WB. Весь код должен соответствовать этим правилам.

---

## 1. Диалоги (чаты)

### Как открываются чаты
- Расширение Chrome открывает чат из карточки отзыва на WB
- Вызывается `POST /api/extension/chat/opened` с контекстом отзыва
- Создаётся запись в `review_chat_links` (связь чат ↔ отзыв)
- Расширение отправляет стартовое сообщение покупателю

### Синхронизация диалогов
- Cron `startAdaptiveDialogueSync`: 5/15/60 мин (адаптивно по МСК)
- WB API: `buyer-chat-api.wildberries.ru/api/v1/seller/chats` + `/events`
- Курсор `last_chat_update_next` для инкрементальной загрузки
- **Rate limit WB**: ~5-10 запросов/мин (строже чем OZON)

### reply_sign
- Каждый чат имеет `reply_sign` — обязателен для отправки сообщений
- Без `reply_sign` отправка невозможна (WB API отвергнет)
- `reply_sign` приходит при синхронизации чата из WB API

---

## 2. Статусы чатов (Kanban)

| Статус | Описание | Когда устанавливается |
|--------|----------|----------------------|
| `awaiting_reply` | Ожидание | Запущена рассылка, ждём ответа покупателя |
| `inbox` | Входящие | Покупатель ответил — требует реакции менеджера |
| `in_progress` | В работе | Продавец ответил последним |
| `closed` | Закрытые | Завершённый диалог (нужна причина закрытия) |

### Переходы
- Покупатель ответил → `inbox` (всегда, даже из `closed`)
- Продавец ответил → `in_progress` (кроме если активная рассылка → остаётся `awaiting_reply`)
- Рассылка запущена → `awaiting_reply`
- Закрытие → `closed` + `completion_reason` обязателен

---

## 3. Жалобы (Complaints)

### КРИТИЧЕСКОЕ ПРАВИЛО: Строго 1 жалоба на отзыв
- WB технически позволяет подать **только одну жалобу** на отзыв
- После подачи кнопка "Пожаловаться" исчезает навсегда
- Повторная подача невозможна — решение необратимо
- Если жалоба отклонена, единственный путь — чат с покупателем

### Статусы жалоб
| Статус | Описание |
|--------|----------|
| `not_sent` | Не отправлена |
| `pending` | На рассмотрении WB |
| `approved` | Одобрена → отзыв исключён |
| `rejected` | Отклонена → работаем через чат |

### Автозакрытие при одобрении жалобы
- `complaint_status = 'approved'` → чат автоматически закрывается
- `completion_reason = 'review_resolved'`
- Активная рассылка останавливается

---

## 4. Рассылки (Auto-Sequences)

### Типы рассылок
| Тип | Для кого | Кол-во сообщений | Период |
|-----|----------|------------------|--------|
| `no_reply_followup_30d` | 1-3★ отзывы | 15 | Каждые 2 дня, 30 дней |
| `no_reply_followup_4star_30d` | 4★ отзывы | 10 | Каждые 3 дня, 30 дней |
| `offer_reminder` | tag: deletion_offered | 5 | ~14 дней |
| `agreement_followup` | tag: deletion_agreed | 4 | ~10 дней |
| ~~`refund_followup`~~ | ~~tag: refund_requested~~ | ~~3~~ | ~~~7 дней~~ | **Удалён** (migration 024, тег `refund_requested` удалён) |

### Правила запуска
- **Ручной старт** из TG Mini App (кнопка "Запустить рассылку")
- Первое сообщение отправляется **немедленно** при запуске
- Последующие сообщения отправляются кроном каждые 30 мин (08:00-22:00 МСК)
- 5★ отзывы — рассылка НЕ запускается

### Условия остановки
1. Покупатель ответил → `stop_reason = 'client_replied'`
2. Статус чата изменён вручную → `stop_reason = 'manual'`
3. Отзыв resolved (жалоба одобрена, исключён, удалён) → `stop_reason = 'review_resolved'`
4. Все сообщения отправлены → чат закрывается с `completion_reason = 'no_reply'`
5. Ошибка отправки постоянная (нет reply_sign) → `stop_reason = 'send_failed'`

### Защита awaiting_reply
- Если чат в `awaiting_reply` и активна рассылка — dialogue sync НЕ перемещает в `in_progress`
- Авто-сообщение рассылки НЕ должно менять статус чата

---

## 5. Автозакрытие чатов

### Триггеры автозакрытия (resolved review)
| Условие | completion_reason |
|---------|-------------------|
| `complaint_status = 'approved'` | `review_resolved` |
| `review_status_wb = 'excluded'` | `review_resolved` |
| `review_status_wb = 'unpublished'` | `review_resolved` |
| `review_status_wb = 'deleted'` | `review_resolved` |
| `review_status_wb = 'temporarily_hidden'` | `temporarily_hidden` |
| `rating_excluded = TRUE` | `review_resolved` |

### Где проверяется
1. `startResolvedReviewCloser` cron — каждые 30 мин
2. Dialogue sync Step 3.5b — при каждой синхронизации
3. Extension `chat/opened` — при открытии чата

---

## 6. Компенсация

### Правила по рейтингу
| Рейтинг | Компенсация | Стратегия |
|---------|-------------|-----------|
| 1-3★ | Да (кешбек/возврат по product_rules) | Удаление отзыва |
| 4★ | НЕТ | Только повышение до 5★, без кешбека |
| 5★ | — | Не обрабатывается |

### AI gating
- AI проверяет `review_rating` через `findLinkByChatId()`
- 4-5★: AI сообщается "только повышение до 5★, без кешбека"
- `generate-deletion-offer` возвращает 400 для 4-5★

---

## 7. Фильтрация очереди TG

- В TG очереди показываются **только** чаты с `review_chat_links` записью
- Дополнительно: `product_rules.work_in_chats = TRUE` (артикул активен)
- INNER JOIN `review_chat_links` — главный фильтр (~700 чатов из 300K+)

---

## 8. Привязка чатов (review_chat_links)

### Как создаётся привязка
1. Расширение Chrome открывает чат из карточки отзыва на WB
2. Вызывается `POST /api/extension/chat/opened` с контекстом: nmId, rating, reviewDate, chatUrl
3. Backend создаёт запись в `review_chat_links` с `review_key = "{nmId}_{rating}_{dateTruncMin}"`
4. Backend пытается найти отзыв через `matchReviewByContext()` (fuzzy match ±2 мин)
5. При dialogue sync `reconcileChatWithLink()` заполняет `chat_id`

### КРИТИЧЕСКОЕ ПРАВИЛО: Все открытые чаты ДОЛЖНЫ быть привязаны
- Если чат открыт вручную на WB (не через расширение) — `review_chat_links` НЕ создаётся
- Такой чат НЕ попадёт в TG очередь, рассылка НЕ будет запущена
- **Задача расширению:** при парсинге `chat_status = 'chat_opened'` → ретроактивно вызвать `POST /api/extension/chat/opened`
- Подробности: `docs/tasks/TASK-20260304-extension-chat-linking-and-status-protection.md`

### Защита статуса chat_status_by_review
- `opened` — **необратимый статус**. Нельзя понизить до `available` или `unavailable`
- `available` ↔ `unavailable` — могут меняться свободно
- Защита реализована в SQL: `src/app/api/extension/review-statuses/route.ts:367-369`
- **Причина:** WB иногда не прогружает кнопку чата, расширение ошибочно шлёт `unavailable`
