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
    const apiKeyResult = await pool.query('SELECT api_key FROM user_settings LIMIT 1');
    const storeResult = await pool.query('SELECT id, name FROM stores LIMIT 1');

    console.log('\n=== Test Credentials ===');
    console.log('API_KEY:', apiKeyResult.rows[0]?.api_key);
    console.log('STORE_ID:', storeResult.rows[0]?.id);
    console.log('STORE_NAME:', storeResult.rows[0]?.name);
    console.log('SERVER:', 'http://localhost:9002');
    console.log('========================\n');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
