/**
 * One-time fix: Clean up orphaned chat statuses
 *
 * 1. awaiting_reply without active sequence → inbox/in_progress
 * 2. in_progress with client reply → inbox
 *
 * Run: POSTGRES_HOST=... node scripts/fix-orphaned-chat-statuses.mjs
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

try {
  // Fix 1: awaiting_reply orphans on active stores
  console.log('\n=== Fix 1: awaiting_reply without active sequence ===');
  const fix1 = await pool.query(`
    UPDATE chats
    SET status = CASE
      WHEN last_message_sender = 'client' THEN 'inbox'
      ELSE 'in_progress'
    END,
    status_updated_at = NOW()
    WHERE status = 'awaiting_reply'
      AND NOT EXISTS (
        SELECT 1 FROM chat_auto_sequences cas
        WHERE cas.chat_id = chats.id AND cas.status = 'active'
      )
      AND store_id IN (SELECT id FROM stores WHERE is_active = TRUE)
    RETURNING id, last_message_sender
  `);

  if (fix1.rows.length > 0) {
    const toInbox = fix1.rows.filter(r => r.last_message_sender === 'client').length;
    const toInProgress = fix1.rows.length - toInbox;
    console.log(`Fixed ${fix1.rows.length} chats: ${toInbox} → inbox, ${toInProgress} → in_progress`);
  } else {
    console.log('No orphaned awaiting_reply chats found');
  }

  // Fix 2: in_progress with client reply
  console.log('\n=== Fix 2: in_progress with client reply ===');
  const fix2 = await pool.query(`
    UPDATE chats
    SET status = 'inbox',
        status_updated_at = NOW()
    WHERE status = 'in_progress'
      AND last_message_sender = 'client'
      AND store_id IN (SELECT id FROM stores WHERE is_active = TRUE)
    RETURNING id
  `);

  if (fix2.rows.length > 0) {
    console.log(`Fixed ${fix2.rows.length} chats: in_progress → inbox`);
  } else {
    console.log('No in_progress + client chats found');
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total fixed: ${fix1.rows.length + fix2.rows.length} chats`);

} catch (err) {
  console.error('❌ Fix failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
