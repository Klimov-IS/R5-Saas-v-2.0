# WB Reputation Manager - Statuses Reference

**Purpose:** Single source of truth for all status values across the system (Database, API, Chrome Extension)

**Last Updated:** 2026-01-10

---

## Table of Contents

1. [Overview](#overview)
2. [Status Types](#status-types)
3. [Review Status (WB)](#review-status-wb)
4. [Product Status (by Review)](#product-status-by-review)
5. [Chat Status (by Review)](#chat-status-by-review)
6. [Complaint Status](#complaint-status)
7. [Product Work Status](#product-work-status)
8. [Chat Strategy](#chat-strategy)
9. [Store Status](#store-status)
10. [Sync Status](#sync-status)
11. [WB UI → Database Mapping](#wb-ui--database-mapping)
12. [Business Rules](#business-rules)
13. [Extension Implementation](#extension-implementation)

---

## Overview

### Why This Document Exists

**Problem:** Different status names in:
- WB User Interface (Russian text)
- Chrome Extension parsing (Russian → English)
- PostgreSQL ENUM types (English)
- API responses (English)

**Solution:** This document defines:
1. ✅ Official ENUM values in database
2. ✅ How to parse WB UI text → ENUM value
3. ✅ Business rules for each status
4. ✅ When to update statuses

### Consistency Rules

1. **Database ENUMs are authoritative** - All code must use these exact values
2. **Extension must map WB UI → Database ENUMs** - No custom status names
3. **API must validate incoming statuses** - Reject unknown values
4. **TypeScript types must match ENUMs** - Use generated types from schema

---

## Status Types

### 1. Review-Related Statuses

| Status Type | Purpose | Source | Mutable |
|-------------|---------|--------|---------|
| `review_status_wb` | Review visibility on WB | Extension parsing | Yes (WB can hide/show) |
| `product_status_by_review` | Purchase outcome | Extension parsing | No (historical) |
| `chat_status_by_review` | Chat availability | Extension parsing | Yes (WB policy changes) |
| `complaint_status` | Complaint lifecycle | Server + Extension | Yes (workflow) |

### 2. Product-Related Statuses

| Status Type | Purpose | Source | Mutable |
|-------------|---------|--------|---------|
| `work_status_enum` | Product active in workflow | User setting | Yes (user control) |
| `is_active` | Product visible in catalog | WB API + User | Yes (user control) |

### 3. Chat-Related Statuses

| Status Type | Purpose | Source | Mutable |
|-------------|---------|--------|---------|
| `chat_strategy_enum` | Chat handling approach | Product rules | Yes (user setting) |
| `tag` | Chat classification | AI classification | Yes (re-classify) |

### 4. System Statuses

| Status Type | Purpose | Source | Mutable |
|-------------|---------|--------|---------|
| `store.status` | Store active/inactive | User setting | Yes (user control) |
| `last_*_update_status` | Sync status | Server sync | Yes (each sync) |

---

## Review Status (WB)

**Database ENUM:** `review_status_wb`

```sql
CREATE TYPE review_status_wb AS ENUM (
  'visible',      -- Виден (нормальный отзыв)
  'unpublished',  -- Снят с публикации
  'excluded',     -- Исключён из рейтинга
  'unknown'       -- Неизвестно (по умолчанию)
);
```

### Values

#### `visible`
- **Meaning:** Review is publicly visible on WB
- **Russian:** "Виден" или пусто (нет значка)
- **WB UI:** No status badge OR green checkmark
- **Business Rule:** ✅ Can file complaint
- **Example:** Normal 1-star review without violations

#### `unpublished`
- **Meaning:** WB removed review from publication
- **Russian:** "Снят с публикации"
- **WB UI:** Red badge "Снят с публикации"
- **Business Rule:** ❌ Cannot file complaint (already removed)
- **Why:** WB found violations (profanity, spam, etc.)

#### `excluded`
- **Meaning:** Review excluded from rating calculation
- **Russian:** "Исключён из рейтинга" или "Временно скрыт"
- **WB UI:** Orange/yellow badge
- **Business Rule:** ❌ Cannot file complaint (already excluded)
- **Why:** Complaint approved OR automatic exclusion

#### `unknown`
- **Meaning:** Status not yet parsed by extension
- **Russian:** N/A
- **WB UI:** N/A
- **Business Rule:** ⚠️ Should be updated by extension
- **Default:** All reviews from WB API sync start as `unknown`

---

## Product Status (by Review)

**Database ENUM:** `product_status_by_review`

```sql
CREATE TYPE product_status_by_review AS ENUM (
  'purchased',      -- Выкуп
  'refused',        -- Отказ
  'not_specified',  -- Не указано
  'unknown'         -- Неизвестно
);
```

### Values

#### `purchased`
- **Meaning:** Customer purchased and kept the product
- **Russian:** "Выкуп" OR пусто (no badge)
- **WB UI:** No badge (default) OR green checkmark
- **Impact:** Review is more credible (actual customer)

#### `refused`
- **Meaning:** Customer refused/returned the product
- **Russian:** "Отказ"
- **WB UI:** Red badge "Отказ"
- **Impact:** Review credibility lower (didn't keep product)

#### `not_specified`
- **Meaning:** Purchase status not shown by WB
- **Russian:** N/A (no information)
- **WB UI:** No information available
- **Impact:** Neutral

#### `unknown`
- **Meaning:** Not yet parsed
- **Russian:** N/A
- **WB UI:** N/A
- **Default:** All reviews start as `unknown`

---

## Chat Status (by Review)

**Database ENUM:** `chat_status_by_review`

```sql
CREATE TYPE chat_status_by_review AS ENUM (
  'unavailable',  -- Недоступен
  'available',    -- Доступен (можно открыть)
  'unknown'       -- Неизвестно
);
```

### Values

#### `unavailable`
- **Meaning:** WB does not allow opening chat for this review
- **Russian:** "Недоступен" OR chat button disabled
- **WB UI:** Chat button grayed out OR "Чат недоступен"
- **Business Rule:** ❌ Cannot initiate dialogue
- **Why:** WB policy (old review, anonymous customer, etc.)

#### `available`
- **Meaning:** Can open chat with this customer
- **Russian:** Chat button enabled (no text)
- **WB UI:** Blue "Написать" button clickable
- **Business Rule:** ✅ Can initiate dialogue
- **Note:** Does NOT mean chat is already open, just that it CAN be opened

#### `unknown`
- **Meaning:** Not yet parsed
- **Russian:** N/A
- **WB UI:** N/A
- **Default:** All reviews start as `unknown`

---

## Complaint Status

**Database ENUM:** `complaint_status`

```sql
CREATE TYPE complaint_status AS ENUM (
  'not_sent',  -- Не отправлена (жалоба не создана)
  'draft',     -- Черновик (сгенерирована AI)
  'sent',      -- Отправлена (пользователь подал через расширение)
  'approved',  -- Одобрена WB
  'rejected',  -- Отклонена WB
  'pending'    -- На рассмотрении WB
);
```

### Lifecycle Workflow

```
not_sent → draft → sent → pending → approved / rejected
   ↑        ↓       ↑
   └────────┴───────┘
   (can regenerate)  (immutable after sent)
```

### Values

#### `not_sent`
- **Meaning:** No complaint generated for this review
- **Russian:** "Не отправлена"
- **Business Rule:** ✅ Can generate complaint (if review is `visible`)
- **Default:** All new reviews
- **API Endpoint:** Can call `POST /api/stores/{id}/reviews/{reviewId}/generate-complaint`

#### `draft`
- **Meaning:** AI generated complaint text, but user hasn't submitted it yet
- **Russian:** "Черновик"
- **Business Rule:**
  - ✅ Can regenerate (call generate-complaint again)
  - ✅ Can edit complaint text
  - ✅ User can submit via extension
- **DB:** Record exists in `review_complaints` table with `status = 'draft'`
- **Denormalized:** `reviews.has_complaint_draft = TRUE`

#### `sent`
- **Meaning:** User submitted complaint through Chrome extension
- **Russian:** "Отправлена"
- **Business Rule:**
  - ❌ Cannot regenerate (complaint is immutable)
  - ❌ Cannot edit
  - ⏳ Waiting for WB moderation
- **DB:** `review_complaints.sent_at IS NOT NULL`
- **Denormalized:** `reviews.has_complaint = TRUE`
- **Next Step:** WB will review → status becomes `pending`, `approved`, or `rejected`

#### `pending`
- **Meaning:** WB is currently reviewing the complaint
- **Russian:** "На рассмотрении"
- **WB UI:** Shows "На рассмотрении" in complaints section
- **Business Rule:** ⏳ Wait for WB decision
- **Timeline:** Usually 1-7 days
- **Updated By:** Extension parsing OR WB API webhook (if available)

#### `approved`
- **Meaning:** WB approved complaint, review excluded from rating
- **Russian:** "Одобрена"
- **WB UI:** Shows green checkmark + "Жалоба удовлетворена"
- **Business Rule:** ✅ Success! Review impact reduced
- **Side Effect:** `review_status_wb` should update to `excluded`
- **Analytics:** Track approval rate per complaint reason

#### `rejected`
- **Meaning:** WB rejected complaint, review remains visible
- **Russian:** "Отклонена"
- **WB UI:** Shows red X + "Жалоба отклонена" + reason
- **Business Rule:** ❌ Complaint failed, review still counts
- **DB:** `review_complaints.wb_response` contains rejection reason
- **Analytics:** Track rejection reasons to improve future complaints

---

## Product Work Status

**Database ENUM:** `work_status_enum`

```sql
CREATE TYPE work_status_enum AS ENUM (
  'not_working',  -- Не работаем с товаром
  'active',       -- Активно работаем
  'paused',       -- Приостановлено
  'completed'     -- Завершено
);
```

### Values

#### `not_working`
- **Meaning:** Product not included in complaint workflow
- **Business Rule:** ❌ Skip all automation for this product
- **Default:** All new products

#### `active`
- **Meaning:** Product actively managed (file complaints, handle chats)
- **Business Rule:** ✅ Include in automation
- **Filter:** Extension and server process only `active` products

#### `paused`
- **Meaning:** Temporarily paused automation
- **Business Rule:** ⏸️ Skip for now, but can resume later
- **Use Case:** Seasonal products, temporary issues

#### `completed`
- **Meaning:** Work finished on this product
- **Business Rule:** ✅ Archive, exclude from active workflows
- **Use Case:** Product discontinued, project finished

---

## Chat Strategy

**Database ENUM:** `chat_strategy_enum`

```sql
CREATE TYPE chat_strategy_enum AS ENUM (
  'upgrade_to_5',  -- Повышаем оценку до 5
  'delete',        -- Удаляем отзыв
  'both'           -- Оба подхода
);
```

### Values

#### `upgrade_to_5`
- **Meaning:** Negotiate with customer to change rating to 5 stars
- **Approach:** Offer compensation, resolve issue, ask for rating update
- **Goal:** Turn negative → positive review

#### `delete`
- **Meaning:** Convince customer to delete their review
- **Approach:** Offer refund/compensation in exchange for deletion
- **Goal:** Remove negative review entirely

#### `both`
- **Meaning:** Try upgrade first, if fails, try deletion
- **Approach:** Flexible negotiation
- **Goal:** Best possible outcome

---

## Store Status

**Database Field:** `stores.status` (VARCHAR)

### Values

#### `active`
- **Meaning:** Store is active and syncing
- **Business Rule:** ✅ Include in sync jobs, show in UI
- **Default:** All new stores

#### `inactive`
- **Meaning:** Store temporarily disabled
- **Business Rule:** ❌ Skip sync jobs, hide from UI
- **Use Case:** Client paused service, API token expired

---

## Sync Status

**Database Fields:** `last_*_update_status` (TEXT)

### Values

#### `null`
- **Meaning:** Never synced
- **UI:** Show "Синхронизация не выполнялась"

#### `pending`
- **Meaning:** Sync currently in progress
- **UI:** Show spinner + "Синхронизация..."
- **Set By:** Server at sync start

#### `success`
- **Meaning:** Last sync completed successfully
- **UI:** Show green checkmark + timestamp
- **Set By:** Server at sync end

#### `error`
- **Meaning:** Last sync failed
- **UI:** Show red X + error message
- **Details:** See `last_*_update_error` field
- **Set By:** Server in catch block

---

## WB UI → Database Mapping

### Review Status Parsing

**Extension Code Pattern:**
```javascript
function parseReviewStatus(reviewElement) {
  const statusBadge = reviewElement.querySelector('.status-badge');

  if (!statusBadge) {
    return 'visible'; // No badge = normal visible review
  }

  const statusText = statusBadge.textContent.trim();

  // Map Russian UI text → Database ENUM
  if (statusText.includes('Снят с публикации')) {
    return 'unpublished';
  }
  if (statusText.includes('Исключён из рейтинга') || statusText.includes('Временно скрыт')) {
    return 'excluded';
  }

  return 'unknown'; // Fallback
}
```

### Product Status Parsing

```javascript
function parseProductStatus(reviewElement) {
  const purchaseBadge = reviewElement.querySelector('.purchase-status');

  if (!purchaseBadge) {
    return 'purchased'; // Default = выкуп
  }

  const statusText = purchaseBadge.textContent.trim();

  if (statusText.includes('Отказ')) {
    return 'refused';
  }
  if (statusText.includes('Возврат')) {
    return 'refused'; // Same as отказ for our purposes
  }

  return 'not_specified';
}
```

### Chat Status Parsing

```javascript
function parseChatStatus(reviewElement) {
  const chatButton = reviewElement.querySelector('.chat-button');

  if (!chatButton) {
    return 'unavailable';
  }

  const isDisabled = chatButton.disabled || chatButton.classList.contains('disabled');

  if (isDisabled) {
    return 'unavailable';
  }

  return 'available';
}
```

### Complaint Status Parsing

```javascript
function parseComplaintStatus(reviewElement) {
  const complaintBadge = reviewElement.querySelector('.complaint-status');

  if (!complaintBadge) {
    return 'not_sent'; // No badge = no complaint
  }

  const statusText = complaintBadge.textContent.trim();

  if (statusText.includes('На рассмотрении')) {
    return 'pending';
  }
  if (statusText.includes('Одобрена') || statusText.includes('Удовлетворена')) {
    return 'approved';
  }
  if (statusText.includes('Отклонена')) {
    return 'rejected';
  }

  // If we see complaint badge but unknown text
  return 'sent'; // Assume sent if badge exists
}
```

---

## Business Rules

### When to File Complaints

✅ **File complaint if:**
```
review_status_wb = 'visible'
AND complaint_status IN ('not_sent', 'draft')
AND product.work_status = 'active'
AND product_rules.submit_complaints = TRUE
AND rating <= 3 (or configured per product)
```

❌ **DO NOT file complaint if:**
```
review_status_wb IN ('unpublished', 'excluded')  -- Already handled by WB
OR complaint_status IN ('sent', 'pending', 'approved', 'rejected')  -- Already filed
OR product.work_status != 'active'  -- Product not in workflow
```

### When to Update Status

**Extension should update statuses when:**
1. **Initial parse** - Set all statuses for newly discovered reviews
2. **Re-parse** - Update statuses on subsequent visits (detect changes)
3. **After submission** - Update `complaint_status` to `sent` after filing complaint

**Server should update statuses when:**
1. **WB API sync** - Get review data, but statuses remain `unknown` (need extension)
2. **Extension sync** - Accept status updates from extension
3. **Moderation results** - Update `complaint_status` when WB approves/rejects

### Status Priority

**If conflict between sources:**
1. Extension parsing (most recent) > WB API (may be stale)
2. But: Never downgrade `complaint_status` (sent → draft is invalid)
3. Preserve manual edits (don't overwrite user changes)

---

## Extension Implementation

### TypeScript Types

```typescript
// Ensure these match database ENUMs exactly
export type ReviewStatusWB = 'visible' | 'unpublished' | 'excluded' | 'unknown';
export type ProductStatusByReview = 'purchased' | 'refused' | 'not_specified' | 'unknown';
export type ChatStatusByReview = 'unavailable' | 'available' | 'unknown';
export type ComplaintStatus = 'not_sent' | 'draft' | 'sent' | 'approved' | 'rejected' | 'pending';

export interface ParsedReviewStatuses {
  review_status_wb: ReviewStatusWB;
  product_status_by_review: ProductStatusByReview;
  chat_status_by_review: ChatStatusByReview;
  complaint_status: ComplaintStatus;
  parsed_at: string; // ISO timestamp
  page_number: number;
}
```

### Validation

```typescript
// Extension should validate before sending to server
function isValidReviewStatus(status: string): status is ReviewStatusWB {
  return ['visible', 'unpublished', 'excluded', 'unknown'].includes(status);
}

function isValidComplaintStatus(status: string): status is ComplaintStatus {
  return ['not_sent', 'draft', 'sent', 'approved', 'rejected', 'pending'].includes(status);
}
```

### API Payload

```typescript
// POST /api/extension/stores/{storeId}/reviews/sync
interface ExtensionReviewSyncPayload {
  reviews: Array<{
    id: string;
    rating: number;
    text: string;
    author: string;
    date: string;

    // Statuses from extension parsing
    review_status_wb: ReviewStatusWB;
    product_status_by_review: ProductStatusByReview;
    chat_status_by_review: ChatStatusByReview;
    complaint_status: ComplaintStatus;

    // Metadata
    parsed_at: string;
    page_number: number;
    purchase_date?: string;
  }>;
}
```

---

## Troubleshooting

### Common Issues

**1. Extension sets `unknown` for everything**
- ✅ Check WB UI hasn't changed HTML structure
- ✅ Update CSS selectors in parsing logic
- ✅ Add fallback defaults (e.g., no badge = `visible`)

**2. Complaint status mismatch**
- ✅ Server validation rejects invalid transitions (e.g., `sent` → `draft`)
- ✅ Extension should only update if newer timestamp
- ✅ Log conflicts for manual review

**3. Database constraint violations**
- ✅ Ensure ENUM values match exactly (case-sensitive!)
- ✅ Use TypeScript types to catch errors at compile-time
- ✅ Server validates all incoming status values

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial migration: Added ENUM types to database |
| 1.1 | 2026-01-10 | Documentation created, extension integration planned |

---

**Next Steps:**
1. ✅ Implement extension status parsing (see WB UI → Database Mapping)
2. ✅ Add server validation for incoming statuses
3. ✅ Create API endpoints for extension sync
4. ✅ Add analytics dashboard for status distribution

---

**Related Documentation:**
- [Database Schema](./database-schema.md) - Full database structure
- [Extension Workflow](../extension/workflow.md) - How extension uses statuses
- [API Reference](../extension/api-reference.md) - Status field validation

**Maintained By:** R5 Team
**Last Updated:** 2026-01-10
