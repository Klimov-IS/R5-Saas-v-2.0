/**
 * Apply database migration script
 * Usage: npx tsx scripts/apply-migration.ts <migration-file>
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: process.env.POSTGRES_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

async function applyMigration(migrationFile: string) {
  const client = await pool.connect();

  try {
    console.log(`\n📦 Applying migration: ${migrationFile}\n`);

    // Read migration file
    const migrationPath = path.join(process.cwd(), migrationFile);
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✓ Migration file loaded (${sql.length} bytes)\n`);

    // Begin transaction
    await client.query('BEGIN');
    console.log('✓ Transaction started\n');

    // Execute migration
    console.log('🔄 Executing SQL...\n');
    const result = await client.query(sql);
    console.log('✓ SQL executed successfully\n');

    // Commit transaction
    await client.query('COMMIT');
    console.log('✓ Transaction committed\n');

    console.log('✅ Migration applied successfully!\n');

    // Show created objects
    console.log('📋 Verifying created objects...\n');

    // Check ENUM types
    const enumsResult = await client.query(`
      SELECT typname
      FROM pg_type
      WHERE typname IN ('review_status_wb', 'product_status_by_review', 'chat_status_by_review', 'complaint_status')
      ORDER BY typname;
    `);
    console.log(`ENUM types created: ${enumsResult.rowCount}`);
    enumsResult.rows.forEach(row => console.log(`  - ${row.typname}`));

    // Check new columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'reviews'
        AND column_name IN (
          'review_status_wb',
          'product_status_by_review',
          'chat_status_by_review',
          'complaint_status',
          'complaint_generated_at',
          'complaint_reason_id',
          'complaint_category',
          'purchase_date',
          'parsed_at',
          'page_number'
        )
      ORDER BY column_name;
    `);
    console.log(`\nColumns added to reviews table: ${columnsResult.rowCount}`);
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) DEFAULT ${row.column_default || 'NULL'}`);
    });

    // Check indexes
    const indexesResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'reviews'
        AND indexname LIKE 'idx_reviews_%complaint%'
         OR indexname LIKE 'idx_reviews_default_filter'
         OR indexname LIKE 'idx_reviews_wb_status'
         OR indexname LIKE 'idx_reviews_product_status'
      ORDER BY indexname;
    `);
    console.log(`\nIndexes created: ${indexesResult.rowCount}`);
    indexesResult.rows.forEach(row => console.log(`  - ${row.indexname}`));

    console.log('\n✅ Migration verification complete!\n');
  } catch (error: any) {
    // Rollback transaction
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed! Transaction rolled back.\n');
    console.error('Error details:', error.message);
    if (error.position) {
      console.error(`Error at position: ${error.position}`);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get migration file from command line
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx scripts/apply-migration.ts <migration-file>');
  console.error('Example: npx tsx scripts/apply-migration.ts supabase/migrations/20260109_add_review_statuses.sql');
  process.exit(1);
}

// Run migration
applyMigration(migrationFile)
  .then(() => {
    console.log('Done! 🎉\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
