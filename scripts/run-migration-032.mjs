/**
 * Migration 032: Replace stores.status with stores.is_active
 *
 * Adds is_active BOOLEAN column, backfills from status, creates index.
 * Status column is NOT dropped — that's migration 033 (separate deploy).
 *
 * Run locally:
 *   node scripts/run-migration-032.mjs
 *
 * Run on server:
 *   cd /var/www/wb-reputation && node scripts/run-migration-032.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Try to load .env.production first (on server), fallback to .env.local (local dev)
const productionEnvPath = '/var/www/wb-reputation/.env.production';
const localEnvPath = path.join(projectRoot, '.env.local');

let isProduction = false;

if (fs.existsSync(productionEnvPath)) {
  console.log('[ENV] Loading production environment...');
  const envFile = fs.readFileSync(productionEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  });
  isProduction = true;
} else if (fs.existsSync(localEnvPath)) {
  console.log('[ENV] Loading local development environment...');
  dotenv.config({ path: localEnvPath });
} else {
  console.error('[ENV] ERROR: No .env file found!');
  process.exit(1);
}

// Create pool with appropriate connection method
const poolConfig = isProduction
  ? {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: { rejectUnauthorized: false }
    }
  : {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };

const pool = new pg.Pool(poolConfig);

try {
  console.log('[MIGRATION 032] Starting: Replace stores.status → stores.is_active...');

  // Read migration SQL
  const migrationPath = path.join(projectRoot, 'migrations', '032_status_to_is_active.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Execute migration
  await pool.query(migrationSql);
  console.log('[MIGRATION 032] Column, backfill, and index completed');

  // Verify column exists
  const columnCheck = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'is_active'
  `);

  if (columnCheck.rows.length > 0) {
    const col = columnCheck.rows[0];
    console.log(`[MIGRATION 032] ✓ Column exists: ${col.column_name} ${col.data_type} (default: ${col.column_default})`);
  } else {
    console.log('[MIGRATION 032] ✗ Column not found!');
  }

  // Verify index
  const indexCheck = await pool.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'stores' AND indexname = 'idx_stores_is_active'
  `);

  if (indexCheck.rows.length > 0) {
    console.log(`[MIGRATION 032] ✓ Index exists: ${indexCheck.rows[0].indexname}`);
  } else {
    console.log('[MIGRATION 032] ✗ Index not found!');
  }

  // KEY VERIFICATION: Compare status vs is_active mapping
  const verifyResult = await pool.query(`
    SELECT status, is_active, COUNT(*) as count
    FROM stores
    GROUP BY status, is_active
    ORDER BY status
  `);

  console.log('[MIGRATION 032] Backfill verification (status → is_active):');
  let allCorrect = true;
  for (const row of verifyResult.rows) {
    const expected = row.status === 'active';
    const actual = row.is_active;
    const ok = expected === actual;
    if (!ok) allCorrect = false;
    console.log(`  ${ok ? '✓' : '✗'} ${row.status} → ${actual} (count: ${row.count})${!ok ? ' ← MISMATCH!' : ''}`);
  }

  if (allCorrect) {
    console.log('[MIGRATION 032] ✓ All backfill values correct');
  } else {
    console.error('[MIGRATION 032] ✗ BACKFILL MISMATCH DETECTED! Check manually.');
    process.exit(1);
  }

  // Summary
  const totalStores = await pool.query('SELECT COUNT(*) as total FROM stores');
  const activeStores = await pool.query('SELECT COUNT(*) as active FROM stores WHERE is_active = TRUE');
  console.log(`[MIGRATION 032] Summary: ${activeStores.rows[0].active} active / ${totalStores.rows[0].total} total stores`);

  console.log('[MIGRATION 032] ✅ Done!');
  console.log('\nNext steps:');
  console.log('  1. Deploy code changes (status → is_active in all queries)');
  console.log('  2. After 1-2 days stable: run migration 033 to drop status column');

} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('[MIGRATION 032] ⚠️  Column already exists, running verification only...');

    const verifyResult = await pool.query(`
      SELECT status, is_active, COUNT(*) as count
      FROM stores
      GROUP BY status, is_active
      ORDER BY status
    `);
    console.log('[MIGRATION 032] Current mapping:');
    verifyResult.rows.forEach(r => {
      console.log(`  ${r.status} → is_active=${r.is_active} (count: ${r.count})`);
    });
  } else {
    console.error('[MIGRATION 032] ❌ ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
} finally {
  await pool.end();
}
