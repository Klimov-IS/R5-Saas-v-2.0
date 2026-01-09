/**
 * Применить миграцию базы данных
 * Usage: node scripts/apply-migration.js <migration-file.sql>
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

async function applyMigration(migrationFile) {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === 'require' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log(`📁 Читаю миграцию: ${migrationFile}`);
    const sqlPath = path.join(__dirname, '..', migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔌 Подключение к базе данных...');
    const client = await pool.connect();

    console.log('⚡ Применяю миграцию...');
    console.log('---SQL---');
    console.log(sql);
    console.log('---END---\n');

    await client.query(sql);

    console.log('✅ Миграция успешно применена!');

    // Проверяем, что индекс создан
    const checkIndex = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'user_settings'
      AND indexname = 'idx_user_settings_api_key';
    `);

    if (checkIndex.rows.length > 0) {
      console.log('✅ Индекс idx_user_settings_api_key успешно создан:');
      console.log('   ', checkIndex.rows[0].indexdef);
    } else {
      console.log('⚠️  Индекс не найден');
    }

    client.release();
    await pool.end();

  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    await pool.end();
    process.exit(1);
  }
}

// Получить путь к файлу миграции из аргументов командной строки
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Укажите файл миграции:');
  console.error('   node scripts/apply-migration.js supabase/migrations/20260106_002_add_api_key_index.sql');
  process.exit(1);
}

applyMigration(migrationFile);
