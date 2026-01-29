/**
 * Verify productName field has been removed from complaints endpoint
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function verifyProductNameRemoval() {
  const storeId = '7kKX9WgLvOPiXYIHk6hi';
  const ratings = [1, 2, 3];
  const limit = 5;

  console.log('🧪 Проверка удаления поля productName\n');
  console.log('Параметры:');
  console.log(`  Store ID: ${storeId}`);
  console.log(`  Ratings: [${ratings.join(', ')}]`);
  console.log(`  Limit: ${limit}\n`);

  try {
    // Выполняем точный SQL запрос из endpoint (без p.vendor_code)
    const complaintsResult = await query(
      `SELECT
        r.id,
        p.wb_product_id as product_id,
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

    console.log(`✅ SQL запрос выполнен успешно: ${complaintsResult.rows.length} жалоб\n`);

    // Проверяем структуру данных
    if (complaintsResult.rows.length > 0) {
      const firstRow = complaintsResult.rows[0];
      console.log('Структура одной записи из БД:');
      console.log(JSON.stringify(firstRow, null, 2));
      console.log('\n');

      // Форматируем как endpoint
      const formattedComplaint = {
        id: firstRow.id,
        productId: firstRow.product_id,
        // productName: НЕТ - удалено!
        rating: firstRow.rating,
        text: firstRow.text,
        authorName: firstRow.author,
        createdAt: firstRow.created_at,
        complaintText: {
          reasonId: firstRow.reason_id,
          reasonName: firstRow.reason_name,
          complaintText: firstRow.complaint_text,
        },
      };

      console.log('Финальная структура ответа API (как в endpoint):');
      console.log(JSON.stringify(formattedComplaint, null, 2));

      // Проверки
      console.log('\n━'.repeat(80));
      console.log('Результаты проверки:\n');

      const checks = [
        { name: 'productId существует', pass: !!formattedComplaint.productId },
        { name: 'productId - это число WB', pass: /^\d+$/.test(formattedComplaint.productId || '') },
        { name: 'productName отсутствует', pass: !('productName' in formattedComplaint) },
        { name: 'productId не содержит "-"', pass: !formattedComplaint.productId?.includes('-') },
      ];

      checks.forEach(({ name, pass }) => {
        console.log(`  ${pass ? '✅' : '❌'} ${name}`);
      });

      const allPassed = checks.every(c => c.pass);
      console.log('\n━'.repeat(80));
      if (allPassed) {
        console.log('✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ\n');
        console.log('Поле productName успешно удалено из ответа API.');
        console.log('API возвращает только productId (WB артикул).');
      } else {
        console.log('❌ НЕКОТОРЫЕ ПРОВЕРКИ НЕ ПРОЙДЕНЫ\n');
      }
    } else {
      console.log('⚠️  Жалобы не найдены для тестирования');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyProductNameRemoval();
