# AI Agent Architecture Review — Web vs TMA Parity + Quality Analysis

> **Date:** 2026-03-05
> **Author:** Claude Opus 4.6 (principal LLM architect audit)
> **Scope:** generate-chat-reply flow (Web + TMA), all 7 AI flows, quality root causes
> **Status:** Complete analysis, NO code changes

---

## 1. Executive Summary

**Parity verdict: Web and TMA are NOW parity-safe.** After the recent refactor (PR-03..PR-06 from `BACKLOG_REFACTOR_TMA.md`), both the Web single-chat `generate-ai` route and the TMA `generate-ai` route call the **same** `generateReply()` in `src/core/services/chat-service.ts`. The bulk-generate route (`/api/stores/[storeId]/chats/bulk/generate-ai`) is the **only remaining outlier** — it has its own inlined context building (~100 LOC) that duplicates the service logic but may drift.

**Quality problems are NOT caused by Web/TMA divergence.** They stem from:
1. A single flat `user` message stuffed with 200+ lines of mixed context (no structured separation)
2. System prompt from `user_settings.prompt_chat_reply` (DB) is opaque — nobody knows its exact content at runtime
3. `DEFAULT_AI_INSTRUCTIONS` (250 lines) is appended as `storeInstructions` but may be overridden by shorter custom instructions that lack guardrails
4. No chat history windowing — ALL messages are sent, blowing up context and diluting recency
5. `deepseek-chat` at temperature 0.7 produces high variance on Russian text
6. No post-generation validation or safety filter — raw AI output saved directly as draft
7. No feedback loop or quality measurement exists

The biggest lever for quality improvement is **structured context + prompt rewrite** (not more code refactoring).

---

## 2. System Map — End-to-End Data Flow

### 2.1 Entry Points

| Channel | Route | Handler | Calls |
|---------|-------|---------|-------|
| **Web (single)** | `POST /api/stores/[storeId]/chats/[chatId]/generate-ai` | [route.ts](src/app/api/stores/[storeId]/chats/[chatId]/generate-ai/route.ts) | `generateReply()` from chat-service |
| **TMA** | `POST /api/telegram/chats/[chatId]/generate-ai` | [route.ts](src/app/api/telegram/chats/[chatId]/generate-ai/route.ts) | `generateReply()` from chat-service |
| **Web (bulk)** | `POST /api/stores/[storeId]/chats/bulk/generate-ai` | [route.ts](src/app/api/stores/[storeId]/chats/bulk/generate-ai/route.ts) | **INLINE** context building + `generateChatReply()` directly |

### 2.2 Shared Service Flow

```
Route (auth + access check)
  │
  ▼
ChatService.generateReply()                [src/core/services/chat-service.ts:185]
  │
  ├─ chatRepo.findChatWithAiInstructions() [src/db/repositories/chat-repository.ts:74]
  │   └─ JOIN chats + stores (ai_instructions)
  │
  ├─ chatRepo.findMessagesForAi()          [src/db/repositories/chat-repository.ts:88]
  │   └─ SELECT ALL messages ORDER BY timestamp ASC  ← NO windowing!
  │
  ├─ findLinkWithReviewByChatId()          [src/db/review-chat-link-helpers.ts]
  │   └─ review_chat_links → reviews (rating, text, date, complaint_status)
  │
  ├─ getProductRulesByNmId()               [src/db/helpers.ts]
  │   └─ product_rules (compensation, strategy)
  │
  ├─ detectConversationPhase()             [src/lib/ai-context.ts:21]
  │   └─ 0 client msgs → discovery, 1 → proposal, 2+ → resolution
  │
  ├─ BUILD context string (markdown)       ← ~150 LOC of string concat
  │   └─ Store name, product info, product rules, review, phase, history
  │
  ├─ buildStoreInstructions()              [src/lib/ai-context.ts:224]
  │   └─ ai_instructions || DEFAULT_AI_INSTRUCTIONS + FAQ + Guides + OZON addendum
  │
  ▼
generateChatReply()                        [src/ai/flows/generate-chat-reply-flow.ts:29]
  │
  ├─ getUserSettings()                     → user_settings.prompt_chat_reply (system prompt from DB)
  │
  ├─ Append storeInstructions to system prompt (if present)
  │
  ▼
runChatCompletion()                        [src/ai/assistant-utils.ts:73]
  │
  ├─ model: 'deepseek-chat'
  ├─ temperature: 0.7
  ├─ max_tokens: 2048
  ├─ messages: [ {system: prompt}, {user: context} ]
  ├─ API: https://api.deepseek.com/chat/completions
  │
  ▼
Post-processing
  ├─ OZON: trim to 1000 chars at sentence boundary  [chat-service.ts:306]
  ├─ Save draft_reply to DB                          [chat-service.ts:320]
  └─ Return { success: true, draftReply }
```

### 2.3 All 7 AI Flows

| # | Flow | File | System Prompt Source | JSON Mode | Post-processing |
|---|------|------|---------------------|-----------|-----------------|
| 1 | **generate-chat-reply** | `src/ai/flows/generate-chat-reply-flow.ts` | `user_settings.prompt_chat_reply` | No | OZON 1000-char trim |
| 2 | **classify-chat-tag** | `src/ai/flows/classify-chat-tag-flow.ts` | `user_settings.prompt_chat_tag` | Yes (JSON) | Zod validation → fallback `untagged` |
| 3 | **classify-chat-deletion** | `src/ai/flows/classify-chat-deletion-flow.ts` | `user_settings.prompt_chat_deletion_tag` | Yes (JSON) | Regex pre-filter + Zod validation |
| 4 | **generate-deletion-offer** | `src/ai/flows/generate-deletion-offer-flow.ts` | `user_settings.prompt_deletion_offer` | Yes (JSON) | Zod validation + compensation override + fallback template |
| 5 | **generate-review-reply** | `src/ai/flows/generate-review-reply-flow.ts` | `user_settings.prompt_review_reply` | No | None |
| 6 | **generate-question-reply** | `src/ai/flows/generate-question-reply-flow.ts` | `user_settings.prompt_question_reply` | No | None |
| 7 | **generate-review-complaint** | `src/ai/flows/generate-review-complaint-flow.ts` | Hardcoded optimized prompt | No | Truncate to 1000 chars, parse JSON |
| 8 | **analyze-store-dialogues** | `src/ai/flows/analyze-store-dialogues-flow.ts` | Hardcoded prompt | Yes (JSON) | JSON parse |

### 2.4 Model Configuration

| Param | Value | Location |
|-------|-------|----------|
| Model | `deepseek-chat` | [assistant-utils.ts:128](src/ai/assistant-utils.ts#L128) |
| Temperature | `0.7` | [assistant-utils.ts:133](src/ai/assistant-utils.ts#L133) |
| Max tokens | `2048` (default) | [assistant-utils.ts:134](src/ai/assistant-utils.ts#L134) |
| API endpoint | `https://api.deepseek.com/chat/completions` | [assistant-utils.ts:141](src/ai/assistant-utils.ts#L141) |
| API key | `user_settings.deepseek_api_key` || `DEEPSEEK_API_KEY` env | [assistant-utils.ts:121](src/ai/assistant-utils.ts#L121) |
| Message structure | `[system, user]` (2 messages) | [assistant-utils.ts:129-132](src/ai/assistant-utils.ts#L129) |

---

## 3. Web vs TMA Parity Report

### 3.1 Single-Chat Generate-AI: PARITY ACHIEVED

| Aspect | Web Route | TMA Route | Parity? |
|--------|-----------|-----------|---------|
| Service function | `generateReply()` | `generateReply()` | **SAME** |
| System prompt | `user_settings.prompt_chat_reply` | Same | **SAME** |
| Store instructions | `buildStoreInstructions()` | Same | **SAME** |
| Context builder | Inline in `chat-service.ts` | Same | **SAME** |
| Chat history | ALL messages, no windowing | Same | **SAME** |
| Product rules | `getProductRulesByNmId()` | Same | **SAME** |
| Compensation gating | Rating-based (1-3 vs 4-5) | Same | **SAME** |
| Review context | `findLinkWithReviewByChatId()` | Same | **SAME** |
| Phase detection | `detectConversationPhase()` | Same | **SAME** |
| OZON trim | 1000 chars at sentence | Same | **SAME** |
| Temperature | 0.7 | Same | **SAME** |
| Max tokens | 2048 | Same | **SAME** |
| Auth mechanism | Store-based (storeId from URL) | TG HMAC initData | Different (expected) |
| Access check | `[storeId]` array | `getAccessibleStoreIds(userId)` | Different (expected) |

**Conclusion:** Both channels call the exact same `generateReply()` function with identical context building, prompt composition, model parameters, and post-processing. Auth differs by design. **No prompt parity issues exist for single-chat generation.**

### 3.2 Bulk Generate-AI: DIVERGENCE EXISTS (P1)

The bulk endpoint at [route.ts](src/app/api/stores/[storeId]/chats/bulk/generate-ai/route.ts) has ~100 LOC of **duplicated** context building that mirrors `chat-service.ts:generateReply()` but is maintained separately.

| Aspect | ChatService.generateReply() | Bulk route (inline) |
|--------|---------------------------|---------------------|
| Chat query | `findChatWithAiInstructions()` (joins stores.ai_instructions) | `getChatById()` (no AI instructions join) |
| Messages | `findMessagesForAi()` (custom repo method) | `getChatMessages()` (generic helper) |
| OZON trim | Yes (line 306-317) | **NO** — missing! |
| Message synthesis | Via getChatDetail fallback | **NO** — not applicable (different flow) |
| Context template | Identical string structure | Identical (copy-pasted) |
| Product rules | Identical logic | Identical (copy-pasted) |

**Key risks:**
1. **OZON 1000-char limit not enforced** in bulk generation → messages > 1000 chars could be saved as drafts
2. **ai_instructions not fetched** via JOIN → may miss store-specific instructions (uses `store?.ai_instructions` from `getStoreById()` which does include it — need to verify)
3. Future changes to `generateReply()` won't propagate to bulk route

**Priority:** P1 — refactor bulk route to loop over `generateReply()` per chat

### 3.3 Auto-Sequence Messages: NO AI INVOLVED

Auto-sequence messages ([auto-sequence-sender.ts](src/lib/auto-sequence-sender.ts)) are **template-based**, not AI-generated. They use static templates from [auto-sequence-templates.ts](src/lib/auto-sequence-templates.ts). No parity concern.

---

## 4. Failure Modes — Why the Agent "Acts Dumb"

### FM-01: Context Overload — All Messages Sent Without Windowing
- **Symptom:** AI response ignores recent context, refers to old messages, gives generic reply
- **Root cause:** `findMessagesForAi()` returns ALL messages (`ORDER BY timestamp ASC`, no LIMIT). For chats with 50+ messages, this creates a huge `user` message that pushes the system prompt out of attention
- **Where:** [chat-repository.ts:88](src/db/repositories/chat-repository.ts#L88)
- **How to diagnose:** Log `context.length` before AI call; check ai_logs.prompt for token count
- **Fix:** Implement sliding window: last N messages (e.g., 20-30), plus summarize older context

### FM-02: System Prompt is Invisible/Unauditable
- **Symptom:** Unpredictable behavior, hard to debug
- **Root cause:** System prompt stored in `user_settings.prompt_chat_reply` (DB) — no version control, no visibility into what's actually being sent. Could be an outdated prompt, or a very short one missing guardrails
- **Where:** [generate-chat-reply-flow.ts:39](src/ai/flows/generate-chat-reply-flow.ts#L39)
- **How to diagnose:** Query `SELECT prompt_chat_reply FROM user_settings` — compare with `DEFAULT_AI_INSTRUCTIONS`
- **Fix:** Move prompt to code (versioned), use DB only for per-store overrides

### FM-03: storeInstructions Override Removes Guardrails
- **Symptom:** AI ignores phase rules, compensation gating, or tone guidelines for stores with custom `ai_instructions`
- **Root cause:** `buildStoreInstructions()` uses `aiInstructions?.trim() || DEFAULT_AI_INSTRUCTIONS`. If a store has custom instructions (even 2 sentences), the entire `DEFAULT_AI_INSTRUCTIONS` (173 lines of guardrails) is replaced
- **Where:** [ai-context.ts:247](src/lib/ai-context.ts#L247)
- **How to diagnose:** Check `stores.ai_instructions` for stores with quality complaints — are they overriding defaults?
- **Fix:** Change to **merge** model: `DEFAULT_AI_INSTRUCTIONS` always included, custom instructions added as addendum

### FM-04: Double System Prompt Construction
- **Symptom:** Duplicate/conflicting instructions sent to model
- **Root cause:** The system prompt is built in TWO places:
  1. `generateChatReply()` takes `user_settings.prompt_chat_reply` as system prompt
  2. `storeInstructions` (which includes `DEFAULT_AI_INSTRUCTIONS` + FAQ + guides + OZON addendum) is appended to that same system prompt
  - Result: system prompt = `DB prompt` + `\n\n## Инструкции магазина\n` + `DEFAULT_AI_INSTRUCTIONS` + FAQ + guides + OZON
  - If DB prompt already contains similar instructions, they conflict
- **Where:** [generate-chat-reply-flow.ts:46-48](src/ai/flows/generate-chat-reply-flow.ts#L46)
- **How to diagnose:** Log full assembled system prompt length and content
- **Fix:** Single source for system prompt — either DB or code, not both concatenated

### FM-05: No Recency Awareness in History
- **Symptom:** AI greets again after just sending a message minutes ago; AI asks question already answered
- **Root cause:** History format `[DD.MM HH:MM | Клиент/Продавец]: text` provides timestamps but the model doesn't reliably reason about time differences in this format. Also, the instructions say "check timestamps" but timestamps in DD.MM format don't clearly convey "5 minutes ago" vs "3 days ago"
- **Where:** [chat-service.ts:201-207](src/core/services/chat-service.ts#L201)
- **How to diagnose:** Look at AI outputs where seller has just sent a message and AI generates greeting
- **Fix:** Add explicit recency marker: `"Последнее сообщение: 5 мин назад"` or `"Сегодня, 14:30"`

### FM-06: Phase Detection Too Coarse
- **Symptom:** AI proposes compensation when client hasn't shared problem yet, or stays in "discovery" mode when conversation has progressed
- **Root cause:** Phase is based solely on `clientMessageCount` (0=discovery, 1=proposal, 2+=resolution). But a client who sent 2 one-word messages ("да", "ок") is in "resolution" phase even though no real conversation has happened
- **Where:** [ai-context.ts:21-33](src/lib/ai-context.ts#L21)
- **How to diagnose:** Find chats where tag=deletion_offered but client only sent "ок"
- **Fix:** Phase detection should consider message content/length, not just count

### FM-07: Temperature 0.7 Produces High Variance
- **Symptom:** Same chat generates wildly different replies on retry; sometimes formal, sometimes casual
- **Root cause:** Temperature 0.7 is relatively high for business communication. For `deepseek-chat` in Russian, this can produce significant variance
- **Where:** [assistant-utils.ts:133](src/ai/assistant-utils.ts#L133)
- **How to diagnose:** Generate 5 replies for the same chat, measure variance in length/tone/content
- **Fix:** Reduce temperature to 0.3-0.5 for chat replies; keep 0.7 for creative tasks only

### FM-08: No Post-Generation Validation
- **Symptom:** AI output contains forbidden phrases ("удалите отзыв"), exceeds length, or halluccinates compensation amounts
- **Root cause:** Raw AI output is saved directly to `draft_reply` with no validation except OZON 1000-char trim. No checks for: forbidden phrases, correct compensation amounts, correct greeting behavior, proper Russian
- **Where:** [chat-service.ts:320-324](src/core/services/chat-service.ts#L320)
- **How to diagnose:** Grep ai_logs for drafts containing "удалите отзыв", "удалить отзыв"
- **Fix:** Add post-generation validator: regex for forbidden phrases, compensation amount check, length limits

### FM-09: Compensation Amount Not in Context When Needed
- **Symptom:** AI mentions compensation but gives wrong amount or doesn't mention it when it should
- **Root cause:** In "resolution" phase, AI needs exact compensation amount. But `productRulesContext` only says "Компенсация: до 500₽" — the word "до" makes it ambiguous. Also, `DEFAULT_AI_INSTRUCTIONS` says "НЕ называй точную сумму в этой фазе" (proposal phase) but then in resolution phase there's no explicit instruction to name the exact amount
- **Where:** [chat-service.ts:226-227](src/core/services/chat-service.ts#L226), [ai-context.ts:158](src/lib/ai-context.ts#L158)
- **How to diagnose:** Check drafts where compensation was expected but not mentioned (or vice versa)
- **Fix:** Clearer context: `Компенсация: РОВНО 500₽ (кешбэк)`. Phase-specific instruction: "В фазе решение ОБЯЗАТЕЛЬНО назови сумму 500₽"

### FM-10: Repeating Previous Seller Message
- **Symptom:** AI generates reply that's very similar to the last seller message already in history
- **Root cause:** The `lastSellerText` field (last 200 chars of last seller message) is in context, and instruction says "НЕЛЬЗЯ повторять фразы из поля 'Последнее сообщение продавца' дословно". But deepseek-chat is weak at negative instructions — it sees the text and often paraphrases it closely
- **Where:** [ai-context.ts:106-108](src/lib/ai-context.ts#L106)
- **How to diagnose:** Compare generated draft with last seller message for cosine similarity
- **Fix:** In prompt, add explicit positive instruction: "Напиши НОВОЕ сообщение, которое ПРОДВИГАЕТ разговор дальше. Предыдущее сообщение уже отправлено — не повторяй его содержание"

### FM-11: OZON vs WB Tone Confusion
- **Symptom:** AI uses WB-specific language for OZON chats (mentions "удаление отзыва") or vice versa
- **Root cause:** `OZON_MARKETPLACE_ADDENDUM` is appended to store instructions, but `user_settings.prompt_chat_reply` (the primary system prompt) may contain WB-specific language. The model sees conflicting instructions
- **Where:** [ai-context.ts:179-216](src/lib/ai-context.ts#L179)
- **How to diagnose:** Generate for OZON chat, check if draft mentions "удаление отзыва"
- **Fix:** Marketplace-specific prompts (not addendum patching). Or: explicit `## ЗАПРЕЩЕНО на OZON:` section at the TOP of system prompt for OZON chats

### FM-12: No Structured Output for Chat Replies
- **Symptom:** AI sometimes adds meta-commentary, greetings it shouldn't, or formatting markers
- **Root cause:** Chat reply flow uses plain text output (not JSON mode). The model sometimes adds preamble ("Вот мой ответ:"), markdown formatting, or explanations
- **Where:** [generate-chat-reply-flow.ts](src/ai/flows/generate-chat-reply-flow.ts) — `isJsonMode` not used
- **How to diagnose:** Grep ai_logs for responses containing "Вот", "Мой ответ:", "```", etc.
- **Fix:** Either use JSON mode with `{"reply": "..."}` format, or add explicit instruction "Output ONLY the message text. No preamble, no explanations, no formatting"

### FM-13: FAQ/Guides Injection Without Relevance Filtering
- **Symptom:** AI response mentions FAQ answers unrelated to client's actual question
- **Root cause:** `buildStoreInstructions()` injects ALL active FAQ entries and guides into context, regardless of relevance to the current chat. A store with 15 FAQ entries adds ~2000+ tokens of irrelevant content
- **Where:** [ai-context.ts:229-248](src/lib/ai-context.ts#L229)
- **How to diagnose:** Check stores with many FAQ entries — does AI reference unrelated FAQ?
- **Fix:** Relevance filtering (keyword match or embedding similarity) before injection. Or limit to top 3-5 most relevant entries

### FM-14: review_text Truncated at 500 Chars Without Warning
- **Symptom:** AI doesn't address specific details mentioned at the end of a long review
- **Root cause:** Review text is truncated to 500 chars (`rcl.review_text.slice(0, 500) + '...'`). Long reviews with key details at the end lose context
- **Where:** [chat-service.ts:256](src/core/services/chat-service.ts#L256)
- **How to diagnose:** Find chats where review > 500 chars and AI missed a point from the truncated part
- **Fix:** Smarter truncation: extract key sentences or keep first + last paragraphs

---

## 5. Target Architecture Options

### Option A: Single Source Prompt + Shared Context Builder (Recommended)

**Concept:** Consolidate all prompt logic into a single `ChatPromptBuilder` class. System prompt comes from code (versioned), with DB overrides for per-store customization. One `buildContext()` method used everywhere.

```
ChatPromptBuilder
  ├─ buildSystemPrompt(marketplace, storeOverrides?)
  │   └─ BASE_PROMPT + marketplace addendum + store overrides (merged, not replaced)
  ├─ buildUserContext(chat, messages, rules, review, phase)
  │   └─ Structured sections with windowed history
  └─ validate(output) → { text, warnings[] }
```

**Pros:**
- Simplest migration path — restructure existing code, no new paradigm
- Prompt versioning in code (git history)
- Clear separation: system prompt (behavior) vs user context (data)
- Easy to test: unit test prompt builder with fixture data

**Cons:**
- Still one big prompt → hard to compose/extend
- No structured output validation built-in

**Complexity:** S-M
**Risk:** Low
**Migration:** 2-3 PRs (extract builder → migrate routes → add validation)

### Option B: Policy Layer + Prompt Composer

**Concept:** Separate "what to say" (Prompt Composer) from "what NOT to say" (Policy Layer). Policy Layer applies hard business constraints as post-processing.

```
PromptComposer
  ├─ modules: [PersonaModule, CompensationModule, MarketplaceModule, PhaseModule]
  └─ compose() → system prompt + user context

PolicyLayer
  ├─ rules: [NoDeleteMention, CompensationGating, OzonCharLimit, NoGreetingRepeat]
  └─ apply(draft) → { text, violations[] }
```

**Pros:**
- Clear separation of concerns
- Policies are testable independently (regex/rule-based)
- Easy to add new constraints without touching prompts
- Violations are observable/loggable

**Cons:**
- More complex architecture
- Policy layer can't fix deep quality issues (only catch surface violations)
- Two systems to maintain

**Complexity:** M-L
**Risk:** Medium
**Migration:** 4-5 PRs

### Option C: Agent with Tools / Structured Outputs

**Concept:** Replace single-shot completion with an agent that uses tools to fetch context on-demand. Structured JSON output with explicit fields.

```
ChatAgent
  ├─ tools: [getReviewInfo, getProductRules, getChatHistory, getCompensationPolicy]
  ├─ structured output: { intent, reply_text, ask_clarification, next_action }
  └─ renderer: format for marketplace (WB text, OZON 1000-char)
```

**Pros:**
- Model fetches only what it needs → smaller context, higher relevance
- Structured output → easier validation
- Agent-like reasoning → better quality for complex cases
- Future-proof for multi-turn reasoning

**Cons:**
- Deepseek-chat has limited/no tool calling support
- Would require switching to Claude/GPT-4 (cost increase)
- Significantly more complex
- Latency increase (multiple API calls)
- Overkill for current scale

**Complexity:** L-XL
**Risk:** High
**Migration:** Full rewrite of AI pipeline

### Recommendation: **Option A** with elements of **Option B**

Given the context (small team, production system, deepseek-chat model, fast iteration cycles):

1. Start with **Option A** — consolidate prompt builder, version prompts in code
2. Add a **lightweight Policy Layer** from Option B — just post-generation validation (forbidden phrases, compensation check, length limits)
3. **Defer Option C** until model upgrade (Claude/GPT-4) is justified by revenue

This gives 80% of quality improvement with 20% of complexity.

---

## 6. Improvement Plan — Stages

### Stage 0: Parity Fix + Observability Foundation
**Objective:** Eliminate remaining divergence, make AI behavior auditable

**Scope:**
- Refactor bulk `generate-ai` route to call `ChatService.generateReply()` per chat (eliminate ~100 LOC duplication)
- Add logging: full assembled prompt length, token count, generation latency, context sections used
- Query and document current `user_settings.prompt_chat_reply` content

**DoD:**
- [ ] Bulk route uses `generateReply()` from chat-service (single source of truth)
- [ ] OZON 1000-char trim works for bulk generation
- [ ] ai_logs records prompt length and key context flags
- [ ] `user_settings.prompt_chat_reply` documented in `docs/domains/chats-ai.md`

**Risks:** Bulk generation slower (sequential per chat vs could parallel). Rollback: revert bulk route.
**How to test:** Bulk generate for 5 chats, compare drafts quality vs before. Check OZON drafts ≤1000 chars.

---

### Stage 1: Context Quality — Windowing + Recency
**Objective:** Reduce noise in AI context, improve recency awareness

**Scope:**
- Add chat history windowing: last 20 messages (configurable), with summary of earlier messages
- Add explicit recency marker: "Последнее сообщение отправлено [X минут/часов/дней] назад"
- Improve phase detection: consider message content/length, not just count
- Limit FAQ/guides injection to top 5 most relevant entries (keyword match)
- Review text: keep first 300 + last 200 chars for long reviews (not just first 500)

**DoD:**
- [ ] Chat history windowed to 20 messages in context
- [ ] Older messages summarized as "Ранее обсуждалось: [краткая сводка]" (or count)
- [ ] Recency marker appears in context
- [ ] Phase detection uses message content heuristic
- [ ] FAQ limited to 5 entries

**Risks:** History windowing may cut important early context. Rollback: increase window or remove.
**How to test:** Generate for 10 chats with 30+ messages. Compare quality before/after. Check that recent context is addressed.

---

### Stage 2: Prompt Rewrite + Model Params
**Objective:** Rewrite system prompt for clarity, reduce temperature for consistency

**Scope:**
- Move `prompt_chat_reply` from DB to code as `SYSTEM_PROMPT_CHAT_REPLY_V2` (versioned)
- Restructure prompt: clear sections with numbered rules, examples for each phase
- Fix `buildStoreInstructions()` to MERGE custom instructions with defaults (not replace)
- Add explicit output format instruction: "Output ONLY the message text"
- Reduce temperature from 0.7 to 0.4 for chat replies
- Add marketplace-specific system prompts (not addendum patching)
- Fix compensation language: "РОВНО X₽" instead of "до X₽"

**DoD:**
- [ ] System prompt is in code, versioned, with clear section structure
- [ ] Custom store instructions are additive (merged, not override)
- [ ] Temperature = 0.4 for generate-chat-reply
- [ ] OZON and WB have separate prompt paths (not addendum)
- [ ] Compensation amount is explicit in context

**Risks:** Prompt change = behavior change for ALL chats. Rollback: revert prompt to DB value.
**How to test:** Golden set of 20 conversations (see Stage 3). A/B test on 10% traffic if possible.

---

### Stage 3: Evaluation Harness — Golden Set + Regression
**Objective:** Build measurable quality baseline

**Scope:**
- Create golden set: 30 real conversations (sanitized) across WB 1-3★, WB 4-5★, OZON, different phases
- Define rubric: relevance (0-5), helpfulness (0-5), compliance (pass/fail), tone (pass/fail), compensation correctness (pass/fail)
- Build evaluation script: runs `generateReply()` on golden set, logs results, computes scores
- Set baseline scores before any prompt changes

**DoD:**
- [ ] 30 golden conversations in `tests/golden/` (sanitized)
- [ ] Evaluation script runs and produces scores
- [ ] Baseline scores documented
- [ ] CI integration (optional): golden set run on prompt changes

**Risks:** Golden set may not be representative. Mitigation: select diverse cases.
**How to test:** Run evaluation script, review scores manually for sanity.

---

### Stage 4: Post-Generation Validation (Policy Layer)
**Objective:** Catch and fix obvious AI mistakes before saving draft

**Scope:**
- Build lightweight `validateDraft()` function:
  - Forbidden phrases: "удалите отзыв", "удалить отзыв", "убрать отзыв" (for WB+OZON)
  - OZON-specific: block "удаление" entirely
  - Compensation check: if mentioned, verify amount matches product_rules
  - Greeting check: if `sellerMessageCount > 0`, flag "Здравствуйте" / "Добрый день" as warning
  - Length check: WB ≤ 2000 chars, OZON ≤ 1000 chars
- Log violations (don't block — just flag for human review initially)
- Add `draft_validation_warnings` field to chat update (or ai_logs metadata)

**DoD:**
- [ ] `validateDraft()` checks 5+ rules
- [ ] Violations logged with severity (warning vs error)
- [ ] Error-level violations trigger regeneration (with modified prompt)
- [ ] Warning-level violations saved to metadata
- [ ] No forbidden phrases in production drafts (measurable)

**Risks:** Over-aggressive validation may reject good drafts. Rollback: disable validation, save all drafts.
**How to test:** Run validator on last 100 ai_logs drafts. Check false positive rate.

---

### Stage 5: Monitoring + Feedback Loop
**Objective:** Continuous quality measurement and improvement

**Scope:**
- Dashboard metrics: p50/p95 latency, tokens in/out, error rate, validation violation rate
- "Draft edited" tracking: if seller edits draft before sending, capture diff (already have `draft_reply_edited` boolean)
- Expand `draft_reply_edited` to store edit distance (how much was changed)
- Monthly golden set evaluation run
- Alert on: error rate > 5%, average latency > 10s, validation violation rate > 20%

**DoD:**
- [ ] Metrics logged and queryable (SQL or monitoring)
- [ ] Edit distance tracked for drafts
- [ ] Monthly evaluation cadence established
- [ ] Alerts configured

**Risks:** Metric collection overhead. Mitigation: async logging.
**How to test:** Generate 50 drafts, verify metrics are captured.

---

## 7. Evaluation & Monitoring

### 7.1 Golden Set Design

| Category | Count | Criteria |
|----------|-------|----------|
| WB 1-3★, discovery phase | 5 | First contact, no client reply yet |
| WB 1-3★, proposal phase | 5 | Client replied once, problem described |
| WB 1-3★, resolution phase | 5 | Multi-turn, compensation discussion |
| WB 4-5★ | 5 | No compensation, upgrade to 5★ path |
| OZON, mixed | 5 | OZON-specific: "дополнить отзыв", 1000-char |
| Edge cases | 5 | Spam, refund-only, angry client, already resolved |

**Total: 30 conversations**

### 7.2 Rubric

| Dimension | Scale | Criteria |
|-----------|-------|----------|
| **Relevance** | 0-5 | Reply addresses client's actual concern |
| **Helpfulness** | 0-5 | Reply moves conversation toward resolution |
| **Compliance** | Pass/Fail | No forbidden phrases, correct marketplace, correct phase behavior |
| **Tone** | Pass/Fail | Warm, human, not robotic or aggressive |
| **Compensation** | Pass/Fail | Correct gating (1-3★ vs 4-5★), correct amount if mentioned |
| **Escalation** | Pass/Fail | Asks for details when needed, doesn't skip steps |
| **Uniqueness** | Pass/Fail | Doesn't repeat last seller message |

### 7.3 Automated Invariants

```
1. IF review_rating >= 4 THEN draft MUST NOT contain compensation amount
2. IF marketplace == 'ozon' THEN draft MUST NOT contain "удал" (удаление/удалить)
3. IF marketplace == 'ozon' THEN len(draft) <= 1000
4. IF seller_message_count > 0 THEN draft SHOULD NOT start with greeting
5. IF phase == 'discovery' THEN draft MUST end with question mark
6. draft MUST NOT contain "удалите отзыв" or "удалить отзыв"
7. draft MUST NOT contain markdown formatting (**, ##, ```)
8. draft length MUST be between 50 and 2000 chars
```

### 7.4 Metrics

| Metric | Source | Target |
|--------|--------|--------|
| Generation latency p50 | ai_logs.created_at to completion | < 3s |
| Generation latency p95 | ai_logs | < 8s |
| Tokens in | ai_logs.tokens_used | Track trend |
| Error rate | ai_logs.error IS NOT NULL | < 2% |
| Validation violation rate | New field | < 10% |
| Draft edit rate | chats.draft_reply_edited = true | Track (no target) |
| Invariant pass rate | Golden set | > 95% |

### 7.5 Data Sanitization

For golden set:
- Replace real client names with "Клиент_001", "Клиент_002"
- Replace phone numbers/emails with `[PHONE]`, `[EMAIL]`
- Replace specific order IDs with `[ORDER_ID]`
- Keep: product names, ratings, timestamps, message content (needed for quality evaluation)
- Store in `tests/golden/` with `.gitignore` for actual production data
- Consider creating synthetic variants based on real patterns

---

## 8. Appendix: File Inventory

### 8.1 AI Flow Files

| File | Function | Role |
|------|----------|------|
| [src/ai/assistant-utils.ts](src/ai/assistant-utils.ts) | `runChatCompletion()` | Core API call to Deepseek |
| [src/ai/flows/generate-chat-reply-flow.ts](src/ai/flows/generate-chat-reply-flow.ts) | `generateChatReply()` | Chat reply generation flow |
| [src/ai/flows/classify-chat-tag-flow.ts](src/ai/flows/classify-chat-tag-flow.ts) | `classifyChatTag()` | Chat tag classification |
| [src/ai/flows/classify-chat-deletion-flow.ts](src/ai/flows/classify-chat-deletion-flow.ts) | `classifyChatDeletion()` | Deletion workflow classification |
| [src/ai/flows/generate-deletion-offer-flow.ts](src/ai/flows/generate-deletion-offer-flow.ts) | `generateDeletionOffer()` | Compensation offer generation |
| [src/ai/flows/generate-review-reply-flow.ts](src/ai/flows/generate-review-reply-flow.ts) | `generateReviewReply()` | Review reply generation |
| [src/ai/flows/generate-question-reply-flow.ts](src/ai/flows/generate-question-reply-flow.ts) | `generateQuestionReply()` | Question reply generation |
| [src/ai/flows/generate-review-complaint-flow.ts](src/ai/flows/generate-review-complaint-flow.ts) | `generateReviewComplaint()` | Review complaint generation |
| [src/ai/flows/analyze-store-dialogues-flow.ts](src/ai/flows/analyze-store-dialogues-flow.ts) | `analyzeStoreDialogues()` | FAQ/guides extraction |

### 8.2 Prompt Files

| File | Content |
|------|---------|
| [src/ai/prompts/deletion-offer-prompt.ts](src/ai/prompts/deletion-offer-prompt.ts) | `DELETION_OFFER_PROMPT` — hardcoded system prompt for deletion offers |
| [src/ai/prompts/chat-deletion-classification-prompt.ts](src/ai/prompts/chat-deletion-classification-prompt.ts) | `CHAT_DELETION_CLASSIFICATION_PROMPT` — hardcoded for deletion classification |
| [src/ai/prompts/optimized-review-complaint-prompt.ts](src/ai/prompts/optimized-review-complaint-prompt.ts) | `buildOptimizedSystemPrompt()` — complaint prompt builder |
| [src/lib/ai-context.ts](src/lib/ai-context.ts) | `DEFAULT_AI_INSTRUCTIONS`, `OZON_MARKETPLACE_ADDENDUM`, `buildStoreInstructions()` |

### 8.3 Route Files (AI-related)

| File | Endpoint |
|------|----------|
| [src/app/api/stores/[storeId]/chats/[chatId]/generate-ai/route.ts](src/app/api/stores/[storeId]/chats/[chatId]/generate-ai/route.ts) | Web single-chat AI gen |
| [src/app/api/telegram/chats/[chatId]/generate-ai/route.ts](src/app/api/telegram/chats/[chatId]/generate-ai/route.ts) | TMA AI gen |
| [src/app/api/stores/[storeId]/chats/bulk/generate-ai/route.ts](src/app/api/stores/[storeId]/chats/bulk/generate-ai/route.ts) | Web bulk AI gen (**DIVERGENT**) |

### 8.4 Service & Repository Files

| File | Key Functions |
|------|---------------|
| [src/core/services/chat-service.ts](src/core/services/chat-service.ts) | `generateReply()`, `sendMessage()`, `getChatDetail()` |
| [src/core/services/message-sender.ts](src/core/services/message-sender.ts) | `sendMessageToMarketplace()` |
| [src/db/repositories/chat-repository.ts](src/db/repositories/chat-repository.ts) | `findChatWithAiInstructions()`, `findMessagesForAi()` |
| [src/db/review-chat-link-helpers.ts](src/db/review-chat-link-helpers.ts) | `findLinkWithReviewByChatId()` |
| [src/lib/auto-sequence-sender.ts](src/lib/auto-sequence-sender.ts) | `sendSequenceMessage()` (template-based, no AI) |
| [src/lib/auto-sequence-templates.ts](src/lib/auto-sequence-templates.ts) | Template messages for sequences |

### 8.5 Configuration Points

| What | Where | Current Value |
|------|-------|---------------|
| Model | [assistant-utils.ts:128](src/ai/assistant-utils.ts#L128) | `deepseek-chat` |
| Temperature | [assistant-utils.ts:133](src/ai/assistant-utils.ts#L133) | `0.7` |
| Max tokens | [assistant-utils.ts:134](src/ai/assistant-utils.ts#L134) | `2048` |
| API key | [assistant-utils.ts:121](src/ai/assistant-utils.ts#L121) | `user_settings.deepseek_api_key` or `DEEPSEEK_API_KEY` env |
| System prompts | `user_settings` table | `prompt_chat_reply`, `prompt_chat_tag`, `prompt_review_reply`, `prompt_question_reply`, `prompt_review_complaint`, `prompt_deletion_offer`, `prompt_chat_deletion_tag` |
| Store instructions | `stores.ai_instructions` | Per-store TEXT field |
| Default instructions | [ai-context.ts:97-173](src/lib/ai-context.ts#L97) | `DEFAULT_AI_INSTRUCTIONS` (173 lines) |
| OZON addendum | [ai-context.ts:179-216](src/lib/ai-context.ts#L179) | `OZON_MARKETPLACE_ADDENDUM` (38 lines) |
| History window | [chat-repository.ts:88](src/db/repositories/chat-repository.ts#L88) | **NO LIMIT** (all messages) |
| Review text trim | [chat-service.ts:256](src/core/services/chat-service.ts#L256) | 500 chars |
| OZON message limit | [chat-service.ts:306](src/core/services/chat-service.ts#L306) | 1000 chars |
