import fs from 'fs';
import pg from 'pg';

const envFile = fs.readFileSync('/var/www/wb-reputation/.env.production', 'utf8');
envFile.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const idx = line.indexOf('=');
  if (idx === -1) return;
  process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
});

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Verify what we're deleting
  const check = await pool.query(`
    SELECT COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'approved') as approved
    FROM review_complaints
    WHERE review_date < '2023-10-01'
  `);
  console.log('[CLEANUP] Pre-cutoff complaints:', check.rows[0]);

  const { total, sent, approved } = check.rows[0];
  if (parseInt(sent) > 0 || parseInt(approved) > 0) {
    console.error('[CLEANUP] ABORT: Found sent/approved complaints — manual review needed');
    process.exit(1);
  }

  if (parseInt(total) === 0) {
    console.log('[CLEANUP] No pre-cutoff complaints found. Nothing to do.');
    process.exit(0);
  }

  // 2. Delete
  const result = await pool.query(`
    DELETE FROM review_complaints
    WHERE review_date < '2023-10-01'
    RETURNING review_id, store_id, review_date::date as review_date
  `);
  console.log(`[CLEANUP] Deleted ${result.rowCount} complaints`);
  result.rows.forEach(r => console.log(`  - review=${r.review_id}, store=${r.store_id}, date=${r.review_date}`));

  // 3. Verify
  const verify = await pool.query(`
    SELECT COUNT(*) as remaining
    FROM review_complaints
    WHERE review_date < '2023-10-01'
  `);
  console.log(`[CLEANUP] Remaining pre-cutoff: ${verify.rows[0].remaining} (should be 0)`);

  console.log('[CLEANUP] Done.');
} catch(e) {
  console.error('[CLEANUP] ERROR:', e.message);
} finally {
  await pool.end();
}
