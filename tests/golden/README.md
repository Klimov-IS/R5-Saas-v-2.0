# Golden Test Conversations

Regression test dataset for AI chat reply quality evaluation.

## Purpose

- Baseline quality snapshots before prompt/context changes
- Automated invariant checks (forbidden phrases, compensation gating, length limits)
- Manual quality comparison (manualScore 1-5) after changes

## Golden Chats (fill with real chat_ids before first evaluation)

| ID | Marketplace | Rating | Phase | Chat ID | Purpose |
|----|------------|--------|-------|---------|---------|
| GOLDEN-WB-LOW | WB | 1-3 | resolution | `TODO` | Compensation offered path |
| GOLDEN-WB-HIGH | WB | 4 | proposal | `TODO` | No compensation, upgrade to 5 |
| GOLDEN-WB-DISC | WB | 2 | discovery | `TODO` | First contact, ask what happened |
| GOLDEN-OZON | OZON | any | proposal | `TODO` | 1000-char limit, OZON language |

## Snapshot Format

Each snapshot is a JSON file in `conversations/` with fields:
```json
{
  "id": "GOLDEN-WB-DISC",
  "chatId": "real_chat_id",
  "marketplace": "wb",
  "reviewRating": 2,
  "phase": "discovery",
  "sellerMessageCount": 0,
  "draft": "Generated AI text...",
  "generatedAt": "2026-03-05T12:00:00Z",
  "promptVersion": 1,
  "manualScore": null,
  "notes": "Optional notes"
}
```

Files starting with `_` are skipped by the checker (e.g., `_example.json`).

## How to Record Snapshots

**Option A: Auto-generate via evaluate.ts**
1. Add chat IDs to `GOLDEN_CHATS` array in `evaluate.ts`
2. Run `R5_EVAL_TOKEN=xxx npx tsx tests/golden/evaluate.ts`
3. Snapshots saved automatically to `conversations/`

**Option B: Manual snapshot**
1. Generate an AI draft in TMA or Web
2. Copy `_example.json`, fill fields, save as `{id}.json`

## Invariants (automated checks via `src/ai/output-validator.ts`)

| # | Severity | Rule | Condition |
|---|----------|------|-----------|
| 1 | error | `no_compensation_high_rating` | rating >= 4 → no `\d+\s*[₽руб]` |
| 2 | error | `ozon_no_deletion` | ozon → no deletion words |
| 3 | error | `ozon_length` | ozon → len <= 1000 |
| 4 | warning | `no_repeated_greeting` | seller_msgs > 0 → no greeting |
| 5 | warning | `discovery_ends_question` | phase == discovery → ends with ? |
| 6 | error | `no_direct_deletion` | any → no "удалите/удалить отзыв" |
| 7 | error | `no_markdown` | any → no **, ##, backticks |
| 8 | error | `length_min`/`length_max` | 50 <= len <= 2000 |

## Running

```bash
# Invariant check only (no AI call, uses saved snapshots):
npx tsx tests/golden/check-invariants.ts

# Full evaluation (generates fresh drafts, requires auth + server):
R5_EVAL_TOKEN=xxx npx tsx tests/golden/evaluate.ts

# Compare V1 vs V2 prompts:
AI_PROMPT_VERSION=1 R5_EVAL_TOKEN=xxx npx tsx tests/golden/evaluate.ts
# Rename output, then:
AI_PROMPT_VERSION=2 R5_EVAL_TOKEN=xxx npx tsx tests/golden/evaluate.ts
# Compare manualScores and invariant results
```
