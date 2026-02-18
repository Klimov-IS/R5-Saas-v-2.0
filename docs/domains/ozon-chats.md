# OZON Chats — Domain Documentation

**Last Updated:** 2026-02-18
**Relevant code:** `src/lib/ozon-chat-sync.ts`, `src/lib/ozon-api.ts`, `src/db/telegram-helpers.ts`

---

## Ключевой инсайт: два типа OZON диалогов

OZON чаты делятся на два принципиально разных типа:

| Тип | Кто инициирует | `product_nm_id` | Объём |
|-----|---------------|-----------------|-------|
| **Seller-initiated** (deletion outreach) | Продавец открывает чат из карточки отзыва | ✅ Заполнен (из `context.sku`) | ~481 чат |
| **Buyer-initiated** | Покупатель пишет первым | ❌ NULL | ~316,898 чатов (99.85%) |

**Почему это важно:** R5 работает ТОЛЬКО с seller-initiated чатами (deletion outreach кампании). Buyer-initiated чаты не обрабатываются и не показываются в TG очереди.

---

## Как заполняется product_nm_id

OZON Chat List API **не передаёт информацию о товаре** в списке чатов. Единственный способ получить связь чата с товаром — через поле `context.sku` в истории сообщений.

```
OZON включает context.sku ТОЛЬКО когда:
  - Продавец инициирует чат из раздела "Отзывы" → кликает "Написать покупателю"
  - OZON автоматически добавляет context.sku = артикул товара (ozon_sku)
```

В коде (`ozon-chat-sync.ts`):
```typescript
// Извлечение SKU из истории сообщений
const sku = messages[0]?.context?.sku;
if (sku) {
  const product = skuToProduct.get(sku);
  chatPayload.product_nm_id = sku;
  chatPayload.product_name = product?.name || null;
}
```

---

## Синхронизация чатов (Hybrid Strategy)

### Tier 1: Unread-only scan (каждые 5 минут)
- Запрашивает только непрочитанные BUYER_SELLER чаты
- API: `chat.unread_count > 0` (OZON фильтрует на своей стороне)
- ~0-20 API вызовов при нормальной работе
- **Главный рабочий режим**

### Tier 2: Full scan — safety net (каждый час, 9:00–20:00 МСК)
- Запрашивает ВСЕ открытые BUYER_SELLER чаты (~317K)
- ~3170 API вызовов (страницы по 100 чатов)
- Нужен для чатов, прочитанных в OZON dashboard до того как R5 успел их синхронизировать
- После seeding `ozon_last_message_id` — большинство пропускается через инкрементальный skip

### Инкрементальный skip
Для каждого чата сравниваем `last_message_id` из API с `ozon_last_message_id` в DB:
```typescript
if (existing && existing.ozon_last_message_id === apiLastMsgId) {
  chatsSkipped++;  // ~99.9% чатов в steady state
  continue;
}
```

### Seeding
При первом full scan — заполняем `ozon_last_message_id` батчами по 5000 без загрузки истории:
```typescript
// Если есть existing и нет ozon_last_message_id → seed и skip
seedBatch.push({ id: chatId, lastMsgId: apiLastMsgId });
```

---

## TG Мини-апп: фильтрация очереди

**Правило:** Показывать только чаты, которые R5 активно обрабатывает.

```sql
-- Условие в telegram-helpers.ts (3 функции)
AND (
  pr.work_in_chats = TRUE                                          -- WB: только активные товары
  OR (c.marketplace = 'ozon' AND c.product_nm_id IS NOT NULL)     -- OZON: только seller-initiated
)
```

**Логика JOIN:**
```sql
LEFT JOIN products p ON p.store_id = c.store_id
  AND ((c.marketplace = 'wb' AND c.product_nm_id = p.wb_product_id)
    OR (c.marketplace = 'ozon' AND (c.product_nm_id = p.ozon_sku OR c.product_nm_id = p.ozon_fbs_sku)))
LEFT JOIN product_rules pr ON p.id = pr.product_id
```

Для OZON seller-initiated чатов: если product матчится → `pr.work_in_chats` учитывается; если нет → `pr = NULL`, но `OR c.product_nm_id IS NOT NULL` спасает.

---

## TG Уведомления: фильтрация

Уведомления отправляются только для seller-initiated чатов (аналогично очереди):

**WB (`dialogues/update/route.ts`):**
```typescript
const activeNmIds = new Set(productsWithRules.filter(p => p.rule?.work_in_chats === true));
if (!nmId || !activeNmIds.has(nmId)) continue;  // Только активные товары
```

**OZON (`ozon-chat-sync.ts`):**
```typescript
if (existing.product_nm_id) {  // Только seller-initiated (context.sku присутствовал)
  clientRepliedChats.push({...});
}
```

---

## Данные по production (18 фев 2026)

| Магазин | OZON чатов с product_nm_id | Пример товара |
|---------|---------------------------|---------------|
| Тайди-Сити | 71 | Воск для волос стик 2059941796 (work_in_chats=TRUE, 20 диалогов) |
| HANIBANI | 21 | Подгузники, капсулы, гель (work_in_chats=NULL — не настроено) |

Итого по системе: **481 seller-initiated** из **317,379 OZON чатов**.

---

## Что происходит при открытии нового чата (deletion outreach)

1. Продавец заходит в R5 → отзывы → открывает чат с покупателем
2. R5 вызывает OZON Chat API для создания диалога
3. OZON сохраняет `context.sku = артикул товара` в первом сообщении
4. При следующем unread scan или full scan R5 получает этот чат
5. `ozon-chat-sync.ts` читает историю → извлекает `context.sku` → записывает `product_nm_id`
6. При ответе покупателя: уведомление в TG + чат появляется в очереди

---

## Ограничения OZON API

- **Chat List**: нет фильтра по seller/buyer initiated, нет поля product
- **context.sku**: только в seller-initiated чатах, только в истории сообщений
- **Rate limit**: 50 req/sec (быстрее чем WB)
- **Premium Plus**: требуется для BUYER_SELLER чатов и истории (403 без него)
- **Sender types**: `customer` → client, `seller` → seller, остальные → skip

---

## Cron Jobs

| Job | Расписание | Режим |
|-----|-----------|-------|
| `startAdaptiveDialogueSync` | Adaptive 5/15/60 мин | `fullScan=false` (unread only) |
| `startOzonHourlyFullSync` | `0 6-17 * * *` (9:00-20:00 МСК) | `fullScan=true` (all opened) |

См. подробности: [CRON_JOBS.md](../CRON_JOBS.md)
