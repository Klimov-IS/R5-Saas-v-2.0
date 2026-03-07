# Стратегия автоматической генерации жалоб

**Дата:** 2026-01-20
**Статус:** Рекомендация Product Manager
**Цель:** 100% coverage — нет ни одного согласованного отзыва без черновика жалобы

---

## 🎯 Бизнес-требование

> "Чтобы как только отзыв по всем правилам согласованный попадал в БД, на него тут же генерировалась жалоба. То есть чтобы у нас вообще не было согласованных отзывов без черновиков жалоб."

---

## 📋 Текущее состояние (Gap Analysis)

### Что работает сейчас:
- ✅ CRON job каждый час (production) / 5 мин (test)
- ✅ Умная фильтрация через `product_rules` таблицу
- ✅ Batch генерация через API
- ✅ Автоматическая проверка правил (`submit_complaints`, `complaint_rating_*`)

### Проблема:
```
10:00 → Новый отзыв 1★ попал в БД
10:01-10:59 → ❌ НИЧЕГО НЕ ПРОИСХОДИТ
11:00 → CRON запускается → генерирует жалобу
```
**GAP:** До 59 минут задержки в production!

---

## 💡 Рекомендуемое решение: Гибридный подход

### Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│ PRIMARY: Event-Driven Generation (instant, 99% случаев)      │
└──────────────────────────────────────────────────────────────┘
                        ↓
            При попадании отзыва в БД
                        ↓
            Проверка product_rules
                        ↓
                  Генерация жалобы
                        ↓
                  ✅ 0 задержек

┌──────────────────────────────────────────────────────────────┐
│ FALLBACK: Hourly CRON (подхватывает пропущенные, 1% случаев)│
└──────────────────────────────────────────────────────────────┘
                        ↓
            Каждый час (production)
                        ↓
   Ищет отзывы без жалоб (getReviewsWithoutComplaints)
                        ↓
        Генерирует пропущенные (ошибки, rate limits)
```

### Почему гибридный?

1. **Event-Driven** — решает 99% случаев мгновенно
2. **CRON Fallback** — гарантирует 100% coverage даже при сбоях

---

## 🛠 Техническая реализация

### 1. Event-Driven генерация

**Где:** `src/app/api/stores/[storeId]/reviews/update/route.ts`

#### Добавить в конец функции (после синхронизации отзывов):

```typescript
// ============================================================================
// EVENT-DRIVEN COMPLAINT GENERATION
// ============================================================================

/**
 * Check if review should have a complaint generated
 */
async function shouldGenerateComplaint(review: Review, productRule: ProductRule | null): Promise<boolean> {
  // 1. Check product rule exists and complaints enabled
  if (!productRule?.submit_complaints) {
    return false;
  }

  // 2. Check specific rating is allowed
  const ratingKey = `complaint_rating_${review.rating}` as keyof ProductRule;
  if (!productRule[ratingKey]) {
    return false;
  }

  // 3. Check complaint doesn't already exist
  const existingComplaint = await dbHelpers.getComplaintByReviewId(review.id);
  if (existingComplaint) {
    return false;
  }

  // 4. Check rating is 1-4 (we don't complain about 5-star reviews)
  if (review.rating > 4) {
    return false;
  }

  return true;
}

/**
 * Generate complaints for newly synced reviews (background, non-blocking)
 */
async function autoGenerateComplaintsForNewReviews(
  storeId: string,
  newReviewIds: string[],
  apiKey: string
): Promise<void> {
  if (newReviewIds.length === 0) return;

  try {
    console.log(`[AUTO-COMPLAINT] Checking ${newReviewIds.length} new reviews for complaint generation...`);

    // Get reviews with their product rules
    const eligibleReviewIds: string[] = [];

    for (const reviewId of newReviewIds) {
      const review = await dbHelpers.getReviewById(reviewId);
      if (!review) continue;

      const productRule = await dbHelpers.getProductRule(review.product_id);
      const shouldGenerate = await shouldGenerateComplaint(review, productRule);

      if (shouldGenerate) {
        eligibleReviewIds.push(reviewId);
      }
    }

    if (eligibleReviewIds.length === 0) {
      console.log('[AUTO-COMPLAINT] No eligible reviews found for complaint generation');
      return;
    }

    console.log(`[AUTO-COMPLAINT] Found ${eligibleReviewIds.length} reviews needing complaints`);

    // Call batch generation API (non-blocking)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
    const response = await fetch(`${baseUrl}/api/extension/stores/${storeId}/reviews/generate-complaints-batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ review_ids: eligibleReviewIds }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log(`[AUTO-COMPLAINT] ✅ Generated ${result.generated?.length || 0} complaints (${result.failed?.length || 0} failed)`);

  } catch (error: any) {
    console.error('[AUTO-COMPLAINT] ❌ Failed to generate complaints (will retry on CRON):', error.message);
    // Don't throw — CRON will pick up missed complaints later
  }
}

// ============================================================================
// INTEGRATION POINT
// ============================================================================

// AFTER syncing reviews, add this:
// Track newly created review IDs during upsert
const newReviewIds: string[] = [];

// ... (existing review upsert logic) ...
// When upserting each review, track if it's new:
const existingReview = await dbHelpers.getReviewById(wbReview.id);
if (!existingReview) {
  newReviewIds.push(wbReview.id);
}

// ... (continue with upsert) ...

// At the end, before returning response:
if (newReviewIds.length > 0) {
  // Trigger background complaint generation (don't await — non-blocking)
  autoGenerateComplaintsForNewReviews(storeId, newReviewIds, apiKey)
    .catch(err => {
      console.error('[AUTO-COMPLAINT] Background generation failed:', err);
    });
}
```

---

### 2. Database helper function

**Где:** `src/db/helpers.ts`

```typescript
/**
 * Get complaint by review ID
 * Used to check if complaint already exists
 */
export async function getComplaintByReviewId(reviewId: string): Promise<ReviewComplaint | null> {
  const result = await query<ReviewComplaint>(
    'SELECT * FROM review_complaints WHERE review_id = $1',
    [reviewId]
  );
  return result.rows[0] || null;
}
```

---

### 3. CRON Fallback (уже работает!)

**Где:** `src/lib/cron-jobs.ts:52-190`

Оставить как есть — hourly CRON подхватит пропущенные:
```typescript
// Lines 95-100
// Auto-generate complaints immediately for active products (100% automation)
console.log(`[CRON] Starting auto-complaint generation for ${store.name}...`);
const complaintStats = await generateComplaintsForStore(store.id, store.name);
```

**Логика уже правильная:**
- Ищет отзывы без жалоб (`getReviewsWithoutComplaints`)
- Проверяет `product_rules` (submit_complaints, complaint_rating_*)
- Генерирует batch до 50 отзывов за раз

---

## 📊 Мониторинг и метрики

### Логи для отслеживания эффективности:

```typescript
// Event-Driven Logs
[AUTO-COMPLAINT] Checking 15 new reviews for complaint generation...
[AUTO-COMPLAINT] Found 8 reviews needing complaints
[AUTO-COMPLAINT] ✅ Generated 8 complaints (0 failed)

// CRON Fallback Logs (hourly)
[CRON] Starting auto-complaint generation for Store A...
[CRON] Found 2 reviews needing complaints for Store A  ← Должно быть близко к 0
[CRON] ✅ Generated complaints for Store A: 2 total
```

### KPI для мониторинга:

1. **Event-Driven Coverage:**
   ```sql
   -- Сколько процентов жалоб создано event-driven (должно быть >95%)
   SELECT
     COUNT(*) FILTER (WHERE generated_at - created_at < INTERVAL '5 minutes') as event_driven,
     COUNT(*) as total,
     ROUND(100.0 * COUNT(*) FILTER (WHERE generated_at - created_at < INTERVAL '5 minutes') / COUNT(*), 2) as coverage_pct
   FROM review_complaints
   WHERE generated_at >= NOW() - INTERVAL '7 days';
   ```

2. **CRON Fallback Usage:**
   ```sql
   -- Сколько жалоб подхвачено CRON (должно быть <5%)
   SELECT
     COUNT(*) FILTER (WHERE generated_at - created_at >= INTERVAL '5 minutes') as cron_fallback,
     COUNT(*) as total
   FROM review_complaints
   WHERE generated_at >= NOW() - INTERVAL '7 days';
   ```

3. **Review Coverage (бизнес-метрика):**
   ```sql
   -- Процент отзывов с жалобами (должен быть 100% для согласованных)
   SELECT
     COUNT(*) FILTER (WHERE rc.id IS NOT NULL) as with_complaints,
     COUNT(*) as total_eligible,
     ROUND(100.0 * COUNT(*) FILTER (WHERE rc.id IS NOT NULL) / COUNT(*), 2) as coverage_pct
   FROM reviews r
   INNER JOIN products p ON r.product_id = p.id
   INNER JOIN product_rules pr ON pr.product_id = p.id
   LEFT JOIN review_complaints rc ON rc.review_id = r.id
   WHERE p.is_active = true
     AND pr.submit_complaints = true
     AND (
       (r.rating = 1 AND pr.complaint_rating_1 = true) OR
       (r.rating = 2 AND pr.complaint_rating_2 = true) OR
       (r.rating = 3 AND pr.complaint_rating_3 = true) OR
       (r.rating = 4 AND pr.complaint_rating_4 = true)
     );
   ```

---

## ✅ Acceptance Criteria (Критерии приемки)

### Must Have:

1. ✅ Event-Driven генерация работает при синхронизации отзывов
2. ✅ Проверка `product_rules` перед генерацией
3. ✅ CRON fallback подхватывает пропущенные
4. ✅ Логирование всех генераций

### Success Metrics:

- **Event-Driven Coverage:** >95% жалоб генерируются мгновенно
- **CRON Fallback Usage:** <5% жалоб подхвачены CRON
- **Review Coverage:** 100% согласованных отзывов имеют черновики жалоб
- **Latency:** Медианная задержка генерации <10 секунд

---

## 🚀 План внедрения (MVP)

### Week 1: Event-Driven Implementation
1. ✅ Добавить `shouldGenerateComplaint()` в `reviews/update` route
2. ✅ Добавить `autoGenerateComplaintsForNewReviews()` (background)
3. ✅ Добавить `getComplaintByReviewId()` в db/helpers.ts
4. ✅ Протестировать на dev окружении

### Week 2: Monitoring & Rollout
5. ✅ Добавить метрики (SQL queries выше)
6. ✅ Rollout на production (10% → 50% → 100%)
7. ✅ Мониторинг KPIs в течение недели
8. ✅ Документация для команды

---

## 🛡 Risk Mitigation (Минимизация рисков)

### Risk 1: Массовая синхронизация отзывов (1000+ за раз)

**Проблема:** Event-driven может перегрузить API при первом импорте.

**Решение:**
```typescript
if (newReviewIds.length > 100) {
  console.log('[AUTO-COMPLAINT] Large batch detected, deferring to CRON');
  return; // Let CRON handle large batches
}
```

### Risk 2: AI API rate limits

**Проблема:** Deepseek может лимитировать при массовых запросах.

**Решение:**
- Уже есть в `/generate-complaints-batch`: concurrency limit + retry logic
- CRON fallback подхватит пропущенные

### Risk 3: Database deadlocks

**Проблема:** Одновременная генерация через event-driven + CRON.

**Решение:**
- `LEFT JOIN review_complaints` в `getReviewsWithoutComplaints()` уже защищает
- Unique constraint на `review_complaints.review_id` предотвратит дубли

---

## 📚 References

**Связанные файлы:**
- `src/lib/cron-jobs.ts` — CRON fallback logic
- `src/db/helpers.ts:1842-1883` — getReviewsWithoutComplaints()
- `docs/complaint-auto-generation-rules.md` — Правила генерации
- `docs/database-schema.md` — Schema reference

**Связанные таблицы:**
- `reviews` — Исходные отзывы
- `review_complaints` — Сгенерированные жалобы
- `products` — Товары с is_active
- `product_rules` — Правила генерации (submit_complaints, complaint_rating_*)

---

**Last Updated:** 2026-01-20
**Owner:** Product Manager
**Status:** Ready for Implementation ✅