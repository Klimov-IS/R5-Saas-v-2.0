/**
 * Check API Token Status
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkToken() {
  try {
    console.log('🔍 Проверка API токена...\n');

    // Check user settings
    const result = await query(
      `SELECT us.id, us.api_key, u.email
       FROM user_settings us
       JOIN users u ON us.id = u.id
       WHERE u.email = $1`,
      ['itsklimovworkspace@gmail.com']
    );

    if (result.rows.length === 0) {
      console.log('❌ Настройки пользователя не найдены!');
      console.log('   Необходимо создать user_settings запись\n');

      // Check if user exists
      const userCheck = await query(
        'SELECT id, email FROM users WHERE email = $1',
        ['itsklimovworkspace@gmail.com']
      );

      if (userCheck.rows.length > 0) {
        console.log(`✅ Пользователь существует: ${userCheck.rows[0].id}`);
      }

      process.exit(1);
    }

    const settings = result.rows[0];
    console.log(`📧 Email: ${settings.email}`);
    console.log(`🆔 User ID: ${settings.id}`);
    console.log(`🔑 API Key: ${settings.api_key || '(не установлен)'}\n`);

    if (settings.api_key) {
      console.log('✅ API токен найден!');

      // Test token
      const testResult = await query(
        `SELECT u.id, u.email
         FROM users u
         JOIN user_settings us ON u.id = us.id
         WHERE us.api_key = $1`,
        [settings.api_key]
      );

      if (testResult.rows.length > 0) {
        console.log(`✅ Токен валиден для: ${testResult.rows[0].email}`);
      } else {
        console.log('❌ Токен не работает!');
      }
    } else {
      console.log('⚠️  API токен НЕ установлен');
      console.log('   Необходимо сгенерировать новый токен');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkToken();
