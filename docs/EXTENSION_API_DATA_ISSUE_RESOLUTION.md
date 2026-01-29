# Extension API Data Issue - Resolution Summary

**Дата:** 2026-01-29
**Статус:** ✅ RESOLVED
**Приоритет:** 🔥 CRITICAL
**Категория:** Bug Fix

---

## 📋 Issue Summary

Команда Chrome Extension (R5 Complaints System) сообщила о критической проблеме:
- API endpoint `/api/extension/stores/:storeId/complaints` возвращал пустой массив
- Проблема наблюдалась для ВСЕХ магазинов
- Пользователь утверждал, что жалобы должны существовать в магазине "ИП Артюшина"

---

## 🔍 Root Cause Analysis

### Диагностика

1. **Проверка данных в БД:**
   - Магазин существует: ИП Артюшина (`7kKX9WgLvOPiXYIHk6hi`)
   - Total reviews: 16,151
   - Статус всех отзывов: `complaint_status = 'not_sent'` ❌
   - Жалобы в `review_complaints`: 601 записей со статусом `'draft'` ✅

2. **Проверка SQL запроса:**
   ```sql
   -- Старый запрос (НЕ работал)
   SELECT ...
   FROM reviews r
   JOIN review_complaints rc ON r.id = rc.review_id
   WHERE r.store_id = $1
     AND r.complaint_status = 'draft'  -- ❌ Фильтр по reviews.complaint_status
   ```

   **Проблема:** Фильтр `r.complaint_status = 'draft'` отсекал все результаты, так как в таблице `reviews` все отзывы имели статус `'not_sent'`.

3. **Тест исправленного запроса:**
   ```sql
   -- Новый запрос (работает)
   WHERE r.store_id = $1
     AND rc.status = 'draft'  -- ✅ Фильтр по review_complaints.status
   ```

   **Результат:** 601 жалоба найдена!

---

### Root Cause

**Несоответствие между схемой данных и реализацией:**

| Компонент | Что ожидалось | Что было на самом деле |
|-----------|---------------|------------------------|
| `reviews.complaint_status` | Должен обновляться на `'draft'` при создании жалобы | Все отзывы имели `'not_sent'` |
| `review_complaints.status` | Статус самой жалобы | Корректно: `'draft'` |
| Endpoint SQL | Фильтровал по `r.complaint_status` | Нужно было фильтровать по `rc.status` |

**Почему это произошло:**

Жалобы были созданы (возможно, через другой интерфейс или скрипт) в таблице `review_complaints`, но поле `reviews.complaint_status` не было обновлено. Endpoint полагался на `reviews.complaint_status`, который всегда был `'not_sent'`.

---

## ✅ Решение

### Изменения в Коде

**Файл:** [src/app/api/extension/stores/[storeId]/complaints/route.ts](../src/app/api/extension/stores/[storeId]/complaints/route.ts)

**Commit:** `55dea84`

**Изменения:**

1. **Основной запрос (строка 112):**
   ```typescript
   // Было
   AND r.complaint_status = 'draft'

   // Стало
   AND rc.status = 'draft'
   ```

2. **Статистика по рейтингам (строка 128):**
   ```typescript
   // Было
   WHERE r.store_id = $1 AND r.complaint_status = 'draft'

   // Стало
   WHERE r.store_id = $1 AND rc.status = 'draft'
   ```

3. **Статистика по артикулам (строка 144):**
   ```typescript
   // Было
   WHERE r.store_id = $1 AND r.complaint_status = 'draft'

   // Стало
   WHERE r.store_id = $1 AND rc.status = 'draft'
   ```

---

### Deployment

```bash
# Local
git add src/app/api/extension/stores/[storeId]/complaints/route.ts
git commit -m "fix: Change complaints endpoint to filter by review_complaints.status instead of reviews.complaint_status"
git push origin main

# Production
ssh ubuntu@158.160.217.236
cd /var/www/wb-reputation
git pull origin main
npm run build
pm2 reload wb-reputation
```

**Deployed at:** 2026-01-29 13:59 MSK

---

## 🧪 Testing

### Test Results

**Store:** ИП Артюшина (`7kKX9WgLvOPiXYIHk6hi`)

**Request:**
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=10"
```

**Response:** ✅ **200 OK**

```json
{
  "complaints": [...],  // 10 complaints
  "total": 10,
  "stats": {
    "by_rating": { "1": 205, "2": 123, "3": 273 },
    "by_article": { ... }
  }
}
```

**Total complaints available:** 601

---

## 📦 Deliverables

### 1. Документация для Extension Team

**Файл:** `BACKEND_DATA_RESPONSE.md` (в папке Chrome Extension проекта)

**Содержимое:**
- ✅ Root cause analysis
- ✅ Решение проблемы
- ✅ Тестовые данные (Store ID, примеры запросов)
- ✅ Рекомендации по обновлению query параметров
- ✅ Схема данных и SQL запросы

---

### 2. Code Fix

**Changes:**
- Modified: `src/app/api/extension/stores/[storeId]/complaints/route.ts`
- Commit: `55dea84`
- Status: ✅ Deployed to production

---

### 3. Internal Documentation

**Этот файл:** Для нашей команды (root cause, решение, lessons learned)

---

## 📚 Lessons Learned

### 1. Несоответствие схемы данных

**Проблема:** Endpoint полагался на `reviews.complaint_status`, но в реальных данных это поле не обновлялось при создании жалобы.

**Решение:**
- Изменили endpoint для фильтрации по `review_complaints.status` (источник истины)
- В будущем: добавить триггер или проверку целостности данных

**Рекомендация:**
- Всегда использовать единый источник истины для статуса
- Либо синхронизировать `reviews.complaint_status` с `review_complaints.status`
- Либо использовать только `review_complaints.status` (current solution)

---

### 2. Query параметры endpoint

**Проблема:** Extension Team использовал параметры `skip` и `take`, которые не поддерживаются endpoint.

**Решение:** Документировали поддерживаемые параметры:
- `filter`: `'draft' | 'all'`
- `limit`: `number` (max: 500)
- `rating`: `'1,2,3'` (comma-separated)

**Рекомендация для будущего:**
- Добавить OpenAPI/Swagger спецификацию для Extension API
- Генерировать клиентские SDK из спецификации
- Автоматически валидировать query параметры

---

### 3. Testing процесс

**Проблема:** Endpoint не был протестирован с реальными данными после изменений в схеме.

**Рекомендация:**
- Добавить integration tests для всех Extension API endpoints
- Тестировать с реальными данными из staging БД
- Автоматически проверять наличие данных в тестах

---

## 🎯 Next Steps (Optional)

### Рекомендации для улучшения системы

1. **Синхронизация статусов:**
   ```sql
   -- Триггер для синхронизации reviews.complaint_status
   CREATE OR REPLACE FUNCTION sync_review_complaint_status()
   RETURNS TRIGGER AS $$
   BEGIN
     UPDATE reviews
     SET complaint_status = NEW.status
     WHERE id = NEW.review_id;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER update_review_complaint_status
   AFTER INSERT OR UPDATE ON review_complaints
   FOR EACH ROW
   EXECUTE FUNCTION sync_review_complaint_status();
   ```

2. **Добавить пагинацию:**
   ```typescript
   // Поддержка skip/take параметров
   const skip = parseInt(searchParams.get('skip') || '0');
   const limit = parseInt(searchParams.get('limit') || '100');

   const complaintsResult = await query(
     `SELECT ... OFFSET $4 LIMIT $3`,
     [storeId, ratings, limit, skip]
   );
   ```

3. **Улучшить API documentation:**
   - Добавить OpenAPI spec для Extension API
   - Генерировать Swagger UI
   - Версионирование API (`/api/v1/extension/...`)

---

## 📊 Metrics

**Response Time:** ~3 часа (от получения запроса до resolution)

**Endpoints Fixed:** 1
- `/api/extension/stores/:storeId/complaints`

**Lines Changed:** 3
- Line 112: `r.complaint_status = 'draft'` → `rc.status = 'draft'`
- Line 128: `r.complaint_status = 'draft'` → `rc.status = 'draft'`
- Line 144: `r.complaint_status = 'draft'` → `rc.status = 'draft'`

**Complaints Available:** 601 (for ИП Артюшина)

**Total Stores with Complaints:** (to be determined)

---

## ✅ Resolution Summary

**Проблема:** Endpoint возвращал пустой массив из-за несоответствия между фильтром SQL и реальными данными

**Root Cause:** Фильтр по `reviews.complaint_status = 'draft'` не работал, так как все отзывы имели `'not_sent'`

**Решение:** Изменили фильтр на `review_complaints.status = 'draft'`

**Impact:**
- ✅ Extension Team может получать жалобы из API
- ✅ Multi-Store Integration больше не заблокирована
- ✅ API возвращает корректные данные (601 жалоба для тестового магазина)

**Status:** 🟢 **RESOLVED**

---

**Дата создания:** 2026-01-29
**Автор:** Backend Team (WB Reputation Manager)
**Версия API:** 2.0.0
**Commit:** `55dea84`
