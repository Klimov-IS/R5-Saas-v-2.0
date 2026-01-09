/**
 * Run SQL migration script
 * Usage: npm run run-migration <migration-file>
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables first
dotenv.config({ path: join(process.cwd(), '.env.local') });

// Import from our db client (which handles SSL properly)
import { query, testConnection, closePool } from '../src/db/client';

async function runMigration(migrationFile: string) {
  try {
    console.log(`[MIGRATION] Testing database connection...`);
    const isConnected = await testConnection();

    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    // Read migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
    console.log(`[MIGRATION] Reading file: ${migrationPath}`);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log(`[MIGRATION] Executing migration: ${migrationFile}`);
    await query(sql);

    console.log(`[MIGRATION] ✅ Migration completed successfully`);

  } catch (error: any) {
    console.error(`[MIGRATION] ❌ Error:`, error.message);
    throw error;
  } finally {
    await closePool();
  }
}

// Get migration file from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npm run run-migration <migration-file>');
  console.error('Example: npm run run-migration 20260105_002_update_ai_logs_schema.sql');
  process.exit(1);
}

runMigration(migrationFile).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
