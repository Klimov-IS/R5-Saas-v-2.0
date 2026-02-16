import fs from 'fs';
import pg from 'pg';

// Parse .env.production manually
const envFile = fs.readFileSync('/var/www/wb-reputation/.env.production', 'utf8');
envFile.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const idx = line.indexOf('=');
  if (idx === -1) return;
  const key = line.substring(0, idx).trim();
  const val = line.substring(idx + 1).trim();
  process.env[key] = val;
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
  const res = await pool.query('SELECT NOW()');
  console.log('DB connected:', res.rows[0].now);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_complaints_draft_store_product
    ON review_complaints(store_id, product_id)
    WHERE status = 'draft'
  `);
  console.log('Migration 013 OK - index created');
} catch(e) {
  console.error('FAILED:', e.message);
} finally {
  await pool.end();
}
