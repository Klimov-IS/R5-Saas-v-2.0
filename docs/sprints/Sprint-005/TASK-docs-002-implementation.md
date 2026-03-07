# TASK: Semantic Documentation Reorganization — Implementation

**Date:** 2026-03-06
**Sprint:** 005
**Based on:** [SEMANTIC-REORG-REPORT.md](./SEMANTIC-REORG-REPORT.md)
**Status:** Completed

---

## Goal

Execute the migration plan from the semantic reorganization report. Reduce fragmentation, archive obsolete docs, reorganize misclassified files.

## Current State

- 90+ active documentation files
- 3 HIGH-severity fragmentations (statuses in 7 files, tags in 6, gen rules in 3)
- 8 obsolete documents in active directories
- 7 planning docs misclassified in decisions/
- 3 merge opportunities

## Proposed Changes

### Phase 1: Merge & Consolidate (no file moves)

| Original | Action | Target |
|---|---|---|
| `complaint-auto-generation-rules.md` | MERGE | `auto-complaints.md` |
| `_rules/CRON_POLICY.md` | MERGE | `CRON_JOBS.md` (new section) |
| `API_SPEC_FOR_EXTENSION_STATUS_CHECKER.md` | MERGE | `EXTENSION_API_COMPLETE.md` |
| `QUICK_REFERENCE.md` | TRIM | Remove duplicate PM2/CRON tables, replace with links |

### Phase 2: Archive Obsolete

| File | Reason |
|---|---|
| `product-specs/CHAT_STATUS_AND_TAGGING_SYSTEM.md` | Proposes 12 tags; reality = 4 + NULL |
| `product-specs/CHATS_CURRENT_STATE_ANALYSIS.md` | Pre-Kanban gap analysis |
| `product-specs/CHATS_IMPLEMENTATION_ROADMAP.md` | Historical sprint plan |
| `domains/COMPLAINTS_SYSTEM_INTEGRATION.md` | Unclear implementation status |
| `domains/AB_TESTING_COMPLAINT_TEMPLATES.md` | A/B test likely completed |
| `EXTENSION_TEAM_STORES_UPDATE.md` | Superseded by auth system |
| `AUDIT_FINDINGS_SUMMARY.md` | Audit artifact (migration 027 done) |
| `AUDIT_TELEGRAM_MINI_APPS.md` | Audit artifact (migration 027 done) |

### Phase 3: Reorganize — Create `plans/` directory

| Original | Target |
|---|---|
| `decisions/AI_AGENT_ARCH_REVIEW.md` | `plans/` |
| `decisions/AI_AGENT_REFACTOR_PLAN.md` | `plans/` |
| `decisions/BACKLOG_AI_AGENT_REFACTOR.md` | `plans/` |
| `decisions/ARCH_REVIEW_TMA.md` | `plans/` |
| `decisions/REFACTOR_PLAN_TMA_BFF.md` | `plans/` |
| `decisions/BACKLOG_REFACTOR_TMA.md` | `plans/` |
| `decisions/golden-test-chats.md` | `plans/` |
| `product-specs/AI_AUTONOMY_ROADMAP.md` | `plans/` |
| `TASK_MANAGEMENT_CENTER.md` | `product-specs/` |

### Phase 4: Update README.md index

Update `docs/README.md` to reflect new structure (plans/ folder, archived files removed).

## Impact

- **DB:** None
- **API:** None
- **Cron:** None
- **AI:** None
- **UI:** None
- **Docs:** Major restructuring

## Required Docs Updates

- `docs/README.md` — update index
- `docs/_rules/DOCS_UPDATE_POLICY.md` — update folder structure
- Cross-references in moved/merged documents

## Rollout Plan

1. Execute Phase 1 (merges)
2. Execute Phase 2 (archives)
3. Execute Phase 3 (reorganize)
4. Execute Phase 4 (update indexes)
5. Verify no broken cross-references

## Backout Plan

All changes are reversible via git. No data loss — only file moves and content merges.
