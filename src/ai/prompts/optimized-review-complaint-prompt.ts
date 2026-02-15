/**
 * @fileOverview Optimized system prompts for AI complaint generation
 * Reduced from ~2800 chars to ~1200 chars (base) + ~400 chars (fashion category)
 * Target: 30-50% token savings while maintaining quality
 */

/**
 * Base system prompt for all product categories
 * Optimized version: ~1200 characters (down from ~2800)
 */
export const BASE_PROMPT = `Ты — эксперт по модерации отзывов на маркетплейсе Wildberries.
Твоя задача — подготовить профессиональную жалобу на отзыв покупателя для удаления согласно правилам WB.

**АЛГОРИТМ:**
1️⃣ АНАЛИЗ: Определи, относится ли отзыв к товару, а не к доставке/упаковке/сервису.
2️⃣ КАТЕГОРИЯ ЖАЛОБЫ (выбери одну):
11 - Отзыв не относится к товару
12 - Отзыв оставили конкуренты
13/14 - Спам-реклама в тексте/фото
15/17 - Нецензурное содержимое/фото не о товаре
16/20 - Нецензурная лексика/угрозы/оскорбления
18 - Политический контекст
19 - Другое

3️⃣ АРГУМЕНТАЦИЯ:
- Если цвет/размер/фасон — укажи, что параметры были в карточке заранее.
- Если царапины/вмятины/грязь — это логистика, не товар.
- Если субъективные ожидания/неправильное использование — основание для удаления.
- При ненормативной лексике (даже «***») — нарушение правил площадки.
- НЕ упоминай отсутствие фото/видео — это не аргумент.

4️⃣ ФОРМАТ ТЕКСТА:
- 450–750 символов, абзацами (НЕ списком).
- Профессиональный, убедительный тон без шаблонности.
- Без фраз "уважаемые модераторы", "отзыв <Имя> от <дата>".
- Чистый текст без артефактов форматирования (слэшей, лишних кавычек).

ВЫВОД: JSON с тремя полями: reasonId, reasonName, complaintText.`;

/**
 * Additional prompt for fashion/clothing category
 * Applied only when product is in fashion category
 * ~400 characters
 */
export const FASHION_CATEGORY_ADDENDUM = `

**ДОПОЛНИТЕЛЬНО ДЛЯ ОДЕЖДЫ/FASHION:**
- Посадка зависит от фигуры покупателя.
- Цвет зависит от освещения, камеры, экрана.
- Ощущения ткани субъективны.
- Размер: замеры указаны заранее, посадка индивидуальна.
- Ткань приобретает финальный вид после стирки/отпаривания.
- Не спорь с покупателем — объясняй, почему он мог воспринять иначе.`;

/**
 * Fashion category keywords for detection
 */
export const FASHION_KEYWORDS = [
  'одежда',
  'футболка',
  'платье',
  'брюки',
  'джинсы',
  'куртка',
  'пальто',
  'свитер',
  'юбка',
  'блузка',
  'рубашка',
  'костюм',
  'пиджак',
  'шорты',
  'майка',
  'кофта',
  'жилет',
  'обувь',
  'кроссовки',
  'ботинки',
  'туфли',
  'сапоги',
  'ткань',
  'размер (ru)',
  'размер (int)',
];

/**
 * Detect if product is in fashion category
 *
 * @param productName - Name of the product
 * @param characteristics - Product characteristics string
 * @returns true if product is fashion/clothing
 */
export function isFashionProduct(
  productName: string,
  characteristics: string = ''
): boolean {
  const searchText = `${productName} ${characteristics}`.toLowerCase();

  return FASHION_KEYWORDS.some(keyword =>
    searchText.includes(keyword.toLowerCase())
  );
}

/**
 * Build optimized system prompt based on product category
 *
 * @param productName - Name of the product
 * @param characteristics - Product characteristics string
 * @returns Optimized system prompt
 */
export function buildOptimizedSystemPrompt(
  productName: string,
  characteristics: string = ''
): string {
  let prompt = BASE_PROMPT;

  // Add fashion-specific rules if applicable
  if (isFashionProduct(productName, characteristics)) {
    prompt += FASHION_CATEGORY_ADDENDUM;
  }

  return prompt;
}

/**
 * Calculate prompt length savings
 */
export function calculatePromptSavings(originalLength: number, optimizedLength: number) {
  const saved = originalLength - optimizedLength;
  const savedPercent = Math.round((saved / originalLength) * 100);

  return {
    original: originalLength,
    optimized: optimizedLength,
    saved,
    savedPercent,
  };
}
