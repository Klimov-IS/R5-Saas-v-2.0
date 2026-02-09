import { NextRequest, NextResponse } from 'next/server';
import { updateStoreFaqEntry, deleteStoreFaqEntry } from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * PUT /api/stores/[storeId]/faq/[faqId]
 * Update a FAQ entry
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string; faqId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { question, answer, is_active, sort_order } = body;

    const entry = await updateStoreFaqEntry(params.faqId, {
      question,
      answer,
      is_active,
      sort_order,
    });

    if (!entry) {
      return NextResponse.json({ error: 'FAQ entry not found or no changes' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error: any) {
    console.error('[API ERROR] PUT /faq/[faqId]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/stores/[storeId]/faq/[faqId]
 * Delete a FAQ entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { storeId: string; faqId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const deleted = await deleteStoreFaqEntry(params.faqId);
    if (!deleted) {
      return NextResponse.json({ error: 'FAQ entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API ERROR] DELETE /faq/[faqId]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
