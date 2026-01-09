import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { query } from '@/db/client';

/**
 * Get review statistics for filters
 * Returns counts for preset filters and rating distribution
 */
export async function GET(request: NextRequest, { params }: { params: { storeId: string } }) {
  const { storeId } = params;

  try {
    // Get preset filter counts
    const presetStatsQuery = `
      SELECT
        -- Требуют внимания: 1-3 stars, active, not_sent
        COUNT(*) FILTER (
          WHERE rating <= 3
          AND complaint_status = 'not_sent'
          AND EXISTS (SELECT 1 FROM products WHERE products.id = reviews.product_id AND products.is_active = true)
        ) as attention,

        -- Одобрены
        COUNT(*) FILTER (WHERE complaint_status = 'approved') as approved,

        -- Отклонены
        COUNT(*) FILTER (WHERE complaint_status = 'rejected') as rejected,

        -- Черновики
        COUNT(*) FILTER (WHERE complaint_status = 'draft') as drafts,

        -- Всего
        COUNT(*) as total
      FROM reviews
      WHERE store_id = $1
    `;

    // Get rating distribution
    const ratingStatsQuery = `
      SELECT
        rating,
        COUNT(*) as count
      FROM reviews
      WHERE store_id = $1
      GROUP BY rating
      ORDER BY rating
    `;

    const [presetStats, ratingStats] = await Promise.all([
      query<{ attention: string; approved: string; rejected: string; drafts: string; total: string }>(
        presetStatsQuery,
        [storeId]
      ),
      query<{ rating: number; count: string }>(ratingStatsQuery, [storeId])
    ]);

    // Format preset stats
    const stats = {
      attention: parseInt(presetStats.rows[0]?.attention || '0', 10),
      approved: parseInt(presetStats.rows[0]?.approved || '0', 10),
      rejected: parseInt(presetStats.rows[0]?.rejected || '0', 10),
      drafts: parseInt(presetStats.rows[0]?.drafts || '0', 10),
      total: parseInt(presetStats.rows[0]?.total || '0', 10),
    };

    // Format rating counts
    const ratingCounts: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    ratingStats.rows.forEach(row => {
      if (row.rating >= 1 && row.rating <= 5) {
        ratingCounts[row.rating] = parseInt(row.count, 10);
      }
    });

    return NextResponse.json({
      stats,
      ratingCounts
    }, { status: 200 });

  } catch (error: any) {
    console.error('Failed to fetch review stats:', error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
