# AUDIT: Telegram Mini Apps (R5 SaaS)

**Дата аудита:** 2026-03-06
**Автор:** Claude Code (Opus 4.6)
**Охват:** Полная цепочка: DB schema → backend services → cron jobs → API → TG Mini App UI
**Статус:** Только исследование. Код не изменялся.

---

## 1. Current System Map

### 1.1 Назначение TG Mini Apps

Telegram Mini App — основной операционный инструмент R5 для управления чатами с покупателями. Решает задачу:
- Просмотр очереди чатов, привязанных к отзывам
- Управление статусами и этапами (воронка удаления)
- Запуск/остановка автоматических рассылок (sequences)
- Отправка сообщений покупателям
- Закрытие и переоткрытие чатов

### 1.2 Ключевые сущности и связи

```
stores (активные)
  └── products (wb_product_id / ozon_sku)
       └── product_rules (work_in_chats = TRUE)
            └── chats (product_nm_id → wb_product_id)
                 ├── review_chat_links (chat_id + review_id)
                 │    └── reviews (complaint_status, review_status_wb, rating_excluded)
                 ├── chat_messages (sender, is_auto_reply, timestamp)
                 └── chat_auto_sequences (status, current_step, stop_reason)
```

**Принцип фильтрации очереди TG:**
- WB: `INNER JOIN review_chat_links` — только чаты с привязкой к отзыву (~700 из ~300K+)
- OZON: `LEFT JOIN` + `product_nm_id IS NOT NULL` — только seller-initiated чаты

### 1.3 Архитектура статусов

Система использует **два ортогональных измерения:**

| Измерение | Назначение | Значения |
|-----------|-----------|----------|
| **status** (CRM воронка) | Где чат в рабочем процессе | `awaiting_reply`, `inbox`, `in_progress`, `closed` |
| **tag** (этап удаления) | Стадия воронки удаления отзыва | `NULL`, `deletion_candidate`, `deletion_offered`, `deletion_agreed`, `deletion_confirmed` |

Status и tag **независимы**: изменение одного не меняет другое.

### 1.4 Точки изменения статуса (7 штук)

| # | Актор | Триггер | Переход | Файл | Логирование |
|---|-------|---------|---------|------|-------------|
| 1 | Пользователь (TG) | Кнопка | Any → Any | `PATCH /api/telegram/chats/[id]/status` | `[STATUS]` |
| 2 | Пользователь (Web) | Kanban | Any → Any | `PATCH /api/stores/[id]/chats/[id]/status` | `[API]` |
| 3 | Cron (:15,:45) | review resolved | active → closed | `startResolvedReviewCloser()` | `[CRON]` |
| 4 | Dialogue Sync | review resolved | active → closed | Step 3.5b dialogues/update | `[DIALOGUES]` |
| 5 | Extension API | chat opened | active → closed | `/api/extension/chat/opened` | `[Extension]` |
| 6 | Dialogue Sync | chat upsert | (preserve) | Step 3 dialogues/update | — |
| 7 | Dialogue Sync | message event | (implicit) | Step 5a dialogues/update | — |

---

## 2. Intended Logic vs Actual Logic

### 2.1 Этапы воронки

| Область | Как должно быть | Как работает сейчас | Gap | Severity |
|---------|----------------|--------------------|----|----------|
| **Ожидание (awaiting_reply)** | Чат ожидает ответа покупателя, рассылка активна | ✅ Работает корректно. Sequence только в этом статусе | — | — |
| **Входящие (inbox)** | Новый чат, без действий | ✅ Дефолтный статус для новых чатов | — | — |
| **В работе (in_progress)** | Активный диалог продавец↔покупатель | ✅ Выставляется при отправке сообщения | — | — |
| **Закрытые (closed)** | Завершённые чаты | ✅ Требует `completion_reason`. Поддерживает переоткрытие | — | — |
| **Валидация переходов** | Жёсткая проверка допустимых переходов | ⚠️ **Мягкая валидация** — предупреждение в лог, переход разрешается | P2 | LOW |
| **Кто закрыл** | Должно быть видно: система или сотрудник | ❌ **Нет поля `closed_by`** — невозможно различить ручное и автоматическое закрытие | P0 | CRITICAL |
| **История статусов** | Должна быть полная цепочка переходов | ❌ **Нет таблицы истории** — только текущий snapshot | P0 | CRITICAL |
| **Актор действия** | `user_id` сотрудника на каждом изменении | ❌ **`auth.userId` доступен в API, но НЕ сохраняется в БД** | P0 | CRITICAL |

### 2.2 Автозакрытие

| Область | Как должно быть | Как работает сейчас | Gap | Severity |
|---------|----------------|--------------------|----|----------|
| **Resolved review closer** | Автозакрытие при разрешении отзыва | ✅ Работает корректно, каждые 30 мин | — | — |
| **Dialogue sync auto-close** | Дублирование проверки при синхронизации | ✅ Работает, идемпотентно | — | — |
| **Extension auto-close** | Закрытие при открытии уже разрешённого чата | ✅ Работает корректно | — | — |
| **Различие auto vs manual** | Поле `closure_type` | ❌ **Нет поля** — `completion_reason = 'review_resolved'` идентичен для cron и manual | P0 | CRITICAL |
| **Уведомление при автозакрытии** | Оповещение в TG об автозакрытии | ❌ **Чат закрывается молча** — сотрудник видит пропажу из очереди | P1 | HIGH |

### 2.3 Роли и доступ

| Область | Как должно быть | Как работает сейчас | Gap | Severity |
|---------|----------------|--------------------|----|----------|
| **Manager store access** | Доступ только к назначенным магазинам | ❌ **`getAccessibleStoreIds()` игнорирует роль** — manager видит все магазины | P1 | HIGH |
| **RBAC в TG routes** | Разграничение прав по ролям | ❌ **auth.role не проверяется** — все роли могут всё | P1 | HIGH |
| **Dev mode** | Только на dev/staging | ✅ Гейтировано `TELEGRAM_DEV_MODE` env var | — | — |

### 2.4 Логирование

| Область | Как должно быть | Как работает сейчас | Gap | Severity |
|---------|----------------|--------------------|----|----------|
| **Actor на статус** | `status_changed_by UUID` | ❌ Нет | P0 | CRITICAL |
| **Actor на тег** | `tag_changed_by UUID` | ❌ Нет | P0 | CRITICAL |
| **Actor на сообщение** | `sender_user_id UUID` | ❌ Нет | P0 | CRITICAL |
| **Actor на sequence** | `started_by UUID` | ❌ Нет | P1 | HIGH |
| **История статусов** | `chat_status_history` table | ❌ Не существует | P0 | CRITICAL |
| **История тегов** | `chat_tag_history` table | ❌ Не существует | P1 | HIGH |
| **Cron execution log** | Персистентный лог крон-задач | ❌ Только console.log | P1 | HIGH |
| **`stopped_at` на sequences** | Время остановки sequence | ❌ Нет поля | P2 | MEDIUM |

---

## 3. Closed Dialog Audit

### 3.1 Все причины закрытия (11 значений)

**CHECK constraint** (migration 024, 2026-03-05):

| Reason | Label (RU) | Кто ставит | TG | Web | Auto |
|--------|-----------|-----------|---|---|---|
| `review_deleted` | Отзыв удален | Пользователь | ✅ | ✅ | ❌ |
| `review_upgraded` | Отзыв дополнен | Пользователь | ✅ | ✅ | ❌ |
| `review_resolved` | Не влияет на рейтинг | Система | ✅* | ❌ | ✅ |
| `temporarily_hidden` | Временно скрыт | Система | ✅* | ❌ | ✅ |
| `refusal` | Отказ | Пользователь | ✅ | ❌ | ❌ |
| `no_reply` | Нет ответа | Пользователь + Система | ✅ | ✅ | ✅ |
| `old_dialog` | Старый диалог | Пользователь | ✅ | ✅ | ❌ |
| `not_our_issue` | Не наш вопрос | Пользователь | ✅ | ✅ | ❌ |
| `spam` | Спам | Пользователь | ✅ | ✅ | ❌ |
| `negative` | Негатив | Пользователь | ✅ | ✅ | ❌ |
| `other` | Другое | Пользователь | ✅ | ✅ | ❌ |

\* Доступны в TG-модалке для ручного выбора, но основной путь — автоматический.

### 3.2 Условия автозакрытия (blocker statuses)

| Условие | Поле | Значение | completion_reason |
|---------|------|----------|-------------------|
| Жалоба одобрена | `complaint_status` | `'approved'` | `review_resolved` |
| Исключён из рейтинга | `review_status_wb` | `'excluded'` | `review_resolved` |
| Снят с публикации | `review_status_wb` | `'unpublished'` | `review_resolved` |
| Временно скрыт | `review_status_wb` | `'temporarily_hidden'` | `temporarily_hidden` |
| Удалён | `review_status_wb` | `'deleted'` | `review_resolved` |
| Не влияет на рейтинг | `rating_excluded` | `TRUE` | `review_resolved` |

Все проверяются через централизованную функцию `isReviewResolvedForChat()` в `src/db/review-chat-link-helpers.ts:255-291`.

### 3.3 Проблема "Не влияет на рейтинг"

**Подозрение:** Массовое некорректное закрытие с причиной `review_resolved`, label "Не влияет на рейтинг".

**Результат аудита:**

1. **Автоматическое закрытие (cron/sync):** ✅ Корректно — проверяется `rating_excluded = TRUE` через SQL, данные от Chrome Extension
2. **Ручное закрытие:** ⚠️ Пользователь МОЖЕТ выбрать "Не влияет на рейтинг" вручную, даже если отзыв ВЛИЯЕТ на рейтинг — **нет валидации**
3. **Источник данных `rating_excluded`:** Chrome Extension парсит UI WB seller cabinet → отправляет `ratingExcluded: true/false` → сервер обновляет `reviews.rating_excluded`

**Риски:**
- ❌ Нет серверной валидации корректности `rating_excluded` (доверие Extension)
- ❌ Пользователь может выбрать "Не влияет на рейтинг" для любого отзыва без проверки
- ❌ Невозможно отличить: закрыто автоматически (cron) или вручную (пользователь)

### 3.4 Аномалии и подозрения

| Аномалия | Описание | Причина | Severity |
|----------|----------|---------|----------|
| **Массовые закрытия без трейса** | Большое кол-во closed чатов, нельзя определить кто закрыл | Нет `closed_by` поля | P0 |
| **"review_resolved" от пользователя** | Пользователь ставит `review_resolved` вручную без проверки | TG модалка показывает все 11 причин | P1 |
| **`refusal` только в TG** | Web dashboard не имеет причины "Отказ" | Несогласованность TG vs Web | P2 |
| **Тихое автозакрытие** | Cron закрывает чат без уведомления сотрудника | Нет push в TG при auto-close | P1 |

---

## 4. User / Access Audit

### 4.1 Таблица пользователей TG

| Поле | Тип | Назначение |
|------|-----|-----------|
| `user_id` | TEXT UNIQUE | FK → users.id (1:1) |
| `telegram_id` | BIGINT UNIQUE | Telegram user ID |
| `telegram_username` | TEXT | @username |
| `chat_id` | BIGINT | DM chat ID для уведомлений |
| `is_notifications_enabled` | BOOLEAN | Вкл/выкл нотификации |

### 4.2 Роли и права

| Роль | Store access (expected) | Store access (actual) | Закрытие чатов | Смена тегов | Запуск sequences | Отправка сообщений |
|------|------------------------|----------------------|----------------|-------------|------------------|--------------------|
| **owner** | Все магазины | ✅ Все | ✅ Да | ✅ Да | ✅ Да | ✅ Да |
| **admin** | Все магазины | ✅ Все | ✅ Да | ✅ Да | ✅ Да | ✅ Да |
| **manager** | Только назначенные | ❌ **ВСЕ** (баг!) | ✅ Да | ✅ Да | ✅ Да | ✅ Да |

**Критический баг:** `getAccessibleStoreIds()` в `src/db/auth-helpers.ts` не фильтрует по `member_store_access` для роли manager.

### 4.3 Ожидаемые пользователи

| Пользователь | Верификация | Примечание |
|--------------|-------------|-----------|
| Иван | Owner, org `2f36a863-...`, 65 магазинов | Подтверждено из кода |
| Ксюша | Не верифицирован из кода | Требует проверки через `GET /api/org/members` |
| Катя | Не верифицирован из кода | То же |
| Кристина | Не верифицирован из кода | То же |

### 4.4 Логирование действий пользователей

| Действие | user_id в DB | user_id в логах | Персистентно |
|----------|-------------|-----------------|-------------|
| Смена статуса | ❌ | ❌ | ❌ |
| Смена тега | ❌ | ❌ | ❌ |
| Отправка сообщения | ❌ | ❌ | ❌ |
| Запуск sequence | ❌ | ❌ | ❌ |
| Закрытие чата | ❌ | ❌ | ❌ |

---

## 5. Event Traceability Audit

### 5.1 Что логируется

| Информация | DB | Console | Персистентно |
|------------|-----|---------|-------------|
| Chat ID | ✅ | ✅ | ✅ |
| Новый статус | ✅ | ✅ | ✅ |
| Новый тег | ✅ | ✅ | ✅ |
| Completion reason | ✅ | ✅ | ✅ |
| `status_updated_at` | ✅ | — | ✅ |
| `is_auto_reply` на сообщениях | ✅ | — | ✅ |
| Sequence stop_reason | ✅ | ✅ | ✅ |

### 5.2 Что НЕ логируется (слепые зоны)

| Информация | Severity | Влияние |
|------------|----------|---------|
| **Кто закрыл** (user_id) | 🔴 CRITICAL | Невозможно определить ответственного |
| **Ручное vs автоматическое** | 🔴 CRITICAL | Невозможно отличить действие сотрудника от системы |
| **История переходов статусов** | 🔴 CRITICAL | Невозможно восстановить цепочку событий |
| **Кто отправил сообщение** | 🔴 CRITICAL | Невозможно определить автора |
| **Кто запустил sequence** | 🟠 HIGH | Невозможно определить инициатора |
| **Когда остановлен sequence** | 🟠 HIGH | Нет `stopped_at` timestamp |
| **Cron execution history** | 🟠 HIGH | Console логи теряются при перезапуске PM2 |
| **Кто изменил тег** | 🔴 CRITICAL | Невозможно определить |

### 5.3 Можно ли восстановить цепочку?

```
Создание → Рассылка → Ответ покупателя → Перевод → Закрытие
```

**Ответ: ЧАСТИЧНО**

| Этап | Можно восстановить | Как | Ограничения |
|------|-------------------|-----|-------------|
| Создание чата | ✅ | `chats.created_at` | Нет info о первом статусе |
| Привязка к отзыву | ✅ | `review_chat_links.created_at` | OK |
| Запуск рассылки | ✅ | `chat_auto_sequences.started_at` | Нет `started_by` |
| Отправка сообщений | ✅ | `chat_messages.timestamp` + `is_auto_reply` | Нет `sender_user_id` |
| Ответ покупателя | ✅ | `chat_messages` WHERE `sender = 'client'` | OK |
| Смена статуса | ⚠️ | Только текущий `status` + `status_updated_at` | Нет истории переходов |
| Закрытие | ⚠️ | `status = 'closed'` + `completion_reason` | Нет `closed_by`, нет auto/manual distinction |

---

## 6. Case Review

### 6.1 ИП Ахметов — Article 423333111, 1★, 11.07.2025

**Ожидаемый жизненный цикл:**

| Шаг | Ожидание | Результат проверки кода |
|-----|----------|------------------------|
| Отзыв синхронизирован | Daily review sync → INSERT reviews | ✅ Корректно |
| Чат создан через Extension | POST /api/extension/chat/opened | ✅ Корректно |
| review_chat_links создан | Fuzzy match nmId+rating+date±2min | ✅ Корректно |
| Тег auto-set | `UPDATE chats SET tag = 'deletion_candidate'` | ✅ Корректно |
| Чат в очереди TG | INNER JOIN review_chat_links | ✅ Если product_rules.work_in_chats=TRUE |
| Resolved check | `isReviewResolvedForChat()` → false | ✅ Если не resolved |
| Sequence (ручной) | POST /api/telegram/chats/[id]/sequence/start | ✅ Только через TG |
| Закрытие | Manual (кнопка) или auto (cron) | ✅ Оба пути работают |

**Возможные причины закрытия:**
1. Сотрудник закрыл вручную (completion_reason по выбору)
2. Cron закрыл авто (если complaint approved / review excluded / rating_excluded)
3. Dialogue sync закрыл (аналогично cron, чаще)

**Невозможно определить из данных:** Кто именно закрыл и ручное ли это было действие.

### 6.2 ИП Васильев — Article 536996869, 1★, 21.12.2025

**Идентичный путь** — те же кодовые пути, та же логика. Различается только storeId, productId и дата.

### 6.3 Общие наблюдения по кейсам

Для обоих кейсов:
- ✅ Код корректно обрабатывает создание, привязку, очередь, закрытие
- ❌ Невозможно определить, кто закрыл чат
- ❌ Невозможно определить, было ли закрытие ручным или автоматическим
- ❌ Невозможно увидеть историю переходов статусов
- ⚠️ Если `rating_excluded = TRUE` выставлен Extension неверно, чат закроется некорректно

---

## 7. Risk Register

### P0 — Критичные (блокируют операционный контроль)

| # | Риск | Описание | Влияние | Рекомендация |
|---|------|----------|---------|-------------|
| R1 | **Нет аудит-трейла: кто закрыл** | Поле `closed_by` / `status_changed_by` отсутствует | Невозможно определить ответственного за закрытие | Добавить `status_changed_by UUID`, `closure_type ENUM` |
| R2 | **Нет истории статусов** | Таблица `chat_status_history` отсутствует | Невозможно восстановить цепочку переходов | Создать иммутабельную таблицу истории |
| R3 | **Нет различия manual/auto** | `completion_reason` идентичен для обоих путей | Аналитика смешивает ручные и автоматические закрытия | Добавить `closure_type` поле |
| R4 | **auth.userId не сохраняется** | Все TG API endpoints извлекают userId, но не передают в DB | Теряется identитет актора | Pass userId через все service calls → save в DB |

### P1 — Важные (влияют на управляемость)

| # | Риск | Описание | Влияние | Рекомендация |
|---|------|----------|---------|-------------|
| R5 | **Manager видит все магазины** | `getAccessibleStoreIds()` не фильтрует по роли | Manager имеет доступ ко всем магазинам организации | Фильтровать по `member_store_access` для managers |
| R6 | **Нет RBAC в TG routes** | `auth.role` извлекается, но не проверяется | Все роли имеют одинаковые права | Добавить role middleware |
| R7 | **Тихое автозакрытие** | Cron закрывает чат без TG уведомления | Сотрудник может не заметить закрытие | Push уведомление при auto-close |
| R8 | **Cron логи не персистентны** | Console.log теряется при перезапуске PM2 | Невозможно анализировать историю работы cron | Создать `cron_execution_log` таблицу |
| R9 | **`refusal` только в TG** | Web dashboard не имеет причины "Отказ" | Несогласованность между интерфейсами | Добавить `refusal` в web CompletionReasonModal |

### P2 — Улучшения

| # | Риск | Описание | Влияние | Рекомендация |
|---|------|----------|---------|-------------|
| R10 | **Мягкая валидация переходов** | Invalid transitions логируются как warning, не блокируются | Возможны "неправильные" переходы | Feature flag для hard vs soft enforcement |
| R11 | **Нет `stopped_at` на sequences** | Нельзя рассчитать длительность sequence | Потеря аналитических данных | Добавить `stopped_at TIMESTAMPTZ` |
| R12 | **Нет free-text при закрытии** | Причина "Другое" не позволяет ввести комментарий | Потеря контекста | Добавить опциональное текстовое поле |
| R13 | **completion_reason не отображается в UI** | Закрытый чат не показывает причину | Сотрудник не видит, почему чат закрыт | Показать reason в UI |
| R14 | **Stale chats** | Чаты без сообщений >30 дней остаются в очереди | Замусоривание очереди | Периодическая очистка (auto-close old_dialog) |

---

## 8. Priority Gaps

### P0 — Критично (нужно исправлять первым)

1. **Добавить `status_changed_by UUID` в таблицу `chats`**
   - Прокинуть `auth.userId` через все API endpoints → service calls → DB update
   - Отдельное значение `NULL` = system/auto-close

2. **Добавить `closure_type VARCHAR(50)` в таблицу `chats`**
   - Значения: `'manual'`, `'auto_cron_resolved'`, `'auto_sync_resolved'`, `'auto_sequence_completed'`
   - Устанавливать в каждой точке закрытия

3. **Создать таблицу `chat_status_history`**
   ```sql
   CREATE TABLE chat_status_history (
     id UUID PRIMARY KEY,
     chat_id TEXT NOT NULL,
     old_status TEXT,
     new_status TEXT NOT NULL,
     changed_by UUID,
     changed_at TIMESTAMPTZ DEFAULT NOW(),
     change_source TEXT, -- 'tg_app', 'web_app', 'cron', 'sync', 'extension'
     completion_reason TEXT
   );
   ```

4. **Добавить `sender_user_id UUID` в таблицу `chat_messages`**
   - NULL для auto-messages (`is_auto_reply = true`)
   - user_id для ручных сообщений

### P1 — Важно (следующий спринт)

5. **Исправить `getAccessibleStoreIds()`** — фильтровать по `member_store_access` для managers
6. **Добавить `started_by UUID` в `chat_auto_sequences`**
7. **Добавить `stopped_at TIMESTAMPTZ` в `chat_auto_sequences`**
8. **Создать `cron_execution_log` таблицу**
9. **Push уведомление при автозакрытии** — `sendTelegramNotification({ type: 'auto_close' })`
10. **Добавить `refusal` в web CompletionReasonModal**

### P2 — Улучшения (backlog)

11. Показать `completion_reason` в UI (TG + web) для закрытых чатов
12. Добавить `tag_changed_by` и `chat_tag_history` таблицу
13. Периодическая очистка stale chats (>30 дней без сообщений)
14. Hard enforcement для transition validation (feature flag)
