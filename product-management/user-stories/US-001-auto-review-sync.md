# US-001: Автоматическое обновление отзывов

**Epic:** [EPIC-001: Автоматизация синхронизации](../epics/EPIC-001-automation.md)
**Sprint:** Sprint 01
**Priority:** P0 (Must Have)
**Story Points:** 5
**Status:** 📋 Backlog
**Assignee:** Developer 1

---

## User Story

**As a** продавец на Wildberries
**I want** автоматически получать новые отзывы каждые 30 минут
**So that** я могу оперативно реагировать на feedback клиентов и не терять время на ручные обновления

---

## Business Value

### Problem:
Сейчас продавец должен заходить в систему и вручную нажимать "Обновить отзывы" для каждого магазина каждые 2-3 часа. При 4 магазинах это = 60+ кликов в день и 8+ часов потраченного времени в неделю.

### Impact:
- ⏰ **Time Saved:** 8 часов/неделю на пользователя
- 💰 **Revenue Impact:** Быстрые ответы = +15% конверсия отзывов в продажи
- 😊 **User Satisfaction:** Снижение churn rate на 20%
- 📈 **Competitive Advantage:** Автоматизация — key differentiator от конкурентов

### Metrics:
- **Before:** Manual syncs = 60/день, Response time = 24ч
- **After:** Manual syncs = 0, Response time = < 2ч
- **Expected Adoption:** 100% пользователей в течение 1 недели

---

## Acceptance Criteria

### ✅ Functional Requirements

**AC-1: Автоматический запуск**
- GIVEN магазин добавлен в систему
- WHEN проходит 30 минут с последнего обновления
- THEN Cloud Function автоматически вызывает синхронизацию отзывов
- AND обновляются только новые отзывы (incremental mode)

**AC-2: Обработка всех магазинов**
- GIVEN в системе 4 активных магазина
- WHEN запускается Cloud Function
- THEN все 4 магазина обрабатываются последовательно
- AND между магазинами есть задержка 500ms (rate limiting)

**AC-3: Error handling**
- GIVEN синхронизация для магазина A упала с ошибкой
- WHEN Cloud Function продолжает работу
- THEN магазины B, C, D все равно обрабатываются
- AND ошибка логируется в Firestore (`sync_errors` коллекция)
- AND отправляется email уведомление админу

**AC-4: Статус в UI**
- GIVEN пользователь открывает страницу магазина
- WHEN отзывы обновляются автоматически
- THEN показывается Badge "🔄 Авто-обновление"
- AND отображается время последней синхронизации "Обновлено 15 минут назад"

**AC-5: Manual override**
- GIVEN автоматическое обновление включено
- WHEN пользователь нажимает кнопку "Обновить сейчас"
- THEN запускается ручная синхронизация немедленно
- AND не ждет следующего расписания

### 🔧 Technical Requirements

**TC-1: Cloud Function specs**
- Runtime: Node.js 18
- Region: europe-west1
- Timeout: 540 секунд (9 минут)
- Memory: 512 MB
- Trigger: Cloud Scheduler (Pub/Sub)

**TC-2: Cron schedule**
- Expression: `*/30 * * * *` (каждые 30 минут)
- Timezone: Europe/Moscow
- First run: 00:00, затем каждые 30 минут

**TC-3: Retry logic**
- Max retries: 3
- Retry on: 429 (Rate Limit), 500 (Server Error)
- Backoff: Exponential (1s, 2s, 4s)

**TC-4: Monitoring**
- Log level: INFO для успехов, ERROR для ошибок
- Metrics: `reviews_synced_count`, `sync_duration_ms`, `error_count`
- Alerts: Если > 3 ошибки за час → email админу

### 🎨 UI Requirements

**UI-1: Status Badge**
```
┌─────────────────────────────────────┐
│ Магазин "Моя Одежда"                │
│ 🔄 Авто-обновление                  │
│ Обновлено 15 минут назад            │
│ [Обновить сейчас]                   │
└─────────────────────────────────────┘
```

**UI-2: Loading state**
- Во время синхронизации показать spinner
- Текст: "Обновление отзывов..."

**UI-3: Error state**
- Если ошибка → показать Alert
- Текст: "Не удалось обновить отзывы. Попробуйте снова."

---

## Design Mockups

### Desktop View
```
┌────────────────────────────────────────────────────────────┐
│  WB Reputation Manager                    [Settings] [👤]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ← Все магазины                                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Магазин "Моя Одежда"                                │  │
│  │  ─────────────────────────────────────────────────── │  │
│  │                                                       │  │
│  │  🔄 Авто-обновление активно                          │  │
│  │  ✅ Отзывы обновлены 15 минут назад                  │  │
│  │  ✅ Чаты обновлены 8 минут назад                     │  │
│  │                                                       │  │
│  │  [🔄 Обновить сейчас]  [⚙️ Настройки]               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Последние отзывы:                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ⭐⭐⭐⭐⭐ Иванова Мария • 12 минут назад             │  │
│  │ "Отличный товар! Быстрая доставка..."                │  │
│  │ [Ответить с AI] [Создать жалобу]                     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Architecture Flow
```
┌─────────────────────────────────────────────┐
│  Cloud Scheduler                            │
│  Cron: */30 * * * *                         │
│  Topic: scheduled-review-updates            │
└──────────────────┬──────────────────────────┘
                   │ Pub/Sub message
┌──────────────────▼──────────────────────────┐
│  Cloud Function: scheduledReviewUpdates     │
│  - Reads all stores from Firestore          │
│  - For each store:                          │
│    - Call refreshReviewsForStore()          │
│    - Catch errors → log to sync_errors      │
│    - Rate limiting: 500ms delay             │
└──────────────────┬──────────────────────────┘
                   │ Server Action call
┌──────────────────▼──────────────────────────┐
│  refreshReviewsForStore(storeId, mode)      │
│  - Fetch from WB API                        │
│  - Update Firestore                         │
│  - Return success/error                     │
└──────────────────┬──────────────────────────┘
                   │ Database write
┌──────────────────▼──────────────────────────┐
│  Firestore                                  │
│  - stores/{storeId}                         │
│    - lastReviewUpdateDate                   │
│    - lastReviewUpdateStatus                 │
│  - products/{productId}/reviews/{reviewId}  │
└─────────────────────────────────────────────┘
```

### Code Structure

```typescript
// functions/src/scheduled-review-updates.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const scheduledReviewUpdates = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 540,
    memory: '512MB',
  })
  .pubsub
  .schedule('every 30 minutes')
  .timeZone('Europe/Moscow')
  .onRun(async (context) => {
    const firestore = admin.firestore();
    const storesSnap = await firestore.collection('stores').get();

    console.log(`[AUTO-SYNC] Starting scheduled review updates for ${storesSnap.size} stores`);

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const storeName = storeDoc.data().name;

      try {
        console.log(`[AUTO-SYNC] Processing store: ${storeName} (${storeId})`);

        // Import server action dynamically
        const { refreshReviewsForStore } = await import(
          '../../src/lib/server-actions/refresh-reviews'
        );

        // Run incremental sync
        await refreshReviewsForStore(storeId, 'incremental');

        console.log(`[AUTO-SYNC] ✅ Successfully synced reviews for ${storeName}`);
      } catch (error: any) {
        console.error(`[AUTO-SYNC] ❌ Error syncing ${storeName}:`, error);

        // Log error to Firestore
        await firestore.collection('sync_errors').add({
          storeId,
          storeName,
          type: 'reviews',
          error: error.message,
          stack: error.stack,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // TODO: Send email notification
        // await sendErrorNotification(storeId, error);
      }

      // Rate limiting: 500ms between stores
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[AUTO-SYNC] Completed scheduled review updates`);
    return null;
  });
```

### Firestore Schema Changes

**New collection: `sync_errors`**
```typescript
interface SyncError {
  storeId: string;
  storeName: string;
  type: 'reviews' | 'chats' | 'questions';
  error: string;
  stack?: string;
  timestamp: Timestamp;
}
```

**Updated `stores` document:**
```typescript
interface Store {
  // ... existing fields
  lastReviewAutoSyncDate?: string; // ISO 8601
  autoSyncEnabled?: boolean; // for future UI toggle
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// functions/src/__tests__/scheduled-review-updates.test.ts
import { scheduledReviewUpdates } from '../scheduled-review-updates';
import * as admin from 'firebase-admin';

describe('scheduledReviewUpdates', () => {
  it('should process all stores', async () => {
    // Mock Firestore
    const mockStores = [
      { id: 'store1', data: () => ({ name: 'Store 1' }) },
      { id: 'store2', data: () => ({ name: 'Store 2' }) },
    ];

    // ... test logic
  });

  it('should handle errors gracefully', async () => {
    // ... test logic
  });
});
```

### Integration Tests

1. **Staging Environment Test:**
   - Деплой Cloud Function на staging
   - Trigger вручную через Cloud Console
   - Проверить логи в Cloud Logging
   - Проверить данные в Firestore

2. **Production Canary Test:**
   - Включить для 1 магазина
   - Мониторить 24 часа
   - Проверить отсутствие ошибок

### Manual QA Checklist

- [ ] Cloud Function успешно деплоится
- [ ] Cron запускается каждые 30 минут
- [ ] Все магазины обрабатываются
- [ ] Ошибки логируются в `sync_errors`
- [ ] UI показывает корректный статус
- [ ] Кнопка "Обновить сейчас" работает
- [ ] Нет дублирования отзывов
- [ ] Performance: < 2 минуты на 4 магазина

---

## Rollout Plan

### Week 1: Development
- [ ] Day 1-2: Создать Cloud Function
- [ ] Day 3: Настроить Cloud Scheduler
- [ ] Day 4: Error handling + logging
- [ ] Day 5: UI changes

### Week 2: Testing & Deploy
- [ ] Day 1-2: Unit + Integration тесты
- [ ] Day 3: Staging deploy + testing
- [ ] Day 4: Production canary (1 магазин)
- [ ] Day 5: Full rollout (все магазины)

### Success Criteria for Rollout
- ✅ 0 errors in 24 hours
- ✅ All reviews synced within 30 minutes
- ✅ Positive user feedback
- ✅ Cloud costs < $5/month

---

## Dependencies

### Upstream (Blockers):
- ❌ None - все зависимости уже готовы

### Downstream (Impacts):
- US-002 (Chat sync) — использует аналогичную архитектуру
- US-003 (No-reply messages) — зависит от работающего auto-sync

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WB API rate limits | Medium | High | 500ms delay between stores |
| Cloud Function timeout | Low | Medium | Process 1 store per invocation if needed |
| Firestore costs increase | Medium | Low | Monitor usage, set budgets |
| Duplicate reviews | Low | Medium | Use review.id as document ID |

---

## Open Questions

1. ❓ Нужно ли email уведомление при каждой ошибке или только при критических?
   - **Decision:** Только при критических (> 3 ошибки за час)

2. ❓ Должны ли пользователи видеть логи синхронизации?
   - **Decision:** Нет, пока нет. Добавим в Sprint 02 если будут запросы.

3. ❓ Что делать если WB API недоступен > 1 час?
   - **Decision:** Retry каждые 30 минут автоматически. Alert админу.

---

## Related Documents

- [EPIC-001: Автоматизация](../epics/EPIC-001-automation.md)
- [Sprint 01 Planning](../sprints/sprint-01/planning.md)
- [Technical Spec: Firebase Functions](../technical-specs/TECH-001-firebase-functions.md)

---

## History

| Date | Author | Change |
|------|--------|--------|
| 2024-12-30 | Product Team | Initial creation |

---

**Status:** 📋 Ready for Development
**Next Step:** Начать TASK-001 в Sprint 01
