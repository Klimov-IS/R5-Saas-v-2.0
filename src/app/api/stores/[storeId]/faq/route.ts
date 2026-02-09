import { NextRequest, NextResponse } from 'next/server';
import { getStoreFaq, createStoreFaqEntry } from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * GET /api/stores/[storeId]/faq
 * Get all FAQ entries for a store
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const entries = await getStoreFaq(params.storeId);
    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error('[API ERROR] GET /faq:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/stores/[storeId]/faq
 * Create a new FAQ entry
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

    const body = await request.json();
    const { question, answer } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'question and answer are required' },
        { status: 400 }
      );
    }

    const entry = await createStoreFaqEntry(params.storeId, question, answer);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error: any) {
    console.error('[API ERROR] POST /faq:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
