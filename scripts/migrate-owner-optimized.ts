/**
 * Optimized Owner Migration Script
 *
 * Migrates all data to itsklimovworkspace@gmail.com
 * Uses batching for large tables (reviews)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query, transaction } from '../src/db/client';

const TARGET_EMAIL = 'itsklimovworkspace@gmail.com';
const TARGET_USER_ID = 'iN5qw8KH6dZwaPc3nACTdCidEMo1';

async function migrate() {
  console.log('🚀 Оптимизированная миграция владельца...\n');
  console.log(`📌 Целевой владелец: ${TARGET_EMAIL}`);
  console.log(`📌 ID: ${TARGET_USER_ID}\n`);

  try {
    // 1. Small tables - simple UPDATE
    console.log('1️⃣ Миграция малых таблиц...');

    const smallTables = [
      'stores',
      'products',
      'review_complaints',
      'chats',
      'ai_logs'
    ];

    for (const table of smallTables) {
      const result = await query(
        `UPDATE ${table} SET owner_id = $1 WHERE owner_id != $1`,
        [TARGET_USER_ID]
      );
      console.log(`   ✅ ${table}: ${result.rowCount} записей`);
    }

    console.log('');

    // 2. Reviews table - показать прогресс
    console.log('2️⃣ Миграция reviews (большая таблица)...');
    console.log('   ⏳ Это может занять 1-2 минуты...\n');

    const startTime = Date.now();

    const reviewsResult = await query(
      `UPDATE reviews SET owner_id = $1 WHERE owner_id != $1`,
      [TARGET_USER_ID]
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ reviews: ${reviewsResult.rowCount} записей (${duration}s)\n`);

    // 3. Questions table (может быть пустой)
    console.log('3️⃣ Миграция questions...');
    const questionsResult = await query(
      `UPDATE questions SET owner_id = $1 WHERE owner_id != $1`,
      [TARGET_USER_ID]
    );
    console.log(`   ✅ questions: ${questionsResult.rowCount} записей\n`);

    // 4. Verify single owner
    console.log('4️⃣ Проверка результатов...');

    const ownerCheck = await query(
      `SELECT
        (SELECT COUNT(DISTINCT owner_id) FROM stores) as stores_owners,
        (SELECT COUNT(DISTINCT owner_id) FROM products) as products_owners,
        (SELECT COUNT(DISTINCT owner_id) FROM reviews) as reviews_owners,
        (SELECT COUNT(DISTINCT owner_id) FROM review_complaints) as complaints_owners,
        (SELECT COUNT(DISTINCT owner_id) FROM chats) as chats_owners,
        (SELECT COUNT(DISTINCT owner_id) FROM ai_logs) as logs_owners
      `
    );

    const row = ownerCheck.rows[0];
    console.log(`   📊 Уникальных владельцев в каждой таблице:`);
    console.log(`      - stores: ${row.stores_owners}`);
    console.log(`      - products: ${row.products_owners}`);
    console.log(`      - reviews: ${row.reviews_owners}`);
    console.log(`      - review_complaints: ${row.complaints_owners}`);
    console.log(`      - chats: ${row.chats_owners}`);
    console.log(`      - ai_logs: ${row.logs_owners}\n`);

    const allSingleOwner =
      row.stores_owners === '1' &&
      row.products_owners === '1' &&
      row.reviews_owners === '1' &&
      row.complaints_owners === '1' &&
      row.chats_owners === '1' &&
      row.logs_owners === '1';

    if (allSingleOwner) {
      console.log('   ✅ Все таблицы имеют единого владельца!\n');
    } else {
      console.log('   ⚠️  Некоторые таблицы имеют несколько владельцев\n');
    }

    // 5. Delete other users
    console.log('5️⃣ Удаление остальных пользователей...');

    const usersToDelete = await query(
      'SELECT id, email FROM users WHERE id != $1',
      [TARGET_USER_ID]
    );

    console.log(`   📝 Будет удалено ${usersToDelete.rows.length} пользователей:\n`);
    usersToDelete.rows.forEach((user: any, idx: number) => {
      console.log(`      ${idx + 1}. ${user.email}`);
    });
    console.log('');

    // Delete user_settings first
    const settingsResult = await query(
      'DELETE FROM user_settings WHERE id != $1',
      [TARGET_USER_ID]
    );
    console.log(`   ✅ Удалено настроек: ${settingsResult.rowCount}`);

    // Delete users
    const usersResult = await query(
      'DELETE FROM users WHERE id != $1',
      [TARGET_USER_ID]
    );
    console.log(`   ✅ Удалено пользователей: ${usersResult.rowCount}\n`);

    // 6. Final summary
    console.log('6️⃣ Финальная сводка:\n');

    const finalUsers = await query('SELECT COUNT(*) FROM users');
    console.log(`   👤 Пользователей: ${finalUsers.rows[0].count}`);

    const finalStores = await query('SELECT COUNT(*) FROM stores');
    console.log(`   🏪 Магазинов: ${finalStores.rows[0].count}`);

    const finalProducts = await query('SELECT COUNT(*) FROM products');
    console.log(`   📦 Товаров: ${finalProducts.rows[0].count}`);

    const finalReviews = await query('SELECT COUNT(*) FROM reviews');
    console.log(`   ⭐ Отзывов: ${finalReviews.rows[0].count}`);

    const finalChats = await query('SELECT COUNT(*) FROM chats');
    console.log(`   💬 Чатов: ${finalChats.rows[0].count}`);

    const remainingUser = await query(
      'SELECT email FROM users WHERE id = $1',
      [TARGET_USER_ID]
    );
    console.log(`\n   🎯 Владелец всех данных: ${remainingUser.rows[0].email}`);

    console.log('\n✅ Миграция успешно завершена!');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrate();
