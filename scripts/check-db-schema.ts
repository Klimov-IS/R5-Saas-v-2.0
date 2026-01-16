/**
 * Check database schema and identify missing components
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  // Check if chat_tag enum exists
  console.log('1️⃣  Checking chat_tag ENUM...');
  try {
    const enumCheck = await query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'chat_tag'
      ) as exists;
    `);

    if (enumCheck.rows[0].exists) {
      console.log('✅ chat_tag ENUM exists\n');

      // Show current values
      const values = await query(`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'chat_tag')
        ORDER BY enumlabel;
      `);

      console.log('  Current values:');
      values.rows.forEach((r: any) => console.log(`    - ${r.enumlabel}`));
      console.log('');
    } else {
      console.log('❌ chat_tag ENUM DOES NOT EXIST!\n');
      console.log('  📋 Need to create it first before adding deletion tags.\n');
    }
  } catch (err: any) {
    console.error('❌ Error checking chat_tag:', err.message);
  }

  // Check chats table
  console.log('2️⃣  Checking chats table...');
  try {
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'chats'
      ) as exists;
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ chats table exists\n');

      // Show tag column type
      const columnInfo = await query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'chats' AND column_name = 'tag';
      `);

      if (columnInfo.rows.length > 0) {
        const col = columnInfo.rows[0];
        console.log(`  Column 'tag' type: ${col.data_type} (${col.udt_name})\n`);
      } else {
        console.log(`  ❌ Column 'tag' NOT FOUND in chats table!\n`);
      }
    } else {
      console.log('❌ chats table DOES NOT EXIST!\n');
    }
  } catch (err: any) {
    console.error('❌ Error checking chats table:', err.message);
  }

  // Check review_deletion_cases table
  console.log('3️⃣  Checking review_deletion_cases table...');
  try {
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'review_deletion_cases'
      ) as exists;
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ review_deletion_cases table exists\n');
    } else {
      console.log('❌ review_deletion_cases table DOES NOT EXIST\n');
      console.log('  📋 This is expected - will be created by migration 003.\n');
    }
  } catch (err: any) {
    console.error('❌ Error checking review_deletion_cases:', err.message);
  }

  // Show all enum types
  console.log('4️⃣  All ENUM types in database:');
  try {
    const enums = await query(`
      SELECT typname
      FROM pg_type
      WHERE typcategory = 'E'
      ORDER BY typname;
    `);

    if (enums.rows.length > 0) {
      enums.rows.forEach((r: any) => console.log(`    - ${r.typname}`));
      console.log('');
    } else {
      console.log('    (none found)\n');
    }
  } catch (err: any) {
    console.error('❌ Error listing enums:', err.message);
  }

  console.log('✅ Schema check complete!\n');
  process.exit(0);
}

checkSchema().catch((err) => {
  console.error('\n💥 Error:', err);
  process.exit(1);
});
