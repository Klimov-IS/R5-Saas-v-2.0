import { getStoreFaq, getStoreGuides } from '@/db/helpers';

/**
 * Build combined store instructions for AI flows.
 * Merges ai_instructions + active FAQ entries + active guides into a single string.
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

  const combined = [aiInstructions || '', faqText, guidesText].join('').trim();
  return combined || undefined;
}
