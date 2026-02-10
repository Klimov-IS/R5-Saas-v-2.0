import { getStoreFaq, getStoreGuides } from '@/db/helpers';

/**
 * Default AI instructions used when store has no custom instructions.
 * Ensures AI always has base behavioral rules even for unconfigured stores.
 */
export const DEFAULT_AI_INSTRUCTIONS = `Тон: вежливый, профессиональный, обращение на "вы"

Правила общения:
- Всегда начинай с приветствия
- Будь эмпатичным — покажи, что понимаешь проблему клиента
- Предлагай конкретные решения, а не общие фразы
- Если клиент жалуется на брак — предложи оформить возврат
- Не обещай того, что нельзя гарантировать
- Не упоминай конкурентов
- Заканчивай сообщение готовностью помочь дальше

Компенсация: предлагай кэшбек за удаление негативного отзыва (сумма из правил товара).
Возврат: возврат через WB в соответствии с правилами площадки.`;

/**
 * Build combined store instructions for AI flows.
 * Merges ai_instructions + active FAQ entries + active guides into a single string.
 * Falls back to DEFAULT_AI_INSTRUCTIONS when no custom instructions are set.
 */
export async function buildStoreInstructions(
  storeId: string,
  aiInstructions?: string | null
): Promise<string | undefined> {
  const [faqEntries, guideEntries] = await Promise.all([
    getStoreFaq(storeId),
    getStoreGuides(storeId),
  ]);

  const activeFaq = faqEntries.filter(e => e.is_active);
  const activeGuides = guideEntries.filter(e => e.is_active);

  const faqText = activeFaq.length > 0
    ? `\n\n## FAQ магазина\n${activeFaq.map(e => `В: ${e.question}\nО: ${e.answer}`).join('\n\n')}`
    : '';

  const guidesText = activeGuides.length > 0
    ? `\n\n## Инструкции для клиентов\n${activeGuides.map(g => `### ${g.title}\n${g.content}`).join('\n\n')}`
    : '';

  const effectiveInstructions = aiInstructions?.trim() || DEFAULT_AI_INSTRUCTIONS;
  const combined = [effectiveInstructions, faqText, guidesText].join('').trim();
  return combined || undefined;
}
