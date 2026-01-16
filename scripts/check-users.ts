/**
 * Check Users in Database
 *
 * This script checks:
 * 1. Total number of users
 * 2. List of all users with their emails
 * 3. Whether itsklimovworkspace@gmail.com exists
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkUsers() {
  try {
    console.log('🔍 Проверка пользователей в базе данных...\n');

    // 1. Count total users
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM users'
    );
    const totalUsers = parseInt(countResult.rows[0].count);
    console.log(`📊 Всего пользователей в системе: ${totalUsers}\n`);

    // 2. Get all users
    const usersResult = await query<{ id: string; email: string; is_approved: boolean }>(
      'SELECT id, email, is_approved FROM users ORDER BY email'
    );

    console.log('👥 Список пользователей:');
    usersResult.rows.forEach((user, idx) => {
      const approvedMark = user.is_approved ? '✅' : '❌';
      console.log(`  ${idx + 1}. ${user.email}`);
      console.log(`     ID: ${user.id}`);
      console.log(`     Approved: ${approvedMark} ${user.is_approved}`);
      console.log('');
    });

    // 3. Check for specific email
    const targetEmail = 'itsklimovworkspace@gmail.com';
    const yourEmailResult = await query<{ id: string; email: string; is_approved: boolean }>(
      'SELECT id, email, is_approved FROM users WHERE email = $1',
      [targetEmail]
    );

    console.log(`\n🔎 Поиск почты: ${targetEmail}`);
    if (yourEmailResult.rows.length > 0) {
      const user = yourEmailResult.rows[0];
      console.log('✅ Почта найдена в системе!');
      console.log(`   ID: ${user.id}`);
      console.log(`   Approved: ${user.is_approved}`);

      // Count stores for this user
      const storesResult = await query<{ count: string }>(
        'SELECT COUNT(*) FROM stores WHERE owner_id = $1',
        [user.id]
      );
      console.log(`   Магазинов: ${storesResult.rows[0].count}`);
    } else {
      console.log('❌ Почта НЕ найдена в системе');
      console.log('   Необходимо создать нового пользователя');
    }

    // 4. Show current store ownership distribution
    console.log('\n\n📊 Распределение магазинов по владельцам:');
    const ownershipResult = await query<{
      owner_id: string;
      email: string;
      store_count: string
    }>(
      `SELECT
         u.id as owner_id,
         u.email,
         COUNT(s.id) as store_count
       FROM users u
       LEFT JOIN stores s ON u.id = s.owner_id
       GROUP BY u.id, u.email
       ORDER BY store_count DESC`
    );

    ownershipResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.email}: ${row.store_count} магазинов`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkUsers();
