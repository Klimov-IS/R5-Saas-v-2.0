/**
 * GET /api/admin/analyze-empty-reviews
 *
 * Analyze empty reviews statistics for template-based complaints
 */

import { NextResponse } from 'next/server';
import { query } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Overall statistics for rating 1-3
    const overallResult = await query<{
      total_reviews_1_3: string;
      empty_reviews_1_3: string;
      empty_with_complaint: string;
      empty_without_complaint: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE rating BETWEEN 1 AND 3) as total_reviews_1_3,
        COUNT(*) FILTER (
          WHERE rating BETWEEN 1 AND 3
          AND (text IS NULL OR TRIM(text) = '')
          AND (pros IS NULL OR TRIM(pros) = '')
          AND (cons IS NULL OR TRIM(cons) = '')
        ) as empty_reviews_1_3,
        COUNT(rc.id) FILTER (
          WHERE r.rating BETWEEN 1 AND 3
          AND (r.text IS NULL OR TRIM(r.text) = '')
          AND (r.pros IS NULL OR TRIM(r.pros) = '')
          AND (r.cons IS NULL OR TRIM(r.cons) = '')
        ) as empty_with_complaint,
        COUNT(*) FILTER (
          WHERE r.rating BETWEEN 1 AND 3
          AND (r.text IS NULL OR TRIM(r.text) = '')
          AND (r.pros IS NULL OR TRIM(r.pros) = '')
          AND (r.cons IS NULL OR TRIM(r.cons) = '')
          AND rc.id IS NULL
        ) as empty_without_complaint
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
    `);

    const overall = overallResult.rows[0];

    // Breakdown by rating
    const breakdownResult = await query<{
      rating: number;
      total_reviews: string;
      with_complaint: string;
      without_complaint: string;
    }>(`
      SELECT
        r.rating,
        COUNT(*) as total_reviews,
        COUNT(rc.id) as with_complaint,
        COUNT(*) FILTER (WHERE rc.id IS NULL) as without_complaint
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.rating BETWEEN 1 AND 3
        AND (r.text IS NULL OR TRIM(r.text) = '')
        AND (r.pros IS NULL OR TRIM(r.pros) = '')
        AND (r.cons IS NULL OR TRIM(r.cons) = '')
      GROUP BY r.rating
      ORDER BY r.rating
    `);

    // Old rule (1-2) vs New rule (1-3)
    const oldRuleResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.rating BETWEEN 1 AND 2
        AND (r.text IS NULL OR TRIM(r.text) = '')
        AND (r.pros IS NULL OR TRIM(r.pros) = '')
        AND (r.cons IS NULL OR TRIM(r.cons) = '')
        AND rc.id IS NULL
    `);

    const newRuleResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.rating BETWEEN 1 AND 3
        AND (r.text IS NULL OR TRIM(r.text) = '')
        AND (r.pros IS NULL OR TRIM(r.pros) = '')
        AND (r.cons IS NULL OR TRIM(r.cons) = '')
        AND rc.id IS NULL
    `);

    const oldRuleCount = parseInt(oldRuleResult.rows[0].count);
    const newRuleCount = parseInt(newRuleResult.rows[0].count);

    return NextResponse.json({
      overall: {
        total_reviews_1_3: parseInt(overall.total_reviews_1_3),
        empty_reviews_1_3: parseInt(overall.empty_reviews_1_3),
        empty_with_complaint: parseInt(overall.empty_with_complaint),
        empty_without_complaint: parseInt(overall.empty_without_complaint),
      },
      breakdown_by_rating: breakdownResult.rows.map(row => ({
        rating: row.rating,
        total_reviews: parseInt(row.total_reviews),
        with_complaint: parseInt(row.with_complaint),
        without_complaint: parseInt(row.without_complaint),
      })),
      rule_comparison: {
        old_rule_1_2_stars: oldRuleCount,
        new_rule_1_3_stars: newRuleCount,
        additional_reviews: newRuleCount - oldRuleCount,
        increase_percent: oldRuleCount > 0 ? ((newRuleCount - oldRuleCount) / oldRuleCount * 100).toFixed(1) : '0',
      }
    });
  } catch (error: any) {
    console.error('[ANALYZE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
