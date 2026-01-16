/**
 * Generate API Token for User
 *
 * Creates user_settings record and generates API token
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';
import { randomBytes } from 'crypto';

const USER_EMAIL = 'itsklimovworkspace@gmail.com';
const USER_ID = 'iN5qw8KH6dZwaPc3nACTdCidEMo1';

function generateApiToken(): string {
  const randomPart = randomBytes(16).toString('hex'); // 32 hex chars
  return `wbrm_${randomPart}`;
}

async function createUserSettings() {
  try {
    console.log('🔑 Генерация API токена...\n');

    // 1. Check if user_settings exists
    const existingSettings = await query(
      'SELECT id, api_key FROM user_settings WHERE id = $1',
      [USER_ID]
    );

    if (existingSettings.rows.length > 0) {
      const existing = existingSettings.rows[0];
      console.log('ℹ️  Настройки уже существуют');
      console.log(`   API Key: ${existing.api_key || '(не установлен)'}\n`);

      if (existing.api_key) {
        console.log('⚠️  У пользователя уже есть API токен');
        console.log('   Хотите перегенерировать? (скрипт остановлен)\n');
        process.exit(0);
      }
    }

    // 2. Generate new token
    const newToken = generateApiToken();
    console.log(`📧 Email: ${USER_EMAIL}`);
    console.log(`🆔 User ID: ${USER_ID}`);
    console.log(`🔑 Новый API Token: ${newToken}\n`);

    // 3. Insert or update user_settings
    if (existingSettings.rows.length === 0) {
      // Insert new record
      console.log('➕ Создание новой записи user_settings...');
      await query(
        `INSERT INTO user_settings (
          id,
          api_key,
          ai_concurrency,
          deepseek_api_key,
          openai_api_key
        ) VALUES ($1, $2, $3, $4, $5)`,
        [USER_ID, newToken, 5, null, null]
      );
      console.log('   ✅ Запись создана\n');
    } else {
      // Update existing record
      console.log('🔄 Обновление существующей записи...');
      await query(
        'UPDATE user_settings SET api_key = $1 WHERE id = $2',
        [newToken, USER_ID]
      );
      console.log('   ✅ Запись обновлена\n');
    }

    // 4. Verify token works
    console.log('🧪 Проверка токена...');
    const verifyResult = await query(
      `SELECT u.id, u.email
       FROM users u
       JOIN user_settings us ON u.id = us.id
       WHERE us.api_key = $1`,
      [newToken]
    );

    if (verifyResult.rows.length > 0) {
      console.log(`   ✅ Токен валиден для: ${verifyResult.rows[0].email}\n`);
    } else {
      console.log('   ❌ Токен НЕ работает!\n');
      process.exit(1);
    }

    // 5. Show usage instructions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ API токен успешно создан!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Как использовать:\n');
    console.log('1️⃣  В продакшн .env файле:');
    console.log(`   NEXT_PUBLIC_API_TOKEN=${newToken}\n`);
    console.log('2️⃣  В Chrome Extension (service-page.html):');
    console.log(`   API Token: ${newToken}\n`);
    console.log('3️⃣  В HTTP заголовках:');
    console.log(`   Authorization: Bearer ${newToken}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createUserSettings();
