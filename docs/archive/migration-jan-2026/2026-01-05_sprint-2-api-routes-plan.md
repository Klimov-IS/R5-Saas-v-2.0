# Sprint 2: API Routes Migration Plan

**Дата:** 2026-01-05
**Цель:** Адаптировать все API Routes с Firebase Firestore на PostgreSQL
**Время:** ~3-4 часа
**Статус:** 📋 Планирование

---

## 📊 Анализ существующих API Routes

Всего **22 API эндпоинта** в старом проекте:

### 1️⃣ Категория: **Stores API** (требуют миграции на PostgreSQL)
| Файл | Endpoint | Метод | Описание | Приоритет |
|------|----------|-------|----------|-----------|
| `api/stores/route.ts` | `/api/stores` | GET | Список магазинов | 🔴 P0 |
| `api/stores/[storeId]/route.ts` | `/api/stores/:id` | GET | Детали магазина | 🔴 P0 |

### 2️⃣ Категория: **Reviews API** (требуют миграции на PostgreSQL)
| Файл | Endpoint | Метод | Описание | Приоритет |
|------|----------|-------|----------|-----------|
| `api/stores/[storeId]/reviews/route.ts` | `/api/stores/:id/reviews` | GET | Отзывы магазина | 🔴 P0 |
| `api/stores/[storeId]/reviews/update/route.ts` | `/api/stores/:id/reviews/update` | POST | Синхронизация отзывов WB API | 🟡 P1 |
| `api/stores/reviews/update-all/route.ts` | `/api/stores/reviews/update-all` | POST | Синхронизация всех отзывов | 🟡 P1 |
| `api/stores/reviews/update/route.ts` | `/api/stores/reviews/update` | POST | Обновление отзыва | 🟡 P1 |
| `api/stores/[storeId]/reviews/[reviewId]/complaint/sent/route.ts` | `/api/stores/:id/reviews/:reviewId/complaint/sent` | POST | Отметить жалобу как отправленную | 🟢 P2 |

### 3️⃣ Категория: **Chats (Dialogues) API** (требуют миграции на PostgreSQL)
| Файл | Endpoint | Метод | Описание | Приоритет |
|------|----------|-------|----------|-----------|
| `api/stores/[storeId]/dialogues/update/route.ts` | `/api/stores/:id/dialogues/update` | POST | Синхронизация чатов WB API | 🟡 P1 |
| `api/stores/dialogues/update-all/route.ts` | `/api/stores/dialogues/update-all` | POST | Синхронизация всех чатов | 🟡 P1 |
| `api/stores/[storeId]/dialogues/send-no-reply-message/route.ts` | `/api/stores/:id/dialogues/send-no-reply-message` | POST | Отправить no-reply сообщения | 🟢 P2 |
| `api/stores/dialogues/send-no-reply-message-all/route.ts` | `/api/stores/dialogues/send-no-reply-message-all` | POST | Отправить no-reply всем | 🟢 P2 |
| `api/stores/[storeId]/dialogues/reconcile-no-reply/route.ts` | `/api/stores/:id/dialogues/reconcile-no-reply` | POST | Сверка no-reply статусов | 🟢 P2 |

### 4️⃣ Категория: **Complaints API** (требуют миграции на PostgreSQL)
| Файл | Endpoint | Метод | Описание | Приоритет |
|------|----------|-------|----------|-----------|
| `api/stores/[storeId]/complaints/route.ts` | `/api/stores/:id/complaints` | GET | Список жалоб | 🟢 P2 |

### 5️⃣ Категория: **Utility API** (требуют миграции на PostgreSQL)
| Файл | Endpoint | Метод | Описание | Приоритет |
|------|----------|-------|----------|-----------|
| `api/stores/[storeId]/recalculate-all/route.ts` | `/api/stores/:id/recalculate-all` | POST | Пересчет статистики магазина | 🟢 P2 |
| `api/stores/recalculate-all/route.ts` | `/api/stores/recalculate-all` | POST | Пересчет статистики всех магазинов | 🟢 P2 |

### 6️⃣ Категория: **WB Proxy API** (БЕЗ изменений - работают с WB API напрямую)
| Файл | Endpoint | Метод | Описание | Изменения |
|------|----------|-------|----------|-----------|
| `api/wb-proxy/products/route.ts` | `/api/wb-proxy/products` | GET | Прокси для WB API (товары) | ✅ Копировать |
| `api/wb-proxy/reviews/route.ts` | `/api/wb-proxy/reviews` | GET | Прокси для WB API (отзывы) | ✅ Копировать |
| `api/wb-proxy/chats/route.ts` | `/api/wb-proxy/chats` | GET | Прокси для WB API (чаты) | ✅ Копировать |
| `api/wb-proxy/chat-events/route.ts` | `/api/wb-proxy/chat-events` | GET | Прокси для WB API (события чатов) | ✅ Копировать |
| `api/wb-proxy/questions/route.ts` | `/api/wb-proxy/questions` | GET | Прокси для WB API (вопросы) | ✅ Копировать |
| `api/wb-proxy/send-message/route.ts` | `/api/wb-proxy/send-message` | POST | Прокси для WB API (отправка сообщений) | ✅ Копировать |

### 7️⃣ Категория: **Documentation API**
| Файл | Endpoint | Метод | Описание | Изменения |
|------|----------|-------|----------|-----------|
| `api/openapi.json/route.ts` | `/api/openapi.json` | GET | OpenAPI спецификация (Swagger) | ✅ Копировать |

---

## 🎯 План выполнения Sprint 2

### **Фаза 1: Базовые API эндпоинты** ⏱️ ~1 час

#### Задача 1.1: Копировать структуру API
- [ ] Создать папку `src/app/api` в новом проекте
- [ ] Скопировать `api/openapi.json/route.ts` (без изменений)
- [ ] Скопировать всю папку `api/wb-proxy/` (без изменений — работает с WB API)

#### Задача 1.2: Адаптировать Stores API
- [ ] **`api/stores/route.ts`** → PostgreSQL
  - Заменить `getFirebaseAdmin().firestore()` → `dbHelpers.getStores()`
  - Сохранить API key аутентификацию через `verifyApiKey()`

- [ ] **`api/stores/[storeId]/route.ts`** → PostgreSQL
  - Заменить `firestore.collection('stores').doc(storeId).get()` → `dbHelpers.getStoreById(storeId)`

---

### **Фаза 2: Reviews API** ⏱️ ~1 час

#### Задача 2.1: Базовые Reviews API
- [ ] **`api/stores/[storeId]/reviews/route.ts`** → PostgreSQL
  - GET: `firestore.collection('reviews').where('storeId', '==', storeId)` → `dbHelpers.getReviewsByStore(storeId)`

#### Задача 2.2: Reviews Sync API
- [ ] **`api/stores/[storeId]/reviews/update/route.ts`** → PostgreSQL
  - Синхронизация отзывов с WB API
  - Сохранение через `dbHelpers.upsertReview()`
  - Обновление счетчиков в магазине через `dbHelpers.updateStore()`

- [ ] **`api/stores/reviews/update-all/route.ts`** → PostgreSQL
  - Массовая синхронизация всех магазинов
  - Использует `dbHelpers.getStores()` + циклы синхронизации

#### Задача 2.3: Reviews Actions
- [ ] **`api/stores/reviews/update/route.ts`** → PostgreSQL
  - Обновление отдельного отзыва через `dbHelpers.updateReview()`

- [ ] **`api/stores/[storeId]/reviews/[reviewId]/complaint/sent/route.ts`** → PostgreSQL
  - Отметить жалобу как отправленную
  - `dbHelpers.updateReview(reviewId, { complaint_sent_date: now() })`

---

### **Фаза 3: Chats (Dialogues) API** ⏱️ ~1 час

#### Задача 3.1: Базовые Chats API
- [ ] **Создать** `api/stores/[storeId]/chats/route.ts` (если отсутствует)
  - GET: Получить чаты магазина через `dbHelpers.getChats(storeId)`

#### Задача 3.2: Chats Sync API
- [ ] **`api/stores/[storeId]/dialogues/update/route.ts`** → PostgreSQL
  - Синхронизация чатов с WB API
  - Сохранение через `dbHelpers.upsertChat()` + `dbHelpers.upsertChatMessage()`
  - Обновление счетчиков в магазине

- [ ] **`api/stores/dialogues/update-all/route.ts`** → PostgreSQL
  - Массовая синхронизация чатов всех магазинов

#### Задача 3.3: Chats Actions
- [ ] **`api/stores/[storeId]/dialogues/send-no-reply-message/route.ts`** → PostgreSQL
  - Отправка no-reply сообщений
  - Обновление через `dbHelpers.updateChat()`

- [ ] **`api/stores/dialogues/send-no-reply-message-all/route.ts`** → PostgreSQL
  - Массовая отправка no-reply

- [ ] **`api/stores/[storeId]/dialogues/reconcile-no-reply/route.ts`** → PostgreSQL
  - Сверка no-reply статусов

---

### **Фаза 4: Utility API & Complaints** ⏱️ ~30 минут

#### Задача 4.1: Complaints API
- [ ] **`api/stores/[storeId]/complaints/route.ts`** → PostgreSQL
  - GET: Получить отзывы с жалобами
  - Фильтр: `WHERE complaint_text IS NOT NULL`
  - Через `query()` или добавить helper `getComplaints(storeId)`

#### Задача 4.2: Recalculate API
- [ ] **`api/stores/[storeId]/recalculate-all/route.ts`** → PostgreSQL
  - Пересчет статистики через `dbHelpers.getStoreStats()`
  - Обновление через `dbHelpers.updateStore()`

- [ ] **`api/stores/recalculate-all/route.ts`** → PostgreSQL
  - Массовый пересчет для всех магазинов

---

## 📝 Шаблон изменений для каждого API Route

### ❌ Старый код (Firebase):
```typescript
import { getFirebaseAdmin } from '@/firebase/admin';

export async function GET(request: NextRequest) {
  const app = getFirebaseAdmin();
  const firestore = app.firestore();

  const storesSnapshot = await firestore.collection('stores').get();
  const stores = storesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return NextResponse.json(stores);
}
```

### ✅ Новый код (PostgreSQL):
```typescript
import * as dbHelpers from '@/db/helpers';

export async function GET(request: NextRequest) {
  const stores = await dbHelpers.getStores();

  return NextResponse.json(stores);
}
```

---

## ✅ Definition of Done (DoD) для Sprint 2

- [ ] Все API Routes скопированы в новый проект
- [ ] WB Proxy API работают без изменений
- [ ] Базовые API (Stores, Reviews, Chats) адаптированы под PostgreSQL
- [ ] API key аутентификация работает (`verifyApiKey()`)
- [ ] Swagger документация (`/api/docs`) работает
- [ ] Все эндпоинты протестированы вручную (через Postman или curl)
- [ ] Нет импортов из `@/firebase/*` в API routes

---

## 🚨 Риски и зависимости

| Риск | Митигация |
|------|-----------|
| WB API токены отсутствуют в новом проекте | Скопировать из старого проекта или использовать токены из БД |
| AI логика (Deepseek) может зависеть от старого кода | Скопировать папку `src/ai/` без изменений |
| Сложная бизнес-логика в синхронизации | Переносить по частям, тестировать каждый эндпоинт |

---

## 🎯 Приоритизация задач

### Must Have (Sprint 2):
1. ✅ Stores API (`GET /api/stores`, `GET /api/stores/:id`)
2. ✅ Reviews API (`GET /api/stores/:id/reviews`)
3. ✅ WB Proxy API (копировать без изменений)
4. ✅ Reviews Sync API (`POST /api/stores/:id/reviews/update`)
5. ✅ Chats Sync API (`POST /api/stores/:id/dialogues/update`)

### Should Have (Sprint 2 или 3):
- Массовые синхронизации (`update-all`)
- Complaints API
- Recalculate API
- No-reply logic

### Could Have (Sprint 3+):
- Оптимизация производительности
- Кэширование
- Rate limiting

---

## 📊 Метрики успеха

- **Количество адаптированных эндпоинтов:** 15+ из 22
- **Время выполнения Sprint 2:** ~3-4 часа
- **Покрытие тестами:** Ручное тестирование каждого эндпоинта
- **Отсутствие регрессий:** Все существующие API работают как раньше

---

**Готовы начать Sprint 2?** 🚀

Согласуйте этот план, и я начну с Фазы 1 (базовые API + WB Proxy).
