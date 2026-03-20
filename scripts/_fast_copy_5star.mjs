// Fast bulk copy: TRUNCATE archive, drop PK, INSERT all 5★, recreate PK + indexes
// This is the fastest approach for initial data loading
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
  max: 2,
  statement_timeout: 0, // no timeout for bulk ops
});

const elapsed = (start) => ((Date.now() - start) / 1000).toFixed(1) + 's';

async function main() {
  const totalStart = Date.now();
  console.log('=== Fast Bulk Copy 5★ to reviews_archive ===\n');

  // Step 0: Count
  const fiveCnt = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  console.log('5★ reviews to copy:', parseInt(fiveCnt.rows[0].cnt).toLocaleString());

  // Step 1: TRUNCATE archive (instant, removes dead tuples)
  console.log('\n[Step 1] TRUNCATE reviews_archive...');
  let t = Date.now();
  await pool.query('TRUNCATE reviews_archive');
  console.log(`  Done in ${elapsed(t)}`);

  // Step 2: Drop PK (removes B-tree index overhead during INSERT)
  console.log('\n[Step 2] DROP PRIMARY KEY...');
  t = Date.now();
  await pool.query('ALTER TABLE reviews_archive DROP CONSTRAINT IF EXISTS reviews_archive_pkey');
  console.log(`  Done in ${elapsed(t)}`);

  // Step 3: DROP triggers (avoid trigger overhead during bulk load)
  console.log('\n[Step 3] DROP triggers temporarily...');
  await pool.query('DROP TRIGGER IF EXISTS update_reviews_archive_complaint_flags ON reviews_archive');
  await pool.query('DROP TRIGGER IF EXISTS update_reviews_archive_updated_at ON reviews_archive');
  console.log('  Done');

  // Step 4: Bulk INSERT — no indexes, no triggers, no conflict checking
  console.log('\n[Step 4] INSERT INTO reviews_archive SELECT * FROM reviews WHERE rating = 5...');
  console.log('  This is a sequential scan + heap append. Please wait...');
  t = Date.now();
  const res = await pool.query(`
    INSERT INTO reviews_archive
    SELECT * FROM reviews WHERE rating = 5
  `);
  console.log(`  Inserted ${res.rowCount.toLocaleString()} rows in ${elapsed(t)}`);

  // Step 5: Recreate PK
  console.log('\n[Step 5] ADD PRIMARY KEY...');
  t = Date.now();
  await pool.query('ALTER TABLE reviews_archive ADD PRIMARY KEY (id)');
  console.log(`  PK created in ${elapsed(t)}`);

  // Step 6: Recreate secondary indexes
  console.log('\n[Step 6] Create secondary indexes...');

  t = Date.now();
  await pool.query('CREATE INDEX idx_ra_store_date ON reviews_archive(store_id, date DESC)');
  console.log(`  idx_ra_store_date: ${elapsed(t)}`);

  t = Date.now();
  await pool.query('CREATE INDEX idx_ra_product_date ON reviews_archive(product_id, date DESC)');
  console.log(`  idx_ra_product_date: ${elapsed(t)}`);

  t = Date.now();
  await pool.query('CREATE INDEX idx_ra_store_rating ON reviews_archive(store_id, rating, date DESC)');
  console.log(`  idx_ra_store_rating: ${elapsed(t)}`);

  t = Date.now();
  await pool.query('CREATE INDEX idx_ra_marketplace ON reviews_archive(marketplace)');
  console.log(`  idx_ra_marketplace: ${elapsed(t)}`);

  // Step 7: Recreate triggers
  console.log('\n[Step 7] Recreate triggers...');
  await pool.query(`
    CREATE TRIGGER update_reviews_archive_complaint_flags
    BEFORE INSERT OR UPDATE OF complaint_status, complaint_text, complaint_sent_date
    ON reviews_archive FOR EACH ROW
    EXECUTE FUNCTION update_review_complaint_flags()
  `);
  await pool.query(`
    CREATE TRIGGER update_reviews_archive_updated_at
    BEFORE UPDATE ON reviews_archive FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
  console.log('  Done');

  // Step 8: Add CHECK constraint
  console.log('\n[Step 8] Add CHECK constraint...');
  await pool.query('ALTER TABLE reviews_archive ADD CONSTRAINT chk_archive_rating_5 CHECK (rating = 5)');
  console.log('  Done');

  // Step 9: ANALYZE
  console.log('\n[Step 9] ANALYZE...');
  await pool.query('ANALYZE reviews_archive');
  console.log('  Done');

  // Step 10: Validate
  console.log('\n=== Validation ===');
  const archCnt = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  console.log('Archive rows:', parseInt(archCnt.rows[0].cnt).toLocaleString());

  const nonFive = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive WHERE rating != 5');
  console.log('Non-5★ in archive:', nonFive.rows[0].cnt, parseInt(nonFive.rows[0].cnt) === 0 ? '✅' : '❌');

  const sz = await pool.query(`
    SELECT pg_size_pretty(pg_relation_size('reviews_archive')) as data,
           pg_size_pretty(pg_total_relation_size('reviews_archive')) as total
  `);
  console.log('Archive size:', sz.rows[0].data, 'data,', sz.rows[0].total, 'total');

  console.log(`\n=== COPY PHASE COMPLETE in ${elapsed(totalStart)} ===`);
  console.log('Next: run _bulk_delete_5star.mjs');

  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL:', err.message);
  await pool.end();
  process.exit(1);
});
