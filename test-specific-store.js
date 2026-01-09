/**
 * Check specific corrupted store in database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkStore() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL?.split('?')[0],
    ssl: { rejectUnauthorized: false },
    client_encoding: 'UTF8',
  });

  try {
    // Check the corrupted store
    const corruptedId = 'xOMA8naL3Q9eSuR2Oewr';
    const result = await pool.query(
      'SELECT id, name, created_at FROM stores WHERE id = $1',
      [corruptedId]
    );

    console.log('=== Corrupted Store Details ===\n');
    if (result.rows.length > 0) {
      const store = result.rows[0];
      console.log('ID:', store.id);
      console.log('Name (string):', store.name);
      console.log('Name (JSON):', JSON.stringify(store.name));
      console.log('Name length:', store.name.length);
      console.log('Name charCodes:', [...store.name].map(c => c.charCodeAt(0)));
      console.log('Created at:', store.created_at);

      // Check if it's the replacement character
      console.log('\nAnalysis:');
      console.log('Contains �:', store.name.includes('�'));
      console.log('Byte length:', Buffer.from(store.name, 'utf8').length);
    }

    // Check the working store
    console.log('\n\n=== Working Store (for comparison) ===\n');
    const workingId = 'haNp15vW6FWomNLPesHC';
    const result2 = await pool.query(
      'SELECT id, name FROM stores WHERE id = $1',
      [workingId]
    );

    if (result2.rows.length > 0) {
      const store = result2.rows[0];
      console.log('ID:', store.id);
      console.log('Name (string):', store.name);
      console.log('Name (JSON):', JSON.stringify(store.name));
      console.log('Name charCodes:', [...store.name].map(c => c.charCodeAt(0)));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStore();
