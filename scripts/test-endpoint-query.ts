/**
 * Test exact query used by endpoint
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function testEndpointQuery() {
  const storeId = '7kKX9WgLvOPiXYIHk6hi';
  const ratings = [1, 2, 3];
  const limit = 100;

  console.log('🧪 Тестирование точного SQL запроса из endpoint\n');
  console.log('Параметры:');
  console.log(`  Store ID: ${storeId}`);
  console.log(`  Ratings: [${ratings.join(', ')}]`);
  console.log(`  Limit: ${limit}\n`);

  try {
    // 1. Проверка магазина
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
      [storeId]
    );

    if (!storeResult.rows[0]) {
      console.log('❌ Магазин не найден!');
      process.exit(1);
    }

    console.log(`✅ Магазин найден: ${storeResult.rows[0].id}`);
    console.log(`   Owner ID: ${storeResult.rows[0].owner_id}\n`);

    // 2. Точный запрос из endpoint
    console.log('━'.repeat(80));
    console.log('Выполняем точный SQL запрос из endpoint:\n');

    const complaintsResult = await query(
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
        AND rc.status = 'draft'
        AND r.rating = ANY($2)
      ORDER BY r.date DESC
      LIMIT $3`,
      [storeId, ratings, limit]
    );

    console.log(`\n✅ Результат: ${complaintsResult.rows.length} жалоб\n`);

    if (complaintsResult.rows.length > 0) {
      console.log('Первые 5 жалоб:');
      complaintsResult.rows.slice(0, 5).forEach((row, i) => {
        console.log(`\n${i + 1}. Review ID: ${row.id}`);
        console.log(`   Product: ${row.product_id || 'N/A'}`);
        console.log(`   Rating: ${row.rating} ⭐`);
        console.log(`   Text: "${row.text?.substring(0, 50)}..."`);
        console.log(`   Author: ${row.author}`);
        console.log(`   Reason: [${row.reason_id}] ${row.reason_name}`);
      });
    } else {
      console.log('❌ Жалобы не найдены!');

      // Диагностика
      console.log('\n━'.repeat(80));
      console.log('🔍 Диагностика:\n');

      // Проверка 1: Есть ли жалобы без фильтра по статусу
      const allComplaintsResult = await query(
        `SELECT COUNT(*) as count
         FROM reviews r
         JOIN review_complaints rc ON r.id = rc.review_id
         WHERE r.store_id = $1`,
        [storeId]
      );
      console.log(`1. Всего жалоб в review_complaints (любой статус): ${allComplaintsResult.rows[0].count}`);

      // Проверка 2: Есть ли жалобы со статусом draft
      const draftComplaintsResult = await query(
        `SELECT COUNT(*) as count
         FROM reviews r
         JOIN review_complaints rc ON r.id = rc.review_id
         WHERE r.store_id = $1 AND rc.status = 'draft'`,
        [storeId]
      );
      console.log(`2. Жалоб со статусом 'draft': ${draftComplaintsResult.rows[0].count}`);

      // Проверка 3: Есть ли продукты
      const productsJoinResult = await query(
        `SELECT COUNT(*) as count
         FROM reviews r
         JOIN review_complaints rc ON r.id = rc.review_id
         JOIN products p ON r.product_id = p.id
         WHERE r.store_id = $1 AND rc.status = 'draft'`,
        [storeId]
      );
      console.log(`3. Жалоб после JOIN с products: ${productsJoinResult.rows[0].count}`);

      // Проверка 4: С фильтром по рейтингу
      const ratingFilterResult = await query(
        `SELECT COUNT(*) as count
         FROM reviews r
         JOIN review_complaints rc ON r.id = rc.review_id
         JOIN products p ON r.product_id = p.id
         WHERE r.store_id = $1
           AND rc.status = 'draft'
           AND r.rating = ANY($2)`,
        [storeId, ratings]
      );
      console.log(`4. Жалоб с рейтингом [1,2,3]: ${ratingFilterResult.rows[0].count}`);

      // Проверка 5: Проверим отдельные жалобы
      const sampleResult = await query(
        `SELECT
          r.id as review_id,
          r.product_id,
          r.rating,
          p.id as product_exists,
          p.vendor_code
         FROM reviews r
         JOIN review_complaints rc ON r.id = rc.review_id
         LEFT JOIN products p ON r.product_id = p.id
         WHERE r.store_id = $1 AND rc.status = 'draft'
         LIMIT 5`,
        [storeId]
      );

      console.log(`\n5. Примеры жалоб (проверка JOIN products):`);
      sampleResult.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. Review: ${row.review_id}, Product ID: ${row.product_id}, Product Exists: ${row.product_exists ? 'YES' : 'NO'}, Vendor Code: ${row.vendor_code || 'NULL'}`);
      });
    }

    console.log('\n━'.repeat(80));
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testEndpointQuery();
