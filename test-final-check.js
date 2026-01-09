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

const storeId = 'TwKRrPji2KhTS8TmYJlD';

(async () => {
  try {
    const products = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE store_id = $1',
      [storeId]
    );

    const reviews = await pool.query(
      'SELECT COUNT(*) as count FROM reviews WHERE store_id = $1',
      [storeId]
    );

    const store = await pool.query(
      'SELECT name, total_reviews, last_review_update_status, last_product_update_status FROM stores WHERE id = $1',
      [storeId]
    );

    console.log('\n=== Final Test Results ===');
    console.log('Store:', store.rows[0].name);
    console.log('Products in DB:', products.rows[0].count);
    console.log('Reviews in DB:', reviews.rows[0].count);
    console.log('Store total_reviews:', store.rows[0].total_reviews);
    console.log('Product sync status:', store.rows[0].last_product_update_status);
    console.log('Review sync status:', store.rows[0].last_review_update_status);
    console.log('==========================\n');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
