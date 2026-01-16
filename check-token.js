/**
 * Check API Token in Database
 * Verifies if the token used in extension exists in user_settings.api_key
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: { rejectUnauthorized: false }
});

async function checkToken() {
  try {
    console.log('🔍 Checking API tokens in database...\n');

    // Check all tokens
    const result = await pool.query(`
      SELECT
        us.api_key,
        u.id as user_id,
        u.email
      FROM user_settings us
      JOIN users u ON us.id = u.id
      LIMIT 10;
    `);

    console.log('📊 Found API tokens:');
    console.log('═'.repeat(80));

    if (result.rows.length === 0) {
      console.log('❌ No API tokens found in database!');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. User: ${row.email}`);
        console.log(`   User ID: ${row.user_id}`);
        console.log(`   API Key: ${row.api_key}`);
      });
    }

    console.log('\n' + '═'.repeat(80));

    // Check extension token specifically
    const extensionToken = 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
    console.log(`\n🔍 Checking extension token: ${extensionToken}`);

    const checkResult = await pool.query(
      'SELECT u.id, u.email FROM user_settings us JOIN users u ON us.id = u.id WHERE us.api_key = $1',
      [extensionToken]
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Extension token FOUND in database!');
      console.log(`   User: ${checkResult.rows[0].email}`);
      console.log(`   User ID: ${checkResult.rows[0].id}`);
    } else {
      console.log('❌ Extension token NOT FOUND in database!');
      console.log('   This explains the 401 Unauthorized error.');
      console.log('\n💡 Solution: Update api-config.js with one of the tokens listed above.');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkToken();
