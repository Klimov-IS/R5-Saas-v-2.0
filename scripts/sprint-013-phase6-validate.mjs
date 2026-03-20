/**
 * Sprint-013 Phase 6: Validation checks
 *
 * Run AFTER deploying Phase 3+4 code and running Phase 5 finalize script.
 * Verifies data integrity and correctness of the split.
 *
 * Usage:
 *   POSTGRES_HOST=... POSTGRES_PORT=... POSTGRES_DB=... POSTGRES_USER=... POSTGRES_PASSWORD=... node scripts/sprint-013-phase6-validate.mjs
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

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function main() {
  console.log('\n=== SPRINT-013 PHASE 6: VALIDATION ===\n');

  // ── 1. Table counts ──
  console.log('1. Table row counts:');
  const reviewsRes = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
  const archiveRes = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  const viewRes = await pool.query('SELECT COUNT(*) as cnt FROM reviews_all');

  const reviewsCount = parseInt(reviewsRes.rows[0].cnt);
  const archiveCount = parseInt(archiveRes.rows[0].cnt);
  const viewCount = parseInt(viewRes.rows[0].cnt);

  console.log(`   reviews: ${reviewsCount}, archive: ${archiveCount}, view: ${viewCount}`);
  check('reviews_all = reviews + archive', viewCount === reviewsCount + archiveCount,
    `${viewCount} = ${reviewsCount} + ${archiveCount}`);

  // ── 2. Rating invariants ──
  console.log('\n2. Rating invariants:');
  const fiveStar = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  check('No 5★ in reviews', parseInt(fiveStar.rows[0].cnt) === 0,
    `found: ${fiveStar.rows[0].cnt}`);

  const nonFiveStar = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive WHERE rating != 5');
  check('No non-5★ in archive', parseInt(nonFiveStar.rows[0].cnt) === 0,
    `found: ${nonFiveStar.rows[0].cnt}`);

  // ── 3. CHECK constraint exists ──
  console.log('\n3. CHECK constraint:');
  const checkRes = await pool.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'reviews'::regclass AND conname = 'chk_reviews_rating_1_4'
  `);
  check('chk_reviews_rating_1_4 exists', checkRes.rows.length > 0);

  const archiveCheckRes = await pool.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'reviews_archive'::regclass AND conname = 'chk_archive_rating_5'
  `);
  check('chk_archive_rating_5 exists', archiveCheckRes.rows.length > 0);

  // ── 4. Rating distribution matches pre-migration ──
  console.log('\n4. Rating distribution (from reviews_all):');
  const ratingDist = await pool.query(`
    SELECT rating, COUNT(*) as cnt
    FROM reviews_all
    GROUP BY rating
    ORDER BY rating
  `);
  for (const r of ratingDist.rows) {
    console.log(`   ${r.rating}★: ${parseInt(r.cnt).toLocaleString()}`);
  }

  // ── 5. FK integrity — review_complaints ──
  console.log('\n5. FK integrity:');
  const orphanComplaints = await pool.query(`
    SELECT COUNT(*) as cnt FROM review_complaints rc
    WHERE NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rc.review_id)
  `);
  check('No orphaned review_complaints', parseInt(orphanComplaints.rows[0].cnt) === 0,
    `orphans: ${orphanComplaints.rows[0].cnt}`);

  // ── 6. FK integrity — review_chat_links ──
  const orphanLinks = await pool.query(`
    SELECT COUNT(*) as cnt FROM review_chat_links rcl
    WHERE rcl.review_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rcl.review_id)
  `);
  check('No orphaned review_chat_links', parseInt(orphanLinks.rows[0].cnt) === 0,
    `orphans: ${orphanLinks.rows[0].cnt}`);

  // ── 7. No duplicate IDs across tables ──
  console.log('\n6. No cross-table duplicates:');
  const dupes = await pool.query(`
    SELECT COUNT(*) as cnt FROM reviews r
    INNER JOIN reviews_archive ra ON r.id = ra.id
  `);
  check('No duplicate review IDs', parseInt(dupes.rows[0].cnt) === 0,
    `duplicates: ${dupes.rows[0].cnt}`);

  // ── 8. Table sizes ──
  console.log('\n7. Table sizes:');
  const sizes = await pool.query(`
    SELECT
      'reviews' as tbl,
      pg_size_pretty(pg_total_relation_size('reviews')) as total_size,
      pg_size_pretty(pg_relation_size('reviews')) as data_size
    UNION ALL
    SELECT
      'reviews_archive',
      pg_size_pretty(pg_total_relation_size('reviews_archive')),
      pg_size_pretty(pg_relation_size('reviews_archive'))
  `);
  for (const r of sizes.rows) {
    console.log(`   ${r.tbl}: total=${r.total_size}, data=${r.data_size}`);
  }

  // ── 9. Index check — redundant index dropped ──
  console.log('\n8. Index cleanup:');
  const redundantIdx = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'reviews' AND indexname = 'idx_reviews_status_parse_r14'
  `);
  check('idx_reviews_status_parse_r14 dropped', redundantIdx.rows.length === 0);

  // ── 10. Smoke test — view is queryable ──
  console.log('\n9. Smoke tests:');
  try {
    const smoke1 = await pool.query('SELECT id FROM reviews_all LIMIT 1');
    check('reviews_all is queryable', smoke1.rows.length > 0);
  } catch (e) {
    check('reviews_all is queryable', false, e.message);
  }

  try {
    const smoke2 = await pool.query(`
      SELECT COUNT(*) as cnt FROM reviews_all r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.store_id = (SELECT id FROM stores WHERE is_active = TRUE LIMIT 1)
      LIMIT 1
    `);
    check('reviews_all JOIN works', true);
  } catch (e) {
    check('reviews_all JOIN works', false, e.message);
  }

  // ── Summary ──
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log('\n⚠️  Some checks failed! Review before proceeding.');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed! Sprint-013 validation complete.');
  }

  await pool.end();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
