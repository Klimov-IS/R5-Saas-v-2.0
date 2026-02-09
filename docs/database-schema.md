# WB Reputation Manager - Database Schema

**Database:** PostgreSQL 15 (Yandex Managed)
**ORM:** None (raw SQL via `pg` library)
**Connection Pool:** Max 50 connections
**Last Updated:** 2026-02-09

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
4. [Communication Tables](#communication-tables)
   - [chats](#chats)
   - [chat_messages](#chat_messages)
   - [questions](#questions)
5. [Configuration Tables](#configuration-tables)
   - [user_settings](#user_settings)
   - [product_rules](#product_rules)
6. [Analytics Tables](#analytics-tables)
   - [ai_logs](#ai_logs)
7. [Entity Relationships](#entity-relationships)
8. [Indexes Strategy](#indexes-strategy)
9. [Triggers & Functions](#triggers--functions)

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
**Review visibility status on Wildberries platform**

```sql
CREATE TYPE review_status_wb AS ENUM (
  'visible',       -- Виден (подаем жалобы)
  'unpublished',   -- Снят с публикации (НЕ подаем)
  'excluded',      -- Исключён из рейтинга (НЕ подаем)
  'unknown'        -- Неизвестно (по умолчанию)
);
```

**Usage:** Determines if review should be included in complaint workflow

---

### 2. `product_status_by_review`
**Product purchase status from review context**

```sql
CREATE TYPE product_status_by_review AS ENUM (
  'purchased',      -- Выкуп (товар выкуплен)
  'refused',        -- Отказ (отказ от товара)
  'not_specified',  -- Не указано
  'unknown'         -- Неизвестно
);
```

**Usage:** Helps understand review context (return vs purchase)

---

### 3. `chat_status_by_review`
**Chat availability status from review**

```sql
CREATE TYPE chat_status_by_review AS ENUM (
  'unavailable',  -- Недоступен (WB не дает открыть чат)
  'available',    -- Доступен (можно открыть чат)
  'unknown'       -- Неизвестно
);
```

**Usage:** Indicates if we can initiate dialogue with reviewer

---

### 4. `complaint_status`
**Complaint lifecycle status**

```sql
CREATE TYPE complaint_status AS ENUM (
  'not_sent',  -- Не отправлена (жалоба не создана)
  'draft',     -- Черновик (сгенерирована AI, но не отправлена)
  'sent',      -- Отправлена (вручную отмечено пользователем)
  'approved',  -- Одобрена (WB одобрил жалобу)
  'rejected',  -- Отклонена (WB отклонил жалобу)
  'pending'    -- На рассмотрении (WB рассматривает)
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

**Purpose:** Wildberries seller accounts (кабинеты)

```sql
CREATE TABLE stores (
  id                         TEXT PRIMARY KEY,
  name                       TEXT NOT NULL,
  owner_id                   TEXT NOT NULL REFERENCES users(id),

  -- WB API Tokens
  api_token                  TEXT NOT NULL,  -- Main API token
  content_api_token          TEXT NULL,
  feedbacks_api_token        TEXT NULL,
  chat_api_token             TEXT NULL,

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
  chat_tag_counts            JSONB DEFAULT '{}'::jsonb,

  -- AI Personalization
  ai_instructions            TEXT NULL,  -- Store-specific AI instructions (tone, rules, restrictions)

  -- Status
  status                     VARCHAR(20) DEFAULT 'active',

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Fields:**
- `status` - 'active' or 'inactive' (controls visibility)
- `ai_instructions` - Free-form text with AI instructions for this store (injected into system prompt)
- `total_reviews` - cached count (updated during sync)
- `last_*_update_*` - sync status tracking for monitoring

**Indexes:**
```sql
CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_name ON stores(name);
CREATE INDEX idx_stores_status ON stores(status);
```

**Sync Status Values:**
- `null` - never synced
- `'pending'` - sync in progress
- `'success'` - last sync succeeded
- `'error'` - last sync failed (see `*_error` field)

---

### `products`

**Purpose:** Products from WB catalog

```sql
CREATE TABLE products (
  id                       TEXT PRIMARY KEY,
  store_id                 TEXT NOT NULL REFERENCES stores(id),
  owner_id                 TEXT NOT NULL REFERENCES users(id),

  -- WB product data
  name                     TEXT NOT NULL,
  wb_product_id            TEXT NOT NULL,  -- nmId from WB
  vendor_code              TEXT NOT NULL,
  price                    INTEGER NULL,
  image_url                TEXT NULL,

  -- Cached review count
  review_count             INTEGER DEFAULT 0,

  -- Work status
  is_active                BOOLEAN DEFAULT TRUE,
  work_status              work_status_enum DEFAULT 'not_working',

  -- Compensation settings
  compensation_method      TEXT NULL,

  -- Raw WB API response (for reference)
  wb_api_data              JSONB NULL,

  -- Last review sync for this product
  last_review_update_date  TIMESTAMPTZ NULL,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Fields:**
- `wb_product_id` - WB internal ID (nmId)
- `is_active` - manually controlled visibility
- `work_status` - complaint workflow participation
- `review_count` - cached count (updated during sync)

**Indexes:**
```sql
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_wb_id ON products(wb_product_id);
CREATE INDEX idx_products_store_wb_id ON products(store_id, wb_product_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_work_status ON products(work_status);
CREATE INDEX idx_products_store_active ON products(store_id, is_active, work_status);
CREATE UNIQUE INDEX idx_products_unique_wb_id ON products(store_id, wb_product_id);
```

**Important:**
- `idx_products_unique_wb_id` prevents duplicate products per store
- `idx_products_store_active` optimizes "active products" queries

---

### `reviews`

**Purpose:** Customer reviews from WB Feedbacks API + Extension parsing

```sql
CREATE TABLE reviews (
  id                         TEXT PRIMARY KEY,
  product_id                 TEXT NOT NULL REFERENCES products(id),
  store_id                   TEXT NOT NULL REFERENCES stores(id),
  owner_id                   TEXT NOT NULL REFERENCES users(id),

  -- Review content (from WB API)
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

  -- Legacy complaint fields (kept for backward compatibility)
  complaint_text             TEXT NULL,
  complaint_sent_date        TIMESTAMPTZ NULL,
  draft_reply                TEXT NULL,
  draft_reply_thread_id      TEXT NULL,

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

  -- Complaint metadata (duplicated in review_complaints table)
  complaint_generated_at     TIMESTAMPTZ NULL,
  complaint_reason_id        INTEGER NULL,
  complaint_category         TEXT NULL,

  -- Extension parsing metadata
  purchase_date              TIMESTAMPTZ NULL,
  parsed_at                  TIMESTAMPTZ NULL,  -- When extension parsed this review
  page_number                INTEGER NULL,      -- Page number in WB cabinet

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Fields:**
- **From WB API:** `id`, `rating`, `text`, `author`, `date`, `answer`
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

-- Answer tracking
CREATE INDEX idx_reviews_store_answer ON reviews(store_id, has_answer, date DESC);
CREATE INDEX idx_reviews_store_answer_date ON reviews(store_id, answer, date DESC) WHERE answer IS NOT NULL;
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
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'pending')),

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
```

**Partial Indexes:**
- `idx_complaints_store_sent` - only sent complaints
- `idx_complaints_status_moderated` - only moderated complaints
- `idx_complaints_cost_date` - only complaints with cost data

---

## Communication Tables

### `chats`

**Purpose:** Customer support dialogues from WB Chat API

```sql
CREATE TABLE chats (
  id                        TEXT PRIMARY KEY,
  store_id                  TEXT NOT NULL REFERENCES stores(id),
  owner_id                  TEXT NOT NULL REFERENCES users(id),

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

  -- Chat classification (AI-assigned tag)
  tag                       TEXT NOT NULL DEFAULT 'untagged',
  tag_update_date           TIMESTAMPTZ NULL,

  -- Kanban board status (user-managed)
  status                    TEXT NOT NULL DEFAULT 'inbox',
  completion_reason         TEXT NULL,  -- required when status='closed'

  -- AI draft reply
  draft_reply               TEXT NULL,
  draft_reply_thread_id     TEXT NULL,

  -- No-reply automation (tracking sent messages)
  sent_no_reply_messages    JSONB DEFAULT '[]'::jsonb,
  sent_no_reply_messages2   JSONB DEFAULT '[]'::jsonb,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Fields:**
- `tag` - AI classification (12 тегов): `active`, `successful`, `unsuccessful`, `no_reply`, `untagged`, `completed`, `deletion_candidate`, `deletion_offered`, `deletion_agreed`, `deletion_confirmed`, `refund_requested`, `spam`
- `status` - Kanban position (5 статусов): `inbox`, `in_progress`, `awaiting_reply`, `resolved`, `closed`
- `completion_reason` - причина закрытия: `review_deleted`, `review_upgraded`, `no_reply`, `old_dialog`, `not_our_issue`, `spam`, `negative`, `other`
- `sent_no_reply_messages` - история отправленных авто-сообщений (набор 1)
- `sent_no_reply_messages2` - история отправленных авто-сообщений (набор 2)

**Indexes:**
```sql
CREATE INDEX idx_chats_store ON chats(store_id);
CREATE INDEX idx_chats_store_tag ON chats(store_id, tag);
CREATE INDEX idx_chats_store_tag_date ON chats(store_id, tag, last_message_date DESC);
CREATE INDEX idx_chats_last_message ON chats(last_message_date DESC);
CREATE INDEX idx_chats_product ON chats(product_nm_id) WHERE product_nm_id IS NOT NULL;
```

---

### `chat_messages`

**Purpose:** Individual messages within chats

```sql
CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL REFERENCES chats(id),
  store_id    TEXT NOT NULL REFERENCES stores(id),
  owner_id    TEXT NOT NULL REFERENCES users(id),

  text        TEXT NULL,
  sender      TEXT NOT NULL,  -- 'client' or 'seller'
  timestamp   TIMESTAMPTZ NOT NULL,
  download_id TEXT NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id, timestamp DESC);
CREATE INDEX idx_chat_messages_store ON chat_messages(store_id, timestamp DESC);
```

---

### `questions`

**Purpose:** Product questions from WB Questions API

```sql
CREATE TABLE questions (
  id                      TEXT PRIMARY KEY,
  store_id                TEXT NOT NULL REFERENCES stores(id),
  owner_id                TEXT NOT NULL REFERENCES users(id),

  text                    TEXT NOT NULL,
  created_date            TIMESTAMPTZ NOT NULL,
  state                   TEXT NOT NULL,
  was_viewed              BOOLEAN DEFAULT FALSE,
  is_answered             BOOLEAN DEFAULT FALSE,

  answer                  JSONB NULL,

  -- Product context
  product_nm_id           INTEGER NOT NULL,
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

### `chat_auto_sequences`

**Purpose:** Track automated follow-up message sequences for chats in `awaiting_reply` status. 1 message/day, up to 14 days.

```sql
CREATE TABLE chat_auto_sequences (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id                 TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  store_id                TEXT NOT NULL,
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
```

**Key helpers:** `createAutoSequence`, `getPendingSequences`, `advanceSequence`, `stopSequence`, `completeSequence`

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
  prompt_chat_tag           TEXT NULL,  -- классификация тегов чатов
  prompt_chat_deletion_tag  TEXT NULL,  -- deletion-классификация (fallback: prompt_chat_tag)
  prompt_deletion_offer     TEXT NULL,  -- генерация deletion offer (fallback: prompt_chat_reply)
  prompt_question_reply     TEXT NULL,  -- ответы на вопросы
  prompt_review_complaint   TEXT NULL,  -- генерация жалоб
  prompt_review_reply       TEXT NULL,  -- ответы на отзывы

  -- OpenAI assistants (deprecated)
  assistant_chat_reply      TEXT NULL,
  assistant_chat_tag        TEXT NULL,
  assistant_question_reply  TEXT NULL,
  assistant_review_complaint TEXT NULL,
  assistant_review_reply    TEXT NULL,

  -- Auto-reply messages
  no_reply_messages         JSONB DEFAULT '[]'::jsonb,
  no_reply_trigger_phrase   TEXT NULL,
  no_reply_stop_message     TEXT NULL,

  no_reply_messages2        JSONB DEFAULT '[]'::jsonb,
  no_reply_trigger_phrase2  TEXT NULL,
  no_reply_stop_message2    TEXT NULL,

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

  created_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
```

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

## Entity Relationships

```
users (1) ───── (N) stores
  │                  │
  │                  ├─── (N) products
  │                  │        │
  │                  │        ├─── (1) product_rules (1:1)
  │                  │        └─── (N) reviews
  │                  │                  │
  │                  │                  └─── (1) review_complaints (1:1)
  │                  │
  │                  ├─── (N) chats
  │                  │        └─── (N) chat_messages
  │                  │
  │                  └─── (N) questions
  │
  └─── (1) user_settings (1:1)
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

**Note:** Despite folder name, this project uses **Yandex PostgreSQL**, not Supabase.

---

## Performance Considerations

### 1. Denormalization Trade-offs

**Benefits:**
- Fast filtering without JOINs (`has_complaint`, `is_product_active`)
- Pre-computed counts (`total_reviews`, `total_chats`)

**Costs:**
- Extra storage
- Sync complexity (triggers maintain consistency)

**Decision:** Worth it for 1M+ reviews scale

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

**Last Updated:** 2026-02-09
**Maintained By:** R5 Team
**Database:** Yandex Managed PostgreSQL 15
**Connection:** See `.env.local` for credentials
