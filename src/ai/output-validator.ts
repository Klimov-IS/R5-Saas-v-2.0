/**
 * AI Output Validator — post-generation invariant checker.
 *
 * Pure function, no AI calls. Validates AI-generated drafts against
 * hard business rules that must never be violated regardless of prompt.
 *
 * Feature flags:
 *   AI_VALIDATOR_ENABLED=true   — run validation (default: false)
 *   AI_VALIDATOR_ENFORCE=true   — reject draft on violation (default: false, log-only)
 *
 * PR-06
 */

// ============================================================================
// Types
// ============================================================================

export interface ValidatorContext {
  marketplace: 'wb' | 'ozon';
  reviewRating: number | null | undefined;
  phase: 'discovery' | 'proposal' | 'resolution';
  sellerMessageCount: number;
  chatId: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

export interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

// ============================================================================
// Invariant Rules
// ============================================================================

const GREETING_PATTERNS = /^(добрый\s+(день|вечер|утро)|здравствуй|приветств|привет[,!\s])/i;
const MARKDOWN_PATTERNS = /(\*\*|##|```|`[^`]+`)/;
const DIRECT_DELETION_PHRASE = /(удалите\s+отзыв|удалить\s+отзыв)/i;
const OZON_DELETION_WORDS = /(удал[иеёья]|удалени[еяю]|убрать\s+отзыв|снять\s+отзыв)/i;
const COMPENSATION_AMOUNT = /\d+\s*[₽руб]/i;
const QUESTION_ENDING = /[?»][\s)]*$/;
const EMPTY_PROMISES = /после\s+решения\s+вопроса|разберёмся\s+и\s+поможем|хотел\s+бы\s+разобраться\s+и\s+помочь/i;

/**
 * Validate AI-generated draft against business invariants.
 *
 * Rules (from tests/golden/README.md):
 * 1. rating >= 4 → no compensation amounts
 * 2. ozon → no deletion words
 * 3. ozon → length <= 1000
 * 4. seller_message_count > 0 → no greeting (warning)
 * 5. phase == discovery → must end with question (warning)
 * 6. no "удалите отзыв" / "удалить отзыв" (any marketplace)
 * 7. no markdown formatting
 * 8. length between 50 and 2000
 */
export function validateDraft(draft: string, ctx: ValidatorContext): ValidationResult {
  const violations: Violation[] = [];
  const text = draft.trim();

  // Rule 8: Length bounds
  if (text.length < 50) {
    violations.push({
      rule: 'length_min',
      severity: 'error',
      message: `Черновик слишком короткий: ${text.length} символов (мин. 50)`,
    });
  }
  if (text.length > 2000) {
    violations.push({
      rule: 'length_max',
      severity: 'error',
      message: `Черновик слишком длинный: ${text.length} символов (макс. 2000)`,
    });
  }

  // Rule 3: OZON 1000-char limit
  if (ctx.marketplace === 'ozon' && text.length > 1000) {
    violations.push({
      rule: 'ozon_length',
      severity: 'error',
      message: `OZON: превышен лимит 1000 символов (${text.length})`,
    });
  }

  // Rule 7: No markdown
  if (MARKDOWN_PATTERNS.test(text)) {
    violations.push({
      rule: 'no_markdown',
      severity: 'error',
      message: 'Черновик содержит markdown-разметку (**, ##, ``)',
    });
  }

  // Rule 6: No direct "удалите/удалить отзыв" (any marketplace)
  if (DIRECT_DELETION_PHRASE.test(text)) {
    violations.push({
      rule: 'no_direct_deletion',
      severity: 'error',
      message: 'Черновик содержит прямое упоминание удаления отзыва',
    });
  }

  // Rule 2: OZON — no deletion words at all
  if (ctx.marketplace === 'ozon' && OZON_DELETION_WORDS.test(text)) {
    violations.push({
      rule: 'ozon_no_deletion',
      severity: 'error',
      message: 'OZON: черновик содержит слова про удаление (на OZON отзывы не удаляются)',
    });
  }

  // Rule 1: rating >= 4 → no compensation amounts
  if (ctx.reviewRating != null && ctx.reviewRating >= 4 && COMPENSATION_AMOUNT.test(text)) {
    violations.push({
      rule: 'no_compensation_high_rating',
      severity: 'error',
      message: `Оценка ${ctx.reviewRating}★ — нельзя предлагать компенсацию с суммой`,
    });
  }

  // Rule 9: No empty promises (warning — prompt issue, not hard error)
  if (EMPTY_PROMISES.test(text)) {
    violations.push({
      rule: 'no_empty_promises',
      severity: 'warning',
      message: 'Пустое обещание ("после решения вопроса", "разберёмся и поможем")',
    });
  }

  // Rule 4: No greeting if seller already messaged (warning)
  if (ctx.sellerMessageCount > 0 && GREETING_PATTERNS.test(text)) {
    violations.push({
      rule: 'no_repeated_greeting',
      severity: 'warning',
      message: 'Повторное приветствие при уже начатом диалоге',
    });
  }

  // Rule 5: Discovery phase → must end with question (warning)
  if (ctx.phase === 'discovery' && !QUESTION_ENDING.test(text)) {
    violations.push({
      rule: 'discovery_ends_question',
      severity: 'warning',
      message: 'Фаза "знакомство" — сообщение должно заканчиваться вопросом',
    });
  }

  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

// ============================================================================
// Integration helper
// ============================================================================

/**
 * Run validator if enabled. Returns validation result + whether to reject.
 *
 * Reads feature flags from env:
 *   AI_VALIDATOR_ENABLED  — run validation at all (default: false)
 *   AI_VALIDATOR_ENFORCE  — reject on error violations (default: false)
 */
export function runValidator(
  draft: string,
  ctx: ValidatorContext
): { result: ValidationResult; shouldReject: boolean } | null {
  const enabled = process.env.AI_VALIDATOR_ENABLED === 'true';
  if (!enabled) return null;

  const result = validateDraft(draft, ctx);
  const enforce = process.env.AI_VALIDATOR_ENFORCE === 'true';
  const shouldReject = enforce && !result.valid;

  // Always log violations
  if (result.violations.length > 0) {
    const violationSummary = result.violations
      .map(v => `[${v.severity}] ${v.rule}: ${v.message}`)
      .join(' | ');
    console.log(
      `[AI-VALIDATOR] chat=${ctx.chatId} | valid=${result.valid} | enforce=${enforce} | violations: ${violationSummary}`
    );
  }

  return { result, shouldReject };
}
