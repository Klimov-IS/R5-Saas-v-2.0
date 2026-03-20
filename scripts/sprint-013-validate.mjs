// Sprint-013: Post-migration validation script
// Run after: migrate-reviews-to-archive.mjs + sprint-013-post-migrate.mjs
//
// Validates:
//   1. Data integrity (counts, rating ranges)
//   2. FK integrity (no orphaned records)
//   3. Constraint checks
//   4. Table sizes
//   5. View functionality
//
// Usage:
//   POSTGRES_HOST=... node scripts/sprint-013-validate.mjs

import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const pg = require2('pg');

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 3,
  statement_timeout: 120000,
});

const fmt = (n) => Number(n).toLocaleString();
let passed = 0;
let failed = 0;

function check(label, condition, actual, expected) {
  if (condition) {
    console.log(`  ${label}: ${actual} ✅`);
    passed++;
  } else {
    console.log(`  ${label}: ${actual} ❌ (expected: ${expected})`);
    failed++;
  }
}

async function main() {
  console.log('============================================================');
  console.log('Sprint-013: Post-Migration Validation');
  console.log('============================================================');
  console.log('');

  // Baseline values (from sprint-013-baseline.mjs run on 2026-03-20)
  const BASELINE_TOTAL = 3661456;
  const BASELINE_5STAR = 3251690;
  const BASELINE_1_4STAR = BASELINE_TOTAL - BASELINE_5STAR; // 409766

  // ========================================
  // 1. DATA INTEGRITY
  // ========================================
  console.log('[1. DATA INTEGRITY]');

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM reviews) as reviews,
      (SELECT COUNT(*) FROM reviews_archive) as archive,
      (SELECT COUNT(*) FROM reviews_all) as combined
  `);
  const c = counts.rows[0];
  const reviewsCount = parseInt(c.reviews);
  const archiveCount = parseInt(c.archive);
  const combinedCount = parseInt(c.combined);

  check('reviews count', reviewsCount === BASELINE_1_4STAR, fmt(reviewsCount), fmt(BASELINE_1_4STAR));
  check('archive count', archiveCount === BASELINE_5STAR, fmt(archiveCount), fmt(BASELINE_5STAR));
  check('combined (reviews_all)', combinedCount === BASELINE_TOTAL, fmt(combinedCount), fmt(BASELINE_TOTAL));

  // 5★ in reviews
  const fiveInReviews = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  check('5★ in reviews', parseInt(fiveInReviews.rows[0].cnt) === 0, fiveInReviews.rows[0].cnt, '0');

  // non-5★ in archive
  const nonFiveInArchive = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive WHERE rating != 5');
  check('non-5★ in archive', parseInt(nonFiveInArchive.rows[0].cnt) === 0, nonFiveInArchive.rows[0].cnt, '0');

  // Rating ranges
  const rrReviews = await pool.query('SELECT MIN(rating) as min_r, MAX(rating) as max_r FROM reviews');
  check('reviews min rating', parseInt(rrReviews.rows[0].min_r) === 1, rrReviews.rows[0].min_r, '1');
  check('reviews max rating', parseInt(rrReviews.rows[0].max_r) === 4, rrReviews.rows[0].max_r, '4');

  const rrArchive = await pool.query('SELECT MIN(rating) as min_r, MAX(rating) as max_r FROM reviews_archive');
  check('archive min rating', parseInt(rrArchive.rows[0].min_r) === 5, rrArchive.rows[0].min_r, '5');
  check('archive max rating', parseInt(rrArchive.rows[0].max_r) === 5, rrArchive.rows[0].max_r, '5');

  // Per-rating breakdown via view
  const ratingBreakdown = await pool.query(`
    SELECT rating, COUNT(*) as cnt FROM reviews_all GROUP BY rating ORDER BY rating
  `);
  console.log('  Rating breakdown (via reviews_all):');
  ratingBreakdown.rows.forEach(r => console.log(`    ${r.rating}★: ${fmt(parseInt(r.cnt))}`));
  console.log('');

  // ========================================
  // 2. FK INTEGRITY
  // ========================================
  console.log('[2. FK INTEGRITY]');

  const orphanRC = await pool.query(`
    SELECT COUNT(*) as cnt FROM review_complaints rc
    WHERE NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rc.review_id)
  `);
  check('orphaned review_complaints', parseInt(orphanRC.rows[0].cnt) === 0, orphanRC.rows[0].cnt, '0');

  const orphanRCL = await pool.query(`
    SELECT COUNT(*) as cnt FROM review_chat_links rcl
    WHERE rcl.review_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rcl.review_id)
  `);
  check('orphaned review_chat_links', parseInt(orphanRCL.rows[0].cnt) === 0, orphanRCL.rows[0].cnt, '0');

  const orphanCD = await pool.query(`
    SELECT COUNT(*) as cnt FROM complaint_details cd
    WHERE cd.review_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = cd.review_id)
  `);
  check('orphaned complaint_details', parseInt(orphanCD.rows[0].cnt) === 0, orphanCD.rows[0].cnt, '0');

  const orphanRDC = await pool.query(`
    SELECT COUNT(*) as cnt FROM review_deletion_cases rdc
    WHERE rdc.review_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rdc.review_id)
  `);
  check('orphaned review_deletion_cases', parseInt(orphanRDC.rows[0].cnt) === 0, orphanRDC.rows[0].cnt, '0');
  console.log('');

  // ========================================
  // 3. CONSTRAINTS
  // ========================================
  console.log('[3. CONSTRAINTS]');

  const constraints = await pool.query(`
    SELECT conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid IN ('reviews'::regclass, 'reviews_archive'::regclass)
    AND contype = 'c'
    ORDER BY conrelid, conname
  `);
  constraints.rows.forEach(r => console.log(`  ${r.table_name}.${r.conname}: ${r.def}`));

  const hasReviewsCheck = constraints.rows.some(r =>
    r.table_name === 'reviews' && r.conname === 'chk_reviews_rating_1_4'
  );
  check('chk_reviews_rating_1_4', hasReviewsCheck, hasReviewsCheck ? 'ACTIVE' : 'MISSING', 'ACTIVE');

  const hasArchiveCheck = constraints.rows.some(r =>
    r.table_name === 'reviews_archive' && r.conname === 'chk_archive_rating_5'
  );
  check('chk_archive_rating_5', hasArchiveCheck, hasArchiveCheck ? 'ACTIVE' : 'MISSING', 'ACTIVE');
  console.log('');

  // ========================================
  // 4. TABLE SIZES
  // ========================================
  console.log('[4. TABLE SIZES]');

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

  // Check reviews fits in RAM (< 4GB)
  const reviewsSizeBytes = await pool.query(`
    SELECT pg_total_relation_size('reviews') as bytes
  `);
  const sizeGB = parseInt(reviewsSizeBytes.rows[0].bytes) / (1024 * 1024 * 1024);
  check('reviews fits in 4GB RAM', sizeGB < 4, `${sizeGB.toFixed(2)} GB`, '< 4 GB');
  console.log('');

  // ========================================
  // 5. BUFFER CACHE
  // ========================================
  console.log('[5. BUFFER CACHE HIT RATIO]');
  const cache = await pool.query(`
    SELECT
      sum(heap_blks_read) as heap_read,
      sum(heap_blks_hit) as heap_hit,
      ROUND(sum(heap_blks_hit)::numeric / GREATEST(sum(heap_blks_hit) + sum(heap_blks_read), 1) * 100, 2) as hit_ratio
    FROM pg_statio_user_tables
    WHERE relname = 'reviews'
  `);
  console.log(`  Heap reads: ${fmt(parseInt(cache.rows[0].heap_read))}`);
  console.log(`  Heap hits: ${fmt(parseInt(cache.rows[0].heap_hit))}`);
  console.log(`  Hit ratio: ${cache.rows[0].hit_ratio}%`);
  console.log('');

  // ========================================
  // 6. INDEX REPORT
  // ========================================
  console.log('[6. INDEXES]');
  const indexes = await pool.query(`
    SELECT tablename, indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size
    FROM pg_indexes
    WHERE tablename IN ('reviews', 'reviews_archive')
    ORDER BY tablename, pg_relation_size(indexname::regclass) DESC
  `);
  let currentTable = '';
  indexes.rows.forEach(r => {
    if (r.tablename !== currentTable) {
      currentTable = r.tablename;
      console.log(`  [${currentTable}]`);
    }
    console.log(`    ${r.indexname}: ${r.size}`);
  });
  console.log('');

  // ========================================
  // SUMMARY
  // ========================================
  console.log('============================================================');
  console.log(`VALIDATION: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('ALL CHECKS PASSED ✅');
  } else {
    console.log('SOME CHECKS FAILED ❌ — investigate before proceeding');
  }
  console.log('============================================================');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('FATAL ERROR:', err);
  await pool.end();
  process.exit(1);
});
