/**
 * Migration 016: Review-Chat Links (Sprint 002)
 *
 * Creates review_chat_links table for review↔chat associations
 * created by Chrome Extension.
 *
 * Run on server:
 *   cd /var/www/wb-reputation && node scripts/run-migration-016.mjs
 */

import fs from 'fs';
import pg from 'pg';

// Load env from production file
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
  console.log('[MIGRATION 016] Starting: Create review_chat_links table...');

  // Read migration SQL
  const migrationSql = fs.readFileSync(
    '/var/www/wb-reputation/migrations/016_review_chat_links.sql',
    'utf8'
  );

  // Execute migration
  await pool.query(migrationSql);
  console.log('[MIGRATION 016] Table and indexes created successfully');

  // Verify table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'review_chat_links'
    ) as exists
  `);
  console.log(`[MIGRATION 016] Table exists: ${tableCheck.rows[0].exists}`);

  // Verify indexes
  const indexCheck = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'review_chat_links'
    ORDER BY indexname
  `);
  console.log(`[MIGRATION 016] Indexes (${indexCheck.rows.length}):`);
  indexCheck.rows.forEach(r => console.log(`  - ${r.indexname}`));

  // Verify constraints
  const constraintCheck = await pool.query(`
    SELECT conname, contype FROM pg_constraint
    WHERE conrelid = 'review_chat_links'::regclass
    ORDER BY conname
  `);
  console.log(`[MIGRATION 016] Constraints (${constraintCheck.rows.length}):`);
  constraintCheck.rows.forEach(r => console.log(`  - ${r.conname} (${r.contype})`));

  console.log('[MIGRATION 016] Done!');

} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('[MIGRATION 016] Table already exists, skipping');
  } else {
    console.error('[MIGRATION 016] ERROR:', e.message);
    process.exit(1);
  }
} finally {
  await pool.end();
}
