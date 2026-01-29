# Extension API Issues - Complete Resolution Summary

**Дата:** 2026-01-29
**Статус:** ✅ ALL RESOLVED
**Команда:** Backend Team (WB Reputation Manager v2.0.0)

---

## 📋 Overview

Команда Chrome Extension (R5 Complaints System) обратилась с **тремя критическими проблемами** интеграции с Backend API. Все проблемы были диагностированы, исправлены и задеплоены на production в течение одной сессии.

---

## 🔥 Issue 1: Token Authentication (401 Unauthorized)

### Проблема
- Extension получал `401 Unauthorized` для всех токенов из документации
- Блокировал доступ к любым API endpoints

### Root Cause
- Два параллельных механизма аутентификации:
  1. `api_tokens` table - токены в формате 64-char hex
  2. `user_settings` table - токены в формате `wbrm_*`
- Extension API использует `user_settings`, но в документации был токен из `api_tokens`

### Решение
- Нашли корректный токен в `user_settings`: `wbrm_0ab7137430d4fb62948db3a7d9b4b997`
- Протестировали все Extension API endpoints - все работают
- Предоставили документацию с корректным токеном

### Status
✅ **RESOLVED** - Extension Team может аутентифицироваться

**Документация:**
- [EXTENSION_API_TOKEN_ISSUE_RESOLUTION.md](./EXTENSION_API_TOKEN_ISSUE_RESOLUTION.md)
- Extension Team: `BACKEND_TOKEN_RESPONSE.md`

---

## 🔥 Issue 2: Empty Complaints Data

### Проблема
- Endpoint `/api/extension/stores/:storeId/complaints` возвращал пустой массив
- Проблема наблюдалась для ВСЕХ магазинов
- Extension не мог получить жалобы для отправки

### Root Cause
- SQL запрос фильтровал по `reviews.complaint_status = 'draft'`
- В реальных данных все отзывы имели `reviews.complaint_status = 'not_sent'`
- Правильный статус находился в `review_complaints.status = 'draft'`
- Несоответствие между схемой и реализацией

### Решение
- Изменили все SQL запросы: `r.complaint_status = 'draft'` → `rc.status = 'draft'`
- Обновили запросы статистики (`by_rating`, `by_article`)
- Задеплоили на production

### Testing
- До исправления: 0 complaints
- После исправления: 601 complaints для тестового магазина ИП Артюшина

### Status
✅ **RESOLVED** - Extension получает 601 жалобу для тестового магазина

**Commit:** `55dea84`
**Deployed:** 2026-01-29 13:59 MSK

**Документация:**
- [EXTENSION_API_DATA_ISSUE_RESOLUTION.md](./EXTENSION_API_DATA_ISSUE_RESOLUTION.md)
- Extension Team: `BACKEND_DATA_RESPONSE.md`

---

## 🔥 Issue 3: ProductId Format (Vendor Code instead of WB Article)

### Проблема
- Endpoint возвращал в поле `productId` значения вроде `"P-02-NY-long"` (vendor codes)
- Extension ожидал числовые артикулы WB (nmID) вроде `"649502497"`
- Невозможно подать жалобу в WB API без правильных nmID

### Root Cause
- SQL запрос использовал `p.vendor_code as product_id` вместо `p.wb_product_id as product_id`
- `vendor_code` - внутренний артикул продавца (может быть любым)
- `wb_product_id` - числовой артикул WB (единственный корректный для WB API)

### Решение (2 этапа)

#### Этап 1: Исправление productId
- Изменили SQL: `p.vendor_code` → `p.wb_product_id`
- Добавили `p.vendor_code as product_name` для UI
- Обновили статистику `by_article` на группировку по `wb_product_id`

**Commit:** `e2a1877`
**Deployed:** 2026-01-29 14:35 MSK

#### Этап 2: Удаление productName (по обратной связи PM)

**Feedback от Product Manager:**
> "артикул продавца может быть тоже чертишто там понаписано, мы работаем с артикулами товаров - и лучше их и оставить"

**Решение:**
- Удалили `p.vendor_code as product_name` из SQL
- Удалили `productName` из response mapping
- Оставили только `productId` (WB артикул)

**Commit:** `710b356`
**Deployed:** 2026-01-29 14:50 MSK

### Testing
Создан скрипт `scripts/verify-productname-removal.ts`:
```
✅ productId существует
✅ productId - это число WB
✅ productName отсутствует
✅ productId не содержит "-"

✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ
```

### Status
✅ **RESOLVED** - Extension получает корректные WB артикулы

**Документация:**
- [EXTENSION_API_PRODUCTID_ISSUE_RESOLUTION.md](./EXTENSION_API_PRODUCTID_ISSUE_RESOLUTION.md)
- Extension Team: `BACKEND_PRODUCTID_RESPONSE.md`

---

## 📊 Summary Metrics

### Response Time
- **Total time:** ~4 часа (от первого запроса до финального resolution)
- **Issue 1:** ~1 час
- **Issue 2:** ~1.5 часа
- **Issue 3:** ~1.5 часа

### Code Changes
**Files Modified:** 1
- `src/app/api/extension/stores/[storeId]/complaints/route.ts`

**Commits:** 3
- `55dea84` - Fix empty data issue
- `e2a1877` - Fix productId format
- `710b356` - Remove productName field

**Lines Changed:** 8 (across all fixes)

### Deployment
**Environment:** Production (158.160.217.236)
**Method:** Git pull → npm build → pm2 reload
**Status:** ✅ All changes deployed successfully

---

## 🎯 Impact

### Before Fixes
- ❌ Extension не мог аутентифицироваться (401 Unauthorized)
- ❌ Extension не получал данные (empty array)
- ❌ Extension не мог подать жалобы (неправильный формат productId)
- 🔴 **Multi-Store Integration полностью заблокирован**

### After Fixes
- ✅ Extension аутентифицируется корректно
- ✅ Extension получает 601 жалобу для тестового магазина
- ✅ Extension получает правильные WB артикулы для подачи жалоб
- 🟢 **Multi-Store Integration разблокирован**

---

## 📦 Deliverables

### Для Extension Team (в их папке проекта)

1. **BACKEND_TOKEN_RESPONSE.md**
   - Корректный токен: `wbrm_0ab7137430d4fb62948db3a7d9b4b997`
   - Объяснение двух систем аутентификации
   - Примеры использования

2. **BACKEND_DATA_RESPONSE.md**
   - Root cause пустого массива
   - Решение (фильтр по `rc.status`)
   - Тестовые данные (601 жалоба)

3. **BACKEND_PRODUCTID_RESPONSE.md**
   - Root cause неправильного productId
   - Решение (wb_product_id вместо vendor_code)
   - Удаление productName (по запросу PM)
   - TypeScript типы и примеры интеграции с WB API

### Для нашей команды (docs/)

1. **EXTENSION_API_TOKEN_ISSUE_RESOLUTION.md**
   - Диагностика, root cause, решение, lessons learned

2. **EXTENSION_API_DATA_ISSUE_RESOLUTION.md**
   - Диагностика, root cause, решение, lessons learned

3. **EXTENSION_API_PRODUCTID_ISSUE_RESOLUTION.md**
   - Диагностика, root cause, решение (2 этапа), lessons learned

4. **EXTENSION_API_ISSUES_SUMMARY.md** (этот файл)
   - Общий overview всех трех проблем

---

## 📚 Key Lessons Learned

### 1. Несоответствие схемы данных
- **Issue 2:** Endpoint фильтровал по `reviews.complaint_status`, но реальный статус в `review_complaints.status`
- **Lesson:** Всегда проверять единый источник истины (source of truth)
- **Solution:** Использовать `review_complaints.status` как единственный источник статуса жалобы

### 2. Проверка реальных данных перед маппингом
- **Issue 3:** Использовали `vendor_code` вместо `wb_product_id` без проверки значений
- **Lesson:** Всегда запускать тестовые SQL запросы с `LIMIT 5` для проверки реальных значений
- **Solution:** Проверять примеры данных перед выбором полей для API response

### 3. Обратная связь от Product Manager критична
- **Issue 3:** Добавили `productName`, но PM сказал убрать - vendor_code ненадежен
- **Lesson:** PM знает бизнес-требования лучше разработчиков
- **Solution:** Если PM говорит "убрать" - убираем без споров

### 4. Интеграционное тестирование с внешним API
- **Issue 3:** Endpoint возвращал данные, несовместимые с WB API
- **Lesson:** Для Extension API всегда проверять совместимость с WB API
- **Solution:** Добавить integration tests, эмулирующие подачу жалобы через WB API

### 5. Query параметры endpoint должны быть документированы
- **Issue 2:** Extension использовал `skip`/`take`, которые не поддерживаются
- **Lesson:** Нужна четкая документация поддерживаемых параметров
- **Solution:** Добавить OpenAPI спецификацию для Extension API

---

## 🚀 Next Steps (Optional)

### Рекомендации для улучшения системы

#### 1. Синхронизация статусов
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
```

#### 2. Валидация wb_product_id
```sql
-- Constraint: wb_product_id должен быть числом
ALTER TABLE products
ADD CONSTRAINT wb_product_id_numeric CHECK (wb_product_id ~ '^\d+$');
```

#### 3. OpenAPI спецификация
```yaml
# openapi.yaml для Extension API
paths:
  /api/extension/stores/{storeId}/complaints:
    get:
      parameters:
        - name: filter
          schema:
            type: string
            enum: [draft, all]
        - name: limit
          schema:
            type: integer
            maximum: 500
        - name: rating
          schema:
            type: string
            pattern: '^[1-5](,[1-5])*$'
```

#### 4. Integration tests
```typescript
describe('Extension API - WB Integration', () => {
  it('should return complaints compatible with WB API', async () => {
    const response = await fetch('/api/extension/stores/:storeId/complaints');
    const { complaints } = await response.json();

    complaints.forEach(complaint => {
      expect(complaint.productId).toMatch(/^\d+$/);  // WB article is numeric
      expect(parseInt(complaint.productId)).toBeGreaterThan(0);
    });
  });
});
```

#### 5. Rate limiting improvements
- Добавить rate limit метрики в response headers
- Implement exponential backoff рекомендации
- Добавить `/api/extension/rate-limit` endpoint для проверки лимитов

---

## ✅ Final Checklist

- [x] Issue 1: Token authentication fixed
- [x] Issue 2: Empty data fixed
- [x] Issue 3: ProductId format fixed
- [x] ProductName removed (per PM feedback)
- [x] All changes committed and pushed to GitHub
- [x] All changes deployed to production
- [x] All endpoints tested with real data
- [x] Documentation created for Extension Team (3 files)
- [x] Internal documentation created (4 files)
- [x] Verification scripts created for testing

**Overall Status:** 🟢 **ALL ISSUES RESOLVED**

---

## 📞 Test Environment

### Credentials
- **API Token:** `wbrm_0ab7137430d4fb62948db3a7d9b4b997`
- **Store ID:** `7kKX9WgLvOPiXYIHk6hi` (ИП Артюшина)
- **Base URL:** `http://158.160.217.236`

### Test Request
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=10"
```

### Expected Response
```json
{
  "complaints": [
    {
      "id": "MDZTXVilHWCXBK1YZx4u",
      "productId": "649502497",       // ✅ WB article (numeric)
      "rating": 1,
      "text": "...",
      "authorName": "Алина",
      "createdAt": "2026-01-07T20:09:37.000Z",
      "complaintText": {
        "reasonId": 11,
        "reasonName": "Отзыв не относится к товару",
        "complaintText": "..."
      }
    }
  ],
  "total": 10,
  "stats": {
    "by_rating": { "1": 205, "2": 123, "3": 273 },
    "by_article": { "649502497": 78, "528735233": 52 }
  }
}
```

---

**Создано:** 2026-01-29
**Автор:** Backend Team (WB Reputation Manager)
**Версия API:** 2.0.0
**Commits:** `55dea84`, `e2a1877`, `710b356`
**Session Time:** ~4 hours
**Issues Resolved:** 3/3 ✅
