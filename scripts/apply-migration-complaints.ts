/**
 * Apply review_complaints table migration
 * Run: npx tsx scripts/apply-migration-complaints.ts
 */

// IMPORTANT: Load .env.local BEFORE any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../src/db/client';

async function applyMigration() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('🔄 Connecting to database...');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260109_001_review_complaints_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log('🚀 Applying migration...\n');

    // Execute migration
    await client.query('BEGIN');

    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');

      console.log('\n✅ Migration applied successfully!\n');

      // Verify table creation
      const result = await client.query(`
        SELECT
          table_name,
          (SELECT COUNT(*) FROM review_complaints) as row_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'review_complaints'
      `);

      if (result.rows.length > 0) {
        console.log('📊 Table verification:');
        console.log(`   - Table: ${result.rows[0].table_name}`);
        console.log(`   - Rows migrated: ${result.rows[0].row_count}`);
      }

      // Check indexes
      const indexResult = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'review_complaints'
        ORDER BY indexname
      `);

      console.log(`\n📌 Indexes created: ${indexResult.rows.length}`);
      indexResult.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });

      // Check columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'review_complaints'
        ORDER BY ordinal_position
      `);

      console.log(`\n📋 Columns: ${columnsResult.rows.length}`);
      columnsResult.rows.slice(0, 10).forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
      if (columnsResult.rows.length > 10) {
        console.log(`   ... and ${columnsResult.rows.length - 10} more columns`);
      }

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    client.release();
    // Don't close pool, let it be managed by the system
  }
}

// Run migration
applyMigration().then(() => {
  console.log('\n✨ Migration completed. Exiting...');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Migration failed:', error);
  process.exit(1);
});
