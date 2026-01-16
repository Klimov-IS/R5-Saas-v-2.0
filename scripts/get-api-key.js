/**
 * Simple script to get valid API key from database
 * Usage: node scripts/get-api-key.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function getApiKey() {
  try {
    console.log('🔍 Connecting to PostgreSQL...');

    const result = await pool.query(`
      SELECT api_key
      FROM settings
      WHERE api_key IS NOT NULL
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No API key found in settings table');
      process.exit(1);
    }

    const apiKey = result.rows[0].api_key;

    console.log('\n✅ API Key found:\n');
    console.log(`   ${apiKey}`);
    console.log('\n📋 Use in curl commands:\n');
    console.log(`   -H "Authorization: Bearer ${apiKey}"`);
    console.log('\n🔧 Example:\n');
    console.log(`   curl -X GET "http://localhost:9002/api/stores" -H "Authorization: Bearer ${apiKey}" -s\n`);

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getApiKey();
