# Auto-Complaint Generation System

**Last Updated:** 2026-03-06
**Status:** Implemented (Trigger 1 + CRON Fallback)

> Merged from: AUTO_COMPLAINT_STRATEGY.md + AUTO_COMPLAINT_TRIGGERS.md + AUTO_COMPLAINT_IMPLEMENTATION_SUMMARY.md + complaint-auto-generation-rules.md

---

## Overview

Automatic complaint generation for WB reviews using **hybrid event-driven + CRON fallback** architecture.

**Business goal:** Every review matching `product_rules` gets a complaint draft instantly.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│ Event-Driven (99% of cases) — instant on review sync        │
│ File: src/services/auto-complaint-generator.ts              │
└─────────────────────────────────────────────────────────────┘
                         ↓
              New review arrives via WB API sync
                         ↓
              Validate 6 business rules (see below)
                         ↓
              Generate complaint (background, non-blocking)
                         ↓
              ✅ ~0s latency

┌─────────────────────────────────────────────────────────────┐
│ CRON Fallback (1% of cases) — hourly safety net             │
│ File: src/lib/cron-jobs.ts                                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
              Every hour: find reviews without complaints
                         ↓
              Generate for missed reviews (errors, rate limits)
```

---

## 6 Business Rules (Validation)

A complaint is generated **ONLY** if ALL conditions pass:

| # | Rule | Check |
|---|------|-------|
| 1 | Rating 1-4 | `review.rating <= 4` (no 5★) |
| 2 | Store active | `store.status = 'active'` |
| 3 | Product active | `product.work_status = 'active'` |
| 4 | Complaints enabled | `product_rules.submit_complaints = true` |
| 5 | Rating flag enabled | `product_rules.complaint_rating_{N} = true` |
| 6 | No existing complaint | Idempotency: `review_complaints` check |

**Detailed rules:** See "Additional Selection Criteria" and "Concurrency & Budget Protection" sections below.

---

## Triggers

### Trigger 1: Review Sync (IMPLEMENTED)

**When:** `POST /api/stores/{storeId}/reviews/update`

**Flow:**
1. WB API sync finds new reviews
2. Filter eligible reviews (6 rules)
3. Background generation (non-blocking `.catch()`)
4. If batch >100 reviews → deferred to CRON

**File:** `src/app/api/stores/[storeId]/reviews/update/route.ts`

### Trigger 2: Store Activation (DOCUMENTED, NOT IMPLEMENTED)

**When:** Store changes from `paused`/`stopped` → `active`

**Blocker:** `PATCH /api/stores/{storeId}` endpoint doesn't exist

### Trigger 3: Product Activation (DOCUMENTED, NOT IMPLEMENTED)

**When:** Product changes from `work_status != 'active'` → `active`

**Blocker:** `PATCH /api/products/{productId}` endpoint doesn't exist

### Trigger 4: Product Rules Update (DOCUMENTED, NOT IMPLEMENTED)

**When:** `submit_complaints` or `complaint_rating_*` flags enabled

**Blocker:** Endpoint for rules changes doesn't support event-driven generation

### Trigger 5: CRON Fallback (IMPLEMENTED)

**Schedule:** Hourly
**Batch size:** 50 reviews per store
**File:** `src/lib/cron-jobs.ts`

**Log signatures:**
```
[CRON] ✅ No backlog — event-driven coverage is working for {store}
[CRON] ⚠️  FALLBACK: Found X reviews without complaints for {store}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/services/auto-complaint-generator.ts` | Core service (389 lines): validation, background generation |
| `src/app/api/stores/[storeId]/reviews/update/route.ts` | Event-driven integration (Trigger 1) |
| `src/lib/cron-jobs.ts` | CRON fallback (Trigger 5) |
| `src/app/api/admin/metrics/auto-complaints/route.ts` | Metrics API |
| `src/db/helpers.ts` | `getReviewsWithoutComplaints()`, `getReviewsForProduct()` |

---

## Monitoring

### Metrics API

**Endpoint:** `GET /api/admin/metrics/auto-complaints`

Returns: total reviews, coverage percentage, breakdown by rating, last 24h stats.

### Key SQL Queries

**Coverage (target: 95-99% for new reviews):**
```sql
SELECT
  COUNT(*) FILTER (WHERE rc.id IS NOT NULL) as with_complaints,
  COUNT(*) as total_eligible,
  ROUND(100.0 * COUNT(*) FILTER (WHERE rc.id IS NOT NULL) / NULLIF(COUNT(*), 0), 2) as coverage_pct
FROM reviews r
INNER JOIN products p ON r.product_id = p.id
INNER JOIN product_rules pr ON pr.product_id = p.id
LEFT JOIN review_complaints rc ON rc.review_id = r.id
WHERE p.work_status = 'active'
  AND pr.submit_complaints = true
  AND r.rating BETWEEN 1 AND 4;
```

**Event-driven vs CRON split (last 7 days):**
```sql
SELECT
  COUNT(*) FILTER (WHERE rc.created_at - r.created_at < INTERVAL '5 minutes') as event_driven,
  COUNT(*) FILTER (WHERE rc.created_at - r.created_at >= INTERVAL '5 minutes') as cron_fallback,
  COUNT(*) as total
FROM review_complaints rc
INNER JOIN reviews r ON r.id = rc.review_id
WHERE rc.created_at >= NOW() - INTERVAL '7 days';
```

---

## Additional Selection Criteria

Beyond the 6 business rules above, additional filters apply:

| Criterion | Check |
|-----------|-------|
| Review date | `review.date >= '2023-10-01'` — WB may reject complaints on very old reviews |
| Review status on WB | NOT `excluded_rating`, `hidden`, `temporary_hidden` — no need to complain if already hidden |

---

## Concurrency & Budget Protection

| Parameter | Value |
|-----------|-------|
| `MAX_COMPLAINTS_PER_RUN` | 1000 |
| `CONCURRENCY_LIMIT` | 10 parallel (via `p-limit`) |
| `MAX_DAILY_BUDGET` | $5.00 USD |
| `AI_REQUESTS_PER_MINUTE` | 60 (Deepseek API) |

**Estimated throughput:** 10 parallel x ~10s each = ~1000 complaints in ~17 minutes.

Budget check runs before generation — if `todayCost >= MAX_DAILY_BUDGET`, generation stops with alert.

---

## Error Handling & Retry

**Error types:**
1. AI API unavailable — retry 3x with exponential backoff (2s, 4s, 8s)
2. Rate limit exceeded — pause 60s and retry
3. Insufficient tokens — stop generation, alert admin
4. Review/product deleted — skip, log
5. DB connection lost — retry, then stop

**Retry strategy:** 3 attempts per complaint with exponential backoff (`Math.pow(2, attempt) * 1000`ms).

---

## Known Issues

1. **Large backlog:** ~252K reviews without complaints (pre-existing). CRON processes ~50/store/hour.
2. **Triggers 2-4 not integrated:** Store/product activation and rules changes don't trigger backlog generation.
3. **Rating 4 low coverage:** Most products have `complaint_rating_4 = false` in product_rules.

---

## See Also

- [complaints.md](./complaints.md) — Complaints domain (Source of Truth)
- [CRON_JOBS.md](../CRON_JOBS.md) — Cron schedule
- [complaints-table-schema.md](./complaints-table-schema.md) — DB schema

---

**Last Updated:** 2026-03-06
