import { getStoreFaq } from '@/db/helpers';

/**
 * Build combined store instructions for AI flows.
 * Merges ai_instructions + active FAQ entries into a single string.
 */
export async function buildStoreInstructions(
  storeId: string,
  aiInstructions?: string | null
): Promise<string | undefined> {
  const faqEntries = await getStoreFaq(storeId);
  const activeFaq = faqEntries.filter(e => e.is_active);

  const faqText = activeFaq.length > 0
    ? `\n\n## FAQ магазина\n${activeFaq.map(e => `В: ${e.question}\nО: ${e.answer}`).join('\n\n')}`
    : '';

  const combined = [aiInstructions || '', faqText].join('').trim();
  return combined || undefined;
}
