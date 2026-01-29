import { Pool } from 'pg';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: {
    rejectUnauthorized: false // Required for Yandex Cloud self-signed certs
  },
});

async function analyzeResolvedChats() {
  try {
    console.log('🔍 Анализ чатов для автоматического закрытия...\n');

    // 1. Чаты с "Видим что отзыв был удален"
    const deletedReviewsQuery = `
      SELECT
        c.id,
        c.store_id,
        c.status,
        c.client_name,
        c.last_message_text,
        c.last_message_sender,
        c.created_at
      FROM chats c
      WHERE
        c.last_message_text ILIKE '%Видим что отзыв был удален%'
      ORDER BY c.created_at DESC
    `;

    const deletedReviews = await pool.query(deletedReviewsQuery);

    console.log('📊 СТАТИСТИКА: Чаты с "Видим что отзыв был удален"');
    console.log('=' .repeat(80));
    console.log(`Всего найдено чатов: ${deletedReviews.rows.length}`);

    // Группировка по статусам
    const deletedByStatus = deletedReviews.rows.reduce((acc: any, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\nРаспределение по статусам:');
    Object.entries(deletedByStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} чатов`);
    });

    // Группировка по магазинам
    const deletedByStore = deletedReviews.rows.reduce((acc: any, row: any) => {
      acc[row.store_id] = (acc[row.store_id] || 0) + 1;
      return acc;
    }, {});

    console.log('\nРаспределение по магазинам:');
    for (const [storeId, count] of Object.entries(deletedByStore)) {
      const storeInfo = await pool.query('SELECT name FROM stores WHERE id = $1', [storeId]);
      const storeName = storeInfo.rows[0]?.name || 'Unknown';
      console.log(`  ${storeName} (${storeId}): ${count} чатов`);
    }

    // Примеры чатов
    console.log('\n📋 Примеры чатов (первые 5):');
    deletedReviews.rows.slice(0, 5).forEach((chat: any, index: number) => {
      console.log(`\n${index + 1}. Chat ID: ${chat.id}`);
      console.log(`   Статус: ${chat.status}`);
      console.log(`   Клиент: ${chat.client_name}`);
      console.log(`   Последнее сообщение: ${chat.last_message_text?.substring(0, 100)}...`);
      console.log(`   Отправитель: ${chat.last_message_sender}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n');

    // 2. Чаты с "Видим что отзыв был дополнен"
    const updatedReviewsQuery = `
      SELECT
        c.id,
        c.store_id,
        c.status,
        c.client_name,
        c.last_message_text,
        c.last_message_sender,
        c.created_at
      FROM chats c
      WHERE
        c.last_message_text ILIKE '%Видим что отзыв был дополнен%'
      ORDER BY c.created_at DESC
    `;

    const updatedReviews = await pool.query(updatedReviewsQuery);

    console.log('📊 СТАТИСТИКА: Чаты с "Видим что отзыв был дополнен"');
    console.log('='.repeat(80));
    console.log(`Всего найдено чатов: ${updatedReviews.rows.length}`);

    // Группировка по статусам
    const updatedByStatus = updatedReviews.rows.reduce((acc: any, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\nРаспределение по статусам:');
    Object.entries(updatedByStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} чатов`);
    });

    // Группировка по магазинам
    const updatedByStore = updatedReviews.rows.reduce((acc: any, row: any) => {
      acc[row.store_id] = (acc[row.store_id] || 0) + 1;
      return acc;
    }, {});

    console.log('\nРаспределение по магазинам:');
    for (const [storeId, count] of Object.entries(updatedByStore)) {
      const storeInfo = await pool.query('SELECT name FROM stores WHERE id = $1', [storeId]);
      const storeName = storeInfo.rows[0]?.name || 'Unknown';
      console.log(`  ${storeName} (${storeId}): ${count} чатов`);
    }

    // Примеры чатов
    console.log('\n📋 Примеры чатов (первые 5):');
    updatedReviews.rows.slice(0, 5).forEach((chat: any, index: number) => {
      console.log(`\n${index + 1}. Chat ID: ${chat.id}`);
      console.log(`   Статус: ${chat.status}`);
      console.log(`   Клиент: ${chat.client_name}`);
      console.log(`   Последнее сообщение: ${chat.last_message_text?.substring(0, 100)}...`);
      console.log(`   Отправитель: ${chat.last_message_sender}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n');

    // 3. ОБЩАЯ СТАТИСТИКА
    const totalToUpdate = deletedReviews.rows.length + updatedReviews.rows.length;
    const deletedNonResolved = deletedReviews.rows.filter((r: any) => r.status !== 'resolved').length;
    const updatedNonResolved = updatedReviews.rows.filter((r: any) => r.status !== 'resolved').length;
    const totalNonResolved = deletedNonResolved + updatedNonResolved;

    console.log('📈 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(80));
    console.log(`Всего чатов для обработки: ${totalToUpdate}`);
    console.log(`  - С "отзыв был удален": ${deletedReviews.rows.length} (${deletedNonResolved} не в статусе "resolved")`);
    console.log(`  - С "отзыв был дополнен": ${updatedReviews.rows.length} (${updatedNonResolved} не в статусе "resolved")`);
    console.log(`\n❗ Будет обновлено статусов: ${totalNonResolved} чатов`);
    console.log(`✅ Уже в статусе "resolved": ${totalToUpdate - totalNonResolved} чатов (не будут затронуты)`);
    console.log('='.repeat(80));

    // 4. Проверка наличия дополнительных сообщений после этих фраз
    console.log('\n🔍 Проверка: есть ли еще сообщения после "удален/дополнен"?');
    console.log('(Проверяем, действительно ли last_message_text - это последнее сообщение)');

    const sampleChatsToCheck = [...deletedReviews.rows.slice(0, 3), ...updatedReviews.rows.slice(0, 3)];

    for (const chat of sampleChatsToCheck) {
      const messages = await pool.query(
        'SELECT text, sender, created_at FROM chat_messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 3',
        [chat.id]
      );

      console.log(`\nChat ID: ${chat.id} (${chat.status})`);
      console.log(`Последние 3 сообщения:`);
      messages.rows.forEach((msg: any, idx: number) => {
        console.log(`  ${idx + 1}. [${msg.sender}] ${msg.text?.substring(0, 80)}...`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка при анализе:', error);
  } finally {
    await pool.end();
  }
}

analyzeResolvedChats();
