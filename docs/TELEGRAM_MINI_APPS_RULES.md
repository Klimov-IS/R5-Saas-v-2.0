# TELEGRAM MINI APPS — Master Rules Document

**Версия:** 1.0
**Дата:** 2026-03-06
**Статус:** Source of Truth для TG Mini Apps
**Автор:** Claude Code (Opus 4.6) по результатам аудита

> Этот документ является **главным нормативным документом** по работе Telegram Mini Apps.
> Любые изменения в логике TG Mini Apps должны сначала отражаться здесь.

---

## 1. Purpose

### Зачем нужен Telegram Mini Apps

TG Mini App — основной операционный интерфейс сотрудников R5 для:
- Управления чатами с покупателями маркетплейсов (WB, OZON)
- Отслеживания воронки удаления негативных отзывов
- Запуска и контроля автоматических рассылок (sequences)
- Принятия решений о компенсациях и закрытии диалогов

### Какую операционную задачу решает

Конвертация негативных отзывов в:
1. Удаление/дополнение отзыва через переговоры с покупателем
2. Подачу жалобы на отзыв через WB (только WB, не OZON)
3. Исключение отзыва из рейтинга через прозрачный рейтинг WB

---

## 2. Core Entities

### Отзыв (Review)
- Таблица: `reviews`
- Ключевые поля: `rating`, `complaint_status`, `review_status_wb`, `rating_excluded`
- Source: WB/OZON API → Chrome Extension → review sync cron

### Диалог (Chat)
- Таблица: `chats`
- Ключевые поля: `status`, `tag`, `completion_reason`, `status_updated_at`
- Source: WB/OZON Chat API → dialogue sync cron

### Привязка отзыв↔диалог (Review-Chat Link)
- Таблица: `review_chat_links`
- Ключевые поля: `chat_id`, `review_id`, `review_rating`, `review_date`
- Source: Chrome Extension (POST /api/extension/chat/opened) + dialogue sync reconciliation

### Клиент (Client)
- Поле: `chats.client_name`
- Source: WB/OZON Chat API (имя покупателя)

### Артикул (Product)
- Таблица: `products` + `product_rules`
- Связь: `chats.product_nm_id = products.wb_product_id`
- `product_rules.work_in_chats = TRUE` — необходимо для попадания в очередь

### Статус диалога (Chat Status)
- Поле: `chats.status`
- 4 значения: `inbox`, `awaiting_reply`, `in_progress`, `closed`

### Этап удаления (Chat Tag)
- Поле: `chats.tag`
- 4 значения + NULL: `deletion_candidate`, `deletion_offered`, `deletion_agreed`, `deletion_confirmed`

### Причина закрытия (Completion Reason)
- Поле: `chats.completion_reason`
- 11 значений (см. раздел 7)

### Пользователь (User)
- Таблицы: `users`, `org_members`, `telegram_users`
- Роли: `owner`, `admin`, `manager`

### Автоматическая рассылка (Auto-Sequence)
- Таблица: `chat_auto_sequences`
- Поля: `status`, `current_step`, `max_steps`, `stop_reason`, `sequence_type`

---

## 3. Source of Truth

| Что | Source of Truth | Примечание |
|-----|---------------|-----------|
| Статус диалога | `chats.status` | Единственный авторитетный источник |
| Этап удаления | `chats.tag` | Единственный авторитетный источник |
| Причина закрытия | `chats.completion_reason` | Только при `status = 'closed'` |
| Привязка к отзыву | `review_chat_links` | INNER JOIN = только привязанные попадают в очередь WB |
| Resolved/blocker | `reviews.complaint_status` + `reviews.review_status_wb` + `reviews.rating_excluded` | Функция: `isReviewResolvedForChat()` |
| Принадлежность к воронке | `product_rules.work_in_chats = TRUE` | Контроль через настройки товара |
| Закрытие | Комбинация `status + completion_reason` | `status='closed'` + `completion_reason` обязательна |

---

## 4. Funnel Stages (Этапы воронки)

### 4.1 Ожидание (awaiting_reply)

**Definition:** Чат ожидает реакции покупателя. Автоматическая рассылка может быть активна.

**Entry Criteria:**
- Ручное перемещение из `inbox` или `in_progress`
- Запуск auto-sequence (устанавливает статус как побочный эффект)

**Exit Criteria:**
- Покупатель ответил → `inbox` (вручную, через TG)
- Сотрудник перевёл → `in_progress` или `closed`
- Автозакрытие → `closed` (если review resolved)

**Auto Rules:**
- Auto-sequence МОЖЕТ быть активна в этом статусе
- Cron отправляет сообщения каждые 1-3 дня (в зависимости от шаблона)
- Автозакрытие при resolved review

**Manual Rules:**
- Сотрудник может переместить в любой другой статус
- Сотрудник может остановить sequence
- Сотрудник может запустить новый sequence

**Forbidden Transitions:** Нет (все переходы разрешены).

**Edge Cases:**
- Sequence остановлена, но статус остался `awaiting_reply` — допустимо
- Два сотрудника одновременно меняют статус — last write wins (soft validation)

---

### 4.2 Входящие (inbox)

**Definition:** Новый или необработанный чат. Дефолтный статус при создании.

**Entry Criteria:**
- Новый чат из WB/OZON API (дефолт при upsert)
- Переоткрытие из `closed` (ручное или при ответе покупателя)
- Ручное перемещение из другого статуса

**Exit Criteria:**
- Сотрудник начал работу → `in_progress`
- Сотрудник запустил sequence → `awaiting_reply`
- Сотрудник закрыл → `closed`
- Автозакрытие → `closed` (если review resolved)

**Auto Rules:**
- Auto-sequence НЕ активна (sequence не запущена)
- Автозакрытие при resolved review
- Dialogue sync: покупатель ответил → автоматически перемещается в `inbox` (если был в `closed`)

**Manual Rules:**
- Сотрудник может переместить в любой другой статус

---

### 4.3 В работе (in_progress)

**Definition:** Активный диалог. Продавец или покупатель ведут переписку.

**Entry Criteria:**
- Сотрудник отправил сообщение (TG/web → статус `in_progress`)
- Ручное перемещение из другого статуса
- Переоткрытие: продавец ответил на закрытый чат

**Exit Criteria:**
- Сотрудник перевёл → `awaiting_reply` (отложить, запустить sequence)
- Сотрудник закрыл → `closed`
- Автозакрытие → `closed` (если review resolved)

**Auto Rules:**
- Auto-sequence ОСТАНАВЛИВАЕТСЯ при входе в этот статус
- Автозакрытие при resolved review
- Dialogue sync НЕ меняет статус (сохраняет existing)

**Manual Rules:**
- Сотрудник может переместить в любой другой статус

---

### 4.4 Закрытые (closed)

**Definition:** Завершённый чат. Требует `completion_reason`.

**Entry Criteria:**
- Ручное закрытие (обязательно указать `completion_reason`)
- Автозакрытие cron (review resolved → `review_resolved` или `temporarily_hidden`)
- Автозакрытие dialogue sync (аналогично cron)
- Автозакрытие extension (при открытии resolved чата)
- Автозакрытие sequence processor (все сообщения отправлены → `no_reply`)

**Exit Criteria:**
- Покупатель ответил → `inbox` (автоматически, `completion_reason` очищается)
- Продавец ответил → `in_progress` (автоматически, `completion_reason` очищается)
- Ручное перемещение → любой активный статус (`completion_reason` очищается)

**Auto Rules:**
- Auto-sequence ОСТАНОВЛЕНА
- Переоткрытие при ответе покупателя или продавца (автоматически)
- `completion_reason` ОБЯЗАТЕЛЬНА при закрытии, ОЧИЩАЕТСЯ при переоткрытии

**Manual Rules:**
- Сотрудник может переоткрыть в любой активный статус
- При переоткрытии → `completion_reason = NULL`

**Forbidden Transitions:** Нет.

---

## 5. Auto-Transitions (Автоматические правила)

### 5.1 Создание диалога

| Триггер | Статус | Тег | Источник |
|---------|--------|-----|----------|
| WB Chat API sync (новый чат) | `inbox` | `NULL` (или existing) | Dialogue sync cron |
| Extension открыл чат из отзыва | (existing или `inbox`) | `deletion_candidate` | POST /api/extension/chat/opened |
| Reconciliation (dialogue sync) | (existing) | `deletion_candidate` (если NULL) | reconcileChatWithLink() |

### 5.2 Запуск рассылки

| Триггер | Статус | Источник | Примечание |
|---------|--------|----------|-----------|
| Кнопка в TG Mini App | → `awaiting_reply` | POST /api/telegram/chats/[id]/sequence/start | Первое сообщение отправляется немедленно |
| Cron (последующие) | (без изменения) | startAutoSequenceProcessor() | Только отправка сообщений, не статус |

### 5.3 Переход во входящие

| Триггер | Откуда | Source of Truth |
|---------|--------|---------------|
| Покупатель ответил | `closed` → `inbox` | Dialogue sync Step 5a |
| Покупатель ответил | `awaiting_reply`/`in_progress` → (без изменения, TG notify) | — |
| Ручное действие | Любой → `inbox` | TG/Web API |

### 5.4 Переход в работу

| Триггер | Откуда | Source of Truth |
|---------|--------|---------------|
| Продавец ответил на closed чат | `closed` → `in_progress` | Dialogue sync |
| TG send message | `awaiting_reply` → `in_progress` | TG send API |
| Ручное действие | Любой → `in_progress` | TG/Web API |

### 5.5 Автозакрытие

| Триггер | Условие | completion_reason | Source |
|---------|---------|-------------------|--------|
| Cron (:15,:45) | `complaint_status = 'approved'` | `review_resolved` | startResolvedReviewCloser |
| Cron (:15,:45) | `review_status_wb IN (excluded, unpublished, deleted)` | `review_resolved` | startResolvedReviewCloser |
| Cron (:15,:45) | `review_status_wb = 'temporarily_hidden'` | `temporarily_hidden` | startResolvedReviewCloser |
| Cron (:15,:45) | `rating_excluded = TRUE` | `review_resolved` | startResolvedReviewCloser |
| Dialogue sync | Аналогично cron | Аналогично | Step 3.5b |
| Extension | review resolved при открытии | `review_resolved` / `temporarily_hidden` | POST /api/extension/chat/opened |
| Sequence completion | Все сообщения отправлены, нет ответа | `no_reply` | startAutoSequenceProcessor |

### 5.6 Статусы отзывов, блокирующие работу

| Статус | Поле | Что происходит |
|--------|------|---------------|
| `approved` | `reviews.complaint_status` | Автозакрытие, исключение из очереди |
| `excluded` | `reviews.review_status_wb` | Автозакрытие, исключение из очереди |
| `unpublished` | `reviews.review_status_wb` | Автозакрытие, исключение из очереди |
| `temporarily_hidden` | `reviews.review_status_wb` | Автозакрытие (специальная причина), исключение из очереди |
| `deleted` | `reviews.review_status_wb` | Автозакрытие, исключение из очереди |
| `TRUE` | `reviews.rating_excluded` | Автозакрытие, исключение из очереди |

---

## 6. Manual Operations

### 6.1 Кто может закрыть чат

| Роль | Может закрыть | Примечание |
|------|-------------|-----------|
| Owner | ✅ Да | Полный доступ |
| Admin | ✅ Да | Полный доступ |
| Manager | ✅ Да | **ТЕКУЩЕЕ ПОВЕДЕНИЕ:** Может закрыть любой чат. **ОЖИДАЕМОЕ:** Только назначенные магазины |
| Система (cron) | ✅ Да | Только по блокирующим статусам отзыва |

### 6.2 Кто может переоткрыть чат

| Актор | Может переоткрыть | Как |
|-------|-------------------|-----|
| Покупатель (ответ) | ✅ Автоматически | Dialogue sync → `inbox`, reason cleared |
| Продавец (ответ) | ✅ Автоматически | Dialogue sync → `in_progress`, reason cleared |
| Сотрудник (ручное) | ✅ TG кнопка / Web Kanban | Выбирает целевой статус, reason cleared |
| Система | ❌ Не переоткрывает | Только закрывает |

### 6.3 Кто может менять причины закрытия

- Причина устанавливается **один раз** при закрытии
- При переоткрытии → `completion_reason = NULL`
- При повторном закрытии → новая причина обязательна
- Изменить причину без переоткрытия → **невозможно через UI** (только через DB)

### 6.4 Кто может переводить между этапами (статусами)

| Переход | TG Mini App | Web Dashboard | Cron/Sync |
|---------|-------------|--------------|-----------|
| inbox → in_progress | ✅ Кнопка | ✅ Kanban drag | ❌ |
| inbox → awaiting_reply | ✅ Кнопка + sequence start | ✅ Kanban drag | ❌ |
| inbox → closed | ✅ Кнопка (+ reason) | ✅ Kanban drag (+ reason) | ✅ Auto |
| in_progress → awaiting_reply | ✅ Кнопка | ✅ Kanban drag | ❌ |
| in_progress → inbox | ✅ Кнопка | ✅ Kanban drag | ❌ |
| in_progress → closed | ✅ Кнопка (+ reason) | ✅ Kanban drag (+ reason) | ✅ Auto |
| awaiting_reply → in_progress | ✅ Кнопка | ✅ Kanban drag | ❌ |
| awaiting_reply → inbox | ✅ Кнопка | ✅ Kanban drag | ❌ |
| awaiting_reply → closed | ✅ Кнопка (+ reason) | ✅ Kanban drag (+ reason) | ✅ Auto |
| closed → inbox | ✅ Кнопка | ✅ Kanban drag | ✅ (buyer reply) |
| closed → in_progress | ✅ Кнопка | ✅ Kanban drag | ✅ (seller reply) |
| closed → awaiting_reply | ✅ Кнопка | ✅ Kanban drag | ❌ |

---

## 7. Close Reasons (Причины закрытия)

### Полный справочник

| Reason | Название (RU) | Определение | Когда использовать | Когда НЕЛЬЗЯ | Auto | Аналитика |
|--------|-------------|------------|-------------------|-------------|------|-----------|
| `review_deleted` | Отзыв удален | Покупатель удалил отзыв по договорённости | Покупатель подтвердил удаление | Отзыв ещё не удалён | ❌ | ✅ Считается "успех" |
| `review_upgraded` | Отзыв дополнен | Покупатель улучшил отзыв | Рейтинг поднят до 4-5★ | Нет подтверждения | ❌ | ✅ Считается "успех" |
| `review_resolved` | Не влияет на рейтинг | Отзыв больше не влияет на рейтинг | Автоматически: жалоба одобрена, исключён, удалён, rating_excluded | Вручную без проверки — нежелательно | ✅ | ✅ Считается "разрешено" |
| `temporarily_hidden` | Временно скрыт | Отзыв временно скрыт WB | Автоматически: `review_status_wb = 'temporarily_hidden'` | Вручную | ✅ | ⚠️ Может вернуться |
| `refusal` | Отказ | Покупатель отказался от предложения | Покупатель отказал в удалении/дополнении | Покупатель не ответил (use no_reply) | ❌ | ✅ Учитывается |
| `no_reply` | Нет ответа | Покупатель не ответил | После завершения sequence ИЛИ вручную | Покупатель ответил отказом (use refusal) | ✅/❌ | ✅ Учитывается |
| `old_dialog` | Старый диалог | Диалог устарел, неактуален | Чат старше 30-60 дней | Активный недавний диалог | ❌ | ✅ Учитывается |
| `not_our_issue` | Не наш вопрос | Проблема не связана с товаром | Отзыв о доставке, WB сервисе | Проблема с товаром | ❌ | ✅ Учитывается |
| `spam` | Спам | Спам или злоупотребление | Явный спам, бот | Недовольный покупатель | ❌ | ✅ Учитывается |
| `negative` | Негатив | Негативный отзыв без перспективы | Безнадёжный случай | Есть возможность для работы | ❌ | ✅ Учитывается |
| `other` | Другое | Другая причина | Ничего из списка не подходит | Есть подходящая причина | ❌ | ⚠️ Требует уточнения |

---

## 8. Blocker Statuses (Статусы-блокаторы)

### Статусы, запрещающие дальнейшую работу → автозакрытие

| Статус | Поле | Автозакрытие | Completion Reason | Примечание |
|--------|------|-------------|-------------------|-----------|
| `complaint_status = 'approved'` | reviews | ✅ Да | `review_resolved` | Жалоба одобрена WB |
| `review_status_wb = 'excluded'` | reviews | ✅ Да | `review_resolved` | Исключён из рейтинга |
| `review_status_wb = 'unpublished'` | reviews | ✅ Да | `review_resolved` | Снят с публикации |
| `review_status_wb = 'temporarily_hidden'` | reviews | ✅ Да | `temporarily_hidden` | Временно скрыт |
| `review_status_wb = 'deleted'` | reviews | ✅ Да | `review_resolved` | Удалён |
| `rating_excluded = TRUE` | reviews | ✅ Да | `review_resolved` | Не влияет на рейтинг (прозрачный рейтинг) |

### Статусы, НЕ требующие автозакрытия

| Статус | Поле | Автозакрытие | Примечание |
|--------|------|-------------|-----------|
| `complaint_status = 'rejected'` | reviews | ❌ Нет | Жалоба отклонена — можно работать через чат |
| `complaint_status = 'sent'` | reviews | ❌ Нет | Жалоба на рассмотрении |
| `complaint_status = 'pending'` | reviews | ❌ Нет | Ожидает решения |
| `complaint_status = 'reconsidered'` | reviews | ❌ Нет | На пересмотре |
| `product_status_by_review = *` | reviews | ❌ Нет | Контекстные данные, не блокер |

### Статусы, требующие ручной проверки

| Статус | Описание | Рекомендация |
|--------|----------|-------------|
| `temporarily_hidden` | Может вернуться | Проверить через 7-14 дней |
| `rating_excluded` (от extension) | Зависит от точности extension | Проверить если кажется некорректным |

---

## 9. Audit Trail Requirements (Требования к журналированию)

### Что система ОБЯЗАНА логировать (TO BE — текущая реализация неполна)

| Событие | Обязательные данные | Текущий статус |
|---------|--------------------|---------------|
| Создание чата | chat_id, store_id, created_at, source (sync/extension) | ✅ Реализовано |
| Изменение статуса | chat_id, old_status, new_status, changed_by, changed_at, source | ❌ **НЕ реализовано** — нет changed_by, нет source |
| Изменение тега | chat_id, old_tag, new_tag, changed_by, changed_at | ❌ **НЕ реализовано** — нет changed_by |
| Закрытие чата | chat_id, completion_reason, closed_by, closed_at, closure_type | ❌ **ЧАСТИЧНО** — нет closed_by, нет closure_type |
| Переоткрытие чата | chat_id, reopened_by, reopened_at, previous_reason | ❌ **НЕ реализовано** |
| Отправка сообщения | chat_id, sender, text, is_auto, sender_user_id | ❌ **ЧАСТИЧНО** — нет sender_user_id |
| Запуск sequence | chat_id, sequence_type, started_by, started_at | ❌ **ЧАСТИЧНО** — нет started_by |
| Остановка sequence | sequence_id, stop_reason, stopped_by, stopped_at | ❌ **ЧАСТИЧНО** — нет stopped_by, нет stopped_at |

### Обязательные source types

| Source | Описание | Код |
|--------|----------|-----|
| `tg_app` | Действие через TG Mini App | PATCH /api/telegram/... |
| `web_app` | Действие через web dashboard | PATCH /api/stores/... |
| `cron_resolved_review` | Cron resolved-review-closer | startResolvedReviewCloser() |
| `cron_sequence` | Cron auto-sequence-processor | startAutoSequenceProcessor() |
| `sync_dialogue` | Dialogue sync auto-close | Step 3.5b |
| `sync_buyer_reply` | Покупатель ответил (auto-reopen) | Step 5a |
| `extension` | Chrome Extension | POST /api/extension/... |

---

## 10. Analytics & Observability (Целевое состояние)

### Что ДОЛЖНО быть видно в интерфейсе

| Метрика | Где видно | Текущий статус |
|---------|----------|---------------|
| Кто закрыл диалог | Карточка чата | ❌ Не реализовано |
| Когда закрыл | Карточка чата | ❌ Не отображается (есть в DB) |
| Причина закрытия | Карточка чата | ❌ Не отображается (есть в DB) |
| Ручное / авто | Карточка чата | ❌ Нет данных |
| Сколько закрытий на сотрудника | Dashboard | ❌ Нет данных |
| Сколько автозакрытий | Dashboard | ❌ Нет данных (только cron log) |
| Сколько ошибочных закрытий | Dashboard | ❌ Невозможно определить |
| Статусы по магазину | TG очередь (badges) | ✅ Реализовано |
| Rating filter | TG очередь | ✅ Реализовано |

---

## 11. Reopen Logic (Логика возврата)

### Автоматическое переоткрытие

| Триггер | Из | В | completion_reason | Source |
|---------|-----|---|-------------------|--------|
| Покупатель ответил | `closed` | `inbox` | `NULL` (очищается) | Dialogue sync |
| Продавец ответил | `closed` | `in_progress` | `NULL` (очищается) | Dialogue sync |

### Ручное переоткрытие

| Кто | Как | В какой статус | completion_reason |
|-----|-----|---------------|-------------------|
| Любой сотрудник | TG кнопка или Web Kanban drag | `inbox`, `in_progress`, или `awaiting_reply` | `NULL` (очищается) |

### Правила возврата

1. Переоткрытие **всегда очищает** `completion_reason`
2. Для повторного закрытия **обязательна** новая причина
3. Sequence не возобновляется автоматически — нужен ручной запуск
4. Тег (`tag`) **сохраняется** при переоткрытии
5. Возврат **логируется** только в console (нет DB audit trail — gap)

---

## 12. Known Ambiguities / Open Questions

### Вопросы, требующие бизнес-решения

| # | Вопрос | Контекст | Приоритет |
|---|--------|---------|-----------|
| Q1 | **Должен ли manager иметь ограниченный доступ к магазинам?** | Таблица `member_store_access` создана, но не используется. Все managers видят все магазины. | HIGH |
| Q2 | **Нужно ли различать ручное и автоматическое закрытие?** | Сейчас невозможно отличить. Нужно ли для аналитики/отчётности? | HIGH |
| Q3 | **Должен ли система уведомлять при автозакрытии?** | Сейчас чат закрывается молча. Нужен ли push в TG? | MEDIUM |
| Q4 | **Как быть с `temporarily_hidden`?** | Отзыв может вернуться. Нужен ли автоматический мониторинг? | MEDIUM |
| Q5 | **Нужно ли показывать `completion_reason` в UI?** | Причина закрытия есть в DB, но не показывается. | MEDIUM |
| Q6 | **Можно ли пользователю вручную ставить `review_resolved`?** | Сейчас доступно в TG модалке. Бизнес-логически — это системный статус. | LOW |
| Q7 | **Нужна ли очистка stale чатов?** | Чаты без сообщений >30 дней остаются в очереди. | LOW |
| Q8 | **Должен ли `refusal` быть доступен в web?** | Сейчас только в TG. Разные интерфейсы — разные причины. | LOW |
