import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyApiKey } from '@/lib/server-utils';
import { getDeletionCaseByChatId } from '@/db/deletion-case-helpers';

/**
 * Get deletion case by chat ID
 * GET /api/stores/{storeId}/deletion-cases/{chatId}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    // Verify API key
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { chatId } = params;

    const deletionCase = await getDeletionCaseByChatId(chatId);

    if (!deletionCase) {
      return NextResponse.json(
        { error: 'Deletion case not found' },
        { status: 404 }
      );
    }

    // Map to camelCase for frontend
    return NextResponse.json({
      id: deletionCase.id,
      status: deletionCase.status,
      offerAmount: deletionCase.offer_amount,
      compensationType: deletionCase.compensation_type,
      offerMessage: deletionCase.offer_message,
      offerStrategy: deletionCase.offer_strategy,
      clientName: deletionCase.client_name,
      clientResponse: deletionCase.client_response,
      clientAgreedAt: deletionCase.client_agreed_at,
      aiEstimatedSuccess: deletionCase.ai_estimated_success,
      createdAt: deletionCase.created_at,
      offerSentAt: deletionCase.offer_sent_at,
    });

  } catch (error: any) {
    console.error('[API ERROR] GET /deletion-cases/[chatId]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
