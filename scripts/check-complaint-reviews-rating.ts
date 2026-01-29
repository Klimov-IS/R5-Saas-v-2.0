/**
 * Check ratings of reviews that have complaints
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkRatings() {
  const storeId = '7kKX9WgLvOPiXYIHk6hi';

  console.log('🔍 Проверка рейтингов отзывов с жалобами\n');

  try {
    const result = await query(
      `SELECT
        r.id,
        r.rating,
        r.text,
        r.author,
        rc.status as complaint_status,
        rc.reason_name
       FROM reviews r
       JOIN review_complaints rc ON r.id = rc.review_id
       WHERE r.store_id = $1
         AND rc.status = 'draft'
       LIMIT 10`,
      [storeId]
    );

    console.log(`Найдено ${result.rows.length} отзывов с жалобами:\n`);

    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. Review ID: ${row.id}`);
      console.log(`   Rating: ${row.rating} ⭐`);
      console.log(`   Text: "${row.text?.substring(0, 50)}..."`);
      console.log(`   Author: ${row.author}`);
      console.log(`   Complaint Status: ${row.complaint_status}`);
      console.log(`   Reason: ${row.reason_name}`);
      console.log('');
    });

    // Статистика по рейтингам
    const statsResult = await query(
      `SELECT
        r.rating,
        COUNT(*) as count
       FROM reviews r
       JOIN review_complaints rc ON r.id = rc.review_id
       WHERE r.store_id = $1
         AND rc.status = 'draft'
       GROUP BY r.rating
       ORDER BY r.rating`,
      [storeId]
    );

    console.log('📊 Распределение по рейтингам:');
    statsResult.rows.forEach(row => {
      console.log(`   ${row.rating} ⭐: ${row.count} жалоб`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkRatings();
