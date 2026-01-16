/**
 * Check what user had the old hardcoded token
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkOldToken() {
  try {
    const oldToken = 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

    console.log(`🔍 Проверка старого токена: ${oldToken}\n`);

    // Try to find user with this token
    const result = await query(
      `SELECT u.id, u.email
       FROM users u
       JOIN user_settings us ON u.id = us.id
       WHERE us.api_key = $1`,
      [oldToken]
    );

    if (result.rows.length > 0) {
      console.log('✅ Пользователь с этим токеном найден:');
      console.log(`   Email: ${result.rows[0].email}`);
      console.log(`   ID: ${result.rows[0].id}`);
    } else {
      console.log('❌ Пользователь с этим токеном НЕ найден');
      console.log('   (токен был у удалённого пользователя)');
    }

    // Show current user token
    console.log('\n📌 Текущий пользователь:');
    const current = await query(
      `SELECT u.email, us.api_key
       FROM users u
       JOIN user_settings us ON u.id = us.id
       WHERE u.email = $1`,
      ['itsklimovworkspace@gmail.com']
    );

    if (current.rows.length > 0) {
      console.log(`   Email: ${current.rows[0].email}`);
      console.log(`   Token: ${current.rows[0].api_key}`);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkOldToken();
