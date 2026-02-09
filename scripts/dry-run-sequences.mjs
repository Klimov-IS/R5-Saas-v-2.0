/**
 * Dry Run: Preview auto-sequence decisions without sending
 * Usage: node scripts/dry-run-sequences.mjs
 *
 * Connects to production DB, finds pending sequences, and for each:
 * - Shows chat info, current step, next message text
 * - Checks: client replied? chat status? seller sent today?
 * - Outputs decision: SEND / SKIP / STOP (with reason)
 * - Does NOT send anything or modify the database
 */

import pg from 'pg';
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
    // Get pending sequences
    const seqResult = await client.query(`
      SELECT
        cas.*,
        s.name AS store_name,
        c.client_name,
        c.status AS chat_status,
        c.tag AS chat_tag,
        SUBSTRING(c.product_name FROM 1 FOR 40) AS product
      FROM chat_auto_sequences cas
      JOIN stores s ON s.id = cas.store_id
      JOIN chats c ON c.id = cas.chat_id
      WHERE cas.status = 'active'
      ORDER BY cas.next_send_at ASC
      LIMIT 50
    `);

    if (seqResult.rows.length === 0) {
      console.log('\nNo active sequences found.\n');
      return;
    }

    console.log('\n========================================');
    console.log(`DRY RUN: ${seqResult.rows.length} active sequences`);
    console.log('========================================\n');

    const now = new Date();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    let sendCount = 0;
    let skipCount = 0;
    let stopCount = 0;
    let notReadyCount = 0;

    for (const seq of seqResult.rows) {
      const nextSendAt = new Date(seq.next_send_at);
      const isReady = nextSendAt <= now;
      const messages = JSON.parse(typeof seq.messages === 'string' ? seq.messages : JSON.stringify(seq.messages));
      const template = messages[seq.current_step];

      console.log(`--- Sequence ${seq.id.substring(0, 8)}... ---`);
      console.log(`  Store: ${seq.store_name}`);
      console.log(`  Chat: ${seq.chat_id.substring(0, 8)}... (${seq.client_name || 'unknown'})`);
      console.log(`  Product: ${seq.product || 'N/A'}`);
      console.log(`  Type: ${seq.sequence_type}`);
      console.log(`  Step: ${seq.current_step + 1}/${seq.max_steps}`);
      console.log(`  Chat status: ${seq.chat_status}, tag: ${seq.chat_tag || 'null'}`);
      console.log(`  Next send at: ${seq.next_send_at} (${isReady ? 'READY' : 'not yet'})`);

      if (!isReady) {
        const hoursUntil = Math.round((nextSendAt - now) / (1000 * 60 * 60) * 10) / 10;
        console.log(`  >> NOT READY (in ${hoursUntil}h)`);
        notReadyCount++;
        console.log('');
        continue;
      }

      // Check 1: Client replied?
      const replyResult = await client.query(`
        SELECT COUNT(*) AS cnt FROM chat_messages
        WHERE chat_id = $1 AND sender = 'client' AND timestamp > $2
      `, [seq.chat_id, seq.started_at]);
      const clientReplied = parseInt(replyResult.rows[0].cnt) > 0;

      if (clientReplied) {
        console.log(`  >> STOP: client replied since ${seq.started_at}`);
        stopCount++;
        console.log('');
        continue;
      }

      // Check 2: Chat status valid?
      if (seq.chat_status !== 'awaiting_reply' && seq.chat_status !== 'inbox') {
        console.log(`  >> STOP: chat status is "${seq.chat_status}" (not awaiting_reply/inbox)`);
        stopCount++;
        console.log('');
        continue;
      }

      // Check 3: Seller already sent today?
      const sellerTodayResult = await client.query(`
        SELECT COUNT(*) AS cnt FROM chat_messages
        WHERE chat_id = $1 AND sender = 'seller' AND timestamp >= $2
      `, [seq.chat_id, todayStart.toISOString()]);
      const sellerSentToday = parseInt(sellerTodayResult.rows[0].cnt) > 0;

      if (sellerSentToday) {
        console.log(`  >> SKIP: seller already sent a message today`);
        skipCount++;
        console.log('');
        continue;
      }

      // Check 4: Max steps?
      if (seq.current_step >= seq.max_steps) {
        console.log(`  >> STOP: max steps reached → would send STOP message + close chat`);
        stopCount++;
        console.log('');
        continue;
      }

      // Would send
      if (template) {
        console.log(`  >> SEND: "${template.text.substring(0, 100)}${template.text.length > 100 ? '...' : ''}"`);
        sendCount++;
      } else {
        console.log(`  >> STOP: no template for step ${seq.current_step}`);
        stopCount++;
      }
      console.log('');
    }

    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`  Would SEND:     ${sendCount}`);
    console.log(`  Would SKIP:     ${skipCount} (seller sent today)`);
    console.log(`  Would STOP:     ${stopCount} (client replied / status changed / max steps)`);
    console.log(`  Not ready yet:  ${notReadyCount}`);
    console.log(`  Total active:   ${seqResult.rows.length}`);
    console.log('');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
