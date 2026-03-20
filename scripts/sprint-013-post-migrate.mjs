// Sprint-013: Post-migration maintenance script
// Runs AFTER migrate-reviews-to-archive.mjs completes
//
// Steps:
//   1. Add CHECK constraint on reviews (rating < 5)
//   2. Drop hotfix index idx_reviews_status_parse_r14
//   3. Drop low-usage indexes
//   4. VACUUM FULL reviews (LOCKS table — run during maintenance window!)
//   5. REINDEX TABLE CONCURRENTLY reviews
//   6. ANALYZE both tables
//   7. Report new sizes
//
// Usage:
//   POSTGRES_HOST=... node scripts/sprint-013-post-migrate.mjs
//   POSTGRES_HOST=... node scripts/sprint-013-post-migrate.mjs --skip-vacuum
//   POSTGRES_HOST=... node scripts/sprint-013-post-migrate.mjs --dry-run

import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const pg = require2('pg');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_VACUUM = args.includes('--skip-vacuum');

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  statement_timeout: 1800000, // 30 min (VACUUM FULL can be slow)
});

const fmt = (n) => Number(n).toLocaleString();

async function run(label, sql) {
  console.log(`  [${label}] ${DRY_RUN ? 'DRY RUN: ' : ''}${sql.trim().substring(0, 100)}...`);
  if (!DRY_RUN) {
    const t = Date.now();
    await pool.query(sql);
    console.log(`  [${label}] Done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

async function main() {
  console.log('============================================================');
  console.log('Sprint-013: Post-Migration Maintenance');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('============================================================\n');

  // Pre-check: verify 5★ removed from reviews
  const fiveStarCheck = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  const fiveLeft = parseInt(fiveStarCheck.rows[0].cnt);
  if (fiveLeft > 0) {
    console.error(`ABORT: ${fmt(fiveLeft)} 5★ reviews still in reviews table.`);
    console.error('Run migrate-reviews-to-archive.mjs first.');
    process.exit(1);
  }
  console.log('[PRE-CHECK] 0 five-star reviews in reviews ✅\n');

  // Step 1: CHECK constraint
  console.log('[STEP 1] Add CHECK constraint: reviews.rating < 5');
  const existing = await pool.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'reviews'::regclass AND conname = 'chk_reviews_rating_1_4'
  `);
  if (existing.rows.length > 0) {
    console.log('  Constraint chk_reviews_rating_1_4 already exists ✅');
  } else {
    await run('CHECK', 'ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating_1_4 CHECK (rating < 5)');
  }
  console.log('');

  // Step 2: Drop hotfix index
  console.log('[STEP 2] Drop hotfix index idx_reviews_status_parse_r14');
  await run('DROP', 'DROP INDEX IF EXISTS idx_reviews_status_parse_r14');
  console.log('');

  // Step 3: Drop low-usage indexes (from baseline audit)
  console.log('[STEP 3] Drop low-usage indexes');
  // idx_reviews_store_answer_date: 3 scans, 316 MB
  await run('DROP', 'DROP INDEX IF EXISTS idx_reviews_store_answer_date');
  // idx_reviews_complaint_status: 6 scans, 368 MB
  await run('DROP', 'DROP INDEX IF EXISTS idx_reviews_complaint_status');
  // idx_reviews_product_status: 30 scans, 375 MB
  await run('DROP', 'DROP INDEX IF EXISTS idx_reviews_product_status');
  // idx_reviews_wb_status: 357 scans, 377 MB (may still be useful — reconsider)
  // Keeping: idx_reviews_wb_status — used by review sync
  // idx_reviews_tasks_eligible: 49 scans, 327 MB — will shrink naturally
  console.log('');

  // Step 4: VACUUM FULL
  if (!SKIP_VACUUM) {
    console.log('[STEP 4] VACUUM FULL reviews (this LOCKS the table!)');
    console.log('  Estimated: 2-5 minutes for ~410K rows');
    await run('VACUUM', 'VACUUM FULL reviews');
  } else {
    console.log('[STEP 4] VACUUM FULL — SKIPPED (--skip-vacuum)');
  }
  console.log('');

  // Step 5: REINDEX
  console.log('[STEP 5] REINDEX TABLE reviews');
  await run('REINDEX', 'REINDEX TABLE reviews');
  console.log('');

  // Step 6: ANALYZE
  console.log('[STEP 6] ANALYZE tables');
  await run('ANALYZE', 'ANALYZE reviews');
  await run('ANALYZE', 'ANALYZE reviews_archive');
  console.log('');

  // Step 7: Report sizes
  console.log('[STEP 7] Final table sizes');
  const sizes = await pool.query(`
    SELECT
      'reviews' as tbl,
      pg_size_pretty(pg_total_relation_size('reviews')) as total,
      pg_size_pretty(pg_relation_size('reviews')) as data,
      pg_size_pretty(pg_indexes_size('reviews')) as indexes
    UNION ALL
    SELECT
      'reviews_archive',
      pg_size_pretty(pg_total_relation_size('reviews_archive')),
      pg_size_pretty(pg_relation_size('reviews_archive')),
      pg_size_pretty(pg_indexes_size('reviews_archive'))
  `);
  console.log('  Table            | Data       | Indexes    | Total');
  console.log('  ' + '-'.repeat(60));
  sizes.rows.forEach(r =>
    console.log(`  ${r.tbl.padEnd(18)} | ${r.data.padStart(10)} | ${r.indexes.padStart(10)} | ${r.total.padStart(10)}`)
  );
  console.log('');

  // Constraints check
  const constraints = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid IN ('reviews'::regclass, 'reviews_archive'::regclass)
    AND contype = 'c'
    ORDER BY conrelid, conname
  `);
  console.log('[CONSTRAINTS]');
  constraints.rows.forEach(r => console.log(`  ${r.conname}: ${r.def}`));
  console.log('');

  console.log('============================================================');
  console.log('POST-MIGRATION MAINTENANCE COMPLETE');
  console.log('============================================================');
  console.log('Next: run node scripts/sprint-013-validate.mjs');

  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL ERROR:', err);
  await pool.end();
  process.exit(1);
});
