/**
 * One-time script: Fix existing chat statuses based on the new rules.
 *
 * Rules:
 *   1. last_message_sender='client' AND status!='closed' → inbox
 *   2. last_message_sender='seller' AND last_message_date > NOW()-2days AND status!='closed' → in_progress
 *   3. last_message_sender='seller' AND last_message_date <= NOW()-2days AND status!='closed' → awaiting_reply
 *   4. status='closed' → stays closed (no change)
 *
 * Usage: node scripts/fix-chat-statuses.mjs [--dry-run]
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

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Fix Chat Statuses ${dryRun ? '[DRY RUN]' : '[LIVE]'} ===\n`);

  // Show current distribution
  const before = await pool.query(`
    SELECT status, COUNT(*) as cnt FROM chats
    WHERE status != 'closed'
    GROUP BY status ORDER BY status
  `);
  console.log('Current status distribution (non-closed):');
  before.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));

  const closedCount = await pool.query(`SELECT COUNT(*) as cnt FROM chats WHERE status = 'closed'`);
  console.log(`  closed: ${closedCount.rows[0].cnt}`);
  console.log('');

  // Rule 1: client last → inbox
  const q1 = dryRun
    ? await pool.query(`
        SELECT COUNT(*) as cnt FROM chats
        WHERE last_message_sender = 'client' AND status != 'closed' AND status != 'inbox'
      `)
    : await pool.query(`
        UPDATE chats SET status = 'inbox', status_updated_at = NOW(), updated_at = NOW()
        WHERE last_message_sender = 'client' AND status != 'closed' AND status != 'inbox'
        RETURNING id
      `);
  const count1 = dryRun ? parseInt(q1.rows[0].cnt) : q1.rowCount;
  console.log(`Rule 1 (client last → inbox): ${count1} chats ${dryRun ? 'would be' : ''} updated`);

  // Rule 2: seller last, <2 days → in_progress
  const q2 = dryRun
    ? await pool.query(`
        SELECT COUNT(*) as cnt FROM chats
        WHERE last_message_sender = 'seller' AND status != 'closed' AND status != 'in_progress'
          AND last_message_date >= NOW() - INTERVAL '2 days'
      `)
    : await pool.query(`
        UPDATE chats SET status = 'in_progress', status_updated_at = NOW(), updated_at = NOW()
        WHERE last_message_sender = 'seller' AND status != 'closed' AND status != 'in_progress'
          AND last_message_date >= NOW() - INTERVAL '2 days'
        RETURNING id
      `);
  const count2 = dryRun ? parseInt(q2.rows[0].cnt) : q2.rowCount;
  console.log(`Rule 2 (seller last, <2d → in_progress): ${count2} chats ${dryRun ? 'would be' : ''} updated`);

  // Rule 3: seller last, >=2 days → awaiting_reply
  const q3 = dryRun
    ? await pool.query(`
        SELECT COUNT(*) as cnt FROM chats
        WHERE last_message_sender = 'seller' AND status != 'closed' AND status != 'awaiting_reply'
          AND last_message_date < NOW() - INTERVAL '2 days'
      `)
    : await pool.query(`
        UPDATE chats SET status = 'awaiting_reply', status_updated_at = NOW(), updated_at = NOW()
        WHERE last_message_sender = 'seller' AND status != 'closed' AND status != 'awaiting_reply'
          AND last_message_date < NOW() - INTERVAL '2 days'
        RETURNING id
      `);
  const count3 = dryRun ? parseInt(q3.rows[0].cnt) : q3.rowCount;
  console.log(`Rule 3 (seller last, >=2d → awaiting_reply): ${count3} chats ${dryRun ? 'would be' : ''} updated`);

  console.log(`\nTotal: ${count1 + count2 + count3} chats ${dryRun ? 'would be' : ''} updated`);

  // Show after distribution
  if (!dryRun) {
    const after = await pool.query(`
      SELECT status, COUNT(*) as cnt FROM chats
      GROUP BY status ORDER BY status
    `);
    console.log('\nNew status distribution:');
    after.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));
  }

  await pool.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
