# Миграция: Firebase → Yandex Cloud PostgreSQL

**Дата:** 2026-01-05
**Автор:** Claude + Владелец проекта
**Статус:** ✅ ЭТАП 2B Завершён → Начало ЭТАП 3

---

## 1. Цель

Мигрировать WB Reputation Manager с Firebase Firestore на Yandex Cloud Managed PostgreSQL для:
- Снижения затрат на инфраструктуру
- Улучшения производительности запросов
- Получения полного контроля над данными
- Возможности использования SQL для аналитики

---

## 2. Текущее состояние (ЭТАП 2B — Завершён ✅)

### База данных PostgreSQL:
✅ **Создан кластер Yandex Cloud PostgreSQL**
- Host: `rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net:6432`
- Database: `wb_reputation`
- User: `admin_R5`

✅ **Создана схема БД (9 таблиц, 36 индексов)**
- users
- user_settings
- stores
- products
- reviews
- chats
- chat_messages
- questions
- ai_logs

✅ **Импортированы критичные данные**
- 7 пользователей
- 1 user_settings (привязан к валидному пользователю)
- 45 магазинов

✅ **Пустые таблицы (будут заполнены через WB API)**
- products (0 записей — ранее ~18,903)
- reviews (0 записей — ранее ~45,448)
- chats (0 записей — ранее ~3,332)
- chat_messages (0)
- questions (0)
- ai_logs (0)

---

## 3. План миграции кода (ЭТАП 3 — Текущий)

### Архитектура старого проекта (wb-reputation — Firebase)

```
wb-reputation/
├── src/
│   ├── firebase/
│   │   ├── admin.ts                    # Firebase Admin SDK
│   │   ├── client-provider.tsx         # Firebase Client SDK
│   │   ├── firestore/
│   │   │   ├── use-collection.tsx      # Firestore коллекции (React hooks)
│   │   │   └── use-doc.tsx             # Firestore документы (React hooks)
│   │   └── provider.tsx                # Firebase Auth Provider
│   ├── app/
│   │   ├── api/
│   │   │   ├── stores/route.ts         # API: Список магазинов
│   │   │   ├── stores/[storeId]/route.ts
│   │   │   ├── stores/reviews/update-all/route.ts
│   │   │   ├── stores/[storeId]/chats/route.ts
│   │   │   └── wb-proxy/               # WB API прокси-эндпоинты
│   │   ├── page.tsx                    # Главная страница (список магазинов)
│   │   ├── settings/page.tsx           # Настройки (API ключи, промпты)
│   │   └── storeDetail/[storeId]/      # Детали магазина
│   │       ├── reviews/page.tsx        # Отзывы
│   │       ├── chats/page.tsx          # Чаты
│   │       ├── questions/page.tsx      # Вопросы
│   │       └── logs/page.tsx           # AI логи
│   ├── components/                     # UI компоненты
│   ├── ai/                             # AI генерация ответов (Deepseek)
│   └── hooks/                          # Custom React hooks
└── lib/
    └── types.ts                        # TypeScript типы
```

### Ключевые изменения для PostgreSQL

#### 3.1. Создать PostgreSQL клиент и хелперы

**Файлы для создания:**

1. **`src/db/client.ts`** — PostgreSQL клиент (singleton)
   - Использует `pg` (node-postgres)
   - Connection pool для Yandex Cloud PostgreSQL
   - Env переменные из `.env.local`

2. **`src/db/helpers.ts`** — Database helpers
   - Функции для работы с каждой таблицей
   - Замена для `firestore().collection().get()`
   - Типизация с TypeScript

**Пример замены:**

```typescript
// ❌ Старый код (Firebase):
const storesSnapshot = await firestore.collection('stores').get();
const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

// ✅ Новый код (PostgreSQL):
const stores = await dbHelpers.getStores();
```

---

#### 3.2. Адаптировать API Routes

**Файлы для изменения:**

| Старый файл (Firebase) | Новый файл (PostgreSQL) | Задача |
|------------------------|-------------------------|--------|
| `src/app/api/stores/route.ts` | То же | Заменить Firestore на PostgreSQL |
| `src/app/api/stores/[storeId]/route.ts` | То же | Заменить Firestore на PostgreSQL |
| `src/app/api/stores/[storeId]/reviews/route.ts` | То же | Заменить Firestore на PostgreSQL |
| `src/app/api/stores/[storeId]/chats/route.ts` | То же | Заменить Firestore на PostgreSQL |
| `src/app/api/wb-proxy/*` | То же | **Без изменений** (работают с WB API) |

**Изменения:**
- Заменить `getFirebaseAdmin()` на `getPostgresClient()`
- Заменить `firestore().collection()` на `dbHelpers.getStores()` и т.д.
- Сохранить всю бизнес-логику и API контракты

---

#### 3.3. Адаптировать Server Components и Client Components

**Изменения для серверных компонентов:**

```typescript
// ❌ Старый код (Firebase):
import { getFirebaseAdmin } from '@/firebase/admin';

export default async function StorePage() {
  const firestore = getFirebaseAdmin().firestore();
  const storesSnapshot = await firestore.collection('stores').get();
  const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return <StoreList stores={stores} />;
}

// ✅ Новый код (PostgreSQL):
import { dbHelpers } from '@/db/helpers';

export default async function StorePage() {
  const stores = await dbHelpers.getStores();

  return <StoreList stores={stores} />;
}
```

**Изменения для клиентских компонентов:**

```typescript
// ❌ Старый код (Firebase):
import { useCollection } from '@/firebase/firestore/use-collection';

export function StoreList() {
  const { data: stores, loading } = useCollection('stores');

  if (loading) return <Spinner />;
  return <div>{stores.map(s => <StoreCard key={s.id} store={s} />)}</div>;
}

// ✅ Новый код (PostgreSQL):
// Вариант 1: Fetch через API Route
import useSWR from 'swr';

export function StoreList() {
  const { data: stores, isLoading } = useSWR('/api/stores', fetcher);

  if (isLoading) return <Spinner />;
  return <div>{stores.map(s => <StoreCard key={s.id} store={s} />)}</div>;
}

// Вариант 2: Server-side props (если Server Component)
export default async function StoreList() {
  const stores = await dbHelpers.getStores();
  return <div>{stores.map(s => <StoreCard key={s.id} store={s} />)}</div>;
}
```

---

#### 3.4. Удалить Firebase-специфичные файлы

**Файлы для удаления:**
- ❌ `src/firebase/` (вся папка)
- ❌ `firestore.rules`
- ❌ `firestore.indexes.json`
- ❌ `.firebaserc`
- ❌ `apphosting.yaml`
- ❌ `serviceAccountKey.json`

**Файлы для сохранения:**
- ✅ `src/app/` (все компоненты и страницы — адаптировать)
- ✅ `src/components/` (UI компоненты — без изменений)
- ✅ `src/ai/` (AI логика — без изменений)
- ✅ `lib/types.ts` (типы — без изменений)

---

## 4. Пошаговый план выполнения (Sprint Breakdown)

### **Sprint 1: Создание PostgreSQL инфраструктуры** ⏱️ ~2 часа

#### Задачи:

**1.1. Создать PostgreSQL клиент**
- [ ] Создать `src/db/client.ts`
- [ ] Настроить connection pool
- [ ] Протестировать подключение к Yandex Cloud

**1.2. Создать database helpers**
- [ ] Создать `src/db/helpers.ts`
- [ ] Реализовать функции для каждой таблицы:
  - `getUsers()`, `getUserById(id)`
  - `getUserSettings()`, `updateUserSettings(settings)`
  - `getStores()`, `getStoreById(id)`, `createStore(store)`, `updateStore(id, store)`
  - `getProducts(storeId)`, `getProductById(id)`, `createProduct(product)`, `updateProduct(id, product)`
  - `getReviews(productId)`, `getReviewById(id)`, `createReview(review)`, `updateReview(id, review)`
  - `getChats(storeId)`, `getChatById(id)`, `createChat(chat)`, `updateChat(id, chat)`
  - `getChatMessages(chatId)`, `createChatMessage(message)`
  - `getQuestions(storeId)`, `getQuestionById(id)`, `createQuestion(question)`, `updateQuestion(id, question)`
  - `createAILog(log)`, `getAILogs(storeId)`
- [ ] Добавить типизацию с TypeScript

---

### **Sprint 2: Адаптация API Routes** ⏱️ ~3 часа

#### Задачи:

**2.1. Базовые API эндпоинты**
- [ ] `src/app/api/stores/route.ts` → PostgreSQL
- [ ] `src/app/api/stores/[storeId]/route.ts` → PostgreSQL

**2.2. Reviews API**
- [ ] `src/app/api/stores/[storeId]/reviews/route.ts` → PostgreSQL
- [ ] `src/app/api/stores/[storeId]/reviews/update/route.ts` → PostgreSQL
- [ ] `src/app/api/stores/reviews/update-all/route.ts` → PostgreSQL

**2.3. Chats API**
- [ ] `src/app/api/stores/[storeId]/dialogues/update/route.ts` → PostgreSQL
- [ ] `src/app/api/stores/[storeId]/dialogues/send-no-reply-message/route.ts` → PostgreSQL

**2.4. Questions API**
- [ ] Создать `src/app/api/stores/[storeId]/questions/route.ts` (если не существует)

**2.5. WB Proxy API**
- [ ] ✅ Оставить без изменений (работают с WB API напрямую)

---

### **Sprint 3: Адаптация UI компонентов** ⏱️ ~4 часа

#### Задачи:

**3.1. Главная страница (список магазинов)**
- [ ] `src/app/page.tsx` → Server Component с PostgreSQL
- [ ] Заменить `useCollection('stores')` на `dbHelpers.getStores()`

**3.2. Страница настроек**
- [ ] `src/app/settings/page.tsx` → Server Component с PostgreSQL
- [ ] Заменить `useDoc('user_settings')` на `dbHelpers.getUserSettings()`

**3.3. Store Detail Pages**
- [ ] `src/app/storeDetail/[storeId]/page.tsx` → PostgreSQL
- [ ] `src/app/storeDetail/[storeId]/reviews/page.tsx` → PostgreSQL
- [ ] `src/app/storeDetail/[storeId]/chats/page.tsx` → PostgreSQL
- [ ] `src/app/storeDetail/[storeId]/questions/page.tsx` → PostgreSQL
- [ ] `src/app/storeDetail/[storeId]/logs/page.tsx` → PostgreSQL

**3.4. Client Components (если требуется real-time)**
- [ ] Оценить необходимость real-time обновлений
- [ ] Если нужны — реализовать через polling или WebSockets
- [ ] Если не нужны — использовать Server Components

---

### **Sprint 4: Тестирование и WB API синхронизация** ⏱️ ~3 часа

#### Задачи:

**4.1. Локальное тестирование**
- [ ] Запустить `npm run dev`
- [ ] Проверить подключение к PostgreSQL
- [ ] Проверить все страницы:
  - Главная (список магазинов)
  - Настройки
  - Детали магазина (reviews, chats, questions, logs)
- [ ] Проверить все API эндпоинты

**4.2. WB API синхронизация**
- [ ] Запустить синхронизацию товаров для всех магазинов
  - `POST /api/stores/{storeId}/products/update` (или существующий эндпоинт)
- [ ] Запустить синхронизацию отзывов
  - `POST /api/stores/reviews/update-all`
- [ ] Запустить синхронизацию чатов
  - `POST /api/stores/dialogues/update-all`
- [ ] Запустить синхронизацию вопросов
  - Создать эндпоинт или использовать существующий

**4.3. Верификация данных**
- [ ] Проверить количество товаров в БД
- [ ] Проверить количество отзывов в БД
- [ ] Проверить количество чатов в БД
- [ ] Сравнить с ожиданиями (товары ~18,903, отзывы ~45,448, чаты ~3,332)

---

## 5. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Потеря real-time обновлений | Высокая | Среднее | Использовать polling или Server Actions для обновлений |
| Проблемы с производительностью PostgreSQL | Средняя | Среднее | Использовать индексы, оптимизировать запросы |
| Ошибки в адаптации API | Средняя | Высокое | Тщательное тестирование каждого эндпоинта |
| Неполная синхронизация WB API | Средняя | Высокое | Добавить логирование и retry логику |
| Connection pool exhaustion | Низкая | Высокое | Настроить правильный размер pool (10-20 connections) |

---

## 6. Definition of Done (DoD)

### ЭТАП 3 (Код приложения):
- ✅ PostgreSQL клиент создан и протестирован
- ✅ Database helpers реализованы для всех таблиц
- ✅ Все API Routes адаптированы под PostgreSQL
- ✅ Все UI компоненты адаптированы под PostgreSQL
- ✅ Firebase-специфичные файлы удалены
- ✅ Приложение запускается локально без ошибок

### ЭТАП 4 (Синхронизация и проверка):
- ✅ WB API синхронизация выполнена успешно
- ✅ Данные в PostgreSQL соответствуют ожиданиям
- ✅ Все страницы отображаются корректно
- ✅ Все API эндпоинты работают
- ✅ AI генерация ответов работает (Deepseek)
- ✅ Готовность к production deployment

---

## 7. Следующие шаги (после ЭТАП 3)

1. **Production deployment** на Yandex Cloud
2. **Мониторинг** производительности PostgreSQL
3. **Оптимизация** запросов (если требуется)
4. **Backup стратегия** для PostgreSQL
5. **Отключение Firebase** (после подтверждения стабильности)

---

## 8. Контрольные точки

| Этап | Дата | Статус | Комментарий |
|------|------|--------|-------------|
| ЭТАП 1: Создание кластера PostgreSQL | 2026-01-04 | ✅ Завершён | Yandex Cloud кластер создан |
| ЭТАП 2A: Создание схемы БД | 2026-01-04 | ✅ Завершён | 9 таблиц, 36 индексов |
| ЭТАП 2B: Импорт данных через WebSQL | 2026-01-05 | ✅ Завершён | 7 users, 1 settings, 45 stores |
| ЭТАП 3: Миграция кода приложения | 2026-01-05 | 🔄 В работе | Начат |
| ЭТАП 4: Синхронизация и тестирование | TBD | ⏳ Ожидание | После ЭТАП 3 |
| ЭТАП 5: Production deployment | TBD | ⏳ Ожидание | После ЭТАП 4 |

---

**Автор документа:** Claude + Владелец проекта
**Последнее обновление:** 2026-01-05
**Версия:** 1.0
