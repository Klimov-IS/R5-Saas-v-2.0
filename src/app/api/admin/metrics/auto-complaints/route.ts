/**
 * Auto-Complaint Metrics API
 *
 * Provides KPIs to monitor event-driven auto-complaint generation:
 * - Reviews without complaints (backlog size)
 * - Event-driven coverage percentage
 * - CRON fallback usage
 * - Generation success rate
 *
 * GET /api/admin/metrics/auto-complaints
 *
 * Response:
 * {
 *   total_reviews: number,
 *   reviews_with_complaints: number,
 *   reviews_without_complaints: number,
 *   coverage_percentage: number,
 *   breakdown_by_rating: {
 *     rating_1: { with_complaint: number, without_complaint: number },
 *     rating_2: { with_complaint: number, without_complaint: number },
 *     rating_3: { with_complaint: number, without_complaint: number },
 *     rating_4: { with_complaint: number, without_complaint: number }
 *   },
 *   recent_generation_stats: {
 *     last_24h_reviews: number,
 *     last_24h_complaints_generated: number,
 *     instant_generation_rate: number
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';

export const dynamic = 'force-dynamic';

interface MetricsResponse {
  total_reviews: number;
  reviews_with_complaints: number;
  reviews_without_complaints: number;
  coverage_percentage: number;
  breakdown_by_rating: {
    rating_1: { with_complaint: number; without_complaint: number };
    rating_2: { with_complaint: number; without_complaint: number };
    rating_3: { with_complaint: number; without_complaint: number };
    rating_4: { with_complaint: number; without_complaint: number };
  };
  recent_generation_stats: {
    last_24h_reviews: number;
    last_24h_complaints_generated: number;
    instant_generation_rate: number;
  };
  active_stores_count: number;
  active_products_count: number;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Overall coverage statistics
    const overallStatsResult = await query<{
      total_reviews: string;
      reviews_with_complaints: string;
      reviews_without_complaints: string;
    }>(
      `
      SELECT
        COUNT(r.id) as total_reviews,
        COUNT(rc.id) as reviews_with_complaints,
        COUNT(r.id) - COUNT(rc.id) as reviews_without_complaints
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.rating BETWEEN 1 AND 4
      `
    );

    const overallStats = overallStatsResult.rows[0];
    const totalReviews = parseInt(overallStats.total_reviews);
    const reviewsWithComplaints = parseInt(overallStats.reviews_with_complaints);
    const reviewsWithoutComplaints = parseInt(overallStats.reviews_without_complaints);

    const coveragePercentage =
      totalReviews > 0 ? (reviewsWithComplaints / totalReviews) * 100 : 0;

    // 2. Breakdown by rating (1-4 stars only)
    const breakdownResult = await query<{
      rating: number;
      with_complaint: string;
      without_complaint: string;
    }>(
      `
      SELECT
        r.rating,
        COUNT(rc.id) as with_complaint,
        COUNT(r.id) - COUNT(rc.id) as without_complaint
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.rating BETWEEN 1 AND 4
      GROUP BY r.rating
      ORDER BY r.rating
      `
    );

    const breakdownByRating = {
      rating_1: { with_complaint: 0, without_complaint: 0 },
      rating_2: { with_complaint: 0, without_complaint: 0 },
      rating_3: { with_complaint: 0, without_complaint: 0 },
      rating_4: { with_complaint: 0, without_complaint: 0 },
    };

    for (const row of breakdownResult.rows) {
      const ratingKey = `rating_${row.rating}` as keyof typeof breakdownByRating;
      breakdownByRating[ratingKey] = {
        with_complaint: parseInt(row.with_complaint),
        without_complaint: parseInt(row.without_complaint),
      };
    }

    // 3. Recent generation stats (last 24 hours)
    const recentStatsResult = await query<{
      last_24h_reviews: string;
      last_24h_complaints_generated: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*) FROM reviews
         WHERE rating BETWEEN 1 AND 4
         AND created_at >= NOW() - INTERVAL '24 hours') as last_24h_reviews,
        (SELECT COUNT(*) FROM review_complaints
         WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_complaints_generated
      `
    );

    const recentStats = recentStatsResult.rows[0];
    const last24hReviews = parseInt(recentStats.last_24h_reviews);
    const last24hComplaintsGenerated = parseInt(recentStats.last_24h_complaints_generated);

    const instantGenerationRate =
      last24hReviews > 0 ? (last24hComplaintsGenerated / last24hReviews) * 100 : 0;

    // 4. Active stores and products count
    const activeCountsResult = await query<{
      active_stores: string;
      active_products: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*) FROM stores WHERE status = 'active') as active_stores,
        (SELECT COUNT(*) FROM products WHERE is_active = true) as active_products
      `
    );

    const activeCounts = activeCountsResult.rows[0];

    // Build response
    const metrics: MetricsResponse = {
      total_reviews: totalReviews,
      reviews_with_complaints: reviewsWithComplaints,
      reviews_without_complaints: reviewsWithoutComplaints,
      coverage_percentage: Math.round(coveragePercentage * 100) / 100,
      breakdown_by_rating: breakdownByRating,
      recent_generation_stats: {
        last_24h_reviews: last24hReviews,
        last_24h_complaints_generated: last24hComplaintsGenerated,
        instant_generation_rate: Math.round(instantGenerationRate * 100) / 100,
      },
      active_stores_count: parseInt(activeCounts.active_stores),
      active_products_count: parseInt(activeCounts.active_products),
    };

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('[METRICS] Failed to fetch auto-complaint metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
