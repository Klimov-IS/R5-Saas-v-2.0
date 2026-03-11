/**
 * Migration 031: Add Store Lifecycle Stage (Sprint 006)
 *
 * Adds stores.stage field for tracking client lifecycle.
 *
 * Run locally:
 *   node scripts/run-migration-031.mjs
 *
 * Run on server:
 *   cd /var/www/wb-reputation && node scripts/run-migration-031.mjs
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
  console.log('[MIGRATION 031] Starting: Add stores.stage column...');

  // Read migration SQL
  const migrationPath = path.join(projectRoot, 'migrations', '031_add_stores_stage.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Execute migration
  await pool.query(migrationSql);
  console.log('[MIGRATION 031] Column and constraint created successfully');

  // Verify column exists
  const columnCheck = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'stage'
  `);

  if (columnCheck.rows.length > 0) {
    const col = columnCheck.rows[0];
    console.log(`[MIGRATION 031] ✓ Column exists: ${col.column_name} ${col.data_type}`);
    console.log(`[MIGRATION 031] ✓ Default: ${col.column_default}`);
  } else {
    console.log('[MIGRATION 031] ✗ Column not found!');
  }

  // Verify constraint
  const constraintCheck = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'stores'::regclass
      AND conname = 'stores_stage_check'
  `);

  if (constraintCheck.rows.length > 0) {
    console.log(`[MIGRATION 031] ✓ Constraint exists: ${constraintCheck.rows[0].conname}`);
  } else {
    console.log('[MIGRATION 031] ✗ Constraint not found!');
  }

  // Verify index
  const indexCheck = await pool.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'stores' AND indexname = 'idx_stores_stage'
  `);

  if (indexCheck.rows.length > 0) {
    console.log(`[MIGRATION 031] ✓ Index exists: ${indexCheck.rows[0].indexname}`);
  } else {
    console.log('[MIGRATION 031] ✗ Index not found!');
  }

  // Check current store count
  const storeCount = await pool.query(`SELECT COUNT(*) as count FROM stores`);
  console.log(`[MIGRATION 031] Total stores: ${storeCount.rows[0].count}`);

  // Check stage values (should all be default 'cabinet_connected')
  const stageDistribution = await pool.query(`
    SELECT stage, COUNT(*) as count
    FROM stores
    GROUP BY stage
    ORDER BY count DESC
  `);
  console.log(`[MIGRATION 031] Current stage distribution:`);
  stageDistribution.rows.forEach(r => {
    console.log(`  - ${r.stage || 'NULL'}: ${r.count}`);
  });

  console.log('[MIGRATION 031] Done!');
  console.log('\n✅ Next step: Run backfill script to set initial stage values');
  console.log('   node scripts/backfill-stores-stage.mjs --dry-run');

} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('[MIGRATION 031] ⚠️  Column already exists, skipping');
  } else {
    console.error('[MIGRATION 031] ❌ ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
} finally {
  await pool.end();
}
