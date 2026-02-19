/**
 * Unified Tasks Endpoint for Chrome Extension
 *
 * GET /api/extension/stores/{storeId}/tasks
 *
 * Returns ALL work items for a store, grouped by article (nmId).
 * The backend is the "brain" — extension just executes.
 *
 * 3 task types:
 *   - statusParses:  reviews needing full status parsing (chat/complaint/review statuses)
 *   - chatOpens:     reviews needing chat action (type: "open" = new chat, "link" = bind existing)
 *   - complaints:    reviews with ready AI-generated complaint drafts
 *
 * Auth: Bearer token (user_settings.api_key)
 *
 * @version 1.1.0
 * @date 2026-02-19
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

// Helper: build reviewKey for DOM matching (nmId_rating_dateMinute)
function buildReviewKey(nmId: string, rating: number, date: string): string {
  // Truncate to minute: "2026-01-15T10:30:37.000Z" → "2026-01-15T10:30"
  const d = new Date(date);
  const iso = d.toISOString(); // "2026-01-15T10:30:37.000Z"
  const minuteTrunc = iso.slice(0, 16); // "2026-01-15T10:30"
  return `${nmId}_${rating}_${minuteTrunc}`;
}

// ============================================================================
// GET /api/extension/stores/{storeId}/tasks
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;
  const startTime = Date.now();

  console.log(`[Extension Tasks] 📋 Запрос задач для магазина ${storeId}`);

  try {
    // 1. Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401 }
      );
    }

    // 2. Verify store access
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
      [storeId]
    );
    if (!storeResult.rows[0]) {
      return NextResponse.json(
        { error: 'Not found', message: `Store ${storeId} not found` },
        { status: 404 }
      );
    }
    if (storeResult.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this store' },
        { status: 403 }
      );
    }

    // 3. Run all 3 queries in parallel
    const [statusParsesResult, chatOpensResult, chatLinksResult, complaintsResult] = await Promise.all([
      // ── Query A: statusParses ──
      // Reviews that haven't been parsed by extension yet (chat_status unknown/null).
      // Only reviews matching product rules (complaint or chat ratings).
      // Sorted by date ASC = oldest first (priority: parse stale reviews first).
      query<{
        id: string;
        wb_product_id: string;
        rating: number;
        date: string;
        author: string;
        text: string;
        complaint_status: string | null;
        chat_status_by_review: string | null;
        review_status_wb: string | null;
      }>(
        `SELECT r.id, p.wb_product_id, r.rating, r.date, r.author, r.text,
                r.complaint_status, r.chat_status_by_review, r.review_status_wb
         FROM reviews r
         JOIN products p ON r.product_id = p.id
         JOIN product_rules pr ON pr.product_id = p.id
         WHERE r.store_id = $1
           AND r.review_status_wb != 'deleted'
           AND r.marketplace = 'wb'
           AND p.work_status = 'active'
           AND (r.chat_status_by_review IS NULL OR r.chat_status_by_review = 'unknown')
           AND (
             (pr.submit_complaints = TRUE AND (
               (r.rating = 1 AND pr.complaint_rating_1 = TRUE) OR
               (r.rating = 2 AND pr.complaint_rating_2 = TRUE) OR
               (r.rating = 3 AND pr.complaint_rating_3 = TRUE) OR
               (r.rating = 4 AND pr.complaint_rating_4 = TRUE)
             ))
             OR
             (pr.work_in_chats = TRUE AND (
               (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
               (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
               (r.rating = 3 AND pr.chat_rating_3 = TRUE) OR
               (r.rating = 4 AND pr.chat_rating_4 = TRUE)
             ))
           )
         ORDER BY p.wb_product_id, r.date ASC
         LIMIT 500`,
        [storeId]
      ),

      // ── Query B: chatOpens (type: "open") ──
      // Reviews where complaint was rejected, chat is available, no existing link.
      // Sorted by date ASC = oldest rejected complaints first.
      query<{
        id: string;
        wb_product_id: string;
        rating: number;
        date: string;
        author: string;
        text: string;
      }>(
        `SELECT DISTINCT ON (r.id)
                r.id, p.wb_product_id, r.rating, r.date, r.author, r.text
         FROM reviews r
         JOIN review_complaints rc ON rc.review_id = r.id
         JOIN products p ON r.product_id = p.id
         JOIN product_rules pr ON pr.product_id = p.id
         WHERE r.store_id = $1
           AND rc.status = 'rejected'
           AND pr.work_in_chats = TRUE
           AND r.chat_status_by_review = 'available'
           AND r.review_status_wb != 'deleted'
           AND r.marketplace = 'wb'
           AND p.work_status = 'active'
           AND (
             (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
             (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
             (r.rating = 3 AND pr.chat_rating_3 = TRUE) OR
             (r.rating = 4 AND pr.chat_rating_4 = TRUE)
           )
           AND NOT EXISTS (
             SELECT 1 FROM review_chat_links rcl
             WHERE rcl.store_id = r.store_id
               AND rcl.review_nm_id = p.wb_product_id
               AND rcl.review_rating = r.rating
               AND rcl.review_date BETWEEN r.date - interval '2 minutes'
                                        AND r.date + interval '2 minutes'
           )
         ORDER BY r.id, r.date ASC
         LIMIT 200`,
        [storeId]
      ),

      // ── Query C: chatLinks (type: "link") ──
      // Reviews where chat is already opened but not linked in our DB.
      // Sorted by date ASC = oldest unlinked chats first.
      query<{
        id: string;
        wb_product_id: string;
        rating: number;
        date: string;
        author: string;
        text: string;
      }>(
        `SELECT r.id, p.wb_product_id, r.rating, r.date, r.author, r.text
         FROM reviews r
         JOIN products p ON r.product_id = p.id
         JOIN product_rules pr ON pr.product_id = p.id
         WHERE r.store_id = $1
           AND r.chat_status_by_review = 'opened'
           AND pr.work_in_chats = TRUE
           AND r.review_status_wb != 'deleted'
           AND r.marketplace = 'wb'
           AND p.work_status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM review_chat_links rcl
             WHERE rcl.store_id = r.store_id
               AND rcl.review_nm_id = p.wb_product_id
               AND rcl.review_rating = r.rating
               AND rcl.review_date BETWEEN r.date - interval '2 minutes'
                                        AND r.date + interval '2 minutes'
           )
         ORDER BY p.wb_product_id, r.date ASC
         LIMIT 200`,
        [storeId]
      ),

      // ── Query D: complaints ──
      // Reviews with ready AI complaint drafts (existing logic from complaints endpoint).
      // Sorted by date ASC = oldest reviews first.
      query<{
        id: string;
        wb_product_id: string;
        rating: number;
        date: string;
        author: string;
        text: string;
        reason_id: number;
        reason_name: string;
        complaint_text: string;
      }>(
        `SELECT r.id, p.wb_product_id, r.rating, r.date, r.author, r.text,
                rc.reason_id, rc.reason_name, rc.complaint_text
         FROM review_complaints rc
         JOIN reviews r ON r.id = rc.review_id
         JOIN products p ON r.product_id = p.id
         WHERE rc.store_id = $1
           AND rc.status = 'draft'
           AND r.store_id = $1
           AND p.work_status = 'active'
           AND (r.complaint_status IS NULL OR r.complaint_status IN ('not_sent', 'draft'))
           AND r.review_status_wb != 'deleted'
         ORDER BY p.wb_product_id, r.date ASC
         LIMIT 500`,
        [storeId]
      ),
    ]);

    // 4. Group everything by article (nmId)
    // chatOpens and chatLinks are merged into one array with type field
    const articles: Record<string, {
      nmId: string;
      statusParses: any[];
      chatOpens: any[];
      complaints: any[];
    }> = {};

    const ensureArticle = (nmId: string) => {
      if (!articles[nmId]) {
        articles[nmId] = { nmId, statusParses: [], chatOpens: [], complaints: [] };
      }
      return articles[nmId];
    };

    // statusParses
    for (const row of statusParsesResult.rows) {
      const article = ensureArticle(row.wb_product_id);
      article.statusParses.push({
        reviewId: row.id,
        reviewKey: buildReviewKey(row.wb_product_id, row.rating, row.date),
        rating: row.rating,
        date: row.date,
        authorName: row.author,
        text: row.text,
        currentComplaintStatus: row.complaint_status || null,
        currentChatStatus: row.chat_status_by_review || null,
        currentReviewStatus: row.review_status_wb || null,
      });
    }

    // chatOpens (type: "open" — new chats to open)
    for (const row of chatOpensResult.rows) {
      const article = ensureArticle(row.wb_product_id);
      article.chatOpens.push({
        type: 'open' as const,
        reviewId: row.id,
        reviewKey: buildReviewKey(row.wb_product_id, row.rating, row.date),
        rating: row.rating,
        date: row.date,
        authorName: row.author,
        text: row.text,
      });
    }

    // chatLinks (type: "link" — bind existing opened chats)
    // Merged into chatOpens array, links go FIRST (higher priority — quick wins)
    for (const row of chatLinksResult.rows) {
      const article = ensureArticle(row.wb_product_id);
      article.chatOpens.unshift({
        type: 'link' as const,
        reviewId: row.id,
        reviewKey: buildReviewKey(row.wb_product_id, row.rating, row.date),
        rating: row.rating,
        date: row.date,
        authorName: row.author,
        text: row.text,
      });
    }

    // complaints
    for (const row of complaintsResult.rows) {
      const article = ensureArticle(row.wb_product_id);
      article.complaints.push({
        reviewId: row.id,
        reviewKey: buildReviewKey(row.wb_product_id, row.rating, row.date),
        rating: row.rating,
        text: row.text,
        authorName: row.author,
        createdAt: row.date,
        complaintText: {
          reasonId: row.reason_id,
          reasonName: row.reason_name,
          complaintText: row.complaint_text,
        },
      });
    }

    const elapsed = Date.now() - startTime;

    const totals = {
      statusParses: statusParsesResult.rows.length,
      chatOpens: chatOpensResult.rows.length + chatLinksResult.rows.length,
      chatOpensNew: chatOpensResult.rows.length,
      chatLinks: chatLinksResult.rows.length,
      complaints: complaintsResult.rows.length,
      articles: Object.keys(articles).length,
    };

    console.log(
      `[Extension Tasks] ✅ Задачи готовы (${elapsed}ms): ` +
      `statusParses=${totals.statusParses}, chatOpens=${totals.chatOpensNew}, ` +
      `chatLinks=${totals.chatLinks}, complaints=${totals.complaints}, ` +
      `articles=${totals.articles}`
    );

    return NextResponse.json({
      storeId,
      articles,
      totals,
      limits: {
        maxChatsPerRun: 50,
        maxComplaintsPerRun: 300,
        cooldownBetweenChatsMs: 3000,
        cooldownBetweenComplaintsMs: 1000,
      },
    });

  } catch (error: any) {
    console.error(`[Extension Tasks] ❌ Ошибка:`, error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
