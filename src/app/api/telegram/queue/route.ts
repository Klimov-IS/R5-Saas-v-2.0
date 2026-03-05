import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { getQueue } from '@/core/services/queue-service';

/**
 * GET /api/telegram/queue
 *
 * Returns unified cross-store chat queue with status and store filtering.
 * Query params:
 *   - status: chat status filter (default: 'awaiting_reply'). Use 'all' for no filter.
 *   - storeIds: comma-separated store IDs to filter (intersected with accessible).
 *   - ratings: comma-separated review ratings to filter (e.g. '1,2,3').
 *   - limit: max items (default 50, max 100).
 *   - offset: pagination offset.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const storeIds = await getAccessibleStoreIds(auth.userId);

    const { searchParams } = new URL(request.url);
    const filterStoreIdsParam = searchParams.get('storeIds');
    const ratingsParam = searchParams.get('ratings');

    const result = await getQueue(storeIds, {
      status: (searchParams.get('status') || 'awaiting_reply') as any,
      limit: Math.min(parseInt(searchParams.get('limit') || '50', 10), 100),
      offset: parseInt(searchParams.get('offset') || '0', 10),
      filterStoreIds: filterStoreIdsParam
        ? filterStoreIdsParam.split(',').filter(Boolean)
        : undefined,
      filterRatings: ratingsParam
        ? ratingsParam.split(',').map(Number).filter(n => n >= 1 && n <= 5)
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[TG-QUEUE] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
