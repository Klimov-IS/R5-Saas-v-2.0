/**
 * Migration script: Add status column to stores table
 * Run: node scripts/migrate-add-status.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Create pool from DATABASE_URL
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Remove sslmode query parameter if present
let cleanUrl = connectionString;
if (connectionString.includes('?sslmode=')) {
  cleanUrl = connectionString.split('?')[0];
}

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('[Migration] Starting: Add status column to stores...\n');

  try {
    // Step 1: Add status column
    console.log('[1/5] Adding status column...');
    await pool.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
    console.log('✅ Status column added\n');

    // Step 2: Drop old constraint if exists
    console.log('[2/5] Dropping old constraint (if exists)...');
    await pool.query(`ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_status_check`);
    console.log('✅ Old constraint dropped\n');

    // Step 3: Add status check constraint
    console.log('[3/5] Adding status check constraint...');
    await pool.query(`
      ALTER TABLE stores
      ADD CONSTRAINT stores_status_check
      CHECK (status IN ('active', 'paused', 'stopped', 'trial', 'archived'))
    `);
    console.log('✅ Status constraint added\n');

    // Step 4: Create index
    console.log('[4/5] Creating index on status column...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status)`);
    console.log('✅ Index created\n');

    // Step 5: Update existing NULL values
    console.log('[5/5] Updating existing stores to active status...');
    const updateResult = await pool.query(`UPDATE stores SET status = 'active' WHERE status IS NULL`);
    console.log(`✅ Updated ${updateResult.rowCount} stores\n`);

    // Verify migration
    console.log('[Verification] Checking stores status distribution...');
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total_stores,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_stores,
        COUNT(CASE WHEN status IS NULL THEN 1 END) as null_status
      FROM stores
    `);

    console.log('📊 Results:', verifyResult.rows[0]);
    console.log('\n✅ Migration completed successfully!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
