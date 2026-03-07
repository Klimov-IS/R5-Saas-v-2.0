# R5 Documentation — Semantic Reorganization Report

**Date:** 2026-03-06
**Task:** TASK-docs-002 (Sprint 005)
**Status:** Analysis Only — No files modified
**Scope:** 90+ active documentation files across 10 directories

---

## Table of Contents

1. [Documentation Inventory](#1-documentation-inventory)
2. [Knowledge Domain Map](#2-knowledge-domain-map)
3. [Fragmentation Analysis](#3-fragmentation-analysis)
4. [Canonical Document Design](#4-canonical-document-design)
5. [Proposed Documentation Architecture](#5-proposed-documentation-architecture)
6. [Migration Plan](#6-migration-plan)
7. [Foundational Documentation Standards](#7-foundational-documentation-standards)

---

## 1. Documentation Inventory

### 1.1 Classification by Knowledge Type

90+ active files classified into 9 knowledge types:

| Knowledge Type | Count | Examples |
|---|---|---|
| **Core Business Rules** | 12 | wb-work-policy, ozon-work-policy, complaints, chats-ai, auto-sequences |
| **System Architecture** | 8 | ARCHITECTURE, telegram-mini-app, auth-and-roles, audit-trail, review-chat-links |
| **Technical Reference** | 9 | database-schema, api, statuses-reference, EXTENSION_API_COMPLETE, TAG_CLASSIFICATION |
| **Operational Guide** | 7 | DEPLOYMENT, CRON_JOBS, QUICK_REFERENCE, TROUBLESHOOTING, DEVELOPMENT |
| **Product Specification** | 10 | CHATS_FEATURE_SPEC, KANBAN_BOARD_IMPLEMENTATION, cabinets, client-tabs |
| **UI/UX Implementation** | 6 | MESSENGER_VIEW_GUIDE, FILTERS_SYSTEM, KANBAN_QUICK_START, UI_DESIGN_SYSTEM |
| **Policy/Governance** | 5 | DB_POLICY, CRON_POLICY, DOCS_UPDATE_POLICY, CHAT_COMMUNICATION_POLICY |
| **Decision Record** | 3 | ADR-001, ADR-002, ADR-003 |
| **Planning/Backlog** | 7 | AI_AGENT_REFACTOR_PLAN, BACKLOG_REFACTOR_TMA, ARCH_REVIEW_TMA |
| **Sprint Artifact** | 20+ | Sprint READMEs, task files, audit reports |
| **Historical/Obsolete** | 6 | CHAT_STATUS_AND_TAGGING_SYSTEM, CHATS_IMPLEMENTATION_ROADMAP, CHATS_CURRENT_STATE_ANALYSIS |

### 1.2 Full Inventory Table

| # | File | Knowledge Type | Topic | Relevance | Action |
|---|---|---|---|---|---|
| | **docs/ root — Operational Guides** | | | | |
| 1 | `CRON_JOBS.md` | Operational guide | All cron jobs, schedules, idempotency | HIGH | Keep |
| 2 | `database-schema.md` | Technical reference | 30+ tables, ENUMs, triggers, indexes | HIGH | Keep |
| 3 | `DEPLOYMENT.md` | Operational guide | Server, PM2, Nginx, SSL, rollback | HIGH | Keep |
| 4 | `DEVELOPMENT.md` | Operational guide | Local setup, coding rules, Git | HIGH | Keep (update — 50 days stale) |
| 5 | `QUICK_REFERENCE.md` | Operational guide | Cheat sheet (SSH, PM2, SQL) | HIGH | Trim (remove duplicate tables) |
| 6 | `TROUBLESHOOTING.md` | Operational guide | 10 problem categories, diagnostics | HIGH | Keep |
| 7 | `TASK_MANAGEMENT_CENTER.md` | Product specification | Task management feature MVP | MEDIUM | Move to product-specs/ |
| | **docs/ root — Subject Guides** | | | | |
| 8 | `MESSENGER_VIEW_GUIDE.md` | UI implementation | Split-screen chat UI workflow | HIGH | Keep |
| 9 | `FILTERS_SYSTEM.md` | UI implementation | Filter UI, debounce, Zustand state | HIGH | Keep |
| 10 | `KANBAN_QUICK_START.md` | UI implementation | 4-column Kanban, drag-drop, audit trail | HIGH | Keep |
| 11 | `TELEGRAM_MINI_APPS_RULES.md` | Core business rules | Master rules for TG Mini App operations | CRITICAL | Keep (elevate) |
| 12 | `UI_DESIGN_SYSTEM.md` | UI implementation | Design tokens, colors, spacing | MEDIUM | Keep |
| 13 | `COMPONENT_LIBRARY.md` | UI implementation | Shadcn/ui vs custom decision rules | MEDIUM | Keep |
| 14 | `API_SPEC_FOR_EXTENSION_STATUS_CHECKER.md` | Technical reference | Extension status-check API | LOW | Merge into EXTENSION_API_COMPLETE |
| 15 | `EXTENSION_TEAM_STORES_UPDATE.md` | Product specification | Team store assignment for extension | LOW | Archive |
| 16 | `AUDIT_FINDINGS_SUMMARY.md` | Historical report | TG audit executive summary (5 P0) | MEDIUM | Archive (to decisions/) |
| 17 | `AUDIT_TELEGRAM_MINI_APPS.md` | Historical report | Full TG audit (377 lines) | MEDIUM | Archive (to decisions/) |
| | **docs/domains/ — Business Logic** | | | | |
| 18 | `complaints.md` | Core business rules | Complaint lifecycle, two-table design | HIGH | Keep (master) |
| 19 | `auto-complaints.md` | System architecture | Hybrid event/CRON complaint generation | HIGH | Keep |
| 20 | `complaint-auto-generation-rules.md` | Core business rules | 6 selection criteria, concurrency | MEDIUM | Merge into auto-complaints |
| 21 | `complaints-table-schema.md` | Technical reference | review_complaints schema, indexes | HIGH | Keep |
| 22 | `COMPLAINTS_SYSTEM_INTEGRATION.md` | Sprint artifact | Extension → DB pipeline, 4-phase rollout | MEDIUM | Archive (unclear status) |
| 23 | `AB_TESTING_COMPLAINT_TEMPLATES.md` | Experiment | 4-variant templates, hash distribution | MEDIUM | Archive (test likely completed) |
| 24 | `DELETION_TRIGGER_PHRASES.md` | Technical reference | 60+ regex patterns for deletion intent | HIGH | Keep |
| 25 | `STAGE_3_DELETION_AGENT_GUIDE.md` | Product specification | Deletion agent, compensation calculator | MEDIUM | Rewrite (partially outdated) |
| 26 | `chats-ai.md` | Core business rules | AI flows, tags, sequences, compensation | CRITICAL | Keep (domain authority) |
| 27 | `TAG_CLASSIFICATION.md` | Technical reference | Regex classifier, 58 tests, 4 tags | HIGH | Keep |
| 28 | `auto-sequences.md` | Core business rules | 4 sequence types, cron, stop conditions | HIGH | Keep |
| 29 | `review-chat-links.md` | Core business rules | 1 review = 1 chat invariant | HIGH | Keep |
| 30 | `audit-trail.md` | System architecture | chat_status_history, updateChatWithAudit | HIGH | Keep |
| 31 | `telegram-mini-app.md` | System architecture | Bot, auth, queue, notifications | HIGH | Keep |
| 32 | `auth-and-roles.md` | System architecture | JWT, 3 roles, invites | HIGH | Keep |
| 33 | `google-sheets-sync.md` | System architecture | 2 sync services, debounce, retry | HIGH | Keep |
| 34 | `wb-work-policy.md` | Core business rules | WB legal/operational constraints | HIGH | Keep |
| 35 | `ozon-work-policy.md` | Core business rules | OZON legal/operational constraints | HIGH | Keep |
| 36 | `ozon-chats.md` | System architecture | OZON chat sync, seller-initiated | HIGH | Keep (consolidation candidate) |
| | **docs/reference/ — Technical Reference** | | | | |
| 37 | `ARCHITECTURE.md` | System architecture | High-level system layers, data flows | MEDIUM | Keep |
| 38 | `api.md` | Technical reference | 30+ REST endpoints | HIGH | Keep |
| 39 | `EXTENSION_API_COMPLETE.md` | Technical reference | Chrome Extension API v2.1.0 | MEDIUM | Keep |
| 40 | `statuses-reference.md` | Technical reference | All status ENUMs, lifecycle diagrams | HIGH | Keep |
| | **docs/_rules/ — Policies** | | | | |
| 41 | `CHAT_COMMUNICATION_POLICY.md` | Policy/governance | Chat communication workflow & standards | HIGH | Keep |
| 42 | `CRON_POLICY.md` | Policy/governance | CRON development enforcement rules | LOW | Merge into CRON_JOBS |
| 43 | `DB_POLICY.md` | Policy/governance | Database modification enforcement | HIGH | Keep |
| 44 | `DOCS_UPDATE_POLICY.md` | Policy/governance | Documentation update meta-policy | HIGH | Keep |
| | **docs/product-specs/ — Feature Specs** | | | | |
| 45 | `CHAT_STATUS_AND_TAGGING_SYSTEM.md` | Product specification | Proposed 12-tag system (OBSOLETE) | LOW | Archive |
| 46 | `CHATS_FEATURE_SPEC.md` | Product specification | 12 user stories, API specs | MEDIUM | Keep (add deprecation note) |
| 47 | `CHATS_CURRENT_STATE_ANALYSIS.md` | Historical report | Pre-Kanban gap analysis | LOW | Archive |
| 48 | `CHATS_UI_UX_PROTOTYPES.md` | UI implementation | HTML wireframes, mobile adaptation | HIGH | Keep |
| 49 | `CHATS_IMPLEMENTATION_ROADMAP.md` | Sprint artifact | 4-sprint plan (historical) | LOW | Archive |
| 50 | `KANBAN_BOARD_IMPLEMENTATION.md` | Product specification | Completed MVP, bugfixes, future roadmap | HIGH | Keep |
| 51 | `AI_AUTONOMY_ROADMAP.md` | Planning/backlog | 3-stage AI autonomy plan | LOW | Keep |
| 52 | `OZON/OZON-SELLER-API.md` | Technical reference | OZON API research | MEDIUM | Keep |
| | **docs/decisions/ — ADRs & Plans** | | | | |
| 53 | `ADR-001-why-instrumentation-hook.md` | Decision record | CRON auto-start via instrumentation | HIGH | Keep |
| 54 | `ADR-002-active-stores-filter.md` | Decision record | Filter CRON to active stores | HIGH | Keep |
| 55 | `ADR-003-cron-intervals.md` | Decision record | CRON interval strategy | HIGH | Keep |
| 56 | `AI_AGENT_ARCH_REVIEW.md` | Planning/backlog | AI system audit + 3 options | HIGH | Move to plans/ |
| 57 | `AI_AGENT_REFACTOR_PLAN.md` | Planning/backlog | 5-stage AI refactor roadmap | HIGH | Move to plans/ |
| 58 | `BACKLOG_AI_AGENT_REFACTOR.md` | Planning/backlog | 18 PRs, stages 0-6 | HIGH | Move to plans/ |
| 59 | `ARCH_REVIEW_TMA.md` | Planning/backlog | TMA architecture assessment | HIGH | Move to plans/ |
| 60 | `REFACTOR_PLAN_TMA_BFF.md` | Planning/backlog | 4-stage TMA → BFF migration | HIGH | Move to plans/ |
| 61 | `BACKLOG_REFACTOR_TMA.md` | Planning/backlog | 15 PRs for TMA refactoring | HIGH | Move to plans/ |
| 62 | `golden-test-chats.md` | Technical reference | 3 golden test chat snapshots | MEDIUM | Move to tests/ |
| | **docs/product/ — Product Docs** | | | | |
| 63 | `cabinets.md` | Product specification | Store management, aggregated stats | LOW | Keep |
| 64 | `client-tabs.md` | Product specification | Products/Reviews/Chats tab logic | MEDIUM | Keep |
| | **docs/sprints/ — Sprint Docs** | | | | |
| 65 | `sprints/sprint-004-communication-policy/CHAT_COMMUNICATION_POLICY.md` | Core business rules | 12-section communication standard | HIGH | Move to domains/ after validation |
| 66-85 | Sprint READMEs, task files, reports | Sprint artifact | Various | MEDIUM | Keep (ephemeral) |

---

## 2. Knowledge Domain Map

### 2.1 Discovered Domains

Analysis of the documentation corpus reveals **8 natural domains** and **3 infrastructure layers**:

#### Business Domains

| Domain | Description | Documents |
|---|---|---|
| **D1: Complaint System** | WB complaint lifecycle, AI generation, auto-generation, approval, Extension pipeline | complaints.md, auto-complaints.md, complaint-auto-generation-rules.md, complaints-table-schema.md, COMPLAINTS_SYSTEM_INTEGRATION.md, AB_TESTING_COMPLAINT_TEMPLATES.md |
| **D2: Chat Operations** | Chat lifecycle, statuses, tags, messenger UI, filters, Kanban, completion reasons | chats-ai.md, MESSENGER_VIEW_GUIDE.md, FILTERS_SYSTEM.md, KANBAN_QUICK_START.md, TELEGRAM_MINI_APPS_RULES.md, KANBAN_BOARD_IMPLEMENTATION.md, TAG_CLASSIFICATION.md |
| **D3: Deletion Workflow** | Deletion agent, trigger phrases, compensation calculator, buyer communication | STAGE_3_DELETION_AGENT_GUIDE.md, DELETION_TRIGGER_PHRASES.md, wb-work-policy.md (compensation section) |
| **D4: Auto-Sequences** | Automated follow-up messaging, cron scheduling, stop conditions | auto-sequences.md, chats-ai.md (sequences section), wb-work-policy.md (rассылки section) |
| **D5: Review-Chat Linking** | 1 review = 1 chat invariant, extension creation, reconciliation, TG filtering | review-chat-links.md, wb-work-policy.md (linking section) |
| **D6: Communication Policy** | Operational standards, message templates, compensation rules, risk handling | sprint-004/CHAT_COMMUNICATION_POLICY.md, _rules/CHAT_COMMUNICATION_POLICY.md |

#### Platform Integrations

| Domain | Description | Documents |
|---|---|---|
| **P1: Telegram Mini App** | Bot, HMAC auth, queue, notifications, inline design system | telegram-mini-app.md, TELEGRAM_MINI_APPS_RULES.md, AUDIT_TELEGRAM_MINI_APPS.md |
| **P2: Chrome Extension** | Complaint reporting, chat opening, status syncing | EXTENSION_API_COMPLETE.md, API_SPEC_FOR_EXTENSION_STATUS_CHECKER.md |
| **P3: Marketplace APIs** | WB + OZON API integration, rate limits, sync strategies | wb-work-policy.md, ozon-work-policy.md, ozon-chats.md |
| **P4: Google Sheets** | Product Rules export, Client Directory upsert, Drive onboarding | google-sheets-sync.md |

#### Infrastructure

| Domain | Description | Documents |
|---|---|---|
| **I1: Auth & Access** | JWT, roles, organizations, invites, middleware | auth-and-roles.md |
| **I2: Audit Trail** | Status history, change sources, updateChatWithAudit | audit-trail.md |
| **I3: Database & Operations** | Schema, migrations, deployment, CRON, troubleshooting | database-schema.md, DEPLOYMENT.md, CRON_JOBS.md, TROUBLESHOOTING.md |

### 2.2 Domain Hierarchy

```
LEGAL LAYER (non-negotiable constraints)
├── wb-work-policy.md         — WB rules
└── ozon-work-policy.md       — OZON rules
    ↓ constrains
DOMAIN LOGIC LAYER (business rules)
├── D1: Complaint System      — complaints.md (master)
├── D2: Chat Operations        — chats-ai.md (master)
├── D3: Deletion Workflow      — STAGE_3 + trigger phrases
├── D4: Auto-Sequences         — auto-sequences.md
├── D5: Review-Chat Links      — review-chat-links.md
└── D6: Communication Policy   — CHAT_COMMUNICATION_POLICY.md
    ↓ implemented by
SYSTEM LAYER (architecture)
├── P1: Telegram Mini App      — telegram-mini-app.md
├── P2: Chrome Extension       — EXTENSION_API_COMPLETE.md
├── P3: Marketplace APIs       — ozon-chats.md
├── P4: Google Sheets          — google-sheets-sync.md
├── I1: Auth & Access          — auth-and-roles.md
├── I2: Audit Trail            — audit-trail.md
└── I3: Database & Operations  — database-schema.md, CRON_JOBS.md
```

---

## 3. Fragmentation Analysis

### 3.1 HIGH Severity — Same knowledge in 5+ files

#### F1: Chat Statuses (4 values: awaiting_reply, inbox, in_progress, closed)

**Appears in 7 files:**

| # | File | Section |
|---|---|---|
| 1 | MESSENGER_VIEW_GUIDE.md | Status filter buttons |
| 2 | FILTERS_SYSTEM.md | statusFilter values |
| 3 | KANBAN_QUICK_START.md | 4 Kanban columns |
| 4 | TELEGRAM_MINI_APPS_RULES.md | Funnel stages 4.1-4.4 |
| 5 | chats-ai.md | ChatStatus section |
| 6 | client-tabs.md | Chats tab section |
| 7 | statuses-reference.md | chat_status ENUM |

**Problem:** Status order inconsistent across files. Tab order (awaiting_reply → inbox → in_progress → closed) not consistently documented.

**Recommended consolidation:** Single Source of Truth in `chats-ai.md`. All other files should REFERENCE, not REPEAT.

---

#### F2: Chat Tags (4 + NULL: deletion_candidate, deletion_offered, deletion_agreed, deletion_confirmed)

**Appears in 6 files:**

| # | File | Section |
|---|---|---|
| 1 | MESSENGER_VIEW_GUIDE.md | Tag filter section |
| 2 | FILTERS_SYSTEM.md | Tag filtering |
| 3 | KANBAN_QUICK_START.md | Tag vs Status distinction |
| 4 | chats-ai.md | ChatTag section |
| 5 | TAG_CLASSIFICATION.md | Regex implementation |
| 6 | CHAT_STATUS_AND_TAGGING_SYSTEM.md | **OBSOLETE:** proposes 12 tags |

**Problem:** CHAT_STATUS_AND_TAGGING_SYSTEM proposes 12 tags; migration 024 reduced to 4 + NULL.

**Recommended consolidation:** `chats-ai.md` = tag RULES, `TAG_CLASSIFICATION.md` = tag IMPLEMENTATION. Archive CHAT_STATUS_AND_TAGGING_SYSTEM.

---

#### F3: Auto-Generation Rules (6 criteria for complaint generation)

**Appears in 3 files:**

| # | File | Section |
|---|---|---|
| 1 | complaints.md | Критерии генерации |
| 2 | complaint-auto-generation-rules.md | Entire document |
| 3 | auto-complaints.md | 6 Business Rules |

**Problem:** Identical 6 rules copy-pasted in 3 locations. Risk of divergence during updates.

**Recommended consolidation:** Merge `complaint-auto-generation-rules.md` into `auto-complaints.md`. In `complaints.md`, link to auto-complaints section.

---

### 3.2 MEDIUM Severity — Same knowledge in 2-3 files

| ID | Domain | Files | Problem |
|---|---|---|---|
| F4 | Completion Reasons (11 types) | TELEGRAM_MINI_APPS_RULES, chats-ai.md | Slight wording differences |
| F5 | PM2 Processes (4 processes) | DEPLOYMENT.md, QUICK_REFERENCE.md | Exact duplicate table |
| F6 | CRON Schedule | CRON_JOBS.md, QUICK_REFERENCE.md | Exact duplicate table |
| F7 | Environment Variables | DEPLOYMENT.md, DEVELOPMENT.md | Same vars listed twice |
| F8 | Extension API | EXTENSION_API_COMPLETE.md, API_SPEC_FOR_EXTENSION_STATUS_CHECKER.md | Redundant endpoint description |
| F9 | CRON Development Rules | CRON_JOBS.md, _rules/CRON_POLICY.md | Same examples, same structure |
| F10 | OZON Architecture | ozon-work-policy.md, ozon-chats.md | Overlapping sync strategy description |
| F11 | Communication Policy | sprint-004/CHAT_COMMUNICATION_POLICY.md, _rules/CHAT_COMMUNICATION_POLICY.md | Same topic, different contexts |
| F12 | Kanban Board | KANBAN_QUICK_START.md, KANBAN_BOARD_IMPLEMENTATION.md | Quick-start vs implementation record |

### 3.3 LOW Severity — Acceptable Reference Duplication

| ID | Domain | Files | Why Acceptable |
|---|---|---|---|
| F13 | Status ENUMs | database-schema.md, statuses-reference.md | Both read-only references, different audiences |
| F14 | Review resolution conditions | review-chat-links.md, auto-sequences.md | Both reference same function, different contexts |

---

## 4. Canonical Document Design

### 4.1 Design Principles

1. **One domain = one canonical document** (Source of Truth)
2. **Reference, don't repeat** — link to SoT instead of copy-pasting
3. **Separate rules from implementation** — business rules vs code architecture
4. **Minimize total count** — fewer high-quality docs > many fragments

### 4.2 Proposed Canonical Documents (14 total)

The system can be fully described by **14 canonical documents** organized in 3 tiers:

#### Tier 1: FOUNDATIONAL (6 documents — core business logic)

| # | Title | Purpose | Scope | Source Documents |
|---|---|---|---|---|
| **C1** | **complaints.md** | Complaint system rules | WB complaint lifecycle, two-table design, Extension pipeline, OZON exclusion | complaints.md (keep), auto-complaints.md (link), complaint-auto-generation-rules.md (merge into auto-complaints) |
| **C2** | **auto-complaints.md** | Complaint generation engine | Hybrid architecture, triggers, 6 rules, monitoring | auto-complaints.md (keep), complaint-auto-generation-rules.md (absorb), complaints-table-schema.md (link) |
| **C3** | **chats-ai.md** | Chat operations & AI | Statuses, tags, AI flows, compensation, marketplace differences, sequences overview | chats-ai.md (keep, split if needed) |
| **C4** | **auto-sequences.md** | Sequence automation | 4 types, cron processor, stop conditions, send timing | auto-sequences.md (keep) |
| **C5** | **review-chat-links.md** | Review-chat binding | 1:1 invariant, creation sources, TG filtering, resolution detection | review-chat-links.md (keep) |
| **C6** | **communication-policy.md** | Operational standards | Templates, compensation rules, funnel, risk handling, metrics | sprint-004/CHAT_COMMUNICATION_POLICY.md (move after validation) |

#### Tier 2: PLATFORM (5 documents — integrations & infrastructure)

| # | Title | Purpose | Scope | Source Documents |
|---|---|---|---|---|
| **C7** | **telegram-mini-app.md** | TG Mini App system | Bot, auth, queue, notifications, design | telegram-mini-app.md (keep) |
| **C8** | **auth-and-roles.md** | Auth & access control | JWT, roles, invites, middleware | auth-and-roles.md (keep) |
| **C9** | **google-sheets-sync.md** | Google Sheets integration | 2 sync services, debounce, onboarding | google-sheets-sync.md (keep) |
| **C10** | **audit-trail.md** | Status change logging | chat_status_history, updateChatWithAudit, 7 sources | audit-trail.md (keep) |
| **C11** | **marketplace-policies.md** | WB + OZON rules | Legal constraints, API differences, sync strategies | wb-work-policy.md + ozon-work-policy.md + ozon-chats.md (consider consolidation) |

#### Tier 3: REFERENCE (3 documents — technical specifications)

| # | Title | Purpose | Scope | Source Documents |
|---|---|---|---|---|
| **C12** | **database-schema.md** | Database SoT | All tables, ENUMs, indexes, migrations | database-schema.md (keep) |
| **C13** | **statuses-reference.md** | Status quick-lookup | All status values, lifecycles, transitions | statuses-reference.md (keep) |
| **C14** | **api.md** | API reference | All REST endpoints | api.md (keep) + EXTENSION_API_COMPLETE.md (link) |

### 4.3 Documents NOT in Canonical Set (by design)

These remain as supporting documents, NOT Sources of Truth:

| Category | Documents | Reason |
|---|---|---|
| **Operational Guides** | DEPLOYMENT, CRON_JOBS, DEVELOPMENT, QUICK_REFERENCE, TROUBLESHOOTING | How-to guides, not system rules |
| **UI Guides** | MESSENGER_VIEW_GUIDE, FILTERS_SYSTEM, KANBAN_QUICK_START | UI workflow documentation |
| **Design System** | UI_DESIGN_SYSTEM, COMPONENT_LIBRARY | Design tokens and component rules |
| **ADRs** | ADR-001, ADR-002, ADR-003 | Historical decisions (immutable records) |
| **Sprint Docs** | Sprint READMEs, tasks | Ephemeral project management |
| **Planning** | AI_AGENT_REFACTOR_PLAN, ARCH_REVIEW_TMA, etc. | Future plans (not yet decisions) |

---

## 5. Proposed Documentation Architecture

### 5.1 Target Folder Structure

```
docs/
├── README.md                          # Navigation index (START HERE)
│
├── domains/                           # CANONICAL: Business logic (Source of Truth)
│   ├── complaints.md                  #   C1: Complaint system
│   ├── auto-complaints.md             #   C2: Auto-generation engine
│   ├── chats-ai.md                    #   C3: Chat operations & AI
│   ├── auto-sequences.md              #   C4: Sequence automation
│   ├── review-chat-links.md           #   C5: Review-chat binding
│   ├── communication-policy.md        #   C6: Operational standards (from sprint-004)
│   ├── telegram-mini-app.md           #   C7: TG Mini App system
│   ├── auth-and-roles.md              #   C8: Auth & access control
│   ├── google-sheets-sync.md          #   C9: Google Sheets sync
│   ├── audit-trail.md                 #   C10: Status change logging
│   ├── wb-work-policy.md              #   C11a: WB legal constraints
│   ├── ozon-work-policy.md            #   C11b: OZON legal constraints
│   ├── ozon-chats.md                  #   C11c: OZON sync architecture
│   ├── complaints-table-schema.md     #   Schema detail (linked from C1)
│   ├── TAG_CLASSIFICATION.md          #   Regex implementation (linked from C3)
│   └── DELETION_TRIGGER_PHRASES.md    #   Pattern library (linked from C3)
│
├── reference/                         # Technical specifications
│   ├── ARCHITECTURE.md                #   System layers, data flows
│   ├── api.md                         #   REST endpoint reference
│   ├── EXTENSION_API_COMPLETE.md      #   Chrome Extension API
│   └── statuses-reference.md          #   All status ENUMs
│
├── guides/                            # Operational & UI guides
│   ├── DEPLOYMENT.md                  #   Deploy, rollback, SSL
│   ├── CRON_JOBS.md                   #   Cron schedules, idempotency
│   ├── DEVELOPMENT.md                 #   Local setup, coding rules
│   ├── QUICK_REFERENCE.md             #   Cheat sheet (no duplicates!)
│   ├── TROUBLESHOOTING.md             #   Problem → diagnosis → solution
│   ├── MESSENGER_VIEW_GUIDE.md        #   Chat UI workflow
│   ├── FILTERS_SYSTEM.md              #   Filter UI, debounce
│   ├── KANBAN_QUICK_START.md          #   Kanban usage
│   ├── UI_DESIGN_SYSTEM.md            #   Design tokens
│   └── COMPONENT_LIBRARY.md           #   Component decision rules
│
├── _rules/                            # Governance policies
│   ├── DB_POLICY.md                   #   Database change rules
│   ├── CHAT_COMMUNICATION_POLICY.md   #   Communication standards
│   └── DOCS_UPDATE_POLICY.md          #   Documentation update rules
│
├── plans/                             # NEW: Active planning documents
│   ├── AI_AGENT_REFACTOR_PLAN.md      #   AI system redesign
│   ├── AI_AGENT_REFACTOR_BACKLOG.md   #   18-PR implementation spec
│   ├── AI_AGENT_ARCH_REVIEW.md        #   AI architecture audit
│   ├── TMA_BFF_MIGRATION_PLAN.md      #   TMA → BFF refactor
│   ├── TMA_REFACTOR_BACKLOG.md        #   15-PR implementation spec
│   ├── TMA_ARCH_REVIEW.md             #   TMA architecture options
│   └── AI_AUTONOMY_ROADMAP.md         #   3-stage AI autonomy vision
│
├── decisions/                         # ADRs ONLY (accepted decisions)
│   ├── ADR-001-why-instrumentation-hook.md
│   ├── ADR-002-active-stores-filter.md
│   └── ADR-003-cron-intervals.md
│
├── product-specs/                     # Feature specifications
│   ├── CHATS_FEATURE_SPEC.md          #   Chat feature (add deprecation notes)
│   ├── CHATS_UI_UX_PROTOTYPES.md      #   UI wireframes
│   ├── KANBAN_BOARD_IMPLEMENTATION.md  #   Kanban MVP milestone
│   ├── OZON/OZON-SELLER-API.md        #   OZON API research
│   └── TASK_MANAGEMENT_CENTER.md      #   Task management MVP
│
├── sprints/                           # Sprint artifacts (ephemeral)
│   ├── SPRINT-001-OZON-FOUNDATION.md
│   ├── sprint-002-review-chat-linking/
│   ├── sprint-003-cabinet-dashboard/
│   ├── sprint-004-communication-policy/
│   └── Sprint-005/
│
├── tasks/                             # Task files
│   ├── Completed/
│   └── TASK-*.md
│
├── reports/                           # Audit reports
│   ├── TASK-004-complaints-audit-report.md
│   └── TASK-005-documentation-report.md
│
└── archive/                           # Historical (DO NOT use as reference)
    ├── CHAT_STATUS_AND_TAGGING_SYSTEM.md
    ├── CHATS_CURRENT_STATE_ANALYSIS.md
    ├── CHATS_IMPLEMENTATION_ROADMAP.md
    ├── COMPLAINTS_SYSTEM_INTEGRATION.md
    ├── AB_TESTING_COMPLAINT_TEMPLATES.md
    ├── STAGE_3_DELETION_AGENT_GUIDE.md  (after rewrite)
    ├── AUDIT_TELEGRAM_MINI_APPS.md
    ├── AUDIT_FINDINGS_SUMMARY.md
    ├── EXTENSION_TEAM_STORES_UPDATE.md
    ├── CRON_POLICY.md  (merged into CRON_JOBS)
    └── (existing archive contents)
```

### 5.2 Key Design Decisions

| Decision | Rationale |
|---|---|
| `domains/` is the canonical folder | Business logic = most important knowledge. All canonical docs live here. |
| NEW `guides/` folder | Separates operational how-to from authoritative business rules |
| NEW `plans/` folder | Planning ≠ decisions. Plans are mutable; ADRs are immutable. |
| `decisions/` = ADRs ONLY | Currently mixed with 7 planning docs. Clean separation needed. |
| `_rules/` stays small (3 files) | CRON_POLICY merged into CRON_JOBS; only meta-policies remain |
| `product-specs/` for feature specs | Implementation records, wireframes, roadmaps (non-canonical) |

---

## 6. Migration Plan

### 6.1 Phase 1 — Merge & Consolidate (no file moves)

| Original | Action | Target | Notes |
|---|---|---|---|
| `complaint-auto-generation-rules.md` | **MERGE** | `auto-complaints.md` | Absorb 6 rules + operational params |
| `_rules/CRON_POLICY.md` | **MERGE** | `CRON_JOBS.md` (new section) | Move policy into "Development Standards" section |
| `API_SPEC_FOR_EXTENSION_STATUS_CHECKER.md` | **MERGE** | `EXTENSION_API_COMPLETE.md` | Absorb endpoint details |
| `QUICK_REFERENCE.md` | **TRIM** | self | Replace duplicate tables with links |

### 6.2 Phase 2 — Archive Obsolete

| Original | Action | Target |
|---|---|---|
| `product-specs/CHAT_STATUS_AND_TAGGING_SYSTEM.md` | **ARCHIVE** | `archive/` + deprecation notice |
| `product-specs/CHATS_CURRENT_STATE_ANALYSIS.md` | **ARCHIVE** | `archive/` |
| `product-specs/CHATS_IMPLEMENTATION_ROADMAP.md` | **ARCHIVE** | `archive/` |
| `domains/COMPLAINTS_SYSTEM_INTEGRATION.md` | **ARCHIVE** | `archive/` (unclear implementation status) |
| `domains/AB_TESTING_COMPLAINT_TEMPLATES.md` | **ARCHIVE** | `archive/` (test likely completed) |
| `EXTENSION_TEAM_STORES_UPDATE.md` | **ARCHIVE** | `archive/` |
| `AUDIT_FINDINGS_SUMMARY.md` | **ARCHIVE** | `archive/` (audit artifact) |
| `AUDIT_TELEGRAM_MINI_APPS.md` | **ARCHIVE** | `archive/` (audit artifact) |

### 6.3 Phase 3 — Reorganize (file moves)

| Original | Action | Target |
|---|---|---|
| `decisions/AI_AGENT_ARCH_REVIEW.md` | **MOVE** | `plans/AI_AGENT_ARCH_REVIEW.md` |
| `decisions/AI_AGENT_REFACTOR_PLAN.md` | **MOVE** | `plans/AI_AGENT_REFACTOR_PLAN.md` |
| `decisions/BACKLOG_AI_AGENT_REFACTOR.md` | **MOVE** | `plans/AI_AGENT_REFACTOR_BACKLOG.md` |
| `decisions/ARCH_REVIEW_TMA.md` | **MOVE** | `plans/TMA_ARCH_REVIEW.md` |
| `decisions/REFACTOR_PLAN_TMA_BFF.md` | **MOVE** | `plans/TMA_BFF_MIGRATION_PLAN.md` |
| `decisions/BACKLOG_REFACTOR_TMA.md` | **MOVE** | `plans/TMA_REFACTOR_BACKLOG.md` |
| `decisions/golden-test-chats.md` | **MOVE** | `plans/golden-test-chats.md` (or tests/) |
| `product-specs/AI_AUTONOMY_ROADMAP.md` | **MOVE** | `plans/AI_AUTONOMY_ROADMAP.md` |
| `TASK_MANAGEMENT_CENTER.md` | **MOVE** | `product-specs/TASK_MANAGEMENT_CENTER.md` |

### 6.4 Phase 4 — Promote Communication Policy

| Original | Action | Target | Condition |
|---|---|---|---|
| `sprints/sprint-004/.../CHAT_COMMUNICATION_POLICY.md` | **COPY → PROMOTE** | `domains/communication-policy.md` | After owner validation |

### 6.5 Phase 5 — Create `guides/` (optional, lower priority)

| Original | Action | Target |
|---|---|---|
| `DEPLOYMENT.md` | **MOVE** | `guides/DEPLOYMENT.md` |
| `CRON_JOBS.md` | **MOVE** | `guides/CRON_JOBS.md` |
| `DEVELOPMENT.md` | **MOVE** | `guides/DEVELOPMENT.md` |
| `QUICK_REFERENCE.md` | **MOVE** | `guides/QUICK_REFERENCE.md` |
| `TROUBLESHOOTING.md` | **MOVE** | `guides/TROUBLESHOOTING.md` |
| `MESSENGER_VIEW_GUIDE.md` | **MOVE** | `guides/MESSENGER_VIEW_GUIDE.md` |
| `FILTERS_SYSTEM.md` | **MOVE** | `guides/FILTERS_SYSTEM.md` |
| `KANBAN_QUICK_START.md` | **MOVE** | `guides/KANBAN_QUICK_START.md` |
| `UI_DESIGN_SYSTEM.md` | **MOVE** | `guides/UI_DESIGN_SYSTEM.md` |
| `COMPONENT_LIBRARY.md` | **MOVE** | `guides/COMPONENT_LIBRARY.md` |

**Note:** Phase 5 is OPTIONAL. The current flat structure in `docs/` root works. The `guides/` folder adds clarity but requires updating cross-references in 20+ files.

### 6.6 Summary Counts

| Action | Count |
|---|---|
| MERGE | 3 (files absorbed into existing docs) |
| ARCHIVE | 8 (obsolete/completed artifacts) |
| MOVE | 9-19 (reorganize to correct folders) |
| TRIM | 1 (QUICK_REFERENCE deduplication) |
| PROMOTE | 1 (communication-policy after validation) |
| KEEP AS-IS | ~60 (no changes needed) |

---

## 7. Foundational Documentation Standards

### 7.1 Required Structure for Every Canonical Document

Every foundational document (C1-C14) MUST contain:

```markdown
# [Domain Name]

**Last Updated:** YYYY-MM-DD
**Status:** Current | Draft | Deprecated
**Source of Truth:** This document
**Migrations:** [relevant migration numbers]

---

## Overview
[1-3 sentences: what this domain is and why it matters]

## Business Rules
[Non-negotiable constraints. Must be respected by all code.]

## System Behavior
[How the system implements these rules. Tables, flows, conditions.]

## API / Interface
[Endpoints, functions, or entry points for this domain]

## Constraints & Edge Cases
[What can go wrong. What is forbidden. What is NOT supported.]

## Dependencies
[Which other domains this one depends on or affects]

## Key Files
[Source code locations for implementation]

## See Also
[Links to related canonical documents]

---

**Last Updated:** YYYY-MM-DD
```

### 7.2 Cross-Reference Rules

1. **NEVER copy-paste** status/tag/enum definitions. ALWAYS link to Source of Truth.
2. **Each topic has exactly ONE canonical document.** Other documents may REFERENCE it.
3. **If two documents define the same thing differently**, the canonical document wins.
4. **UI guides** (MESSENGER_VIEW, FILTERS, KANBAN) should reference `chats-ai.md` for business rules.

### 7.3 Source of Truth Matrix

| Concept | Source of Truth | Referenced By |
|---|---|---|
| Chat Statuses (4 values) | `chats-ai.md` | MESSENGER_VIEW, FILTERS, KANBAN, TELEGRAM_RULES, statuses-reference |
| Chat Tags (4 + NULL) | `chats-ai.md` | TAG_CLASSIFICATION, MESSENGER_VIEW, FILTERS, KANBAN |
| Completion Reasons (11) | `chats-ai.md` | TELEGRAM_MINI_APPS_RULES |
| Complaint Lifecycle | `complaints.md` | auto-complaints, complaints-table-schema |
| Auto-Generation Rules (6) | `auto-complaints.md` | complaints.md (link only) |
| Sequence Types (4) | `auto-sequences.md` | chats-ai.md (overview only) |
| Review-Chat Invariant | `review-chat-links.md` | telegram-mini-app.md, auto-sequences.md |
| DB Schema | `database-schema.md` | All domain docs |
| API Endpoints | `api.md` | All integration docs |
| Status ENUMs | `statuses-reference.md` | database-schema.md (acceptable duplication) |
| PM2 Processes | `QUICK_REFERENCE.md` | DEPLOYMENT.md (link only) |
| CRON Schedules | `CRON_JOBS.md` | QUICK_REFERENCE.md (summary only) |
| WB Rules | `wb-work-policy.md` | All WB-related domain docs |
| OZON Rules | `ozon-work-policy.md` | All OZON-related domain docs |

### 7.4 Naming Conventions

| Document Type | Convention | Example |
|---|---|---|
| Canonical domain doc | `kebab-case.md` | `auto-sequences.md` |
| Governance/policy | `UPPERCASE.md` | `DB_POLICY.md` |
| ADR | `ADR-NNN-short-name.md` | `ADR-001-why-instrumentation-hook.md` |
| Task | `TASK-YYYYMMDD-name.md` | `TASK-20260306-rcl-fix.md` |
| Reference | `UPPERCASE.md` or `kebab-case.md` | `api.md`, `ARCHITECTURE.md` |

### 7.5 Document Lifecycle

```
Draft → Review → Current → Deprecated → Archived

Draft:       New document, not yet validated
Review:      Under owner/team review
Current:     Active Source of Truth
Deprecated:  Superseded but still accessible
Archived:    Moved to docs/archive/ (historical only)
```

### 7.6 Update Triggers

A canonical document MUST be updated when:

| Change | Update Required |
|---|---|
| DB migration adds/modifies tables | `database-schema.md` + relevant domain doc |
| API endpoint added/changed | `api.md` + relevant domain doc |
| CRON job added/changed | `CRON_JOBS.md` |
| Business rule changed | Relevant `domains/*.md` |
| AI prompt/flow changed | `chats-ai.md` |
| New marketplace constraint | `wb-work-policy.md` or `ozon-work-policy.md` |
| Status/tag ENUM changed | `statuses-reference.md` + `chats-ai.md` |

---

## Summary

### Current State

- **90+ active files** across 10 directories
- **14 canonical topics** identified but scattered across 60+ documents
- **3 HIGH-severity fragmentations** (statuses in 7 files, tags in 6, generation rules in 3)
- **8 obsolete documents** still in active directories
- **7 planning docs** misclassified as decisions
- **3 merge opportunities** to eliminate redundancy

### Target State

- **14 canonical documents** in `domains/` (Sources of Truth)
- **4 reference documents** in `reference/`
- **10 operational guides** in `guides/` (or root)
- **3 policies** in `_rules/`
- **3 ADRs** in `decisions/` (only true decisions)
- **7 planning docs** in `plans/` (new directory)
- **Archived obsolete content** in `archive/`

### Key Metric

**Before:** To understand "how chat statuses work", read 7 documents.
**After:** Read `chats-ai.md` (Source of Truth). Everything else links to it.

---

*This report is read-only analysis. No files were modified, deleted, or created (except this report).*

**Date:** 2026-03-06
