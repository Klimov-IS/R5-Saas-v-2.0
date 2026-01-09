# Feature: Пагинация и Фильтры для Отзывов, Чатов, Логов

## 1. Цель

Добавить пагинацию и фильтрацию для страниц Отзывов, Чатов и Логов AI, чтобы эффективно работать с большими объемами данных.

**Проблема:**
Сейчас все таблицы загружают все записи разом (limit=50-100). При 1000+ отзывах/чатов страница будет тормозить и неудобна для использования.

**Решение:**
- Пагинация с выбором количества записей на страницу (10/25/50/100)
- Фильтры по рейтингу, статусу ответа, тегу чата
- Поиск по тексту

---

## 2. Текущее Состояние

### Отзывы (reviews/page.tsx)
- Загружает фиксированно `limit=50` записей
- Нет возможности фильтрации или поиска
- Отображает все 50 записей без пагинации

### Чаты (chats/page.tsx)
- Загружает фиксированно `limit=50` записей
- Нет фильтрации по тегам
- Нет поиска по тексту сообщения

### Логи AI (logs/page.tsx)
- Загружает фиксированно `limit=100` записей
- Нет фильтрации по статусу (success/error)
- Нет пагинации

### Database Helpers
- `getReviewsByStoreWithPagination()` - уже поддерживает limit/offset + фильтры (добавлены только что)
- `getChatsByStoreWithPagination()` - поддерживает только limit/offset (нужно добавить фильтры)
- `getAILogs()` - только limit, нет offset

---

## 3. Предлагаемые Изменения

### 3.1 Компоненты UI

**Создать:**
- ✅ `src/components/ui/pagination.tsx` - Shadcn UI компонент пагинации (СОЗДАН)

### 3.2 Database Helpers (`src/db/helpers.ts`)

**Обновить:**
- ✅ `getReviewsByStoreWithPagination()` - добавить фильтры rating, hasAnswer, search (ГОТОВО)
- ✅ `getReviewsCount()` - новая функция для подсчёта с фильтрами (ГОТОВО)
- ⏳ `getChatsByStoreWithPagination()` - добавить фильтры tag, search
- ⏳ `getChatsCount()` - новая функция для подсчёта с фильтрами
- ⏳ `getAILogs()` - добавить offset и фильтр по error status

### 3.3 API Routes

**Обновить:**
- ⏳ `src/app/api/stores/[storeId]/reviews/route.ts` - добавить query параметры:
  - `rating` (all | 1-2 | 3 | 4-5)
  - `hasAnswer` (all | yes | no)
  - `search` (string)
  - `page` (number, default 1)
  - `pageSize` (10 | 25 | 50 | 100, default 25)

- ⏳ `src/app/api/stores/[storeId]/chats/route.ts` - добавить query параметры:
  - `tag` (all | active | successful | unsuccessful | no_reply | untagged)
  - `search` (string)
  - `page` (number, default 1)
  - `pageSize` (10 | 25 | 50 | 100, default 25)

- ⏳ `src/app/api/stores/[storeId]/logs/route.ts` - добавить query параметры:
  - `status` (all | success | error)
  - `page` (number, default 1)
  - `pageSize` (50 | 100 | 200, default 100)

### 3.4 UI Pages

**Обновить:**
- ⏳ `src/app/stores/[storeId]/reviews/page.tsx`:
  - Добавить state для фильтров (rating, hasAnswer, search)
  - Добавить state для пагинации (page, pageSize, totalCount)
  - Добавить UI: Select для рейтинга, Select для статуса ответа, Input для поиска
  - Добавить компонент Pagination внизу таблицы
  - Обновить запрос API с передачей всех параметров

- ⏳ `src/app/stores/[storeId]/chats/page.tsx`:
  - Добавить state для фильтров (tag, search)
  - Добавить state для пагинации (page, pageSize, totalCount)
  - Добавить UI: Select для тега, Input для поиска
  - Добавить компонент Pagination
  - Обновить запрос API

- ⏳ `src/app/stores/[storeId]/logs/page.tsx`:
  - Добавить state для фильтра status (all | success | error)
  - Добавить state для пагинации (page, pageSize, totalCount)
  - Добавить UI: Select для статуса
  - Добавить компонент Pagination
  - Обновить запрос API

---

## 4. Технический План

### Шаг 1: Компонент Pagination ✅
- Создан `src/components/ui/pagination.tsx` с кнопками Prev/Next и номерами страниц

### Шаг 2: Database Helpers ✅ (частично)
- ✅ Обновлён `getReviewsByStoreWithPagination()` - добавлены фильтры
- ✅ Создана `getReviewsCount()` для подсчёта
- ⏳ Обновить `getChatsByStoreWithPagination()` - добавить фильтры
- ⏳ Создать `getChatsCount()`
- ⏳ Обновить `getAILogs()` - добавить offset

### Шаг 3: API Routes ⏳
- Добавить обработку новых query параметров
- Возвращать также totalCount для правильной работы пагинации

### Шаг 4: UI Pages ⏳
- Добавить UI элементы фильтрации
- Добавить компонент пагинации
- Обновить логику fetch с параметрами

---

## 5. Sprint Breakdown

### Sprint 6.1.1 (Database Layer) - 1-2 часа ⏳
- [x] Создать компонент Pagination
- [x] Обновить `getReviewsByStoreWithPagination()` с фильтрами
- [x] Создать `getReviewsCount()`
- [ ] Обновить `getChatsByStoreWithPagination()` с фильтрами
- [ ] Создать `getChatsCount()`
- [ ] Обновить `getAILogs()` с offset

### Sprint 6.1.2 (API Layer) - 1 час ⏳
- [ ] Обновить API route reviews
- [ ] Обновить API route chats
- [ ] Обновить API route logs

### Sprint 6.1.3 (UI Layer) - 2 часа ⏳
- [ ] Обновить reviews/page.tsx с фильтрами и пагинацией
- [ ] Обновить chats/page.tsx с фильтрами и пагинацией
- [ ] Обновить logs/page.tsx с фильтрами и пагинацией

### Sprint 6.1.4 (Testing) - 30 минут ⏳
- [ ] Тестирование всех фильтров
- [ ] Тестирование пагинации
- [ ] Проверка производительности с большими данными

---

## 6. Риски & Edge Cases

### Риск 1: SQL Injection через search параметр
**Решение:** Используем параметризированные запросы (ILIKE $N)

### Риск 2: Производительность при больших offset
**Решение:** Используем cursor-based pagination в будущем (для MVP - offset достаточно)

### Риск 3: Несоответствие count и реальных данных
**Решение:** Вызываем count с теми же фильтрами

### Риск 4: UX при сбросе фильтров
**Решение:** Добавить кнопку "Сбросить фильтры"

---

## 7. Definition of Done

- [x] Компонент Pagination создан и работает
- [x] Database helpers поддерживают фильтрацию для reviews
- [ ] Database helpers поддерживают фильтрацию для chats и logs
- [ ] API routes принимают и обрабатывают query параметры фильтрации
- [ ] API routes возвращают totalCount для пагинации
- [ ] UI страницы отображают фильтры (Select, Input)
- [ ] UI страницы отображают компонент Pagination
- [ ] Пагинация работает корректно (Prev, Next, номера страниц)
- [ ] Фильтры применяются мгновенно при изменении
- [ ] Все страницы загружают только нужное количество записей
- [ ] Производительность не деградирует при 1000+ записей
- [ ] Code review пройден
- [ ] Тестирование завершено

---

## 8. Приоритет

**P0** - Критически важно для работы с большими объемами данных

**Статус:** В процессе (Sprint 6.1.1 частично выполнен)
