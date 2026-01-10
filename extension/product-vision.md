# WB Reputation Manager - Chrome Extension Product Vision

**Product Name:** WB Complaint Automation Extension
**Version:** 2.0 (Refactored)
**Target Platform:** Chrome/Edge Extension
**Integration:** WB Reputation Manager SaaS
**Last Updated:** 2026-01-10

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution](#solution)
4. [User Personas](#user-personas)
5. [User Journey](#user-journey)
6. [Key Features v1.0](#key-features-v10)
7. [Success Metrics](#success-metrics)
8. [Technical Requirements](#technical-requirements)
9. [Out of Scope (v2.0+)](#out-of-scope-v20)
10. [Risks & Mitigation](#risks--mitigation)

---

## Executive Summary

### What We're Building

A Chrome extension that **automates complaint filing** on Wildberries by:
1. **Parsing** review statuses from WB cabinet UI (что WB API не предоставляет)
2. **Syncing** parsed data with our SaaS backend
3. **Generating** AI-powered complaint texts via our server
4. **Submitting** complaints through WB UI (так как WB API не поддерживает аргументированные жалобы)
5. **Reporting** results back to server for analytics

### Business Impact

**Before Extension:**
- ❌ Manual complaint filing: 5-10 minutes per review
- ❌ Missing critical statuses (WB не предоставляет по API)
- ❌ Wasted AI tokens regenerating old complaints after database migration
- ❌ Cannot identify which reviews already have complaints filed

**After Extension:**
- ✅ Automated complaint filing: 100+ complaints per hour
- ✅ Complete status visibility (visible, excluded, chat availability)
- ✅ 100% complaint coverage for active products
- ✅ Zero wasted AI tokens (only generate when needed)
- ✅ Full analytics on approval rates and ROI

---

## Problem Statement

### Current Pain Points

#### 1. **Data Loss After Migration (Critical!)**

**Context:**
- Мы работали 3+ месяца, подали десятки тысяч жалоб
- Клиенты тоже подавали жалобы (намного больше)
- После миграции Firebase → Yandex PostgreSQL мы заново синхронизировали ВСЕ отзывы по WB API
- Но WB API **НЕ предоставляет** статусы жалоб!

**Problem:**
```
reviews.complaint_status = 'not_sent'  (❌ НЕПРАВИЛЬНО!)
```

На самом деле:
- На многие отзывы уже подана жалоба (complaint_status = 'sent')
- Многие жалобы уже одобрены (complaint_status = 'approved')
- Многие отзывы уже исключены из рейтинга (review_status_wb = 'excluded')

**Impact:**
- 🔥 Расширение будет пытаться подать жалобу повторно → ошибка WB "Уже подана"
- 🔥 Потратим тысячи токенов AI на генерацию уже существующих жалоб
- 🔥 Потратим часы времени на отзывы, с которыми уже нельзя работать

#### 2. **WB API Limitations**

**What WB API Provides:**
- ✅ Review ID, rating, text, author, date
- ✅ Seller's answer (if exists)

**What WB API DOES NOT Provide:**
- ❌ `review_status_wb` (visible / unpublished / excluded)
- ❌ `product_status_by_review` (purchased / refused)
- ❌ `chat_status_by_review` (available / unavailable)
- ❌ `complaint_status` (not_sent / sent / approved / rejected)
- ❌ `purchase_date` (дата покупки)

**Why This Matters:**
- Нельзя подать жалобу на отзыв со статусом "excluded" (уже исключён)
- Нельзя подать жалобу, если уже подана (WB правило: 1 отзыв = 1 жалоба max)
- Нужно знать, доступен ли чат для работы с клиентом

#### 3. **Manual Complaint Submission Required**

**WB API Limitation:**
- WB Feedbacks API позволяет подавать жалобы
- НО: можно передать только `reason_id` (категория жалобы)
- НЕЛЬЗЯ передать `complaint_text` (аргументация)

**Why This Is Critical:**
- Без аргументации жалоба почти всегда отклоняется
- Качественная AI-генерация текста жалобы → approval rate 60-80%
- Простая категория без текста → approval rate 10-20%

**Solution:**
- Расширение подаёт жалобы **через UI WB кабинета**
- Вставляет сгенерированный AI текст в форму
- Нажимает кнопку "Отправить"

#### 4. **Inefficient Workflow**

**Old Approach (Google Sheets + Extension v1):**
```
1. Вручную добавить магазин в Google Sheets
2. Открыть WB кабинет в нужном магазине
3. Перейти на страницу отзывов
4. Запустить расширение
5. Расширение читает из Google Sheets конфигурацию
6. Расширение парсит отзывы
7. Расширение генерирует жалобы (прямой запрос к Deepseek API)
8. Расширение подаёт жалобы
9. Никакой синхронизации с БД → нет аналитики
```

**Problems:**
- Нет централизованной базы данных
- API ключ Deepseek хранится в расширении (небезопасно)
- Нет логирования и аналитики
- Невозможно отследить ROI (какие жалобы одобрены, какие отклонены)

---

## Solution

### High-Level Architecture

```
┌─────────────────────┐
│  WB Cabinet (UI)    │  ← Пользователь открывает страницу отзывов
└──────────┬──────────┘
           │ (Extension parses)
           ↓
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension (Content Script)                      │
│  - Parses review statuses from HTML                     │
│  - Sends data to backend via API                        │
│  - Receives complaint texts from backend                │
│  - Submits complaints via WB UI                         │
│  - Reports success/failure back to backend              │
└──────────┬──────────────────────────────────────────────┘
           │ (HTTPS API)
           ↓
┌─────────────────────────────────────────────────────────┐
│  WB Reputation Manager Backend (Next.js)                │
│  - Receives parsed reviews from extension               │
│  - Updates database with statuses                       │
│  - Generates complaints via Deepseek API                │
│  - Returns complaint texts to extension                 │
│  - Stores sent complaint records for analytics          │
└──────────┬──────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                    │
│  - reviews (with statuses)                              │
│  - review_complaints (AI-generated complaints)          │
│  - ai_logs (cost tracking)                              │
└─────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Extension = Data Collection + UI Automation**
   - Парсит статусы из WB UI
   - Подаёт жалобы через WB UI
   - НЕ генерирует AI контент (это делает сервер)

2. **Backend = Business Logic + AI + Database**
   - Генерирует жалобы через Deepseek
   - Применяет product rules
   - Хранит всю историю для аналитики

3. **Single Source of Truth = Database**
   - Все данные хранятся в PostgreSQL
   - Extension синхронизирует в обе стороны
   - Conflict resolution: server wins (но preserve manual edits)

4. **Batch Processing for Performance**
   - Extension парсит ВСЕ отзывы на странице
   - Отправляет пакетом на сервер
   - Получает пакет жалоб обратно
   - Подаёт все жалобы последовательно

---

## User Personas

### Primary User: Reputation Manager

**Name:** Алексей (Менеджер по репутации)

**Goals:**
- Подать жалобы на 100% негативных отзывов по активным товарам
- Минимизировать время на рутинные задачи
- Максимизировать approval rate жалоб

**Pain Points:**
- Много магазинов (10-40 кабинетов WB)
- Сотни новых отзывов каждый день
- Ручная подача жалоб занимает часы
- Нет visibility по результатам (одобрена/отклонена)

**Technical Skills:**
- Уверенный пользователь браузера
- Может установить расширение
- Знает, как работать с WB кабинетом

**Workflow:**
1. Утром заходит в SaaS систему
2. Видит список магазинов и количество новых отзывов
3. Открывает WB кабинет нужного магазина
4. Запускает расширение
5. Расширение автоматически подаёт все жалобы
6. Алексей переходит к следующему магазину
7. В конце дня проверяет аналитику в SaaS

**Success Criteria:**
- Время на 1 магазин: <10 минут (было 30-60 минут)
- Покрытие: 100% негативных отзывов (было 50-70%)
- Approval rate: 60-80% (было 40-50%)

---

## User Journey

### Happy Path (MVP)

#### Step 1: Authentication
```
User → Opens Chrome Extension
     → Enters API token (one-time setup)
     → Extension validates token with backend
     → Token saved to browser storage
     → User sees "Ready" status
```

#### Step 2: Store Selection
```
User → Opens WB cabinet (specific store)
     → Navigates to Reviews page (Отзывы)
     → Extension auto-detects store (or user selects from dropdown)
     → Extension fetches active products from backend
```

#### Step 3: Product Filtering (Optional)
```
User → (Optional) Manually selects product in WB filter
     → OR Extension auto-inserts product nmId to filter
     → Page reloads with filtered reviews
```

#### Step 4: Review Parsing & Sync
```
Extension → Parses all reviews on current page
          → Extracts: id, rating, text, author, date
          → Extracts statuses: review_status_wb, product_status_by_review, chat_status_by_review, complaint_status
          → Sends batch to backend: POST /api/extension/stores/{id}/reviews/sync
          → Backend saves/updates reviews in database
          → Backend returns list of reviews that need complaints
```

#### Step 5: Complaint Generation
```
Extension → For each review needing complaint:
          → Calls: POST /api/extension/stores/{id}/reviews/{reviewId}/generate-complaint
          → Backend checks: complaint already exists? (status = draft)
          → If exists: returns existing complaint
          → If not: generates via Deepseek, saves to review_complaints table, returns
          → Extension receives: { complaint_text, reason_id, reason_name }
```

#### Step 6: Complaint Submission
```
Extension → For each review with complaint:
          → Finds "Подать жалобу" button in WB UI
          → Clicks button → modal opens
          → Selects reason_id from dropdown
          → Pastes complaint_text into textarea
          → Clicks "Отправить"
          → Waits for WB response (success/error)
```

#### Step 7: Reporting
```
Extension → For each submitted complaint:
          → Calls: POST /api/extension/stores/{id}/reviews/{reviewId}/report-sent
          → Payload: { complaint_text, reason_id, sent_at, wb_response }
          → Backend updates: review_complaints.status = 'sent', sent_at = NOW()
          → Backend updates: reviews.complaint_status = 'sent'
```

#### Step 8: Completion
```
Extension → Shows summary:
          → "✅ Подано жалоб: 47"
          → "⏭️  Пропущено (уже подано): 12"
          → "❌ Ошибок: 2"
          → User sees notification
          → Can proceed to next product/store
```

---

## Key Features v1.0

### Must-Have (MVP)

#### 1. **Authentication**
- Input field for API token
- Validate token with backend
- Store securely in chrome.storage.sync
- Auto-attach to all API requests

#### 2. **Store Detection**
- Auto-detect store from WB URL (if possible)
- OR: Dropdown to select store manually
- Fetch store config from backend (active products, rules)

#### 3. **Review Parsing**
- Parse review ID, rating, text, author, date from HTML
- Parse statuses: review_status_wb, product_status_by_review, chat_status_by_review, complaint_status
- Support pagination (parse multiple pages if needed)
- Batch size: 20-100 reviews per request

#### 4. **Status Sync**
- POST parsed reviews to backend
- Update local cache with server response
- Handle conflicts (server data newer than parsed data)

#### 5. **Complaint Generation (Server-Side)**
- Request complaint for each review needing one
- Display progress indicator ("Генерация 15/47...")
- Cache complaints locally to avoid re-requesting

#### 6. **Complaint Submission (UI Automation)**
- Find "Подать жалобу" button for each review
- Open complaint modal
- Fill form: select category, paste text
- Submit and wait for response
- Handle errors (retry logic, skip if failed)
- Rate limiting: 2-5 seconds between submissions

#### 7. **Progress Reporting**
- Real-time progress bar
- Success/error counters
- Log file downloadable (for debugging)
- Final summary notification

#### 8. **Error Handling**
- Network errors: retry 3 times
- WB UI errors: log and skip
- Backend errors: show user-friendly message
- Crash recovery: save state to resume

### Nice-to-Have (v1.5)

#### 9. **Product Auto-Filter**
- Fetch active products from backend
- Auto-insert nmId into WB filter
- Automatically switch between products
- Process all products sequentially

#### 10. **Multi-Page Support**
- Detect pagination buttons
- Auto-navigate to next page
- Parse all pages until no more reviews

#### 11. **Analytics Dashboard (in Extension)**
- Show today's stats: filed, approved, rejected
- Show lifetime stats per store
- Cost tracking (AI tokens used)

---

## Success Metrics

### KPIs (Key Performance Indicators)

#### 1. **Complaint Coverage**
**Target:** 100% of negative reviews on active products

**Measurement:**
```sql
SELECT
  COUNT(*) FILTER (WHERE rating <= 3 AND complaint_status IN ('draft', 'sent')) * 100.0 / COUNT(*)
FROM reviews
WHERE store_id = $1
  AND is_product_active = TRUE
  AND review_status_wb = 'visible';
```

**Goal:** ≥ 95%

#### 2. **Time Efficiency**
**Target:** <10 minutes per store (was 30-60 minutes)

**Measurement:**
- Time from extension start to completion
- Logged in `ai_logs.metadata`

**Goal:** 5-10 minutes per store (200-500 reviews)

#### 3. **Approval Rate**
**Target:** 60-80% complaints approved by WB

**Measurement:**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'approved') * 100.0 / COUNT(*)
FROM review_complaints
WHERE store_id = $1
  AND status IN ('approved', 'rejected');
```

**Goal:** ≥ 60%

#### 4. **Token Savings**
**Target:** 75% reduction in wasted AI tokens

**Before Migration:**
- Regenerated 10,000+ complaints → $2.80 USD wasted

**After Extension:**
- Only generate complaints for new/missing reviews
- Saved: ~$2.10 USD per full re-sync

**Goal:** Zero wasted tokens on re-generation

#### 5. **Error Rate**
**Target:** <5% submission errors

**Measurement:**
- Errors / Total attempts
- Logged in extension report

**Goal:** <5%

---

## Technical Requirements

### Architecture

#### Extension Stack
- **Platform:** Chrome Extension Manifest V3
- **Language:** TypeScript
- **Build Tool:** Webpack or Vite
- **Storage:** chrome.storage.sync (for token, config)
- **Network:** Fetch API with retry logic

#### Backend Integration
- **Protocol:** HTTPS REST API
- **Auth:** Bearer token (extension-specific token)
- **Format:** JSON
- **Endpoints:** See API Reference (to be created)

### Browser Support
- Chrome: v120+
- Edge: v120+
- (Future) Firefox, Safari

### Performance
- **Parse speed:** 100 reviews in <5 seconds
- **Network:** Handle slow connections (retry with exponential backoff)
- **Memory:** <100MB RAM usage
- **Battery:** Minimal CPU usage (no busy loops)

### Security
- **Token storage:** chrome.storage.sync (encrypted by browser)
- **HTTPS only:** All API calls via HTTPS
- **No sensitive data in logs:** Mask user data in error logs
- **CSP compliance:** No eval(), only trusted sources

### Reliability
- **State persistence:** Save progress every 10 reviews
- **Crash recovery:** Resume from last saved state
- **Idempotency:** Safe to re-run multiple times (server deduplicates)

---

## Out of Scope (v2.0+)

### Future Features (Not in MVP)

#### 1. **Auto-Store Switching**
- Automatically switch between WB cabinets
- Requires additional auth/session management
- Complexity: High

**Why Not Now:** MVP focuses on single-store workflow

#### 2. **Full Cabinet Parsing**
- Parse ALL products (not just active)
- Build analytics for inactive products
- Enables upselling opportunities

**Why Not Now:** Not critical for MVP, can be added later

#### 3. **Chat Automation**
- Auto-open chats with customers
- Send compensation offers
- Negotiate rating changes

**Why Not Now:** Separate feature, different workflow

#### 4. **Scheduled Automation**
- Run extension on schedule (daily at 9 AM)
- No user interaction needed

**Why Not Now:** Requires background service worker, more complex

#### 5. **Multi-User Support**
- Multiple team members using same extension
- Role-based permissions

**Why Not Now:** MVP assumes single user per account

---

## Risks & Mitigation

### Technical Risks

#### Risk 1: WB UI Changes Break Extension

**Probability:** Medium
**Impact:** Critical
**Mitigation:**
- Use robust CSS selectors (data attributes, multiple fallbacks)
- Add error logging to detect breaking changes
- Monitor WB UI updates
- Quick hotfix deployment process (<24 hours)

#### Risk 2: Rate Limiting by WB

**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Add delays between requests (2-5 seconds)
- Exponential backoff on errors
- User-configurable rate limits
- Respect WB terms of service

#### Risk 3: Browser Extension Rejection

**Probability:** Low (if compliant)
**Impact:** High
**Mitigation:**
- Follow Chrome Web Store policies
- No obfuscated code
- Clear privacy policy
- Minimal permissions request

### Business Risks

#### Risk 4: Low Adoption by Users

**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Simple 1-click installation
- Clear documentation with screenshots
- Demo video showing ROI
- Support chat for onboarding

#### Risk 5: Competition

**Probability:** Medium
**Impact:** Low
**Mitigation:**
- AI quality (Deepseek + custom prompts) is differentiator
- Tight integration with our SaaS (analytics, multi-store)
- Fast iteration based on user feedback

---

## Next Steps

### Phase 1: Documentation & Planning (This Document)
- ✅ Define product vision
- ✅ Create user journey
- ✅ Define success metrics
- ⏳ Create detailed workflow document
- ⏳ Define API specification

### Phase 2: Code Review (Next)
- Review existing extension code
- Identify reusable components
- Plan refactoring strategy

### Phase 3: Development
- Implement new architecture
- Add backend API endpoints
- Integrate with database
- Add error handling & logging

### Phase 4: Testing
- Test with 1-2 pilot stores
- Measure KPIs
- Fix bugs and optimize

### Phase 5: Rollout
- Deploy to production
- Onboard all users
- Monitor metrics
- Iterate based on feedback

---

**Related Documentation:**
- [Extension Workflow](./workflow.md) - Detailed step-by-step workflow
- [API Reference](./api-reference.md) - Backend API endpoints for extension
- [Database Schema](../docs/database-schema.md) - Database structure
- [Statuses Reference](../docs/statuses-reference.md) - Status values and rules

**Maintained By:** R5 Team
**Product Owner:** Ilia Klimov
**Last Updated:** 2026-01-10
