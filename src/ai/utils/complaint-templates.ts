/**
 * @fileOverview Template-based complaints for empty reviews
 * Used to avoid AI API calls and save tokens/cost for reviews with no text content
 */

export interface ComplaintTemplate {
  complaintText: string;
  reasonId: number;
  reasonName: string;
}

/**
 * Template for empty reviews (no text, pros, cons) with low rating
 * Used when review contains only a star rating without any textual description
 */
export const EMPTY_REVIEW_TEMPLATE: ComplaintTemplate = {
  complaintText: `Отзыв содержит только числовую оценку без какого-либо текстового описания опыта использования товара. Покупатель не предоставил конкретных причин низкой оценки, не указал на недостатки товара и не описал проблем, с которыми столкнулся.

Согласно правилам платформы Wildberries, отзыв должен содержать обоснованное мнение о товаре с описанием его характеристик, качества или опыта использования. Отзыв без текста не несет информационной ценности для других покупателей и не может считаться полноценным отзывом о товаре.

Данный отзыв не относится к товару, так как не содержит никакой информации о самом товаре, его характеристиках или качестве. Просим модерацию рассмотреть возможность удаления данного отзыва.`,
  reasonId: 11,
  reasonName: 'Отзыв не относится к товару',
};

/**
 * Check if review qualifies for template-based complaint
 *
 * Criteria:
 * - No review text (empty or whitespace only)
 * - No pros
 * - No cons
 * - Low rating (1-2 stars)
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

  // Template is used only for completely empty reviews with low rating
  const isEmpty = !hasText && !hasPros && !hasCons;
  const isLowRating = reviewRating <= 2;

  return isEmpty && isLowRating;
}

/**
 * Get template complaint for empty review
 * Returns template with zero AI cost and instant generation
 *
 * @returns ComplaintTemplate with pre-written complaint text
 */
export function getTemplateComplaint(): ComplaintTemplate {
  return {
    ...EMPTY_REVIEW_TEMPLATE,
  };
}
