const { Pool } = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: 'MyNewPass123',
  ssl: { rejectUnauthorized: false }
});

async function checkSyncedReviews() {
  try {
    // Проверяем 3 отзыва которые только что синхронизировали
    const reviewIds = [
      'G9qah3wx5ttL9Fzt1eXX',
      'nQLIlHZNs1zQ5G2j7uPI',
      'v1kCTJQZpu9K6BHhpmcX'
    ];

    console.log('🔍 Checking just synced reviews:\n');

    for (const reviewId of reviewIds) {
      const result = await pool.query(`
        SELECT id, product_id, rating,
               review_status_wb, product_status_by_review,
               chat_status_by_review, complaint_status,
               updated_at, created_at
        FROM reviews
        WHERE id = $1
      `, [reviewId]);

      if (result.rows.length === 0) {
        console.log(`❌ Review ${reviewId} NOT FOUND in database!\n`);
        continue;
      }

      const review = result.rows[0];
      console.log(`📝 Review: ${review.id}`);
      console.log(`   Product: ${review.product_id}`);
      console.log(`   Rating: ${review.rating}`);
      console.log(`   ✓ Review Status WB: ${review.review_status_wb} ${review.review_status_wb !== 'unknown' ? '✅' : '❌'}`);
      console.log(`   ✓ Product Status: ${review.product_status_by_review} ${review.product_status_by_review !== 'unknown' ? '✅' : '❌'}`);
      console.log(`   ✓ Chat Status: ${review.chat_status_by_review} ${review.chat_status_by_review !== 'unknown' ? '✅' : '❌'}`);
      console.log(`   ✓ Complaint Status: ${review.complaint_status}`);
      console.log(`   ⏰ Updated: ${new Date(review.updated_at)}`);
      console.log(`   📅 Created: ${new Date(review.created_at)}\n`);
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSyncedReviews();
