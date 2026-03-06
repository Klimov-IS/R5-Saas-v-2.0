/**
 * Regex-based Chat Tag Classifier
 *
 * Classifies chats into deletion workflow tags based on message content analysis.
 * Designed to replace AI classification (classify-chat-deletion flow) which was
 * disabled in migration 024 due to excessive API costs.
 *
 * Tag progression (forward-only):
 *   null → deletion_candidate → deletion_offered → deletion_agreed → deletion_confirmed
 *
 * Rules:
 * - deletion_candidate: Auto-set on review_chat_link creation (not regex)
 * - deletion_offered:   SELLER message contains compensation/deletion offer
 * - deletion_agreed:    BUYER message contains agreement to delete/modify
 * - deletion_confirmed: BUYER or SELLER message confirms deletion/modification done
 *
 * Based on analysis of ~580 real production dialogues (2026-03-06).
 *
 * Created: 2026-03-06
 */

import type { ChatTag } from '@/types/chats';

// ============================================================================
// Types
// ============================================================================

export interface TagClassificationResult {
  /** Detected tag (highest applicable in forward progression) */
  tag: ChatTag | null;
  /** Confidence score 0-1 */
  confidence: number;
  /** Which regex patterns matched */
  triggers: string[];
  /** Which message triggered the classification */
  triggerMessageIndex?: number;
  /** Sender of the trigger message */
  triggerSender?: 'client' | 'seller';
}

export interface ChatMessageForClassification {
  sender: 'client' | 'seller';
  text: string;
}

// ============================================================================
// Tag Order (forward-only progression)
// ============================================================================

const TAG_ORDER: Record<ChatTag, number> = {
  deletion_candidate: 0,
  deletion_offered: 1,
  deletion_agreed: 2,
  deletion_confirmed: 3,
};

// JS \w doesn't match Cyrillic. Helper to build regex with Cyrillic word chars.
// W = one Cyrillic/Latin word char, W+ = one or more, W* = zero or more
function re(pattern: string): RegExp {
  // Replace {W} with Cyrillic-aware word char class
  const expanded = pattern
    .replace(/\{W\+\}/g, '[а-яёА-ЯЁa-zA-Z0-9]+')
    .replace(/\{W\*\}/g, '[а-яёА-ЯЁa-zA-Z0-9]*');
  return new RegExp(expanded, 'i');
}

// ============================================================================
// DELETION_OFFERED patterns — SELLER messages
// ============================================================================

/**
 * Seller sent a compensation offer or proposed deletion/modification.
 *
 * Real examples from production:
 * - "компенсацию 500 рублей в обмен на удаление отзыва"
 * - "кешбэк 300₽ за изменение оценки"
 * - "вернуть полную стоимость товара"
 * - "компенсировать стоимость товара"
 * - "дополните отзыв до 5 звёзд"
 * - "изменив оценку на 5 звёзд"
 * - "предлагаем вам ... в обмен на удаление"
 * - "готовы предложить компенсацию"
 */
const OFFERED_PATTERNS: Array<{ regex: RegExp; trigger: string; confidence: number }> = [
  // Direct compensation offer with amount
  { regex: /компенсаци[юя]\s+\d+/i, trigger: 'compensation_amount', confidence: 0.98 },
  { regex: /к[еэ]шб[еэа]к\s+\d+/i, trigger: 'cashback_amount', confidence: 0.98 },

  // Compensation + deletion/change combo
  { regex: /компенсаци[юя].*(?:удален|измен|обмен)/i, trigger: 'compensation_for_deletion', confidence: 0.97 },
  { regex: /(?:удален|измен|обмен).*компенсаци/i, trigger: 'deletion_for_compensation', confidence: 0.97 },

  // "В обмен на удаление/изменение"
  { regex: /в\s+обмен\s+на\s+(?:удаление|изменение|дополнение)/i, trigger: 'exchange_for_deletion', confidence: 0.98 },

  // Return money for deletion ({W*} = Cyrillic-aware \w*)
  { regex: re('верн{W*}\\s+(?:полную\\s+)?стоимость'), trigger: 'return_cost', confidence: 0.95 },
  { regex: re('верн{W*}\\s+(?:деньги|средства)'), trigger: 'return_money', confidence: 0.93 },
  { regex: /возврат\s+(?:средств|денег|стоимости)/i, trigger: 'refund_offer', confidence: 0.93 },

  // Compensation generic
  { regex: /компенсировать\s+(?:стоимость|затраты|средства|расходы)/i, trigger: 'compensate_costs', confidence: 0.95 },
  { regex: re('предлага{W+}\\s+компенсаци'), trigger: 'offer_compensation', confidence: 0.96 },
  { regex: /готовы\s+(?:предложить|компенсировать|вернуть)/i, trigger: 'ready_to_offer', confidence: 0.94 },

  // Cashback generic
  { regex: /к[еэ]шб[еэа]к\s+(?:за|в\s+обмен|при\s+условии)/i, trigger: 'cashback_conditional', confidence: 0.96 },

  // Change rating to 5
  { regex: re('измен{W+}\\s+оценк{W+}\\s+на\\s+5'), trigger: 'change_rating_to_5', confidence: 0.95 },
  { regex: re('повыс{W+}\\s+оценк{W+}\\s+до\\s+5'), trigger: 'raise_rating_to_5', confidence: 0.95 },
  { regex: re('дополн{W+}\\s+отзыв{W*}\\s+до\\s+5'), trigger: 'supplement_to_5', confidence: 0.94 },

  // "Дополните отзыв" / "Измените отзыв"
  { regex: /дополни(?:те|ть)\s+(?:свой\s+)?отзыв/i, trigger: 'ask_supplement_review', confidence: 0.92 },
  { regex: /измени(?:те|ть)\s+(?:свой\s+)?отзыв/i, trigger: 'ask_change_review', confidence: 0.92 },
  { regex: /удали(?:те|ть)\s+(?:свой\s+)?отзыв/i, trigger: 'ask_delete_review', confidence: 0.92 },

  // "Просим/предлагаем пересмотреть оценку"
  { regex: re('(?:прос|предлага){W+}\\s+пересмотр{W+}\\s+оценк'), trigger: 'ask_reconsider', confidence: 0.90 },

  // "Перечислим на карту"
  { regex: re('перечисл{W+}\\s+(?:на\\s+карту|на\\s+счёт|на\\s+счет)'), trigger: 'transfer_to_card', confidence: 0.96 },
];

// ============================================================================
// DELETION_AGREED patterns — BUYER messages
// ============================================================================

/**
 * Buyer agreed to delete or modify their review.
 *
 * Real examples from production:
 * - "удалю отзыв"
 * - "согласна удалить"
 * - "хорошо, удалю"
 * - "как удалить отзыв?"
 * - "что нужно сделать чтобы удалить?"
 * - "могу удалить"
 * - "сотру отзыв"
 * - "давайте, я удалю"
 * - "попробую удалить"
 * - "ок, удалю отзыв сегодня"
 * - "подскажите как изменить отзыв"
 */
const AGREED_PATTERNS: Array<{ regex: RegExp; trigger: string; confidence: number }> = [
  // Direct promise to delete
  { regex: /удал[юуь]\s+отзыв/i, trigger: 'will_delete_review', confidence: 0.97 },
  { regex: /сотру\s+отзыв/i, trigger: 'will_erase_review', confidence: 0.97 },
  { regex: /убер[уюа]\s+отзыв/i, trigger: 'will_remove_review', confidence: 0.97 },

  // Agreement + deletion verb
  { regex: re('(?:хорошо|ладно|ок|окей|давайте|договорились|согласн{W+})[,.]?\\s*удал'), trigger: 'agree_then_delete', confidence: 0.96 },
  { regex: re('согласн{W+}\\s+удалить'), trigger: 'agree_to_delete', confidence: 0.97 },
  { regex: re('согласн{W+}\\s+(?:изменить|дополнить|исправить)'), trigger: 'agree_to_modify', confidence: 0.95 },

  // Promise to modify/change
  { regex: /измен[юуь]\s+(?:отзыв|оценку)/i, trigger: 'will_change_review', confidence: 0.95 },
  { regex: /исправл[юуь]\s+(?:отзыв|оценку)/i, trigger: 'will_fix_review', confidence: 0.95 },
  { regex: /дополн[юуь]\s+отзыв/i, trigger: 'will_supplement_review', confidence: 0.94 },
  { regex: /поставл[юуь]\s+5/i, trigger: 'will_set_5_stars', confidence: 0.96 },

  // "Могу удалить" / "Попробую удалить"
  { regex: /могу\s+удалить/i, trigger: 'can_delete', confidence: 0.93 },
  { regex: /попробую\s+удалить/i, trigger: 'will_try_delete', confidence: 0.90 },
  { regex: /попробую\s+(?:изменить|исправить|дополнить)/i, trigger: 'will_try_modify', confidence: 0.88 },

  // "Как удалить отзыв?" — implicit agreement (asking HOW = intent to do it)
  { regex: /как\s+(?:удалить|убрать|изменить|исправить|дополнить)\s+отзыв/i, trigger: 'how_to_delete', confidence: 0.88 },
  { regex: /подскажите\s+как\s+(?:удалить|убрать|изменить)/i, trigger: 'tell_how_to_delete', confidence: 0.88 },
  { regex: /что\s+(?:нужно|надо)\s+(?:сделать|нажать)/i, trigger: 'what_to_do', confidence: 0.85 },

  // "Давайте" / commitment forms
  { regex: /давайте[,.]?\s+(?:я\s+)?удал/i, trigger: 'lets_delete', confidence: 0.95 },
  { regex: /(?:сейчас|сегодня|завтра)\s+удал/i, trigger: 'time_delete', confidence: 0.93 },
];

// ============================================================================
// DELETION_CONFIRMED patterns — BUYER or SELLER messages
// ============================================================================

/**
 * Buyer has deleted/modified the review, or seller confirms it.
 *
 * Real examples from production:
 * - BUYER: "удалил отзыв", "удалила", "отзыв удалён"
 * - BUYER: "изменила отзыв", "дополнила отзыв", "всё исправила"
 * - BUYER: "поставила 5 звёзд", "оставила положительный отзыв"
 * - SELLER: "видим что отзыв был удалён", "отзыв был дополнен"
 * - SELLER: "спасибо за изменение отзыва"
 */
const CONFIRMED_BUYER_PATTERNS: Array<{ regex: RegExp; trigger: string; confidence: number }> = [
  // Past tense deletion — buyer did it
  { regex: /удалил[аи]?\s+отзыв/i, trigger: 'deleted_review', confidence: 0.98 },
  { regex: /отзыв\s+удал[еёи]/i, trigger: 'review_deleted', confidence: 0.98 },
  { regex: /убрал[аи]?\s+отзыв/i, trigger: 'removed_review', confidence: 0.97 },
  // Standalone past tense (short messages like "Удалила", "Удалил")
  { regex: /^удалил[аи]?[.!]?$/i, trigger: 'deleted_standalone', confidence: 0.92 },

  // Past tense modification — buyer did it
  { regex: /изменил[аи]?\s+(?:отзыв|оценку)/i, trigger: 'changed_review', confidence: 0.96 },
  { regex: /исправил[аи]?\s+(?:отзыв|оценку)/i, trigger: 'fixed_review', confidence: 0.96 },
  { regex: /дополнил[аи]?\s+отзыв/i, trigger: 'supplemented_review', confidence: 0.96 },
  { regex: /поставил[аи]?\s+5/i, trigger: 'set_5_stars', confidence: 0.96 },

  // "Всё исправила/сделала/изменила"
  { regex: /вс[ёе]\s+(?:исправил|изменил|сделал|удалил)/i, trigger: 'done_everything', confidence: 0.95 },

  // "Оставила положительный отзыв"
  { regex: /оставил[аи]?\s+(?:положительный|хороший|новый)\s+отзыв/i, trigger: 'left_positive_review', confidence: 0.94 },

  // "Отзыв изменён/обновлён"
  { regex: /отзыв\s+(?:изменён|изменен|обновлён|обновлен|исправлен|дополнен)/i, trigger: 'review_modified', confidence: 0.97 },
];

const CONFIRMED_SELLER_PATTERNS: Array<{ regex: RegExp; trigger: string; confidence: number }> = [
  // Seller confirms seeing deletion
  { regex: /видим\s+(?:что\s+)?отзыв\s+(?:был\s+)?(?:удалён|удален|изменён|изменен|дополнен)/i, trigger: 'seller_sees_deleted', confidence: 0.98 },
  { regex: /отзыв\s+(?:был\s+)?(?:удалён|удален|изменён|изменен|дополнен)/i, trigger: 'seller_confirms_deleted', confidence: 0.95 },

  // "Спасибо за удаление/изменение"
  { regex: /спасибо\s+за\s+(?:удаление|изменение|дополнение|исправление)\s+отзыв/i, trigger: 'thanks_for_deletion', confidence: 0.96 },

  // "Отзыв больше не отображается"
  { regex: /отзыв\s+больше\s+не\s+(?:отображается|виден|показывается)/i, trigger: 'review_not_visible', confidence: 0.97 },
];

// ============================================================================
// Anti-patterns (false positive protection)
// ============================================================================

/**
 * Messages that look like offers/agreements but aren't.
 * These reduce confidence or skip the match entirely.
 */
const ANTI_PATTERNS: Array<{ regex: RegExp; trigger: string }> = [
  // Negations: "не буду удалять", "не хочу менять"
  { regex: /не\s+(?:буду|хочу|стану|собираюсь|могу)\s+(?:удалять|менять|исправлять)/i, trigger: 'negation' },
  // "Не удалю" / "Не изменю"
  { regex: /не\s+(?:удалю|изменю|исправлю|дополню|уберу)/i, trigger: 'refusal' },
  // Questions about POLICY, not intent: "можно ли удалить отзыв?"
  { regex: /можно\s+ли\s+удалить/i, trigger: 'policy_question' },
  // Talking about OTHER people's reviews
  { regex: /чужой\s+отзыв/i, trigger: 'other_review' },
  // WB system message templates (auto-responses)
  { regex: /Уважаемый покупатель!/i, trigger: 'wb_template' },
];

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classify a chat based on its message history.
 *
 * Scans all messages and returns the highest applicable tag
 * in the forward progression chain.
 *
 * @param messages - All chat messages in chronological order
 * @param currentTag - Current chat tag (for forward-only guard)
 * @returns Classification result with tag, confidence, and triggers
 */
export function classifyTagFromMessages(
  messages: ChatMessageForClassification[],
  currentTag: ChatTag | null = null
): TagClassificationResult {
  if (!messages.length) {
    return { tag: null, confidence: 0, triggers: [] };
  }

  let bestTag: ChatTag | null = null;
  let bestConfidence = 0;
  let bestTriggers: string[] = [];
  let bestMessageIndex: number | undefined;
  let bestSender: 'client' | 'seller' | undefined;

  // Scan messages in chronological order (oldest first)
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = msg.text;
    if (!text || text.trim().length < 3) continue;

    // Check anti-patterns first
    const hasAntiPattern = ANTI_PATTERNS.some(ap => ap.regex.test(text));

    // --- DELETION_CONFIRMED: buyer or seller ---
    if (msg.sender === 'client') {
      for (const pattern of CONFIRMED_BUYER_PATTERNS) {
        if (pattern.regex.test(text)) {
          const conf = hasAntiPattern ? pattern.confidence * 0.5 : pattern.confidence;
          if (TAG_ORDER.deletion_confirmed > (bestTag ? TAG_ORDER[bestTag] : -1) ||
              (bestTag === 'deletion_confirmed' && conf > bestConfidence)) {
            bestTag = 'deletion_confirmed';
            bestConfidence = conf;
            bestTriggers = [pattern.trigger];
            bestMessageIndex = i;
            bestSender = 'client';
          }
        }
      }
    }

    if (msg.sender === 'seller') {
      for (const pattern of CONFIRMED_SELLER_PATTERNS) {
        if (pattern.regex.test(text)) {
          const conf = hasAntiPattern ? pattern.confidence * 0.5 : pattern.confidence;
          if (TAG_ORDER.deletion_confirmed > (bestTag ? TAG_ORDER[bestTag] : -1) ||
              (bestTag === 'deletion_confirmed' && conf > bestConfidence)) {
            bestTag = 'deletion_confirmed';
            bestConfidence = conf;
            bestTriggers = [pattern.trigger];
            bestMessageIndex = i;
            bestSender = 'seller';
          }
        }
      }
    }

    // --- DELETION_AGREED: buyer only ---
    if (msg.sender === 'client' && bestTag !== 'deletion_confirmed') {
      for (const pattern of AGREED_PATTERNS) {
        if (pattern.regex.test(text)) {
          const conf = hasAntiPattern ? pattern.confidence * 0.3 : pattern.confidence;
          if (conf < 0.5) continue; // Anti-pattern killed it
          if (TAG_ORDER.deletion_agreed > (bestTag ? TAG_ORDER[bestTag] : -1) ||
              (bestTag === 'deletion_agreed' && conf > bestConfidence)) {
            bestTag = 'deletion_agreed';
            bestConfidence = conf;
            bestTriggers = [pattern.trigger];
            bestMessageIndex = i;
            bestSender = 'client';
          }
        }
      }
    }

    // --- DELETION_OFFERED: seller only ---
    if (msg.sender === 'seller' && !bestTag) {
      for (const pattern of OFFERED_PATTERNS) {
        if (pattern.regex.test(text)) {
          const conf = pattern.confidence;
          if (!bestTag || TAG_ORDER.deletion_offered > TAG_ORDER[bestTag] ||
              (bestTag === 'deletion_offered' && conf > bestConfidence)) {
            bestTag = 'deletion_offered';
            bestConfidence = conf;
            bestTriggers = [pattern.trigger];
            bestMessageIndex = i;
            bestSender = 'seller';
          }
        }
      }
    }
  }

  // Forward-only guard: don't downgrade tags
  if (currentTag && bestTag) {
    const currentOrder = TAG_ORDER[currentTag] ?? -1;
    const newOrder = TAG_ORDER[bestTag] ?? -1;
    if (newOrder <= currentOrder) {
      // Keep current tag, no regression
      return {
        tag: currentTag,
        confidence: 1.0,
        triggers: ['forward_guard'],
      };
    }
  }

  return {
    tag: bestTag,
    confidence: bestConfidence,
    triggers: bestTriggers,
    triggerMessageIndex: bestMessageIndex,
    triggerSender: bestSender,
  };
}

/**
 * Quick check: does a single message match deletion_offered patterns?
 * Used by dialogue sync to detect if seller just sent an offer.
 */
export function isOfferMessage(text: string): boolean {
  return OFFERED_PATTERNS.some(p => p.regex.test(text));
}

/**
 * Quick check: does a single message match deletion_agreed patterns?
 * Used by dialogue sync to detect if buyer just agreed.
 */
export function isAgreementMessage(text: string): boolean {
  const hasAntiPattern = ANTI_PATTERNS.some(ap => ap.regex.test(text));
  if (hasAntiPattern) return false;
  return AGREED_PATTERNS.some(p => p.regex.test(text));
}

/**
 * Quick check: does a single message match deletion_confirmed patterns?
 */
export function isConfirmationMessage(text: string, sender: 'client' | 'seller'): boolean {
  const patterns = sender === 'client' ? CONFIRMED_BUYER_PATTERNS : CONFIRMED_SELLER_PATTERNS;
  return patterns.some(p => p.regex.test(text));
}

// ============================================================================
// Exported pattern lists (for testing/debugging)
// ============================================================================

export const PATTERNS = {
  offered: OFFERED_PATTERNS,
  agreed: AGREED_PATTERNS,
  confirmedBuyer: CONFIRMED_BUYER_PATTERNS,
  confirmedSeller: CONFIRMED_SELLER_PATTERNS,
  antiPatterns: ANTI_PATTERNS,
} as const;
