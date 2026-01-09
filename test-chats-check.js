require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: { rejectUnauthorized: false }
});

const storeId = 'TwKRrPji2KhTS8TmYJlD';

(async () => {
  try {
    const chats = await pool.query(
      'SELECT COUNT(*) as count FROM chats WHERE store_id = $1',
      [storeId]
    );

    const messages = await pool.query(
      'SELECT COUNT(*) as count FROM chat_messages WHERE store_id = $1',
      [storeId]
    );

    const store = await pool.query(
      'SELECT total_chats, last_chat_update_status FROM stores WHERE id = $1',
      [storeId]
    );

    console.log('\n=== Chats Sync Results ===');
    console.log('Chats in DB:', chats.rows[0].count);
    console.log('Messages in DB:', messages.rows[0].count);
    console.log('Store total_chats:', store.rows[0].total_chats);
    console.log('Chat sync status:', store.rows[0].last_chat_update_status);
    console.log('==========================\n');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
