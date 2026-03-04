/**
 * Diagnostic script: Васильев (ИП Бобоев С. С.) chats audit
 *
 * Checks:
 * 1. Total chats and their statuses
 * 2. Review-chat links coverage
 * 3. Auto-closed chats (completion_reason)
 * 4. Active sequences
 * 5. Tag distribution
 *
 * Usage: node scripts/diag-vasiliev-chats.mjs
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
  const client = await pool.connect();
  try {
    // 1. Find Васильев stores
    console.log('\n=== 1. STORES (Бобоев / Васильев) ===');
    const stores = await client.query(
      `SELECT id, name, marketplace, status, total_reviews
       FROM stores
       WHERE name ILIKE '%бобоев%' OR name ILIKE '%васильев%'
       ORDER BY name`
    );
    console.table(stores.rows);

    if (stores.rows.length === 0) {
      console.log('No stores found! Try broader search...');
      const allStores = await client.query(
        `SELECT id, name FROM stores WHERE status = 'active' ORDER BY name LIMIT 20`
      );
      console.table(allStores.rows);
      await client.release();
      await pool.end();
      return;
    }

    const storeIds = stores.rows.map(s => s.id);
    console.log(`Found ${storeIds.length} stores`);

    // 2. Chat status distribution
    console.log('\n=== 2. CHAT STATUS DISTRIBUTION ===');
    const statusDist = await client.query(
      `SELECT status, COUNT(*) as count
       FROM chats
       WHERE store_id = ANY($1::text[])
       GROUP BY status
       ORDER BY count DESC`,
      [storeIds]
    );
    console.table(statusDist.rows);

    // 3. Tag distribution
    console.log('\n=== 3. TAG DISTRIBUTION ===');
    const tagDist = await client.query(
      `SELECT tag, COUNT(*) as count
       FROM chats
       WHERE store_id = ANY($1::text[])
       GROUP BY tag
       ORDER BY count DESC`,
      [storeIds]
    );
    console.table(tagDist.rows);

    // 4. Review-chat links coverage
    console.log('\n=== 4. REVIEW-CHAT LINKS ===');
    const rclStats = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM chats WHERE store_id = ANY($1::text[])) as total_chats,
         (SELECT COUNT(DISTINCT c.id)
          FROM chats c
          INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
          WHERE c.store_id = ANY($1::text[])) as linked_chats,
         (SELECT COUNT(*) FROM review_chat_links WHERE store_id = ANY($1::text[])) as total_links,
         (SELECT COUNT(*) FROM review_chat_links WHERE store_id = ANY($1::text[]) AND review_id IS NULL) as links_no_review`,
      [storeIds]
    );
    const rcl = rclStats.rows[0];
    console.log(`Total chats: ${rcl.total_chats}`);
    console.log(`Linked to reviews: ${rcl.linked_chats}`);
    console.log(`Unlinked: ${rcl.total_chats - rcl.linked_chats}`);
    console.log(`Total RCL records: ${rcl.total_links}`);
    console.log(`RCL with NULL review_id: ${rcl.links_no_review}`);

    // 5. Auto-closed chats
    console.log('\n=== 5. AUTO-CLOSED (completion_reason) ===');
    const closed = await client.query(
      `SELECT completion_reason, COUNT(*) as count
       FROM chats
       WHERE store_id = ANY($1::text[]) AND status = 'closed'
       GROUP BY completion_reason
       ORDER BY count DESC`,
      [storeIds]
    );
    console.table(closed.rows);

    // 6. Active sequences
    console.log('\n=== 6. ACTIVE SEQUENCES ===');
    const seqs = await client.query(
      `SELECT cas.status, cas.sequence_type, COUNT(*) as count
       FROM chat_auto_sequences cas
       JOIN chats c ON cas.chat_id = c.id
       WHERE c.store_id = ANY($1::text[])
       GROUP BY cas.status, cas.sequence_type
       ORDER BY cas.status, count DESC`,
      [storeIds]
    );
    console.table(seqs.rows);

    // 7. Recent activity (last 5 days)
    console.log('\n=== 7. RECENT CHAT ACTIVITY (last 5 days) ===');
    const recent = await client.query(
      `SELECT
         DATE(last_message_date AT TIME ZONE 'Europe/Moscow') as day,
         COUNT(*) as chats_with_activity,
         COUNT(CASE WHEN last_message_sender = 'client' THEN 1 END) as client_msgs,
         COUNT(CASE WHEN last_message_sender = 'seller' THEN 1 END) as seller_msgs
       FROM chats
       WHERE store_id = ANY($1::text[])
         AND last_message_date > NOW() - INTERVAL '5 days'
       GROUP BY DATE(last_message_date AT TIME ZONE 'Europe/Moscow')
       ORDER BY day DESC`,
      [storeIds]
    );
    console.table(recent.rows);

    // 8. Chats in TG queue (review-linked, not closed)
    console.log('\n=== 8. TG QUEUE (review-linked, not closed) ===');
    const queue = await client.query(
      `SELECT c.status, c.tag, COUNT(*) as count
       FROM chats c
       INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
       WHERE c.store_id = ANY($1::text[]) AND c.status != 'closed'
       GROUP BY c.status, c.tag
       ORDER BY c.status, count DESC`,
      [storeIds]
    );
    console.table(queue.rows);

    // 9. Chats with messages count > 50 (would have been affected by LIMIT 50 bug)
    console.log('\n=== 9. CHATS WITH >50 MESSAGES (affected by LIMIT 50 bug) ===');
    const bigChats = await client.query(
      `SELECT c.id, c.client_name, c.status, c.tag, COUNT(cm.id) as msg_count
       FROM chats c
       JOIN chat_messages cm ON cm.chat_id = c.id
       WHERE c.store_id = ANY($1::text[])
       GROUP BY c.id, c.client_name, c.status, c.tag
       HAVING COUNT(cm.id) > 50
       ORDER BY msg_count DESC
       LIMIT 20`,
      [storeIds]
    );
    console.table(bigChats.rows);
    console.log(`Total chats with >50 msgs: ${bigChats.rows.length}+ (showing top 20)`);

    console.log('\n=== DONE ===');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
