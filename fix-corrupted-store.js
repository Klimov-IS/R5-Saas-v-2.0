/**
 * Fix corrupted store name in database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function fixStore() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL?.split('?')[0],
    ssl: { rejectUnauthorized: false },
    client_encoding: 'UTF8',
  });

  try {
    const storeId = 'xOMA8naL3Q9eSuR2Oewr';
    const correctName = 'ИП Аникеев М. Ю.';

    console.log('Fixing store:', storeId);
    console.log('New name:', correctName);

    const result = await pool.query(
      'UPDATE stores SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name',
      [correctName, storeId]
    );

    if (result.rows.length > 0) {
      console.log('\n✅ Success! Updated store:');
      console.log('  ID:', result.rows[0].id);
      console.log('  Name:', result.rows[0].name);
    } else {
      console.log('\n❌ Store not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixStore();
