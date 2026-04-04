# R5 Reputation Manager - Database Schema

**Database:** PostgreSQL 15 (Yandex Managed)
**ORM:** None (raw SQL via `pg` library)
**Connection Pool:** Max 50 connections
**Marketplaces:** Wildberries, OZON
**Last Updated:** 2026-04-04

---

## Table of Contents

1. [Overview](#overview)
2. [ENUM Types](#enum-types)
3. [Core Tables](#core-tables)
   - [users](#users)
   - [stores](#stores)
   - [products](#products)
   - [reviews](#reviews)
   - [review_complaints](#review_complaints)
   - [complaint_details](#complaint_details)
   - [complaint_backfill_jobs](#complaint_backfill_jobs)
   - [complaint_daily_limits](#complaint_daily_limits)
4. [Communication Tables](#communication-tables)
   - [chats](#chats)
   - [chat_status_history](#chat_status_history)
   - [chat_messages](#chat_messages)
   - [questions](#questions)
   - [chat_auto_sequences](#chat_auto_sequences)
   - [store_faq](#store_faq)
   - [store_guides](#store_guides)
   - [manager_tasks](#manager_tasks)
5. [Configuration Tables](#configuration-tables)
   - [user_settings](#user_settings)
   - [product_rules](#product_rules)
6. [Analytics Tables](#analytics-tables)
   - [ai_logs](#ai_logs)
   - [review_statuses_from_extension](#review_statuses_from_extension)
7. [Auth & Organizations Tables](#auth--organizations-tables)
   - [organizations](#organizations)
   - [org_members](#org_members)
   - [member_store_access](#member_store_access)
   - [invites](#invites)
8. [Entity Relationships](#entity-relationships)
9. [Indexes Strategy](#indexes-strategy)
10. [Triggers & Functions](#triggers--functions)

---

## Overview

### Architecture Principles

1. **Denormalization for Performance**
   - Critical fields duplicated (e.g., `store_id`, `owner_id` in all child tables)
   - Pre-computed counts (e.g., `total_reviews`, `total_chats` in stores)
   - Boolean flags for fast filtering (e.g., `has_complaint`, `is_product_active`)

2. **Optimized for Analytics**
   - Time-series indexes for date-based queries
   - Composite indexes for multi-column filters
   - Partial indexes for specific query patterns

3. **1:1 Relationships**
   - `reviews` ↔ `review_complaints` (UNIQUE constraint)
   - `users` ↔ `user_settings` (one per user)
   - `products` ↔ `product_rules` (one per product)

4. **Foreign Key Strategy**
   - `CASCADE` on delete for child records
   - `SET NULL` for optional references
   - Enforced referential integrity

---

## ENUM Types

### 1. `review_status_wb`
**Review visibility status on Wildberries platform (1:1 with WB statuses)**

```sql
CREATE TYPE review_status_wb AS ENUM (
  'visible',              -- Виден (подаем жалобы + чаты)
  'unpublished',          -- Снят с публикации (НЕ подаем жалобы, привязываем чаты)
  'excluded',             -- Исключён из рейтинга (НЕ подаем жалобы, привязываем чаты)
  'temporarily_hidden',   -- Временно скрыт (подаем жалобы, привязываем чаты, НЕ открываем новые)
  'deleted',              -- Не найден на WB (обнаружен при full sync, migration 015)
  'unknown'               -- Неизвестно (по умолчанию)
);
```

**WB mapping:** "Снят с публикации" → `unpublished`, "Временно скрыт" → `temporarily_hidden`, "Исключён из рейтинга" → `excluded`
**`deleted`** — НЕ от расширения, только full sync (review не найден в WB API)

**Task filtering:**
- Parse statuses: `NOT IN ('unpublished','excluded','deleted')`
- Open new chats: `IN ('visible','unknown')` only
- Link existing chats: `!= 'deleted'` (link for all non-deleted)
- Complaints: `IN ('visible','unknown','temporarily_hidden')`

---

### 2. `product_status_by_review`
**Product purchase/return status from review context (1:1 with WB statuses)**

```sql
CREATE TYPE product_status_by_review AS ENUM (
  'purchased',        -- Выкуп (товар выкуплен)
  'refused',          -- Отказ (отказ от товара)
  'returned',         -- Возврат (товар возвращён)
  'return_requested', -- Запрошен возврат
  'not_specified',    -- Не указано
  'unknown'           -- Неизвестно
);
```

**WB mapping:** "Выкуп" → `purchased`, "Отказ" → `refused`, "Возврат" → `returned`, "Запрошен возврат" → `return_requested`

---

### 3. `chat_status_by_review`
**Chat availability status from review**

```sql
CREATE TYPE chat_status_by_review AS ENUM (
  'unavailable',  -- Недоступен (WB не дает открыть чат)
  'available',    -- Доступен (можно открыть чат)
  'opened',       -- Чат открыт (необратимо, migration 017)
  'unknown'       -- Неизвестно
);
```

**Usage:** Indicates if we can initiate dialogue with reviewer
**`opened`** — irreversible status. Once chat is opened, status stays `opened` forever. SQL guard in `review-statuses/route.ts` prevents downgrade.

---

### 4. `complaint_status`
**Complaint lifecycle status**

```sql
CREATE TYPE complaint_status AS ENUM (
  'not_sent',         -- Без черновика (жалоба не создана)
  'draft',            -- Черновик (сгенерирована AI, но не отправлена)
  'sent',             -- Отправлена (вручную отмечено пользователем)
  'approved',         -- Одобрена (WB одобрил жалобу)
  'rejected',         -- Отклонена (WB отклонил жалобу)
  'pending',          -- На рассмотрении (WB рассматривает)
  'reconsidered',     -- Пересмотрена (WB пересмотрел)
  'not_applicable'    -- Нельзя подать (отзыв удалён, migration 015)
);
```

**Workflow:**
```
not_sent → draft (AI generates) → sent (user submits) → pending/approved/rejected (WB moderates)
```

**Rules:**
- Only `draft` complaints can be edited/regenerated
- `sent` status freezes the complaint (immutable)
- WB updates `pending`/`approved`/`rejected` via API sync

---

### 5. `work_status_enum`
**Product work status in complaint workflow**

```sql
CREATE TYPE work_status_enum AS ENUM (
  'not_working',  -- Не работаем с товаром
  'active',       -- Активно работаем (подаем жалобы)
  'paused',       -- Приостановлено
  'completed'     -- Завершено
);
```

**Usage:** Controls which products are processed by complaint automation

---

### 6. `chat_strategy_enum`
**Chat handling strategy for product**

```sql
CREATE TYPE chat_strategy_enum AS ENUM (
  'upgrade_to_5',  -- Повышаем оценку до 5
  'delete',        -- Удаляем отзыв
  'both'           -- Оба подхода
);
```

**Usage:** Defines product-specific chat escalation strategy

---

## Core Tables

### `users`

**Purpose:** Authentication and user management

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Fields:**
- `is_approved` - manual approval required for access

**Indexes:**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_approved ON users(is_approved);
```

**Relationships:**
- 1:N with `stores` (one user can own multiple stores)
- 1:1 with `user_settings`

---

### `stores`

**Purpose:** Marketplace seller accounts (WB and OZON кабинеты)

```sql
CREATE TABLE stores (
  id                         TEXT PRIMARY KEY,
  name                       TEXT NOT NULL,
  owner_id                   TEXT NOT NULL REFERENCES users(id),

  -- Marketplace discriminator (added in migration 012)
  marketplace                TEXT NOT NULL DEFAULT 'wb',  -- 'wb' | 'ozon'

  -- WB API Tokens (only for marketplace='wb')
  api_token                  TEXT NOT NULL,  -- Main API token
  content_api_token          TEXT NULL,
  feedbacks_api_token        TEXT NULL,
  chat_api_token             TEXT NULL,

  -- OZON API Credentials (only for marketplace='ozon', added in migration 012)
  ozon_client_id             TEXT NULL,      -- OZON Client-Id (numeric)
  ozon_api_key               TEXT NULL,      -- OZON Api-Key (UUID)
  ozon_subscription          TEXT NULL,      -- PREMIUM | PREMIUM_PLUS | PREMIUM_PRO

  -- Auto-reply settings
  is_auto_no_reply_enabled   BOOLEAN DEFAULT FALSE,

  -- Sync status tracking
  last_product_update_status  TEXT NULL,
  last_product_update_date    TIMESTAMPTZ NULL,
  last_product_update_error   TEXT NULL,

  last_review_update_status   TEXT NULL,
  last_review_update_date     TIMESTAMPTZ NULL,
  last_review_update_error    TEXT NULL,

  last_chat_update_status     TEXT NULL,
  last_chat_update_date       TIMESTAMPTZ NULL,
  last_chat_update_next       TEXT NULL,
  last_chat_update_error      TEXT NULL,

  last_question_update_status TEXT NULL,
  last_question_update_date   TIMESTAMPTZ NULL,
  last_question_update_error  TEXT NULL,

  -- Denormalized counts (for performance)
  total_reviews              INTEGER DEFAULT 0,
  total_chats                INTEGER DEFAULT 0,
  review_count_5star         INTEGER DEFAULT 0,  -- 5★ reviews counter (migration 040, replaces reviews_archive)
  chat_tag_counts            JSONB DEFAULT '{}'::jsonb,

  -- AI Personalization
  ai_instructions            TEXT NULL,  -- Store-specific AI instructions (tone, rules, restrictions)

  -- Status
  status                     VARCHAR(20) DEFAULT 'active',

  -- Organization
  org_id                     TEXT NULL REFERENCES organizations(id),

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stores_marketplace_check CHECK (marketplace IN ('wb', 'ozon')),
  CONSTRAINT chk_store_status CHECK (status IN ('active', 'paused', 'stopped', 'trial', 'archived'))  -- migration 028
);
```

**Key Fields:**
- `marketplace` - 'wb' or 'ozon' (discriminator for multi-marketplace support)
- `status` - 'active', 'paused', 'stopped', 'trial', 'archived' (controls visibility and sync)
- `ai_instructions` - Free-form text with AI instructions for this store (injected into system prompt)
- `ozon_client_id` / `ozon_api_key` - OZON API credentials (only for OZON stores)
- `total_reviews` - cached count (updated during sync)
- `last_*_update_*` - sync status tracking for monitoring

**Indexes:**
```sql
CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_name ON stores(name);
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_stores_marketplace ON stores(marketplace);
```

**Sync Status Values:**
- `null` - never synced
- `'pending'` - sync in progress
- `'success'` - last sync succeeded
- `'error'` - last sync failed (see `*_error` field)

---

### `products`

**Purpose:** Products from WB and OZON catalogs

```sql
CREATE TABLE products (
  id                       TEXT PRIMARY KEY,
  store_id                 TEXT NOT NULL REFERENCES stores(id),
  owner_id                 TEXT NOT NULL REFERENCES users(id),

  -- Marketplace discriminator (added in migration 012)
  marketplace              TEXT NOT NULL DEFAULT 'wb',  -- 'wb' | 'ozon'

  -- Common product data
  name                     TEXT NOT NULL,
  wb_product_id            TEXT NOT NULL,  -- WB: nmId; OZON: product_id as TEXT
  vendor_code              TEXT NOT NULL,  -- WB: vendorCode; OZON: offer_id
  price                    INTEGER NULL,
  image_url                TEXT NULL,
  description              TEXT NULL,       -- Product description (added in migration 012)

  -- OZON-specific identifiers (added in migration 012)
  ozon_product_id          BIGINT NULL,    -- OZON internal product_id
  ozon_offer_id            TEXT NULL,      -- OZON seller's article (offer_id)
  ozon_sku                 TEXT NULL,      -- Primary SKU (FBO, source="sds")
  ozon_fbs_sku             TEXT NULL,      -- FBS SKU (if available)

  -- Cached review count
  review_count             INTEGER DEFAULT 0,

  -- Work status
  is_active                BOOLEAN DEFAULT TRUE,
  work_status              work_status_enum DEFAULT 'not_working',

  -- Compensation settings
  compensation_method      TEXT NULL,

  -- Raw WB API response (for reference, WB only)
  wb_api_data              JSONB NULL,

  -- Last review sync for this product
  last_review_update_date  TIMESTAMPTZ NULL,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT products_marketplace_check CHECK (marketplace IN ('wb', 'ozon'))
);
```

**Key Fields:**
- `marketplace` - 'wb' or 'ozon' (matches parent store)
- `wb_product_id` - WB: nmId; OZON: product_id as string (universal linking field)
- `ozon_product_id` / `ozon_offer_id` / `ozon_sku` / `ozon_fbs_sku` - OZON triple-ID system
- `description` - HTML description (mainly for OZON products)
- `is_active` - manually controlled visibility
- `work_status` - complaint workflow participation

**Indexes:**
```sql
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_wb_id ON products(wb_product_id);
CREATE INDEX idx_products_store_wb_id ON products(store_id, wb_product_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_work_status ON products(work_status);
CREATE INDEX idx_products_store_active ON products(store_id, is_active, work_status);
CREATE UNIQUE INDEX idx_products_unique_wb_id ON products(store_id, wb_product_id);
CREATE INDEX idx_products_marketplace ON products(marketplace);
CREATE INDEX idx_products_ozon_product_id ON products(ozon_product_id);
CREATE INDEX idx_products_ozon_offer_id ON products(ozon_offer_id);
```

**Important:**
- `idx_products_unique_wb_id` prevents duplicate products per store
- `idx_products_store_active` optimizes "active products" queries
- OZON products have composite ID format: `{storeId}_ozon_{ozon_product_id}`

---

### `reviews` (Sprint-016 Consolidation)

**Purpose:** Customer reviews from WB Feedbacks API + Extension parsing

**Architecture (Sprint-013 split → Sprint-016 consolidation, 2026-04-03):**
- `reviews` — single table, ratings 1-4★ only, ~350K rows, ~517 MB
- `stores.review_count_5star` — INTEGER counter for 5★ reviews (no row storage)
- `reviews_archive` — **DROPPED** in migration 040 (was 3.25M rows, 2.6 GB)
- `reviews_all` — **DROPPED** in migration 040 (was UNION ALL view)

**Why:** 5★ reviews had zero business value as rows (no complaints, chats, or AI work). Storing only a counter saved ~3.4 GB.

**Write routing:** `rating === 5` → increment `stores.review_count_5star`, skip INSERT; else INSERT into `reviews`
**Read queries:** All queries use `reviews` directly. For 5★ count, use `stores.review_count_5star`
**Avg rating formula:** `(sum_14star + 5 * count_5star) / (count_14star + count_5star)`

**Constraints:**
```sql
ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating_1_4 CHECK (rating BETWEEN 1 AND 4);
```

**Schema:**

```sql
CREATE TABLE reviews (
  id                         TEXT PRIMARY KEY,
  product_id                 TEXT NOT NULL REFERENCES products(id),
  store_id                   TEXT NOT NULL REFERENCES stores(id),
  owner_id                   TEXT NOT NULL REFERENCES users(id),
  marketplace                TEXT NOT NULL DEFAULT 'wb',  -- 'wb' | 'ozon' (migration 013)

  -- Review content (from WB API / OZON API)
  rating                     INTEGER NOT NULL,
  text                       TEXT NOT NULL,
  pros                       TEXT NULL,
  cons                       TEXT NULL,
  author                     TEXT NOT NULL,
  date                       TIMESTAMPTZ NOT NULL,

  -- WB seller response
  answer                     JSONB NULL,

  -- Media attachments
  photo_links                JSONB NULL,
  video                      JSONB NULL,

  -- WB supplier ratings
  supplier_feedback_valuation INTEGER NULL,
  supplier_product_valuation  INTEGER NULL,

  -- Complaint denormalization (dual-write with review_complaints, used by DB trigger)
  complaint_text             TEXT NULL,
  complaint_sent_date        TIMESTAMPTZ NULL,

  -- Review reply draft (active workflow: AI generates → user edits → sends → cleared)
  draft_reply                TEXT NULL,

  -- Denormalized flags (for fast filtering)
  is_product_active          BOOLEAN DEFAULT TRUE,
  has_answer                 BOOLEAN DEFAULT FALSE,
  has_complaint              BOOLEAN DEFAULT FALSE,
  has_complaint_draft        BOOLEAN DEFAULT FALSE,

  -- Extension-parsed statuses (from Chrome extension)
  review_status_wb           review_status_wb DEFAULT 'unknown',
  product_status_by_review   product_status_by_review DEFAULT 'unknown',
  chat_status_by_review      chat_status_by_review DEFAULT 'unknown',
  complaint_status           complaint_status DEFAULT 'not_sent',

  -- Extension parsing metadata
  purchase_date              TIMESTAMPTZ NULL,
  parsed_at                  TIMESTAMPTZ NULL,  -- When extension parsed this review
  page_number                INTEGER NULL,      -- Page number in WB cabinet

  -- Deletion detection (added migration 015)
  deleted_from_wb_at         TIMESTAMPTZ NULL,  -- When review was detected as deleted from WB

  -- WB transparent rating (added migration 022)
  rating_excluded            BOOLEAN NOT NULL DEFAULT FALSE,  -- WB excluded review from product rating calculation

  -- OZON-specific fields (migration 013)
  ozon_review_status         TEXT NULL,          -- 'PROCESSED' | 'UNPROCESSED'
  ozon_order_status          TEXT NULL,          -- 'DELIVERED' | 'CANCELLED' etc.
  is_rating_participant      BOOLEAN NULL,       -- Whether review participates in seller rating
  likes_amount               INTEGER NULL,       -- OZON engagement metric
  dislikes_amount            INTEGER NULL,       -- OZON engagement metric
  ozon_sku                   TEXT NULL,          -- OZON SKU for product linking
  ozon_comment_id            TEXT NULL,          -- Seller's reply comment ID
  ozon_comments_amount       INTEGER NULL,       -- Total comments on review

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Fields:**
- **From WB API:** `id`, `rating`, `text`, `author`, `date`, `answer`
- **From OZON API:** `id` (prefixed `ozon_`), `rating`, `text`, `ozon_sku`, `ozon_review_status`
- **From Extension:** `review_status_wb`, `product_status_by_review`, `chat_status_by_review`, `parsed_at`, `page_number`
- **Denormalized:** `has_complaint`, `has_complaint_draft`, `is_product_active`

**Indexes:**
```sql
-- Primary filters
CREATE INDEX idx_reviews_store_date ON reviews(store_id, date DESC);
CREATE INDEX idx_reviews_store_rating ON reviews(store_id, rating, date DESC);
CREATE INDEX idx_reviews_product ON reviews(product_id, date DESC);

-- Complaint workflow
CREATE INDEX idx_reviews_complaint_status ON reviews(store_id, complaint_status, rating, date DESC)
  WHERE complaint_status = 'not_sent';

CREATE INDEX idx_reviews_complaint_workflow ON reviews(store_id, complaint_status, complaint_generated_at DESC)
  WHERE complaint_status IN ('draft', 'sent', 'pending');

CREATE INDEX idx_reviews_default_filter ON reviews(store_id, rating, is_product_active, complaint_status, date DESC)
  WHERE rating <= 3 AND is_product_active = TRUE AND complaint_status IN ('not_sent', 'draft');

-- Status filters
CREATE INDEX idx_reviews_wb_status ON reviews(store_id, review_status_wb, date DESC);
CREATE INDEX idx_reviews_product_status ON reviews(store_id, product_status_by_review, date DESC);

-- Deleted reviews detection (migration 015)
CREATE INDEX idx_reviews_deleted ON reviews(store_id, deleted_from_wb_at DESC)
  WHERE deleted_from_wb_at IS NOT NULL;

-- Answer tracking
CREATE INDEX idx_reviews_store_answer ON reviews(store_id, has_answer, date DESC);
CREATE INDEX idx_reviews_store_answer_date ON reviews(store_id, answer, date DESC) WHERE answer IS NOT NULL;

-- Marketplace (migration 013)
CREATE INDEX idx_reviews_marketplace ON reviews(marketplace);
CREATE INDEX idx_reviews_ozon_sku ON reviews(ozon_sku) WHERE ozon_sku IS NOT NULL;

-- Extension stores counters (2026-03-02)
CREATE INDEX idx_reviews_parse_pending ON reviews(product_id, store_id, rating, review_status_wb)
  WHERE marketplace = 'wb' AND rating_excluded = FALSE
    AND (chat_status_by_review IS NULL OR chat_status_by_review = 'unknown');
CREATE INDEX idx_reviews_chat_status_store ON reviews(store_id, chat_status_by_review)
  WHERE marketplace = 'wb' AND rating_excluded = FALSE;
```

**Triggers:**
```sql
CREATE TRIGGER update_reviews_complaint_flags
  BEFORE INSERT OR UPDATE OF complaint_status, complaint_text, complaint_sent_date
  ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_review_complaint_flags();
```

**Auto-update logic:**
- `has_complaint_draft = TRUE` when `complaint_status = 'draft'`
- `has_complaint = TRUE` when `complaint_status IN ('sent', 'approved', 'rejected', 'pending')`

**Key files for write routing (post migration 040):**
- `src/db/helpers.ts` — `upsertReview()`, `createReview()`, `getReviewById()` — single-table, 5★ → counter increment
- `src/db/helpers.ts` — `cleanupInactiveStoreData()` — cleanup operational data for inactive stores
- `src/db/extension-helpers.ts` — `upsertReviewsFromExtension()` — skips 5★, increments counter
- `src/db/complaint-helpers.ts` — complaint logic unchanged (1-3★ only)
- `src/lib/review-sync.ts` — deletion detection on `reviews` only

---

### `review_complaints`

**Purpose:** Dedicated table for AI-generated complaints (1:1 with reviews)

```sql
CREATE TABLE review_complaints (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  review_id               TEXT NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  store_id                TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id              TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Complaint content
  complaint_text          TEXT NOT NULL,
  reason_id               INTEGER NOT NULL,  -- WB category ID (11-20)
  reason_name             TEXT NOT NULL,     -- WB category name

  -- Complaint lifecycle
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'pending', 'reconsidered')),

  -- Draft stage
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  regenerated_count       INTEGER DEFAULT 0,
  last_regenerated_at     TIMESTAMPTZ NULL,

  -- Sent stage
  sent_at                 TIMESTAMPTZ NULL,
  sent_by_user_id         TEXT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- WB moderation result
  moderated_at            TIMESTAMPTZ NULL,
  wb_response             TEXT NULL,

  -- AI generation metadata (for cost tracking)
  ai_model                TEXT DEFAULT 'deepseek-chat',
  ai_prompt_tokens        INTEGER NULL,
  ai_completion_tokens    INTEGER NULL,
  ai_total_tokens         INTEGER NULL,
  ai_cost_usd             DECIMAL(10, 6) NULL,
  generation_duration_ms  INTEGER NULL,

  -- Review snapshot (for historical reference)
  review_rating           INTEGER NOT NULL,
  review_text             TEXT NOT NULL,
  review_date             TIMESTAMPTZ NOT NULL,

  -- Product snapshot (for analytics)
  product_name            TEXT NULL,
  product_vendor_code     TEXT NULL,
  product_is_active       BOOLEAN DEFAULT TRUE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Design Decisions:**

1. **1:1 Relationship**
   - `review_id` has UNIQUE constraint
   - One complaint per review (WB business rule)

2. **Immutability After Send**
   - Only `status = 'draft'` complaints can be edited
   - `sent_at IS NOT NULL` freezes the record

3. **Snapshot Pattern**
   - `review_*` fields snapshot review at generation time
   - `product_*` fields snapshot product metadata
   - Ensures historical accuracy even if source data changes

4. **Cost Tracking**
   - `ai_*` fields track token usage and costs
   - Enables ROI analysis per complaint

**Indexes:**
```sql
CREATE INDEX idx_complaints_review ON review_complaints(review_id);
CREATE INDEX idx_complaints_store_status ON review_complaints(store_id, status, created_at DESC);
CREATE INDEX idx_complaints_owner_status ON review_complaints(owner_id, status, created_at DESC);
CREATE INDEX idx_complaints_store_generated ON review_complaints(store_id, generated_at DESC);
CREATE INDEX idx_complaints_store_sent ON review_complaints(store_id, sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_complaints_status_moderated ON review_complaints(status, moderated_at DESC) WHERE moderated_at IS NOT NULL;
CREATE INDEX idx_complaints_reason ON review_complaints(reason_id, reason_name);
CREATE INDEX idx_complaints_product ON review_complaints(product_id, status);
CREATE INDEX idx_complaints_cost_date ON review_complaints(generated_at DESC, ai_cost_usd) WHERE ai_cost_usd IS NOT NULL;
-- Migration 013: Optimized index for extension stores API draft count query
CREATE INDEX idx_complaints_draft_store_product ON review_complaints(store_id, product_id) WHERE status = 'draft';
```

**CHECK Constraints:**
```sql
-- Migration 014: WB cutoff date — complaints only for reviews from 2023-10-01 onwards
ALTER TABLE review_complaints
ADD CONSTRAINT check_review_date_after_cutoff CHECK (review_date >= '2023-10-01');
```

**Partial Indexes:**
- `idx_complaints_store_sent` - only sent complaints
- `idx_complaints_status_moderated` - only moderated complaints
- `idx_complaints_cost_date` - only complaints with cost data
- `idx_complaints_draft_store_product` - draft complaints by store+product (extension API)

---

### `complaint_details`

**Purpose:** Source of truth for actually filed & WB-approved complaints. Mirrors Google Sheets "Жалобы V 2.0". Populated by Chrome Extension via `POST /api/extension/complaint-details`.

**Created by:** Migration 021

**Key difference from `review_complaints`:**
- `review_complaints` tracks what we **intend** to submit (AI draft → sent → moderated)
- `complaint_details` tracks what WB **actually approved** — with exact text, category, and screenshot proof

**Use cases:** AI training (real approved complaint texts), billing (R5-filed approved = billable), client reporting.

```sql
CREATE TABLE complaint_details (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Mirror of Google Sheets "Жалобы V 2.0" columns (A–M)
  check_date            DATE NOT NULL,                     -- A: Дата проверки
  cabinet_name          TEXT NOT NULL,                     -- B: Кабинет (WB store name)
  articul               TEXT NOT NULL,                     -- C: Артикул WB (nmId)
  review_ext_id         TEXT,                              -- D: ID отзыва (reserved)
  feedback_rating       INTEGER NOT NULL,                  -- E: Рейтинг (1-5)
  feedback_date         TEXT NOT NULL,                     -- F: Дата отзыва (WB original format string)
  complaint_submit_date TEXT,                              -- G: Дата подачи жалобы
  status                TEXT NOT NULL DEFAULT 'approved',  -- H: Статус
  has_screenshot        BOOLEAN NOT NULL DEFAULT TRUE,     -- I: Скриншот
  file_name             TEXT NOT NULL,                     -- J: Имя файла скриншота
  drive_link            TEXT,                              -- K: Google Drive ссылка
  complaint_category    TEXT NOT NULL,                     -- L: Категория жалобы
  complaint_text        TEXT NOT NULL,                     -- M: Полный текст жалобы

  -- Derived
  filed_by              TEXT,                              -- 'r5' | 'seller'

  -- Optional links to internal entities
  review_id             TEXT REFERENCES reviews(id) ON DELETE SET NULL,
  review_complaint_id   TEXT REFERENCES review_complaints(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(store_id, articul, feedback_date, file_name)
);
```

**Key Fields:**
- `feedback_date` — WB locale format string (e.g. "18 февр. 2026 г. в 21:45"), stored as-is
- `filed_by` — derived from `complaint_text` prefix: starts with "Жалоба от:" → `'r5'`, otherwise `'seller'`
- `review_id` / `review_complaint_id` — nullable, for future async matching to internal data

**Indexes:**
```sql
CREATE INDEX idx_cd_store ON complaint_details(store_id);
CREATE INDEX idx_cd_store_date ON complaint_details(store_id, check_date DESC);
CREATE INDEX idx_cd_articul ON complaint_details(store_id, articul);
CREATE INDEX idx_cd_category ON complaint_details(complaint_category);
CREATE INDEX idx_cd_filed_by ON complaint_details(filed_by) WHERE filed_by IS NOT NULL;
CREATE INDEX idx_cd_review ON complaint_details(review_id) WHERE review_id IS NOT NULL;
```

**Dedup:** `UNIQUE(store_id, articul, feedback_date, file_name)` — same store + product + review + screenshot = same record.

---

### `complaint_backfill_jobs`

**Purpose:** Queue for bulk complaint generation when products are activated. Manages daily limits and progress tracking.

**Created by:** Migration `20260208_001_complaint_backfill_system.sql`

```sql
CREATE TABLE complaint_backfill_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          TEXT NOT NULL,
  store_id            TEXT NOT NULL,
  owner_id            TEXT NOT NULL,

  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'paused', 'failed')),
  priority            INTEGER NOT NULL DEFAULT 0,

  -- Progress
  total_reviews       INTEGER NOT NULL DEFAULT 0,
  processed           INTEGER NOT NULL DEFAULT 0,
  failed              INTEGER NOT NULL DEFAULT 0,
  skipped             INTEGER NOT NULL DEFAULT 0,

  -- Daily limit tracking
  daily_generated     INTEGER NOT NULL DEFAULT 0,
  daily_limit_date    DATE,

  -- Error handling
  last_error          TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  max_retries         INTEGER NOT NULL DEFAULT 3,

  triggered_by        TEXT,  -- 'product_activation', 'store_activation', 'manual', 'rules_change'
  metadata            JSONB DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  last_processed_at   TIMESTAMPTZ
);
```

**Indexes:**
```sql
CREATE INDEX idx_backfill_status ON complaint_backfill_jobs(status);
CREATE INDEX idx_backfill_store ON complaint_backfill_jobs(store_id);
CREATE INDEX idx_backfill_product ON complaint_backfill_jobs(product_id);
CREATE INDEX idx_backfill_priority_created ON complaint_backfill_jobs(priority DESC, created_at ASC)
  WHERE status IN ('pending', 'in_progress');
CREATE UNIQUE INDEX idx_backfill_product_active ON complaint_backfill_jobs(product_id)
  WHERE status IN ('pending', 'in_progress', 'paused');
```

**Key constraint:** `idx_backfill_product_active` ensures only one active job per product.

**View:** `v_backfill_status` — monitoring view with progress % and daily limit info.

---

### `complaint_daily_limits`

**Purpose:** Track daily complaint generation limits per store (default: 2000/day).

**Created by:** Migration `20260208_001_complaint_backfill_system.sql`

```sql
CREATE TABLE complaint_daily_limits (
  store_id    TEXT NOT NULL,
  date        DATE NOT NULL,
  generated   INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL DEFAULT 2000,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (store_id, date)
);
```

**Helper functions:**
- `get_remaining_daily_limit(store_id, date)` — returns remaining quota
- `increment_daily_limit(store_id, count, date)` — UPSERT increment

---

## Communication Tables

### `chats`

**Purpose:** Customer support dialogues from WB Chat API

```sql
CREATE TABLE chats (
  id                        TEXT PRIMARY KEY,
  store_id                  TEXT NOT NULL REFERENCES stores(id),
  owner_id                  TEXT NOT NULL REFERENCES users(id),
  marketplace               TEXT NOT NULL DEFAULT 'wb',  -- 'wb' | 'ozon' (migration 013)

  -- Chat metadata
  client_name               TEXT NOT NULL,
  reply_sign                TEXT NOT NULL,

  -- Product context
  product_nm_id             TEXT NULL,
  product_name              TEXT NULL,
  product_vendor_code       TEXT NULL,

  -- Last message preview
  last_message_date         TIMESTAMPTZ NULL,
  last_message_text         TEXT NULL,
  last_message_sender       TEXT NULL,

  -- Chat classification (deletion workflow stage, migration 024: simplified to 4 tags + NULL)
  tag                       TEXT NULL,  -- NULL = new/unprocessed
  tag_update_date           TIMESTAMPTZ NULL,

  -- Kanban board status (user-managed, migration 008: 4 statuses)
  status                    TEXT NOT NULL DEFAULT 'inbox',
  status_updated_at         TIMESTAMPTZ DEFAULT NOW(),
  completion_reason         TEXT NULL,  -- required when status='closed'

  CONSTRAINT chats_tag_check CHECK (tag IS NULL OR tag IN ('deletion_candidate', 'deletion_offered', 'deletion_agreed', 'deletion_confirmed')),
  CONSTRAINT chats_status_check CHECK (status IN ('inbox', 'in_progress', 'awaiting_reply', 'closed')),
  CONSTRAINT chk_completion_reason CHECK (completion_reason IS NULL OR completion_reason IN ('review_deleted', 'review_upgraded', 'review_resolved', 'temporarily_hidden', 'refusal', 'no_reply', 'old_dialog', 'not_our_issue', 'spam', 'negative', 'other')),

  -- AI draft reply
  draft_reply               TEXT NULL,
  draft_reply_thread_id     TEXT NULL,

  -- OZON-specific fields (migration 013)
  ozon_chat_type            TEXT NULL,          -- 'BUYER_SELLER' | 'SELLER_SUPPORT' | 'UNSPECIFIED'
  ozon_chat_status          TEXT NULL,          -- 'OPENED' | 'CLOSED'
  ozon_unread_count         INTEGER NULL,       -- Unread messages count
  ozon_last_message_id      TEXT NULL,          -- For incremental history fetch

  -- Audit trail (migration 027)
  status_changed_by         TEXT NULL,          -- userId of last status/tag change (NULL = system/cron)
  closure_type              VARCHAR(20) NULL,   -- 'manual' (userId present) | 'auto' (system action) | NULL (not closed)

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_closure_type CHECK (closure_type IS NULL OR closure_type IN ('manual', 'auto'))
);
```

**Key Fields:**
- `marketplace` - 'wb' | 'ozon' (migration 013)
- `tag` - Deletion workflow stage (4 тега + NULL): `deletion_candidate` (auto on link creation), `deletion_offered`, `deletion_agreed`, `deletion_confirmed` (manual from TG), NULL = new/unprocessed. AI classification removed (migration 024). CHECK constraint enforces valid values.
- `status` - Kanban position (4 статуса): `awaiting_reply` (default for new chats + mailing), `inbox` (buyer replied), `in_progress` (seller replied), `closed`. CHECK constraint enforces valid values (resolved removed in migration 008).
- `status_updated_at` - tracks when status was last changed (migration 003)
- `completion_reason` - причина закрытия (11 values): `review_deleted`, `review_upgraded`, `review_resolved`, `temporarily_hidden`, `refusal`, `no_reply`, `old_dialog`, `not_our_issue`, `spam`, `negative`, `other`. CHECK constraint enforces valid values.

**Indexes:**
```sql
CREATE INDEX idx_chats_store ON chats(store_id);
CREATE INDEX idx_chats_store_tag ON chats(store_id, tag);
CREATE INDEX idx_chats_store_tag_date ON chats(store_id, tag, last_message_date DESC);
CREATE INDEX idx_chats_last_message ON chats(last_message_date DESC);
CREATE INDEX idx_chats_product ON chats(product_nm_id) WHERE product_nm_id IS NOT NULL;
CREATE INDEX idx_chats_marketplace ON chats(marketplace);  -- migration 013

-- Kanban board (migration 003)
CREATE INDEX idx_chats_status ON chats(store_id, status, updated_at DESC);
CREATE INDEX idx_chats_kanban ON chats(store_id, status, status_updated_at DESC, updated_at DESC);
```

---

### `chat_status_history`

**Purpose:** Immutable audit log for every status/tag change on chats. Tracks who changed what, when, and from which source.

**Created by:** Migration 027

```sql
CREATE TABLE chat_status_history (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id           TEXT NOT NULL,
  store_id          TEXT NOT NULL,
  old_status        TEXT,
  new_status        TEXT NOT NULL,
  old_tag           TEXT,
  new_tag           TEXT,
  completion_reason TEXT,
  closure_type      VARCHAR(20),        -- 'manual' | 'auto'
  changed_by        TEXT,               -- userId (NULL = system/cron)
  change_source     VARCHAR(30) NOT NULL,  -- origin of the change
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`change_source` values:**
| Value | Description |
|-------|-------------|
| `tg_app` | Status/tag changed from Telegram Mini App |
| `web_app` | Status/tag changed from web dashboard |
| `cron_resolved` | Auto-closed by resolved-review-closer cron |
| `cron_sequence` | Status changed by auto-sequence-processor cron |
| `sync_dialogue` | Status changed during dialogue sync |
| `extension` | Status changed from Chrome Extension |
| `bulk_action` | Bulk status change from web dashboard |

**Key Design Decisions:**
1. **Immutable** -- rows are never updated or deleted; insert-only log
2. **No FK on `chat_id`** -- deliberate; avoids CASCADE issues, history survives chat deletion
3. **`changed_by`** -- nullable; NULL means system/cron action, non-NULL means user action
4. **`closure_type`** -- `'manual'` when `changed_by` is present, `'auto'` when system closes

**Indexes:**
```sql
CREATE INDEX idx_csh_chat ON chat_status_history(chat_id, created_at DESC);
CREATE INDEX idx_csh_store ON chat_status_history(store_id, created_at DESC);
CREATE INDEX idx_csh_changed_by ON chat_status_history(changed_by) WHERE changed_by IS NOT NULL;
```

**Helper function:** `updateChatWithAudit()` in `src/db/helpers.ts` -- wraps `updateChat()` with automatic history insertion. Used by 10 call sites across the codebase.

---

### `chat_messages`

**Purpose:** Individual messages within chats

```sql
CREATE TABLE chat_messages (
  id             TEXT PRIMARY KEY,
  chat_id        TEXT NOT NULL REFERENCES chats(id),
  store_id       TEXT NOT NULL REFERENCES stores(id),
  owner_id       TEXT NOT NULL REFERENCES users(id),
  marketplace    TEXT NOT NULL DEFAULT 'wb',  -- 'wb' | 'ozon' (migration 013)

  text           TEXT NULL,
  sender         TEXT NOT NULL,           -- 'client' or 'seller'
  timestamp      TIMESTAMPTZ NOT NULL,
  download_id    TEXT NULL,
  is_auto_reply  BOOLEAN NOT NULL DEFAULT FALSE,  -- true = sent by auto-sequence bot (migration 007)

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id, timestamp DESC);
CREATE INDEX idx_chat_messages_store ON chat_messages(store_id, timestamp DESC);
CREATE INDEX idx_chat_messages_auto ON chat_messages(chat_id, is_auto_reply) WHERE is_auto_reply = TRUE;
CREATE INDEX idx_chat_messages_marketplace ON chat_messages(marketplace);  -- migration 013
```

---

### `questions`

**Purpose:** Product questions from WB Questions API

```sql
CREATE TABLE questions (
  id                      TEXT PRIMARY KEY,
  store_id                TEXT NOT NULL REFERENCES stores(id),
  owner_id                TEXT NOT NULL REFERENCES users(id),

  marketplace             TEXT NOT NULL DEFAULT 'wb',  -- 'wb' | 'ozon' (migration 028)

  text                    TEXT NOT NULL,
  created_date            TIMESTAMPTZ NOT NULL,
  state                   TEXT NOT NULL,
  was_viewed              BOOLEAN DEFAULT FALSE,
  is_answered             BOOLEAN DEFAULT FALSE,

  answer                  JSONB NULL,

  -- Product context
  product_nm_id           TEXT NOT NULL,  -- Was INTEGER, changed to TEXT in migration 028 for consistency with products.wb_product_id
  product_name            TEXT NOT NULL,
  product_supplier_article TEXT NULL,
  product_brand_name      TEXT NULL,

  -- AI draft answer
  draft_reply_thread_id   TEXT NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_questions_store ON questions(store_id);
CREATE INDEX idx_questions_store_answered ON questions(store_id, is_answered);
CREATE INDEX idx_questions_product ON questions(product_nm_id);
CREATE INDEX idx_questions_created ON questions(created_date DESC);
```

---

### `review_chat_links`

**Purpose:** Store review↔chat associations created by Chrome Extension (Sprint 002). The extension opens chats from the WB reviews page and reports the link back to backend, enabling full review lifecycle tracking.

**Created by:** Migration 016

```sql
CREATE TABLE review_chat_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Review side (from extension)
  review_id TEXT REFERENCES reviews(id) ON DELETE SET NULL,  -- matched asynchronously
  review_key TEXT NOT NULL,              -- "{nmId}_{rating}_{dateTruncMin}" from extension
  review_nm_id TEXT NOT NULL,            -- WB product nmID
  review_rating INTEGER NOT NULL,        -- Review rating (1-5)
  review_date TIMESTAMPTZ NOT NULL,      -- Review date (for fuzzy matching)

  -- Chat side (from extension + dialogue sync reconciliation)
  chat_id TEXT REFERENCES chats(id) ON DELETE SET NULL,  -- populated by reconciliation
  chat_url TEXT NOT NULL,                -- Full WB chat URL
  system_message_text TEXT,              -- WB system message ("Чат с покупателем по товару...")
  parsed_nm_id TEXT,                     -- nmID extracted from system message
  parsed_product_title TEXT,             -- Product title from system message

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'chat_opened',
    -- chat_opened → anchor_found → message_sent → completed
    -- chat_opened → anchor_not_found
    -- * → error
  message_type TEXT,                     -- 'A' (1-3⭐) / 'B' (4⭐)
  message_text TEXT,                     -- Sent message text
  message_sent_at TIMESTAMPTZ,

  -- Error tracking
  error_code TEXT,                       -- ERROR_TAB_TIMEOUT, ERROR_ANCHOR_NOT_FOUND, etc.
  error_message TEXT,
  error_stage TEXT,                      -- chat_open / anchor_parsing / message_send

  -- Timestamps
  opened_at TIMESTAMPTZ NOT NULL,
  anchor_found_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(store_id, review_key)
);
```

**Key design decisions:**
- `review_id` nullable — matched asynchronously via fuzzy date/rating query
- `chat_id` nullable — populated by dialogue sync reconciliation (Step 3.5)
- `UNIQUE(store_id, review_key)` — one review = one chat link per store
- `UNIQUE(chat_id, store_id) WHERE chat_id IS NOT NULL` — one chat = one review (migration 026). Enforces 1:1 invariant.
- Both FKs use `ON DELETE SET NULL` — link survives if review/chat is deleted

**Indexes:**
```sql
idx_rcl_store(store_id)
idx_rcl_review(review_id) WHERE review_id IS NOT NULL
idx_rcl_chat(chat_id) WHERE chat_id IS NOT NULL
idx_rcl_status(store_id, status)
idx_rcl_chat_url(chat_url)
idx_rcl_review_key(store_id, review_key)
idx_rcl_matching(store_id, review_nm_id, review_rating, review_date)  -- NOT EXISTS dedup (2026-03-02)
idx_rcl_unique_chat(chat_id, store_id) WHERE chat_id IS NOT NULL  -- 1 chat = 1 review (migration 026)
```

---

### `chat_auto_sequences`

**Purpose:** Track automated follow-up message sequences for review-linked chats. 30-day system: 15 msgs/2 days for 1-3★ (`no_reply_followup_30d`), 10 msgs/3 days for 4★ (`no_reply_followup_4star_30d`). Legacy 14-day types still exist in DB.

```sql
CREATE TABLE chat_auto_sequences (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id                 TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  store_id                TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,  -- FK added in migration 028
  owner_id                TEXT NOT NULL,

  -- Sequence configuration
  sequence_type           VARCHAR(50) NOT NULL DEFAULT 'no_reply_followup',
  messages                JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{day: 1, text: "..."}, ...]
  current_step            INT NOT NULL DEFAULT 0,
  max_steps               INT NOT NULL DEFAULT 14,

  -- State machine: active → stopped/completed
  status                  VARCHAR(20) NOT NULL DEFAULT 'active',
  stop_reason             VARCHAR(50),  -- client_replied | stop_message | max_reached | manual

  -- Timestamps
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at            TIMESTAMPTZ,
  next_send_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auto_sequences_pending ON chat_auto_sequences(next_send_at) WHERE status = 'active';
CREATE INDEX idx_auto_sequences_chat ON chat_auto_sequences(chat_id, status);

-- Database Protection (Migration 999, 2026-03-13): Prevent duplicate active sequences
CREATE UNIQUE INDEX idx_unique_active_sequence_per_chat ON chat_auto_sequences(chat_id)
  WHERE status = 'active';
```

**Key helpers:** `createAutoSequence`, `getPendingSequences`, `advanceSequence`, `stopSequence`, `completeSequence`, `start_auto_sequence_safe()` (migration 999)

**Database Protection (Emergency Migration 999):**
- **UNIQUE INDEX:** `idx_unique_active_sequence_per_chat` - Prevents multiple active sequences for same chat at database level
- **Helper function:** `start_auto_sequence_safe(chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)` - Automatically stops existing active sequence before creating new one
- **Monitoring view:** `v_duplicate_sequences` - Shows chats with multiple active sequences (should always return 0 rows)

**Created:** 2026-03-13 during emergency deployment to fix duplicate auto-sequence sends

**Verification:**
```sql
-- Should return 0 rows (no duplicates)
SELECT * FROM v_duplicate_sequences;

-- Check index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'chat_auto_sequences'
  AND indexname = 'idx_unique_active_sequence_per_chat';
```

---

### `store_faq`

**Purpose:** Per-store FAQ entries for AI context injection. Questions and answers that AI uses when responding to customers.

```sql
CREATE TABLE store_faq (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,  -- FK added in migration 028
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `store_id` — магазин-владелец (FK → stores(id) ON DELETE CASCADE, migration 028)
- `question` / `answer` — пара вопрос-ответ
- `is_active` — вкл/выкл отдельных записей без удаления
- `sort_order` — порядок отображения

**Indexes:**
```sql
CREATE INDEX idx_store_faq_store_id ON store_faq(store_id);
```

**CRUD helpers:** `getStoreFaq`, `createStoreFaq`, `updateStoreFaq`, `deleteStoreFaq` в `src/db/helpers.ts`

**UI:** Вкладка AI → секция "FAQ База знаний" (CRUD + шаблоны из `src/lib/faq-templates.ts`)

**AI injection:** Активные FAQ форматируются как `В: ...\nО: ...` и инжектируются в system prompt через `buildStoreInstructions()` в `src/lib/ai-context.ts`

---

### `store_guides`

**Purpose:** Per-store step-by-step instructions for customers. AI uses these guides when advising customers on processes (review deletion, returns, compensation).

```sql
CREATE TABLE store_guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,  -- FK added in migration 028
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `store_id` — магазин-владелец
- `title` — название инструкции (напр. "Как удалить отзыв через браузер")
- `content` — пошаговый текст инструкции (multiline, pre-line)
- `is_active` — вкл/выкл без удаления

**Indexes:**
```sql
CREATE INDEX idx_store_guides_store_id ON store_guides(store_id);
```

**CRUD helpers:** `getStoreGuides`, `createStoreGuide`, `updateStoreGuide`, `deleteStoreGuide` в `src/db/helpers.ts`

**UI:** Вкладка AI → секция "Инструкции для клиентов" (CRUD + 7 шаблонов из `src/lib/guide-templates.ts`)

**AI injection:** Активные гайды форматируются как `### Title\nContent` и инжектируются в system prompt через `buildStoreInstructions()` в `src/lib/ai-context.ts`

---

### `manager_tasks`

**Purpose:** Centralized task tracking for managers across multiple stores. Entity-polymorphic (review/chat/question).

**Created by:** Migration 002

```sql
CREATE TABLE manager_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id     TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  entity_type  TEXT NOT NULL CHECK (entity_type IN ('review', 'chat', 'question')),
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('generate_complaint', 'submit_complaint', 'check_complaint', 'reply_to_chat', 'reply_to_question')),

  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority     TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  due_date     TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  title        TEXT NOT NULL,
  description  TEXT,
  notes        TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_manager_tasks_user_id ON manager_tasks(user_id);
CREATE INDEX idx_manager_tasks_store_id ON manager_tasks(store_id);
CREATE INDEX idx_manager_tasks_status ON manager_tasks(status);
CREATE INDEX idx_manager_tasks_entity ON manager_tasks(entity_type, entity_id);
CREATE INDEX idx_manager_tasks_user_status ON manager_tasks(user_id, status);
```

**Trigger:** `trg_validate_manager_task_entity` — validates entity exists before insert/update.

---

## Configuration Tables

### `user_settings`

**Purpose:** User-specific AI prompts and API keys

```sql
CREATE TABLE user_settings (
  id                        TEXT PRIMARY KEY REFERENCES users(id),

  -- API keys
  deepseek_api_key          TEXT NULL,
  openai_api_key            TEXT NULL,
  api_key                   TEXT NULL,  -- Main system API key

  -- AI configuration
  ai_concurrency            INTEGER DEFAULT 5,

  -- Custom prompts (system prompts for Deepseek AI)
  prompt_chat_reply         TEXT NULL,  -- генерация ответов в чатах
  prompt_chat_tag           TEXT NULL,  -- классификация тегов чатов (DEPRECATED: migration 024, flow отключён)
  prompt_chat_deletion_tag  TEXT NULL,  -- deletion-классификация (DEPRECATED: migration 024, flow отключён)
  prompt_deletion_offer     TEXT NULL,  -- генерация deletion offer (fallback: prompt_chat_reply)
  prompt_question_reply     TEXT NULL,  -- ответы на вопросы
  prompt_review_complaint   TEXT NULL,  -- генерация жалоб
  prompt_review_reply       TEXT NULL,  -- ответы на отзывы

  -- Auto-reply stop messages (active: used by cron auto-sequence processor)
  no_reply_trigger_phrase   TEXT NULL,      -- trigger phrase for legacy backfill scripts
  no_reply_stop_message     TEXT NULL,      -- 1-3★ sequence completion message
  no_reply_stop_message2    TEXT NULL,      -- 4★ sequence completion message

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_user_settings_api_key ON user_settings(api_key);
```

---

### `product_rules`

**Purpose:** Product-specific complaint and chat rules

```sql
CREATE TABLE product_rules (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id            TEXT NOT NULL UNIQUE REFERENCES products(id),
  store_id              TEXT NOT NULL REFERENCES stores(id),

  -- Complaint rules
  submit_complaints     BOOLEAN DEFAULT FALSE,
  complaint_rating_1    BOOLEAN DEFAULT FALSE,
  complaint_rating_2    BOOLEAN DEFAULT FALSE,
  complaint_rating_3    BOOLEAN DEFAULT FALSE,
  complaint_rating_4    BOOLEAN DEFAULT FALSE,

  -- Chat rules
  work_in_chats         BOOLEAN DEFAULT FALSE,
  chat_rating_1         BOOLEAN DEFAULT FALSE,
  chat_rating_2         BOOLEAN DEFAULT FALSE,
  chat_rating_3         BOOLEAN DEFAULT FALSE,
  chat_rating_4         BOOLEAN DEFAULT FALSE,
  chat_strategy         chat_strategy_enum DEFAULT 'both',

  -- Compensation rules
  offer_compensation    BOOLEAN DEFAULT FALSE,
  compensation_type     TEXT NULL,
  max_compensation      TEXT NULL,
  compensation_by       TEXT NULL,

  -- Per-product cutoff date and manager comment (migration 025)
  work_from_date        DATE DEFAULT '2023-10-01',   -- Reviews before this date are not processed
  comment               TEXT DEFAULT NULL,            -- Manager comment (displayed in Google Sheets)

  created_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
```

**Key Fields (migration 025):**
- `work_from_date` — Per-product cutoff date. Reviews before this date are excluded from complaint generation and chat processing. Default `'2023-10-01'` matches the global WB cutoff. Used via `COALESCE(pr.work_from_date, '2023-10-01')` in SQL queries.
- `comment` — Free-text manager comment. No backend logic impact — displayed only in Google Sheets sync (columns U-V).

**Indexes:**
```sql
CREATE INDEX idx_product_rules_product ON product_rules(product_id);
CREATE INDEX idx_product_rules_store ON product_rules(store_id);
CREATE INDEX idx_product_rules_submit_complaints ON product_rules(submit_complaints);
CREATE INDEX idx_product_rules_work_in_chats ON product_rules(work_in_chats);
CREATE INDEX idx_product_rules_offer_compensation ON product_rules(offer_compensation);
CREATE INDEX idx_product_rules_chat_strategy ON product_rules(chat_strategy);
```

---

## Analytics Tables

### `ai_logs`

**Purpose:** Track all AI API calls for cost analysis and debugging

```sql
CREATE TABLE ai_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    TEXT NOT NULL REFERENCES stores(id),
  owner_id    TEXT NOT NULL REFERENCES users(id),

  entity_type TEXT NOT NULL,  -- 'review', 'chat', 'question', 'complaint'
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,  -- 'generate_reply', 'generate_complaint', 'classify_chat'

  prompt      TEXT NULL,
  response    TEXT NULL,

  model       TEXT DEFAULT 'deepseek-chat',
  tokens_used INTEGER NULL,
  cost        DECIMAL(10, 6) NULL,

  error       TEXT NULL,
  metadata    JSONB NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_ai_logs_store ON ai_logs(store_id);
CREATE INDEX idx_ai_logs_owner ON ai_logs(owner_id);
CREATE INDEX idx_ai_logs_entity ON ai_logs(entity_type, entity_id);
CREATE INDEX idx_ai_logs_action ON ai_logs(action);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at DESC);
CREATE INDEX idx_ai_logs_error ON ai_logs(error) WHERE error IS NOT NULL;
CREATE INDEX idx_ai_logs_store_date ON ai_logs(store_id, created_at DESC);
CREATE INDEX idx_ai_logs_store_error ON ai_logs(store_id, error) WHERE error IS NOT NULL;
```

---

### `review_statuses_from_extension`

**Purpose:** Stores review statuses parsed by Chrome Extension from WB seller cabinet. Used to filter reviews before complaint generation (saves ~80% AI tokens). Separate from `reviews` table because extension uses composite key matching, not internal review IDs.

**Created by:** Migration `20260201_001_review_statuses_from_extension.sql`

```sql
CREATE TABLE review_statuses_from_extension (
  id              SERIAL PRIMARY KEY,
  review_key      VARCHAR(100) NOT NULL,     -- Format: {productId}_{rating}_{datetime without seconds}
  store_id        TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id      VARCHAR(50) NOT NULL,      -- WB product nmId
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_date     TIMESTAMPTZ NOT NULL,

  statuses             JSONB NOT NULL DEFAULT '[]',  -- ["Жалоба отклонена", "Выкуп", ...]
  can_submit_complaint BOOLEAN NOT NULL DEFAULT true,

  parsed_at       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(review_key, store_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_ext_statuses_store_can_submit ON review_statuses_from_extension(store_id, can_submit_complaint);
CREATE INDEX idx_ext_statuses_product_rating_date ON review_statuses_from_extension(store_id, product_id, rating, review_date);
CREATE INDEX idx_ext_statuses_parsed_at ON review_statuses_from_extension(parsed_at DESC);
```

**Key Fields:**
- `review_key` — composite key for matching: `{productId}_{rating}_{datetime}` (e.g., `649502497_1_2026-01-07T20:09`)
- `statuses` — JSONB array of Russian status strings from WB UI (e.g., "Жалоба отклонена", "Выкуп")
- `can_submit_complaint` — calculated by extension: true if no complaint-related status present

---

## Telegram Integration Tables

### `telegram_users`

**Purpose:** Link Telegram accounts to R5 users for Mini App auth and push notifications (1:1)

```sql
CREATE TABLE telegram_users (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_id              BIGINT NOT NULL,        -- TG user ID
  telegram_username        TEXT,                    -- @username (optional)
  chat_id                  BIGINT NOT NULL,         -- TG chat ID for sending messages
  is_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  linked_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_telegram_users_user ON telegram_users(user_id);   -- 1:1 with users
CREATE UNIQUE INDEX idx_telegram_users_tg ON telegram_users(telegram_id); -- unique TG account
```

**Key constraints:**
- One TG account per R5 user (UNIQUE on both `user_id` and `telegram_id`)
- Cascade delete: removing user removes TG link

### `telegram_notifications_log`

**Purpose:** Track sent TG notifications for deduplication and debugging

```sql
CREATE TABLE telegram_notifications_log (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  telegram_user_id  TEXT NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
  chat_id           TEXT NOT NULL,       -- R5 chat ID (not TG chat)
  store_id          TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'client_reply',
  message_text      TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tg_message_id     INTEGER              -- TG API message ID
);
```

**Indexes:**
```sql
CREATE INDEX idx_tg_notif_user ON telegram_notifications_log(telegram_user_id, sent_at DESC);
CREATE INDEX idx_tg_notif_chat ON telegram_notifications_log(chat_id, sent_at DESC);
```

**Dedup logic:** Before sending, check if notification for same `chat_id` was sent within last hour.

---

## Entity Relationships

```
users (1) ───── (N) stores
  │                  │
  │                  ├─── (N) products
  │                  │        │
  │                  │        ├─── (1) product_rules (1:1)
  │                  │        └─── (N) reviews
  │                  │                  │
  │                  │                  ├─── (1) review_complaints (1:1)
  │                  │                  └─── (N) complaint_details (approved complaints, source of truth)
  │                  │
  │                  ├─── (N) complaint_details (via store_id)
  │                  ├─── (N) complaint_backfill_jobs (via store_id)
  │                  ├─── (N) complaint_daily_limits (via store_id)
  │                  │
  │                  ├─── (N) chats
  │                  │        ├─── (N) chat_messages
  │                  │        ├─── (N) chat_status_history (audit log, no FK)
  │                  │        ├─── (N) chat_auto_sequences
  │                  │        └───┐
  │                  │            │ review_chat_links (N:1 chats, N:1 reviews)
  │                  │            │ Links review ↔ chat via Chrome Extension
  │                  │            │
  │                  │
  │                  ├─── (N) store_faq
  │                  ├─── (N) store_guides
  │                  ├─── (N) manager_tasks
  │                  ├─── (N) review_statuses_from_extension
  │                  │
  │                  └─── (N) questions
  │
  ├─── (1) user_settings (1:1)
  │
  └─── (1) telegram_users (1:1)
              │
              └─── (N) telegram_notifications_log
```

**Key Relationships:**

1. **users → stores** (1:N)
   - One user owns multiple WB stores
   - Cascade delete: deleting user removes all stores

2. **stores → products** (1:N)
   - One store has multiple products
   - Cascade delete: deleting store removes all products

3. **products → reviews** (1:N)
   - One product has multiple reviews
   - Cascade delete: deleting product removes reviews

4. **reviews → review_complaints** (1:1)
   - UNIQUE constraint on `review_id`
   - One complaint per review (WB business rule)
   - Cascade delete: deleting review removes complaint

5. **products → product_rules** (1:1)
   - UNIQUE constraint on `product_id`
   - Configuration per product

6. **reviews ↔ chats via review_chat_links** (N:1 each)
   - Created by Chrome Extension when opening chat from reviews page
   - `review_id` nullable (fuzzy matched by nmId + rating + date)
   - `chat_id` nullable (populated by dialogue sync reconciliation)
   - UNIQUE(store_id, review_key) — one link per review

---

## Indexes Strategy

### 1. Store-Based Filtering
Most queries filter by `store_id` first:
```sql
SELECT * FROM reviews WHERE store_id = $1 ...
SELECT * FROM chats WHERE store_id = $1 ...
```

**Strategy:** Composite indexes with `store_id` as first column

### 2. Date-Based Sorting
Pagination and recency queries sort by date:
```sql
ORDER BY date DESC
ORDER BY created_at DESC
```

**Strategy:** Include date as last column in composite indexes

### 3. Partial Indexes
For specific query patterns with WHERE clauses:
```sql
CREATE INDEX idx_name ON table(column) WHERE condition;
```

**Examples:**
- `WHERE complaint_status = 'not_sent'`
- `WHERE sent_at IS NOT NULL`
- `WHERE error IS NOT NULL`

### 4. Covering Indexes
For queries that only need indexed columns:
```sql
CREATE INDEX idx_name ON table(col1, col2, col3);
SELECT col1, col2, col3 FROM table WHERE col1 = $1; -- Index-only scan
```

---

## Triggers & Functions

### 1. Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to all tables with updated_at column
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2. Auto-update complaint denormalized fields

```sql
CREATE OR REPLACE FUNCTION update_review_complaint_flags()
RETURNS TRIGGER AS $$
BEGIN
  NEW.has_complaint_draft = (NEW.complaint_status = 'draft');
  NEW.has_complaint = (NEW.complaint_status IN ('sent', 'approved', 'rejected', 'pending'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reviews_complaint_flags
  BEFORE INSERT OR UPDATE OF complaint_status, complaint_text, complaint_sent_date
  ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_review_complaint_flags();
```

---

## Migration History

**Location:** `supabase/migrations/`

Key migrations:
1. `20260109_001_review_complaints_table.sql` - Created `review_complaints` table
2. `20260109_add_review_statuses.sql` - Added ENUM types and status columns to `reviews`
3. `20260209_004_rename_legacy_tag_to_tag.sql` - Renamed `legacy_tag` back to `tag` in chats
4. `20260209_005_create_chat_auto_sequences.sql` - Created `chat_auto_sequences` table
5. `20260209_006_add_stores_ai_instructions.sql` - Added `ai_instructions` TEXT to `stores`
6. `20260209_007_create_store_faq.sql` - Created `store_faq` table
7. `20260209_008_create_store_guides.sql` - Created `store_guides` table
8. `20260210_009_telegram_integration.sql` - Created `telegram_users` and `telegram_notifications_log` tables
9. `010_auth_organizations.sql` - Auth system: organizations, org_members, member_store_access, invites
10. `011_user_wb_token.sql` - Moved WB token to user level
11. `012_ozon_marketplace_support.sql` - OZON: `marketplace` on stores/products, OZON credential fields, product triple-ID
12. `013_ozon_reviews_chats_support.sql` - OZON: `marketplace` on reviews/chats/chat_messages, OZON-specific fields (review status, SKU, chat type, unread count)
13. `014_optimize_draft_complaints_index.sql` - Partial index for extension stores API draft count optimization
14. `015_deletion_detection.sql` - `review_status_wb` enum, `deleted_from_wb_at` column, resurrection logic
15. `016_review_chat_links.sql` - Review↔Chat linking table for Chrome Extension (Sprint 002)
16. `020_add_complaint_filed_info.sql` - `filed_by` + `complaint_filed_date` on review_complaints and reviews
17. `021_complaint_details.sql` - `complaint_details` table — source of truth for approved complaints (mirrors Google Sheets)
18. `022_rating_excluded.sql` - `rating_excluded` BOOLEAN on reviews + review_statuses_from_extension (WB transparent rating)
19. `023_review_status_alignment.sql` - Align statuses 1:1 with WB: add `temporarily_hidden` to review_status_wb, add `returned`/`return_requested` to product_status_by_review, backfill `deleted` → `unpublished` where set by extension

20. `025_add_work_from_date_and_comment.sql` - `work_from_date` DATE + `comment` TEXT on product_rules (per-product cutoff date + manager comment for Google Sheets)
21. `024_simplify_chat_tags.sql` - Simplified tag system (12 → 4 + NULL), removed AI classification, dropped NOT NULL/DEFAULT on tag
22. `024_update_completion_reason_check.sql` - Added CHECK constraint for 11 completion_reason values
23. `026_enforce_chat_review_unique.sql` - Added UNIQUE constraint on review_chat_links(chat_id, store_id) WHERE chat_id IS NOT NULL (1 chat = 1 review)
24. `027_chat_audit_trail.sql` - `status_changed_by` TEXT + `closure_type` VARCHAR(20) on chats, `chat_status_history` table (immutable audit log for every status/tag change, `change_source` tracking)
25. `028_schema_integrity_improvements.sql` - FK constraints on store_faq/store_guides/chat_auto_sequences, stores.status CHECK, questions.marketplace + product_nm_id TEXT, performance indexes
26. `029_drop_dead_columns.sql` - Drop 14 dead columns: reviews (draft_reply_thread_id, complaint_generated_at, complaint_reason_id, complaint_category), chats (sent_no_reply_messages x2), user_settings (no_reply_messages x2, no_reply_trigger_phrase2, assistant_* x5)
27. **`999_emergency_prevent_duplicate_sequences.sql`** - **EMERGENCY (2026-03-13):** Database-level duplicate prevention for auto-sequences. Created UNIQUE INDEX `idx_unique_active_sequence_per_chat` on (chat_id) WHERE status='active', helper function `start_auto_sequence_safe()`, monitoring view `v_duplicate_sequences`, released 2 stale processing locks. Context: Fixed 3× duplicate message sends (2 main app cluster instances + 1 cron process sending same messages). Deployed during emergency sprint. See [Emergency Sprint Docs](../docs/sprints/Sprint-Emergency-CRON-Fix-2026-03-13/) for full context.
28. **`040_drop_reviews_archive.sql`** - **Sprint-016 (2026-04-03):** Added `stores.review_count_5star` INTEGER counter, populated from `reviews_archive`, dropped `reviews_all` view, dropped `reviews_archive` table. Freed 3.4 GB (48% of DB). 5★ reviews now tracked only as counter, not as individual rows. DB went from 7.1 GB → 1.1 GB (combined with inactive store cleanup + VACUUM FULL).

**Note:** Despite folder name, this project uses **Yandex PostgreSQL**, not Supabase.

---

## Performance Considerations

### 1. Denormalization Trade-offs

**Benefits:**
- Fast filtering without JOINs (`has_complaint`, `is_product_active`)
- Pre-computed counts (`total_reviews`, `total_chats`, `review_count_5star`)

**Costs:**
- Extra storage
- Sync complexity (triggers maintain consistency)

**Decision:** Worth it for production scale. Sprint-016 further optimized by replacing 3.25M rows of 5★ reviews with a single counter (`review_count_5star`)

### 2. Index Maintenance

**Best Practices:**
- Monitor index usage: `pg_stat_user_indexes`
- Remove unused indexes
- VACUUM ANALYZE after bulk operations

### 3. Connection Pooling

**Configuration:**
```javascript
const pool = new Pool({
  max: 50,  // Max 50 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Why:** Yandex Managed PostgreSQL limits connections per plan

---

## Future Enhancements

### Potential Schema Changes

1. **Partition reviews table by date**
   - When > 5M reviews
   - Monthly/quarterly partitions

2. **Add materialized views**
   - Daily aggregations (store stats, AI costs)
   - Refresh hourly/daily

3. **Add complaint reason analytics table**
   - Pre-aggregate approval rates by reason_id
   - Track best-performing complaint categories

4. **Extension sync metadata**
   - `last_extension_sync_date` per store
   - Track which pages were parsed

---

## Development Tools

### Useful Queries

**1. Check table sizes:**
```sql
SELECT
  schemaname AS schema,
  tablename AS table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**2. Check index usage:**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;
```

**3. Check slow queries:**
```sql
SELECT
  queryid,
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Auth & Organizations Tables

> **Migration 010** (2026-02-11): Invite-only registration, role-based access, per-store manager permissions.

### `organizations`

**Purpose:** Group users and stores into a single entity.

```sql
CREATE TABLE organizations (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,                    -- e.g. "R5 Team"
  owner_id   TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `org_members`

**Purpose:** Assign users to organizations with roles.

| Role | Access |
|------|--------|
| `owner` | Full access, can't be removed |
| `admin` | Full access, can manage team |
| `manager` | Only assigned stores |

```sql
CREATE TABLE org_members (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);
```

### `member_store_access`

**Purpose:** Which stores a manager can access. Owner/admin see all org stores automatically.

```sql
CREATE TABLE member_store_access (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id TEXT NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  store_id  TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(member_id, store_id)
);
```

### `invites`

**Purpose:** Invite-only registration tokens. Valid for 7 days.

```sql
CREATE TABLE invites (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
  token      TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Modified Tables (Migration 010)

- **`users`**: Added `password_hash TEXT NULL`, `display_name TEXT NULL`
- **`stores`**: Added `org_id TEXT REFERENCES organizations(id)`

---

**Last Updated:** 2026-03-06
**Maintained By:** R5 Team
**Database:** Yandex Managed PostgreSQL 15
**Connection:** See `.env.local` for credentials
