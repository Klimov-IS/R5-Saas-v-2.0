# Sprint 009 — Аудит: 4-звёздочные отзывы и оптимизация задач

**Дата:** 2026-03-14
**Контекст:** Sprint 008 настроил stage guard для чат-задач (`chatOpens`, `chatLinks`). Теперь анализируем, как 4-звёздочные отзывы обрабатываются в системе задач расширения.

---

## Вопрос 1: Зачем парсить статусы 4★ отзывов до этапа работы в чатах?

### Текущее поведение (до фикса)

**Query A (statusParses)** в `tasks/route.ts` включает 4★ отзывы через **два независимых пути:**

```sql
-- Путь 1: жалобы
(pr.submit_complaints = TRUE AND pr.complaint_rating_4 = TRUE)
-- Путь 2: чаты
(pr.work_in_chats = TRUE AND pr.chat_rating_4 = TRUE)
```

**Stage guard на statusParses — НЕТ.** В Sprint 008 мы добавили stage guard только на `chatOpens` и `chatLinks`. Запрос statusParses выполнялся на **любом** этапе кабинета.

### Проблема

Если кабинет на этапе `complaints_submitted` (мы подаём жалобы, но ещё не перешли к чатам):

| Правило | complaint_rating_4 | chat_rating_4 | work_in_chats | Результат |
|---------|:------------------:|:-------------:|:-------------:|-----------|
| Только жалобы 1-3★ | `false` | `true` | `true` | **4★ попадает в statusParses через путь 2 (чаты)** |
| Жалобы 1-3★ + чаты 4★ | `false` | `true` | `true` | **4★ попадает в statusParses через путь 2 (чаты)** |

Итого: 4★ отзывы, которые нужны **только для чатов**, попадают в задачи парсинга статусов **задолго до того**, как мы начнём работать в чатах.

### Влияние

- Расширение получает лишние задачи по парсингу 4★ отзывов
- Расширение тратит время на парсинг страниц для 4★ (хотя результат бесполезен до этапа чатов)
- Счётчик `statusParses` на главной странице расширения завышен

### Вывод

**Да, парсинг 4★ до этапа чатов — бессмысленная работа.** Нужно добавить stage guard: отзывы, подходящие **только** под чат-правила (а не под жалобы), должны попадать в statusParses только при `stage IN ('chats_opened', 'monitoring')`.

---

## Вопрос 2: Нужна ли задача "парсить статусы" для 4★, если мы всё равно открываем 100% чатов?

### Текущий flow для 4★ отзывов

```
1. statusParses → расширение парсит страницу → POST /review-statuses
2. Backend ставит chat_status_by_review = 'available'
3. chatOpens → расширение открывает чат → POST /chat/opened
```

### Парсинг — побочный эффект

Когда расширение парсит страницу отзывов для любого артикула (например, для жалоб на 1-3★), оно **автоматически** отправляет статусы **всех** отзывов на странице, включая 4★.

Это значит: **статусы 4★ отзывов уже попадают в БД** как побочный эффект парсинга 1-3★. Отдельная задача statusParses для 4★ — **избыточна**.

### Вывод

Отдельная задача statusParses для 4★ не нужна — они и так парсятся вместе с 1-3★.

---

## Найденные проблемы (summary)

### Исправлено в Sprint 009

| # | Проблема | Статус |
|---|----------|--------|
| 1 | **statusParses для chat-only рейтингов не имел stage guard** — бесполезный парсинг до этапа чатов | **Исправлено** — `$2 = chatTasksAllowed` в Query A |
| 2 | **`GET /stores` — pendingChatsCount без stage guard** — Q3 не проверял `stores.stage` | **Исправлено** — `AND s.stage IN ('chats_opened', 'monitoring')` |
| 3 | **`GET /stores` — statusParses без stage guard для chat-only** — Q2 включал chat-only рейтинги без проверки этапа | **Исправлено** — stage condition в ARRAY_REMOVE |
| 4 | **totalCounts в tasks** — `chat_opens_total` и `chat_links_total` не учитывали stage guard | **Исправлено** — `CASE WHEN $2 = TRUE` |

### Не взято в работу

| # | Проблема | Причина |
|---|----------|---------|
| — | chatOpens не работает для 4★ без жалоб через бэкенд | Решено на стороне расширения, не требует изменений |

---

## Что изменено (Sprint 009)

### `src/app/api/extension/stores/[storeId]/tasks/route.ts`

**Query A (statusParses):** Добавлен параметр `$2 = chatTasksAllowed`. Чат-путь (`work_in_chats AND chat_rating_N`) активен только при `$2 = TRUE`. Жалобный путь (`submit_complaints AND complaint_rating_N`) — без ограничений.

**Query E (totalCounts):** `chat_opens_total` и `chat_links_total` обёрнуты в `CASE WHEN $2 = TRUE THEN ... ELSE 0 END`. `status_parses_total` — тот же `$2` guard на чат-путь.

### `src/app/api/extension/stores/route.ts`

**Q1 (stores):** Добавлено поле `s.stage` в SELECT.

**Q2 (statusParses):** В ARRAY_REMOVE чат-путь обёрнут в `s.stage IN ('chats_opened', 'monitoring')`.

**Q3 (pendingChats):** Добавлено условие `AND s.stage IN ('chats_opened', 'monitoring')`.

---

## Связь с предыдущими спринтами

- **Sprint 008** — настроил stage guard для `chatOpens` и `chatLinks` в tasks и `/chat/stores`. Sprint 009 **завершает** stage enforcement для оставшихся запросов.
- **Sprint 007** — audit chat stages, DB trigger `enforce_chat_stage_rules()`
