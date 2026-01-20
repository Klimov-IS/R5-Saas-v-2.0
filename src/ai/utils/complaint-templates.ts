/**
 * @fileOverview Template-based complaints for empty reviews
 * Used to avoid AI API calls and save tokens/cost for reviews with no text content
 *
 * A/B Testing: 4 template variants with rotation by reviewId
 * - Variant A (11): "Отзыв не относится к товару"
 * - Variant B (12): "Отзыв оставили конкуренты"
 * - Variant C (20): "Другое"
 * - Variant D (11): "Отзыв не относится к товару" (alternative wording)
 */

export interface ComplaintTemplate {
  complaintText: string;
  reasonId: number;
  reasonName: string;
  variantId: number; // 0-3 for A/B testing
}

/**
 * Variant A — reason_id: 11 (Отзыв не относится к товару)
 * Original template — focus on lack of information about product
 */
export const TEMPLATE_VARIANT_A: ComplaintTemplate = {
  complaintText: `Отзыв содержит только числовую оценку без какого-либо текстового описания опыта использования товара. Покупатель не предоставил конкретных причин низкой оценки, не указал на недостатки товара и не описал проблем, с которыми столкнулся.

Согласно правилам платформы Wildberries, отзыв должен содержать обоснованное мнение о товаре с описанием его характеристик, качества или опыта использования. Отзыв без текста не несет информационной ценности для других покупателей и не может считаться полноценным отзывом о товаре.

Данный отзыв не относится к товару, так как не содержит никакой информации о самом товаре, его характеристиках или качестве. Просим модерацию рассмотреть возможность удаления данного отзыва.`,
  reasonId: 11,
  reasonName: 'Отзыв не относится к товару',
  variantId: 0,
};

/**
 * Variant B — reason_id: 12 (Отзыв оставили конкуренты)
 * Focus on competitor manipulation (unfounded low rating)
 */
export const TEMPLATE_VARIANT_B: ComplaintTemplate = {
  complaintText: `Отзыв содержит только низкую оценку без каких-либо обоснований, описания недостатков или реальных проблем с товаром. Покупатель не указал конкретных причин неудовлетворенности, не описал опыт использования и не предоставил доказательств проблемы.

Подобные отзывы с необоснованными низкими оценками без текста характерны для действий недобросовестных конкурентов, целью которых является снижение рейтинга товара без реальной обратной связи.

Согласно правилам Wildberries, отзыв должен содержать объективное описание опыта покупателя. Данный отзыв не соответствует этим требованиям и может быть намеренной попыткой снизить репутацию товара. Просим модерацию рассмотреть данную жалобу.`,
  reasonId: 12,
  reasonName: 'Отзыв оставили конкуренты',
  variantId: 1,
};

/**
 * Variant C — reason_id: 20 (Другое)
 * Focus on violation of platform standards and lack of value
 */
export const TEMPLATE_VARIANT_C: ComplaintTemplate = {
  complaintText: `Отзыв представляет собой только числовую оценку без сопроводительного текста, обоснований или описания. Покупатель не указал причины низкой оценки, не описал недостатки товара и не предоставил информации, которая могла бы помочь другим покупателям при выборе.

Wildberries требует, чтобы отзывы содержали полезную информацию о товаре для других пользователей. Пустой отзыв нарушает принципы информативности и не помогает в формировании объективного мнения о товаре.

Отзыв не соответствует стандартам качества платформы и не несет никакой ценности для сообщества покупателей. Просим рассмотреть возможность удаления данного отзыва.`,
  reasonId: 20,
  reasonName: 'Другое',
  variantId: 2,
};

/**
 * Variant D — reason_id: 11 (Отзыв не относится к товару)
 * Alternative wording — focus on difficulty for other buyers
 */
export const TEMPLATE_VARIANT_D: ComplaintTemplate = {
  complaintText: `Данный отзыв не содержит какой-либо информации о товаре — ни о его качестве, ни о характеристиках, ни об опыте использования. Покупатель оставил только оценку в 1-3 звезды без указания причин или обоснований.

Такие отзывы затрудняют другим покупателям принятие взвешенного решения о покупке, так как не содержат фактической информации о товаре. По правилам Wildberries, отзыв должен относиться к товару и содержать полезные сведения для покупателей.

Поскольку отзыв не содержит никакой информации о товаре, он не соответствует требованиям платформы. Просим модерацию рассмотреть удаление данного отзыва.`,
  reasonId: 11,
  reasonName: 'Отзыв не относится к товару',
  variantId: 3,
};

/**
 * All template variants for A/B testing
 */
export const TEMPLATE_VARIANTS: ComplaintTemplate[] = [
  TEMPLATE_VARIANT_A,
  TEMPLATE_VARIANT_B,
  TEMPLATE_VARIANT_C,
  TEMPLATE_VARIANT_D,
];

/**
 * Legacy export for backward compatibility
 * @deprecated Use selectTemplateByReviewId() instead
 */
export const EMPTY_REVIEW_TEMPLATE: ComplaintTemplate = TEMPLATE_VARIANT_A;

/**
 * Check if review qualifies for template-based complaint
 *
 * Criteria:
 * - No review text (empty or whitespace only)
 * - No pros
 * - No cons
 * - Low rating (1-3 stars) — UPDATED from 1-2 to 1-3
 *
 * @param reviewText - Main review text
 * @param reviewPros - Review pros/advantages
 * @param reviewCons - Review cons/disadvantages
 * @param reviewRating - Star rating (1-5)
 * @returns true if template can be used instead of AI generation
 */
export function canUseTemplate(
  reviewText: string | undefined,
  reviewPros: string | undefined,
  reviewCons: string | undefined,
  reviewRating: number
): boolean {
  // Check if all text fields are empty or whitespace
  const hasText = reviewText?.trim();
  const hasPros = reviewPros?.trim();
  const hasCons = reviewCons?.trim();

  // Template is used only for completely empty reviews with rating 1-3
  const isEmpty = !hasText && !hasPros && !hasCons;
  const isLowRating = reviewRating <= 3; // CHANGED: from <=2 to <=3

  return isEmpty && isLowRating;
}

/**
 * Hash function for consistent template selection
 * Same reviewId always gets same template variant
 *
 * @param str - Review ID to hash
 * @returns Hash number (32-bit integer)
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Select template variant by reviewId for A/B testing
 * Uses hash-based rotation for consistent distribution (25% each variant)
 *
 * @param reviewId - Review ID for consistent template selection
 * @returns ComplaintTemplate (one of 4 variants)
 */
export function selectTemplateByReviewId(reviewId: string): ComplaintTemplate {
  const hash = simpleHash(reviewId);
  const variantIndex = hash % 4; // 0-3
  return { ...TEMPLATE_VARIANTS[variantIndex] };
}

/**
 * Get template complaint for empty review
 * Returns template with zero AI cost and instant generation
 *
 * @deprecated Use selectTemplateByReviewId() instead for A/B testing
 * @returns ComplaintTemplate with pre-written complaint text
 */
export function getTemplateComplaint(): ComplaintTemplate {
  return {
    ...EMPTY_REVIEW_TEMPLATE,
  };
}
