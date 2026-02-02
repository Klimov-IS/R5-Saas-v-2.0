/**
 * POST /api/admin/generate-empty-review-complaints
 *
 * Bulk generate template-based complaints for all empty reviews (1-3 stars)
 * Uses 4 template variants with hash-based rotation (A/B testing)
 *
 * Query params:
 * - limit: number (default: 100, max: 1000) - batch size per request
 * - dry_run: boolean (default: false) - preview only, don't create complaints
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { selectTemplateByReviewId } from '@/ai/utils/complaint-templates';
import { bulkCreateComplaints, COMPLAINT_CUTOFF_DATE } from '@/db/complaint-helpers';
import type { CreateReviewComplaintInput } from '@/types/complaints';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

interface Review {
  id: string;
  store_id: string;
  owner_id: string;
  product_id: string;
  rating: number;
  text: string | null;
  date: string;
  product_name: string | null;
  product_vendor_code: string | null;
  product_is_active: boolean;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const dryRun = searchParams.get('dry_run') === 'true';

    console.log(`[BULK TEMPLATE] Starting bulk template generation (limit=${limit}, dry_run=${dryRun})`);

    // 1. Get empty reviews without complaints (rating 1-3)
    const reviewsResult = await query<Review>(`
      SELECT
        r.id,
        r.store_id,
        r.owner_id,
        r.product_id,
        r.rating,
        r.text,
        r.date,
        p.name as product_name,
        p.vendor_code as product_vendor_code,
        p.is_active as product_is_active
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.rating BETWEEN 1 AND 3
        AND r.date >= '${COMPLAINT_CUTOFF_DATE}'
        AND (r.text IS NULL OR TRIM(r.text) = '')
        AND (r.pros IS NULL OR TRIM(r.pros) = '')
        AND (r.cons IS NULL OR TRIM(r.cons) = '')
        AND rc.id IS NULL
      ORDER BY r.created_at DESC
      LIMIT $1
    `, [limit]);

    const reviews = reviewsResult.rows;

    if (reviews.length === 0) {
      return NextResponse.json({
        message: 'No empty reviews found without complaints',
        generated: 0,
        skipped: 0,
        failed: 0,
        dry_run: dryRun,
      });
    }

    console.log(`[BULK TEMPLATE] Found ${reviews.length} empty reviews without complaints`);

    // 2. Prepare complaints data (select templates for each review)
    const variantStats = { A: 0, B: 0, C: 0, D: 0 };
    const complaintsToCreate: CreateReviewComplaintInput[] = [];
    const generated = [];

    for (const review of reviews) {
      // Select template variant by reviewId (A/B testing)
      const template = selectTemplateByReviewId(review.id);
      const variantLetter = String.fromCharCode(65 + template.variantId); // 0→A, 1→B, 2→C, 3→D

      variantStats[variantLetter as keyof typeof variantStats]++;

      const complaintData: CreateReviewComplaintInput = {
        review_id: review.id,
        store_id: review.store_id,
        owner_id: review.owner_id,
        product_id: review.product_id,
        complaint_text: template.complaintText,
        reason_id: template.reasonId,
        reason_name: template.reasonName,
        review_rating: review.rating,
        review_text: review.text || '',
        review_date: review.date,
        product_name: review.product_name,
        product_vendor_code: review.product_vendor_code,
        product_is_active: review.product_is_active !== false,
        ai_model: 'deepseek-chat',
        ai_prompt_tokens: 0,
        ai_completion_tokens: 0,
        ai_total_tokens: 0,
        ai_cost_usd: 0, // Zero cost for templates
        generation_duration_ms: 0,
      };

      complaintsToCreate.push(complaintData);

      generated.push({
        review_id: review.id,
        rating: review.rating,
        variant: variantLetter,
        variant_id: template.variantId,
        reason_id: template.reasonId,
        reason_name: template.reasonName,
        template_preview: dryRun ? template.complaintText.substring(0, 100) + '...' : undefined,
        cost_usd: 0,
      });
    }

    // 3. Bulk insert all complaints in a single SQL query (100x faster!)
    const failed = [];
    const skipped = [];

    if (!dryRun && complaintsToCreate.length > 0) {
      try {
        console.log(`[BULK TEMPLATE] Executing bulk INSERT for ${complaintsToCreate.length} complaints...`);
        await bulkCreateComplaints(complaintsToCreate);
        console.log(`[BULK TEMPLATE] ✅ Bulk INSERT completed successfully`);
      } catch (error: any) {
        console.error(`[BULK TEMPLATE] Bulk INSERT failed:`, error.message);
        // If bulk fails, mark all as failed
        return NextResponse.json({
          success: false,
          error: `Bulk insert failed: ${error.message}`,
          generated: [],
          failed: generated.map(g => ({ review_id: g.review_id, error: error.message })),
          skipped: [],
        }, { status: 500 });
      }
    }

    const durationMs = Date.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);

    console.log(`[BULK TEMPLATE] ✅ Complete: ${generated.length} generated, ${failed.length} failed in ${durationSec}s`);
    console.log(`[BULK TEMPLATE] Variant distribution: A=${variantStats.A}, B=${variantStats.B}, C=${variantStats.C}, D=${variantStats.D}`);

    return NextResponse.json({
      success: true,
      message: dryRun
        ? `Dry run complete: would generate ${generated.length} complaints`
        : `Successfully generated ${generated.length} template-based complaints`,
      generated,
      failed,
      skipped,
      stats: {
        total_processed: reviews.length,
        generated_count: generated.length,
        failed_count: failed.length,
        skipped_count: skipped.length,
        variant_distribution: variantStats,
        duration_ms: durationMs,
        duration_sec: parseFloat(durationSec),
        reviews_per_second: (generated.length / (durationMs / 1000)).toFixed(1),
      },
      dry_run: dryRun,
    });

  } catch (error: any) {
    console.error('[BULK TEMPLATE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
