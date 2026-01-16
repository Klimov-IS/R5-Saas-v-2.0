/**
 * Check ai_logs table schema and foreign key constraints
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

async function checkAiLogsSchema() {
  console.log('🔍 Checking ai_logs table schema...\n');

  try {
    // Check foreign key constraints
    console.log('1️⃣  Checking foreign key constraints...');
    const constraints = await query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'ai_logs';
    `);

    console.log('\nForeign key constraints on ai_logs:');
    constraints.rows.forEach((row: any) => {
      console.log(`  ${row.constraint_name}:`);
      console.log(`    Column: ${row.column_name}`);
      console.log(`    References: ${row.foreign_table_name}(${row.foreign_column_name})`);
    });

    // Check sample store owner_id
    console.log('\n2️⃣  Checking sample store owner_id...');
    const store = await query(`
      SELECT id, name, owner_id
      FROM stores
      WHERE id = 'sTtXcI2WoTTF4Nmbng6N'
      LIMIT 1;
    `);

    if (store.rows.length > 0) {
      const storeData = store.rows[0];
      console.log(`\nStore: ${storeData.name}`);
      console.log(`  ID: ${storeData.id}`);
      console.log(`  owner_id: ${storeData.owner_id}`);

      // Check if owner_id exists in referenced table
      const ownerCheck = await query(`
        SELECT EXISTS (
          SELECT 1 FROM users WHERE id = $1
        ) as exists;
      `, [storeData.owner_id]);

      console.log(`  owner_id exists in users table: ${ownerCheck.rows[0].exists ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('⚠️  Store not found');
    }

    // Check ai_logs table structure
    console.log('\n3️⃣  Checking ai_logs columns...');
    const columns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ai_logs'
      ORDER BY ordinal_position;
    `);

    console.log('\nColumns in ai_logs:');
    columns.rows.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Check all unique owner_ids in stores table
    console.log('\n4️⃣  Checking all unique owner_ids in stores...');
    const ownerIds = await query(`
      SELECT DISTINCT owner_id
      FROM stores
      WHERE owner_id IS NOT NULL
      LIMIT 10;
    `);

    console.log('\nUnique owner_ids in stores (first 10):');
    for (const row of ownerIds.rows) {
      const ownerId = (row as any).owner_id;
      const existsCheck = await query(`
        SELECT EXISTS (
          SELECT 1 FROM users WHERE id = $1
        ) as exists;
      `, [ownerId]);

      const exists = existsCheck.rows[0].exists;
      console.log(`  ${ownerId}: ${exists ? '✅ EXISTS in users' : '❌ MISSING in users'}`);
    }

    console.log('\n✅ Check complete!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('💥 Error checking ai_logs schema:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

checkAiLogsSchema();
