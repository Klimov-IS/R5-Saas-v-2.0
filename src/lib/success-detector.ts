/**
 * Success event detection for TG notifications.
 *
 * Detects when buyers indicate they've deleted, upgraded their review,
 * or need help deleting it. Called during dialogue sync on new client messages.
 */

export type SuccessEventType = 'review_deleted' | 'review_upgraded' | 'needs_help';

export interface SuccessEvent {
  type: SuccessEventType;
  label: string;
  emoji: string;
}

// Buyer confirmed they deleted the review
const DELETED_PATTERNS = [
  'удалила', 'удалил', 'удалили', 'удален', 'удалён', 'удалено',
  'я удал', 'уже удалил', 'уже удалила', 'отзыв удален', 'отзыв удалён',
];

// Buyer upgraded review to 5 stars or improved it
const UPGRADED_PATTERNS = [
  '5 звезд', '5 звёзд', 'пять звезд', 'пять звёзд',
  'поставила 5', 'поставил 5', 'ставлю 5', 'поставлю 5',
  'изменила на 5', 'изменил на 5', 'изменю на 5',
  'дополнила', 'дополнил',
  'обновила отзыв', 'обновил отзыв',
  'исправила оценку', 'исправил оценку',
  'изменила оценку', 'изменил оценку',
  'изменю отзыв', 'изменила отзыв', 'изменил отзыв',
  'поставлю хороший', 'поставлю хорошую',
];

// Buyer wants to delete but can't find the button — needs help
const NEEDS_HELP_PATTERNS = [
  'не могу удалить', 'не нашла кнопку', 'как удалить', 'где кнопка',
  'не могу найти', 'куда нажать', 'нет кнопки удал',
];

/**
 * Detect success/help event in a buyer's message.
 * Returns null if no significant event found.
 */
export function detectSuccessEvent(text: string): SuccessEvent | null {
  const lower = text.toLowerCase();

  // Check needs_help first (highest priority — requires immediate response)
  if (NEEDS_HELP_PATTERNS.some(p => lower.includes(p))) {
    return { type: 'needs_help', label: 'Нужна помощь с удалением', emoji: '🆘' };
  }
  if (DELETED_PATTERNS.some(p => lower.includes(p))) {
    return { type: 'review_deleted', label: 'Отзыв удалён', emoji: '✅' };
  }
  if (UPGRADED_PATTERNS.some(p => lower.includes(p))) {
    return { type: 'review_upgraded', label: 'Отзыв улучшен', emoji: '⭐' };
  }

  return null;
}
