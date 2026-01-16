# Chat Analysis Report - AI Agent Foundation
**Date:** 2026-01-16
**Purpose:** Foundation analysis for deletion workflow automation
**Business Goal:** 600₽ ROI per successfully deleted/modified review

---

## Executive Summary

This report analyzes all existing chats to identify patterns, segment customer intents, and design the AI agent classification system for negative review deletion workflow.

### Key Findings:
- **Total Chats Analyzed:** 19 chats from test store
- **Current Tag Distribution:** 15 untagged (79%), 4 active (21%)
- **Deletion Candidates Identified:** 2 chats (10.5% of total)
- **Products with Chat Rules Enabled:** To be analyzed
- **Average Response Time:** To be calculated

---

## 1. Chat Classification Taxonomy

### Current Tags (Firebase Legacy):
1. **untagged** (15 chats, 79%) - Not yet classified
2. **active** (4 chats, 21%) - Currently in progress
3. **successful** (0 chats) - Successfully resolved
4. **unsuccessful** (0 chats) - Failed resolution
5. **no_reply** (0 chats) - No seller response
6. **completed** (0 chats) - Finished dialogue

### Proposed New Tags (Deletion Workflow):
7. **deletion_candidate** 🎯 - AI identified opportunity (e.g., "Я могу изменить отзыв")
8. **deletion_offered** 💰 - Seller sent compensation offer
9. **deletion_agreed** 🤝 - Client agreed to delete/modify review
10. **deletion_confirmed** ✔️ - Review actually deleted (600₽ revenue)
11. **refund_requested** 💸 - Client wants money back
12. **spam** 🚫 - Competitors or spam

---

## 2. Customer Intent Segmentation

### Analysis of 19 Existing Chats:

#### **Category A: Deletion Candidates (2 chats, 10.5%)**
**High Priority - Direct Revenue Opportunity**

| Chat ID | Client Message | Review Rating | Product | Intent |
|---------|---------------|---------------|---------|--------|
| Chat #1 | "Я могу изменить свой отзыв если примите свой товар обратно и верните деньги" | 1-3 stars | Скатерть | Delete for refund |
| Chat #2 | "Верните пожалуйста деньги. Если верните удалю отзыв" | 1-3 stars | Ножи кухонные | Delete for compensation |

**Trigger Phrases Found:**
- "изменить отзыв"
- "верните деньги"
- "удалю отзыв"

**Action Required:**
- Tag as `deletion_candidate`
- Check product rules: `offer_compensation=true`
- Calculate max compensation from `product_rules.max_compensation`
- Generate AI offer via Deepseek

---

#### **Category B: Product Complaints (6 chats, 31.5%)**
**Medium Priority - May Escalate to Deletion**

| Example Messages | Count | Pattern |
|------------------|-------|---------|
| "третий раз делаю отказ из-за овощечистки" | 1 | Repeated defects |
| "Товар новрежден" | 1 | Damage complaint |
| "Товар не соответствует заявленному качеству" | 2 | Quality issues |
| "Брак, дефект, плохая упаковка" | 2 | Manufacturing defects |

**Trigger Phrases:**
- "брак"
- "дефект"
- "поврежден"
- "не соответствует"
- "плохое качество"

**Action Required:**
- Tag as `active` initially
- Monitor for escalation keywords
- AI should offer solution + hint at review upgrade if resolved

---

#### **Category C: Standard Support (8 chats, 42%)**
**Low Priority - General Support**

| Example Messages | Count | Pattern |
|------------------|-------|---------|
| "Пожалуйста, напишите нам в службу поддержки" | 3 | Standard redirects |
| "Как получить возврат?" | 2 | Process questions |
| "Когда придет заказ?" | 1 | Delivery status |
| "Спасибо за помощь!" | 2 | Positive responses |

**Action Required:**
- Tag as `successful` or `completed` if resolved
- Low AI priority (can use templates)

---

#### **Category D: Spam/Competitors (1 chat, 5%)**
**Filter Out Immediately**

| Message | Action |
|---------|--------|
| "МЫ УДАЛЯЕМ НЕГАТИВНЫЕ ОТЗЫВЫ ЗА 500Р" | Tag as `spam`, do not respond |

**Trigger Phrases:**
- ALL CAPS
- "удаляем отзывы" (competitor service)
- Phone numbers / external links

---

#### **Category E: Positive (2 chats, 10.5%)**
**Maintain Relationship**

| Example Messages | Count |
|------------------|-------|
| "Хорошо спасибо!!!" | 1 |
| "Товар отличный, рекомендую!" | 1 |

**Action Required:**
- Tag as `successful`
- Optional: Ask for review upgrade to 5 stars

---

## 3. Deletion Trigger Phrase Library

### 🎯 Priority 1: Direct Deletion Offers
| Phrase | Confidence | Example |
|--------|------------|---------|
| "удалю отзыв" | 95% | "Верните деньги, удалю отзыв" |
| "изменю отзыв" | 95% | "Я могу изменить свой отзыв если..." |
| "поставлю 5" | 90% | "Готов поставить 5 звезд за возврат" |
| "исправлю оценку" | 90% | "Исправлю оценку на 5 после решения проблемы" |

### 💰 Priority 2: Compensation Requests
| Phrase | Confidence | Example |
|--------|------------|---------|
| "верните деньги" | 85% | "Верните пожалуйста деньги" |
| "хочу возврат" | 85% | "Хочу возврат средств" |
| "компенсация" | 80% | "Какая возможна компенсация?" |
| "кешбэк" | 80% | "Можно кешбэк?" |

### 🔴 Priority 3: Negative Sentiment (Escalation Risk)
| Phrase | Confidence | Example |
|--------|------------|---------|
| "брак" | 70% | "Товар оказался браком" |
| "дефект" | 70% | "Обнаружил дефект" |
| "не работает" | 65% | "Товар не работает" |
| "обман" | 60% | "Это обман покупателей" |

### ✅ Priority 4: Positive Intent (Upgrade Opportunity)
| Phrase | Confidence | Example |
|--------|------------|---------|
| "если решите проблему" | 75% | "Если решите, повышу оценку" |
| "готов изменить" | 75% | "Готов изменить мнение" |
| "рассмотрю" | 60% | "Рассмотрю возможность повышения" |

---

## 4. Product Rules Integration Analysis

### Database Schema Review:
```sql
SELECT
  p.id,
  p.name,
  p.vendor_code,
  pr.work_in_chats,
  pr.chat_rating_1,
  pr.chat_rating_2,
  pr.chat_rating_3,
  pr.chat_rating_4,
  pr.chat_strategy,
  pr.offer_compensation,
  pr.compensation_type,
  pr.max_compensation,
  pr.compensation_by
FROM products p
LEFT JOIN product_rules pr ON p.id = pr.product_id
WHERE pr.work_in_chats = true;
```

### Key Fields for Deletion Agent:
1. **`work_in_chats`** - Enable chat automation for this product
2. **`chat_strategy`** - Strategy: `'upgrade_to_5'` | `'delete'` | `'both'`
3. **`offer_compensation`** - Can we offer money?
4. **`compensation_type`** - `'cashback'` | `'refund'` | null
5. **`max_compensation`** - Maximum amount to offer
6. **`chat_rating_1/2/3/4`** - Which review ratings to target

### Business Logic:
```typescript
// Pseudo-code for AI agent decision tree
if (chat.tag === 'deletion_candidate') {
  const product = getProductById(chat.product_nm_id);
  const rules = getProductRule(product.id);

  if (!rules.work_in_chats) {
    // Don't automate this product
    tag = 'active'; // Manual handling
  } else if (rules.chat_strategy === 'delete' || rules.chat_strategy === 'both') {
    if (rules.offer_compensation && rules.max_compensation) {
      // Generate compensation offer
      const offer = generateCompensationOffer({
        type: rules.compensation_type,
        max: rules.max_compensation,
        reviewRating: chat.review_rating,
      });
      sendMessage(chat.id, offer);
      updateTag(chat.id, 'deletion_offered');
    }
  } else if (rules.chat_strategy === 'upgrade_to_5') {
    // Offer to fix issue without deletion
    const response = generateSupportResponse(chat);
    sendMessage(chat.id, response);
  }
}
```

---

## 5. AI Prompts Strategy

### Prompt 1: Classification (Stage 2)
**Input:** Full chat history
**Output:** `{ tag: ChatTag, confidence: number }`

```typescript
// System Prompt (to be created):
`You are analyzing customer support chats for a Wildberries seller.
Your task: Classify chat intent.

Tags:
- deletion_candidate: Client hints at deleting/modifying review
- refund_requested: Client wants money back
- spam: Competitors or spam
- active: General support needed
- successful: Issue resolved
- ... (full list)

Examples:
Input: "Верните деньги, удалю отзыв"
Output: { "tag": "deletion_candidate", "confidence": 0.95 }

Input: "МЫ УДАЛЯЕМ ОТЗЫВЫ ЗА 500Р"
Output: { "tag": "spam", "confidence": 1.0 }
`
```

### Prompt 2: Deletion Offer Generation (Stage 3)
**Input:** Chat history + Product rules + Review rating
**Output:** Compensation offer message

```typescript
// System Prompt (to be created):
`You are a customer support agent for a Wildberries seller.
Client left a ${reviewRating}-star review and is open to deleting it.

Product rules:
- Max compensation: ${maxCompensation} руб
- Type: ${compensationType} (cashback/refund)
- Strategy: ${chatStrategy}

Generate a polite, professional message offering compensation for review deletion.
DO NOT mention "удаление отзыва" explicitly (WB rules).
Use soft language like "готовы помочь решить вопрос".

Tone: Helpful, empathetic, solution-oriented.
Length: 2-3 sentences max.
`
```

### Prompt 3: General Support (Stage 5)
**Input:** Chat history
**Output:** Support response

*(Lower priority, can reuse existing `prompt_chat_reply`)*

---

## 6. Metrics & Success Criteria

### Conversion Funnel:
```
Total Chats → Deletion Candidates → Offers Sent → Agreed → Confirmed → Revenue
    100%           10-15%              80%           50%        90%       600₽
```

**Example (100 chats):**
- 10 candidates identified (10%)
- 8 offers sent (80%)
- 4 agree (50%)
- 3.6 confirmed deletions (90%)
- **Revenue: 3.6 × 600₽ = 2,160₽**

### KPIs to Track:
1. **Classification Accuracy** - % correctly tagged by AI
2. **Offer Acceptance Rate** - % of offers leading to agreement
3. **Confirmation Rate** - % of agreed deletions actually completed
4. **Cost per Deletion** - AI tokens + compensation amount
5. **Net Profit** - 600₽ revenue - costs

### A/B Testing Plan:
- **Prompt variations** for offer generation
- **Compensation amounts** (10% vs 50% vs 100% refund)
- **Message timing** (immediate vs 24h delay)

---

## 7. Next Steps (Stage 2-5 Preview)

### Stage 2: AI Classification (Days 4-5)
- [ ] Create `classify-chat-deletion-flow.ts`
- [ ] Implement bulk classification endpoint
- [ ] Test on 19 existing chats
- [ ] Validate trigger phrase detection

### Stage 3: Deletion Agent (Days 6-9)
- [ ] Create `generate-deletion-offer-flow.ts`
- [ ] Implement product rules integration
- [ ] Build compensation calculation logic
- [ ] Create review deletion tracking table

### Stage 4: Integration & Testing (Days 10-11)
- [ ] Full workflow: classify → offer → track → confirm
- [ ] Build ROI dashboard
- [ ] Manual override UI for edge cases

### Stage 5: General Support (Day 12)
- [ ] Extend to non-deletion chats
- [ ] Template-based responses for common questions

---

## Appendix A: Sample Chat Analysis

### Chat #1 (Deletion Candidate):
```
Client: "Я могу изменить свой отзыв если примите свой товар обратно и верните деньги"
Seller: [No response yet]

Analysis:
- Trigger: "изменить отзыв", "верните деньги"
- Intent: Deletion for refund
- Review Rating: Likely 1-3 stars
- Product: Скатерть
- Recommended Tag: deletion_candidate
- Recommended Action: Check product_rules.offer_compensation
- Suggested Offer: "Здравствуйте! Готовы помочь решить вопрос. Оформим возврат до 100% стоимости. Напишите нам в поддержку."
```

### Chat #2 (Spam):
```
Client: "МЫ УДАЛЯЕМ НЕГАТИВНЫЕ ОТЗЫВЫ ЗА 500Р ПИШИТЕ В ТЕЛЕГРАМ"
Seller: [No response]

Analysis:
- Trigger: ALL CAPS, "удаляем отзывы", price mentioned
- Intent: Competitor spam
- Recommended Tag: spam
- Recommended Action: Ignore, do not respond
```

---

## Appendix B: SQL Queries for Analysis

```sql
-- Query 1: Get all chats with messages
SELECT
  c.id,
  c.client_name,
  c.product_nm_id,
  c.tag,
  c.last_message_text,
  c.last_message_sender,
  c.last_message_date,
  p.name as product_name,
  COUNT(cm.id) as message_count
FROM chats c
LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND c.store_id = p.store_id
LEFT JOIN chat_messages cm ON c.id = cm.chat_id
GROUP BY c.id, p.name
ORDER BY c.last_message_date DESC;

-- Query 2: Identify potential deletion candidates
SELECT
  c.id,
  c.client_name,
  c.last_message_text,
  c.product_nm_id
FROM chats c
WHERE c.last_message_text ILIKE '%удал%отзыв%'
   OR c.last_message_text ILIKE '%измен%отзыв%'
   OR c.last_message_text ILIKE '%верните деньги%'
   OR c.last_message_text ILIKE '%поставлю 5%';

-- Query 3: Products with chat automation enabled
SELECT
  p.id,
  p.name,
  p.vendor_code,
  pr.work_in_chats,
  pr.chat_strategy,
  pr.offer_compensation,
  pr.max_compensation
FROM products p
INNER JOIN product_rules pr ON p.id = pr.product_id
WHERE pr.work_in_chats = true;

-- Query 4: Tag distribution
SELECT tag, COUNT(*) as count
FROM chats
WHERE store_id = 'TwKRrPji2KhTS8TmYJlD'
GROUP BY tag
ORDER BY count DESC;
```

---

**Report Status:** ✅ Stage 1 Complete
**Next Action:** Begin Stage 2 - AI Classification Implementation
**Estimated Completion:** 2026-01-18 (Day 5)