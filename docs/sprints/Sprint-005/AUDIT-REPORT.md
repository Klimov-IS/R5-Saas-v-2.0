# R5 Documentation Audit Report

**Date:** 2026-03-06
**Sprint:** 005 вЂ” Documentation Refactor
**Status:** Phase 1 вЂ” Audit Complete (read-only, no changes made)

---

## Executive Summary

Discovered **120+ documentation files** across 8 locations in the repository. Analysis reveals:

- **17 current/active** documents (Source of Truth)
- **22 outdated** documents requiring update or archival
- **12 duplicated** knowledge areas
- **9 missing** critical documents
- **3 competing** documentation hierarchies (`docs/`, `product-management/`, root-level)
- **1 critical** production issue: hardcoded stale IP in 5+ files

---

## PHASE 1 вЂ” Documentation Inventory

### Total: 120+ files across 8 locations

| Location | Files | Status |
|----------|-------|--------|
| `docs/` (root-level) | 10 | Mixed (6 outdated, 4 current) |
| `docs/domains/` | 17 | Mostly current (3 deprecated) |
| `docs/reference/` | 6 | Mixed (3 current, 2 duplicated, 1 obsolete) |
| `docs/decisions/` | 10 | Current (3 ADRs historical, 7 draft/planning) |
| `docs/product-specs/` | 8 | Mostly current (1 partially superseded) |
| `docs/sprints/` | 21 | Current (4 sprints active) |
| `docs/tasks/` | 27 | Mixed (11 completed, 16 active/pending) |
| `docs/_rules/` | 3 | Current (governance backbone) |
| `docs/reports/` | 2 | Current |
| `docs/product/` | 2 | Current |
| `docs/archive/` | 18 | Archived (correct location) |
| `product-management/` | 18 | **ALL OUTDATED** (Firebase references) |
| `archive/` (root) | 15 | Archived (correct location) |
| `prototypes/` | 3 | Mixed (1 outdated, 1 evergreen, 1 current) |
| Root-level `.md` | 6 | Mixed (3 outdated, 1 current, 2 archive candidates) |
| `analysis-output/` | 18 | Data files (JSON/JSONL, not docs) |
| Prototype HTML | 5 | Design prototypes (TG v5/v6, cabinet, dashboard) |
| AI prompts (`src/ai/prompts/`) | 4 | Code files (not documentation) |

---

### Full Inventory: `docs/` root-level (10 files)

| File | Type | Topic | Status | Issues |
|------|------|-------|--------|--------|
| `TROUBLESHOOTING.md` | Ops guide | DB diagnostics | OUTDATED | Stale IP `158.160.217.236`, missing PM2 4-process structure |
| `QUICK_REFERENCE.md` | Ops cheat sheet | Server access | OUTDATED | **CRITICAL:** stale IP, single PM2 process listed (now 4) |
| `DEVELOPMENT.md` | Dev guide | Local setup | PARTIAL | Generic; missing env vars list, migration/seed instructions |
| `UI_DESIGN_SYSTEM.md` | Design | Visual tokens | PARTIAL | Missing TG Mini App design (inline styles, V5), Cabinet |
| `COMPONENT_LIBRARY.md` | Design | Shadcn/ui usage | PARTIAL | Generic; no project-specific component inventory |
| `MESSENGER_VIEW_GUIDE.md` | Feature guide | Chat UI | OUTDATED | **CRITICAL:** documents old 4-tag system + "resolved" status |
| `FILTERS_SYSTEM.md` | Feature guide | Chat filters | OUTDATED | Lists "resolved" status; missing tag/marketplace filters |
| `KANBAN_QUICK_START.md` | Feature guide | Kanban board | OUTDATED | References migration 003; no audit trail mention |
| `EXTENSION_TEAM_STORES_UPDATE.md` | Changelog | Extension API | CURRENT | Narrow scope (draftComplaintsCount field) |
| `API_SPEC_FOR_EXTENSION_STATUS_CHECKER.md` | API spec | Complaint checker | CURRENT | No OZON exclusion note |
| `database-schema.md` | Schema ref | **DB Source of Truth** | **CURRENT (2026-03-06)** | Includes migration 027, chat_status_history |
| `CRON_JOBS.md` | Ops guide | Cron schedules | **CURRENT (2026-03-06)** | Includes OZON sync, all cron types |
| `TASK_MANAGEMENT_CENTER.md` | Feature doc | Task management | CURRENT (v1.0) | MVP documented |

### Full Inventory: `docs/domains/` (17 files)

| File | Type | Topic | Status | Issues |
|------|------|-------|--------|--------|
| `complaints.md` | Domain doc | Complaints | **CURRENT (v2.0)** | **SOURCE OF TRUTH** вЂ” comprehensive |
| `complaints-table-schema.md` | Schema ref | Complaints DB | CURRENT | Technical reference, accurate |
| `complaint-auto-generation-rules.md` | Rules | Auto-complaints | CURRENT | 6 criteria, cron schedule, budget limits |
| `AUTO_COMPLAINT_STRATEGY.md` | Strategy | Auto-complaints | HISTORICAL | Gap analysis from 2026-01-20 |
| `AUTO_COMPLAINT_TRIGGERS.md` | Rules | Event triggers | PARTIAL | Triggers 2-4 still awaiting endpoint creation |
| `AUTO_COMPLAINT_IMPLEMENTATION_SUMMARY.md` | Summary | Implementation | PARTIAL | Claims complete but 0.2% coverage (252K backlog) |
| `AB_TESTING_COMPLAINT_TEMPLATES.md` | Design | A/B templates | COMPLETED | 4 variants, hash distribution |
| `COMPLAINTS_SYSTEM_INTEGRATION.md` | Architecture | System integration | CURRENT | End-to-end flow |
| `DELETION_TRIGGER_PHRASES.md` | Reference | Regex patterns | **CURRENT** | 58+ patterns powering `tag-classifier.ts` |
| `STAGE_3_DELETION_AGENT_GUIDE.md` | Guide | AI deletion offers | COMPLETE | Outdated 4в… compensation logic (40% в†’ 0%) |
| `STAGE_2_AI_CLASSIFICATION_GUIDE.md` | Guide | AI classification | **DEPRECATED** | Replaced by regex (migration 024) |
| `TESTING_GUIDE_DELETION_WORKFLOW.md` | Guide | Testing | OUTDATED | Hardcoded old migration paths |
| `TAG_CLASSIFICATION.md` | Domain doc | Tag system | **AUTHORITATIVE** | Current 4-tag system, 2026-03-06 |
| `ozon-chats.md` | Domain doc | OZON chats | CURRENT | Seller-initiated only (481 vs 316K) |
| `ozon-work-policy.md` | Policy | OZON rules | **BINDING (v1.0)** | Mandatory for all OZON code |
| `wb-work-policy.md` | Policy | WB rules | **BINDING (v1.0)** | Mandatory for all WB code |
| `chats-ai.md` | Domain doc | AI in chats | **CURRENT (v3.5)** | 1200+ lines, comprehensive |

### Full Inventory: `docs/reference/` (6 files)

| File | Type | Topic | Status | Issues |
|------|------|-------|--------|--------|
| `ARCHITECTURE.md` | Architecture | System overview | CURRENT (2026-02-08) | High-level, Production |
| `api.md` | API ref | Endpoints | OUTDATED | **Stale IP**; Swagger reference may not exist |
| `statuses-reference.md` | Reference | All statuses | **CURRENT (2026-03-03)** | Source of Truth for enums |
| `CHROME_EXTENSION_INTEGRATION.md` | Integration | Extension | **OBSOLETE** | Says "In Development" but is in production |
| `EXTENSION_API_DOCUMENTATION.md` | API ref | Extension API | CURRENT but DUPLICATE | v2.1.0, same as COMPLETE |
| `EXTENSION_API_COMPLETE.md` | API ref | Extension API | CURRENT but DUPLICATE | v2.1.0, same as DOCUMENTATION |

### Full Inventory: `docs/decisions/` (10 files)

| File | Type | Topic | Status | Issues |
|------|------|-------|--------|--------|
| `ADR-001-why-instrumentation-hook.md` | ADR | CRON auto-start | VALID (2026-01-14) | Historical, still implemented |
| `ADR-002-active-stores-filter.md` | ADR | Active stores | VALID (2026-01-14) | Historical, still implemented |
| `ADR-003-cron-intervals.md` | ADR | CRON timing | CHECK DRIFT | Doc says 8AM MSK, actual may be 6AM |
| `ARCH_REVIEW_TMA.md` | Analysis | TMA architecture | CURRENT (2026-03-05) | Complete analysis, awaiting decision |
| `REFACTOR_PLAN_TMA_BFF.md` | Plan | TMA refactor | DRAFT (2026-03-05) | 13-16 dev-days, blocked on ARCH_REVIEW |
| `BACKLOG_REFACTOR_TMA.md` | Backlog | TMA 15 PRs | DRAFT (2026-03-05) | Blocked on REFACTOR_PLAN |
| `golden-test-chats.md` | Template | Regression testing | TEMPLATE | Not yet populated |
| `AI_AGENT_ARCH_REVIEW.md` | Analysis | AI quality | CURRENT (2026-03-05) | 6 root causes identified |
| `AI_AGENT_REFACTOR_PLAN.md` | Plan | AI refactor | DRAFT (2026-03-05) | Blocked on ARCH_REVIEW |
| `BACKLOG_AI_AGENT_REFACTOR.md` | Backlog | AI 18 PRs | DRAFT (2026-03-05) | Blocked on REFACTOR_PLAN |

### Full Inventory: `docs/product-specs/` (8 files)

| File | Type | Topic | Status |
|------|------|-------|--------|
| `README.md` | Index | Navigation | CURRENT |
| `CHATS_CURRENT_STATE_ANALYSIS.md` | Analysis | Chat system | CURRENT (baseline) |
| `CHATS_UI_UX_PROTOTYPES.md` | Design | Chat UI | CURRENT |
| `CHATS_FEATURE_SPEC.md` | Spec | Chat features | CURRENT |
| `CHATS_IMPLEMENTATION_ROADMAP.md` | Roadmap | Chat implementation | CURRENT |
| `CHAT_STATUS_AND_TAGGING_SYSTEM.md` | Analysis | Tags gap analysis | PARTIALLY SUPERSEDED |
| `KANBAN_BOARD_IMPLEMENTATION.md` | Spec | Kanban | COMPLETED but outdated refs |
| `OZON/OZON-SELLER-API.md` | API ref | OZON API | **CURRENT** (2026-02-12) |

### Full Inventory: `docs/sprints/` (4 sprints, 21 files)

| Sprint | Files | Status |
|--------|-------|--------|
| Sprint 001 (OZON) | 1 (README) | Code-complete |
| Sprint 002 (Review-Chat Linking) | 4 (README, PRODUCT_SPEC, TASK, EXTENSION_GUIDE) | Active |
| Sprint 003 (Cabinet Dashboard) | 11 (README, SPEC, TASK-001..010) | Phase 1 active |
| Sprint 004 (Communication Policy) | 3 (README, РўР—, CHAT_POLICY) | Draft v1.0 |
| Sprint 005 (Docs Audit) | 2 (TASK-docs, this report) | In progress |

### Full Inventory: Root-level (6 `.md` files)

| File | Type | Status | Action |
|------|------|--------|--------|
| `README.md` | Project intro | OUTDATED | Fix IP |
| `QUICK_REFERENCE.md` | Ops cheat sheet | OUTDATED | Duplicate of `docs/QUICK_REFERENCE.md` |
| `DEPLOYMENT.md` | Deploy guide | CURRENT | Fix IP (line 7 only) |
| `IMPLEMENTATION_SUMMARY.md` | Feature log | OUTDATED | Archive |
| `EXTENSION_API_DEPLOYMENT.md` | Deploy guide | OUTDATED | Archive |
| `DEPLOYMENT_SUCCESS_2026-01-28.md` | Status report | OUTDATED | Archive |

### Full Inventory: `product-management/` (18 files)

| File | Type | Status | Critical Issue |
|------|------|--------|----------------|
| `README.md` | Index | **OUTDATED** | References Firebase |
| `ROADMAP.md` | Strategy | **OUTDATED** | Q4 2024, Firebase |
| `INDEX.md` | Navigation | **OUTDATED** | EPICs list stale |
| `epics/EPIC-001..018.md` | Epic specs | **OUTDATED** | Firebase-era planning |
| `user-stories/US-001.md` | User story | **OUTDATED** | Firebase-era |
| `sprints/sprint-01/planning.md` | Sprint plan | **OUTDATED** | Firebase-era |
| `migrations/MIGRATION-001-*` | Migration plan | **OUTDATED** | Supabaseв†’Yandex (completed) |

**Verdict:** Entire `product-management/` directory references Firebase architecture (replaced 2026-02-11). Archive entirely.

### Governance & Reports

| File | Type | Status |
|------|------|--------|
| `docs/_rules/DOCS_UPDATE_POLICY.md` | Governance | **CURRENT** вЂ” core policy |
| `docs/_rules/DB_POLICY.md` | Governance | **CURRENT** вЂ” core policy |
| `docs/_rules/CRON_POLICY.md` | Governance | **CURRENT** вЂ” core policy |
| `docs/reports/TASK-004-complaints-audit-report.md` | Audit | CURRENT |
| `docs/reports/TASK-005-documentation-report.md` | Audit | CURRENT |
| `docs/product/cabinets.md` | UI/UX spec | CURRENT (2026-02-08) |
| `docs/product/client-tabs.md` | UI/UX spec | CURRENT (2026-02-08) |

---

## PHASE 2 вЂ” Knowledge Map

### Topic в†’ Documents Mapping

#### 1. ARCHITECTURE & SYSTEM
| Document | Role | Status |
|----------|------|--------|
| `docs/reference/ARCHITECTURE.md` | System overview | CURRENT |
| `.claude/claude.md` | Governance + structure | CURRENT |
| `docs/_rules/*.md` (3 files) | Policies | CURRENT |

#### 2. COMPLAINTS
| Document | Role | Status |
|----------|------|--------|
| `docs/domains/complaints.md` | **Source of Truth** | CURRENT v2.0 |
| `docs/domains/complaints-table-schema.md` | DB schema | CURRENT |
| `docs/domains/complaint-auto-generation-rules.md` | Auto-gen rules | CURRENT |
| `docs/domains/COMPLAINTS_SYSTEM_INTEGRATION.md` | Integration flow | CURRENT |
| `docs/domains/AUTO_COMPLAINT_STRATEGY.md` | Strategy context | HISTORICAL |
| `docs/domains/AUTO_COMPLAINT_TRIGGERS.md` | Event triggers | PARTIAL |
| `docs/domains/AUTO_COMPLAINT_IMPLEMENTATION_SUMMARY.md` | Implementation | PARTIAL |
| `docs/domains/AB_TESTING_COMPLAINT_TEMPLATES.md` | A/B testing | COMPLETED |

**Issue:** 8 files on one topic. 3 can be merged, 1 archived.

#### 3. CHAT & DELETION WORKFLOW
| Document | Role | Status |
|----------|------|--------|
| `docs/domains/chats-ai.md` | **Source of Truth** | CURRENT v3.5 |
| `docs/domains/TAG_CLASSIFICATION.md` | Tag system | AUTHORITATIVE |
| `docs/domains/DELETION_TRIGGER_PHRASES.md` | Regex patterns | CURRENT |
| `docs/domains/STAGE_3_DELETION_AGENT_GUIDE.md` | AI offers | COMPLETE |
| `docs/domains/STAGE_2_AI_CLASSIFICATION_GUIDE.md` | AI classification | **DEPRECATED** |
| `docs/domains/TESTING_GUIDE_DELETION_WORKFLOW.md` | Testing | **OUTDATED** |
| `docs/reference/statuses-reference.md` | Status enums | CURRENT |

**Issue:** STAGE_2 deprecated but still in active folder. TESTING_GUIDE references old migrations.

#### 4. MARKETPLACE POLICIES
| Document | Role | Status |
|----------|------|--------|
| `docs/domains/wb-work-policy.md` | WB rules | BINDING |
| `docs/domains/ozon-work-policy.md` | OZON rules | BINDING |
| `docs/domains/ozon-chats.md` | OZON chat details | CURRENT |
| `docs/product-specs/OZON/OZON-SELLER-API.md` | OZON API ref | CURRENT |

**Status:** Well-organized, no duplicates.

#### 5. CHROME EXTENSION
| Document | Role | Status |
|----------|------|--------|
| `docs/reference/EXTENSION_API_DOCUMENTATION.md` | API docs v2.1 | CURRENT |
| `docs/reference/EXTENSION_API_COMPLETE.md` | API docs v2.1 | **DUPLICATE** |
| `docs/reference/CHROME_EXTENSION_INTEGRATION.md` | Integration guide | **OBSOLETE** |
| `docs/API_SPEC_FOR_EXTENSION_STATUS_CHECKER.md` | Status checker | CURRENT |
| `docs/EXTENSION_TEAM_STORES_UPDATE.md` | Changelog | CURRENT |
| `docs/sprints/sprint-002-review-chat-linking/EXTENSION_INTEGRATION_GUIDE.md` | Sprint 002 | CURRENT |

**Issue:** 2 duplicate API docs, 1 obsolete integration guide.

#### 6. CHAT UI/UX
| Document | Role | Status |
|----------|------|--------|
| `docs/product-specs/CHATS_*.md` (4 files) | Chat system spec | CURRENT |
| `docs/MESSENGER_VIEW_GUIDE.md` | Messenger view | **OUTDATED** |
| `docs/FILTERS_SYSTEM.md` | Filter system | **OUTDATED** |
| `docs/KANBAN_QUICK_START.md` | Kanban guide | **OUTDATED** |
| `prototypes/MESSENGER_VIEW_DESIGN_SPEC.md` | Design tokens | CURRENT |

**Issue:** 3 operational guides outdated (wrong tags, "resolved" status).

#### 7. TELEGRAM MINI APP
| Document | Role | Status |
|----------|------|--------|
| `docs/decisions/ARCH_REVIEW_TMA.md` | Architecture review | CURRENT |
| `docs/decisions/REFACTOR_PLAN_TMA_BFF.md` | Refactor plan | DRAFT |
| `docs/decisions/BACKLOG_REFACTOR_TMA.md` | Backlog (15 PRs) | DRAFT |

**Issue:** No operational guide, no product spec, no design system section.

#### 8. AI SYSTEM
| Document | Role | Status |
|----------|------|--------|
| `docs/domains/chats-ai.md` | **Source of Truth** | CURRENT v3.5 |
| `docs/decisions/AI_AGENT_ARCH_REVIEW.md` | Quality analysis | CURRENT |
| `docs/decisions/AI_AGENT_REFACTOR_PLAN.md` | Refactor plan | DRAFT |
| `docs/decisions/BACKLOG_AI_AGENT_REFACTOR.md` | Backlog (18 PRs) | DRAFT |
| `src/ai/prompts/*.ts` (4 files) | Prompt templates | Code |

#### 9. OPERATIONS & DEPLOYMENT
| Document | Role | Status |
|----------|------|--------|
| `DEPLOYMENT.md` | Deploy guide | CURRENT (fix IP) |
| `docs/QUICK_REFERENCE.md` | Quick reference | **OUTDATED** |
| `QUICK_REFERENCE.md` (root) | Quick reference | **DUPLICATE** |
| `docs/TROUBLESHOOTING.md` | Diagnostics | **OUTDATED** |

**Issue:** 2 copies of QUICK_REFERENCE; both outdated.

---

### Duplications Found

| # | Duplication | Files | Recommendation |
|---|-------------|-------|----------------|
| 1 | Extension API docs | `EXTENSION_API_DOCUMENTATION.md` + `EXTENSION_API_COMPLETE.md` | Merge into single `EXTENSION_API.md` |
| 2 | Quick Reference | `docs/QUICK_REFERENCE.md` + root `QUICK_REFERENCE.md` | Keep one in `docs/`, delete root |
| 3 | Server access info | `QUICK_REFERENCE.md` + `TROUBLESHOOTING.md` | Consolidate PM2/SSH into one |
| 4 | Status/tag reference | `MESSENGER_VIEW_GUIDE.md` + `FILTERS_SYSTEM.md` + `KANBAN_QUICK_START.md` | All reference `statuses-reference.md` instead |
| 5 | Auto-complaint docs | 3 files (STRATEGY + TRIGGERS + IMPLEMENTATION_SUMMARY) | Merge into single "Auto-Complaint Architecture" |
| 6 | Golden test chats | `golden-test-chats.md` + `BACKLOG_AI_AGENT_REFACTOR.md` | Overlap by design (different scopes) вЂ” acceptable |
| 7 | IP address | 5+ files hardcode old IP | Single source in `DEPLOYMENT.md`, others reference it |

### Contradictions Found

| # | Contradiction | Files | Resolution |
|---|-------------|-------|------------|
| 1 | **Tag system:** old 4 tags vs new 4 tags | `MESSENGER_VIEW_GUIDE.md` says "РђРєС‚РёРІРЅС‹Рµ, РќРµС‚ РѕС‚РІРµС‚Р°..." vs `TAG_CLASSIFICATION.md` says "deletion_candidate, deletion_offered..." | `TAG_CLASSIFICATION.md` is authoritative (2026-03-06) |
| 2 | **Status "resolved"** | `FILTERS_SYSTEM.md`, `KANBAN_BOARD_IMPLEMENTATION.md` include "resolved" | Removed in migration 008. `statuses-reference.md` is authoritative |
| 3 | **4в… compensation:** 40% vs 0% | `STAGE_3_DELETION_AGENT_GUIDE.md` says 40% multiplier | Current rule: NO compensation for 4-5в…. `wb-work-policy.md` is authoritative |
| 4 | **Server IP** | 5+ files say `158.160.217.236` | Changed 2026-02-25 to `158.160.139.99` |
| 5 | **PM2 processes:** 1 vs 4 | `QUICK_REFERENCE.md` lists single process | Now 4: 2x cluster, 1x cron fork, 1x TG bot fork |
| 6 | **CRON schedule:** 8AM vs 6AM MSK | `ADR-003` says "8:00 AM MSK" | Actual `0 3 * * *` = 6AM MSK. Needs verification |
| 7 | **Tech stack:** Firebase vs PostgreSQL | `product-management/*` references Firebase | Migrated to PostgreSQL 2026-01-05. All Firebase refs obsolete |

---

## PHASE 3 вЂ” Target Documentation Architecture

### Proposed Canonical Structure

```
docs/
в”њв”Ђв”Ђ README.md                          # Index: links to all sections
в”‚
в”њв”Ђв”Ђ system/                            # System-level architecture
в”‚   в”њв”Ђв”Ђ ARCHITECTURE.md                # System overview (from reference/)
в”‚   в”њв”Ђв”Ђ DATABASE_SCHEMA.md             # DB Source of Truth
в”‚   в”њв”Ђв”Ђ AUTH_AND_ROLES.md              # NEW: JWT, orgs, roles, invites
в”‚   в””в”Ђв”Ђ DEPLOYMENT.md                  # Deploy & ops (from root)
в”‚
в”њв”Ђв”Ђ business/                          # Business domain rules
в”‚   в”њв”Ђв”Ђ wb-work-policy.md              # WB rules (BINDING)
в”‚   в”њв”Ђв”Ђ ozon-work-policy.md            # OZON rules (BINDING)
в”‚   в”њв”Ђв”Ђ complaints.md                  # Complaint domain
в”‚   в”њв”Ђв”Ђ complaints-schema.md           # Complaint DB details
в”‚   в”њв”Ђв”Ђ auto-complaints.md             # NEW: merged STRATEGY+TRIGGERS+IMPL
в”‚   в”њв”Ђв”Ђ chats-ai.md                    # AI in chats (comprehensive)
в”‚   в”њв”Ђв”Ђ tag-classification.md          # Tag system (regex classifier)
в”‚   в”њв”Ђв”Ђ deletion-workflow.md           # NEW: merged STAGE_3 + TRIGGER_PHRASES
в”‚   в”њв”Ђв”Ђ auto-sequences.md             # NEW: sequence system documentation
в”‚   в””в”Ђв”Ђ audit-trail.md                 # NEW: migration 027 tracking
в”‚
в”њв”Ђв”Ђ product/                           # Product specs & UI
в”‚   в”њв”Ђв”Ђ cabinets.md                    # Cabinet dashboard spec
в”‚   в”њв”Ђв”Ђ client-tabs.md                 # Tab navigation
в”‚   в”њв”Ђв”Ђ messenger-view.md              # Chat UI (REWRITTEN)
в”‚   в”њв”Ђв”Ђ kanban-board.md                # Kanban UI (UPDATED)
в”‚   в””в”Ђв”Ђ design-system.md              # UI tokens + TG design
в”‚
в”њв”Ђв”Ђ integrations/                      # External systems
в”‚   в”њв”Ђв”Ђ extension-api.md               # NEW: merged 2 duplicate docs
в”‚   в”њв”Ђв”Ђ ozon-seller-api.md             # OZON API reference
в”‚   в”њв”Ђв”Ђ telegram-mini-app.md           # NEW: TG bot + Mini App
в”‚   в””в”Ђв”Ђ google-sheets-sync.md          # NEW: Sheets integration
в”‚
в”њв”Ђв”Ђ operations/                        # Daily ops guides
в”‚   в”њв”Ђв”Ђ QUICK_REFERENCE.md             # Quick access (UPDATED)
в”‚   в”њв”Ђв”Ђ TROUBLESHOOTING.md             # Diagnostics (UPDATED)
в”‚   в”њв”Ђв”Ђ CRON_JOBS.md                   # Cron schedules
в”‚   в””в”Ђв”Ђ DEVELOPMENT.md                 # Local dev setup
в”‚
в”њв”Ђв”Ђ decisions/                         # ADRs (keep as-is, well-organized)
в”‚   в”њв”Ђв”Ђ ADR-001-*.md
в”‚   в”њв”Ђв”Ђ ADR-002-*.md
в”‚   в”њв”Ђв”Ђ ADR-003-*.md
в”‚   в”њв”Ђв”Ђ ARCH_REVIEW_TMA.md
в”‚   в”њв”Ђв”Ђ REFACTOR_PLAN_TMA_BFF.md
в”‚   в”њв”Ђв”Ђ BACKLOG_REFACTOR_TMA.md
в”‚   в”њв”Ђв”Ђ AI_AGENT_ARCH_REVIEW.md
в”‚   в”њв”Ђв”Ђ AI_AGENT_REFACTOR_PLAN.md
в”‚   в”њв”Ђв”Ђ BACKLOG_AI_AGENT_REFACTOR.md
в”‚   в””в”Ђв”Ђ golden-test-chats.md
в”‚
в”њв”Ђв”Ђ sprints/                           # Sprint docs (keep as-is)
в”‚   в”њв”Ђв”Ђ Sprint-001-OZON/
в”‚   в”њв”Ђв”Ђ sprint-002-review-chat-linking/
в”‚   в”њв”Ђв”Ђ sprint-003-cabinet-dashboard/
в”‚   в”њв”Ђв”Ђ sprint-004-communication-policy/
в”‚   в””в”Ђв”Ђ Sprint-005/
в”‚
в”њв”Ђв”Ђ tasks/                             # Task tracking (keep as-is)
в”‚   в”њв”Ђв”Ђ Completed/
в”‚   в””в”Ђв”Ђ TASK-*.md
в”‚
в”њв”Ђв”Ђ _rules/                            # Governance (keep as-is)
в”‚   в”њв”Ђв”Ђ DOCS_UPDATE_POLICY.md
в”‚   в”њв”Ђв”Ђ DB_POLICY.md
в”‚   в””в”Ђв”Ђ CRON_POLICY.md
в”‚
в”њв”Ђв”Ђ reports/                           # Audit reports (keep as-is)
в”‚
в””в”Ђв”Ђ archive/                           # Historical (no daily use)
    в”њв”Ђв”Ђ migration-jan-2026/            # Firebaseв†’PostgreSQL migration
    в”њв”Ђв”Ђ sprints/                       # Old sprint reports
    в”њв”Ђв”Ђ reports/                       # Old reports
    в”њв”Ђв”Ђ extension-issues/              # Resolved extension issues
    в”њв”Ђв”Ђ product-management/            # MOVED: entire old directory
    в”њв”Ђв”Ђ STAGE_2_AI_CLASSIFICATION.md   # Deprecated AI classification
    в”њв”Ђв”Ђ TESTING_GUIDE_DELETION.md      # Old testing guide
    в”њв”Ђв”Ђ CHROME_EXTENSION_INTEGRATION.md # Superseded
    в””в”Ђв”Ђ root-cleanup/                  # Old root-level files
```

### Documentation Standards

1. **Every document MUST have:** Title, Date, Version, Status (Draft/Current/Deprecated/Archived)
2. **Source of Truth principle:** One canonical doc per topic. Others reference it.
3. **Date discipline:** Every document shows "Last Verified: YYYY-MM-DD"
4. **No hardcoded values:** Server IPs, URLs reference `DEPLOYMENT.md` constants section
5. **Naming:** `kebab-case.md` for all new docs, `UPPERCASE.md` only for governance/ADRs
6. **Archive rule:** Outdated docs move to `archive/`, never deleted from repo

---

## PHASE 4 вЂ” Document Migration Plan

### IMMEDIATE (P0) вЂ” Fix production issues

| Original File | Action | Target | Reason |
|---------------|--------|--------|--------|
| `docs/QUICK_REFERENCE.md` | **UPDATE** | `docs/operations/QUICK_REFERENCE.md` | Fix IP, PM2 processes, domain info |
| `docs/TROUBLESHOOTING.md` | **UPDATE** | `docs/operations/TROUBLESHOOTING.md` | Fix IP, add TG/CRON diagnostics |
| `README.md` (root) | **UPDATE** | Keep in root | Fix IP, update tech stack section |
| `docs/reference/api.md` | **UPDATE** | `docs/integrations/` or keep | Fix IP, verify Swagger ref |
| `QUICK_REFERENCE.md` (root) | **DELETE** | вЂ” | Duplicate of `docs/QUICK_REFERENCE.md` |

### HIGH PRIORITY (P1) вЂ” Fix contradictions

| Original File | Action | Target | Reason |
|---------------|--------|--------|--------|
| `docs/MESSENGER_VIEW_GUIDE.md` | **REWRITE** | `docs/product/messenger-view.md` | Wrong tags, wrong statuses |
| `docs/FILTERS_SYSTEM.md` | **REWRITE** | `docs/product/` or merge into messenger | "resolved" status, missing marketplace filters |
| `docs/KANBAN_QUICK_START.md` | **UPDATE** | `docs/product/kanban-board.md` | Remove "resolved", add audit trail |
| `docs/domains/STAGE_3_DELETION_AGENT_GUIDE.md` | **UPDATE** | `docs/business/deletion-workflow.md` | Fix 4в… compensation: 40% в†’ 0% |
| `docs/domains/STAGE_2_AI_CLASSIFICATION_GUIDE.md` | **ARCHIVE** | `docs/archive/` | Explicitly deprecated (migration 024) |
| `docs/domains/TESTING_GUIDE_DELETION_WORKFLOW.md` | **ARCHIVE** | `docs/archive/` | Hardcoded old migration paths |

### MEDIUM PRIORITY (P2) вЂ” Consolidate duplicates

| Original Files | Action | Target | Reason |
|----------------|--------|--------|--------|
| `EXTENSION_API_DOCUMENTATION.md` + `EXTENSION_API_COMPLETE.md` | **MERGE** | `docs/integrations/extension-api.md` | Identical content v2.1.0 |
| `CHROME_EXTENSION_INTEGRATION.md` | **ARCHIVE** | `docs/archive/` | Superseded, says "In Development" |
| `AUTO_COMPLAINT_STRATEGY.md` + `AUTO_COMPLAINT_TRIGGERS.md` + `AUTO_COMPLAINT_IMPLEMENTATION_SUMMARY.md` | **MERGE** | `docs/business/auto-complaints.md` | 3 files в†’ 1 coherent doc |
| `IMPLEMENTATION_SUMMARY.md` (root) | **ARCHIVE** | `docs/archive/root-cleanup/` | Outdated, pre-OZON |
| `EXTENSION_API_DEPLOYMENT.md` (root) | **ARCHIVE** | `docs/archive/root-cleanup/` | Superseded |
| `DEPLOYMENT_SUCCESS_2026-01-28.md` (root) | **ARCHIVE** | `docs/archive/root-cleanup/` | Historical status report |
| `product-management/` (entire directory) | **ARCHIVE** | `docs/archive/product-management/` | All Firebase refs, fully superseded |

### LOW PRIORITY (P3) вЂ” Enhance

| File | Action | Target | Reason |
|------|--------|--------|--------|
| `docs/UI_DESIGN_SYSTEM.md` | **EXPAND** | `docs/product/design-system.md` | Add TG design (V5 inline), Cabinet |
| `docs/COMPONENT_LIBRARY.md` | **EXPAND** | Merge into design-system.md | Add project-specific components |
| `docs/DEVELOPMENT.md` | **EXPAND** | `docs/operations/DEVELOPMENT.md` | Add env vars, migration, seed |
| `DEPLOYMENT.md` (root) | **MOVE** | `docs/operations/DEPLOYMENT.md` | Correct location |
| `prototypes/STORES_MANAGEMENT_SPEC.md` | **ARCHIVE** | `docs/archive/` | Superseded by Cabinet (Sprint 003) |

### KEEP AS-IS (no action needed)

| Files | Reason |
|-------|--------|
| `docs/domains/complaints.md` | Source of Truth v2.0 |
| `docs/domains/chats-ai.md` | Source of Truth v3.5 |
| `docs/domains/TAG_CLASSIFICATION.md` | Authoritative (2026-03-06) |
| `docs/domains/wb-work-policy.md` | Binding policy |
| `docs/domains/ozon-work-policy.md` | Binding policy |
| `docs/domains/ozon-chats.md` | Current |
| `docs/domains/DELETION_TRIGGER_PHRASES.md` | Active regex patterns |
| `docs/domains/complaints-table-schema.md` | Current schema ref |
| `docs/domains/complaint-auto-generation-rules.md` | Current rules |
| `docs/domains/AB_TESTING_COMPLAINT_TEMPLATES.md` | Completed spec |
| `docs/reference/ARCHITECTURE.md` | Current |
| `docs/reference/statuses-reference.md` | Source of Truth (2026-03-03) |
| `docs/product-specs/OZON/OZON-SELLER-API.md` | Current API ref |
| `docs/product-specs/CHATS_*.md` (4 files) | Current specs |
| `docs/product/cabinets.md` | Current |
| `docs/product/client-tabs.md` | Current |
| `docs/_rules/*.md` (3 files) | Governance backbone |
| `docs/reports/*.md` (2 files) | Audit records |
| `docs/decisions/*.md` (10 files) | ADRs and plans |
| `docs/sprints/**/*` (21 files) | Sprint documentation |
| `prototypes/DESIGN_REVIEW_CHECKLIST.md` | Evergreen utility |
| `prototypes/MESSENGER_VIEW_DESIGN_SPEC.md` | Current design tokens |
| `.claude/claude.md` | Core governance |

---

## PHASE 5 вЂ” Knowledge Gaps

### Critical Missing Documents

| # | Topic | Why Critical | Suggested Path | Priority |
|---|-------|-------------|----------------|----------|
| 1 | **Audit Trail** | Migration 027 (2026-03-06): `chat_status_history`, `change_source`, `updateChatWithAudit()` вЂ” undocumented | `docs/business/audit-trail.md` | **CRITICAL** |
| 2 | **Auto-Sequence System** | Complex system: 4 sequence types, cron processor, manual activation, stop conditions вЂ” scattered across `chats-ai.md` only | `docs/business/auto-sequences.md` | **HIGH** |
| 3 | **Telegram Mini App** | No product spec, no ops guide, no design system section. Only decision docs exist | `docs/integrations/telegram-mini-app.md` | **HIGH** |
| 4 | **Auth & Roles** | JWT, organizations, org_members, invites, member_store_access вЂ” no dedicated doc | `docs/system/AUTH_AND_ROLES.md` | **HIGH** |
| 5 | **Google Sheets Sync** | 2 sync services, debounce, retry, secondary sheets вЂ” completely undocumented | `docs/integrations/google-sheets-sync.md` | **MEDIUM** |
| 6 | **Database Schema** | `docs/database-schema.md` exists (2026-03-06), current with migration 027. Includes `chat_status_history`. **No gap.** | вЂ” | OK |
| 7 | **CRON_JOBS.md** | `docs/CRON_JOBS.md` exists (2026-03-06), covers all cron jobs including OZON sync. **No gap.** | вЂ” | OK |
| 8 | **Review-Chat Links** | Business invariant "1 review = 1 chat", `review_chat_links` table, TG queue filtering вЂ” no standalone doc | `docs/business/review-chat-links.md` | **MEDIUM** |
| 9 | **Multi-Marketplace Architecture** | WB vs OZON: product IDs, sync strategies, rate limits вЂ” no comparison doc | `docs/system/marketplace-architecture.md` | **LOW** |

### Source of Truth Files Referenced in CLAUDE.md вЂ” Verification

| Referenced As | Expected Path | Actual Status |
|---------------|---------------|---------------|
| "Source of Truth РїРѕ Р‘Р”" | `docs/database-schema.md` | FOUND, current (2026-03-06), includes migration 027 |
| "Р°РІС‚РѕРјР°С‚РёР·Р°С†РёРё" | `docs/CRON_JOBS.md` | FOUND, current (2026-03-06), includes OZON sync |
| "С€РїР°СЂРіР°Р»РєР°" | `docs/QUICK_REFERENCE.md` | Found but **OUTDATED** (stale IP, old PM2) |
| "РїСЂР°РІРёР»Р° СЂР°Р·СЂР°Р±РѕС‚РєРё" | `docs/DEVELOPMENT.md` | Found but **GENERIC** (missing env vars, migrations) |
| "РґРµРїР»РѕР№ Рё rollback" | `docs/DEPLOYMENT.md` | Found at root level (fix IP line 7) |
| "РєР°Рє СЃС‚Р°РІСЏС‚СЃСЏ Рё РІРµРґСѓС‚СЃСЏ Р·Р°РґР°С‡Рё" | `docs/TASK_MANAGEMENT_CENTER.md` | FOUND (v1.0, 2026-01-20) |

---

## Summary of Actions

### By Priority

| Priority | Actions | Count |
|----------|---------|-------|
| **P0 CRITICAL** | Fix IP in 5+ files; Update outdated QUICK_REFERENCE | 6 |
| **P1 HIGH** | Rewrite 3 outdated guides; Archive 2 deprecated; Fix 4в… logic | 6 |
| **P2 MEDIUM** | Merge 5 duplicate groups; Archive `product-management/`; Archive 3 root files | 9 |
| **P3 LOW** | Expand design system, dev guide; Move `DEPLOYMENT.md` | 4 |
| **NEW DOCS** | Audit trail, auto-sequences, TG Mini App, Auth, Sheets, review-chat-links | 6 |
| **KEEP** | No changes needed | 35+ files |

### By Action Type

| Action | Count | Files |
|--------|-------|-------|
| **UPDATE** (fix IP, wrong data) | 7 | QUICK_REFERENCE, TROUBLESHOOTING, README, api.md, KANBAN, STAGE_3, ADR-003 |
| **REWRITE** | 2 | MESSENGER_VIEW_GUIDE, FILTERS_SYSTEM |
| **MERGE** | 5 groups | Extension API (2в†’1), Auto-Complaint (3в†’1), Design (2в†’1) |
| **ARCHIVE** | 25+ | product-management/*, 3 root files, 2 deprecated, 1 obsolete |
| **CREATE** | 6 | audit-trail, auto-sequences, TG Mini App, Auth & Roles, Google Sheets sync, review-chat-links |
| **DELETE** | 1 | Root `QUICK_REFERENCE.md` (exact duplicate) |
| **KEEP** | 35+ | All current/authoritative docs |

---

*This report is read-only analysis. No files were modified, deleted, or created (except this report).*
