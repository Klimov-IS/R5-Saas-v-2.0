/**
 * Sprint-013 Phase 5: Finalize reviews table split
 *
 * Run AFTER deploying Phase 3+4 code changes.
 *
 * Steps:
 *   1. Move remaining 5★ reviews from `reviews` → `reviews_archive`
 *   2. Add CHECK constraint `chk_reviews_rating_1_4` (rating BETWEEN 1 AND 4)
 *   3. Drop redundant index `idx_reviews_status_parse_r14`
 *   4. ANALYZE both tables
 *
 * Usage:
 *   POSTGRES_HOST=... POSTGRES_PORT=... POSTGRES_DB=... POSTGRES_USER=... POSTGRES_PASSWORD=... node scripts/sprint-013-phase5-finalize.mjs
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

async function main() {
  const client = await pool.connect();
  try {
    // ── Step 0: Pre-flight check ──
    console.log('\n=== SPRINT-013 PHASE 5: FINALIZE ===\n');

    const before = await client.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
    const fiveStarCount = parseInt(before.rows[0].cnt);
    console.log(`[Step 0] 5★ reviews in 'reviews' table: ${fiveStarCount}`);

    if (fiveStarCount === 0) {
      console.log('[Step 0] No 5★ reviews to move. Skipping Step 1.');
    } else {
      // ── Step 1: Move 5★ reviews to archive ──
      console.log(`\n[Step 1] Moving ${fiveStarCount} 5★ reviews to archive...`);

      // Use a transaction to ensure atomicity
      await client.query('BEGIN');

      // INSERT into archive (ON CONFLICT skip — safety net for duplicates)
      const insertResult = await client.query(`
        INSERT INTO reviews_archive
        SELECT * FROM reviews WHERE rating = 5
        ON CONFLICT (id) DO NOTHING
      `);
      console.log(`[Step 1] Inserted ${insertResult.rowCount} rows into reviews_archive`);

      // DELETE from reviews
      const deleteResult = await client.query(`
        DELETE FROM reviews WHERE rating = 5
      `);
      console.log(`[Step 1] Deleted ${deleteResult.rowCount} rows from reviews`);

      await client.query('COMMIT');
      console.log('[Step 1] ✅ Move complete');
    }

    // Verify no 5★ remain
    const afterMove = await client.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
    console.log(`[Step 1] Verification: 5★ in reviews = ${afterMove.rows[0].cnt}`);
    if (parseInt(afterMove.rows[0].cnt) !== 0) {
      throw new Error('ABORT: 5★ reviews still exist in reviews table after move!');
    }

    // ── Step 2: Add CHECK constraint ──
    console.log('\n[Step 2] Adding CHECK constraint chk_reviews_rating_1_4...');
    try {
      await client.query(`
        ALTER TABLE reviews
        ADD CONSTRAINT chk_reviews_rating_1_4 CHECK (rating BETWEEN 1 AND 4)
      `);
      console.log('[Step 2] ✅ CHECK constraint added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('[Step 2] CHECK constraint already exists — skipping');
      } else {
        throw e;
      }
    }

    // ── Step 3: Drop redundant index ──
    console.log('\n[Step 3] Dropping redundant index idx_reviews_status_parse_r14...');
    try {
      await client.query('DROP INDEX IF EXISTS idx_reviews_status_parse_r14');
      console.log('[Step 3] ✅ Index dropped');
    } catch (e) {
      console.log(`[Step 3] Warning: ${e.message}`);
    }

    // ── Step 4: ANALYZE both tables ──
    console.log('\n[Step 4] Running ANALYZE on both tables...');
    await client.query('ANALYZE reviews');
    console.log('[Step 4] ANALYZE reviews ✅');
    await client.query('ANALYZE reviews_archive');
    console.log('[Step 4] ANALYZE reviews_archive ✅');

    // ── Summary ──
    console.log('\n=== SUMMARY ===');
    const reviewsCount = await client.query('SELECT COUNT(*) as cnt FROM reviews');
    const archiveCount = await client.query('SELECT COUNT(*) as cnt FROM reviews_archive');
    const totalCount = await client.query('SELECT COUNT(*) as cnt FROM reviews_all');

    const rSize = await client.query("SELECT pg_size_pretty(pg_total_relation_size('reviews')) as size");
    const aSize = await client.query("SELECT pg_size_pretty(pg_total_relation_size('reviews_archive')) as size");

    console.log(`reviews:         ${reviewsCount.rows[0].cnt} rows, ${rSize.rows[0].size}`);
    console.log(`reviews_archive: ${archiveCount.rows[0].cnt} rows, ${aSize.rows[0].size}`);
    console.log(`reviews_all:     ${totalCount.rows[0].cnt} rows (view)`);
    console.log('\n✅ Phase 5 complete!');

  } catch (e) {
    // Rollback on error
    try { await client.query('ROLLBACK'); } catch {}
    console.error('\n❌ ERROR:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
