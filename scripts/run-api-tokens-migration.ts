/**
 * Script to run api_tokens table migration
 *
 * Usage:
 *   ts-node scripts/run-api-tokens-migration.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: '.env.production' });

import { query } from '../src/db/client';

async function runMigration() {
  console.log('🚀 Running api_tokens table migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_create_api_tokens_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file:', migrationPath);
    console.log('📝 SQL length:', migrationSQL.length, 'characters\n');

    // Execute migration
    console.log('⚙️  Executing migration...');
    await query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify table created
    console.log('🔍 Verifying table creation...');
    const tableCheck = await query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'api_tokens'
      ORDER BY ordinal_position
    `);

    if (tableCheck.rows.length > 0) {
      console.log('✅ Table api_tokens created with columns:');
      tableCheck.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('❌ Table api_tokens not found!');
      process.exit(1);
    }

    // Check indexes
    console.log('\n🔍 Checking indexes...');
    const indexCheck = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'api_tokens'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ Indexes created:');
      indexCheck.rows.forEach((row: any) => {
        console.log(`   - ${row.indexname}`);
      });
    }

    console.log('\n━'.repeat(80));
    console.log('✨ Migration completed successfully!');
    console.log('━'.repeat(80));
    console.log('\n📌 Next step: Generate API token using:');
    console.log('   npm run generate-extension-token <storeId> "Chrome Extension - Production"');
    console.log('━'.repeat(80));

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

runMigration();
