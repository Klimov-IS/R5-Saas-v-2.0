// Sprint-013: Baseline measurements before reviews table split
// Captures row counts, table sizes, index sizes, FK integrity, buffer cache stats
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

const baseline = {};

// 1. Row counts by rating
console.log('=== 1. Row counts by rating ===');
const ratingRes = await pool.query(
  `SELECT rating, COUNT(*) as cnt FROM reviews GROUP BY rating ORDER BY rating`
);
baseline.rating_breakdown = ratingRes.rows;
const total = ratingRes.rows.reduce((sum, r) => sum + parseInt(r.cnt), 0);
baseline.total_reviews = total;
console.log('Rating breakdown:');
ratingRes.rows.forEach(r => console.log(`  ${r.rating}★: ${parseInt(r.cnt).toLocaleString()}`));
console.log(`  Total: ${total.toLocaleString()}`);

// 2. Related table counts
console.log('\n=== 2. Related table counts ===');
const [rcRes, rclRes, cdRes] = await Promise.all([
  pool.query(`SELECT COUNT(*) as cnt FROM review_complaints`),
  pool.query(`SELECT COUNT(*) as cnt FROM review_chat_links`),
  pool.query(`SELECT COUNT(*) as cnt FROM complaint_details`),
]);
baseline.review_complaints_count = parseInt(rcRes.rows[0].cnt);
baseline.review_chat_links_count = parseInt(rclRes.rows[0].cnt);
baseline.complaint_details_count = parseInt(cdRes.rows[0].cnt);
console.log(`  review_complaints: ${baseline.review_complaints_count.toLocaleString()}`);
console.log(`  review_chat_links: ${baseline.review_chat_links_count.toLocaleString()}`);
console.log(`  complaint_details: ${baseline.complaint_details_count.toLocaleString()}`);

// 3. Table & index sizes
console.log('\n=== 3. Table & index sizes ===');
const sizesRes = await pool.query(`
  SELECT
    pg_size_pretty(pg_total_relation_size('reviews')) as total_with_indexes,
    pg_size_pretty(pg_relation_size('reviews')) as table_only,
    pg_size_pretty(pg_indexes_size('reviews')) as indexes_only
`);
baseline.sizes = sizesRes.rows[0];
console.log(`  Table + indexes: ${baseline.sizes.total_with_indexes}`);
console.log(`  Table only: ${baseline.sizes.table_only}`);
console.log(`  Indexes only: ${baseline.sizes.indexes_only}`);

// 4. Individual index sizes
console.log('\n=== 4. Index sizes ===');
const idxRes = await pool.query(`
  SELECT indexname,
         pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
         pg_relation_size(indexname::regclass) as size_bytes
  FROM pg_indexes WHERE tablename = 'reviews'
  ORDER BY pg_relation_size(indexname::regclass) DESC
`);
baseline.indexes = idxRes.rows.map(r => ({
  name: r.indexname,
  size: r.size,
  size_bytes: parseInt(r.size_bytes)
}));
idxRes.rows.forEach(r => console.log(`  ${r.indexname}: ${r.size}`));

// 5. Index usage stats
console.log('\n=== 5. Index usage statistics ===');
const usageRes = await pool.query(`
  SELECT
    indexrelname as index_name,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as size,
    idx_tup_read as rows_read,
    idx_tup_fetch as rows_fetched
  FROM pg_stat_user_indexes
  WHERE relname = 'reviews'
  ORDER BY idx_scan ASC
`);
baseline.index_usage = usageRes.rows;
console.log('  Index                                     | Scans     | Rows Read    | Size');
console.log('  ' + '-'.repeat(85));
usageRes.rows.forEach(r =>
  console.log(`  ${r.index_name.padEnd(42)} | ${String(r.times_used).padStart(9)} | ${String(r.rows_read).padStart(12)} | ${r.size}`)
);

// 6. Buffer cache hit ratio
console.log('\n=== 6. Buffer cache hit ratio ===');
const cacheRes = await pool.query(`
  SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    ROUND(sum(heap_blks_hit)::numeric / GREATEST(sum(heap_blks_hit) + sum(heap_blks_read), 1) * 100, 2) as hit_ratio_pct
  FROM pg_statio_user_tables
  WHERE relname = 'reviews'
`);
baseline.buffer_cache = cacheRes.rows[0];
console.log(`  Heap reads: ${parseInt(cacheRes.rows[0].heap_read).toLocaleString()}`);
console.log(`  Heap hits: ${parseInt(cacheRes.rows[0].heap_hit).toLocaleString()}`);
console.log(`  Hit ratio: ${cacheRes.rows[0].hit_ratio_pct}%`);

// 7. FK integrity checks
console.log('\n=== 7. FK integrity checks ===');
const [orphanRC, orphanRCL, orphanCD] = await Promise.all([
  pool.query(`
    SELECT COUNT(*) as cnt FROM review_complaints rc
    WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.id = rc.review_id)
  `),
  pool.query(`
    SELECT COUNT(*) as cnt FROM review_chat_links rcl
    WHERE rcl.review_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.id = rcl.review_id)
  `),
  pool.query(`
    SELECT COUNT(*) as cnt FROM complaint_details cd
    WHERE cd.review_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.id = cd.review_id)
  `),
]);
baseline.fk_integrity = {
  orphaned_review_complaints: parseInt(orphanRC.rows[0].cnt),
  orphaned_review_chat_links: parseInt(orphanRCL.rows[0].cnt),
  orphaned_complaint_details: parseInt(orphanCD.rows[0].cnt),
};
const fkOk = (n) => n === 0 ? '✅' : `⚠️ ${n} orphans`;
console.log(`  orphaned review_complaints: ${fkOk(baseline.fk_integrity.orphaned_review_complaints)}`);
console.log(`  orphaned review_chat_links: ${fkOk(baseline.fk_integrity.orphaned_review_chat_links)}`);
console.log(`  orphaned complaint_details: ${fkOk(baseline.fk_integrity.orphaned_complaint_details)}`);

// 8. Complaints on 5★ reviews (critical for migration)
console.log('\n=== 8. Complaints on 5★ reviews ===');
const complaints5Res = await pool.query(`
  SELECT COUNT(*) as cnt
  FROM review_complaints rc
  JOIN reviews r ON rc.review_id = r.id
  WHERE r.rating = 5
`);
baseline.complaints_on_5star = parseInt(complaints5Res.rows[0].cnt);
console.log(`  Complaints on 5★: ${baseline.complaints_on_5star} ${baseline.complaints_on_5star === 0 ? '✅ Safe to split' : '⚠️ Must handle before split'}`);

// 9. review_chat_links on 5★ reviews
console.log('\n=== 9. Review-chat links on 5★ reviews ===');
const links5Res = await pool.query(`
  SELECT COUNT(*) as cnt
  FROM review_chat_links rcl
  JOIN reviews r ON rcl.review_id = r.id
  WHERE r.rating = 5
`);
baseline.chat_links_on_5star = parseInt(links5Res.rows[0].cnt);
console.log(`  Chat links on 5★: ${baseline.chat_links_on_5star} ${baseline.chat_links_on_5star === 0 ? '✅ Safe to split' : '⚠️ Must handle before split'}`);

// 10. Check existing constraints
console.log('\n=== 10. Existing constraints on reviews ===');
const conRes = await pool.query(`
  SELECT conname, contype, pg_get_constraintdef(oid) as definition
  FROM pg_constraint
  WHERE conrelid = 'reviews'::regclass
  ORDER BY conname
`);
baseline.constraints = conRes.rows;
conRes.rows.forEach(r => console.log(`  ${r.conname} (${r.contype}): ${r.definition}`));

// 11. FK constraints referencing reviews
console.log('\n=== 11. FK constraints referencing reviews ===');
const fkRefRes = await pool.query(`
  SELECT
    tc.table_name as from_table,
    kcu.column_name as from_column,
    tc.constraint_name,
    rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
  WHERE ccu.table_name = 'reviews'
  ORDER BY tc.table_name
`);
baseline.fk_references = fkRefRes.rows;
fkRefRes.rows.forEach(r =>
  console.log(`  ${r.from_table}.${r.from_column} → reviews (${r.constraint_name}) ON DELETE ${r.delete_rule}`)
);

// Summary
console.log('\n' + '='.repeat(60));
console.log('BASELINE SUMMARY');
console.log('='.repeat(60));
console.log(`Total reviews: ${total.toLocaleString()}`);
console.log(`5★ reviews: ${ratingRes.rows.find(r => r.rating === 5)?.cnt || 0} (${((parseInt(ratingRes.rows.find(r => r.rating === 5)?.cnt || 0) / total) * 100).toFixed(1)}%)`);
console.log(`1-4★ reviews: ${total - parseInt(ratingRes.rows.find(r => r.rating === 5)?.cnt || 0)}`);
console.log(`Table size: ${baseline.sizes.total_with_indexes}`);
console.log(`Complaints on 5★: ${baseline.complaints_on_5star}`);
console.log(`Chat links on 5★: ${baseline.chat_links_on_5star}`);
console.log(`FK orphans: RC=${baseline.fk_integrity.orphaned_review_complaints}, RCL=${baseline.fk_integrity.orphaned_review_chat_links}, CD=${baseline.fk_integrity.orphaned_complaint_details}`);

// Save to JSON
baseline.timestamp = new Date().toISOString();
console.log('\n--- JSON output ---');
console.log(JSON.stringify(baseline, null, 2));

await pool.end();
