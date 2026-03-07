# Messenger View - Руководство

**Last Updated:** 2026-03-06
**Status:** Current
**Source of Truth:** Tags — [TAG_CLASSIFICATION.md](./domains/TAG_CLASSIFICATION.md), Statuses — [statuses-reference.md](./reference/statuses-reference.md)

---

## Обзор

Messenger View — режим работы с чатами клиентов (WhatsApp/Telegram-подобный интерфейс).
Используется для глубокой работы с конкретными переписками.

**Маркетплейсы:** WB + OZON (политики: [wb-work-policy.md](./domains/wb-work-policy.md), [ozon-work-policy.md](./domains/ozon-work-policy.md))

---

## Ключевые возможности

### 1. Переключение режимов

На странице `/stores/[storeId]/chats` в тулбаре:
- Таблица (Table View) — классический табличный вид
- Мессенджер (Messenger View) — режим мессенджера
- Канбан (Kanban View) — Kanban board

### 2. Левая панель — Список чатов

- Поиск по клиенту, товару
- Фильтры по статусам (см. ниже)
- Bulk selection (массовый выбор чатов)
- Индикаторы непрочитанных сообщений
- Сворачиваемый сайдбар

### 3. Правая панель — Переписка

- История сообщений клиента и продавца
- Автоскролл к последнему сообщению
- Информация о связанном отзыве (если есть `review_chat_links`)

### 4. AI генерация ответов

- Генерация через Deepseek AI
- Текст появляется в поле ввода
- Редактирование и повторная генерация
- Per-store персонализация через `stores.ai_instructions`

### 5. Отправка сообщений

- Отправка ответа в WB/OZON
- `Ctrl+G` — генерация AI ответа
- `Enter` — отправка сообщения

### 6. Массовые действия

- Генерация AI ответов для выбранных чатов
- Массовая отправка ответов
- Массовое изменение статуса

---

## Система статусов (Kanban)

**4 статуса** (см. [statuses-reference.md](./reference/statuses-reference.md)):

| Статус | Отображение | Описание |
|--------|-------------|----------|
| `awaiting_reply` | Ожидание | Ждём ответа от клиента |
| `inbox` | Входящие | Клиент ответил, нужна обработка |
| `in_progress` | В работе | Продавец отвечает / работает |
| `closed` | Закрыто | Диалог завершён |

**Порядок табов:** Ожидание → Входящие → В работе → Закрытые

**Workflow:**
- Новый чат + рассылка → `awaiting_reply`
- Клиент ответил → `inbox`
- Продавец ответил → `in_progress`
- Закрытие → `closed` (с выбором `completion_reason`)

---

## Система тегов (Deletion Workflow)

**4 тега + NULL** (см. [TAG_CLASSIFICATION.md](./domains/TAG_CLASSIFICATION.md)):

| Тег | Назначение | Как устанавливается |
|-----|-----------|---------------------|
| `deletion_candidate` | Кандидат на удаление | Автоматически при создании `review_chat_links` |
| `deletion_offered` | Компенсация предложена | Regex (продавец предложил кешбек) или вручную в TG |
| `deletion_agreed` | Клиент согласился | Regex (клиент обещал удалить) или вручную в TG |
| `deletion_confirmed` | Отзыв удалён | Regex (подтверждение удаления) или вручную в TG |
| `NULL` | Без тега | По умолчанию |

**Теги = этапы воронки удаления, НЕ общая классификация.**

---

## Фильтры

### По статусу
Кнопки в тулбаре: Ожидание, Входящие, В работе, Закрыто, Все

### По последнему отправителю
- От клиента — чаты, где последнее сообщение от клиента
- От нас — чаты, где последнее от продавца

### С черновиком
- Показать только чаты с AI-сгенерированными черновиками

### Текстовый поиск
- По имени клиента, названию товара, тексту сообщения

---

## Архитектура

### Компоненты

```
src/components/chats/
├── MessengerView.tsx          # Главный контейнер
├── ChatListSidebar.tsx        # Левая панель
├── ChatItem.tsx               # Элемент списка чата
├── ConversationPanel.tsx      # Правая панель
├── MessageBubble.tsx          # Сообщение
├── MessageComposer.tsx        # Поле ввода + AI
├── FilterPanel.tsx            # Панель фильтров
└── BulkActionsBar.tsx         # Массовые действия
```

### State Management

- **Zustand** (`src/store/chatsStore.ts`) — UI состояние (режим, фильтры, выбранные чаты)
- **React Query** (`src/hooks/useChats.ts`) — данные (список, история, мутации)

### API Endpoints

```
GET    /api/stores/[storeId]/chats                      # Список чатов
GET    /api/stores/[storeId]/chats/[chatId]             # Чат с историей
POST   /api/stores/[storeId]/chats/[chatId]/generate-ai # AI генерация
POST   /api/stores/[storeId]/chats/[chatId]/send        # Отправка
POST   /api/stores/[storeId]/chats/bulk/generate-ai     # Массовая AI генерация
POST   /api/stores/[storeId]/chats/bulk/send            # Массовая отправка
POST   /api/stores/[storeId]/dialogues/update           # Синхронизация с WB
```

---

## Горячие клавиши

- `Ctrl+G` — Генерация AI ответа
- `Enter` — Отправка сообщения
- `Shift+Enter` — Перенос строки

---

## TG Mini App vs Web

Чаты доступны в двух интерфейсах:

| Аспект | Web Dashboard | TG Mini App |
|--------|-------------|-------------|
| URL | `/stores/[storeId]/chats` | `/tg/chat/[chatId]` |
| Фильтрация | По статусу, тегу, отправителю | Только review-linked чаты (INNER JOIN `review_chat_links`) |
| Рассылки | Отключены | Ручной запуск из TG |
| Дизайн | Tailwind + Shadcn/ui | Inline styles (no Tailwind) |

---

**Last Updated:** 2026-03-06
