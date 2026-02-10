import { NextRequest, NextResponse } from 'next/server';
import { getStoreById } from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import { analyzeStoreDialogues } from '@/ai/flows/analyze-store-dialogues-flow';

/**
 * POST /api/stores/[storeId]/analyze-dialogues
 * Analyze recent dialogues to generate FAQ and guide suggestions.
 * This is a long-running operation (~15-30s depending on dialogue count).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const store = await getStoreById(params.storeId);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    console.log(`[ANALYZE-DIALOGUES] Starting analysis for store ${store.name} (${store.id})`);

    const result = await analyzeStoreDialogues(params.storeId);

    console.log(`[ANALYZE-DIALOGUES] Done for store ${store.name}: ${result.faq.length} FAQ, ${result.guides.length} guides from ${result.dialoguesAnalyzed} dialogues`);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API ERROR] POST /analyze-dialogues:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
