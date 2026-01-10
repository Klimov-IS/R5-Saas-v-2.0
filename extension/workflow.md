# WB Reputation Manager - Extension Workflow v1.0

**Document Type:** Technical Specification
**Version:** 1.0 MVP
**Last Updated:** 2026-01-10

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [User Workflow](#user-workflow)
4. [Technical Workflow](#technical-workflow)
5. [API Integration](#api-integration)
6. [Error Handling](#error-handling)
7. [State Management](#state-management)
8. [Performance Optimization](#performance-optimization)

---

## Overview

### Purpose

This document describes the **detailed step-by-step workflow** of the Chrome Extension v1.0, from user action to complaint submission.

### Scope

**Included:**
- Complete user interaction flow
- Technical implementation details
- API request/response formats
- Error handling strategies
- State management approach

**Not Included:**
- Backend API implementation (separate document)
- Database schema (see `docs/database-schema.md`)
- Chrome Extension packaging/deployment

---

## Architecture Components

### Extension Components

```
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension                                       │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Background.js   │  │ Content.js      │             │
│  │ (Service Worker)│  │ (Page Script)   │             │
│  │                 │  │                 │             │
│  │ - Auth token    │  │ - DOM parsing   │             │
│  │ - API client    │  │ - UI automation │             │
│  │ - State sync    │  │ - Status detect │             │
│  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                       │
│           │   chrome.runtime   │                       │
│           │ ←───────messages───→                       │
│           │                    │                       │
│  ┌────────┴────────────────────┴────────┐             │
│  │ Popup.js (Extension UI)              │             │
│  │ - Start/Stop controls                │             │
│  │ - Progress display                   │             │
│  │ - Settings                           │             │
│  └──────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### Backend Integration

```
Extension ──────→ Backend API
  │                    │
  │ 1. POST /api/extension/auth/validate
  │ ← { valid: true, user_id, stores }
  │
  │ 2. GET /api/extension/stores/{id}/products?status=active
  │ ← { products: [...] }
  │
  │ 3. POST /api/extension/stores/{id}/reviews/sync
  │ ← { synced: 47, updated: 12, need_complaints: [id1, id2, ...] }
  │
  │ 4. POST /api/extension/stores/{id}/reviews/{reviewId}/generate-complaint
  │ ← { complaint_text, reason_id, reason_name }
  │
  │ 5. POST /api/extension/stores/{id}/reviews/{reviewId}/report-sent
  │ ← { success: true }
```

---

## User Workflow

### Phase 1: Setup (One-Time)

#### Step 1.1: Install Extension
```
User → Chrome Web Store
     → "Add to Chrome"
     → Extension installed
     → Icon appears in toolbar
```

#### Step 1.2: Authenticate
```
User → Clicks extension icon
     → Popup opens
     → Sees "⚠️ Not authenticated"
     → Clicks "Settings" tab
     → Enters API token (from SaaS dashboard)
     → Clicks "Save"

Extension → Validates token with backend
          → GET /api/extension/auth/validate
          → Headers: { Authorization: Bearer <token> }

Backend → Returns: { valid: true, user_id: "xyz", stores: [...] }

Extension → Saves token to chrome.storage.sync
          → Shows "✅ Authenticated as user@example.com"
          → Loads stores list into dropdown
```

**User sees:**
```
┌─────────────────────────────────┐
│ WB Complaint Extension          │
├─────────────────────────────────┤
│ ✅ Authenticated                │
│                                 │
│ Select Store:                   │
│ [▼ ИП Абагалаев Г. Т.      ]   │
│                                 │
│ [Start Processing]              │
└─────────────────────────────────┘
```

---

### Phase 2: Processing Reviews

#### Step 2.1: User Navigates to WB Cabinet
```
User → Opens WB Seller Cabinet
     → Logs in to specific store (e.g., "ИП Абагалаев")
     → Navigates to: Продажи → Вопросы и отзывы → Отзывы
     → Page loads with review list
```

**URL Pattern:**
```
https://seller.wildberries.ru/feedback-questions/questions-feedback/feedbacks
```

#### Step 2.2: User Selects Store in Extension
```
User → Clicks extension icon
     → Sees store dropdown
     → Selects: "ИП Абагалаев Г. Т."
     → Extension saves selection to chrome.storage.local
```

**Extension auto-detects store (v1.5 feature):**
```javascript
// Future: Parse store name from page title or URL
const storeName = document.querySelector('.store-name')?.textContent;
const matchedStore = stores.find(s => s.name === storeName);
if (matchedStore) {
  // Auto-select store
  selectedStoreId = matchedStore.id;
}
```

#### Step 2.3: (Optional) Filter by Product
```
User → In WB UI, selects product filter
     → Dropdown: "Выберите товар"
     → Selects: "Product ABC (nmId: 12345)"
     → Page reloads with filtered reviews
```

**OR Extension Auto-Filters (v1.5):**
```
Extension → Fetches active products from backend
          → GET /api/extension/stores/{id}/products?status=active
          → Backend returns: [{ wb_product_id: "12345", name: "..." }, ...]
          → Extension inserts first product nmId into WB filter
          → Page reloads
          → Process all reviews for this product
          → Repeat for next product
```

**MVP Approach:**
- User manually filters OR no filter (all products)
- Extension processes whatever is visible on page

---

#### Step 2.4: User Starts Processing
```
User → Clicks "Start Processing" button
```

**Extension:**
```
1. Shows progress UI:
   ┌─────────────────────────────────┐
   │ 🔄 Processing...                │
   │ [████████░░░░░░░░░░░] 40%       │
   │ Parsed: 47 / 120 reviews        │
   │ Generated: 15 complaints        │
   │ Submitted: 8 complaints         │
   └─────────────────────────────────┘

2. Disables "Start" button (prevent duplicate runs)
3. Begins workflow (see Technical Workflow below)
```

---

## Technical Workflow

### Stage 1: Review Parsing

#### Input
```
DOM: WB cabinet page with review list
```

#### Process

**1.1 Find all review elements:**
```javascript
const reviewElements = document.querySelectorAll('.review-item'); // CSS selector TBD
console.log(`Found ${reviewElements.length} reviews on page`);
```

**1.2 Parse each review:**
```javascript
const parsedReviews = [];

for (const element of reviewElements) {
  const review = {
    // Basic data (from WB API structure)
    id: element.getAttribute('data-review-id') || extractIdFromElement(element),
    rating: parseInt(element.querySelector('.rating')?.textContent),
    text: element.querySelector('.review-text')?.textContent.trim(),
    author: element.querySelector('.author-name')?.textContent.trim(),
    date: parseDate(element.querySelector('.review-date')?.textContent),

    // Extension-parsed statuses (NOT in WB API)
    review_status_wb: parseReviewStatus(element),
    product_status_by_review: parseProductStatus(element),
    chat_status_by_review: parseChatStatus(element),
    complaint_status: parseComplaintStatus(element),

    // Metadata
    parsed_at: new Date().toISOString(),
    page_number: getCurrentPageNumber(),
    purchase_date: parsePurchaseDate(element), // if visible
  };

  parsedReviews.push(review);
}
```

**1.3 Status Parsing Functions:**

See `docs/statuses-reference.md` for detailed mapping rules.

```javascript
function parseReviewStatus(element) {
  const badge = element.querySelector('.review-status-badge');
  if (!badge) return 'visible'; // No badge = visible

  const text = badge.textContent.trim();
  if (text.includes('Снят с публикации')) return 'unpublished';
  if (text.includes('Исключён') || text.includes('Временно скрыт')) return 'excluded';
  return 'unknown';
}

function parseComplaintStatus(element) {
  const complaintBadge = element.querySelector('.complaint-status');
  if (!complaintBadge) return 'not_sent';

  const text = complaintBadge.textContent.trim();
  if (text.includes('На рассмотрении')) return 'pending';
  if (text.includes('Одобрена')) return 'approved';
  if (text.includes('Отклонена')) return 'rejected';
  return 'sent'; // Assume sent if badge exists
}
```

#### Output
```javascript
[
  {
    id: "abc123",
    rating: 1,
    text: "Ужасное качество!",
    author: "Иван П.",
    date: "2026-01-05T10:30:00Z",
    review_status_wb: "visible",
    product_status_by_review: "purchased",
    chat_status_by_review: "available",
    complaint_status: "not_sent",
    parsed_at: "2026-01-10T12:00:00Z",
    page_number: 1
  },
  // ... 46 more reviews
]
```

---

### Stage 2: Data Synchronization

#### Input
```
parsedReviews: Array<ParsedReview>
```

#### Process

**2.1 Send to backend:**
```javascript
const response = await fetch(`${API_URL}/api/extension/stores/${storeId}/reviews/sync`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    reviews: parsedReviews,
  }),
});

const result = await response.json();
```

#### Backend Logic (Server-Side)

**2.2 Upsert reviews:**
```typescript
// Pseudo-code
for (const review of payload.reviews) {
  // Upsert review (update if exists, insert if new)
  await db.query(`
    INSERT INTO reviews (
      id, product_id, store_id, owner_id,
      rating, text, author, date,
      review_status_wb, product_status_by_review,
      chat_status_by_review, complaint_status,
      parsed_at, page_number, purchase_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    ON CONFLICT (id) DO UPDATE SET
      review_status_wb = EXCLUDED.review_status_wb,
      product_status_by_review = EXCLUDED.product_status_by_review,
      chat_status_by_review = EXCLUDED.chat_status_by_review,
      complaint_status = CASE
        -- Never downgrade complaint_status (sent → not_sent is invalid)
        WHEN reviews.complaint_status IN ('sent', 'pending', 'approved', 'rejected')
          AND EXCLUDED.complaint_status IN ('not_sent', 'draft')
        THEN reviews.complaint_status
        ELSE EXCLUDED.complaint_status
      END,
      parsed_at = EXCLUDED.parsed_at,
      updated_at = NOW()
  `, [review.id, ...]);
}
```

**2.3 Identify reviews needing complaints:**
```typescript
const needComplaints = await db.query(`
  SELECT id
  FROM reviews
  WHERE store_id = $1
    AND review_status_wb = 'visible'
    AND complaint_status IN ('not_sent', 'draft')
    AND rating <= 3
    AND is_product_active = TRUE
`, [storeId]);

return {
  synced: parsedReviews.length,
  updated: updatedCount,
  need_complaints: needComplaints.rows.map(r => r.id),
};
```

#### Output (Backend Response)
```json
{
  "synced": 47,
  "updated": 12,
  "need_complaints": ["abc123", "def456", "ghi789"]
}
```

---

### Stage 3: Complaint Generation

#### Input
```
need_complaints: ["abc123", "def456", "ghi789"]
```

#### Process

**3.1 For each review needing complaint:**
```javascript
const complaints = [];

for (const reviewId of need_complaints) {
  try {
    const response = await fetch(
      `${API_URL}/api/extension/stores/${storeId}/reviews/${reviewId}/generate-complaint`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const complaint = await response.json();
    complaints.push({ reviewId, ...complaint });

    // Update progress UI
    updateProgress({
      generated: complaints.length,
      total: need_complaints.length,
    });

  } catch (error) {
    console.error(`Failed to generate complaint for ${reviewId}:`, error);
    // Log error, continue to next review
  }
}
```

#### Backend Logic (Server-Side)

**3.2 Check if complaint already exists:**
```typescript
const existing = await getComplaintByReviewId(reviewId);

if (existing && existing.status === 'draft') {
  // Return existing draft
  return {
    complaint_text: existing.complaint_text,
    reason_id: existing.reason_id,
    reason_name: existing.reason_name,
  };
}

if (existing && existing.status === 'sent') {
  // Already sent, cannot regenerate
  throw new Error('Complaint already sent, cannot regenerate');
}
```

**3.3 Generate new complaint:**
```typescript
// Get review and product details
const review = await getReviewById(reviewId);
const product = await getProductById(review.product_id);
const productRules = await getProductRules(product.id);

// Check if complaint is allowed by rules
if (!productRules.submit_complaints) {
  throw new Error('Complaints disabled for this product');
}

// Generate via AI flow
const { complaintText, reasonId, reasonName } = await generateReviewComplaint({
  reviewText: review.text,
  rating: review.rating,
  productName: product.name,
  // ... other context
});

// Save to database
const complaint = await createComplaint({
  review_id: reviewId,
  store_id: review.store_id,
  owner_id: review.owner_id,
  product_id: review.product_id,
  complaint_text: complaintText,
  reason_id: reasonId,
  reason_name: reasonName,
  status: 'draft',
  review_rating: review.rating,
  review_text: review.text,
  review_date: review.date,
  // ... AI metadata
});

return {
  complaint_text: complaint.complaint_text,
  reason_id: complaint.reason_id,
  reason_name: complaint.reason_name,
};
```

#### Output
```javascript
[
  {
    reviewId: "abc123",
    complaint_text: "Данный отзыв не относится к товару...",
    reason_id: 11,
    reason_name: "Отзыв не относится к товару"
  },
  {
    reviewId: "def456",
    complaint_text: "Отзыв содержит оскорбительные выражения...",
    reason_id: 14,
    reason_name: "Оскорбительные выражения"
  },
  // ...
]
```

---

### Stage 4: Complaint Submission

#### Input
```
complaints: Array<{ reviewId, complaint_text, reason_id, reason_name }>
```

#### Process

**4.1 For each complaint:**
```javascript
const submitted = [];
const failed = [];

for (const complaint of complaints) {
  try {
    // Find review element in DOM
    const reviewElement = document.querySelector(`[data-review-id="${complaint.reviewId}"]`);

    if (!reviewElement) {
      throw new Error('Review element not found in DOM');
    }

    // Find "Подать жалобу" button
    const complaintButton = reviewElement.querySelector('.submit-complaint-btn');

    if (!complaintButton) {
      throw new Error('Complaint button not found');
    }

    // Click button → modal opens
    complaintButton.click();

    // Wait for modal to appear
    await waitForElement('.complaint-modal', 3000);

    // Fill form
    const modal = document.querySelector('.complaint-modal');
    const categorySelect = modal.querySelector('select[name="category"]');
    const textArea = modal.querySelector('textarea[name="complaint"]');
    const submitButton = modal.querySelector('.submit-btn');

    // Select category (by reason_id)
    categorySelect.value = complaint.reason_id.toString();
    categorySelect.dispatchEvent(new Event('change'));

    // Paste complaint text
    textArea.value = complaint.complaint_text;
    textArea.dispatchEvent(new Event('input'));

    // Submit
    submitButton.click();

    // Wait for WB response
    const success = await waitForSubmitResponse(5000);

    if (success) {
      submitted.push({
        reviewId: complaint.reviewId,
        sent_at: new Date().toISOString(),
        wb_response: 'success',
      });

      // Update progress UI
      updateProgress({ submitted: submitted.length });

      // Delay before next submission (rate limiting)
      await sleep(3000); // 3 seconds

    } else {
      throw new Error('WB submission failed');
    }

  } catch (error) {
    console.error(`Failed to submit complaint for ${complaint.reviewId}:`, error);
    failed.push({
      reviewId: complaint.reviewId,
      error: error.message,
    });
  }
}
```

**4.2 Helper functions:**
```javascript
function waitForElement(selector, timeout) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) return resolve(element);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

function waitForSubmitResponse(timeout) {
  return new Promise((resolve) => {
    // Wait for success message or error message in modal
    const checkSuccess = setInterval(() => {
      const successMsg = document.querySelector('.complaint-success');
      const errorMsg = document.querySelector('.complaint-error');

      if (successMsg) {
        clearInterval(checkSuccess);
        resolve(true);
      }
      if (errorMsg) {
        clearInterval(checkSuccess);
        resolve(false);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(checkSuccess);
      resolve(false); // Timeout = assume failure
    }, timeout);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### Output
```javascript
{
  submitted: [
    { reviewId: "abc123", sent_at: "2026-01-10T12:15:00Z", wb_response: "success" },
    { reviewId: "def456", sent_at: "2026-01-10T12:15:05Z", wb_response: "success" },
  ],
  failed: [
    { reviewId: "ghi789", error: "Complaint button not found" },
  ]
}
```

---

### Stage 5: Reporting Results

#### Input
```
submitted: Array<{ reviewId, sent_at, wb_response }>
failed: Array<{ reviewId, error }>
```

#### Process

**5.1 Report each submitted complaint:**
```javascript
for (const result of submitted) {
  await fetch(
    `${API_URL}/api/extension/stores/${storeId}/reviews/${result.reviewId}/report-sent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sent_at: result.sent_at,
        wb_response: result.wb_response,
      }),
    }
  );
}
```

#### Backend Logic (Server-Side)

**5.2 Update complaint status:**
```typescript
const complaint = await getComplaintByReviewId(reviewId);

if (!complaint) {
  throw new Error('Complaint not found');
}

if (complaint.status !== 'draft') {
  throw new Error('Can only mark draft complaints as sent');
}

// Update complaint
await updateComplaint(complaint.id, {
  status: 'sent',
  sent_at: payload.sent_at,
  sent_by_user_id: userId, // from auth token
  wb_response: payload.wb_response,
});

// Update review denormalized fields
await updateReview(reviewId, {
  complaint_status: 'sent',
  complaint_sent_date: payload.sent_at,
  has_complaint: true,
  has_complaint_draft: false,
});
```

**5.3 Log failed submissions:**
```javascript
for (const failure of failed) {
  console.error(`Failed: ${failure.reviewId} - ${failure.error}`);
  // Optionally: send error log to backend
}
```

#### Output
```
Backend: review_complaints table updated
         reviews.complaint_status = 'sent'
         reviews.complaint_sent_date = '2026-01-10T12:15:00Z'

Extension: Shows final summary
```

---

### Stage 6: Display Summary

#### Process

**6.1 Show completion notification:**
```javascript
const summary = {
  total_parsed: parsedReviews.length,
  complaints_generated: complaints.length,
  complaints_submitted: submitted.length,
  complaints_failed: failed.length,
  skipped: parsedReviews.length - complaints.length, // Reviews that didn't need complaints
};

// Show in extension popup
showSummary(summary);

// Browser notification
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icon128.png',
  title: 'Complaint Processing Complete',
  message: `✅ Submitted: ${summary.complaints_submitted}\n❌ Failed: ${summary.complaints_failed}`,
});
```

**6.2 Extension UI displays:**
```
┌─────────────────────────────────────┐
│ ✅ Processing Complete!             │
├─────────────────────────────────────┤
│ Parsed reviews:        47           │
│ ✅ Complaints submitted: 15         │
│ ⏭️  Skipped (already sent): 12      │
│ ❌ Failed:               2          │
│                                     │
│ [View Details] [Download Log]      │
│ [Process Next Product]              │
└─────────────────────────────────────┘
```

---

## API Integration

### Authentication

**All API requests include:**
```javascript
headers: {
  'Authorization': `Bearer ${apiToken}`,
  'Content-Type': 'application/json',
}
```

**Token validation:**
```
GET /api/extension/auth/validate
Response: { valid: true, user_id, stores }
```

---

### API Endpoints (Summary)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/extension/auth/validate` | Validate API token |
| GET | `/api/extension/stores` | Get all stores for user |
| GET | `/api/extension/stores/{id}/products?status=active` | Get active products |
| POST | `/api/extension/stores/{id}/reviews/sync` | Sync parsed reviews |
| POST | `/api/extension/stores/{id}/reviews/{reviewId}/generate-complaint` | Generate complaint |
| POST | `/api/extension/stores/{id}/reviews/{reviewId}/report-sent` | Report complaint sent |

**Full API specification:** See `extension/api-reference.md` (to be created after code review)

---

## Error Handling

### Network Errors

**Strategy:** Retry with exponential backoff

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt === maxRetries) {
        throw error; // Give up after max retries
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await sleep(delay);
    }
  }
}
```

---

### WB UI Errors

**Strategy:** Log and skip, continue to next review

```javascript
try {
  await submitComplaint(reviewId, complaint);
} catch (error) {
  console.error(`Failed to submit complaint for ${reviewId}:`, error);

  // Log to extension storage (for download)
  await logError({
    reviewId,
    error: error.message,
    timestamp: new Date().toISOString(),
  });

  // Increment failed counter
  failedCount++;

  // Continue to next review (don't stop entire process)
  continue;
}
```

---

### Backend Errors

**Strategy:** Show user-friendly message, allow retry

```javascript
if (response.status === 500) {
  showError('Server error. Please try again in a few minutes.');
  // Allow user to retry
  enableRetryButton();
}

if (response.status === 401) {
  showError('Invalid API token. Please re-enter in settings.');
  // Redirect to settings
  openSettingsTab();
}
```

---

## State Management

### Persistent State (chrome.storage.sync)

```javascript
{
  apiToken: "wbrm_ext_...",
  selectedStoreId: "TwKRrPji2KhTS8TmYJlD",
  settings: {
    autoFilter: true,
    delayBetweenSubmissions: 3000,
  }
}
```

### Session State (chrome.storage.local)

```javascript
{
  currentSession: {
    storeId: "TwKRrPji2KhTS8TmYJlD",
    startTime: "2026-01-10T12:00:00Z",
    parsedReviews: 47,
    generated: 15,
    submitted: 8,
    failed: 2,
  },
  errorLog: [
    { reviewId: "abc", error: "Button not found", timestamp: "..." },
  ]
}
```

### Crash Recovery

```javascript
// On extension restart, check if there was an incomplete session
const session = await chrome.storage.local.get('currentSession');

if (session.currentSession && !session.currentSession.completed) {
  // Ask user if they want to resume
  if (confirm('Found incomplete session. Resume?')) {
    resumeSession(session.currentSession);
  }
}
```

---

## Performance Optimization

### Batch API Requests

**✅ Good:** Send 50 reviews in 1 request
```javascript
POST /api/extension/stores/{id}/reviews/sync
Body: { reviews: [review1, review2, ..., review50] }
```

**❌ Bad:** Send 50 separate requests
```javascript
for (const review of reviews) {
  POST /api/extension/stores/{id}/reviews/sync
  Body: { reviews: [review] }
}
```

---

### Lazy Parsing

**Don't parse all pages upfront** - process current page, then move to next

```javascript
// v1.0: Process only current page
const reviews = parseCurrentPage();
await processReviews(reviews);

// v1.5: Process all pages
for (let page = 1; page <= totalPages; page++) {
  navigateToPage(page);
  const reviews = parseCurrentPage();
  await processReviews(reviews);
}
```

---

### Rate Limiting

**Respect WB servers:**
```javascript
const DELAY_BETWEEN_SUBMISSIONS = 3000; // 3 seconds

for (const complaint of complaints) {
  await submitComplaint(complaint);
  await sleep(DELAY_BETWEEN_SUBMISSIONS);
}
```

---

## Next Steps

1. ✅ Review existing extension code
2. ✅ Identify reusable components
3. ✅ Create API endpoint specifications
4. ✅ Implement backend endpoints
5. ✅ Refactor extension to match this workflow
6. ✅ Add error handling and state management
7. ✅ Test with pilot stores
8. ✅ Deploy to production

---

**Related Documentation:**
- [Product Vision](./product-vision.md) - Why we're building this
- [API Reference](./api-reference.md) - Backend API specification (TBD)
- [Database Schema](../docs/database-schema.md) - Database structure
- [Statuses Reference](../docs/statuses-reference.md) - Status values and mapping

**Maintained By:** R5 Team
**Last Updated:** 2026-01-10
