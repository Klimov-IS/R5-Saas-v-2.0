// Create partial index for /stores Q2 query — excludes 5★ reviews
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
  statement_timeout: 300000, // 5 min for index creation
});

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

await pool.end();
