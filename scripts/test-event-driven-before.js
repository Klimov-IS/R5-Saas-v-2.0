require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log('\n=== ТЕСТ EVENT-DRIVEN: Статистика ДО обновления ===');
    console.log(`Магазин: ООО "Тайди центр"\n`);

    // Get store info
    const storeResult = await pool.query(`
      SELECT id, name, last_review_update_date, total_reviews
      FROM stores
      WHERE name ILIKE '%Тайди%'
      LIMIT 1
    `);

    if (storeResult.rows.length === 0) {
      console.log('❌ Магазин не найден!');
      process.exit(1);
    }

    const store = storeResult.rows[0];
    console.log(`Store ID: ${store.id}`);
    console.log(`Название: ${store.name}`);
    console.log(`Последнее обновление: ${store.last_review_update_date || 'N/A'}`);
    console.log(`Всего отзывов в БД: ${store.total_reviews}\n`);

    // Total reviews statistics
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN rating BETWEEN 1 AND 4 THEN 1 END) as negative_reviews,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as positive_reviews
      FROM reviews
      WHERE store_id = $1
    `, [store.id]);

    const stats = statsResult.rows[0];
    console.log('📊 Статистика отзывов:');
    console.log(`   Всего отзывов: ${stats.total_reviews}`);
    console.log(`   Негативные (1-4★): ${stats.negative_reviews}`);
    console.log(`   Позитивные (5★): ${stats.positive_reviews}\n`);

    // Complaints statistics
    const complaintsResult = await pool.query(`
      SELECT
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN ai_cost_usd > 0 THEN 1 END) as ai_generated,
        COUNT(CASE WHEN ai_cost_usd = 0 THEN 1 END) as template_based,
        MAX(created_at) as last_complaint_created
      FROM review_complaints
      WHERE store_id = $1
    `, [store.id]);

    const complaints = complaintsResult.rows[0];
    console.log('📝 Статистика жалоб:');
    console.log(`   Всего жалоб: ${complaints.total_complaints}`);
    console.log(`   AI-generated: ${complaints.ai_generated}`);
    console.log(`   Template-based: ${complaints.template_based}`);
    console.log(`   Последняя жалоба: ${complaints.last_complaint_created || 'N/A'}\n`);

    // Reviews without complaints (rating 1-4)
    const backlogResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM reviews r
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.store_id = $1
        AND r.rating BETWEEN 1 AND 4
        AND rc.id IS NULL
    `, [store.id]);

    const backlog = backlogResult.rows[0];
    console.log('⚠️  Backlog (отзывы без жалоб):');
    console.log(`   Негативных отзывов без жалоб: ${backlog.count}\n`);

    // Last 5 reviews (use index on date instead of created_at)
    const recentReviews = await pool.query(`
      SELECT
        r.id,
        r.rating,
        r.date as review_date,
        LEFT(r.text, 50) as text_preview,
        r.created_at as added_to_db,
        EXISTS(SELECT 1 FROM review_complaints WHERE review_id = r.id) as has_complaint
      FROM reviews r
      WHERE r.store_id = $1
      ORDER BY r.date DESC
      LIMIT 5
    `, [store.id]);

    console.log('🕒 Последние 5 отзывов в БД:');
    recentReviews.rows.forEach((r, i) => {
      console.log(`${i + 1}. ID: ${r.id} | ${r.rating}★ | ${r.review_date}`);
      console.log(`   Текст: ${r.text_preview || '(empty)'}...`);
      console.log(`   Добавлен в БД: ${r.added_to_db}`);
      console.log(`   Жалоба: ${r.has_complaint ? '✅ Есть' : '❌ Нет'}`);
    });

    console.log('\n=== Готов к тесту! ===');
    console.log('Теперь обновите магазин на продакшене и запустите test-event-driven-after.js');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
