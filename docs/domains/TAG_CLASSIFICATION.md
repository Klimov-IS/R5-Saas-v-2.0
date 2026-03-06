# Regex Tag Classification System

> Created: 2026-03-06
> Status: Active
> Replaces: AI-based `classify-chat-deletion` flow (disabled migration 024)

## Context

Previously, chat tags were set by an AI classification flow (`classify-chat-deletion`).
After onboarding a large store (9,873 chats), API costs exploded from ~$3/day to $12/day.
93% of chats stayed `untagged`, making AI classification wasteful.

**Decision:** Replace AI with regex-based classification.

## Tag System (4 tags + null)

| Tag | How Set | Meaning | Trigger |
|-----|---------|---------|---------|
| `null` | Default | New chat, not yet processed | — |
| `deletion_candidate` | **Auto** (on RCL creation) | Chat linked to review, eligible for work | `review_chat_links` INSERT |
| `deletion_offered` | **Regex** (seller message) | Compensation/deletion offer sent | Seller mentions compensation, cashback, rating change |
| `deletion_agreed` | **Regex** (buyer message) | Buyer agreed to delete/modify review | Buyer promises to delete, asks how, agrees |
| `deletion_confirmed` | **Regex** (buyer or seller) | Review deleted/modified | Past tense: "удалил", "отзыв удалён" |

### Progression (forward-only)

```
null → deletion_candidate → deletion_offered → deletion_agreed → deletion_confirmed
```

Tags can only move FORWARD. A chat at `deletion_agreed` cannot be downgraded to `deletion_offered`.

## Classification Module

**File:** `src/lib/tag-classifier.ts`

### Main API

```typescript
// Classify full conversation
classifyTagFromMessages(messages, currentTag?) → TagClassificationResult

// Quick single-message checks
isOfferMessage(text) → boolean       // seller sent an offer?
isAgreementMessage(text) → boolean   // buyer agreed?
isConfirmationMessage(text, sender) → boolean  // deletion confirmed?
```

### Input

```typescript
interface ChatMessageForClassification {
  sender: 'client' | 'seller';
  text: string;
}
```

### Output

```typescript
interface TagClassificationResult {
  tag: ChatTag | null;      // highest detected tag
  confidence: number;       // 0-1
  triggers: string[];       // which patterns matched
  triggerMessageIndex?: number;
  triggerSender?: 'client' | 'seller';
}
```

## Pattern Rules

### `deletion_offered` — SELLER messages

Seller explicitly offers compensation, requests review deletion/modification, or proposes a deal.

| Pattern | Example | Confidence |
|---------|---------|------------|
| `компенсацию N рублей` | "компенсацию 500 рублей" | 0.98 |
| `кешбэк N₽` | "кешбэк 300₽" | 0.98 |
| `в обмен на удаление` | "в обмен на удаление отзыва" | 0.98 |
| `компенсация + удаление combo` | "компенсацию за удаление" | 0.97 |
| `перечислим на карту` | "перечислим на карту 1000" | 0.96 |
| `предлагаем компенсацию` | "предлагаем компенсацию" | 0.96 |
| `вернуть стоимость` | "вернуть полную стоимость" | 0.95 |
| `изменить оценку на 5` | "изменив оценку на 5" | 0.95 |
| `готовы предложить/вернуть` | "готовы вернуть деньги" | 0.94 |
| `дополните отзыв` | "дополните отзыв до 5" | 0.92 |
| `просим пересмотреть оценку` | "просим пересмотреть оценку" | 0.90 |

### `deletion_agreed` — BUYER messages

Buyer explicitly agrees to delete/modify review, or asks how to do it (implicit agreement).

| Pattern | Example | Confidence |
|---------|---------|------------|
| `удалю отзыв` | "удалю отзыв" | 0.97 |
| `согласна удалить` | "согласна удалить" | 0.97 |
| `сотру отзыв` | "сотру отзыв" | 0.97 |
| `хорошо/ок, удалю` | "хорошо, удалю" | 0.96 |
| `поставлю 5` | "поставлю 5 звёзд" | 0.96 |
| `изменю отзыв` | "изменю оценку" | 0.95 |
| `давайте, удалю` | "давайте, я удалю" | 0.95 |
| `согласна изменить` | "согласна изменить" | 0.95 |
| `сейчас/сегодня удалю` | "сейчас удалю" | 0.93 |
| `могу удалить` | "могу удалить" | 0.93 |
| `попробую удалить` | "попробую удалить" | 0.90 |
| `как удалить отзыв?` | "как удалить отзыв?" | 0.88 |
| `подскажите как удалить` | "подскажите как удалить" | 0.88 |
| `что нужно сделать?` | "что нужно сделать?" | 0.85 |

### `deletion_confirmed` — BUYER or SELLER

Past tense: buyer reports having deleted/modified, or seller confirms seeing it.

**Buyer patterns:**

| Pattern | Example | Confidence |
|---------|---------|------------|
| `удалил(а) отзыв` | "удалила отзыв" | 0.98 |
| `отзыв удалён` | "отзыв удалён" | 0.98 |
| `убрала отзыв` | "убрала отзыв" | 0.97 |
| `отзыв изменён/дополнен` | "отзыв дополнен" | 0.97 |
| `изменила отзыв` | "изменила отзыв" | 0.96 |
| `дополнила отзыв` | "дополнила отзыв" | 0.96 |
| `поставила 5` | "поставила 5 звёзд" | 0.96 |
| `всё исправила` | "всё исправила" | 0.95 |
| `оставила положительный отзыв` | "оставила положительный" | 0.94 |
| `Удалила` (standalone) | "Удалила" | 0.92 |

**Seller patterns:**

| Pattern | Example | Confidence |
|---------|---------|------------|
| `видим отзыв удалён` | "видим что отзыв был удалён" | 0.98 |
| `отзыв больше не виден` | "отзыв больше не отображается" | 0.97 |
| `спасибо за удаление` | "спасибо за удаление отзыва" | 0.96 |
| `отзыв был удалён/дополнен` | "отзыв был дополнен" | 0.95 |

## Anti-patterns (false positive protection)

Patterns that BLOCK classification to prevent false positives:

| Pattern | Example | Effect |
|---------|---------|--------|
| `не буду удалять` | "не буду удалять отзыв" | Blocks `deletion_agreed` |
| `не удалю` | "не удалю!" | Blocks `deletion_agreed` |
| `не хочу менять` | "не хочу менять отзыв" | Blocks `deletion_agreed` |
| `можно ли удалить` | "можно ли удалить?" | Blocks (policy question) |
| `чужой отзыв` | — | Blocks (other review) |

Anti-patterns reduce confidence by 70% for `deletion_agreed` and 50% for `deletion_confirmed`.

## Integration Points

### Current: Manual from TG Mini App

Tags are currently set **manually** from TG Mini App progression buttons. The regex classifier provides the RULES for how the operator decides.

### Future: Auto-classification in dialogue sync

When ready, the classifier can be integrated into dialogue sync to auto-set tags:

```typescript
import { classifyTagFromMessages } from '@/lib/tag-classifier';

// In dialogue sync, after fetching messages:
const result = classifyTagFromMessages(messages, chat.tag);
if (result.tag && result.confidence >= 0.90) {
  await updateChatTag(chatId, result.tag);
}
```

### Confidence threshold recommendation

- **>= 0.95**: Safe to auto-apply
- **0.85-0.95**: Auto-apply with logging
- **< 0.85**: Flag for manual review

## Testing

```bash
npx tsx tests/tag-classifier.test.ts
```

58 tests covering:
- 16 offered pattern tests (13 positive, 3 negative)
- 18 agreed pattern tests (15 positive, 3 anti-pattern)
- 13 confirmed pattern tests (9 buyer, 4 seller)
- 9 full conversation scenario tests
- 2 edge case tests (empty, forward guard)

## Technical Notes

- JS `\w` doesn't match Cyrillic — module uses a `re()` helper that replaces `{W+}` / `{W*}` with `[а-яёА-ЯЁa-zA-Z0-9]+` / `*`
- All patterns are case-insensitive (`/i` flag)
- Forward-only guard ensures tag progression never regresses
- Module is pure (no DB, no side effects) — easy to test and use anywhere
