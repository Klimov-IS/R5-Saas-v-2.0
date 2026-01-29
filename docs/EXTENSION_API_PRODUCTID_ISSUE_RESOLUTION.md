# Extension API ProductId Issue - Resolution Summary

**Дата:** 2026-01-29
**Статус:** ✅ RESOLVED
**Приоритет:** 🔥 HIGH
**Категория:** Bug Fix + Refactoring

---

## 📋 Issue Summary

Команда Chrome Extension (R5 Complaints System) сообщила о критической проблеме:
- API endpoint `/api/extension/stores/:storeId/complaints` возвращал в поле `productId` внутренние артикулы продавца (например, `"P-02-NY-long"`)
- Ожидалось: числовые артикулы Wildberries (nmID), например `"649502497"`
- **Блокер:** Extension не может подавать жалобы через WB API без правильных nmID

---

## 🔍 Root Cause Analysis

### Диагностика

1. **Проверка текущего SQL запроса:**
   ```sql
   SELECT
     p.vendor_code as product_id,  -- ❌ Внутренний артикул продавца
     ...
   FROM reviews r
   JOIN products p ON r.product_id = p.id
   ```

2. **Проверка схемы БД:**
   ```sql
   -- Таблица products
   wb_product_id TEXT NOT NULL,  -- nmID из WB (649502497) ✅
   vendor_code TEXT NOT NULL,    -- Артикул продавца (P-02-NY-long) ❌
   ```

3. **Тестовые данные:**
   - Store: ИП Артюшина (`7kKX9WgLvOPiXYIHk6hi`)
   - Complaints: 601
   - Пример: Review с `vendor_code = "P-02-NY-long"` имеет `wb_product_id = "649502497"`

### Root Cause

**Неправильный маппинг в SQL запросе:**
- Использовали `p.vendor_code as product_id` вместо `p.wb_product_id as product_id`
- `vendor_code` - внутренний артикул продавца (может быть любым, ненадежен)
- `wb_product_id` - числовой артикул WB (nmID), единственный корректный идентификатор для WB API

**Почему это произошло:**
- При создании endpoint предположили, что `vendor_code` - это WB артикул
- Не проверили структуру таблицы `products` и значения полей
- Не провели интеграционное тестирование с реальными данными

---

## ✅ Решение

### Первое исправление (Commit: `e2a1877`)

**Изменения в коде:**

**Файл:** [src/app/api/extension/stores/[storeId]/complaints/route.ts](../src/app/api/extension/stores/[storeId]/complaints/route.ts)

1. **Основной запрос (строка 100-101):**
   ```typescript
   // Было
   p.vendor_code as product_id,

   // Стало
   p.wb_product_id as product_id,
   p.vendor_code as product_name,  // Для UI
   ```

2. **Статистика по артикулам (строки 141-147):**
   ```typescript
   // Было
   SELECT p.vendor_code, COUNT(*) as count
   FROM ...
   GROUP BY p.vendor_code

   // Стало
   SELECT p.wb_product_id, COUNT(*) as count
   FROM ...
   GROUP BY p.wb_product_id
   ```

3. **Маппинг ответа (строка 164):**
   ```typescript
   // Добавили
   productName: c.product_name,  // vendor_code для UI
   ```

**Результат после первого исправления:**
```json
{
  "complaints": [
    {
      "productId": "649502497",      // ✅ WB артикул
      "productName": "P-02-NY-long", // vendor_code для UI
      ...
    }
  ],
  "stats": {
    "by_article": {
      "649502497": 78,  // ✅ Группировка по WB артикулам
      "528735233": 52
    }
  }
}
```

### Критическая обратная связь от Product Manager

**User Message:**
> "чат, так как я больше в контексте, скажу что решение не удобное, артикул продавца может быть тоже чертишто там понаписано, мы работаем с артикулами товаров - и лучше их и оставить, чтобы только они отображались. Так как мы работаем не с названиями а с цифрами, удобно сразу смотреть везде и сравнивать, вся статистика по артикулам тоже привязана к этому"

**Вердикт:**
> "НЕТ → убираем productName полностью ✅"

**Reasoning:**
- `vendor_code` ненадежен - может содержать любой текст
- Команда работает **исключительно** с числовыми WB артикулами
- Вся статистика, сопоставления, отчеты привязаны к WB артикулам
- Дополнительное поле создает путаницу и не приносит пользы

### Финальное исправление (Commit: `710b356`)

**Изменения:**

1. **Убрали `vendor_code` из SQL SELECT:**
   ```typescript
   // Удалили строку 101:
   p.vendor_code as product_name,
   ```

2. **Убрали `productName` из маппинга ответа:**
   ```typescript
   // Удалили строку 164:
   productName: c.product_name,
   ```

**Финальный результат:**
```json
{
  "complaints": [
    {
      "id": "MDZTXVilHWCXBK1YZx4u",
      "productId": "649502497",    // ✅ Только WB артикул, ничего лишнего
      "rating": 1,
      "text": "...",
      "authorName": "Алина",
      "createdAt": "2026-01-07T20:09:37.000Z",
      "complaintText": { ... }
    }
  ],
  "total": 5,
  "stats": {
    "by_article": {
      "649502497": 78,
      "528735233": 52
    }
  }
}
```

---

## 🧪 Testing

### Тестовый скрипт

**Создан:** `scripts/verify-productname-removal.ts`

**Проверки:**
```typescript
const checks = [
  { name: 'productId существует', pass: !!formattedComplaint.productId },
  { name: 'productId - это число WB', pass: /^\d+$/.test(formattedComplaint.productId) },
  { name: 'productName отсутствует', pass: !('productName' in formattedComplaint) },
  { name: 'productId не содержит "-"', pass: !formattedComplaint.productId?.includes('-') },
];
```

**Результаты:**
```
✅ productId существует
✅ productId - это число WB
✅ productName отсутствует
✅ productId не содержит "-"

✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ
```

### Тестовые данные

**Store:** ИП Артюшина (`7kKX9WgLvOPiXYIHk6hi`)

**Пример ответа после исправления:**
```json
{
  "id": "MDZTXVilHWCXBK1YZx4u",
  "productId": "649502497",
  "rating": 1,
  "text": "Самая отвратительная пижама из всех пижам...",
  "authorName": "Алина",
  "createdAt": "2026-01-07T20:09:37.000Z",
  "complaintText": {
    "reasonId": 11,
    "reasonName": "Отзыв не относится к товару",
    "complaintText": "..."
  }
}
```

---

## 🚀 Deployment

### Git History

```bash
# Первое исправление
git add src/app/api/extension/stores/[storeId]/complaints/route.ts
git commit -m "fix: Return wb_product_id instead of vendor_code for productId in complaints endpoint"
git push origin main

# Commit: e2a1877
# Deployed: 2026-01-29 14:35 MSK
```

```bash
# Финальное исправление
git add src/app/api/extension/stores/[storeId]/complaints/route.ts
git commit -m "refactor: Remove productName field from complaints endpoint"
git push origin main

# Commit: 710b356
# Deployed: 2026-01-29 14:50 MSK
```

### Production Deployment

```bash
ssh ubuntu@158.160.217.236
cd /var/www/wb-reputation
git pull origin main
npm run build
pm2 reload wb-reputation
```

**Status:** ✅ Deployed to Production

---

## 📦 Deliverables

### 1. Документация для Extension Team

**Файл:** `BACKEND_PRODUCTID_RESPONSE.md` (в папке Chrome Extension проекта)

**Содержимое:**
- ✅ Root cause analysis
- ✅ Решение проблемы (два этапа)
- ✅ Примеры API responses (до/после)
- ✅ TypeScript типы и рекомендации по интеграции
- ✅ Примеры использования для WB API
- ✅ Валидация `productId`

---

### 2. Code Fix

**Changes:**
- Modified: `src/app/api/extension/stores/[storeId]/complaints/route.ts`
- Commits: `e2a1877`, `710b356`
- Status: ✅ Deployed to production

**Summary:**
1. Изменили `p.vendor_code` → `p.wb_product_id` для `product_id`
2. Временно добавили `productName` (vendor_code)
3. По обратной связи PM: удалили `productName` полностью
4. Обновили статистику `by_article` на группировку по `wb_product_id`

---

### 3. Internal Documentation

**Этот файл:** Для нашей команды (root cause, решение, lessons learned)

---

## 📚 Lessons Learned

### 1. Проверка схемы БД перед маппингом

**Проблема:** Использовали неправильное поле (`vendor_code`) для `productId` без проверки значений.

**Решение:**
- Всегда проверять реальные данные в БД перед маппингом API полей
- Запускать тестовые запросы с `LIMIT 5` для проверки значений
- Документировать назначение каждого поля в таблице

**Рекомендация:**
```sql
-- Перед маппингом проверить примеры данных
SELECT
  wb_product_id,    -- Что это? → nmID WB (649502497)
  vendor_code,      -- Что это? → Внутренний артикул продавца (P-02-NY-long)
  name              -- Что это? → Название товара
FROM products
LIMIT 5;
```

---

### 2. Обратная связь от Product Manager - критична

**Проблема:** Добавили поле `productName` (vendor_code), думая что это полезно для UI.

**Обратная связь PM:** Поле не нужно, vendor_code ненадежен, работаем только с числами.

**Решение:** Немедленно убрали `productName` по запросу PM.

**Lesson:**
- PM знает требования бизнеса лучше разработчиков
- Если PM говорит "убрать" - убираем, без споров
- Лишние поля в API создают путаницу для клиентов

---

### 3. Интеграционное тестирование с внешним API

**Проблема:** Endpoint возвращал данные, которые нельзя использовать для WB API (vendor_code вместо nmID).

**Рекомендация:**
- Для Extension API всегда проверять совместимость с WB API
- Тестировать конечный use case: может ли Extension подать жалобу с этими данными?
- Добавить integration tests, которые эмулируют подачу жалобы в WB API

**Пример теста:**
```typescript
// Integration test
it('should return complaints compatible with WB API', async () => {
  const response = await fetch('/api/extension/stores/:storeId/complaints');
  const { complaints } = await response.json();

  // Проверка совместимости с WB API
  complaints.forEach(complaint => {
    expect(complaint.productId).toMatch(/^\d+$/);  // Должен быть числом
    expect(parseInt(complaint.productId)).toBeGreaterThan(0);
  });
});
```

---

### 4. Naming conventions для product identifiers

**Confusion:** Названия полей `product_id`, `vendor_code`, `wb_product_id` не очевидны.

**Рекомендация для будущего:**
```typescript
// Более явные названия в API
interface Complaint {
  id: string;
  wbArticle: string;        // Вместо productId (более явно)
  // или
  nmId: string;             // Стандартный термин WB
}
```

**Документация схемы:**
```sql
-- Добавить комментарии к полям
wb_product_id TEXT NOT NULL,  -- nmID (article) from Wildberries API, always numeric
vendor_code TEXT NOT NULL,    -- Internal seller's article, can be anything
```

---

## 🎯 Future Improvements (Optional)

### 1. Добавить валидацию wb_product_id

```sql
-- Constraint: wb_product_id должен быть числом
ALTER TABLE products
ADD CONSTRAINT wb_product_id_numeric CHECK (wb_product_id ~ '^\d+$');
```

### 2. Если нужно название товара для UI

Если Extension Team попросит добавить **полное название товара**:

```typescript
// SQL
SELECT
  p.wb_product_id as product_id,
  p.name as product_name,  // Полное название (не vendor_code!)
  ...

// Response
{
  "productId": "649502497",
  "productName": "Хлопковая пижама с принтом NY"  // products.name
}
```

**Важно:** Использовать `products.name`, НЕ `vendor_code`.

### 3. OpenAPI спецификация

```yaml
# openapi.yaml
Complaint:
  type: object
  properties:
    productId:
      type: string
      pattern: '^\d+$'
      description: Wildberries article number (nmID), always numeric
      example: "649502497"
```

---

## 📊 Metrics

**Response Time:** ~4 часа (от получения запроса до финального resolution)

**Endpoints Fixed:** 1
- `/api/extension/stores/:storeId/complaints`

**Lines Changed (Total):** 5
- Line 100: `p.vendor_code` → `p.wb_product_id`
- Line 101: Добавили `p.vendor_code as product_name` → Удалили
- Lines 141-147: Обновили статистику `by_article`
- Line 164: Добавили `productName` → Удалили

**Commits:** 2
- `e2a1877` - Первое исправление (productId → wb_product_id, добавили productName)
- `710b356` - Финальное исправление (удалили productName)

**Complaints Available:** 601 (for ИП Артюшина)

---

## ✅ Resolution Summary

**Проблема:** Endpoint возвращал `vendor_code` (внутренний артикул) вместо `wb_product_id` (WB nmID)

**Root Cause:** Неправильный маппинг в SQL запросе - использовали не то поле из таблицы `products`

**Решение:**
1. Изменили SQL: `p.vendor_code` → `p.wb_product_id`
2. Обновили статистику для группировки по WB артикулам
3. По обратной связи PM: убрали лишнее поле `productName`

**Impact:**
- ✅ Extension Team может использовать `productId` напрямую для WB API
- ✅ Статистика по артикулам корректна (группируется по WB nmID)
- ✅ API возвращает только нужные данные, без путаницы
- ✅ Multi-Store Integration разблокирована

**Status:** 🟢 **RESOLVED**

---

**Дата создания:** 2026-01-29
**Автор:** Backend Team (WB Reputation Manager)
**Версия API:** 2.0.0
**Commits:** `e2a1877`, `710b356`
