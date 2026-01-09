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
    const products = await pool.query(
      'SELECT id, wb_product_id, name FROM products WHERE store_id = $1 LIMIT 5',
      [storeId]
    );

    console.log('\n=== Products Details ===');
    console.log('Total:', products.rowCount);
    products.rows.forEach(p => {
      console.log(`- ${p.wb_product_id}: ${p.name}`);
    });
    console.log('========================\n');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
