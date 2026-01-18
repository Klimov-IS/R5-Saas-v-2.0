import { query } from '../src/db/client';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  console.log('📋 Applying sync_logs migration...\n');

  try {
    const migrationPath = path.join(__dirname, '../migrations/20260118_create_sync_logs.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    await query(sql);

    console.log('✅ Migration applied successfully!\n');
    console.log('Table sync_logs created with columns:');
    console.log('  - id (serial)');
    console.log('  - store_id');
    console.log('  - sync_type');
    console.log('  - status (running/success/error)');
    console.log('  - chats_total, chats_synced, messages_added');
    console.log('  - chats_classified');
    console.log('  - error_message');
    console.log('  - started_at, completed_at\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
