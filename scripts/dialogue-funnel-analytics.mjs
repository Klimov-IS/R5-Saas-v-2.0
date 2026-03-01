/**
 * Dialogue Funnel Analytics
 *
 * Analyzes review-linked chats to understand:
 * - Distribution by tags (deletion workflow stages)
 * - Message counts and reply patterns
 * - Funnel conversion rates
 * - Auto-sequence effectiveness
 * - Buyer response patterns
 *
 * Run: node scripts/dialogue-funnel-analytics.mjs
 * Safe: READ-ONLY, no data modifications
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('=== DIALOGUE FUNNEL ANALYTICS ===\n');

  // 1. Distribution by tags
  console.log('--- 1. DISTRIBUTION BY TAGS ---');
  const tagDist = await pool.query(`
    SELECT c.tag, COUNT(*) as total,
           COUNT(CASE WHEN c.status = 'awaiting_reply' THEN 1 END) as awaiting,
           COUNT(CASE WHEN c.status = 'inbox' THEN 1 END) as inbox,
           COUNT(CASE WHEN c.status = 'in_progress' THEN 1 END) as in_progress,
           COUNT(CASE WHEN c.status = 'closed' THEN 1 END) as closed
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    GROUP BY c.tag
    ORDER BY total DESC
  `);
  console.table(tagDist.rows);

  // 2. Distribution by rating × tag
  console.log('\n--- 2. RATING × TAG ---');
  const ratingTag = await pool.query(`
    SELECT rcl.review_rating as rating, c.tag, COUNT(*) as total
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    WHERE rcl.review_rating IS NOT NULL
    GROUP BY rcl.review_rating, c.tag
    ORDER BY rcl.review_rating, total DESC
  `);
  console.table(ratingTag.rows);

  // 3. Message counts by tag
  console.log('\n--- 3. MESSAGE COUNTS BY TAG ---');
  const msgCounts = await pool.query(`
    SELECT c.tag,
           COUNT(*) as chats,
           ROUND(AVG(COALESCE(seller.cnt, 0)), 1) as avg_seller_msgs,
           ROUND(AVG(COALESCE(client.cnt, 0)), 1) as avg_client_msgs,
           COUNT(CASE WHEN COALESCE(client.cnt, 0) > 0 THEN 1 END) as chats_with_client_reply,
           ROUND(100.0 * COUNT(CASE WHEN COALESCE(client.cnt, 0) > 0 THEN 1 END) / NULLIF(COUNT(*), 0), 1) as reply_pct
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    LEFT JOIN (
      SELECT chat_id, COUNT(*) as cnt
      FROM chat_messages WHERE sender = 'seller'
      GROUP BY chat_id
    ) seller ON seller.chat_id = c.id
    LEFT JOIN (
      SELECT chat_id, COUNT(*) as cnt
      FROM chat_messages WHERE sender = 'client'
      GROUP BY chat_id
    ) client ON client.chat_id = c.id
    GROUP BY c.tag
    ORDER BY chats DESC
  `);
  console.table(msgCounts.rows);

  // 4. Chats where buyer replied then went silent (by tag)
  console.log('\n--- 4. BUYER REPLIED THEN SILENT (last_message_sender=seller, has client msgs) ---');
  const silentAfterReply = await pool.query(`
    SELECT c.tag, COUNT(*) as total
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    WHERE c.last_message_sender = 'seller'
      AND EXISTS (
        SELECT 1 FROM chat_messages cm
        WHERE cm.chat_id = c.id AND cm.sender = 'client'
      )
    GROUP BY c.tag
    ORDER BY total DESC
  `);
  console.table(silentAfterReply.rows);

  // 5. Average time-to-first-reply by buyer (days)
  console.log('\n--- 5. TIME TO FIRST CLIENT REPLY (days) ---');
  const timeToReply = await pool.query(`
    SELECT c.tag,
           COUNT(*) as chats_with_reply,
           ROUND(AVG(EXTRACT(EPOCH FROM (first_client.ts - first_seller.ts)) / 86400), 1) as avg_days_to_reply,
           ROUND(CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (first_client.ts - first_seller.ts)) / 86400
           ) AS numeric), 1) as median_days
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    INNER JOIN (
      SELECT chat_id, MIN(timestamp) as ts
      FROM chat_messages WHERE sender = 'seller'
      GROUP BY chat_id
    ) first_seller ON first_seller.chat_id = c.id
    INNER JOIN (
      SELECT chat_id, MIN(timestamp) as ts
      FROM chat_messages WHERE sender = 'client'
      GROUP BY chat_id
    ) first_client ON first_client.chat_id = c.id
    WHERE first_client.ts > first_seller.ts
    GROUP BY c.tag
    ORDER BY chats_with_reply DESC
  `);
  console.table(timeToReply.rows);

  // 6. Auto-sequence stats
  console.log('\n--- 6. AUTO-SEQUENCE STATS ---');
  const seqStats = await pool.query(`
    SELECT s.sequence_type,
           s.status as seq_status,
           COUNT(*) as total,
           ROUND(AVG(s.current_step), 1) as avg_step,
           MAX(s.max_steps) as max_steps,
           COUNT(CASE WHEN s.stop_reason = 'client_replied' THEN 1 END) as stopped_client_replied,
           COUNT(CASE WHEN s.stop_reason = 'review_resolved' THEN 1 END) as stopped_review_resolved,
           COUNT(CASE WHEN s.stop_reason = 'manual' THEN 1 END) as stopped_manual,
           COUNT(CASE WHEN s.stop_reason = 'status_changed' THEN 1 END) as stopped_status_changed
    FROM chat_auto_sequences s
    GROUP BY s.sequence_type, s.status
    ORDER BY s.sequence_type, total DESC
  `);
  console.table(seqStats.rows);

  // 7. On which step does client reply? (for active/stopped sequences)
  console.log('\n--- 7. CLIENT REPLY STEP DISTRIBUTION ---');
  const replyStep = await pool.query(`
    SELECT s.sequence_type,
           s.current_step as step_when_stopped,
           COUNT(*) as total
    FROM chat_auto_sequences s
    WHERE s.stop_reason = 'client_replied'
    GROUP BY s.sequence_type, s.current_step
    ORDER BY s.sequence_type, s.current_step
  `);
  console.table(replyStep.rows);

  // 8. Funnel: candidate → offered → agreed → confirmed
  console.log('\n--- 8. DELETION FUNNEL ---');
  const funnel = await pool.query(`
    SELECT
      COUNT(*) as total_linked,
      COUNT(CASE WHEN c.tag IN ('deletion_candidate','deletion_offered','deletion_agreed','deletion_confirmed') THEN 1 END) as in_deletion_funnel,
      COUNT(CASE WHEN c.tag = 'deletion_candidate' THEN 1 END) as candidates,
      COUNT(CASE WHEN c.tag = 'deletion_offered' THEN 1 END) as offered,
      COUNT(CASE WHEN c.tag = 'deletion_agreed' THEN 1 END) as agreed,
      COUNT(CASE WHEN c.tag = 'deletion_confirmed' THEN 1 END) as confirmed,
      COUNT(CASE WHEN c.tag = 'refund_requested' THEN 1 END) as refund_requested
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
  `);
  console.table(funnel.rows);

  // 9. Typical buyer first responses (first 80 chars, grouped)
  console.log('\n--- 9. TYPICAL BUYER FIRST RESPONSES (sample, first 80 chars) ---');
  const buyerResponses = await pool.query(`
    SELECT c.tag,
           LEFT(first_msg.text, 80) as first_client_message,
           COUNT(*) as occurrences
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    INNER JOIN (
      SELECT DISTINCT ON (chat_id) chat_id, text
      FROM chat_messages
      WHERE sender = 'client' AND text IS NOT NULL AND text != ''
      ORDER BY chat_id, timestamp ASC
    ) first_msg ON first_msg.chat_id = c.id
    GROUP BY c.tag, LEFT(first_msg.text, 80)
    HAVING COUNT(*) >= 2
    ORDER BY occurrences DESC
    LIMIT 30
  `);
  console.table(buyerResponses.rows);

  // 10. Message volume distribution (how many msgs before chat goes silent)
  console.log('\n--- 10. TOTAL MESSAGES PER CHAT DISTRIBUTION ---');
  const msgVolume = await pool.query(`
    SELECT
      CASE
        WHEN COALESCE(total.cnt, 0) = 0 THEN '0 msgs'
        WHEN COALESCE(total.cnt, 0) = 1 THEN '1 msg'
        WHEN COALESCE(total.cnt, 0) BETWEEN 2 AND 3 THEN '2-3 msgs'
        WHEN COALESCE(total.cnt, 0) BETWEEN 4 AND 6 THEN '4-6 msgs'
        WHEN COALESCE(total.cnt, 0) BETWEEN 7 AND 10 THEN '7-10 msgs'
        WHEN COALESCE(total.cnt, 0) BETWEEN 11 AND 20 THEN '11-20 msgs'
        ELSE '20+ msgs'
      END as msg_bucket,
      COUNT(*) as chats
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    LEFT JOIN (
      SELECT chat_id, COUNT(*) as cnt FROM chat_messages GROUP BY chat_id
    ) total ON total.chat_id = c.id
    GROUP BY 1
    ORDER BY MIN(COALESCE(total.cnt, 0))
  `);
  console.table(msgVolume.rows);

  // 11. Auto-sequence vs manual chats
  console.log('\n--- 11. CHATS WITH VS WITHOUT AUTO-SEQUENCES ---');
  const seqVsManual = await pool.query(`
    SELECT
      CASE WHEN s.id IS NOT NULL THEN 'has_sequence' ELSE 'no_sequence' END as seq_status,
      COUNT(*) as chats,
      COUNT(CASE WHEN COALESCE(client.cnt, 0) > 0 THEN 1 END) as with_client_reply,
      ROUND(100.0 * COUNT(CASE WHEN COALESCE(client.cnt, 0) > 0 THEN 1 END) / NULLIF(COUNT(*), 0), 1) as reply_pct
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    LEFT JOIN (
      SELECT DISTINCT ON (chat_id) chat_id, id FROM chat_auto_sequences ORDER BY chat_id, created_at DESC
    ) s ON s.chat_id = c.id
    LEFT JOIN (
      SELECT chat_id, COUNT(*) as cnt FROM chat_messages WHERE sender = 'client' GROUP BY chat_id
    ) client ON client.chat_id = c.id
    GROUP BY 1
  `);
  console.table(seqVsManual.rows);

  await pool.end();
  console.log('\n=== ANALYTICS COMPLETE ===');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
