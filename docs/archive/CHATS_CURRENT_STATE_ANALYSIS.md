> **ARCHIVED (2026-03-06):** Pre-Kanban gap analysis -- historical sprint artifact

# Анализ текущего состояния страницы Чаты

**Дата:** 2026-01-16
**Версия:** 1.0
**Автор:** Product Team

---

## Оглавление

1. [Executive Summary](#executive-summary)
2. [Технический стек](#технический-стек)
3. [Архитектура и структура файлов](#архитектура-и-структура-файлов)
4. [Database Schema](#database-schema)
5. [Текущий функционал](#текущий-функционал)
6. [Нереализованные функции](#нереализованные-функции)
7. [Проблемы и боли пользователей](#проблемы-и-боли-пользователей)
8. [Выводы и рекомендации](#выводы-и-рекомендации)

---

## Executive Summary

**Статус:** Базовая функциональность работает, но отсутствует ключевая автоматизация и удобный UI для менеджеров.

**Ключевые находки:**
- ✅ Табличный режим полностью рабочий (фильтры, пагинация, поиск)
- ✅ AI flows реализованы, но не подключены к UI
- ❌ Режим мессенджера полностью отсутствует
- ❌ AI-генерация ответов не автоматизирована
- ❌ UX не оптимизирован для быстрой работы менеджеров

**Критичность:** 🟡 Средняя — система работает, но эффективность менеджеров низкая.

---

## Технический стек

### Frontend
- **Framework:** Next.js 14.2.35 (App Router)
- **UI Library:** React 18 + TypeScript
- **UI Components:** Shadcn/ui (Radix UI primitives)
- **Styling:** Tailwind CSS + CSS Variables
- **State Management:** React Query v5 (TanStack Query)
- **Icons:** Lucide React
- **Date formatting:** date-fns

### Backend
- **API Routes:** Next.js App Router API handlers
- **Database:** PostgreSQL (Yandex Cloud Managed Service)
- **ORM:** Raw SQL queries (pg library)
- **AI Provider:** Deepseek API (via custom wrapper)
- **Validation:** Zod schemas

### Data Flow
```
WB Chat API → Sync Endpoint → PostgreSQL → Next.js API → React Query → UI
                                    ↓
                               AI Processing (Deepseek)
```

---

## Архитектура и структура файлов

### Текущая структура

```
src/
├── app/
│   ├── stores/[storeId]/chats/
│   │   ├── page.tsx                    # Список чатов (Table View)
│   │   └── [chatId]/
│   │       └── page.tsx                # Детальный просмотр чата
│   └── api/
│       ├── stores/[storeId]/chats/
│       │   ├── route.ts                # GET список чатов
│       │   ├── [chatId]/
│       │   │   ├── route.ts            # GET/PUT конкретный чат
│       │   │   └── send/route.ts       # POST отправка сообщения
│       │   └── classify-all/route.ts   # POST массовая AI классификация
│       └── stores/[storeId]/dialogues/
│           └── update/route.ts         # POST синхронизация с WB
├── ai/
│   └── flows/
│       ├── generate-chat-reply-flow.ts # AI генерация ответа
│       └── classify-chat-tag-flow.ts   # AI классификация тега
├── db/
│   └── helpers.ts                      # Database queries
└── components/
    └── ui/                             # Shadcn UI компоненты
```

### Ключевые файлы

| Файл | Строки кода | Функция | Статус |
|------|-------------|---------|--------|
| `app/stores/[storeId]/chats/page.tsx` | 792 | Список чатов (Table View) | ✅ Работает |
| `app/stores/[storeId]/chats/[chatId]/page.tsx` | 334 | Детальный чат | ✅ Работает |
| `ai/flows/generate-chat-reply-flow.ts` | 55 | AI генерация ответа | ⚠️ Не подключена |
| `ai/flows/classify-chat-tag-flow.ts` | 75 | AI классификация | ⚠️ Частично |
| `api/stores/[storeId]/chats/route.ts` | 136 | API список чатов | ✅ Работает |
| `api/stores/[storeId]/chats/[chatId]/send/route.ts` | 88 | API отправка | ✅ Работает |

---

## Database Schema

### Таблица `chats`

```sql
CREATE TABLE chats (
  id                        TEXT PRIMARY KEY,        -- WB chatID
  store_id                  TEXT NOT NULL,
  owner_id                  TEXT NOT NULL,

  -- Метаданные чата
  client_name               TEXT NOT NULL,
  reply_sign                TEXT NOT NULL,          -- Для WB API

  -- Контекст товара
  product_nm_id             TEXT NULL,
  product_name              TEXT NULL,
  product_vendor_code       TEXT NULL,

  -- Превью последнего сообщения
  last_message_date         TIMESTAMPTZ NULL,
  last_message_text         TEXT NULL,
  last_message_sender       TEXT NULL CHECK (sender IN ('client', 'seller')),

  -- AI и автоматизация
  tag                       TEXT NULL,              -- active | successful | unsuccessful | no_reply | untagged
  draft_reply               TEXT NULL,              -- Черновик ответа (НЕ ИСПОЛЬЗУЕТСЯ)
  draft_reply_thread_id     TEXT NULL,              -- Для AI контекста

  -- Системные поля
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

**Индексы:**
- `idx_chats_store` — для быстрого получения чатов магазина
- `idx_chats_store_tag` — фильтрация по тегам
- `idx_chats_store_tag_date` — сортировка по дате с тегом
- `idx_chats_last_message` — сортировка по последнему сообщению
- `idx_chats_product` — связь с товарами

### Таблица `chat_messages`

```sql
CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY,                     -- WB eventID
  chat_id     TEXT NOT NULL REFERENCES chats(id),
  store_id    TEXT NOT NULL,
  owner_id    TEXT NOT NULL,

  -- Данные сообщения
  text        TEXT NULL,
  sender      TEXT NOT NULL CHECK (sender IN ('client', 'seller')),
  timestamp   TIMESTAMPTZ NOT NULL,
  download_id TEXT NULL,                            -- Для вложений (не используется)

  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Индексы:**
- `idx_chat_messages_chat` — все сообщения чата
- `idx_chat_messages_timestamp` — сортировка по времени

---

## Текущий функционал

### 1. Список чатов (Table View)

**Локация:** `src/app/stores/[storeId]/chats/page.tsx`

#### ✅ Работает:

**Отображение:**
- Таблица с колонками: Клиент | Товар | Последнее сообщение | Дата | Тег | Действия
- Аватары клиентов с инициалами (градиентные фоны)
- Цветные badge для тегов (active, successful, unsuccessful и тд)
- Относительное время ("5 мин назад", "2 часа назад")
- Полная дата при наведении

**Пагинация:**
- 25 чатов на странице
- Кнопки "Назад" / "Вперёд"
- Индикатор "Страница X из Y (всего: N)"
- Навигация сохраняется при применении фильтров

**Фильтры:**
- По тегам: Все | Активные | Успешные | Неуспешные | Нет ответа | Не размечено
- Поиск по: клиенту, товару, тексту сообщения
- Сортировка: по дате (новые/старые), по клиенту А-Я
- Debounce поиска 500ms (оптимизация)

**Статистика:**
- Карточки с счетчиками по каждому тегу
- Цветовые градиенты для визуального разделения
- Обновляются динамически при фильтрации

**Производительность:**
- React Query кеширование (24 часа staleTime)
- Параллельная загрузка чатов и товаров (Promise.all)
- Обогащение данными товаров на клиенте
- keepPreviousData для smooth pagination

**AI Классификация (Mock):**
- Простая эвристика для типа сообщения:
  - "Вопрос о доставке" (keywords: доставка, получ)
  - "Благодарность" (keywords: спасибо, благодар)
  - "Жалоба / Возврат" (keywords: возврат, жалоб, не работает)
  - "Вопрос о товаре" (keywords: цвет, размер, характеристик)

#### 🔧 Действия:

- Кнопка "Обновить чаты" — синхронизация с WB API
- Кнопка "Классифицировать все AI" — **ЗАГЛУШКА** (alert)
- Иконка "Открыть чат" — переход на детальную страницу
- Иконка "Ответить AI" — **НЕ РАБОТАЕТ** (пустая функция)

---

### 2. Детальный просмотр чата

**Локация:** `src/app/stores/[storeId]/chats/[chatId]/page.tsx`

#### ✅ Работает:

**Отображение:**
- Шапка с именем клиента и названием товара
- Выбор тега (dropdown select) с мгновенным обновлением
- Badge текущего тега
- ScrollArea для истории сообщений (400px высота)
- Разделение сообщений клиента/продавца:
  - Клиент: серый фон (bg-muted), иконка User
  - Продавец: голубой фон (bg-primary/10), иконка Bot
- Временные метки для каждого сообщения (формат "dd.MM.yyyy HH:mm")

**Отправка сообщений:**
- Textarea для ввода текста
- Кнопка "Отправить в WB"
- Валидация (нельзя отправить пустое сообщение)
- Loading state во время отправки
- Toast уведомления (успех/ошибка)
- Автообновление через 1 секунду после отправки

**Обновление тега:**
- Dropdown select с опциями: Активный | Успешный | Неуспешный | Без ответа | Без тега
- PUT запрос на `/api/stores/[storeId]/chats/[chatId]`
- Мгновенное обновление UI
- Toast уведомления

#### ❌ Отсутствует:

- AI генерация ответа (функция есть, но не вызывается)
- Редактирование сгенерированного ответа
- Черновики ответов (draft_reply не используется)
- Быстрые шаблоны ответов
- Keyboard shortcuts (Enter для отправки)
- Предпросмотр вложений (download_id не используется)

---

### 3. API Endpoints

#### GET `/api/stores/[storeId]/chats`

**Функция:** Получение списка чатов с пагинацией и фильтрами

**Query Parameters:**
- `skip` (integer, default: 0) — offset для пагинации
- `take` (integer, default: 100, max: 500) — limit записей
- `tag` (string, default: 'all') — фильтр по тегу
- `search` (string, default: '') — поисковый запрос

**Response:**
```json
{
  "data": [
    {
      "id": "chat123",
      "storeId": "store456",
      "clientName": "Иван Петров",
      "productNmId": "123456789",
      "productName": "Кроссовки Nike Air Max",
      "productVendorCode": "NKE-001",
      "lastMessageDate": "2026-01-16T10:30:00Z",
      "lastMessageText": "Когда придёт заказ?",
      "lastMessageSender": "client",
      "tag": "active",
      "draftReply": null
    }
  ],
  "totalCount": 150
}
```

**Производительность:**
- SQL запрос с пагинацией
- Фильтрация на уровне базы данных
- Индексы для быстрого поиска

#### GET `/api/stores/[storeId]/chats/[chatId]`

**Функция:** Получение конкретного чата с историей сообщений

**Response:**
```json
{
  "data": {
    "chat": { /* Chat object */ },
    "messages": [
      {
        "id": "msg1",
        "chat_id": "chat123",
        "text": "Здравствуйте!",
        "sender": "client",
        "timestamp": "2026-01-16T10:00:00Z"
      }
    ]
  }
}
```

#### POST `/api/stores/[storeId]/chats/[chatId]/send`

**Функция:** Отправка сообщения в WB Chat API

**Request Body:**
```json
{
  "message": "Ваш заказ в пути!"
}
```

**WB API Integration:**
- FormData с `replySign` и `message`
- Эндпоинт: `https://buyer-chat-api.wildberries.ru/api/v1/seller/message`
- Authorization через `chat_api_token` или `api_token` магазина
- Обработка ошибок WB API

#### POST `/api/stores/[storeId]/chats/classify-all`

**Функция:** Массовая AI классификация чатов

**Query Parameters:**
- `limit` (integer, optional) — макс. чатов для классификации
- `force` (boolean, default: false) — классифицировать даже уже размеченные

**Процесс:**
1. Получить чаты (все или только untagged)
2. Для каждого чата:
   - Загрузить историю сообщений
   - Построить контекст (chatHistory)
   - Вызвать `classifyChatTag()` AI flow
   - Сохранить тег в БД
3. Пересчитать статистику тегов в `store.chat_tag_counts`

**Response:**
```json
{
  "message": "AI classification complete: 65 successful, 2 failed, 1 skipped (out of 68 total)",
  "stats": {
    "total": 68,
    "successful": 65,
    "failed": 2,
    "skipped": 1,
    "tagDistribution": {
      "active": 15,
      "successful": 30,
      "unsuccessful": 8,
      "no_reply": 10,
      "untagged": 2
    }
  }
}
```

#### POST `/api/stores/[storeId]/dialogues/update`

**Функция:** Синхронизация чатов с WB API

**Процесс:**
1. Получить список чатов из WB Chat API
2. Получить события (сообщения) для каждого чата
3. Upsert в таблицы `chats` и `chat_messages`
4. Обновить `last_message_*` поля

**Вызывается:**
- Вручную кнопкой "Обновить чаты"
- (Потенциально) CRON задачей (не настроено)

---

### 4. AI Flows

#### `generateChatReply()` — Генерация ответа

**Файл:** `src/ai/flows/generate-chat-reply-flow.ts`

**Input:**
```typescript
{
  context: string,     // Полный контекст: история чата + инфо о товаре
  storeId: string,
  ownerId: string,
  chatId: string
}
```

**Output:**
```typescript
{
  text: string         // Сгенерированный ответ
}
```

**Процесс:**
1. Загрузить промпт из `settings.prompt_chat_reply`
2. Вызвать Deepseek API с контекстом
3. Логировать в `ai_logs` таблицу
4. Вернуть текст ответа

**Статус:** ⚠️ Функция работает, но **НЕ ВЫЗЫВАЕТСЯ** нигде в UI

#### `classifyChatTag()` — Классификация тега

**Файл:** `src/ai/flows/classify-chat-tag-flow.ts`

**Input:**
```typescript
{
  chatHistory: string,  // История переписки
  storeId: string,
  ownerId: string,
  chatId: string
}
```

**Output:**
```typescript
{
  tag: 'active' | 'successful' | 'unsuccessful' | 'untagged' | 'no_reply' | 'completed'
}
```

**Процесс:**
1. Проверка на пустую историю (< 10 символов → untagged)
2. Загрузить промпт из `settings.prompt_chat_tag`
3. Вызвать Deepseek API в JSON mode
4. Валидация с Zod schema
5. Fallback к untagged при ошибках

**Статус:** ✅ Работает, используется в `/classify-all` API

---

## Нереализованные функции

### 1. AI Генерация ответов в UI

**Что НЕ работает:**
- Кнопка "Ответить AI" в таблице (line 724-726) — пустая функция
- Нет компонента для отображения AI suggestion
- Нет редактирования сгенерированного ответа
- Нет перегенерации

**Что уже есть:**
- ✅ Функция `generateChatReply()` в AI flows
- ✅ Промпт `settings.prompt_chat_reply` в БД
- ✅ Deepseek API интеграция
- ✅ Логирование AI операций

**Что нужно:**
- Создать UI компонент для AI suggestion box
- Добавить кнопки: Редактировать | Использовать | Перегенерировать
- Интегрировать в страницу детального чата
- Сохранять в `draft_reply`

### 2. Режим Мессенджера

**Что отсутствует:**
- Полностью весь режим мессенджера
- Split-view (список чатов + активный чат)
- Быстрая навигация между чатами
- Keyboard shortcuts

**Прецеденты:** WhatsApp Web, Telegram Web, Intercom

### 3. Массовая AI классификация из UI

**Что НЕ работает:**
- Кнопка "Классифицировать все AI" (line 339-341) — alert заглушка

**Что уже есть:**
- ✅ API endpoint `/classify-all`
- ✅ AI flow `classifyChatTag()`

**Что нужно:**
- Подключить кнопку к API
- Показать progress bar (X из Y чатов обработано)
- Toast с результатом

### 4. Черновики ответов

**Что НЕ работает:**
- Поле `draft_reply` в БД заполнено, но нигде не отображается
- Нет автосохранения при наборе текста

**Что нужно:**
- Показывать сохранённый черновик при открытии чата
- Автосохранение каждые 2-3 секунды
- Индикатор "Сохранено" / "Сохранение..."

### 5. Шаблоны быстрых ответов

**Что отсутствует:**
- Готовые шаблоны ("Здравствуйте!", "Спасибо за обращение!")
- Быстрая вставка по hotkey или кнопке

### 6. Real-time обновления

**Что отсутствует:**
- WebSocket для мгновенных обновлений
- Уведомления о новых сообщениях
- Звуковые алерты

---

## Проблемы и боли пользователей

### 🔴 Критические проблемы

#### 1. Низкая скорость работы менеджеров

**Проблема:**
- Нужно кликать на каждый чат → открывать детальную страницу → прокручивать → ответить → вернуться назад
- При 50+ чатах в день это 100+ кликов и 50+ переходов между страницами
- Нет быстрого просмотра истории без перехода

**Метрика:** Время ответа на 1 чат = ~2-3 минуты (50% на навигацию, 50% на набор текста)

**User Story:**
> "Как менеджер, я хочу видеть список чатов и активный чат на одном экране, чтобы быстро переключаться между диалогами без потери контекста."

#### 2. AI генерация не автоматизирована

**Проблема:**
- AI функция есть, но кнопка не работает
- Нужно вручную придумывать ответы на типовые вопросы
- Нет подсказок AI

**Метрика:** 0% чатов обрабатываются с помощью AI (хотя функция реализована)

**User Story:**
> "Как менеджер, я хочу нажать одну кнопку 'Ответить AI' и получить готовый ответ, который могу отредактировать и отправить."

#### 3. Нет контекста при ответе

**Проблема:**
- При написании ответа не видно:
  - Информацию о товаре
  - Полную историю чата (нужно скроллить)
  - Предыдущие ответы продавца (для консистентности тона)

**User Story:**
> "Как менеджер, я хочу видеть информацию о товаре и историю чата одновременно с полем ответа, чтобы дать релевантный ответ."

### 🟡 Средние проблемы

#### 4. Таблица не масштабируется

**Проблема:**
- При 100+ чатах сложно найти нужный
- Нет группировки по товарам или срочности
- Фильтры помогают, но не решают проблему полностью

**Метрика:** При 150+ чатах нужно 5+ кликов по пагинации для просмотра всех

#### 5. Нет приоритизации

**Проблема:**
- Все чаты равны по важности
- Нет индикации срочности ("ждёт ответа 2 часа")
- Нет SLA мониторинга

**User Story:**
> "Как менеджер, я хочу видеть чаты, требующие срочного ответа, вверху списка, чтобы не пропустить важные обращения."

#### 6. Нет аналитики

**Проблема:**
- Сколько времени менеджер тратит на ответ? Неизвестно
- Какие чаты игнорируются долго? Не видно
- Conversion rate чатов в successful? Нет данных

### 🟢 Минорные проблемы

#### 7. Mobile UX

**Проблема:**
- Таблица плохо адаптирована под мобильные устройства
- Нужно скроллить горизонтально

#### 8. Отсутствие уведомлений

**Проблема:**
- Нет звуковых уведомлений о новых сообщениях
- Нужно вручную нажимать "Обновить чаты"

---

## Выводы и рекомендации

### ✅ Что работает хорошо

1. **Технический фундамент крепкий:**
   - React Query кеширование оптимизировано
   - API endpoints хорошо структурированы
   - AI flows реализованы и готовы к использованию
   - Database schema нормализована и индексирована

2. **Табличный режим функционален:**
   - Все фильтры работают
   - Пагинация smooth
   - Поиск debounced

3. **Интеграция с WB API стабильная:**
   - Синхронизация работает
   - Отправка сообщений работает

### 🔧 Что нужно улучшить (Priority)

#### P0 (Critical) — Must Have для MVP
1. **Режим мессенджера** — split-view для быстрой работы
2. **AI генерация ответов** — подключить к UI с редактированием
3. **Контекстное отображение** — товар + история + поле ответа на одном экране

#### P1 (High) — Should Have
4. **Массовая AI классификация** — подключить кнопку к API
5. **Черновики** — автосохранение и отображение
6. **Keyboard shortcuts** — Enter для отправки, Ctrl+E для AI

#### P2 (Medium) — Could Have
7. **Шаблоны ответов** — быстрые фразы
8. **Приоритизация** — срочные чаты вверху
9. **Mobile адаптация** — оптимизация под телефоны

#### P3 (Low) — Won't Have (в MVP)
10. **Real-time** — WebSocket обновления
11. **Аналитика** — dashboard менеджеров
12. **Bulk actions** — массовые операции

### 🎯 Стратегия развития

**Подход:** Design-First

1. **Этап 1:** Прототипирование режима мессенджера
2. **Этап 2:** Согласование UI/UX с командой
3. **Этап 3:** Разбивка на спринты и фичи
4. **Этап 4:** Итеративная разработка с user testing

### 📊 Ожидаемые метрики после MVP

| Метрика | Текущее | Цель MVP | Метод измерения |
|---------|---------|----------|-----------------|
| Время ответа на чат | ~2-3 мин | ~30-60 сек | Таймер в AI logs |
| Использование AI | 0% | 60-70% | Счётчик AI генераций |
| Чатов обработано в час | ~20-25 | ~60-80 | Analytics dashboard |
| Конверсия в successful | Неизвестно | Baseline + трекинг | Tag analytics |

---

## Следующие шаги

1. ✅ Анализ текущего состояния завершён
2. 🔄 Создание UI/UX прототипов (следующий документ)
3. ⏳ Feature Specification
4. ⏳ Implementation Roadmap

---

**Вопросы и обратная связь:** [GitHub Issues](https://github.com/Klimov-IS/R5-Saas-v-2.0/issues)
