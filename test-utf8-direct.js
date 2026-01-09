/**
 * Direct PostgreSQL UTF-8 Test
 * This script tests if the encoding issue is in the database data itself or in the connection
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function testUTF8() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL?.split('?')[0],
    ssl: { rejectUnauthorized: false },
    client_encoding: 'UTF8', // Explicit UTF-8
  });

  try {
    console.log('=== Testing PostgreSQL UTF-8 Encoding ===\n');

    // Test 1: Check database encoding
    const encodingResult = await pool.query('SHOW client_encoding');
    console.log('1. Client Encoding:', encodingResult.rows[0].client_encoding);

    const serverEncodingResult = await pool.query('SHOW server_encoding');
    console.log('2. Server Encoding:', serverEncodingResult.rows[0].server_encoding);

    // Test 2: Get stores with name field
    console.log('\n3. Store Names (Raw from DB):');
    const storesResult = await pool.query('SELECT id, name FROM stores LIMIT 5');

    storesResult.rows.forEach((store, index) => {
      console.log(`\nStore ${index + 1}:`);
      console.log('  ID:', store.id);
      console.log('  Name (raw):', store.name);
      console.log('  Name (JSON):', JSON.stringify(store.name));
      console.log('  Name (Buffer):', Buffer.from(store.name, 'utf8'));

      // Try to detect mojibake
      const hasGarbled = store.name.includes('�');
      console.log('  Has Garbled Chars:', hasGarbled);
    });

    // Test 3: Check if we can insert Cyrillic correctly
    console.log('\n\n4. Testing Cyrillic Insert:');
    const testText = 'Тест кириллицы: ИП Авакова А. А.';
    console.log('  Original:', testText);

    // Try to find existing store with Cyrillic
    const cyrillicTest = await pool.query(
      "SELECT name FROM stores WHERE name LIKE '%Авакова%' LIMIT 1"
    );
    console.log('  Found Cyrillic store:', cyrillicTest.rows.length > 0);
    if (cyrillicTest.rows.length > 0) {
      console.log('  Name:', cyrillicTest.rows[0].name);
    }

    // Test 4: Check bytea representation
    console.log('\n5. Checking byte representation of first store name:');
    const byteaResult = await pool.query(
      "SELECT name, convert_to(name, 'UTF8') as bytes FROM stores LIMIT 1"
    );
    if (byteaResult.rows.length > 0) {
      console.log('  Name:', byteaResult.rows[0].name);
      console.log('  Bytes:', byteaResult.rows[0].bytes);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testUTF8();
