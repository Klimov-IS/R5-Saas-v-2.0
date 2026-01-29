/**
 * Check complaints data for Extension API debugging
 *
 * Usage: npx tsx scripts/check-complaints-data.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkComplaintsData() {
  console.log('🔍 Диагностика данных для Extension API\n');

  const storeId = '7kKX9WgLvOPiXYIHk6hi'; // ИП Артюшина

  try {
    // 1. Проверка магазина
    console.log('━'.repeat(80));
    console.log('1️⃣  Проверка магазина\n');

    const storeResult = await query(
      `SELECT id, name, status, owner_id, created_at, total_reviews
       FROM stores
       WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      console.log(`❌ Магазин ${storeId} не найден в базе данных!`);
      process.exit(1);
    }

    const store = storeResult.rows[0];
    console.log(`✅ Магазин найден:`);
    console.log(`   ID: ${store.id}`);
    console.log(`   Название: ${store.name}`);
    console.log(`   Статус: ${store.status}`);
    console.log(`   Owner ID: ${store.owner_id}`);
    console.log(`   Total Reviews: ${store.total_reviews || 0}`);

    // 2. Подсчет отзывов по статусам жалоб
    console.log('\n━'.repeat(80));
    console.log('2️⃣  Подсчет отзывов по статусам жалоб\n');

    const statusResult = await query(
      `SELECT
        complaint_status,
        COUNT(*) as count
       FROM reviews
       WHERE store_id = $1
       GROUP BY complaint_status
       ORDER BY count DESC`,
      [storeId]
    );

    if (statusResult.rows.length === 0) {
      console.log('❌ Нет отзывов в таблице reviews для этого магазина!');
    } else {
      console.log('Распределение по статусам жалоб:');
      statusResult.rows.forEach(row => {
        console.log(`   ${row.complaint_status || 'NULL'}: ${row.count}`);
      });
    }

    // 3. Примеры отзывов со статусом draft
    console.log('\n━'.repeat(80));
    console.log('3️⃣  Примеры отзывов со статусом "draft"\n');

    const draftResult = await query(
      `SELECT
        r.id,
        p.vendor_code as product_id,
        r.rating,
        LEFT(r.text, 50) as text_preview,
        r.author,
        r.complaint_status,
        r.date,
        r.created_at
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       WHERE r.store_id = $1
         AND r.complaint_status = 'draft'
       ORDER BY r.date DESC
       LIMIT 5`,
      [storeId]
    );

    if (draftResult.rows.length === 0) {
      console.log('❌ Нет отзывов со статусом "draft"!');

      // Проверим, есть ли хоть какие-то отзывы
      const anyReviewsResult = await query(
        `SELECT COUNT(*) as count FROM reviews WHERE store_id = $1`,
        [storeId]
      );

      const totalReviews = parseInt(anyReviewsResult.rows[0]?.count || '0', 10);
      console.log(`\n📊 Всего отзывов в магазине: ${totalReviews}`);

      if (totalReviews === 0) {
        console.log('⚠️  Магазин не имеет отзывов в базе данных!');
        console.log('💡 Необходимо запустить синхронизацию отзывов для этого магазина.');
      }
    } else {
      console.log(`✅ Найдено ${draftResult.rows.length} отзывов со статусом "draft":\n`);
      draftResult.rows.forEach((row, i) => {
        console.log(`${i + 1}. Review ID: ${row.id}`);
        console.log(`   Product: ${row.product_id || 'N/A'}`);
        console.log(`   Rating: ${row.rating} ⭐`);
        console.log(`   Text: "${row.text_preview}${row.text_preview?.length >= 50 ? '...' : ''}"`);
        console.log(`   Author: ${row.author}`);
        console.log(`   Date: ${row.date}`);
        console.log('');
      });
    }

    // 4. Проверка таблицы review_complaints
    console.log('━'.repeat(80));
    console.log('4️⃣  Проверка таблицы review_complaints\n');

    const complaintsResult = await query(
      `SELECT
        rc.id,
        rc.review_id,
        rc.reason_id,
        rc.reason_name,
        LEFT(rc.complaint_text, 50) as complaint_preview,
        rc.status,
        rc.created_at
       FROM review_complaints rc
       JOIN reviews r ON rc.review_id = r.id
       WHERE r.store_id = $1
       ORDER BY rc.created_at DESC
       LIMIT 5`,
      [storeId]
    );

    if (complaintsResult.rows.length === 0) {
      console.log('❌ Нет записей в таблице review_complaints для этого магазина!');
      console.log('💡 Жалобы не были сгенерированы AI системой.');
    } else {
      console.log(`✅ Найдено ${complaintsResult.rows.length} записей в review_complaints:\n`);
      complaintsResult.rows.forEach((row, i) => {
        console.log(`${i + 1}. Complaint ID: ${row.id}`);
        console.log(`   Review ID: ${row.review_id}`);
        console.log(`   Reason: [${row.reason_id}] ${row.reason_name}`);
        console.log(`   Text: "${row.complaint_preview}..."`);
        console.log(`   Status: ${row.status}`);
        console.log('');
      });
    }

    // 5. Статистика по всем магазинам пользователя
    console.log('━'.repeat(80));
    console.log('5️⃣  Статистика жалоб по всем магазинам пользователя\n');

    const userStatsResult = await query(
      `SELECT
        s.id as store_id,
        s.name as store_name,
        s.status as store_status,
        COUNT(r.id) as total_reviews,
        SUM(CASE WHEN r.complaint_status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN r.complaint_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN r.complaint_status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        COUNT(DISTINCT rc.id) as complaints_table_count
       FROM stores s
       LEFT JOIN reviews r ON s.id = r.store_id
       LEFT JOIN review_complaints rc ON r.id = rc.review_id
       WHERE s.owner_id = $1
       GROUP BY s.id, s.name, s.status
       HAVING COUNT(r.id) > 0
       ORDER BY draft_count DESC, total_reviews DESC
       LIMIT 10`,
      [store.owner_id]
    );

    if (userStatsResult.rows.length === 0) {
      console.log('❌ Нет магазинов с отзывами для этого пользователя!');
    } else {
      console.log(`Топ-10 магазинов с отзывами:\n`);
      userStatsResult.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.store_name}`);
        console.log(`   Store ID: ${row.store_id}`);
        console.log(`   Status: ${row.store_status}`);
        console.log(`   Total Reviews: ${row.total_reviews}`);
        console.log(`   Draft: ${row.draft_count}, Pending: ${row.pending_count}, Sent: ${row.sent_count}`);
        console.log(`   Complaints in DB: ${row.complaints_table_count}`);
        console.log('');
      });
    }

    // 6. Проверка endpoint query (симуляция)
    console.log('━'.repeat(80));
    console.log('6️⃣  Симуляция запроса endpoint /api/extension/stores/:storeId/complaints\n');

    const endpointResult = await query(
      `SELECT
        r.id,
        p.vendor_code as product_id,
        r.rating,
        r.text,
        r.author,
        r.date as created_at,
        rc.reason_id,
        rc.reason_name,
        rc.complaint_text
      FROM reviews r
      JOIN review_complaints rc ON r.id = rc.review_id
      JOIN products p ON r.product_id = p.id
      WHERE r.store_id = $1
        AND r.complaint_status = 'draft'
        AND r.rating = ANY($2)
      ORDER BY r.date DESC
      LIMIT $3`,
      [storeId, [1, 2, 3], 100]
    );

    console.log(`SQL Query для endpoint:`);
    console.log(`   Store ID: ${storeId}`);
    console.log(`   Filter: complaint_status = 'draft'`);
    console.log(`   Ratings: [1, 2, 3]`);
    console.log(`   Limit: 100`);
    console.log(`\n📊 Результат: ${endpointResult.rows.length} жалоб\n`);

    if (endpointResult.rows.length === 0) {
      console.log('❌ Endpoint вернет пустой массив!');
      console.log('\n🔍 Причины:');
      console.log('   1. Нет записей в review_complaints (JOIN не сработал)');
      console.log('   2. Отзывы имеют complaint_status != "draft"');
      console.log('   3. Рейтинги отзывов не в диапазоне [1, 2, 3]');
    } else {
      console.log(`✅ Endpoint вернет ${endpointResult.rows.length} жалоб`);
    }

    console.log('\n━'.repeat(80));
    console.log('\n✅ Диагностика завершена\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkComplaintsData();
