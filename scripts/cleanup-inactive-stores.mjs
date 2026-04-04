/**
 * One-time cleanup: remove operational data for inactive stores.
 *
 * Preserves: stores, products, product_rules, review_complaints,
 *            complaint_details, store_faq, store_guides, review_chat_links.
 *
 * Usage:
 *   POSTGRES_HOST=rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
 *   POSTGRES_PORT=6432 POSTGRES_DB=wb_reputation \
 *   POSTGRES_USER=admin_R5 POSTGRES_PASSWORD=MyNewPass123 \
 *   node scripts/cleanup-inactive-stores.mjs
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

async function cleanupStore(client, storeId, storeName) {
  const deletedRows = {};

  const del = async (table) => {
    const r = await client.query(`DELETE FROM ${table} WHERE store_id = $1`, [storeId]);
    deletedRows[table] = r.rowCount ?? 0;
  };

  // Children first, respecting FK order
  await del('chat_status_history');
  await del('ai_logs');
  await del('chat_auto_sequences');
  await del('chat_messages');
  await del('review_statuses_from_extension');
  await del('complaint_backfill_jobs');
  await del('complaint_daily_limits');
  await del('chats');
  await del('reviews');
  await del('questions');
  await del('manager_tasks');

  // Reset denormalized counters
  await client.query(
    'UPDATE stores SET total_reviews = 0, total_chats = 0, review_count_5star = 0 WHERE id = $1',
    [storeId]
  );

  const total = Object.values(deletedRows).reduce((a, b) => a + b, 0);
  const significant = Object.entries(deletedRows)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  console.log(`  ✅ ${storeName}: ${total} rows deleted (${significant || 'nothing to clean'})`);
  return deletedRows;
}

async function run() {
  console.log('\n=== Cleanup: Inactive Stores Operational Data ===\n');

  // Get DB size before
  const beforeSize = await pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size');
  console.log(`DB size BEFORE: ${beforeSize.rows[0].size}\n`);

  // Find inactive stores
  const stores = await pool.query(`
    SELECT id, name FROM stores WHERE is_active = FALSE ORDER BY name
  `);

  console.log(`Found ${stores.rows.length} inactive stores to clean up.\n`);

  let grandTotal = 0;

  for (const store of stores.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await cleanupStore(client, store.id, store.name);
      await client.query('COMMIT');
      grandTotal += Object.values(result).reduce((a, b) => a + b, 0);
    } catch (err) {
      await client.query('ROLLBACK');
      console.log(`  ❌ ${store.name}: ERROR — ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(`\nGrand total: ${grandTotal.toLocaleString()} rows deleted across ${stores.rows.length} stores.`);

  // Verify preserved data
  console.log('\n--- Verification ---\n');

  const checks = [
    ['reviews (inactive)', 'SELECT COUNT(*) as cnt FROM reviews r JOIN stores s ON r.store_id = s.id WHERE s.is_active = FALSE'],
    ['chats (inactive)', 'SELECT COUNT(*) as cnt FROM chats c JOIN stores s ON c.store_id = s.id WHERE s.is_active = FALSE'],
    ['review_chat_links (inactive, preserved)', 'SELECT COUNT(*) as cnt FROM review_chat_links rcl JOIN stores s ON rcl.store_id = s.id WHERE s.is_active = FALSE'],
    ['review_complaints (inactive, preserved)', 'SELECT COUNT(*) as cnt FROM review_complaints rc JOIN stores s ON rc.store_id = s.id WHERE s.is_active = FALSE'],
    ['stores (inactive, preserved)', 'SELECT COUNT(*) as cnt FROM stores WHERE is_active = FALSE'],
  ];

  for (const [label, sql] of checks) {
    const r = await pool.query(sql);
    const cnt = parseInt(r.rows[0].cnt);
    const expected = label.includes('preserved') ? cnt > 0 : cnt === 0;
    console.log(`  ${expected ? '✅' : '❌'} ${label}: ${cnt.toLocaleString()}`);
  }

  // DB size after
  const afterSize = await pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size');
  console.log(`\nDB size AFTER: ${afterSize.rows[0].size}`);
  console.log(`(Note: actual space reclaimed after VACUUM FULL)\n`);

  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
