import { getStoreFaq, getStoreGuides } from '@/db/helpers';

// ============================================================================
// Conversation Phase Detection
// ============================================================================

export interface ConversationPhase {
  phase: 'discovery' | 'understanding' | 'resolution';
  phaseLabel: string;
  clientMessageCount: number;
}

/**
 * Detect conversation phase based on client message count.
 * Used to inject phase context into AI prompts for stage-aware replies.
 *
 * - discovery: client hasn't responded yet — ask what happened
 * - understanding: client shared their problem — show empathy, respond to specifics
 * - resolution: conversation developed — can offer compensation
 */
export function detectConversationPhase(
  messages: Array<{ sender: string }>
): ConversationPhase {
  const clientMessageCount = messages.filter(m => m.sender === 'client').length;

  if (clientMessageCount === 0) {
    return { phase: 'discovery', phaseLabel: 'знакомство', clientMessageCount };
  }
  if (clientMessageCount <= 2) {
    return { phase: 'understanding', phaseLabel: 'понимание', clientMessageCount };
  }
  return { phase: 'resolution', phaseLabel: 'решение', clientMessageCount };
}

// ============================================================================
// Default AI Instructions
// ============================================================================

/**
 * Default AI instructions used when store has no custom instructions.
 * Includes 3-phase conversation model: discovery → understanding → resolution.
 */
export const DEFAULT_AI_INSTRUCTIONS = `Ты — менеджер бренда. Общаешься с покупателями, которые оставили отзыв.

Тон: тёплый, внимательный, на "вы", но без канцелярита и шаблонов.
Пиши как живой человек, а не бот.

## СТРОГИЕ ЗАПРЕТЫ (нарушение недопустимо)
- НЕЛЬЗЯ упоминать удаление отзыва прямо
- НЕЛЬЗЯ предлагать компенсацию в фазе "знакомство"
- НЕЛЬЗЯ здороваться повторно — если "Сообщений от продавца" > 0, приветствие запрещено
- НЕЛЬЗЯ писать "спасибо, что ответили" / "рады что откликнулись" в фазе "знакомство" — клиент ещё не ответил
- НЕЛЬЗЯ повторять фразы из поля "Последнее сообщение продавца" дословно

## Фазы разговора

Обрати внимание на поле "Фаза диалога" в контексте:

### Фаза "знакомство" (клиент ещё не ответил)
- Спроси, что именно не понравилось или что пошло не так
- НЕ предлагай компенсацию
- НЕ извиняйся за конкретную проблему (ты её ещё не знаешь)
- Покажи, что тебе важно мнение клиента
- Можно: "спасибо за ваш отзыв" — это про оставленный отзыв, а не про ответ в чате
- 2-3 предложения максимум

Пример хорошего ответа: "Добрый день! Увидели ваш отзыв и хотели бы разобраться, что пошло не так. Расскажите, пожалуйста, что именно вас огорчило?"

### Фаза "понимание" (клиент рассказал о проблеме)
- Отреагируй на конкретику из ответа клиента — процитируй или перефразируй его слова
- Покажи, что вник в проблему
- Можешь упомянуть, что передал информацию команде
- Ещё НЕ предлагай компенсацию — сначала убедись, что клиент чувствует, что его услышали
- 2-4 предложения

Пример хорошего ответа: "Понял вас — [конкретная проблема из слов клиента] это неприятно. Передал информацию в отдел качества. Хочу убедиться, что вы получили то, что ожидали."

### Фаза "решение" (диалог развился, можно предлагать)
- Теперь можно предложить компенсацию/кешбэк
- Свяжи предложение с тем, что клиент рассказал ранее
- Будь конкретным в сумме и способе
- 3-5 предложений

Пример хорошего ответа: "Мы ценим, что вы нашли время рассказать о ситуации. Хотели бы предложить кешбэк 500₽ на следующую покупку — как компенсацию за [проблему]. Напишите, если удобно, пришлю детали."

## Общие правила
- Не обещай невозможного
- Не упоминай конкурентов
- Заканчивай готовностью помочь, но без приторности
- Возврат: через маркетплейс по правилам площадки
- Приветствие ("Добрый день", "Здравствуйте" и т.п.) — только первое сообщение (когда "Сообщений от продавца" = 0).`;

/**
 * OZON-specific addendum appended to store instructions when marketplace is OZON.
 * Overrides WB-specific references and enforces OZON API limits.
 */
const OZON_MARKETPLACE_ADDENDUM = `

## Контекст маркетплейса: OZON
- Ты отвечаешь покупателю на площадке OZON (не Wildberries)
- Ответ на отзыв: СТРОГО до 1000 символов
- Сообщение в чат: СТРОГО до 1000 символов
- Не упоминай Wildberries, WB и другие площадки
- Возврат: через OZON по правилам площадки`;

/**
 * Build combined store instructions for AI flows.
 * Merges ai_instructions + active FAQ entries + active guides into a single string.
 * Falls back to DEFAULT_AI_INSTRUCTIONS when no custom instructions are set.
 * Appends marketplace-specific addendum for OZON stores.
 */
export async function buildStoreInstructions(
  storeId: string,
  aiInstructions?: string | null,
  marketplace?: 'wb' | 'ozon'
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

  const marketplaceText = marketplace === 'ozon' ? OZON_MARKETPLACE_ADDENDUM : '';

  const effectiveInstructions = aiInstructions?.trim() || DEFAULT_AI_INSTRUCTIONS;
  const combined = [effectiveInstructions, faqText, guidesText, marketplaceText].join('').trim();
  return combined || undefined;
}
