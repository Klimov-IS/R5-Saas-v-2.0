// Sprint-013: Migrate 5★ reviews from `reviews` to `reviews_archive`
//
// Usage:
//   POSTGRES_HOST=... node scripts/migrate-reviews-to-archive.mjs
//   POSTGRES_HOST=... node scripts/migrate-reviews-to-archive.mjs --dry-run
//   POSTGRES_HOST=... node scripts/migrate-reviews-to-archive.mjs --batch-size=50000
//
// Prerequisites:
//   - Migration 037 must be applied (reviews_archive table + reviews_all view)
//   - Run during low-traffic window (22:00-06:00 MSK)
//
// Safety:
//   - Cursor-based pagination (id > $last_id), NOT OFFSET
//   - Separate COPY + DELETE phases with validation between them
//   - Aborts if reviews_archive is non-empty (use --force to override)
//   - Dry-run mode to preview without writing

import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const pg = require2('pg');

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '100000');

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 3,
  statement_timeout: 600000, // 10 min per query (large batches)
});

const fmt = (n) => Number(n).toLocaleString();
const elapsed = (start) => ((Date.now() - start) / 1000).toFixed(1) + 's';

async function main() {
  const startTime = Date.now();

  console.log('============================================================');
  console.log('Sprint-013: Migrate 5★ reviews to reviews_archive');
  console.log('============================================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Batch size: ${fmt(BATCH_SIZE)}`);
  console.log(`Force: ${FORCE}`);
  console.log('');

  // --- Pre-flight checks ---
  console.log('[PRE-FLIGHT] Checking prerequisites...');

  // 1. Check reviews_archive table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'reviews_archive'
    ) as exists
  `);
  if (!tableCheck.rows[0].exists) {
    console.error('ABORT: reviews_archive table does not exist. Run migration 037 first.');
    process.exit(1);
  }
  console.log('  reviews_archive table: EXISTS ✅');

  // 2. Check reviews_archive is empty (or --force)
  const archiveCount = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  const archiveRows = parseInt(archiveCount.rows[0].cnt);
  if (archiveRows > 0 && !FORCE) {
    console.error(`ABORT: reviews_archive has ${fmt(archiveRows)} rows. Use --force to clear before migration.`);
    process.exit(1);
  }
  if (archiveRows > 0 && FORCE) {
    console.log(`  reviews_archive has ${fmt(archiveRows)} rows — clearing (--force)...`);
    if (!DRY_RUN) {
      await pool.query('TRUNCATE reviews_archive');
    }
    console.log('  reviews_archive: CLEARED ✅');
  } else {
    console.log('  reviews_archive: EMPTY ✅');
  }

  // 3. Count 5★ reviews to migrate
  const fiveStarRes = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  const totalToMigrate = parseInt(fiveStarRes.rows[0].cnt);
  console.log(`  5★ reviews to migrate: ${fmt(totalToMigrate)}`);

  if (totalToMigrate === 0) {
    console.log('Nothing to migrate. Done.');
    await pool.end();
    return;
  }

  // 4. Capture original total for validation
  const origTotalRes = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
  const originalTotal = parseInt(origTotalRes.rows[0].cnt);
  console.log(`  Total reviews (before): ${fmt(originalTotal)}`);
  console.log(`  Expected after split: reviews=${fmt(originalTotal - totalToMigrate)}, archive=${fmt(totalToMigrate)}`);
  console.log('');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would migrate ' + fmt(totalToMigrate) + ' rows. Exiting.');
    await pool.end();
    return;
  }

  // ========================================
  // PHASE 1: COPY 5★ → reviews_archive
  // ========================================
  console.log('[Phase: COPY] Starting batch copy to reviews_archive...');
  const copyStart = Date.now();
  let copiedTotal = 0;
  let lastId = '';  // cursor for pagination

  while (true) {
    const batchRes = await pool.query(`
      INSERT INTO reviews_archive
      SELECT * FROM reviews
      WHERE rating = 5 AND id > $1
      ORDER BY id
      LIMIT $2
      RETURNING id
    `, [lastId, BATCH_SIZE]);

    const batchCount = batchRes.rowCount;
    if (batchCount === 0) break;

    copiedTotal += batchCount;
    lastId = batchRes.rows[batchRes.rows.length - 1].id;

    const pct = ((copiedTotal / totalToMigrate) * 100).toFixed(1);
    console.log(`  [COPY] ${fmt(copiedTotal)} / ${fmt(totalToMigrate)} (${pct}%) — elapsed: ${elapsed(copyStart)}`);
  }

  console.log(`  [COPY] COMPLETE — ${fmt(copiedTotal)} rows copied in ${elapsed(copyStart)}`);
  console.log('');

  // ========================================
  // PHASE 2: VALIDATE COPY
  // ========================================
  console.log('[Phase: VALIDATE-COPY] Checking counts...');
  const archiveCountAfterCopy = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  const archiveAfter = parseInt(archiveCountAfterCopy.rows[0].cnt);

  if (archiveAfter !== totalToMigrate) {
    console.error(`  MISMATCH: archive has ${fmt(archiveAfter)}, expected ${fmt(totalToMigrate)}`);
    console.error('  ABORTING DELETE phase. Data is in BOTH tables (safe state).');
    console.error('  Investigate and re-run, or rollback: TRUNCATE reviews_archive;');
    await pool.end();
    process.exit(1);
  }
  console.log(`  reviews_archive count: ${fmt(archiveAfter)} ✅ (matches expected ${fmt(totalToMigrate)})`);

  // Check no non-5★ leaked into archive
  const nonFiveCheck = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive WHERE rating != 5');
  const nonFive = parseInt(nonFiveCheck.rows[0].cnt);
  if (nonFive > 0) {
    console.error(`  ERROR: ${nonFive} non-5★ reviews in archive!`);
    await pool.end();
    process.exit(1);
  }
  console.log(`  non-5★ in archive: 0 ✅`);
  console.log('');

  // ========================================
  // PHASE 3: DELETE 5★ from reviews
  // ========================================
  console.log('[Phase: DELETE] Starting batch delete from reviews...');
  const deleteStart = Date.now();
  let deletedTotal = 0;

  while (true) {
    const delRes = await pool.query(`
      DELETE FROM reviews
      WHERE id IN (
        SELECT id FROM reviews
        WHERE rating = 5
        ORDER BY id
        LIMIT $1
      )
    `, [BATCH_SIZE]);

    const delCount = delRes.rowCount;
    if (delCount === 0) break;

    deletedTotal += delCount;
    const pct = ((deletedTotal / totalToMigrate) * 100).toFixed(1);
    console.log(`  [DELETE] ${fmt(deletedTotal)} / ${fmt(totalToMigrate)} (${pct}%) — elapsed: ${elapsed(deleteStart)}`);
  }

  console.log(`  [DELETE] COMPLETE — ${fmt(deletedTotal)} rows deleted in ${elapsed(deleteStart)}`);
  console.log('');

  // ========================================
  // PHASE 4: VALIDATE DELETE
  // ========================================
  console.log('[Phase: VALIDATE-DELETE] Final validation...');

  const remainingFive = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  const fiveLeft = parseInt(remainingFive.rows[0].cnt);

  const reviewsAfter = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
  const reviewsCount = parseInt(reviewsAfter.rows[0].cnt);

  const archiveFinal = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  const archiveCount2 = parseInt(archiveFinal.rows[0].cnt);

  const combined = reviewsCount + archiveCount2;

  console.log(`  5★ in reviews: ${fiveLeft} ${fiveLeft === 0 ? '✅' : '❌'}`);
  console.log(`  reviews count: ${fmt(reviewsCount)} ${reviewsCount === (originalTotal - totalToMigrate) ? '✅' : '❌'}`);
  console.log(`  archive count: ${fmt(archiveCount2)} ${archiveCount2 === totalToMigrate ? '✅' : '❌'}`);
  console.log(`  combined: ${fmt(combined)} ${combined === originalTotal ? '✅ matches original ' + fmt(originalTotal) : '❌ MISMATCH (expected ' + fmt(originalTotal) + ')'}`);

  // Rating range checks
  const ratingRange = await pool.query('SELECT MIN(rating) as min_r, MAX(rating) as max_r FROM reviews');
  console.log(`  reviews rating range: ${ratingRange.rows[0].min_r}-${ratingRange.rows[0].max_r} ${parseInt(ratingRange.rows[0].max_r) <= 4 ? '✅' : '❌'}`);

  const archiveRange = await pool.query('SELECT MIN(rating) as min_r, MAX(rating) as max_r FROM reviews_archive');
  console.log(`  archive rating range: ${archiveRange.rows[0].min_r}-${archiveRange.rows[0].max_r} ${parseInt(archiveRange.rows[0].min_r) === 5 ? '✅' : '❌'}`);
  console.log('');

  // ========================================
  // PHASE 5: TABLE SIZES
  // ========================================
  console.log('[Phase: SIZES] Current table sizes (before VACUUM)...');
  const sizes = await pool.query(`
    SELECT
      pg_size_pretty(pg_total_relation_size('reviews')) as reviews_total,
      pg_size_pretty(pg_relation_size('reviews')) as reviews_data,
      pg_size_pretty(pg_total_relation_size('reviews_archive')) as archive_total,
      pg_size_pretty(pg_relation_size('reviews_archive')) as archive_data
  `);
  const s = sizes.rows[0];
  console.log(`  reviews: ${s.reviews_data} data, ${s.reviews_total} total (includes dead tuples)`);
  console.log(`  archive: ${s.archive_data} data, ${s.archive_total} total`);
  console.log('');

  // ========================================
  // SUMMARY
  // ========================================
  console.log('============================================================');
  console.log('MIGRATION COMPLETE');
  console.log('============================================================');
  console.log(`Total time: ${elapsed(startTime)}`);
  console.log(`Copied: ${fmt(copiedTotal)} rows`);
  console.log(`Deleted: ${fmt(deletedTotal)} rows`);
  console.log('');
  console.log('NEXT STEPS (run manually during maintenance window):');
  console.log('  1. VACUUM FULL reviews;       -- reclaim disk space (LOCKS table!)');
  console.log('  2. REINDEX TABLE CONCURRENTLY reviews;  -- rebuild indexes');
  console.log('  3. ANALYZE reviews;');
  console.log('  4. ANALYZE reviews_archive;');
  console.log('  5. Run: node scripts/sprint-013-validate.mjs');
  console.log('');
  console.log('ROLLBACK (if needed):');
  console.log('  INSERT INTO reviews SELECT * FROM reviews_archive ON CONFLICT (id) DO NOTHING;');
  console.log('  TRUNCATE reviews_archive;');

  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL ERROR:', err);
  await pool.end();
  process.exit(1);
});
