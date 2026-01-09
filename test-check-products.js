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
    const productsCount = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE store_id = $1',
      [storeId]
    );

    console.log('\n=== Products Sync Results ===');
    console.log('Products in DB:', productsCount.rows[0].count);
    console.log('=============================\n');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
