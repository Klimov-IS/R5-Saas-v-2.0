// Create partial index for /stores Q2 query — excludes 5★ reviews
// Drops invalid index if exists, recreates with 15min timeout
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
  statement_timeout: 900000, // 15 min for index creation
});

// Step 1: Check if invalid index exists and drop it
console.log('Checking for invalid index...');
const check = await pool.query(
  "SELECT indisvalid FROM pg_index WHERE indexrelid::regclass::text = 'idx_reviews_status_parse_r14'"
);
if (check.rows.length > 0 && !check.rows[0].indisvalid) {
  console.log('Found INVALID index, dropping...');
  await pool.query('DROP INDEX IF EXISTS idx_reviews_status_parse_r14');
  console.log('Dropped.');
} else if (check.rows.length > 0 && check.rows[0].indisvalid) {
  console.log('Index already exists and is VALID. Done.');
  const res = await pool.query("SELECT pg_size_pretty(pg_relation_size('idx_reviews_status_parse_r14')) as size");
  console.log('Index size:', res.rows[0].size);
  await pool.end();
  process.exit(0);
}

// Step 2: Create index
console.log('Creating partial index idx_reviews_status_parse_r14...');
const t = Date.now();

await pool.query(`
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_status_parse_r14
  ON reviews (store_id)
  WHERE marketplace = 'wb'
    AND rating_excluded = FALSE
    AND review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
    AND (chat_status_by_review IS NULL OR chat_status_by_review = 'unknown')
    AND rating < 5
`);

console.log('Index created in', Date.now() - t, 'ms');

const res = await pool.query("SELECT pg_size_pretty(pg_relation_size('idx_reviews_status_parse_r14')) as size");
console.log('Index size:', res.rows[0].size);

const valid = await pool.query(
  "SELECT indisvalid FROM pg_index WHERE indexrelid::regclass::text = 'idx_reviews_status_parse_r14'"
);
console.log('Valid:', valid.rows[0].indisvalid);

await pool.end();
