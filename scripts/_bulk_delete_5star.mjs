// Bulk delete 5★ reviews from reviews table (after copy to archive confirmed)
// Uses batches to avoid long-running lock
import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const pg = require2('pg');

const BATCH_SIZE = parseInt(process.argv[2] || '100000');

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  statement_timeout: 1800000, // 30 min per batch
});

const fmt = (n) => Number(n).toLocaleString();

async function main() {
  console.log('=== Bulk DELETE 5★ from reviews ===');

  // Pre-check: archive must have the data
  const archCnt = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  console.log('Archive count:', fmt(parseInt(archCnt.rows[0].cnt)));

  const fiveCnt = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  const totalFive = parseInt(fiveCnt.rows[0].cnt);
  console.log('5★ in reviews:', fmt(totalFive));

  if (totalFive === 0) {
    console.log('Nothing to delete. Done!');
    await pool.end();
    return;
  }

  const origTotal = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
  console.log('Total reviews before:', fmt(parseInt(origTotal.rows[0].cnt)));
  console.log('Expected after:', fmt(parseInt(origTotal.rows[0].cnt) - totalFive));
  console.log('Batch size:', fmt(BATCH_SIZE));
  console.log('');

  let deleted = 0;
  const startTime = Date.now();

  while (true) {
    const t = Date.now();
    const res = await pool.query(`
      DELETE FROM reviews
      WHERE id IN (
        SELECT id FROM reviews WHERE rating = 5 LIMIT $1
      )
    `, [BATCH_SIZE]);

    if (res.rowCount === 0) break;
    deleted += res.rowCount;

    const pct = ((deleted / totalFive) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const batchTime = ((Date.now() - t) / 1000).toFixed(1);
    console.log(`[DELETE] ${fmt(deleted)} / ${fmt(totalFive)} (${pct}%) — batch: ${batchTime}s, total: ${elapsed}s`);
  }

  console.log('');
  console.log(`=== DELETE COMPLETE: ${fmt(deleted)} rows in ${((Date.now() - startTime) / 1000).toFixed(1)}s ===`);

  // Validate
  const remaining = await pool.query('SELECT COUNT(*) as cnt FROM reviews WHERE rating = 5');
  console.log('5★ remaining:', remaining.rows[0].cnt, parseInt(remaining.rows[0].cnt) === 0 ? '✅' : '❌');

  const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
  console.log('Reviews total:', fmt(parseInt(finalCount.rows[0].cnt)));

  const rr = await pool.query('SELECT MIN(rating) as min_r, MAX(rating) as max_r FROM reviews');
  console.log('Rating range:', rr.rows[0].min_r, '-', rr.rows[0].max_r);

  await pool.end();
}

main().catch(async (err) => {
  console.error('ERROR:', err.message);
  await pool.end();
  process.exit(1);
});
