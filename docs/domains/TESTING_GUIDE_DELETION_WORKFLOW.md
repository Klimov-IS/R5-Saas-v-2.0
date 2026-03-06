# Testing Guide: Deletion Workflow
**Дата:** 2026-01-16
**Цель:** Протестировать AI генерацию офферов вручную перед запуском автоматики

---

## Шаг 1: Применить Migrations

```bash
# Подключиться к базе
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation

# Применить миграции (если ещё не применены)
\i supabase/migrations/20260116_add_deletion_chat_tags.sql
\i supabase/migrations/20260116_002_add_deletion_classification_prompt.sql
\i supabase/migrations/20260116_003_create_review_deletion_cases.sql

# Проверить что всё прошло успешно
SELECT enum_range(NULL::chat_tag);
-- Должно быть 4 тега + NULL (migration 024: deletion_candidate, deletion_offered, deletion_agreed, deletion_confirmed)

SELECT prompt_chat_deletion_tag IS NOT NULL FROM user_settings LIMIT 1;
-- Должно быть TRUE

SELECT COUNT(*) FROM review_deletion_cases;
-- Должно быть 0 (пустая таблица)
```

---

## Шаг 2: Синхронизация Всех Диалогов

### 2.1 Запуск dev сервера

```bash
cd "R5 saas-prod"
npm run dev
```

### 2.2 Массовая синхронизация

```bash
curl -X POST "http://localhost:9002/api/stores/dialogues/update-all" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\nВремя: %{time_total}s\n" \
  -s | jq
```

**Ожидаемый результат:**
```json
{
  "message": "Синхронизация завершена: 2 магазинов обработано, 2 успешно, 0 ошибок.",
  "results": [
    {
      "storeId": "TwKRrPji2KhTS8TmYJlD",
      "storeName": "ИП Соколов А. А.",
      "status": "success",
      "message": "Successfully updated dialogues..."
    },
    {
      "storeId": "0rCKlFCdrT7L3B2ios45",
      "storeName": "...",
      "status": "success",
      "message": "..."
    }
  ]
}
```

**⚠️ ВАЖНО:** Синхронизация может занять **несколько минут** (каждый магазин ~1-2 минуты).

**Проблемы:**
- Если получаешь ошибку rate limit от WB → подожди 1 минуту и повтори
- Если 401 Unauthorized → проверь API token в магазинах

### 2.3 Проверить результат в базе

```sql
-- Сколько чатов загрузилось
SELECT
  s.name,
  s.total_chats,
  s.last_chat_update_status,
  s.last_chat_update_date
FROM stores s;

-- Распределение по тегам
SELECT
  tag,
  COUNT(*) as count
FROM chats
GROUP BY tag
ORDER BY count DESC;
```

**Ожидаемый результат:**
```
tag                    | count
-----------------------+-------
active                 | 15
untagged               | 5
deletion_candidate     | 2-3   ← Это наши кандидаты!
refund_requested       | 1
spam                   | 0-1
```

---

## Шаг 3: Настройка Product Rules

Чтобы генерация офферов работала, нужно включить `work_in_chats` и `offer_compensation` для товаров.

### 3.1 Найти товары с deletion_candidate чатами

```sql
SELECT DISTINCT
  p.id,
  p.name,
  p.vendor_code,
  pr.work_in_chats,
  pr.offer_compensation,
  pr.max_compensation,
  COUNT(c.id) as deletion_chats
FROM chats c
JOIN products p ON c.product_nm_id::integer = p.wb_product_id
LEFT JOIN product_rules pr ON p.id = pr.product_id
WHERE c.tag = 'deletion_candidate'
GROUP BY p.id, p.name, p.vendor_code, pr.work_in_chats, pr.offer_compensation, pr.max_compensation
ORDER BY deletion_chats DESC;
```

### 3.2 Включить deletion workflow для этих товаров

```sql
-- Для каждого продукта из списка выше
UPDATE product_rules
SET
  work_in_chats = true,
  offer_compensation = true,
  compensation_type = 'refund',         -- или 'cashback'
  max_compensation = '500',             -- макс сумма (руб)
  chat_strategy = 'both'                -- или 'delete', 'upgrade_to_5'
WHERE product_id = 'PRODUCT_ID_HERE';   -- подставь ID из п.3.1

-- Если нет правила, создай
INSERT INTO product_rules (
  product_id, store_id,
  work_in_chats, offer_compensation,
  compensation_type, max_compensation, chat_strategy
) VALUES (
  'PRODUCT_ID_HERE', 'STORE_ID_HERE',
  true, true,
  'refund', '500', 'both'
);
```

---

## Шаг 4: Тестирование AI Генерации

### 4.1 Найти deletion_candidate чаты

```bash
curl -X GET "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/chats?skip=0&take=50" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -s | jq '.data[] | select(.tag == "deletion_candidate") | {id, clientName, lastMessageText, productName}'
```

**Ожидаемый результат:**
```json
{
  "id": "1:abc123",
  "clientName": "Мария",
  "lastMessageText": "Верните деньги, удалю отзыв",
  "productName": "Скатерть"
}
```

### 4.2 Сгенерировать оффер для одного чата

**Выбери chat ID из списка выше и запусти:**

```bash
curl -X POST "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/chats/1:abc123/generate-deletion-offer" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -H "Content-Type: application/json" \
  -s | jq
```

**Ожидаемый успешный результат:**
```json
{
  "deletionCase": {
    "id": "xyz789",
    "status": "offer_generated",
    "offerAmount": 400,
    "offerMessage": "Здравствуйте, Мария!\n\nПриносим искренние извинения за проблему с товаром \"Скатерть\". Готовы вернуть вам 400₽ на карту.\n\nНадеемся на ваше понимание и возможность продолжить сотрудничество.\n\nДля оформления напишите в службу поддержки. Спасибо!",
    "compensationType": "refund",
    "offerStrategy": "delete",
    "aiEstimatedSuccess": 0.85,
    "createdAt": "2026-01-16T15:30:00Z"
  },
  "chatTagUpdated": "deletion_offered",
  "messageSent": false
}
```

**Возможные ошибки:**

1. **"Chat is not a deletion candidate"**
   - Проверь: `chat.tag` должен быть `deletion_candidate`
   - Решение: Запусти classification ещё раз

2. **"Product not eligible for deletion workflow"**
   - Проверь: `product_rules.work_in_chats` и `offer_compensation` = true
   - Решение: Обнови product_rules (см. Шаг 3.2)

3. **"Системный промт не найден"**
   - Проверь: `prompt_deletion_offer` в user_settings
   - Решение: Добавь промпт из `deletion-offer-prompt.ts`

### 4.3 Проверить сгенерированное сообщение

**В UI:**
1. Открой http://localhost:9002/stores/TwKRrPji2KhTS8TmYJlD/chats
2. Найди чат Марии (теперь с тегом "💰 Предложена компенсация")
3. Кликни на чат
4. Увидишь карточку с deletion case info:
   - 💰 Компенсация: 400₽
   - 💳 Возврат на карту
   - AI прогноз: 85%
   - Полный текст сообщения

**Оцени сообщение:**
- ✅ Вежливое и эмпатичное?
- ✅ Упоминает конкретную сумму?
- ✅ НЕ упоминает "удаление отзыва" напрямую?
- ✅ Есть call-to-action ("напишите в поддержку")?
- ✅ Тон соответствует ситуации?

### 4.4 Тестирование разных стратегий

**Проверь 3 стратегии:**

**А) Strategy: "delete"** (деликатное удаление)
- Должен быть намёк: "надеемся на ваше понимание"
- НЕТ прямых просьб изменить отзыв

**Б) Strategy: "upgrade_to_5"** (повышение до 5★)
- Должна быть прямая просьба: "Будем благодарны, если пересмотрите свою оценку"
- Акцент на решение проблемы

**В) Strategy: "both"** (универсальная)
- Фокус на компенсации
- Опциональный намёк

**Изменить стратегию в product_rules:**
```sql
UPDATE product_rules
SET chat_strategy = 'upgrade_to_5'  -- или 'delete', 'both'
WHERE product_id = 'PRODUCT_ID';
```

Затем сгенерируй оффер заново для другого чата.

---

## Шаг 5: Массовая Генерация (опционально)

Если всё работает для одного чата, можешь сгенерировать офферы для всех:

```bash
curl -X POST "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/deletion-cases/generate-all?limit=5" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -s | jq
```

**Результат:**
```json
{
  "message": "Generated 3 offers, 1 skipped, 0 failed (out of 4 candidates)",
  "stats": {
    "total": 4,
    "successful": 3,
    "skipped": 1,
    "failed": 0
  },
  "results": [...]
}
```

---

## Шаг 6: Оценка AI Качества

### 6.1 Критерии оценки

Для каждого сгенерированного оффера оцени **1-5 баллов:**

| Критерий | 1 (плохо) | 5 (отлично) |
|----------|-----------|-------------|
| **Эмпатия** | Холодно, формально | Искренние извинения, понимание |
| **Персонализация** | Шаблон | Упоминает товар, имя, проблему |
| **Ненавязчивость** | Давит на клиента | Деликатные намёки |
| **WB Compliance** | "Удалите отзыв!" | Нет прямых упоминаний |
| **Грамматика** | Ошибки, опечатки | Идеально |

### 6.2 Лист для тестирования

Заполни таблицу для 5-10 чатов:

```
Chat ID | Client | Product | Offer Amount | Strategy | Эмпатия | Персонал. | Ненавязчив. | WB OK | Грамматика | TOTAL | Заметки
--------|--------|---------|--------------|----------|---------|-----------|-------------|-------|------------|-------|--------
1:abc   | Мария  | Скатерть| 400₽         | delete   | 5       | 4         | 5           | 5     | 5          | 24/25 | Отлично!
1:def   | Иван   | Ножи    | 300₽         | upgrade  | 4       | 5         | 4           | 5     | 5          | 23/25 | Хорошо
...
```

### 6.3 Итоги тестирования

**Если средний балл ≥ 20/25:**
- ✅ AI готов к продакшену
- Можно запускать автоматику

**Если средний балл < 20/25:**
- ❌ Нужно улучшать промпт
- Собери примеры плохих сообщений
- Обнови `deletion-offer-prompt.ts`
- Повтори тестирование

---

## Шаг 7: Итерация Промпта (если нужно)

### 7.1 Типичные проблемы и решения

**Проблема:** Слишком формальный тон
**Решение:** Добавь в промпт:
```
TONE: Friendly and warm, not corporate. Use "Здравствуйте!" instead of "Добрый день."
```

**Проблема:** Упоминает "удаление отзыва" напрямую
**Решение:** Усиль запрет в промпте:
```
СТРОГО ЗАПРЕЩЕНО: "удалить отзыв", "убрать отзыв", "изменить отзыв"
Только деликатные намёки: "надеемся на понимание", "возможность продолжить сотрудничество"
```

**Проблема:** Не персонализирует под конкретную проблему
**Решение:** Добавь в userContent больше контекста:
```typescript
userContent += `\n**Проблема клиента:** ${extractedProblem}`;
```

### 7.2 Обновление промпта

```sql
UPDATE user_settings
SET prompt_deletion_offer = '(новый промпт здесь)'
WHERE id = (SELECT id FROM user_settings LIMIT 1);
```

Затем повтори Шаг 4.

---

## Шаг 8: Сбор Статистики (несколько дней)

После того как протестируешь генерацию, **не отправляй сообщения клиентам сразу**.

**План на ближайшие дни:**
1. ✅ **День 1-2:** Генерируй офферы, оценивай качество, правь промпт
2. ✅ **День 3:** Протестируй на 20-30 чатах, собери финальную статистику
3. ✅ **День 4:** Если качество ОК → начинай отправлять вручную первые 5 офферов
4. ✅ **День 5-7:** Отслеживай реакции клиентов, conversion rate
5. ✅ **День 8+:** Если conversion ≥30% → можно автоматизировать

**Метрики для отслеживания:**
- Сколько офферов сгенерировано
- Сколько отправлено
- Сколько клиентов ответили
- Сколько согласились
- Сколько реально удалили отзыв
- **Conversion rate:** confirmed / sent

---

## Команды Quick Reference

```bash
# 1. Синхронизация всех диалогов
curl -X POST "http://localhost:9002/api/stores/dialogues/update-all" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -s | jq

# 2. Найти deletion_candidate чаты
curl -X GET "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/chats" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -s | jq '.data[] | select(.tag == "deletion_candidate")'

# 3. Сгенерировать оффер для чата
curl -X POST "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/chats/CHAT_ID/generate-deletion-offer" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -s | jq

# 4. Массовая генерация офферов
curl -X POST "http://localhost:9002/api/stores/TwKRrPji2KhTS8TmYJlD/deletion-cases/generate-all?limit=10" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -s | jq

# 5. Проверить deletion cases в базе
psql ... -c "SELECT id, status, offer_amount, ai_estimated_success FROM review_deletion_cases;"
```

---

**Готово!** Теперь у тебя есть полный план для тестирования. Удачи! 🚀
