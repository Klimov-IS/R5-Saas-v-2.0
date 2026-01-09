require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: { rejectUnauthorized: false }
});

const storeId = '0rCKlFCdrT7L3B2ios45';

(async () => {
  try {
    const reviewsCount = await pool.query(
      'SELECT COUNT(*) as count FROM reviews WHERE store_id = $1',
      [storeId]
    );

    const storeStats = await pool.query(
      'SELECT total_reviews, last_review_update_status, last_review_update_date FROM stores WHERE id = $1',
      [storeId]
    );

    console.log('\n=== Reviews Sync Results ===');
    console.log('Reviews in DB:', reviewsCount.rows[0].count);
    console.log('Store total_reviews:', storeStats.rows[0].total_reviews);
    console.log('Sync status:', storeStats.rows[0].last_review_update_status);
    console.log('Last sync date:', storeStats.rows[0].last_review_update_date);
    console.log('============================\n');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
