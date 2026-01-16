/**
 * Apply deletion workflow migrations to PostgreSQL
 * Usage: npx tsx scripts/apply-migrations.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

const MIGRATIONS = [
  '20260116_001_fix_chat_tag_constraint.sql', // MUST BE FIRST - fixes CHECK constraint for deletion tags
  '20260116_002_add_deletion_classification_prompt.sql',
  '20260116_003_create_review_deletion_cases.sql',
];

async function applyMigrations() {
  console.log('🚀 Starting migration process...\n');

  for (const migrationFile of MIGRATIONS) {
    const filePath = path.join(MIGRATIONS_DIR, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ Migration file not found: ${migrationFile}`);
      continue;
    }

    console.log(`📄 Applying: ${migrationFile}`);

    try {
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Remove SQL comments (-- style)
      const cleanedSql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();

      if (!cleanedSql) {
        console.log(`⚠️  Empty migration file: ${migrationFile}\n`);
        continue;
      }

      // Execute the entire SQL file as one statement
      // This preserves DO blocks and other multi-statement constructs
      await query(cleanedSql);

      console.log(`✅ Success: ${migrationFile}\n`);
    } catch (error: any) {
      // Check if error is about ALTER TYPE (meaning the value already exists)
      if (
        error.message.includes('already exists') ||
        error.message.includes('already contains') ||
        error.message.includes('duplicate key value')
      ) {
        console.log(`⚠️  Skipped (already applied): ${migrationFile}\n`);
      } else {
        console.error(`❌ Error applying ${migrationFile}:`, error.message);
        console.error('Full error:', error);
        throw error;
      }
    }
  }

  console.log('\n🎉 All migrations applied successfully!\n');

  // Verify tags are in database
  console.log('🔍 Verifying new chat tags...\n');
  try {
    const result = await query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'chat_tag')
      ORDER BY enumlabel;
    `);

    console.log('Available chat tags:');
    result.rows.forEach((row: any) => {
      const icon =
        row.enumlabel === 'deletion_candidate'
          ? '🎯'
          : row.enumlabel === 'deletion_offered'
          ? '💰'
          : row.enumlabel === 'deletion_agreed'
          ? '🤝'
          : row.enumlabel === 'deletion_confirmed'
          ? '✅'
          : row.enumlabel === 'refund_requested'
          ? '💸'
          : row.enumlabel === 'spam'
          ? '🚫'
          : '  ';
      console.log(`  ${icon} ${row.enumlabel}`);
    });
    console.log('');
  } catch (error: any) {
    console.warn('Warning: Could not verify tags:', error.message);
  }

  // Check if deletion_cases table exists
  console.log('🔍 Verifying review_deletion_cases table...\n');
  try {
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'review_deletion_cases'
      ) as exists;
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Table review_deletion_cases exists\n');
    } else {
      console.log('❌ Table review_deletion_cases NOT found\n');
    }
  } catch (error: any) {
    console.warn('Warning: Could not verify table:', error.message);
  }

  console.log('✨ Migration complete! You can now restart the dialogue sync.\n');
  process.exit(0);
}

applyMigrations().catch((error) => {
  console.error('\n💥 Migration failed:', error);
  process.exit(1);
});
