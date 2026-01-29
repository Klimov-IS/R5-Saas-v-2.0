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
    console.log('\n=== BUSINESS RULES CHECK for 2 Failed Reviews ===\n');

    const result = await pool.query(`
      SELECT
        r.id,
        r.rating,
        r.product_id,
        LEFT(r.text, 100) as review_text,
        r.created_at as added_to_db,
        p.name as product_name,
        p.is_active as product_is_active,
        pr.submit_complaints,
        pr.complaint_rating_1,
        pr.complaint_rating_2,
        pr.complaint_rating_3,
        pr.complaint_rating_4,
        s.id as store_id,
        s.name as store_name,
        s.status as store_status
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN product_rules pr ON pr.product_id = r.product_id
      JOIN stores s ON s.id = r.store_id
      WHERE r.id IN ('4zDUP7EKXdOL3VVBDJhr', 'GWd5wH7J3VikqEtYL4pI')
      ORDER BY r.created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('❌ Reviews not found!');
      process.exit(1);
    }

    result.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. Review ID: ${row.id}`);
      console.log(`   Rating: ${row.rating}★`);
      console.log(`   Text: ${row.review_text || '(empty)'}...`);
      console.log(`   Added to DB: ${row.added_to_db}`);
      console.log(`\n   Product: ${row.product_name}`);
      console.log(`   Product ID: ${row.product_id}`);
      console.log(`   Product Is Active: ${row.product_is_active}`);
      console.log(`\n   Store: ${row.store_name}`);
      console.log(`   Store ID: ${row.store_id}`);
      console.log(`   Store Status: ${row.store_status}`);
      console.log(`\n   === PRODUCT RULES ===`);
      console.log(`   submit_complaints: ${row.submit_complaints ?? 'NULL (not configured)'}`);
      console.log(`   complaint_rating_1: ${row.complaint_rating_1 ?? 'NULL'}`);
      console.log(`   complaint_rating_2: ${row.complaint_rating_2 ?? 'NULL'}`);
      console.log(`   complaint_rating_3: ${row.complaint_rating_3 ?? 'NULL'}`);
      console.log(`   complaint_rating_4: ${row.complaint_rating_4 ?? 'NULL'}`);

      // Check if review would pass business rules
      const passesRating = row.rating >= 1 && row.rating <= 4;
      const storeActive = row.store_status === 'active';
      const productActive = row.product_is_active === true;
      const hasRules = row.submit_complaints !== null;
      const submitEnabled = row.submit_complaints === true;
      const ratingEnabled = row[`complaint_rating_${row.rating}`] === true;

      console.log(`\n   === VALIDATION CHECKS ===`);
      console.log(`   ✓ Rating 1-4: ${passesRating ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   ✓ Store Active: ${storeActive ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   ✓ Product Active: ${productActive ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   ✓ Has Product Rules: ${hasRules ? '✅ PASS' : '❌ FAIL (no rules configured)'}`);
      console.log(`   ✓ Submit Complaints Enabled: ${submitEnabled ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   ✓ Rating-Specific Flag: ${ratingEnabled ? '✅ PASS' : '❌ FAIL'}`);

      const wouldPass = passesRating && storeActive && productActive && hasRules && submitEnabled && ratingEnabled;
      console.log(`\n   🎯 Overall: ${wouldPass ? '✅ SHOULD GENERATE COMPLAINT' : '❌ BLOCKED BY BUSINESS RULES'}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
