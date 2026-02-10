'use server';
/**
 * @fileOverview Flow for analyzing store dialogues to generate FAQ and guide suggestions.
 * Takes up to 500 recent dialogues, sends them to Deepseek for analysis,
 * and returns structured FAQ + guide suggestions.
 */

import { runChatCompletion } from '../assistant-utils';
import { getRecentDialogues, getStoreFaq, getStoreGuides, getStoreById } from '@/db/helpers';

const SYSTEM_PROMPT = `Ты — аналитик клиентского сервиса маркетплейса Wildberries.

Тебе дан набор реальных диалогов между продавцом и покупателями.

Твоя задача — проанализировать эти диалоги и выделить:
1. **FAQ** — часто задаваемые вопросы клиентов и лучшие ответы продавца
2. **Инструкции** — пошаговые руководства, которые продавец часто отправляет клиентам

## Правила для FAQ:
- Выдели 5-15 наиболее частых вопросов/ситуаций
- Вопрос формулируй от лица клиента (коротко, ёмко)
- Ответ формулируй от лица продавца (вежливо, конкретно)
- Не дублируй уже существующие FAQ (список ниже)

## Правила для инструкций:
- Выдели 3-7 пошаговых инструкций, которые продавец регулярно отправляет
- Каждая инструкция: заголовок + пронумерованные шаги
- Не дублируй уже существующие инструкции (список ниже)

## Формат ответа (строго JSON):
{
  "faq": [
    { "question": "Вопрос клиента", "answer": "Ответ продавца" }
  ],
  "guides": [
    { "title": "Название инструкции", "content": "1. Шаг первый\\n2. Шаг второй\\n..." }
  ],
  "summary": "Краткое описание основных паттернов в 2-3 предложениях"
}

Отвечай ТОЛЬКО валидным JSON. Без markdown, без комментариев.`;

export interface AnalyzeDialoguesResult {
  faq: { question: string; answer: string }[];
  guides: { title: string; content: string }[];
  summary: string;
  dialoguesAnalyzed: number;
}

export async function analyzeStoreDialogues(storeId: string): Promise<AnalyzeDialoguesResult> {
  const store = await getStoreById(storeId);
  if (!store) throw new Error('Store not found');

  // Fetch dialogues + existing FAQ/guides in parallel
  const [dialogues, existingFaq, existingGuides] = await Promise.all([
    getRecentDialogues(storeId, 500),
    getStoreFaq(storeId),
    getStoreGuides(storeId),
  ]);

  if (dialogues.length === 0) {
    throw new Error('Нет диалогов для анализа. Дождитесь синхронизации чатов.');
  }

  // Build compact representation of dialogues (limit total size)
  const MAX_CHARS = 120_000; // ~30K tokens
  let totalChars = 0;
  const compactDialogues: string[] = [];

  for (const d of dialogues) {
    const msgs = d.messages
      .slice(0, 10) // Max 10 messages per dialogue
      .map(m => `${m.sender === 'client' ? 'К' : 'П'}: ${m.text.slice(0, 300)}`)
      .join('\n');

    const entry = `[${d.tag}]${d.product_name ? ` Товар: ${d.product_name}` : ''}\n${msgs}`;

    if (totalChars + entry.length > MAX_CHARS) break;
    totalChars += entry.length;
    compactDialogues.push(entry);
  }

  // Build existing items list for deduplication
  const existingList: string[] = [];
  if (existingFaq.length > 0) {
    existingList.push('## Уже существующие FAQ:');
    existingFaq.forEach(f => existingList.push(`- ${f.question}`));
  }
  if (existingGuides.length > 0) {
    existingList.push('## Уже существующие инструкции:');
    existingGuides.forEach(g => existingList.push(`- ${g.title}`));
  }

  const userContent = [
    `Магазин: ${store.name}`,
    `Проанализировано диалогов: ${compactDialogues.length}`,
    existingList.length > 0 ? existingList.join('\n') : '',
    '',
    '## Диалоги:',
    compactDialogues.join('\n---\n'),
  ].filter(Boolean).join('\n');

  const response = await runChatCompletion({
    operation: 'analyze-store-dialogues',
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    isJsonMode: true,
    storeId,
    ownerId: store.owner_id,
    entityType: 'store',
    entityId: storeId,
    maxTokens: 4096,
  });

  try {
    const parsed = JSON.parse(response);
    return {
      faq: Array.isArray(parsed.faq) ? parsed.faq : [],
      guides: Array.isArray(parsed.guides) ? parsed.guides : [],
      summary: parsed.summary || '',
      dialoguesAnalyzed: compactDialogues.length,
    };
  } catch {
    throw new Error('AI вернул невалидный JSON. Попробуйте ещё раз.');
  }
}
