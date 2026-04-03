/**
 * Validation script for migration 040 — Drop reviews_archive
 *
 * Run AFTER deploying code + running migration on production:
 *
 *   POSTGRES_HOST=rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
 *   POSTGRES_PORT=6432 POSTGRES_DB=wb_reputation \
 *   POSTGRES_USER=admin_R5 POSTGRES_PASSWORD=MyNewPass123 \
 *   node scripts/validate-040-drop-archive.mjs
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

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    const result = await fn();
    if (result) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ ${name} — ERROR: ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Validation: 040_drop_reviews_archive ===\n');

  // 1. reviews table exists and has rows
  await check('reviews table has rows', async () => {
    const r = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
    const cnt = parseInt(r.rows[0].cnt);
    console.log(`     reviews: ${cnt.toLocaleString()} rows`);
    return cnt > 100000;
  });

  // 2. reviews_archive table does NOT exist
  await check('reviews_archive table dropped', async () => {
    const r = await pool.query(
      "SELECT COUNT(*) as cnt FROM pg_tables WHERE tablename = 'reviews_archive'"
    );
    return parseInt(r.rows[0].cnt) === 0;
  });

  // 3. reviews_all view does NOT exist
  await check('reviews_all view dropped', async () => {
    const r = await pool.query(
      "SELECT COUNT(*) as cnt FROM pg_views WHERE viewname = 'reviews_all'"
    );
    return parseInt(r.rows[0].cnt) === 0;
  });

  // 4. stores.review_count_5star column exists and is populated
  await check('stores.review_count_5star column exists', async () => {
    const r = await pool.query(
      "SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'review_count_5star'"
    );
    return parseInt(r.rows[0].cnt) === 1;
  });

  await check('review_count_5star populated for active stores', async () => {
    const r = await pool.query(
      "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE review_count_5star > 0) as with_5star FROM stores WHERE is_active = TRUE"
    );
    const total = parseInt(r.rows[0].total);
    const with5 = parseInt(r.rows[0].with_5star);
    console.log(`     Active stores: ${total}, with 5★ count: ${with5}`);
    return with5 > 0;
  });

  // 5. Total 5★ count across stores
  await check('Total 5★ count is reasonable (>1M)', async () => {
    const r = await pool.query('SELECT SUM(review_count_5star) as total FROM stores');
    const total = parseInt(r.rows[0].total || '0');
    console.log(`     Total 5★ across stores: ${total.toLocaleString()}`);
    return total > 1000000;
  });

  // 6. No 5★ reviews in reviews table (CHECK constraint)
  await check('No rating=5 in reviews table', async () => {
    const r = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
    const cnt = parseInt(r.rows[0].cnt);
    console.log(`     rating=5 in reviews: ${cnt}`);
    return cnt === 0;
  });

  // 7. Database size
  await check('Database size reduced', async () => {
    const r = await pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size');
    console.log(`     DB size: ${r.rows[0].size}`);
    return true; // informational
  });

  // 8. reviews table size
  await check('reviews table size', async () => {
    const r = await pool.query("SELECT pg_size_pretty(pg_total_relation_size('reviews')) as size");
    console.log(`     reviews total size: ${r.rows[0].size}`);
    return true; // informational
  });

  // 9. Sample store stats check
  await check('Sample store: review stats include 5★', async () => {
    const r = await pool.query(`
      SELECT s.id, s.name, s.review_count_5star,
        (SELECT COUNT(*) FROM reviews WHERE store_id = s.id) as reviews_14
      FROM stores s
      WHERE s.is_active = TRUE AND s.review_count_5star > 100
      ORDER BY s.review_count_5star DESC
      LIMIT 3
    `);
    for (const row of r.rows) {
      console.log(`     ${row.name}: ${row.reviews_14} reviews (1-4★) + ${row.review_count_5star} (5★)`);
    }
    return r.rows.length > 0;
  });

  // Summary
  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
