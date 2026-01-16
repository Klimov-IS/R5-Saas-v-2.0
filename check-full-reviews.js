const { Pool } = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: 'MyNewPass123',
  ssl: { rejectUnauthorized: false }
});

async function checkFullReviews() {
  try {
    // Проверяем 3 отзыва которые только что синхронизировали
    const reviewIds = [
      'G9qah3wx5ttL9Fzt1eXX',
      'nQLIlHZNs1zQ5G2j7uPI',
      'v1kCTJQZpu9K6BHhpmcX'
    ];

    console.log('📄 Full database records for synced reviews:\n');
    console.log('═'.repeat(100));

    for (const reviewId of reviewIds) {
      const result = await pool.query(`
        SELECT *
        FROM reviews
        WHERE id = $1
      `, [reviewId]);

      if (result.rows.length === 0) {
        console.log(`❌ Review ${reviewId} NOT FOUND in database!\n`);
        continue;
      }

      const review = result.rows[0];
      console.log(`\n📝 REVIEW ID: ${review.id}`);
      console.log('─'.repeat(100));

      // Идентификация
      console.log('\n🔑 IDENTIFICATION:');
      console.log(`   store_id: ${review.store_id}`);
      console.log(`   product_id: ${review.product_id}`);
      console.log(`   id: ${review.id}`);

      // Основные данные
      console.log('\n📊 BASIC DATA:');
      console.log(`   rating: ${review.rating}`);
      console.log(`   author: ${review.author || 'NULL'}`);
      console.log(`   text: ${review.text ? review.text.substring(0, 100) + '...' : 'NULL'}`);
      console.log(`   answer: ${review.answer ? review.answer.substring(0, 100) + '...' : 'NULL'}`);

      // Статусы (ВАЖНО!)
      console.log('\n⚡ STATUSES (CONVERTED FROM RUSSIAN):');
      console.log(`   review_status_wb: ${review.review_status_wb} ${review.review_status_wb === 'visible' ? '✅' : review.review_status_wb === 'unknown' ? '❌' : '⚠️'}`);
      console.log(`   product_status_by_review: ${review.product_status_by_review} ${review.product_status_by_review === 'not_specified' ? '✅' : review.product_status_by_review === 'unknown' ? '❌' : '⚠️'}`);
      console.log(`   chat_status_by_review: ${review.chat_status_by_review} ${review.chat_status_by_review === 'unavailable' ? '✅' : review.chat_status_by_review === 'unknown' ? '❌' : '⚠️'}`);
      console.log(`   complaint_status: ${review.complaint_status}`);

      // Дополнительные флаги
      console.log('\n🏷️ FLAGS:');
      console.log(`   is_visible: ${review.is_visible}`);
      console.log(`   is_purchased: ${review.is_purchased}`);
      console.log(`   is_refused: ${review.is_refused}`);
      console.log(`   is_return: ${review.is_return}`);
      console.log(`   has_answer: ${review.has_answer}`);

      // Даты
      console.log('\n📅 TIMESTAMPS:');
      console.log(`   created_at: ${new Date(review.created_at).toISOString()}`);
      console.log(`   updated_at: ${new Date(review.updated_at).toISOString()}`);
      console.log(`   review_date: ${review.review_date ? new Date(review.review_date).toISOString() : 'NULL'}`);
      console.log(`   parsed_at: ${review.parsed_at ? new Date(review.parsed_at).toISOString() : 'NULL'}`);

      // Дополнительно
      console.log('\n📦 ADDITIONAL:');
      console.log(`   wb_article: ${review.wb_article || 'NULL'}`);
      console.log(`   sku: ${review.sku || 'NULL'}`);
      console.log(`   seller_article: ${review.seller_article || 'NULL'}`);
      console.log(`   page_number: ${review.page_number || 'NULL'}`);
      console.log(`   photo_links: ${review.photo_links ? JSON.stringify(review.photo_links) : 'NULL'}`);
      console.log(`   video_link: ${review.video_link || 'NULL'}`);
      console.log(`   size: ${review.size || 'NULL'}`);
      console.log(`   color: ${review.color || 'NULL'}`);

      console.log('\n' + '═'.repeat(100));
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkFullReviews();
