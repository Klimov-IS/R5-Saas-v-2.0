# R5 SaaS — Documentation Index

**Last Updated:** 2026-03-06
**Maintained by:** Sprint 005 Documentation Audit

---

## How to Use This Index

| If you need to... | Go to |
|---|---|
| Deploy or rollback | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Understand the DB schema | [database-schema.md](database-schema.md) |
| Check cron schedules | [CRON_JOBS.md](CRON_JOBS.md) |
| Understand a business domain | [domains/](#domain-logic) |
| Plan a new feature | [product-specs/](#product-specifications) |
| Create a task | [TASK_MANAGEMENT_CENTER.md](product-specs/TASK_MANAGEMENT_CENTER.md) |
| Debug an issue | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Quick command reference | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) |

---

## Operational Guides

Daily-use documents. Must stay current.

| Document | Purpose |
|---|---|
| [database-schema.md](database-schema.md) | **Source of Truth** for all tables, columns, indexes |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Server setup, deploy steps, rollback procedures |
| [CRON_JOBS.md](CRON_JOBS.md) | All cron jobs: schedule, purpose, limits |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Dev environment, coding rules, PR workflow |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Cheat sheet: IPs, credentials, PM2 commands |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and solutions |
| [TASK_MANAGEMENT_CENTER.md](product-specs/TASK_MANAGEMENT_CENTER.md) | Task lifecycle, file format, conventions |

---

## Domain Logic

Business rules and system behavior. **Most important for understanding the product.**

### Core Domains

| Document | Topic | Key Concepts |
|---|---|---|
| [domains/complaints.md](domains/complaints.md) | Complaint system | WB-only, 1 per review, snapshot model, 1000 char limit |
| [domains/auto-complaints.md](domains/auto-complaints.md) | Auto-complaint generation | Hybrid: event-driven + CRON, 6 business rules |
| [domains/chats-ai.md](domains/chats-ai.md) | AI in chats | 5 active flows, Deepseek, per-store instructions |
| [domains/auto-sequences.md](domains/auto-sequences.md) | Auto-sequence system | 4 types, manual activation, cron processor |
| [domains/review-chat-links.md](domains/review-chat-links.md) | Review-chat linking | 1 review = 1 chat invariant, 3 creation sources |
| [domains/audit-trail.md](domains/audit-trail.md) | Status change logging | `chat_status_history` table, `updateChatWithAudit()` |
| [domains/TAG_CLASSIFICATION.md](domains/TAG_CLASSIFICATION.md) | Tag system | 4 tags + NULL, regex classifier, deletion workflow |

### Marketplace Policies

| Document | Topic |
|---|---|
| [domains/wb-work-policy.md](domains/wb-work-policy.md) | WB: complaints, chats, compensation rules |
| [domains/ozon-work-policy.md](domains/ozon-work-policy.md) | OZON: 1 message, no complaints, Premium Plus |
| [domains/ozon-chats.md](domains/ozon-chats.md) | OZON chat API specifics |

### Platform Systems

| Document | Topic |
|---|---|
| [domains/telegram-mini-app.md](domains/telegram-mini-app.md) | TG bot, Mini App, notifications, auth |
| [domains/auth-and-roles.md](domains/auth-and-roles.md) | JWT auth, roles (owner/admin/manager), invites |
| [domains/google-sheets-sync.md](domains/google-sheets-sync.md) | Product Rules + Client Directory sync |

### Specialized

| Document | Topic |
|---|---|
| [domains/complaints-table-schema.md](domains/complaints-table-schema.md) | `review_complaints` + `complaint_details` schema |
| [domains/DELETION_TRIGGER_PHRASES.md](domains/DELETION_TRIGGER_PHRASES.md) | Phrases that trigger deletion workflow |
| [domains/STAGE_3_DELETION_AGENT_GUIDE.md](domains/STAGE_3_DELETION_AGENT_GUIDE.md) | Deletion agent: compensation calculator |

---

## Technical Reference

Architecture, API specs, statuses.

| Document | Purpose |
|---|---|
| [reference/ARCHITECTURE.md](reference/ARCHITECTURE.md) | System architecture overview |
| [reference/api.md](reference/api.md) | API endpoint reference |
| [reference/EXTENSION_API_COMPLETE.md](reference/EXTENSION_API_COMPLETE.md) | Chrome Extension API v2.1.0 (canonical) |
| [reference/statuses-reference.md](reference/statuses-reference.md) | All status/tag enums and transitions |

---

## Policies (`_rules/`)

Governance documents for specific subsystems.

| Document | Scope |
|---|---|
| [_rules/CHAT_COMMUNICATION_POLICY.md](_rules/CHAT_COMMUNICATION_POLICY.md) | Chat messaging rules and limits |
| ~~CRON_POLICY.md~~ | Merged into [CRON_JOBS.md](CRON_JOBS.md) "Development Standards" section |
| [_rules/DB_POLICY.md](_rules/DB_POLICY.md) | Database change policies |
| [_rules/DOCS_UPDATE_POLICY.md](_rules/DOCS_UPDATE_POLICY.md) | When and how to update docs |

---

## UI / UX Guides

| Document | Purpose |
|---|---|
| [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md) | Design tokens, spacing, colors |
| [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) | shadcn/ui vs custom component rules |
| [MESSENGER_VIEW_GUIDE.md](MESSENGER_VIEW_GUIDE.md) | Chat messenger UI implementation |
| [FILTERS_SYSTEM.md](FILTERS_SYSTEM.md) | Filter system: statuses, tags, ratings |
| [KANBAN_QUICK_START.md](KANBAN_QUICK_START.md) | Kanban board (4 columns, workflow) |
| [TELEGRAM_MINI_APPS_RULES.md](TELEGRAM_MINI_APPS_RULES.md) | TG Mini App master rules |

---

## Product Specifications

Feature planning and design docs.

| Document | Topic |
|---|---|
| [product-specs/CHATS_FEATURE_SPEC.md](product-specs/CHATS_FEATURE_SPEC.md) | Chats feature specification |
| [product-specs/KANBAN_BOARD_IMPLEMENTATION.md](product-specs/KANBAN_BOARD_IMPLEMENTATION.md) | Kanban board implementation plan |
| [product-specs/TASK_MANAGEMENT_CENTER.md](product-specs/TASK_MANAGEMENT_CENTER.md) | Task lifecycle, file format, conventions |
| [product-specs/OZON/OZON-SELLER-API.md](product-specs/OZON/OZON-SELLER-API.md) | OZON Seller API research |
| [product/cabinets.md](product/cabinets.md) | Stores page specification |
| [product/client-tabs.md](product/client-tabs.md) | Client cabinet tabs logic |

---

## Sprints

| Sprint | Focus | Status |
|---|---|---|
| [sprints/SPRINT-001-OZON-FOUNDATION.md](sprints/SPRINT-001-OZON-FOUNDATION.md) | OZON integration | Completed |
| [sprints/sprint-002-review-chat-linking/](sprints/sprint-002-review-chat-linking/) | Review-chat linking + extension | Completed |
| [sprints/sprint-003-cabinet-dashboard/](sprints/sprint-003-cabinet-dashboard/) | Cabinet dashboard (P0+P1) | In Progress |
| [sprints/sprint-004-communication-policy/](sprints/sprint-004-communication-policy/) | Chat communication policy | Completed |
| [sprints/Sprint-005/](sprints/Sprint-005/) | Documentation audit | In Progress |

---

## Tasks

Active tasks: [`docs/tasks/`](tasks/)
Completed tasks: [`docs/tasks/Completed/`](tasks/Completed/)

---

## Plans

Architecture reviews, refactoring plans, and backlogs: [`docs/plans/`](plans/)

| Document | Topic |
|---|---|
| [AI_AGENT_ARCH_REVIEW.md](plans/AI_AGENT_ARCH_REVIEW.md) | AI agent architecture review |
| [AI_AGENT_REFACTOR_PLAN.md](plans/AI_AGENT_REFACTOR_PLAN.md) | AI agent refactoring plan |
| [BACKLOG_AI_AGENT_REFACTOR.md](plans/BACKLOG_AI_AGENT_REFACTOR.md) | AI agent refactor backlog |
| [ARCH_REVIEW_TMA.md](plans/ARCH_REVIEW_TMA.md) | TG Mini App architecture review |
| [REFACTOR_PLAN_TMA_BFF.md](plans/REFACTOR_PLAN_TMA_BFF.md) | TMA BFF refactoring plan |
| [BACKLOG_REFACTOR_TMA.md](plans/BACKLOG_REFACTOR_TMA.md) | TMA refactor backlog |
| [AI_AUTONOMY_ROADMAP.md](plans/AI_AUTONOMY_ROADMAP.md) | AI autonomy levels roadmap |
| [golden-test-chats.md](plans/golden-test-chats.md) | Golden test chat selection |

---

## Decisions (ADR)

Architecture Decision Records: [`docs/decisions/`](decisions/)

| ADR | Topic |
|---|---|
| [ADR-001](decisions/ADR-001-why-instrumentation-hook.md) | Why instrumentation hook |
| [ADR-002](decisions/ADR-002-active-stores-filter.md) | Active stores filter pattern |
| [ADR-003](decisions/ADR-003-cron-intervals.md) | Cron interval choices |

---

## Reports

| Report | Topic |
|---|---|
| [reports/TASK-004-complaints-audit-report.md](reports/TASK-004-complaints-audit-report.md) | Complaints system audit |
| [reports/TASK-005-documentation-report.md](reports/TASK-005-documentation-report.md) | Documentation quality report |
| ~~AUDIT_TELEGRAM_MINI_APPS.md~~ | Archived (migration 027 completed) |
| ~~AUDIT_FINDINGS_SUMMARY.md~~ | Archived (migration 027 completed) |

---

## Archive

Historical documents, deprecated guides, and superseded content.

**Location:** [`docs/archive/`](archive/)

**DO NOT use as current reference.** Contents include:
- Firebase-era product management docs
- January 2026 migration logs
- Superseded extension API docs (API_SPEC_FOR_EXTENSION_STATUS_CHECKER)
- Deprecated AI classification guide (STAGE_2)
- Old sprint reports
- Merged docs: complaint-auto-generation-rules, CRON_POLICY
- Obsolete product-specs: CHAT_STATUS_AND_TAGGING_SYSTEM, CHATS_CURRENT_STATE_ANALYSIS, CHATS_IMPLEMENTATION_ROADMAP
- Completed experiments: AB_TESTING_COMPLAINT_TEMPLATES
- Audit artifacts: AUDIT_FINDINGS_SUMMARY, AUDIT_TELEGRAM_MINI_APPS

---

## Documentation Standards

### File Naming

| Type | Convention | Example |
|---|---|---|
| New domain docs | `kebab-case.md` | `audit-trail.md` |
| Governance / ADRs | `UPPERCASE.md` | `CRON_JOBS.md` |
| Tasks | `TASK-YYYYMMDD-short-name.md` | `TASK-20260306-rcl-fix.md` |

### Required Headers

Every document MUST have:

```markdown
# Title

**Last Updated:** YYYY-MM-DD
**Status:** Current | Deprecated | Draft
```

### Update Rules

Documentation updates are REQUIRED when:
- DB schema changes (→ `database-schema.md`)
- API added/changed (→ `reference/api.md`)
- Cron job added/changed (→ `CRON_JOBS.md`)
- Business logic changes (→ `domains/*`)
- New feature (→ `product-specs/*`)

**A task without documentation update is incomplete.**

---

**Last Updated:** 2026-03-06
