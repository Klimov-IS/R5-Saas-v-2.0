// Bulk copy remaining 5★ reviews using single INSERT...SELECT
// Much faster than cursor-based batching (sequential scan vs random I/O)
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
  statement_timeout: 0, // no timeout for bulk operation
});

async function main() {
  console.log('=== Bulk COPY 5★ to reviews_archive ===');

  const cnt = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  console.log('Archive before:', cnt.rows[0].cnt);

  const fiveBefore = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  console.log('5★ in reviews:', fiveBefore.rows[0].cnt);

  console.log('Running INSERT...SELECT with ON CONFLICT DO NOTHING...');
  const t = Date.now();

  const res = await pool.query(`
    INSERT INTO reviews_archive
    SELECT * FROM reviews WHERE rating = 5
    ON CONFLICT (id) DO NOTHING
  `);

  const elapsed = ((Date.now() - t) / 1000).toFixed(1);
  console.log(`Inserted ${res.rowCount} new rows in ${elapsed}s`);

  const cnt2 = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  console.log('Archive after:', cnt2.rows[0].cnt);

  console.log('\n=== COPY phase complete! ===');
  console.log('Next: run DELETE phase');

  await pool.end();
}

main().catch(async (err) => {
  console.error('ERROR:', err.message);
  await pool.end();
  process.exit(1);
});
