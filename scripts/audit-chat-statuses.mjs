/**
 * Audit chat statuses — find dialogues in wrong stages
 * Run: node scripts/audit-chat-statuses.mjs
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB || 'wb_reputation',
  user: process.env.POSTGRES_USER || 'admin_R5',
  password: process.env.POSTGRES_PASSWORD || 'MyNewPass123',
  ssl: { rejectUnauthorized: false },
});

async function q(label, sql) {
  const r = await pool.query(sql);
  console.log('\n=== ' + label + ' ===');
  console.table(r.rows);
  return r.rows;
}

try {
  await q('1. STATUS DISTRIBUTION', `
    SELECT status, COUNT(*)::int as cnt FROM chats GROUP BY status ORDER BY cnt DESC
  `);

  await q('2. STATUS vs LAST_MESSAGE_SENDER', `
    SELECT status, last_message_sender, COUNT(*)::int as cnt
    FROM chats WHERE last_message_sender IS NOT NULL
    GROUP BY status, last_message_sender ORDER BY status, cnt DESC
  `);

  await q('3. INBOX + SELLER: active sequences?', `
    SELECT
      CASE WHEN cas.id IS NOT NULL THEN 'has_active_seq' ELSE 'no_active_seq' END as seq,
      COUNT(*)::int as cnt
    FROM chats c
    LEFT JOIN chat_auto_sequences cas ON cas.chat_id = c.id AND cas.status = 'active'
    WHERE c.status = 'inbox' AND c.last_message_sender = 'seller'
    GROUP BY 1
  `);

  await q('4. INBOX + SELLER: recency of last message', `
    SELECT
      CASE
        WHEN c.last_message_date > NOW() - INTERVAL '1 day' THEN 'last_24h'
        WHEN c.last_message_date > NOW() - INTERVAL '7 days' THEN 'last_7d'
        WHEN c.last_message_date > NOW() - INTERVAL '30 days' THEN 'last_30d'
        WHEN c.last_message_date IS NOT NULL THEN 'older_30d'
        ELSE 'no_date'
      END as recency,
      COUNT(*)::int as cnt
    FROM chats c
    WHERE c.status = 'inbox' AND c.last_message_sender = 'seller'
    GROUP BY 1 ORDER BY cnt DESC
  `);

  await q('5. IN_PROGRESS + CLIENT (should be inbox)', `
    SELECT c.id, c.last_message_date::text, c.status_updated_at::text, c.tag, c.marketplace
    FROM chats c
    WHERE c.status = 'in_progress' AND c.last_message_sender = 'client'
    ORDER BY c.last_message_date DESC LIMIT 10
  `);

  await q('6. AWAITING_REPLY breakdown', `
    SELECT c.marketplace,
      CASE WHEN cas.id IS NOT NULL THEN 'active_seq' ELSE 'no_seq' END as has_seq,
      c.last_message_sender,
      COUNT(*)::int as cnt
    FROM chats c
    LEFT JOIN chat_auto_sequences cas ON cas.chat_id = c.id AND cas.status = 'active'
    WHERE c.status = 'awaiting_reply'
    GROUP BY 1,2,3 ORDER BY cnt DESC
  `);

  await q('7. INBOX + SELLER: status staleness', `
    SELECT
      CASE
        WHEN c.status_updated_at IS NULL THEN 'never_updated'
        WHEN c.status_updated_at < c.last_message_date THEN 'status_stale'
        ELSE 'status_fresh'
      END as staleness,
      COUNT(*)::int as cnt
    FROM chats c
    WHERE c.status = 'inbox' AND c.last_message_sender = 'seller'
    GROUP BY 1 ORDER BY cnt DESC
  `);

  await q('8. AWAITING_REPLY orphaned: stop reasons', `
    SELECT cas.stop_reason, COUNT(*)::int as cnt
    FROM chats c
    JOIN chat_auto_sequences cas ON cas.chat_id = c.id
    WHERE c.status = 'awaiting_reply'
      AND cas.status = 'stopped'
      AND c.id NOT IN (SELECT chat_id FROM chat_auto_sequences WHERE status = 'active')
    GROUP BY 1 ORDER BY cnt DESC
    LIMIT 10
  `);

  await q('8b. TG VISIBLE chats by status (review-linked, WB)', `
    SELECT c.status, COUNT(*)::int as cnt
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    WHERE c.marketplace = 'wb'
    GROUP BY c.status ORDER BY cnt DESC
  `);

  await q('8c. TG VISIBLE: wrong stage (review-linked WB chats)', `
    SELECT
      COUNT(*) FILTER (WHERE c.status = 'inbox' AND c.last_message_sender = 'seller')::int as inbox_seller,
      COUNT(*) FILTER (WHERE c.status = 'in_progress' AND c.last_message_sender = 'client')::int as in_progress_client,
      COUNT(*) FILTER (WHERE c.status = 'awaiting_reply' AND c.last_message_sender = 'client')::int as awaiting_client,
      COUNT(*) FILTER (WHERE c.status = 'awaiting_reply' AND c.id NOT IN (
        SELECT chat_id FROM chat_auto_sequences WHERE status = 'active'
      ))::int as awaiting_orphaned
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    WHERE c.marketplace = 'wb'
  `);

  await q('9. Active seq but NOT awaiting_reply', `
    SELECT c.status, COUNT(*)::int as cnt
    FROM chats c
    JOIN chat_auto_sequences cas ON cas.chat_id = c.id AND cas.status = 'active'
    WHERE c.status != 'awaiting_reply'
    GROUP BY c.status ORDER BY cnt DESC
  `);

  await q('10. AWAITING_REPLY without active seq (orphaned)', `
    SELECT
      CASE WHEN cas.id IS NOT NULL THEN 'has_active_seq' ELSE 'orphaned' END as seq_status,
      COUNT(*)::int as cnt
    FROM chats c
    LEFT JOIN chat_auto_sequences cas ON cas.chat_id = c.id AND cas.status = 'active'
    WHERE c.status = 'awaiting_reply'
    GROUP BY 1
  `);

  await q('11. Default inbox: never had status change', `
    SELECT
      CASE WHEN status_updated_at IS NULL THEN 'never_updated' ELSE 'was_updated' END as updated,
      last_message_sender,
      COUNT(*)::int as cnt
    FROM chats
    WHERE status = 'inbox'
    GROUP BY 1,2 ORDER BY cnt DESC
  `);

  // Summary of problems
  console.log('\n\n========================================');
  console.log('PROBLEM SUMMARY');
  console.log('========================================');

  const problems = await pool.query(`
    SELECT
      -- inbox but seller was last (should be awaiting_reply or in_progress)
      COUNT(*) FILTER (WHERE status = 'inbox' AND last_message_sender = 'seller') as inbox_seller_last,
      -- in_progress but client was last (should be inbox)
      COUNT(*) FILTER (WHERE status = 'in_progress' AND last_message_sender = 'client') as in_progress_client_last,
      -- awaiting_reply but client replied (should be inbox)
      COUNT(*) FILTER (WHERE status = 'awaiting_reply' AND last_message_sender = 'client') as awaiting_client_replied,
      -- awaiting_reply with no active sequence (orphaned)
      COUNT(*) FILTER (WHERE status = 'awaiting_reply' AND id NOT IN (
        SELECT chat_id FROM chat_auto_sequences WHERE status = 'active'
      )) as awaiting_no_seq
    FROM chats
  `);
  console.table(problems.rows);

} finally {
  await pool.end();
}
