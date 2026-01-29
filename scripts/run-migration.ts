/**
 * Migration Runner
 * Applies SQL migrations to the database
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '../src/db/client';

// Load .env.local
config({ path: join(process.cwd(), '.env.local') });

async function runMigration(migrationFile: string) {
  console.log(`\n📦 Running migration: ${migrationFile}...`);

  try {
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    const sql = readFileSync(migrationPath, 'utf-8');

    await query(sql);

    console.log(`✅ Migration ${migrationFile} completed successfully!`);
  } catch (error: any) {
    console.error(`❌ Migration ${migrationFile} failed:`, error.message);
    throw error;
  }
}

async function main() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>');
    console.error('Example: npx tsx scripts/run-migration.ts 002_create_manager_tasks.sql');
    process.exit(1);
  }

  console.log('🚀 Starting migration process...');
  await runMigration(migrationFile);
  console.log('\n✨ All migrations completed!\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
