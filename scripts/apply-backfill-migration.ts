/**
 * Apply backfill migration to database
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'fs';
import { Pool } from 'pg';

async function applyMigration() {
  console.log('━'.repeat(60));
  console.log('🔄 APPLYING BACKFILL MIGRATION');
  console.log('━'.repeat(60));

  // Remove sslmode from connection string and set ssl manually
  let connectionString = process.env.DATABASE_URL || '';
  if (connectionString.includes('?sslmode=')) {
    connectionString = connectionString.split('?')[0];
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sql = readFileSync('supabase/migrations/20260208_001_complaint_backfill_system.sql', 'utf8');
    console.log('\n📄 Migration file loaded');
    console.log('📊 Executing SQL...\n');

    await pool.query(sql);
    console.log('✅ Migration applied successfully!\n');

    // Verify tables exist
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('complaint_backfill_jobs', 'complaint_daily_limits')
    `);
    console.log('📋 Created tables:');
    tablesResult.rows.forEach(r => console.log(`   - ${r.table_name}`));

    // Check view
    const viewResult = await pool.query('SELECT count(*) as count FROM v_backfill_status');
    console.log(`\n📊 View v_backfill_status: ✅ works (${viewResult.rows[0].count} rows)`);

    // Check functions
    const funcResult = await pool.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('get_remaining_daily_limit', 'increment_daily_limit')
    `);
    console.log('\n🔧 Created functions:');
    funcResult.rows.forEach(r => console.log(`   - ${r.routine_name}`));

    console.log('\n━'.repeat(60));
    console.log('✅ MIGRATION COMPLETE');
    console.log('━'.repeat(60));

  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
