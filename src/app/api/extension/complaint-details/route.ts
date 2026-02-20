/**
 * Complaint Details — receive full approved complaint data from Chrome Extension
 *
 * POST /api/extension/complaint-details
 *
 * Called after each successful screenshot of an approved complaint.
 * Mirrors Google Sheets "Жалобы V 2.0" data into complaint_details table.
 * Source of truth for: billing, client reporting, AI training.
 *
 * Dedup: (store_id, articul, feedback_date, file_name)
 *
 * @version 1.0.0
 * @date 2026-02-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';
import { createComplaintDetail } from '@/db/complaint-detail-helpers';

// ============================================
// Types
// ============================================

interface ComplaintInput {
  checkDate: string;            // DD.MM.YYYY
  cabinetName: string;          // WB store display name
  articul: string;              // WB nmId
  reviewId: string;             // Reserved, currently empty
  feedbackRating: number | string;  // 1-5
  feedbackDate: string;         // WB original format: "18 февр. 2026 г. в 21:45"
  complaintSubmitDate: string;  // DD.MM.YYYY or DD.MM
  status: string;               // Always "Одобрена"
  hasScreenshot: boolean;       // Always true
  fileName: string;             // "{articul}_{DD.MM.YY}_{HH-MM}.png"
  driveLink: string;            // Google Drive URL
  complaintCategory: string;    // WB complaint category
  complaintText: string;        // Full complaint text
}

interface PostRequestBody {
  storeId: string;
  complaint: ComplaintInput;
}

// CORS headers for Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Parse DD.MM.YYYY → YYYY-MM-DD for PostgreSQL DATE.
 * Returns null if format doesn't match.
 */
function parseDDMMYYYY(dateStr: string): string | null {
  const parts = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!parts) return null;
  return `${parts[3]}-${parts[2]}-${parts[1]}`;
}

/**
 * Detect who filed the complaint based on text prefix.
 * If starts with "Жалоба от:" — filed by R5 system.
 * Otherwise — filed by seller directly on WB.
 */
function detectFiledBy(complaintText: string): string {
  return complaintText.trimStart().startsWith('Жалоба от:') ? 'r5' : 'seller';
}

// ============================================
// POST /api/extension/complaint-details
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Extension ComplaintDetails] 📥 POST request received');

  try {
    // 1. Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Parse body
    let body: PostRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        { status: 400, headers: corsHeaders }
      );
    }

    const { storeId, complaint } = body;

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'storeId is required' } },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!complaint) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'complaint object is required' } },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Validate required complaint fields
    const required: (keyof ComplaintInput)[] = [
      'checkDate', 'cabinetName', 'articul', 'feedbackRating',
      'feedbackDate', 'fileName', 'complaintCategory', 'complaintText',
    ];
    for (const field of required) {
      if (complaint[field] === undefined || complaint[field] === null || complaint[field] === '') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `complaint.${field} is required` } },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // 4. Parse checkDate
    const checkDateISO = parseDDMMYYYY(complaint.checkDate);
    if (!checkDateISO) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid checkDate format: "${complaint.checkDate}". Expected DD.MM.YYYY` } },
        { status: 400, headers: corsHeaders }
      );
    }

    // 5. Verify store access
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
      [storeId]
    );
    if (!storeResult.rows[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Store ${storeId} not found` } },
        { status: 404, headers: corsHeaders }
      );
    }
    if (storeResult.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this store' } },
        { status: 403, headers: corsHeaders }
      );
    }

    // 6. Derive filed_by from complaint text
    const filedBy = detectFiledBy(complaint.complaintText);

    // 7. Normalize feedbackRating to integer
    const feedbackRating = typeof complaint.feedbackRating === 'string'
      ? parseInt(complaint.feedbackRating)
      : complaint.feedbackRating;

    if (isNaN(feedbackRating) || feedbackRating < 1 || feedbackRating > 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid feedbackRating: "${complaint.feedbackRating}". Expected 1-5` } },
        { status: 400, headers: corsHeaders }
      );
    }

    // 8. Create record (with dedup)
    const { detail, created } = await createComplaintDetail({
      store_id: storeId,
      owner_id: user.id,
      check_date: checkDateISO,
      cabinet_name: complaint.cabinetName,
      articul: complaint.articul,
      review_ext_id: complaint.reviewId || null,
      feedback_rating: feedbackRating,
      feedback_date: complaint.feedbackDate,
      complaint_submit_date: complaint.complaintSubmitDate || null,
      status: complaint.status || 'approved',
      has_screenshot: complaint.hasScreenshot ?? true,
      file_name: complaint.fileName,
      drive_link: complaint.driveLink || null,
      complaint_category: complaint.complaintCategory,
      complaint_text: complaint.complaintText,
      filed_by: filedBy,
    });

    const elapsed = Date.now() - startTime;

    console.log(
      `[Extension ComplaintDetails] ${created ? '✅ Created' : '⏩ Duplicate'} ` +
      `store=${storeId} articul=${complaint.articul} category="${complaint.complaintCategory}" ` +
      `filedBy=${filedBy} (${elapsed}ms)`
    );

    return NextResponse.json({
      success: true,
      data: {
        created,
        ...(!created ? { reason: 'duplicate' } : {}),
      },
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Extension ComplaintDetails] ❌ Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500, headers: corsHeaders }
    );
  }
}
