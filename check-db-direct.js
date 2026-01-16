// Direct PostgreSQL query to check review statuses
const { Pool } = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: 'MyNewPass123',
  ssl: { rejectUnauthorized: false }
});

async function checkReviewStatuses() {
  try {
    console.log('\n🔍 Checking last 10 UPDATED reviews from store TwKRrPji2KhTS8TmYJlD...\n');

    const result = await pool.query(`
      SELECT
        id,
        product_id,
        rating,
        review_status_wb,
        product_status_by_review,
        chat_status_by_review,
        complaint_status,
        updated_at,
        created_at
      FROM reviews
      WHERE store_id = 'TwKRrPji2KhTS8TmYJlD'
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No reviews found for this store\n');
      return;
    }

    console.log(`Found ${result.rows.length} reviews\n`);
    console.log('='.repeat(80));

    let successCount = 0;
    let unknownCount = 0;

    result.rows.forEach((row, i) => {
      console.log(`\n📝 Review ${i + 1}: ${row.id}`);
      console.log(`   Product: ${row.product_id}`);
      console.log(`   Rating: ${row.rating}`);

      const reviewOk = row.review_status_wb !== 'unknown';
      const productOk = row.product_status_by_review !== 'unknown' && row.product_status_by_review !== 'not_specified';
      const chatOk = row.chat_status_by_review !== 'unknown';

      console.log(`   ✓ Review Status WB: ${row.review_status_wb} ${reviewOk ? '✅' : '❌'}`);
      console.log(`   ✓ Product Status: ${row.product_status_by_review} ${productOk ? '✅' : '❌'}`);
      console.log(`   ✓ Chat Status: ${row.chat_status_by_review} ${chatOk ? '✅' : '❌'}`);
      console.log(`   ✓ Complaint Status: ${row.complaint_status}`);
      console.log(`   ⏰ Updated: ${row.updated_at}`);
      console.log(`   📅 Created: ${row.created_at}`);

      if (reviewOk && productOk && chatOk) {
        successCount++;
      } else {
        unknownCount++;
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Correctly converted: ${successCount} / ${result.rows.length}`);
    console.log(`   ❌ Still have "unknown": ${unknownCount} / ${result.rows.length}`);

    if (unknownCount === 0 && successCount > 0) {
      console.log('\n🎉 SUCCESS! All statuses are correctly converted!');
      console.log('✅ Day 2 Этап 1 COMPLETE - Real API sync is working!\n');
    } else if (unknownCount > 0) {
      console.log('\n⚠️  Some reviews still have "unknown" status');
      console.log('   Possible reasons:');
      console.log('   1. These are old reviews (before StatusMapper fix)');
      console.log('   2. StatusMapper missing some Russian status variants');
      console.log('   3. Extension not parsing status correctly\n');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkReviewStatuses();
