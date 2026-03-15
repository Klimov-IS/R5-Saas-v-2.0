/**
 * Fix stale data: inbox chats with last_message_sender='seller'
 * These should be 'in_progress' (seller already replied).
 *
 * Root cause: chat-service.ts TG send did NOT update status_updated_at,
 * causing dialogue sync's optimistic lock to overwrite in_progress → inbox.
 *
 * Run: node scripts/_fix_inbox_seller_status.mjs [--dry-run]
 */
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: process.env.POSTGRES_PORT || 6432,
  database: process.env.POSTGRES_DB || 'wb_reputation',
  user: process.env.POSTGRES_USER || 'admin_R5',
  password: process.env.POSTGRES_PASSWORD || 'MyNewPass123',
  ssl: { rejectUnauthorized: false }
});

try {
  // Find all review-linked inbox chats where seller sent the last message
  const res = await pool.query(`
    SELECT c.id, c.store_id, c.status, c.last_message_sender, c.last_message_date
    FROM chats c
    INNER JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    JOIN stores s ON s.id = c.store_id AND s.is_active = TRUE
    WHERE c.status = 'inbox'
      AND c.last_message_sender = 'seller'
  `);

  console.log(`Found ${res.rows.length} inbox chats with last_message_sender='seller'`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE FIX'}\n`);

  if (res.rows.length === 0) {
    console.log('No chats to fix!');
    process.exit(0);
  }

  let fixed = 0;
  for (const chat of res.rows) {
    console.log(`  ${chat.id} | last_msg: ${chat.last_message_date}`);

    if (!DRY_RUN) {
      await pool.query(`
        UPDATE chats SET
          status = 'in_progress',
          status_updated_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [chat.id]);

      // Insert audit trail
      await pool.query(`
        INSERT INTO chat_status_history (
          chat_id, store_id, old_status, new_status, change_source, changed_by, created_at
        ) VALUES ($1, $2, 'inbox', 'in_progress', 'bulk_action', NULL, NOW())
      `, [chat.id, chat.store_id]);

      fixed++;
    }
  }

  console.log(`\n${DRY_RUN ? 'Would fix' : 'Fixed'}: ${DRY_RUN ? res.rows.length : fixed} chats`);

} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
