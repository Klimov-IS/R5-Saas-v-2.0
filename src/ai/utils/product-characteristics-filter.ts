/**
 * @fileOverview Utility for filtering product characteristics to reduce token usage
 * while maintaining context quality for AI complaint generation.
 */

/**
 * Product characteristic from WB API
 */
interface ProductCharacteristic {
  name: string;
  value: string | number | boolean;
}

/**
 * Priority levels for characteristics
 */
const PRIORITY_CHARACTERISTICS = {
  HIGH: [
    // Размеры и физические параметры
    'высота',
    'ширина',
    'длина',
    'глубина',
    'размер',
    'вес',
    'объем',
    'диаметр',

    // Материалы и состав
    'материал',
    'состав',
    'ткань',
    'материал подошвы',
    'материал верха',

    // Цвет и внешний вид
    'цвет',
    'оттенок',
    'расцветка',

    // Категория и тип
    'категория',
    'вид',
    'тип',
    'назначение',

    // Для одежды - критичные параметры
    'размер (ru)',
    'размер (int)',
    'размер производителя',
  ],
  MEDIUM: [
    // Функциональные характеристики
    'комплектация',
    'особенности',
    'функции',
    'страна производства',
    'бренд',
    'модель',
  ],
  LOW: [
    // Менее важные параметры
    'артикул',
    'гарантия',
    'упаковка',
    'штрихкод',
    'сертификация',
  ]
};

/**
 * Keywords that indicate a characteristic might be mentioned in the review
 */
const REVIEW_TRIGGER_KEYWORDS = {
  'цвет': ['цвет', 'оттенок', 'расцветка', 'яркий', 'тусклый', 'бледный'],
  'размер': ['размер', 'большой', 'маленький', 'большемерит', 'маломерит', 'не подошёл', 'не подошел'],
  'материал': ['материал', 'ткань', 'качество', 'пластик', 'металл', 'дерево'],
  'запах': ['запах', 'вонь', 'химия', 'пахнет'],
};

/**
 * Filter and select relevant product characteristics
 *
 * @param characteristics - Full array of product characteristics from WB API
 * @param reviewText - Combined review text (pros + cons + main text)
 * @param maxCharacteristics - Maximum number of characteristics to return (default: 7)
 * @returns Filtered array of relevant characteristics
 */
export function selectRelevantCharacteristics(
  characteristics: ProductCharacteristic[] | undefined | null,
  reviewText: string = '',
  maxCharacteristics: number = 7
): string {
  if (!characteristics || characteristics.length === 0) {
    return 'N/A';
  }

  const reviewLower = reviewText.toLowerCase();
  const selected: Array<{ char: ProductCharacteristic; priority: number }> = [];

  // Score each characteristic based on priority and relevance
  for (const char of characteristics) {
    const nameLower = char.name.toLowerCase();
    let priority = 0;

    // Check if it's in HIGH priority list
    if (PRIORITY_CHARACTERISTICS.HIGH.some(p => nameLower.includes(p.toLowerCase()))) {
      priority += 10;
    }

    // Check if it's in MEDIUM priority list
    else if (PRIORITY_CHARACTERISTICS.MEDIUM.some(p => nameLower.includes(p.toLowerCase()))) {
      priority += 5;
    }

    // Check if it's in LOW priority list (we might skip these)
    else if (PRIORITY_CHARACTERISTICS.LOW.some(p => nameLower.includes(p.toLowerCase()))) {
      priority += 1;
    }

    // Bonus: mentioned in review
    for (const [charType, keywords] of Object.entries(REVIEW_TRIGGER_KEYWORDS)) {
      if (nameLower.includes(charType) && keywords.some(kw => reviewLower.includes(kw))) {
        priority += 15; // Strong bonus for being mentioned in review
        break;
      }
    }

    // Only include characteristics with some priority
    if (priority > 0) {
      selected.push({ char, priority });
    }
  }

  // Sort by priority (highest first) and take top N
  selected.sort((a, b) => b.priority - a.priority);
  const topCharacteristics = selected.slice(0, maxCharacteristics);

  // Format as compact string
  if (topCharacteristics.length === 0) {
    return 'N/A';
  }

  return topCharacteristics
    .map(({ char }) => `${char.name}: ${char.value}`)
    .join(', ');
}

/**
 * Calculate estimated token savings
 *
 * @param originalChars - Original characteristics array
 * @param filteredString - Filtered characteristics string
 * @returns Object with original and filtered character counts
 */
export function calculateTokenSavings(
  originalChars: ProductCharacteristic[] | undefined | null,
  filteredString: string
): { original: number; filtered: number; saved: number; savedPercent: number } {
  const original = originalChars
    ? JSON.stringify(originalChars).length
    : 0;
  const filtered = filteredString.length;
  const saved = original - filtered;
  const savedPercent = original > 0 ? Math.round((saved / original) * 100) : 0;

  return { original, filtered, saved, savedPercent };
}
