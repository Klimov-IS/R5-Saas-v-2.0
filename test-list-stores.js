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

(async () => {
  try {
    const stores = await pool.query(
      'SELECT id, name FROM stores ORDER BY name LIMIT 10'
    );

    console.log('\n=== Available Stores ===');
    stores.rows.forEach((s, i) => {
      console.log(`${i + 1}. ${s.name} (${s.id})`);
    });
    console.log('========================\n');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
