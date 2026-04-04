# R5 Architecture Overview

**Р’РµСЂСЃРёСЏ:** 1.0
**Р”Р°С‚Р°:** 2026-02-08
**РЎС‚Р°С‚СѓСЃ:** Production

---

## РћР±Р·РѕСЂ СЃРёСЃС‚РµРјС‹

**R5 (Reputation Management Service)** вЂ” B2B SaaS РїР»Р°С‚С„РѕСЂРјР° РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ СЂРµРїСѓС‚Р°С†РёРµР№ РїСЂРѕРґР°РІС†РѕРІ РЅР° РјР°СЂРєРµС‚РїР»РµР№СЃР°С… (Wildberries, OZON).

### РљР»СЋС‡РµРІС‹Рµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё

1. **РЎР±РѕСЂ Рё СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РѕС‚Р·С‹РІРѕРІ** вЂ” Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РёРјРїРѕСЂС‚ РёР· WB API
2. **Р“РµРЅРµСЂР°С†РёСЏ Р¶Р°Р»РѕР±** вЂ” AI-powered СЃРѕР·РґР°РЅРёРµ С‚РµРєСЃС‚РѕРІ Р¶Р°Р»РѕР± РЅР° РЅРµРіР°С‚РёРІРЅС‹Рµ РѕС‚Р·С‹РІС‹
3. **РЈРїСЂР°РІР»РµРЅРёРµ С‡Р°С‚Р°РјРё** вЂ” РѕР±СЂР°Р±РѕС‚РєР° РґРёР°Р»РѕРіРѕРІ СЃ РїРѕРєСѓРїР°С‚РµР»СЏРјРё
4. **РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ** вЂ” cron jobs РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё Рё РіРµРЅРµСЂР°С†РёРё

---

## РђСЂС…РёС‚РµРєС‚СѓСЂРЅС‹Рµ СЃР»РѕРё

```
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚                     Edge / CDN Layer                          в”‚
в”‚          Cloudflare (SSL, CDN, Proxy) в”‚ rating5.ru           в”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚                      Presentation Layer                      в”‚
в”‚  Next.js App Router в”‚ React 18 в”‚ Tailwind CSS в”‚ React Query в”‚
в”‚  + Telegram Mini App (src/app/(telegram)/tg/)                в”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚                        API Layer                             в”‚
в”‚    Next.js API Routes в”‚ REST в”‚ Bearer Auth в”‚ TG initData     в”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚                      Business Logic                          в”‚
в”‚    AI Flows в”‚ Sync Services в”‚ Cron Jobs в”‚ Backfill Worker   в”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚                       Data Layer                             в”‚
в”‚      PostgreSQL (Yandex Managed) в”‚ pg library в”‚ Raw SQL      в”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚                   External Services                          в”‚
в”‚   Wildberries API в”‚ Deepseek AI в”‚ Chrome Extension в”‚ TG API в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
```

---

## РЎС‚СЂСѓРєС‚СѓСЂР° СЂРµРїРѕР·РёС‚РѕСЂРёСЏ

```
R5/
в”њв”Ђв”Ђ src/
в”‚   в”њв”Ђв”Ђ app/                    # Next.js App Router
в”‚   в”‚   в”њв”Ђв”Ђ api/                # REST API endpoints
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ stores/         # Store management
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ cron/           # Cron control endpoints
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ extension/      # Chrome Extension API
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ admin/          # Admin endpoints
в”‚   в”‚   в”‚   в””в”Ђв”Ђ wb-proxy/       # WB API proxy
в”‚   в”‚   в””в”Ђв”Ђ stores/[storeId]/   # Store pages (Products, Reviews, Chats, AI)
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ components/             # React components
в”‚   в”‚   в”њв”Ђв”Ђ reviews-v2/         # Reviews UI
в”‚   в”‚   в”њв”Ђв”Ђ chats/              # Chats UI (Messenger View)
в”‚   в”‚   в””в”Ђв”Ђ providers/          # Context providers
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ db/                     # Database layer
в”‚   в”‚   в”њв”Ђв”Ђ client.ts           # PostgreSQL connection pool
в”‚   в”‚   в”њв”Ђв”Ђ helpers.ts          # Core CRUD operations
в”‚   в”‚   в”њв”Ђв”Ђ complaint-helpers.ts # Complaints logic
в”‚   в”‚   в”њв”Ђв”Ђ review-filters.ts   # Filtering logic
в”‚   в”‚   в””в”Ђв”Ђ extension-helpers.ts # Extension-specific queries
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ ai/                     # AI integration
в”‚   в”‚   в”њв”Ђв”Ђ flows/              # AI workflows
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ generate-review-complaint-flow.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ generate-chat-reply-flow.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ classify-chat-tag-flow.ts      # DEPRECATED (migration 024, disabled)
в”‚   в”‚   в”‚   в””в”Ђв”Ђ classify-chat-deletion-flow.ts # DEPRECATED (replaced by tag-classifier.ts)
в”‚   в”‚   в”њв”Ђв”Ђ prompts/            # Prompt templates
в”‚   в”‚   в””в”Ђв”Ђ utils/              # AI utilities (templates, filters)
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ lib/                    # Utilities
в”‚   в”‚   в”њв”Ђв”Ђ cron-jobs.ts        # Cron job definitions
в”‚   в”‚   в”њв”Ђв”Ђ init-server.ts      # Server initialization
в”‚   в”‚   в”њв”Ђв”Ђ wb-api.ts           # WB API client
в”‚   в”‚   в”њв”Ђв”Ђ sync-store.ts       # Sync orchestration
в”‚   в”‚   в”њв”Ђв”Ђ ai-context.ts       # AI context builder (FAQ + Guides + Instructions)
в”‚   в”‚   в”њв”Ђв”Ђ tag-classifier.ts   # Regex tag classifier (offered/agreed/confirmed)
в”‚   в”‚   в”њв”Ђв”Ђ chat-transitions.ts # Tag/status transition guards
в”‚   в”‚   в”њв”Ђв”Ђ faq-templates.ts    # 27 pre-built FAQ templates (9 categories)
в”‚   в”‚   в”њв”Ђв”Ђ guide-templates.ts  # 7 pre-built guide templates
в”‚   в”‚   в””в”Ђв”Ђ auto-sequence-templates.ts  # Auto-sequence message templates
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ services/               # Business services
в”‚   в”‚   в”њв”Ђв”Ђ backfill-worker.ts  # Backfill queue processor
в”‚   в”‚   в”њв”Ђв”Ђ auto-complaint-generator.ts  # Event-driven complaints
в”‚   в”‚   в””в”Ђв”Ђ google-sheets-sync/ # Google Sheets export service
в”‚   в”‚
в”‚   в””в”Ђв”Ђ types/                  # TypeScript definitions
в”‚
в”њв”Ђв”Ђ docs/                       # Documentation
в”‚   в”њв”Ђв”Ђ _rules/                 # Policies
в”‚   в”њв”Ђв”Ђ reference/              # Technical reference
в”‚   в”њв”Ђв”Ђ product/                # Product documentation
в”‚   в”њв”Ђв”Ђ domains/                # Domain-specific docs
в”‚   в”њв”Ђв”Ђ decisions/              # ADRs
в”‚   в”њв”Ђв”Ђ product-specs/          # Feature specifications
в”‚   в””в”Ђв”Ђ archive/                # Historical docs
в”‚
в”њв”Ђв”Ђ scripts/                    # Utility scripts
в”њв”Ђв”Ђ deploy/                     # Deployment scripts
в”њв”Ђв”Ђ supabase/migrations/        # SQL migrations
в””в”Ђв”Ђ instrumentation.ts          # Next.js server hook
```

---

## РљР»СЋС‡РµРІС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹

### 1. API Layer

**Location:** `src/app/api/`

REST API РЅР° Р±Р°Р·Рµ Next.js App Router. Р’СЃРµ endpoints С‚СЂРµР±СѓСЋС‚ Bearer token Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё.

**РћСЃРЅРѕРІРЅС‹Рµ РіСЂСѓРїРїС‹:**

| РџСѓС‚СЊ | РќР°Р·РЅР°С‡РµРЅРёРµ |
|------|------------|
| `/api/stores` | CRUD РјР°РіР°Р·РёРЅРѕРІ |
| `/api/stores/[storeId]/reviews` | РћС‚Р·С‹РІС‹ |
| `/api/stores/[storeId]/products` | РўРѕРІР°СЂС‹ |
| `/api/stores/[storeId]/chats` | Р§Р°С‚С‹ |
| `/api/stores/[storeId]/complaints` | Р–Р°Р»РѕР±С‹ |
| `/api/stores/[storeId]/ai-instructions` | AI РёРЅСЃС‚СЂСѓРєС†РёРё РјР°РіР°Р·РёРЅР° |
| `/api/stores/[storeId]/faq` | FAQ Р±Р°Р·Р° Р·РЅР°РЅРёР№ РјР°РіР°Р·РёРЅР° |
| `/api/stores/[storeId]/guides` | РРЅСЃС‚СЂСѓРєС†РёРё РґР»СЏ РєР»РёРµРЅС‚РѕРІ |
| `/api/stores/[storeId]/analyze-dialogues` | AI-Р°РЅР°Р»РёР· РґРёР°Р»РѕРіРѕРІ в†’ FAQ + Guides |
| `/api/extension/*` | Chrome Extension API |
| `/api/cron/*` | Cron management |

**РџРѕРґСЂРѕР±РЅРµРµ:** [docs/reference/api.md](./reference/api.md)

---

### 2. Database Layer

**Location:** `src/db/`

РџСЂСЏРјС‹Рµ SQL Р·Р°РїСЂРѕСЃС‹ С‡РµСЂРµР· `pg` library. Р‘РµР· ORM.

**РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:**

- `client.ts` вЂ” Connection pool (max 50 connections)
- `helpers.ts` вЂ” РћСЃРЅРѕРІРЅС‹Рµ CRUD РѕРїРµСЂР°С†РёРё
- `complaint-helpers.ts` вЂ” Р›РѕРіРёРєР° Р¶Р°Р»РѕР±
- `review-filters.ts` вЂ” Р¤РёР»СЊС‚СЂР°С†РёСЏ РѕС‚Р·С‹РІРѕРІ

**Source of Truth:** [docs/database-schema.md](./database-schema.md)

---

### 3. AI Integration

**Location:** `src/ai/`

РРЅС‚РµРіСЂР°С†РёСЏ СЃ Deepseek API РґР»СЏ РіРµРЅРµСЂР°С†РёРё С‚РµРєСЃС‚РѕРІ.

**Flows (AI workflows):**

| Flow | РќР°Р·РЅР°С‡РµРЅРёРµ |
|------|------------|
| `generate-review-complaint-flow.ts` | Р“РµРЅРµСЂР°С†РёСЏ С‚РµРєСЃС‚Р° Р¶Р°Р»РѕР±С‹ |
| `generate-chat-reply-flow.ts` | Р“РµРЅРµСЂР°С†РёСЏ РѕС‚РІРµС‚Р° РІ С‡Р°С‚ |
| `classify-chat-tag-flow.ts` | ~~РљР»Р°СЃСЃРёС„РёРєР°С†РёСЏ С‡Р°С‚Р° РїРѕ С‚РµРіР°Рј~~ **DEPRECATED** (migration 024, РѕС‚РєР»СЋС‡РµРЅРѕ) |
| `classify-chat-deletion-flow.ts` | ~~РљР»Р°СЃСЃРёС„РёРєР°С†РёСЏ РЅР° СѓРґР°Р»РµРЅРёРµ~~ **DEPRECATED** в†’ Р·Р°РјРµРЅРµРЅРѕ РЅР° `src/lib/tag-classifier.ts` |
| `generate-deletion-offer-flow.ts` | Р“РµРЅРµСЂР°С†РёСЏ РїСЂРµРґР»РѕР¶РµРЅРёСЏ СѓРґР°Р»РµРЅРёСЏ |
| `generate-review-reply-flow.ts` | Р“РµРЅРµСЂР°С†РёСЏ РѕС‚РІРµС‚Р° РЅР° РѕС‚Р·С‹РІ |
| `generate-question-reply-flow.ts` | Р“РµРЅРµСЂР°С†РёСЏ РѕС‚РІРµС‚Р° РЅР° РІРѕРїСЂРѕСЃ |
| `analyze-store-dialogues-flow.ts` | РђРЅР°Р»РёР· 500 РґРёР°Р»РѕРіРѕРІ в†’ Р°РІС‚Рѕ-РіРµРЅРµСЂР°С†РёСЏ FAQ + Guides |

**Prompts:** `src/ai/prompts/`

**Per-Store AI Context:** `src/lib/ai-context.ts`

РљР°Р¶РґС‹Р№ AI flow РїРѕР»СѓС‡Р°РµС‚ РєРѕРЅС‚РµРєСЃС‚ РјР°РіР°Р·РёРЅР° С‡РµСЂРµР· `buildStoreInstructions()`:
- **AI Instructions** вЂ” СЃРІРѕР±РѕРґРЅС‹Р№ С‚РµРєСЃС‚ (С‚РѕРЅ, РїСЂР°РІРёР»Р°, РѕРіСЂР°РЅРёС‡РµРЅРёСЏ)
- **FAQ** вЂ” РїР°СЂС‹ РІРѕРїСЂРѕСЃ-РѕС‚РІРµС‚ РёР· `store_faq` С‚Р°Р±Р»РёС†С‹
- **Guides** вЂ” РїРѕС€Р°РіРѕРІС‹Рµ РёРЅСЃС‚СЂСѓРєС†РёРё РёР· `store_guides` С‚Р°Р±Р»РёС†С‹

**РћСЃРѕР±РµРЅРЅРѕСЃС‚Рё:**

- Template-based complaints РґР»СЏ РїСѓСЃС‚С‹С… РѕС‚Р·С‹РІРѕРІ (СЌРєРѕРЅРѕРјРёСЏ С‚РѕРєРµРЅРѕРІ)
- Per-store personalization (AI instructions + FAQ + Guides)
- Р›РѕРіРёСЂРѕРІР°РЅРёРµ РІ `ai_logs` С‚Р°Р±Р»РёС†Сѓ
- Cost tracking (USD)

---

### 4. Cron Jobs

**Location:** `src/lib/cron-jobs.ts`

РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ С‡РµСЂРµР· `node-cron`.

**РђРєС‚РёРІРЅС‹Рµ jobs:**

| Job | Р Р°СЃРїРёСЃР°РЅРёРµ (MSK) | РќР°Р·РЅР°С‡РµРЅРёРµ |
|-----|------------------|------------|
| `hourly-review-sync` | РљР°Р¶РґС‹Р№ С‡Р°СЃ | РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РѕС‚Р·С‹РІРѕРІ + РіРµРЅРµСЂР°С†РёСЏ Р¶Р°Р»РѕР± |
| `daily-product-sync` | 07:00 | РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ С‚РѕРІР°СЂРѕРІ |
| `adaptive-dialogue-sync` | 15/60 РјРёРЅ | РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ С‡Р°С‚РѕРІ (Р°РґР°РїС‚РёРІРЅРѕ) |
| `backfill-worker` | РљР°Р¶РґС‹Рµ 5 РјРёРЅ | РћР±СЂР°Р±РѕС‚РєР° РѕС‡РµСЂРµРґРё backfill |
| `stores-cache-refresh` | РљР°Р¶РґС‹Рµ 5 РјРёРЅ | РџСЂРѕРіСЂРµРІ РєСЌС€Р° РјР°РіР°Р·РёРЅРѕРІ РґР»СЏ Extension API |
| `google-sheets-sync` | 06:00 | Р­РєСЃРїРѕСЂС‚ РїСЂР°РІРёР» С‚РѕРІР°СЂРѕРІ РІ Google Sheets |
| `auto-sequence-processor` | РљР°Р¶РґС‹Рµ 30 РјРёРЅ (8-22 MSK) | РћС‚РїСЂР°РІРєР° follow-up СЃРѕРѕР±С‰РµРЅРёР№ |

**РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ:** `instrumentation.ts` в†’ `init-server.ts` в†’ `cron-jobs.ts`

**РџРѕРґСЂРѕР±РЅРµРµ:** [docs/CRON_JOBS.md](./CRON_JOBS.md)

---

### 5. Sync Services

**РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РґР°РЅРЅС‹С… СЃ Wildberries:**

```
WB API в†’ Sync Service в†’ PostgreSQL
           в†“
    Event-driven Complaint Generation
           в†“
    review_complaints table
```

**РўРёРїС‹ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё:**

1. **Incremental** вЂ” С‚РѕР»СЊРєРѕ РЅРѕРІС‹Рµ РґР°РЅРЅС‹Рµ (РїРѕ РґР°С‚Рµ)
2. **Full** вЂ” РїРѕР»РЅР°СЏ РІС‹РіСЂСѓР·РєР° (adaptive chunking)

**Р—Р°С‰РёС‚Р°:**

- Rate limiting (2-3 СЃРµРє РјРµР¶РґСѓ РјР°РіР°Р·РёРЅР°РјРё)
- Retry СЃ exponential backoff
- Concurrent execution protection

---

## РџРѕС‚РѕРєРё РґР°РЅРЅС‹С…

### 1. Review Sync Flow

```
[WB Feedbacks API]
       в†“
[/api/stores/:id/reviews/update]
       в†“
[syncStoreReviews() in sync-store.ts]
       в†“
[upsertReviews() in helpers.ts]
       в†“
[PostgreSQL: reviews table]
       в†“ (if rating в‰¤ 4 && product active)
[generateComplaint() in generate-review-complaint-flow.ts]
       в†“
[PostgreSQL: review_complaints table]
```

### 2. Chat AI Reply Flow

```
[User clicks "Generate AI"]
       в†“
[/api/stores/:id/chats/:chatId/generate-ai]
       в†“
[generateChatReply() flow]
       в†“
[Deepseek API]
       в†“
[Response в†’ draft_reply in chats table]
       в†“
[UI: AI Suggestion Box]
```

### 3. Complaint Lifecycle

```
Review Created (rating в‰¤ 4)
       в†“
[Auto-generate complaint] в†ђв”Ђв”Ђ CRON or Event-driven
       в†“
status: 'draft' (editable)
       в†“
[User marks as sent via Extension]
       в†“
status: 'pending'
       в†“
[WB moderates]
       в†“
status: 'approved' | 'rejected'
```

---

## Р’РЅРµС€РЅРёРµ РёРЅС‚РµРіСЂР°С†РёРё

### 1. Wildberries API

| API | Endpoint Base | РќР°Р·РЅР°С‡РµРЅРёРµ |
|-----|---------------|------------|
| Feedbacks API | `feedbacks-api.wildberries.ru` | РћС‚Р·С‹РІС‹, РІРѕРїСЂРѕСЃС‹ |
| Content API | `content-api.wildberries.ru` | РўРѕРІР°СЂС‹ |
| Chat API | `chat.wildberries.ru` | Р”РёР°Р»РѕРіРё |

**РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ:** WB API tokens (per store)

### 2. OZON API

| API | Endpoint Base | РќР°Р·РЅР°С‡РµРЅРёРµ |
|-----|---------------|------------|
| Chat API | `api-seller.ozon.ru` | Р”РёР°Р»РѕРіРё BUYER_SELLER (Premium Plus required) |
| Product API | `api-seller.ozon.ru` | РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ С‚РѕРІР°СЂРѕРІ |

**РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ:** `Client-Id` (numeric) + `Api-Key` (UUID) headers

**API РєР»РёРµРЅС‚:** `src/lib/ozon-api.ts` вЂ” `OzonApiClient` class

**РљР»СЋС‡РµРІРѕР№ РїР°С‚С‚РµСЂРЅ вЂ” Seller-Initiated Chats:**
- OZON РЅРµ РїРµСЂРµРґР°С‘С‚ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ С‚РѕРІР°СЂРµ РІ СЃРїРёСЃРєРµ С‡Р°С‚РѕРІ
- `context.sku` РІ РёСЃС‚РѕСЂРёРё СЃРѕРѕР±С‰РµРЅРёР№ РїСЂРёСЃСѓС‚СЃС‚РІСѓРµС‚ РўРћР›Р¬РљРћ РІ seller-initiated РґРёР°Р»РѕРіР°С…
- Seller-initiated = РїСЂРѕРґР°РІРµС† РѕС‚РєСЂС‹РІР°РµС‚ С‡Р°С‚ РёР· РєР°СЂС‚РѕС‡РєРё РѕС‚Р·С‹РІР° РґР»СЏ deletion outreach
- Р­С‚РѕС‚ SKU Р·Р°РїРёСЃС‹РІР°РµС‚СЃСЏ РІ `chats.product_nm_id` Рё СЏРІР»СЏРµС‚СЃСЏ РјР°СЂРєРµСЂРѕРј РґР»СЏ TG-С„РёР»СЊС‚СЂР°С†РёРё
- РР· ~317K OZON С‡Р°С‚РѕРІ С‚РѕР»СЊРєРѕ ~500 РёРјРµСЋС‚ `product_nm_id` (0.15%)

**Hybrid sync strategy:**
- Tier 1: Unread-only scan (РєР°Р¶РґС‹Рµ 5 РјРёРЅ) вЂ” Р±С‹СЃС‚СЂРѕ, ~0-20 API РІС‹Р·РѕРІРѕРІ
- Tier 2: Full scan safety net (РµР¶РµС‡Р°СЃРЅРѕ 9-20 РњРЎРљ) вЂ” РґР»СЏ С‡Р°С‚РѕРІ РїСЂРѕС‡РёС‚Р°РЅРЅС‹С… РІ OZON dashboard

**РџРѕРґСЂРѕР±РЅРµРµ:** [docs/domains/ozon-chats.md](../domains/ozon-chats.md)

### 3. Deepseek API

- **Model:** `deepseek-chat`
- **РќР°Р·РЅР°С‡РµРЅРёРµ:** Р“РµРЅРµСЂР°С†РёСЏ С‚РµРєСЃС‚РѕРІ (Р¶Р°Р»РѕР±С‹, РѕС‚РІРµС‚С‹)
- **Cost:** ~$0.0005-0.001 per complaint
- **Rate limit:** 60 RPM

### 3. Chrome Extension

Р Р°СЃС€РёСЂРµРЅРёРµ РґР»СЏ РїР°СЂСЃРёРЅРіР° СЃС‚Р°С‚СѓСЃРѕРІ РѕС‚Р·С‹РІРѕРІ СЃ WB РєР°Р±РёРЅРµС‚Р°.

**API endpoints:** `/api/extension/*`

**Р”Р°РЅРЅС‹Рµ:**
- `review_status_wb` (visible/unpublished/excluded)
- `product_status_by_review` (purchased/refused)
- `chat_status_by_review` (available/unavailable)

### 4. Google Sheets API

Р­РєСЃРїРѕСЂС‚ РїСЂР°РІРёР» С‚РѕРІР°СЂРѕРІ РІ Google Sheets РґР»СЏ СЂСѓРєРѕРІРѕРґРёС‚РµР»СЏ.

**Service Account:** `r5-automation@r5-wb-bot.iam.gserviceaccount.com`

**Р­РєСЃРїРѕСЂС‚РёСЂСѓРµРјС‹Рµ РґР°РЅРЅС‹Рµ:**
- Р’СЃРµ Р°РєС‚РёРІРЅС‹Рµ РјР°РіР°Р·РёРЅС‹ (`stores.status = 'active'`)
- Р’СЃРµ Р°РєС‚РёРІРЅС‹Рµ С‚РѕРІР°СЂС‹ (`products.work_status = 'active'`)
- РџСЂР°РІРёР»Р° Р¶Р°Р»РѕР± Рё С‡Р°С‚РѕРІ РёР· `product_rules` С‚Р°Р±Р»РёС†С‹

**API endpoints:** `/api/admin/google-sheets/sync`

**РўСЂРёРіРіРµСЂС‹:**
- CRON (РµР¶РµРґРЅРµРІРЅРѕ 6:00 MSK)
- Manual API call
- Hooks РїСЂРё РёР·РјРµРЅРµРЅРёРё РїСЂР°РІРёР»/СЃС‚Р°С‚СѓСЃРѕРІ

**Service:** `src/services/google-sheets-sync/`

### 5. Telegram Bot & Mini App

Telegram Mini App РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ С‡Р°С‚Р°РјРё СЃ РїРѕРєСѓРїР°С‚РµР»СЏРјРё С‡РµСЂРµР· РјРѕР±РёР»СЊРЅС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ.

**РљРѕРјРїРѕРЅРµРЅС‚С‹:**

| РљРѕРјРїРѕРЅРµРЅС‚ | Р Р°СЃРїРѕР»РѕР¶РµРЅРёРµ | РќР°Р·РЅР°С‡РµРЅРёРµ |
|-----------|-------------|------------|
| TG Bot | `scripts/start-telegram-bot.js` | PM2 РїСЂРѕС†РµСЃСЃ (fork), long-polling, РєРѕРјР°РЅРґС‹ /link /stop /status |
| Mini App UI | `src/app/(telegram)/tg/` | РњРѕР±РёР»СЊРЅС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ: РѕС‡РµСЂРµРґСЊ С‡Р°С‚РѕРІ + РґРµР№СЃС‚РІРёСЏ |
| Proxy API | `src/app/api/telegram/` | Auth, queue, chat actions (initData HMAC) |
| Notifications | `src/lib/telegram-notifications.ts` | РџСѓС€ РїСЂРё РѕС‚РІРµС‚Рµ РєР»РёРµРЅС‚Р° (С…СѓРє РІ dialogue sync) |
| Auth | `src/lib/telegram-auth.ts` | HMAC-SHA256 РІР°Р»РёРґР°С†РёСЏ initData |
| DB helpers | `src/db/telegram-helpers.ts` | CRUD telegram_users, notification log, dedup |

**РџРѕС‚РѕРєРё РґР°РЅРЅС‹С…:**

```
РљР»РёРµРЅС‚ РѕС‚РІРµС‡Р°РµС‚ в†’ Dialogue Sync в†’ TG Push (review-linked only)
в†’ РњРµРЅРµРґР¶РµСЂ РѕС‚РєСЂС‹РІР°РµС‚ Mini App в†’ РћС‡РµСЂРµРґСЊ (review-linked only)
в†’ РўР°РїР°РµС‚ С‡Р°С‚ в†’ Р’РёРґРёС‚ СЂРµР№С‚РёРЅРі, РґР°С‚Сѓ РѕС‚Р·С‹РІР°, РґРµС‚Р°Р»Рё (СЃС‚Р°С‚СѓСЃС‹, СЃС‚СЂР°С‚РµРіРёСЏ, РєРµС€Р±РµРє)
в†’ 4 РєРЅРѕРїРєРё: РћС‚РїСЂР°РІРёС‚СЊ / Р—Р°РЅРѕРІРѕ / Р—Р°РєСЂС‹С‚СЊ / РџСЂРѕРїСѓСЃС‚РёС‚СЊ
```

**Р¤РёР»СЊС‚СЂ РѕС‡РµСЂРµРґРё (`telegram-helpers.ts`) вЂ” Review-Linked Only (Sprint 002+):**
```sql
-- WB: INNER JOIN review_chat_links в†’ С‚РѕР»СЊРєРѕ С‡Р°С‚С‹ РїСЂРёРІСЏР·Р°РЅРЅС‹Рµ Рє РѕС‚Р·С‹РІР°Рј
INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
JOIN products p ON p.store_id = c.store_id AND c.product_nm_id = p.wb_product_id
JOIN product_rules pr ON p.id = pr.product_id AND pr.work_in_chats = TRUE

-- OZON: seller-initiated (product_nm_id IS NOT NULL)
```

**РџСЂРёРЅС†РёРї С„РёР»СЊС‚СЂР°С†РёРё:** РР· ~300K+ С‡Р°С‚РѕРІ РїРѕРєР°Р·С‹РІР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ С‚Рµ, РєРѕС‚РѕСЂС‹Рµ R5 СЃР°Рј РѕС‚РєСЂС‹Р» РїРѕ РѕС‚Р·С‹РІР°Рј. Р­С‚Рѕ ~700 С‡Р°С‚РѕРІ РІРјРµСЃС‚Рѕ С‚С‹СЃСЏС‡. РЎРЅРёР¶Р°РµС‚ С€СѓРј РЅР° ~90%.

**Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РґР°РЅРЅС‹Рµ РІ РѕС‡РµСЂРµРґРё:**
- `review_rating` + `review_date` вЂ” РёР· `review_chat_links` (РїРѕРєР°Р·С‹РІР°СЋС‚СЃСЏ РІ РєР°СЂС‚РѕС‡РєРµ)
- `complaint_status`, `product_status` вЂ” РёР· `reviews` (РїРѕРєР°Р·С‹РІР°СЋС‚СЃСЏ РІ РґРµС‚Р°Р»СЊРЅРѕРј РІРёРґРµ С‡Р°С‚Р°)
- `offer_compensation`, `max_compensation`, `chat_strategy` вЂ” РёР· `product_rules` (РїРѕРєР°Р·С‹РІР°СЋС‚СЃСЏ РІ РґРµС‚Р°Р»СЊРЅРѕРј РІРёРґРµ С‡Р°С‚Р°)

**Р¤РёР»СЊС‚СЂ СѓРІРµРґРѕРјР»РµРЅРёР№ (dialogue sync Step 5a-tg):**
- WB: С‚РѕР»СЊРєРѕ С‡Р°С‚С‹ СЃ Р·Р°РїРёСЃСЊСЋ РІ `review_chat_links` (INNER JOIN) + `activeNmIds` (work_in_chats=TRUE)
- OZON: С‚РѕР»СЊРєРѕ РµСЃР»Рё `existing.product_nm_id IS NOT NULL` (seller-initiated)

**API endpoints:** `/api/telegram/*`

**РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ:** Telegram `initData` в†’ HMAC-SHA256 СЃ BOT_TOKEN в†’ lookup `telegram_users`

---

## Deployment

**РРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂР°:**

- **Domain:** `rating5.ru` (registrar: nic.ru, DNS: Cloudflare)
- **CDN/Proxy:** Cloudflare (SSL Full Strict, Proxied ON)
- **Cloud:** Yandex Cloud Compute
- **Server:** 2 vCPU, 4GB RAM, 20GB SSD (IP: 158.160.139.99)
- **OS:** Ubuntu 24.04 LTS
- **Process Manager:** PM2 (4 processes: app cluster x2, cron fork, tg-bot fork)
- **Web Server:** Nginx (reverse proxy + SSL termination, ports 80/443)
- **SSL:** GlobalSign DV certificate (`/etc/ssl/rating5/`)
- **Database:** Yandex Managed PostgreSQL 15

**РџСЂРѕС†РµСЃСЃС‹ PM2 (РЅРµР·Р°РІРёСЃРёРјС‹ РґСЂСѓРі РѕС‚ РґСЂСѓРіР°):**

| РџСЂРѕС†РµСЃСЃ | РўРёРї | РќР°Р·РЅР°С‡РµРЅРёРµ | Р—Р°РІРёСЃРёРјРѕСЃС‚Рё |
|---------|-----|-----------|------------|
| `wb-reputation` x2 | cluster | Next.js (UI + API) | Nginx в†’ :3000 |
| `wb-reputation-cron` | fork | Cron Р·Р°РґР°С‡Рё | РЎР°РјРѕСЃС‚РѕСЏС‚РµР»СЊРЅС‹Р№ |
| `wb-reputation-tg-bot` | fork | Telegram Р±РѕС‚ | РЎР°РјРѕСЃС‚РѕСЏС‚РµР»СЊРЅС‹Р№ |

**РџРѕРґСЂРѕР±РЅРµРµ:** [docs/DEPLOYMENT.md](../DEPLOYMENT.md)

---

## Security

1. **API Authentication** вЂ” Bearer token (`wbrm_*`)
2. **Telegram Auth** вЂ” HMAC-SHA256 initData validation + `auth_date` freshness (24h)
3. **Store-level isolation** вЂ” `owner_id` checks
4. **Rate limiting** вЂ” Per-endpoint limits
5. **Input validation** вЂ” Zod schemas
6. **SQL injection protection** вЂ” Parameterized queries

---

## Performance Optimizations

1. **Denormalization** вЂ” `has_complaint`, `is_product_active` flags
2. **Composite indexes** вЂ” Optimized for common queries
3. **Partial indexes** вЂ” For specific WHERE conditions
4. **Connection pooling** вЂ” Max 50 connections
5. **React Query caching** вЂ” Client-side data cache
6. **Template-based complaints** вЂ” Zero AI cost for empty reviews

---

## ADRs (Architecture Decision Records)

| ADR | Р РµС€РµРЅРёРµ |
|-----|---------|
| [ADR-001](./decisions/ADR-001-why-instrumentation-hook.md) | CRON С‡РµСЂРµР· instrumentation hook |
| [ADR-002](./decisions/ADR-002-active-stores-filter.md) | Р¤РёР»СЊС‚СЂР°С†РёСЏ С‚РѕР»СЊРєРѕ Р°РєС‚РёРІРЅС‹С… РјР°РіР°Р·РёРЅРѕРІ |
| [ADR-003](./decisions/ADR-003-cron-intervals.md) | РРЅС‚РµСЂРІР°Р»С‹ 5 РјРёРЅ (dev) / 1 С‡Р°СЃ (prod) |

---

## РЎРІСЏР·Р°РЅРЅС‹Рµ РґРѕРєСѓРјРµРЅС‚С‹

- [Database Schema](./database-schema.md) вЂ” Source of Truth РїРѕ Р‘Р”
- [CRON Jobs](./CRON_JOBS.md) вЂ” РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ
- [API Reference](./reference/api.md) вЂ” РљР°СЂС‚Р° API
- [Complaints Domain](./domains/complaints.md) вЂ” Р›РѕРіРёРєР° Р¶Р°Р»РѕР±
- [Chats & AI](./domains/chats-ai.md) вЂ” AI РІ С‡Р°С‚Р°С…

---

**Last Updated:** 2026-02-22
