# Task Management Center - Техническая документация

**Дата создания**: 2026-01-20
**Статус**: MVP реализован, готов к дальнейшему развитию
**Версия**: 1.0

---

## 📋 Обзор

Task Management Center — центр управления задачами для менеджеров интернет-магазинов на Wildberries. Система позволяет:

- Отслеживать задачи по работе с отзывами, диалогами, вопросами
- Управлять жалобами (генерация, отправка, проверка)
- Контролировать сроки выполнения
- Фильтровать и сортировать задачи по различным критериям
- Просматривать KPI и статистику

### Текущее состояние

✅ **Реализовано:**
- Полнофункциональный UI (список задач, фильтры, поиск, сортировка)
- CRUD операции через API (создание, чтение, обновление, удаление задач)
- PostgreSQL backend (таблица `manager_tasks`)
- KPI дашборд (всего задач, жалобы, диалоги, просроченные)
- Модальное окно создания задач
- Изменение статусов задач inline

❌ **Не реализовано:**
- Колонка "Товар" (показывает placeholder "—")
- Детальная страница задачи (клик по задаче не открывает детали)
- Автоматическое создание задач из CRON jobs
- Автоматическое создание задач при классификации чатов
- Пагинация (при большом количестве задач)
- Bulk actions (массовое изменение статусов)

---

## 🛠 Технический стек

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: React с inline styles (готово к миграции на Tailwind CSS)
- **Icons**: lucide-react
- **State Management**: useState, useEffect (локальный state)

### Backend
- **Database**: PostgreSQL (Yandex.Cloud Managed PostgreSQL)
- **API**: Next.js API Routes
- **ORM/Query Builder**: Нет, используются прямые SQL запросы через pg
- **Database Client**: `src/db/client.ts` (pg pool)

### UI компоненты
- `src/app/tasks/page.tsx` — главная страница списка задач
- `src/components/tasks/TaskKPICard.tsx` — карточки KPI
- `src/components/tasks/CreateTaskModal.tsx` — модальное окно создания задачи

---

## 🗄 База данных

### Схема таблицы `manager_tasks`

```sql
CREATE TABLE manager_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Связанная сущность
  entity_type TEXT NOT NULL CHECK (entity_type IN ('review', 'chat', 'question')),
  entity_id UUID NOT NULL,

  -- Действие и статус
  action TEXT NOT NULL CHECK (action IN (
    'generate_complaint',
    'submit_complaint',
    'check_complaint',
    'reply_to_chat',
    'reply_to_question'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low',
    'normal',
    'high',
    'urgent'
  )),

  -- Метаданные
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,

  -- Даты
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Индексы для производительности
  INDEX idx_manager_tasks_user_status (user_id, status),
  INDEX idx_manager_tasks_store (store_id),
  INDEX idx_manager_tasks_entity (entity_type, entity_id),
  INDEX idx_manager_tasks_due_date (due_date)
);
```

### Типы данных

**entity_type** — тип связанной сущности:
- `review` — задача связана с отзывом
- `chat` — задача связана с диалогом
- `question` — задача связана с вопросом покупателя

**action** — тип действия:
- `generate_complaint` — сгенерировать черновик жалобы
- `submit_complaint` — отправить жалобу в WB
- `check_complaint` — проверить статус жалобы
- `reply_to_chat` — ответить на диалог с покупателем
- `reply_to_question` — ответить на вопрос покупателя

**status** — статус выполнения:
- `pending` — ожидает выполнения
- `in_progress` — в работе
- `completed` — завершено
- `cancelled` — отменено

**priority** — приоритет:
- `low` — низкий
- `normal` — средний (по умолчанию)
- `high` — высокий
- `urgent` — срочно

---

## 🔌 API Routes

### GET `/api/tasks`

**Описание**: Получить список задач с фильтрами

**Headers**:
```
Authorization: Bearer {API_KEY}
```

**Query Parameters**:
- `storeId` (optional) — фильтр по магазину
- `status` (optional) — фильтр по статусу (`pending`, `in_progress`, `completed`, `cancelled`)
- `entityType` (optional) — фильтр по типу сущности (`review`, `chat`, `question`)
- `action` (optional) — фильтр по действию
- `limit` (optional, default: 100) — лимит записей
- `offset` (optional, default: 0) — смещение для пагинации

**Response**:
```json
{
  "success": true,
  "tasks": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "store_id": "uuid",
      "entity_type": "review",
      "entity_id": "uuid",
      "action": "generate_complaint",
      "status": "pending",
      "priority": "high",
      "title": "Сгенерировать жалобу на отзыв 1★",
      "description": "Отзыв от пользователя 'Иван П.'",
      "notes": null,
      "due_date": "2026-01-21T10:00:00Z",
      "completed_at": null,
      "created_at": "2026-01-20T12:00:00Z",
      "updated_at": "2026-01-20T12:00:00Z"
    }
  ],
  "count": 1
}
```

### POST `/api/tasks`

**Описание**: Создать новую задачу

**Headers**:
```
Authorization: Bearer {API_KEY}
Content-Type: application/json
```

**Body**:
```json
{
  "store_id": "uuid",
  "entity_type": "review",
  "entity_id": "uuid",
  "action": "generate_complaint",
  "title": "Сгенерировать жалобу на отзыв 1★",
  "description": "Отзыв от пользователя 'Иван П.'",
  "priority": "high",
  "due_date": "2026-01-21T10:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "task": {
    "id": "uuid",
    "status": "pending",
    ...
  }
}
```

### PATCH `/api/tasks/[taskId]`

**Описание**: Обновить задачу (изменить статус, приоритет, сроки)

**Headers**:
```
Authorization: Bearer {API_KEY}
Content-Type: application/json
```

**Body**:
```json
{
  "status": "completed",
  "notes": "Жалоба успешно отправлена"
}
```

**Response**:
```json
{
  "success": true,
  "task": {
    "id": "uuid",
    "status": "completed",
    "completed_at": "2026-01-20T14:30:00Z",
    ...
  }
}
```

### GET `/api/tasks/stats`

**Описание**: Получить статистику по задачам

**Headers**:
```
Authorization: Bearer {API_KEY}
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalTasks": 45,
    "pendingTasks": 12,
    "inProgressTasks": 8,
    "overdueTasks": 3,
    "complaintsTasks": 25,
    "chatsTasks": 20
  }
}
```

---

## 🎨 Frontend архитектура

### Главная страница: `src/app/tasks/page.tsx`

**Компоненты**:
1. **Header с поиском** — заголовок "📋 Список задач (X)" + search input
2. **KPI Cards** — 4 карточки со статистикой
3. **Filters + Create Button** — фильтры (магазин, статус, действие, сортировка) + кнопка "Создать задачу"
4. **Tasks Table** — таблица с колонками:
   - Задача (title + description)
   - Магазин (store name)
   - Товар (placeholder "—", не реализовано)
   - Действие (badge с цветом)
   - Статус (badge с иконкой)
   - Приоритет (цветной текст)
   - Срок (дата + индикатор просрочки)
   - Действия (кнопки "Начать" / "Завершить")

**State управление**:
```typescript
const [tasks, setTasks] = useState<Task[]>([]);
const [stats, setStats] = useState<TaskStats | null>(null);
const [stores, setStores] = useState<Store[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [filterStatus, setFilterStatus] = useState<string>('all');
const [filterAction, setFilterAction] = useState<string>('all');
const [filterStore, setFilterStore] = useState<string>('all');
const [sortBy, setSortBy] = useState<string>('created_desc');
const [searchQuery, setSearchQuery] = useState<string>('');
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
```

**Основные функции**:

```typescript
// Загрузка данных с сервера
const fetchData = async () => {
  const params = new URLSearchParams();
  if (filterStatus !== 'all') params.append('status', filterStatus);
  if (filterAction !== 'all') params.append('action', filterAction);
  if (filterStore !== 'all') params.append('storeId', filterStore);

  const tasksRes = await fetch(`/api/tasks?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const tasksData = await tasksRes.json();

  // Client-side search filtering
  let filteredTasks = tasksData.tasks;
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter((task: Task) =>
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    );
  }

  const sortedTasks = sortTasks(filteredTasks, sortBy);
  setTasks(sortedTasks);
};

// Обновление статуса задачи
const updateTaskStatus = async (taskId: string, status: Task['status']) => {
  await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (status === 'completed') {
    // Auto-set completed_at on backend
  }

  fetchData(); // Refresh data
};
```

### Модальное окно: `src/components/tasks/CreateTaskModal.tsx`

**Props**:
```typescript
interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiKey: string;
}
```

**Форма создания задачи**:
- Store selection (dropdown)
- Action type (dropdown)
- Title (text input)
- Description (textarea)
- Priority (dropdown)
- Due date (date picker)

**Валидация**:
- Store, action, title — обязательные поля
- Due date — опциональное
- Description — опциональное

### KPI карточка: `src/components/tasks/TaskKPICard.tsx`

**Props**:
```typescript
interface TaskKPICardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: number;
  bgColor: string;
  iconColor: string;
}
```

**Пример использования**:
```tsx
<TaskKPICard
  icon={ListTodo}
  label="Всего задач"
  value={stats.totalTasks}
  bgColor="#EFF6FF"
  iconColor="#3B82F6"
/>
```

---

## 🔍 Фильтрация и сортировка

### Фильтры

**1. Фильтр по магазину**:
- `all` — все магазины
- `{storeId}` — конкретный магазин

**2. Фильтр по статусу**:
- `all` — все статусы
- `pending` — ожидает
- `in_progress` — в работе
- `completed` — завершено
- `cancelled` — отменено

**3. Фильтр по действию**:
- `all` — все действия
- `generate_complaint` — генерация жалобы
- `submit_complaint` — подача жалобы
- `check_complaint` — проверка жалобы
- `reply_to_chat` — ответ на диалог

### Сортировка

- `created_desc` — по дате создания (новые первые) — **по умолчанию**
- `created_asc` — по дате создания (старые первые)
- `priority_desc` — по приоритету (срочные первые)
- `priority_asc` — по приоритету (низкие первые)
- `due_date_asc` — по сроку (ближайшие первые)
- `due_date_desc` — по сроку (дальние первые)

### Поиск

Client-side поиск по полям:
- `task.title` — заголовок задачи
- `task.description` — описание задачи

**Пример**: Ввод "жалоба" найдет все задачи с "жалоба" в заголовке или описании.

---

## 🚧 Недоработки и TODO

### 1. Колонка "Товар" (Priority: P2, LOW)

**Текущее состояние**: Показывает "—" (placeholder)

**Проблема**:
- В таблице `manager_tasks` нет поля `product_id`
- Товар можно получить только через связанную сущность (review/chat → product_id)

**Решение**:
```typescript
// Вариант 1: Добавить product_id в manager_tasks (денормализация)
ALTER TABLE manager_tasks ADD COLUMN product_id UUID REFERENCES products(id);

// Вариант 2: JOIN через entity_id
const getTasksWithProducts = async (userId: string) => {
  const sql = `
    SELECT
      t.*,
      p.name as product_name,
      p.vendor_code as product_vendor_code
    FROM manager_tasks t
    LEFT JOIN reviews r ON t.entity_type = 'review' AND t.entity_id = r.id
    LEFT JOIN chats c ON t.entity_type = 'chat' AND t.entity_id = c.id
    LEFT JOIN products p ON (r.product_id = p.id OR c.product_nm_id = p.wb_product_id)
    WHERE t.user_id = $1
  `;
  // ...
};
```

**Рекомендация**: Вариант 2 (JOIN) — не дублируем данные, одна точка истины.

### 2. Детальная страница задачи (Priority: P1, MEDIUM)

**Текущее состояние**: Клик по задаче ничего не делает

**Что нужно**:
- Страница `/tasks/[taskId]`
- Отображение полной информации о задаче
- Связанная сущность (отзыв/чат/вопрос) с возможностью просмотра
- История изменений статуса
- Добавление заметок
- Выполнение действия прямо из задачи

**Пример**:
```tsx
// src/app/tasks/[taskId]/page.tsx
export default function TaskDetailPage({ params }: { params: { taskId: string } }) {
  const [task, setTask] = useState<Task | null>(null);
  const [entity, setEntity] = useState<Review | Chat | Question | null>(null);

  useEffect(() => {
    // Fetch task
    fetch(`/api/tasks/${params.taskId}`, { headers: { Authorization: `Bearer ${apiKey}` } })
      .then(res => res.json())
      .then(data => setTask(data.task));

    // Fetch related entity
    if (task?.entity_type === 'review') {
      fetch(`/api/reviews/${task.entity_id}`, ...)
        .then(res => res.json())
        .then(data => setEntity(data.review));
    }
  }, [params.taskId]);

  return (
    <div>
      <h1>{task?.title}</h1>
      <p>{task?.description}</p>

      {/* Related entity preview */}
      {task?.entity_type === 'review' && entity && (
        <ReviewPreview review={entity} />
      )}

      {/* Action buttons */}
      {task?.action === 'generate_complaint' && (
        <button onClick={generateComplaint}>Сгенерировать жалобу</button>
      )}
    </div>
  );
}
```

### 3. Интеграция с CRON jobs (Priority: P0, HIGH)

**Проблема**: CRON автоматически генерирует жалобы, но не создает задачи для проверки

**Решение**: Модифицировать `src/lib/cron-jobs.ts`

```typescript
// В функции generateComplaintsForStore()
async function generateComplaintsForStore(storeId: string, storeName: string) {
  // ... existing code ...

  const result = await response.json();

  // NEW: Create tasks for generated complaints
  for (const generated of result.generated) {
    await dbHelpers.createManagerTask({
      user_id: userId, // Получить из store owner_id
      store_id: storeId,
      entity_type: 'review',
      entity_id: generated.review_id,
      action: 'check_complaint', // или 'submit_complaint'
      title: `Проверить жалобу на отзыв ${generated.rating}★`,
      description: `Автоматически сгенерирована жалоба для товара ${generated.product_name}`,
      priority: 'high',
      status: 'pending',
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 hours
      notes: null,
    });
  }

  return { generated: result.generated.length, ... };
}
```

### 4. Автоматическое создание задач из диалогов (Priority: P0, HIGH)

**Где**: При классификации чатов через `/api/stores/[storeId]/chats/classify-all`

**Решение**:
```typescript
// В src/app/api/stores/[storeId]/chats/classify-all/route.ts

for (const chat of chats) {
  const classification = await classifyChat(chat);

  // Update chat tag
  await dbHelpers.updateChat(chat.id, { tag: classification.tag });

  // NEW: Create task if chat needs reply
  if (classification.tag === 'active' || classification.tag === 'unsuccessful') {
    await dbHelpers.createManagerTask({
      user_id: settings.id,
      store_id: storeId,
      entity_type: 'chat',
      entity_id: chat.id,
      action: 'reply_to_chat',
      title: `Ответить на диалог с ${chat.client_name}`,
      description: chat.last_message_text || '',
      priority: classification.tag === 'active' ? 'high' : 'normal',
      status: 'pending',
      due_date: new Date(Date.now() + 12 * 60 * 60 * 1000), // +12 hours
      notes: null,
    });
  }
}
```

### 5. Пагинация (Priority: P1, MEDIUM)

**Проблема**: При 100+ задач страница становится медленной

**Решение**:
```typescript
// Frontend
const [page, setPage] = useState(0);
const LIMIT = 50;

const fetchData = async () => {
  const params = new URLSearchParams();
  params.append('limit', LIMIT.toString());
  params.append('offset', (page * LIMIT).toString());
  // ... filters ...

  const tasksRes = await fetch(`/api/tasks?${params}`, ...);
  // ...
};

// UI
<div className="pagination">
  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
    Предыдущая
  </button>
  <span>Страница {page + 1}</span>
  <button onClick={() => setPage(p => p + 1)} disabled={tasks.length < LIMIT}>
    Следующая
  </button>
</div>
```

### 6. Bulk actions (Priority: P2, LOW)

**Что нужно**:
- Checkbox для выбора нескольких задач
- Действия: "Отметить выполненными", "Изменить приоритет", "Удалить"

**Пример**:
```typescript
const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

const bulkUpdateStatus = async (status: TaskStatus) => {
  await Promise.all(
    selectedTasks.map(taskId =>
      fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { ... },
        body: JSON.stringify({ status }),
      })
    )
  );

  setSelectedTasks([]);
  fetchData();
};
```

---

## 🎯 Рекомендованный план развития

### Фаза 1: Автоматизация (1-2 недели)
**Цель**: 100% автоматизация создания задач

1. ✅ **Интеграция с CRON jobs**
   - Автоматическое создание задач при генерации жалоб
   - Приоритет: HIGH, Due date: +24h

2. ✅ **Автоматическое создание из диалогов**
   - При классификации чата как "active" → создать задачу "reply_to_chat"
   - Приоритет зависит от тега чата

**Результат**: Менеджер видит все задачи автоматически, без ручного создания

### Фаза 2: Детальная страница (1 неделя)
**Цель**: Полноценная работа с задачей

3. ✅ **Task Detail Page**
   - Маршрут `/tasks/[taskId]`
   - Просмотр связанной сущности (отзыв/чат/вопрос)
   - Выполнение действий прямо из задачи
   - История изменений

**Результат**: Менеджер может выполнять задачу без переходов между страницами

### Фаза 3: Масштабирование (1-2 недели)
**Цель**: Работа с большим объемом задач

4. ✅ **Пагинация**
   - Limit 50 задач на страницу
   - "Предыдущая" / "Следующая" кнопки

5. ✅ **Bulk actions**
   - Checkbox для выбора задач
   - Массовое изменение статуса

6. ✅ **Колонка "Товар"**
   - JOIN через entity_id → reviews/chats → products
   - Отображение названия и артикула

**Результат**: Эффективная работа с 500+ задачами

### Фаза 4: Уведомления (опционально)
**Цель**: Не пропускать важные задачи

7. ✅ **Email уведомления**
   - Еженедельный отчет о просроченных задачах
   - Уведомление при создании срочной задачи

8. ✅ **Dashboard badge**
   - Красный badge с количеством просроченных
   - Индикатор в навигации

---

## 🧪 Как тестировать

### 1. Создание задачи вручную

```bash
# Открыть http://localhost:9002/tasks
# Нажать "Создать задачу"
# Заполнить форму:
#   - Store: выбрать магазин
#   - Action: "Генерация жалобы"
#   - Title: "Тестовая задача"
#   - Priority: "Высокий"
# Нажать "Создать"
```

### 2. Проверка фильтров

```bash
# Выбрать фильтр "Статус: Ожидает"
# Убедиться, что показываются только pending задачи

# Выбрать "Действие: Генерация жалобы"
# Убедиться, что показываются только generate_complaint задачи

# Ввести в поиск "жалоба"
# Убедиться, что фильтруется по title/description
```

### 3. Изменение статуса

```bash
# Найти задачу со статусом "Ожидает"
# Нажать кнопку "Начать"
# Убедиться, что статус изменился на "В работе"
# Нажать кнопку "Завершить"
# Убедиться, что статус изменился на "Завершено"
```

### 4. KPI дашборд

```bash
# Создать несколько задач с разными статусами и actions
# Убедиться, что KPI карточки обновляются:
#   - "Всего задач" = COUNT(*)
#   - "Жалобы" = COUNT(action IN ('generate_complaint', 'submit_complaint', 'check_complaint'))
#   - "Диалоги" = COUNT(action = 'reply_to_chat')
#   - "Просрочено" = COUNT(due_date < NOW() AND status NOT IN ('completed', 'cancelled'))
```

---

## 📝 Примеры кода

### Создание задачи программно

```typescript
import * as dbHelpers from '@/db/helpers';

async function createTaskForReview(reviewId: string, storeId: string, userId: string) {
  const task = await dbHelpers.createManagerTask({
    user_id: userId,
    store_id: storeId,
    entity_type: 'review',
    entity_id: reviewId,
    action: 'generate_complaint',
    title: 'Сгенерировать жалобу на негативный отзыв',
    description: 'Отзыв 1★ от покупателя',
    priority: 'high',
    status: 'pending',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 hours
    notes: null,
  });

  console.log('Task created:', task.id);
}
```

### Получение задач с фильтрами

```typescript
import * as dbHelpers from '@/db/helpers';

async function getPendingComplaintTasks(userId: string, storeId: string) {
  const tasks = await dbHelpers.getManagerTasks(userId, {
    storeId,
    status: 'pending',
    action: 'generate_complaint',
    limit: 50,
    offset: 0,
  });

  return tasks;
}
```

### Обновление статуса задачи

```typescript
import * as dbHelpers from '@/db/helpers';

async function completeTask(taskId: string) {
  const updatedTask = await dbHelpers.updateManagerTask(taskId, {
    status: 'completed',
    notes: 'Задача выполнена успешно',
    // completed_at автоматически установится в NOW() на backend
  });

  return updatedTask;
}
```

---

## 🔧 Конфигурация

### Environment Variables

```bash
# Database
POSTGRES_URL="postgresql://user:password@host:port/database"

# API Key для аутентификации
NEXT_PUBLIC_API_KEY="wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Base URL для CRON jobs
NEXT_PUBLIC_BASE_URL="http://localhost:9002"

# Node environment
NODE_ENV="development" # или "production"
```

### Database Migrations

Если нужно создать таблицу `manager_tasks`:

```sql
-- Run this SQL in your PostgreSQL database
-- (Already exists, this is for reference only)

CREATE TABLE manager_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('review', 'chat', 'question')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('generate_complaint', 'submit_complaint', 'check_complaint', 'reply_to_chat', 'reply_to_question')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manager_tasks_user_status ON manager_tasks(user_id, status);
CREATE INDEX idx_manager_tasks_store ON manager_tasks(store_id);
CREATE INDEX idx_manager_tasks_entity ON manager_tasks(entity_type, entity_id);
CREATE INDEX idx_manager_tasks_due_date ON manager_tasks(due_date);
```

---

## 🐛 Troubleshooting

### Задачи не загружаются

**Проблема**: Пустой экран или "Загрузка..." не проходит

**Решение**:
1. Проверить API key в браузере: `localStorage.getItem('api_key')`
2. Проверить console в DevTools на ошибки
3. Проверить Network tab: статус 200 или ошибка?
4. Проверить database connection:
   ```bash
   PGPASSWORD="$POSTGRES_PASSWORD" psql -h "rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net" -p 6432 -U admin_R5 -d wb_reputation -c "SELECT COUNT(*) FROM manager_tasks;"
   ```

### Фильтры не работают

**Проблема**: Выбор фильтра не меняет список задач

**Решение**:
1. Проверить useEffect dependencies в `src/app/tasks/page.tsx`:
   ```typescript
   useEffect(() => {
     fetchData();
   }, [filterStatus, filterAction, filterStore, sortBy, searchQuery]);
   ```
2. Убедиться, что `fetchData()` использует актуальные значения фильтров

### Статус не обновляется

**Проблема**: Клик "Начать" / "Завершить" не меняет статус

**Решение**:
1. Проверить API endpoint `/api/tasks/[taskId]` в Network tab
2. Проверить, что `updateTaskStatus()` вызывает `fetchData()` после успешного обновления
3. Проверить, что backend правильно устанавливает `completed_at` при статусе "completed"

### KPI не обновляются

**Проблема**: Карточки KPI показывают неверные цифры

**Решение**:
1. Проверить `/api/tasks/stats` endpoint
2. Проверить SQL запрос в `src/db/helpers.ts` → `getManagerTaskStats()`
3. Убедиться, что фильтр `status != 'completed' AND status != 'cancelled'` корректен

---

## 📚 Связанная документация

- **Database Schema**: `docs/database-schema.md`
- **API Routes**: `docs/DEVELOPMENT.md`
- **CRON Jobs**: `docs/CRON_JOBS.md`
- **UI Design System**: `docs/UI_DESIGN_SYSTEM.md`

---

## ✅ Checklist для развития

### Короткий срок (1-2 недели)
- [ ] Интеграция создания задач из CRON jobs (генерация жалоб)
- [ ] Интеграция создания задач при классификации чатов
- [ ] Детальная страница задачи `/tasks/[taskId]`

### Средний срок (3-4 недели)
- [ ] Пагинация (50 задач на страницу)
- [ ] Колонка "Товар" с реальными данными
- [ ] Bulk actions (массовое изменение статусов)

### Долгий срок (1-2 месяца)
- [ ] Email уведомления о просроченных задачах
- [ ] Dashboard badge с просроченными задачами
- [ ] История изменений задачи (audit log)
- [ ] Экспорт задач в CSV/Excel

---

## 🚀 Активные задачи разработки

### Chrome Extension Integration (Priority: P0, CRITICAL)

**Статус**: В разработке, BLOCKED

**Проблема**:
- WB откатил интерфейс продавца на старую версию (27 января 2026)
- Текущий парсер (PageParser v2) работал только с новым интерфейсом
- Парсер перестал работать после отката

**Следующий шаг**:
1. ⏳ Получить HTML структуру старой версии интерфейса WB (от пользователя)
2. ⏳ Проанализировать различия между старой и новой версиями
3. ⏳ Реализовать `parseReviewsV1()` для старого интерфейса
4. ⏳ Реализовать `detectInterfaceVersion()` для автоматического определения
5. ⏳ Протестировать парсер на обеих версиях интерфейса

**Зависимости**: Требуется HTML от пользователя

**Документация**: `docs/CHROME_EXTENSION_INTEGRATION.md`

**ETA**: 1-2 дня после получения HTML

---

**Последнее обновление**: 2026-01-27
**Автор**: Claude AI (на основе кодовой базы R5 saas-prod)
**Статус**: Документация актуальна для MVP версии 1.0
