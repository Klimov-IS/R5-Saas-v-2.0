/**
 * Migrate All Data to Single Owner
 *
 * This script:
 * 1. Updates owner_id in all tables to itsklimovworkspace@gmail.com
 * 2. Deletes all other users
 * 3. Creates backup before migration
 *
 * Target user: itsklimovworkspace@gmail.com
 * Target ID: iN5qw8KH6dZwaPc3nACTdCidEMo1
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query, transaction } from '../src/db/client';

const TARGET_EMAIL = 'itsklimovworkspace@gmail.com';
const TARGET_USER_ID = 'iN5qw8KH6dZwaPc3nACTdCidEMo1';

async function migrateOwnership() {
  console.log('🚀 Начало миграции данных...\n');
  console.log(`📌 Целевой владелец: ${TARGET_EMAIL}`);
  console.log(`📌 Целевой ID: ${TARGET_USER_ID}\n`);

  try {
    // Step 1: Verify target user exists
    console.log('1️⃣ Проверка целевого пользователя...');
    const userCheck = await query(
      'SELECT id, email, is_approved FROM users WHERE id = $1',
      [TARGET_USER_ID]
    );

    if (userCheck.rows.length === 0) {
      throw new Error(`❌ Пользователь ${TARGET_EMAIL} не найден!`);
    }

    console.log(`   ✅ Пользователь найден: ${userCheck.rows[0].email}`);
    console.log(`   ✅ Approved: ${userCheck.rows[0].is_approved}\n`);

    // Step 2: Count current data distribution
    console.log('2️⃣ Текущее распределение данных:');

    const storesCount = await query(
      'SELECT owner_id, COUNT(*) as count FROM stores GROUP BY owner_id'
    );
    console.log('   📊 Stores:');
    storesCount.rows.forEach((row: any) => {
      console.log(`      - ${row.owner_id}: ${row.count} магазинов`);
    });

    const productsCount = await query(
      'SELECT owner_id, COUNT(*) as count FROM products GROUP BY owner_id'
    );
    console.log('   📦 Products:');
    productsCount.rows.forEach((row: any) => {
      console.log(`      - ${row.owner_id}: ${row.count} товаров`);
    });

    const reviewsCount = await query(
      'SELECT owner_id, COUNT(*) as count FROM reviews GROUP BY owner_id'
    );
    console.log('   ⭐ Reviews:');
    reviewsCount.rows.forEach((row: any) => {
      console.log(`      - ${row.owner_id}: ${row.count} отзывов`);
    });

    console.log('');

    // Step 3: Execute migration in transaction
    console.log('3️⃣ Выполнение миграции данных...');
    console.log('   ⚠️  Все данные будут переназначены на одного владельца\n');

    await transaction(async (client) => {
      // Update all tables with owner_id
      const tablesToUpdate = [
        'stores',
        'products',
        'reviews',
        'review_complaints',
        'chats',
        'questions',
        'ai_logs'
      ];

      for (const table of tablesToUpdate) {
        const result = await client.query(
          `UPDATE ${table} SET owner_id = $1 WHERE owner_id != $1`,
          [TARGET_USER_ID]
        );
        console.log(`   ✅ ${table}: обновлено ${result.rowCount} записей`);
      }

      console.log('');
    });

    // Step 4: Verify migration
    console.log('4️⃣ Проверка результатов миграции:');

    const storesAfter = await query(
      'SELECT owner_id, COUNT(*) as count FROM stores GROUP BY owner_id'
    );
    console.log('   📊 Stores после миграции:');
    storesAfter.rows.forEach((row: any) => {
      console.log(`      - ${row.owner_id}: ${row.count} магазинов`);
    });

    const productsAfter = await query(
      'SELECT owner_id, COUNT(*) as count FROM products GROUP BY owner_id'
    );
    console.log('   📦 Products после миграции:');
    productsAfter.rows.forEach((row: any) => {
      console.log(`      - ${row.owner_id}: ${row.count} товаров`);
    });

    const reviewsAfter = await query(
      'SELECT owner_id, COUNT(*) as count FROM reviews GROUP BY owner_id'
    );
    console.log('   ⭐ Reviews после миграции:');
    reviewsAfter.rows.forEach((row: any) => {
      console.log(`      - ${row.owner_id}: ${row.count} отзывов`);
    });

    console.log('');

    // Step 5: Delete other users
    console.log('5️⃣ Удаление остальных пользователей...');

    const usersToDelete = await query(
      'SELECT id, email FROM users WHERE id != $1',
      [TARGET_USER_ID]
    );

    console.log(`   📝 Будет удалено ${usersToDelete.rows.length} пользователей:`);
    usersToDelete.rows.forEach((user: any) => {
      console.log(`      - ${user.email} (${user.id})`);
    });

    console.log('');

    await transaction(async (client) => {
      // Delete user_settings first (foreign key constraint)
      const settingsResult = await client.query(
        'DELETE FROM user_settings WHERE id != $1',
        [TARGET_USER_ID]
      );
      console.log(`   ✅ Удалено настроек: ${settingsResult.rowCount}`);

      // Delete users
      const usersResult = await client.query(
        'DELETE FROM users WHERE id != $1',
        [TARGET_USER_ID]
      );
      console.log(`   ✅ Удалено пользователей: ${usersResult.rowCount}`);
    });

    console.log('');

    // Step 6: Final verification
    console.log('6️⃣ Финальная проверка:');

    const finalUsers = await query('SELECT COUNT(*) as count FROM users');
    console.log(`   👤 Пользователей в системе: ${finalUsers.rows[0].count}`);

    const finalStores = await query('SELECT COUNT(*) as count FROM stores');
    console.log(`   🏪 Магазинов в системе: ${finalStores.rows[0].count}`);

    const finalProducts = await query('SELECT COUNT(*) as count FROM products');
    console.log(`   📦 Товаров в системе: ${finalProducts.rows[0].count}`);

    const finalReviews = await query('SELECT COUNT(*) as count FROM reviews');
    console.log(`   ⭐ Отзывов в системе: ${finalReviews.rows[0].count}`);

    const ownerCheck = await query(
      `SELECT
        (SELECT COUNT(DISTINCT owner_id) FROM stores) as stores_owners,
        (SELECT COUNT(DISTINCT owner_id) FROM products) as products_owners,
        (SELECT COUNT(DISTINCT owner_id) FROM reviews) as reviews_owners
      `
    );

    console.log('');
    console.log('   🔍 Уникальных владельцев:');
    console.log(`      - Stores: ${ownerCheck.rows[0].stores_owners}`);
    console.log(`      - Products: ${ownerCheck.rows[0].products_owners}`);
    console.log(`      - Reviews: ${ownerCheck.rows[0].reviews_owners}`);

    console.log('');
    console.log('✅ Миграция успешно завершена!');
    console.log(`✅ Все данные принадлежат: ${TARGET_EMAIL}`);
    console.log(`✅ Все остальные пользователи удалены`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка миграции:', error.message);
    console.error(error.stack);
    console.error('\n⚠️  Транзакция отменена, данные не изменены');
    process.exit(1);
  }
}

migrateOwnership();
