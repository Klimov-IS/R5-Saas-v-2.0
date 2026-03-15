/**
 * Run migration 034: Add composite index for extension tasks queries
 *
 * Must run outside transaction because CREATE INDEX CONCURRENTLY
 * cannot be executed inside a transaction block.
 *
 * Usage:
 *   POSTGRES_HOST=... POSTGRES_PORT=6432 POSTGRES_DB=wb_reputation \
 *   POSTGRES_USER=admin_R5 POSTGRES_PASSWORD=... node scripts/run-migration-034.mjs
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
  // No statement_timeout — index creation on 3.7M rows may take a few minutes
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('[Migration 034] Starting: Add idx_reviews_tasks_eligible index...');
    console.log('[Migration 034] This may take 1-3 minutes on 3.7M rows...');

    // Drop if exists (idempotent)
    await client.query('DROP INDEX IF EXISTS idx_reviews_tasks_eligible');
    console.log('[Migration 034] Dropped existing index (if any)');

    // Create index concurrently (non-blocking for reads/writes)
    const start = Date.now();
    await client.query(`
      CREATE INDEX CONCURRENTLY idx_reviews_tasks_eligible
      ON reviews(store_id, product_id, rating, date ASC)
      WHERE marketplace = 'wb'
        AND rating_excluded = FALSE
        AND review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
        AND (chat_status_by_review IS NULL OR chat_status_by_review = 'unknown')
    `);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Migration 034] Index created successfully in ${elapsed}s`);

    // Verify
    const verify = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE indexname = 'idx_reviews_tasks_eligible'
    `);
    if (verify.rows.length > 0) {
      console.log('[Migration 034] Verified:', verify.rows[0].indexdef);
    } else {
      console.error('[Migration 034] ERROR: Index not found after creation!');
    }

    // Check index size
    const size = await client.query(`
      SELECT pg_size_pretty(pg_relation_size('idx_reviews_tasks_eligible')) as size
    `);
    console.log(`[Migration 034] Index size: ${size.rows[0].size}`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('[Migration 034] FAILED:', e); process.exit(1); });
