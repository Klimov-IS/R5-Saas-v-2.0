/**
 * migrate-chat-statuses.mjs
 *
 * One-time migration: reclassify review-linked chat statuses based on last_message_sender.
 * Also reopens closed chats.
 *
 * Rules:
 *   1. last_message_sender = 'seller'  → in_progress
 *   2. last_message_sender = 'client'  → inbox
 *   3. last_message_sender IS NULL     → awaiting_reply
 *
 * Scope: only chats with review_chat_links record (chat_id IS NOT NULL).
 *
 * Usage:
 *   node scripts/migrate-chat-statuses.mjs --dry-run   # preview
 *   node scripts/migrate-chat-statuses.mjs             # execute
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Chat Status Migration ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview)' : 'EXECUTE'}\n`);

  // 1. Preview: current distribution
  const before = await pool.query(`
    SELECT c.status, COUNT(*) as cnt
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    GROUP BY c.status
    ORDER BY c.status
  `);
  console.log('BEFORE migration:');
  console.table(before.rows);

  // 2. Preview: what would change
  const preview = await pool.query(`
    SELECT
      c.status as current_status,
      CASE
        WHEN c.last_message_sender = 'seller' THEN 'in_progress'
        WHEN c.last_message_sender = 'client' THEN 'inbox'
        ELSE 'awaiting_reply'
      END as new_status,
      COUNT(*) as cnt
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    WHERE c.status != CASE
      WHEN c.last_message_sender = 'seller' THEN 'in_progress'
      WHEN c.last_message_sender = 'client' THEN 'inbox'
      ELSE 'awaiting_reply'
    END
    GROUP BY c.status, new_status
    ORDER BY c.status, new_status
  `);
  console.log('\nChats that WILL change:');
  if (preview.rows.length > 0) {
    console.table(preview.rows);
  } else {
    console.log('None — all already correct');
    await pool.end();
    return;
  }

  // Total count
  const totalChanges = preview.rows.reduce((s, r) => s + parseInt(r.cnt, 10), 0);
  console.log(`Total chats to update: ${totalChanges}`);

  if (DRY_RUN) {
    console.log('\n(DRY RUN — no changes made. Run without --dry-run to execute.)');
    await pool.end();
    return;
  }

  // 3. Execute: seller last → in_progress
  const r1 = await pool.query(`
    UPDATE chats SET status = 'in_progress', status_updated_at = NOW(), completion_reason = NULL
    FROM review_chat_links rcl
    WHERE rcl.chat_id = chats.id AND rcl.store_id = chats.store_id
      AND chats.last_message_sender = 'seller'
      AND chats.status != 'in_progress'
  `);
  console.log(`\nSeller last → in_progress: ${r1.rowCount} updated`);

  // 4. Execute: client last → inbox
  const r2 = await pool.query(`
    UPDATE chats SET status = 'inbox', status_updated_at = NOW(), completion_reason = NULL
    FROM review_chat_links rcl
    WHERE rcl.chat_id = chats.id AND rcl.store_id = chats.store_id
      AND chats.last_message_sender = 'client'
      AND chats.status != 'inbox'
  `);
  console.log(`Client last → inbox: ${r2.rowCount} updated`);

  // 5. Execute: no messages → awaiting_reply
  const r3 = await pool.query(`
    UPDATE chats SET status = 'awaiting_reply', status_updated_at = NOW(), completion_reason = NULL
    FROM review_chat_links rcl
    WHERE rcl.chat_id = chats.id AND rcl.store_id = chats.store_id
      AND chats.last_message_sender IS NULL
      AND chats.status != 'awaiting_reply'
  `);
  console.log(`No messages → awaiting_reply: ${r3.rowCount} updated`);

  // 6. Verify: after
  const after = await pool.query(`
    SELECT c.status, COUNT(*) as cnt
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    GROUP BY c.status
    ORDER BY c.status
  `);
  console.log('\nAFTER migration:');
  console.table(after.rows);

  console.log(`\nTotal updated: ${r1.rowCount + r2.rowCount + r3.rowCount}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
