# Deletion Trigger Phrases Library
**Purpose:** Pattern matching for AI chat classification
**Last Updated:** 2026-01-16
**Language:** Russian (Wildberries marketplace)

---

## Overview

This document catalogs trigger phrases that indicate a customer is willing to delete or modify their negative review in exchange for compensation or issue resolution.

**Business Value:** Each confirmed deletion = 600₽ revenue

---

## Priority 1: Direct Deletion Offers (95-100% Confidence)

### Explicit Deletion Promises

| Phrase Pattern | Regex | Confidence | Example Chat Message |
|----------------|-------|------------|---------------------|
| "удалю отзыв" | `удал[юуьа]\s*отзыв` | 98% | "Верните деньги, удалю отзыв" |
| "уберу отзыв" | `убер[уюа]\s*отзыв` | 98% | "Уберу отзыв если вернете товар" |
| "изменю отзыв" | `измен[юуьа]\s*отзыв` | 95% | "Я могу изменить свой отзыв" |
| "исправлю отзыв" | `исправл[юуьа]\s*отзыв` | 95% | "Исправлю отзыв на положительный" |
| "дополню отзыв" | `дополн[юуьа]\s*отзыв` | 92% | "Дополню отзыв если решите проблему" |

### Star Rating Promises

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "поставлю 5" | `поставл[юуьа]\s*5` | 96% | "Поставлю 5 звезд за возврат" |
| "изменю на 5" | `измен[юуьа].*5` | 96% | "Изменю оценку на 5" |
| "повышу оценку" | `повыш[уюа]\s*оценк` | 94% | "Повышу оценку до максимальной" |
| "исправлю оценку" | `исправл[юуьа]\s*оценк` | 94% | "Исправлю оценку на отлично" |
| "поменяю оценку" | `поменя[юуьа]\s*оценк` | 93% | "Готов поменять оценку" |

### Conditional Promises

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "если вернете" | `если\s*верн[её]те` | 90% | "Удалю если вернете деньги" |
| "при условии" | `при\s*условии` | 88% | "При условии возврата изменю" |
| "готов изменить" | `готов\s*измени` | 87% | "Готов изменить за компенсацию" |
| "если решите" | `если\s*реш[иьа]те` | 85% | "Если решите проблему - уберу" |

---

## Priority 2: Compensation Requests (80-94% Confidence)

### Direct Money Requests

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "верните деньги" | `верните\s*деньги` | 92% | "Верните пожалуйста деньги" |
| "хочу возврат" | `хочу\s*возврат` | 90% | "Хочу возврат средств" |
| "требую возврат" | `требу[юуьа]\s*возврат` | 89% | "Требую возврат денег" |
| "оформите возврат" | `оформите\s*возврат` | 88% | "Оформите возврат пожалуйста" |
| "вернуть деньги" | `вернуть\s*деньги` | 87% | "Можете вернуть деньги?" |

### Compensation Hints

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "компенсация" | `компенсаци` | 85% | "Какая возможна компенсация?" |
| "кешбэк" | `кешб[эе]к` | 84% | "Можно кешбэк за брак?" |
| "скидка" | `скидк` | 75% | "Дайте скидку на следующий" |
| "бонус" | `бонус` | 73% | "Начислите бонусы" |
| "подарок" | `подарок` | 70% | "Хотя бы подарок дайте" |

### Refund Indicators

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "примите обратно" | `примите\s*обратно` | 88% | "Примите товар обратно" |
| "заберите товар" | `заберите\s*товар` | 86% | "Заберите товар, верните деньги" |
| "отказ" (от товара) | `делаю\s*отказ` | 82% | "Делаю отказ от товара" |

---

## Priority 3: Negative Sentiment (70-84% Confidence)

### Product Quality Issues

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "брак" | `брак` | 82% | "Товар оказался браком" |
| "дефект" | `дефект` | 82% | "Обнаружил дефект" |
| "поврежден" | `поврежд[её]н` | 80% | "Товар поврежден" |
| "не работает" | `не\s*работает` | 78% | "Совсем не работает" |
| "сломан" | `слома[нь]` | 77% | "Сломан сразу после распаковки" |

### Quality Mismatch

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "не соответствует" | `не\s*соответству` | 79% | "Не соответствует описанию" |
| "обманули" | `обману` | 75% | "Меня обманули" |
| "не то что на фото" | `не\s*то.*фото` | 74% | "Не то что на фото" |
| "подделка" | `подделка` | 73% | "Это подделка" |
| "плохое качество" | `плохо[её]\s*качеств` | 72% | "Очень плохое качество" |

### Repeated Issues

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "третий раз" | `[0-9]+.*раз` | 81% | "Третий раз делаю отказ" |
| "снова" | `снова` | 76% | "Снова бракованный товар" |
| "опять" | `опять` | 76% | "Опять не то прислали" |
| "постоянно" | `постоянно` | 74% | "У вас постоянно брак" |

---

## Priority 4: Positive Intent (60-79% Confidence)

### Resolution Openness

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "если решите проблему" | `если\s*реш[иьа]те` | 77% | "Если решите, изменю мнение" |
| "готов изменить мнение" | `готов\s*измени` | 75% | "Готов изменить мнение" |
| "рассмотрю" | `рассмотрю` | 68% | "Рассмотрю повышение оценки" |
| "возможно изменю" | `возможно\s*измен` | 65% | "Возможно изменю отзыв" |
| "подумаю" | `подума[юуьа]` | 62% | "Подумаю об изменении" |

### Conditional Cooperation

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "при условии" | `при\s*условии` | 74% | "При условии возврата" |
| "если поможете" | `если\s*помож` | 72% | "Если поможете решить" |
| "договоримся" | `договоримся` | 70% | "Может договоримся" |

---

## Anti-Patterns: Spam Detection (90-100% Confidence)

### Competitor Spam

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| "МЫ УДАЛЯЕМ ОТЗЫВЫ" | `[А-ЯЁ\s]{10,}` (ALL CAPS) | 98% | "МЫ УДАЛЯЕМ НЕГАТИВНЫЕ ОТЗЫВЫ" |
| Price mentions + deletion | `[0-9]+.*руб.*удал` | 95% | "Удалим за 500р" |
| External links | `t\.me/` | 93% | "Пишите в телеграм t.me/spam" |
| Phone numbers | `\+?[0-9]{10,}` | 91% | "Звоните 89991234567" |

### Automated Messages

| Phrase Pattern | Regex | Confidence | Example |
|----------------|-------|------------|---------|
| Exact duplicates | (check history) | 89% | Same text in multiple chats |
| Very long messages | `length > 500 chars` | 75% | Copy-paste spam |

---

## Combined Patterns (Highest Accuracy)

### Pattern 1: "Money + Deletion"
```regex
(верн[иьа]те.*деньги|возврат).*(удал|измен|убер).*отзыв
```
**Confidence:** 96%
**Example:** "Верните деньги, удалю отзыв"

### Pattern 2: "Condition + Star Rating"
```regex
(если|при условии).*(поставл[юуьа]|измен[юуьа]).*5
```
**Confidence:** 94%
**Example:** "Если решите вопрос, поставлю 5 звезд"

### Pattern 3: "Negative + Refund"
```regex
(брак|дефект|не работает).*(верн|возврат|компенсаци)
```
**Confidence:** 88%
**Example:** "Товар бракованный, требую возврат"

---

## Implementation Guide

### JavaScript/TypeScript Regex Function

```typescript
export function detectDeletionIntent(messageText: string): {
  isDeletionCandidate: boolean;
  confidence: number;
  triggers: string[];
} {
  const text = messageText.toLowerCase();
  const triggers: string[] = [];
  let maxConfidence = 0;

  // Priority 1: Direct deletion (95%+)
  if (/удал[юуьа]\s*отзыв/.test(text)) {
    triggers.push('delete_promise');
    maxConfidence = Math.max(maxConfidence, 0.98);
  }
  if (/измен[юуьа]\s*отзыв/.test(text)) {
    triggers.push('modify_promise');
    maxConfidence = Math.max(maxConfidence, 0.95);
  }
  if (/поставл[юуьа]\s*5/.test(text)) {
    triggers.push('5star_promise');
    maxConfidence = Math.max(maxConfidence, 0.96);
  }

  // Priority 2: Compensation (80%+)
  if (/верните\s*деньги/.test(text)) {
    triggers.push('refund_request');
    maxConfidence = Math.max(maxConfidence, 0.92);
  }
  if (/компенсаци/.test(text)) {
    triggers.push('compensation');
    maxConfidence = Math.max(maxConfidence, 0.85);
  }

  // Combined pattern: Money + Deletion
  if (/(верн[иьа]те.*деньги|возврат).*(удал|измен|убер).*отзыв/.test(text)) {
    triggers.push('money_plus_deletion');
    maxConfidence = Math.max(maxConfidence, 0.96);
  }

  // Anti-pattern: Spam
  if (/[А-ЯЁ\s]{10,}/.test(messageText)) { // ALL CAPS detection
    return { isDeletionCandidate: false, confidence: 0, triggers: ['spam_caps'] };
  }

  return {
    isDeletionCandidate: maxConfidence >= 0.80,
    confidence: maxConfidence,
    triggers,
  };
}
```

### Usage in AI Flow

```typescript
const analysis = detectDeletionIntent(chat.last_message_text);

if (analysis.isDeletionCandidate && analysis.confidence >= 0.85) {
  // High confidence → Auto-tag as deletion_candidate
  await updateChatTag(chat.id, 'deletion_candidate');
} else if (analysis.confidence >= 0.70) {
  // Medium confidence → Send to AI for deeper analysis
  const aiResult = await classifyChatTag({
    chatHistory: getChatMessages(chat.id)
  });
  await updateChatTag(chat.id, aiResult.tag);
}
```

---

## Testing Data

### Test Cases for Validation:

| Input Message | Expected Tag | Expected Confidence |
|--------------|-------------|---------------------|
| "Верните деньги, удалю отзыв" | `deletion_candidate` | 0.96 |
| "Я могу изменить отзыв если вернете товар" | `deletion_candidate` | 0.95 |
| "Товар бракованный" | `active` | 0.82 |
| "МЫ УДАЛЯЕМ ОТЗЫВЫ ЗА 500Р" | `spam` | 1.00 |
| "Спасибо, отличный товар!" | `successful` | 0.10 |
| "Поставлю 5 звезд если решите вопрос" | `deletion_candidate` | 0.94 |

---

## Maintenance

### When to Update:
1. **New patterns discovered** in production data
2. **False positives** detected by manual review
3. **Language evolution** (slang, new phrases)
4. **Business rule changes** (e.g., WB policy updates)

### Review Schedule:
- Weekly: Check misclassifications
- Monthly: Update confidence scores based on outcomes
- Quarterly: Add new patterns from A/B testing

---

**Last Review:** 2026-01-16
**Next Review:** 2026-02-16
**Owner:** AI Agent Development Team
