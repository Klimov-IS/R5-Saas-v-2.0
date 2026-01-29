import { Pool } from 'pg';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

config({ path: join(process.cwd(), '.env.local') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
});

async function applyMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Применение миграции: закрытие решенных чатов\n');
    console.log('=' .repeat(80));

    // Начинаем транзакцию
    await client.query('BEGIN');

    // STEP 1: Обновляем чаты с "Видим что отзыв был удален"
    console.log('\n📝 Шаг 1: Обновление чатов с "Видим что отзыв был удален"...');

    const result1 = await client.query(`
      UPDATE chats
      SET
        status = 'resolved',
        updated_at = NOW()
      WHERE
        last_message_text ILIKE '%Видим что отзыв был удален%'
        AND status != 'resolved'
    `);

    console.log(`✅ Обновлено чатов: ${result1.rowCount}`);

    // STEP 2: Обновляем чаты с "Видим что отзыв был дополнен"
    console.log('\n📝 Шаг 2: Обновление чатов с "Видим что отзыв был дополнен"...');

    const result2 = await client.query(`
      UPDATE chats
      SET
        status = 'resolved',
        updated_at = NOW()
      WHERE
        last_message_text ILIKE '%Видим что отзыв был дополнен%'
        AND status != 'resolved'
    `);

    console.log(`✅ Обновлено чатов: ${result2.rowCount}`);

    // Подтверждаем транзакцию
    await client.query('COMMIT');

    console.log('\n' + '='.repeat(80));
    console.log(`\n🎉 МИГРАЦИЯ УСПЕШНО ПРИМЕНЕНА!`);
    console.log(`\nВсего обновлено чатов: ${result1.rowCount + result2.rowCount}`);
    console.log('=' .repeat(80));

    // Verification: проверяем результаты
    console.log('\n📊 ПРОВЕРКА РЕЗУЛЬТАТОВ:\n');

    const verification = await client.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM chats
      WHERE
        last_message_text ILIKE '%Видим что отзыв был удален%'
        OR last_message_text ILIKE '%Видим что отзыв был дополнен%'
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('Распределение по статусам после миграции:');
    verification.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count} чатов`);
    });

    const totalResolved = await client.query(`
      SELECT COUNT(*) as count
      FROM chats
      WHERE
        (last_message_text ILIKE '%Видим что отзыв был удален%'
         OR last_message_text ILIKE '%Видим что отзыв был дополнен%')
        AND status = 'resolved'
    `);

    console.log(`\n✅ Всего чатов в статусе "resolved": ${totalResolved.rows[0].count}`);
    console.log('=' .repeat(80));

  } catch (error) {
    // В случае ошибки откатываем транзакцию
    await client.query('ROLLBACK');
    console.error('\n❌ ОШИБКА ПРИ ПРИМЕНЕНИИ МИГРАЦИИ:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
