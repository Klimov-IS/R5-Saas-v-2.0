/**
 * Check Migration Status
 *
 * Quick check of owner_id distribution across all tables
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkStatus() {
  try {
    console.log('🔍 Проверка статуса миграции...\n');

    const tables = ['stores', 'products', 'reviews', 'review_complaints', 'chats', 'questions', 'ai_logs'];

    for (const table of tables) {
      try {
        const result = await query(
          `SELECT owner_id, COUNT(*) as count FROM ${table} GROUP BY owner_id ORDER BY count DESC`
        );

        console.log(`📊 ${table}:`);
        if (result.rows.length === 0) {
          console.log('   (пусто)\n');
        } else {
          result.rows.forEach((row: any) => {
            console.log(`   ${row.owner_id}: ${row.count}`);
          });
          console.log('');
        }
      } catch (error: any) {
        console.log(`📊 ${table}: ❌ ${error.message}\n`);
      }
    }

    console.log('✅ Проверка завершена');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkStatus();
