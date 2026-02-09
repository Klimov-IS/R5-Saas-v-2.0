/**
 * Run SQL diagnostic: find auto-sequence candidates
 * Usage: node scripts/run-sequence-candidates.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local');
  process.exit(1);
}

// Parse and remove sslmode from URL
let connectionString = DATABASE_URL;
if (connectionString.includes('?sslmode=')) {
  connectionString = connectionString.split('?')[0];
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();

  try {
    // Query 1: Summary by store
    console.log('\n========================================');
    console.log('SUMMARY BY STORE');
    console.log('========================================\n');

    const summaryResult = await client.query(`
      WITH trigger_messages AS (
        SELECT
          cm.chat_id,
          cm.store_id,
          cm.timestamp AS trigger_sent_at
        FROM chat_messages cm
        WHERE cm.sender = 'seller'
          AND cm.text LIKE '%Мы увидели ваш отзыв и очень хотим разобраться%'
      ),
      latest_trigger AS (
        SELECT DISTINCT ON (chat_id)
          chat_id, store_id, trigger_sent_at
        FROM trigger_messages
        ORDER BY chat_id, trigger_sent_at DESC
      ),
      client_replies AS (
        SELECT
          lt.chat_id,
          COUNT(*) AS reply_count
        FROM latest_trigger lt
        JOIN chat_messages cm ON cm.chat_id = lt.chat_id
          AND cm.sender = 'client'
          AND cm.timestamp > lt.trigger_sent_at
        GROUP BY lt.chat_id
      )
      SELECT
        s.name AS store_name,
        COUNT(lt.chat_id) AS total_with_trigger,
        COUNT(CASE WHEN cr.reply_count IS NULL THEN 1 END) AS no_reply_candidates,
        COUNT(CASE WHEN cr.reply_count > 0 THEN 1 END) AS already_replied
      FROM latest_trigger lt
      JOIN chats c ON c.id = lt.chat_id
      JOIN stores s ON s.id = lt.store_id
      LEFT JOIN products p ON p.wb_product_id = c.product_nm_id AND p.store_id = s.id
      LEFT JOIN product_rules pr ON pr.product_id = p.id
      LEFT JOIN client_replies cr ON cr.chat_id = lt.chat_id
      WHERE s.status = 'active'
        AND (pr.work_in_chats = TRUE OR pr.id IS NULL)
      GROUP BY s.id, s.name
      ORDER BY no_reply_candidates DESC
    `);

    if (summaryResult.rows.length === 0) {
      console.log('No chats found with trigger message.');
    } else {
      console.table(summaryResult.rows);

      // Totals
      const totalTrigger = summaryResult.rows.reduce((sum, r) => sum + parseInt(r.total_with_trigger), 0);
      const totalNoReply = summaryResult.rows.reduce((sum, r) => sum + parseInt(r.no_reply_candidates), 0);
      const totalReplied = summaryResult.rows.reduce((sum, r) => sum + parseInt(r.already_replied), 0);
      console.log(`\nTOTAL: ${totalTrigger} with trigger, ${totalNoReply} no reply (candidates), ${totalReplied} already replied`);
    }

    // Query 2: Detailed list (first 50)
    console.log('\n========================================');
    console.log('DETAILED CANDIDATES (no reply, first 50)');
    console.log('========================================\n');

    const detailResult = await client.query(`
      WITH trigger_messages AS (
        SELECT cm.chat_id, cm.store_id, cm.timestamp AS trigger_sent_at
        FROM chat_messages cm
        WHERE cm.sender = 'seller'
          AND cm.text LIKE '%Мы увидели ваш отзыв и очень хотим разобраться%'
      ),
      latest_trigger AS (
        SELECT DISTINCT ON (chat_id) chat_id, store_id, trigger_sent_at
        FROM trigger_messages
        ORDER BY chat_id, trigger_sent_at DESC
      )
      SELECT
        s.name AS store_name,
        c.id AS chat_id,
        c.client_name,
        SUBSTRING(c.product_name FROM 1 FOR 40) AS product,
        c.tag AS tag,
        c.status,
        lt.trigger_sent_at::date AS trigger_date,
        c.last_message_sender AS last_sender,
        AGE(NOW(), lt.trigger_sent_at) AS days_since
      FROM latest_trigger lt
      JOIN chats c ON c.id = lt.chat_id
      JOIN stores s ON s.id = lt.store_id
      LEFT JOIN products p ON p.wb_product_id = c.product_nm_id AND p.store_id = s.id
      LEFT JOIN product_rules pr ON pr.product_id = p.id
      WHERE s.status = 'active'
        AND (pr.work_in_chats = TRUE OR pr.id IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM chat_messages cm
          WHERE cm.chat_id = lt.chat_id
            AND cm.sender = 'client'
            AND cm.timestamp > lt.trigger_sent_at
        )
      ORDER BY s.name, lt.trigger_sent_at
      LIMIT 50
    `);

    if (detailResult.rows.length === 0) {
      console.log('No no-reply candidates found.');
    } else {
      console.table(detailResult.rows);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
