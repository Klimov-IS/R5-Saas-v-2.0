/**
 * Check API token in database
 *
 * Usage: node scripts/check-api-token.js
 */

const { query } = require('../src/db/client');

async function checkApiToken() {
  console.log('🔍 Checking API tokens in database...\n');

  try {
    // Get all users with their API keys
    const result = await query(`
      SELECT
        u.id,
        u.email,
        us.api_key
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.id
      ORDER BY u.created_at DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`✅ Found ${result.rows.length} users:\n`);

    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. User ID: ${row.id}`);
      console.log(`   Email: ${row.email}`);
      console.log(`   API Key: ${row.api_key || '❌ NOT SET'}`);
      console.log('');
    });

    // Check the specific token from extension
    const extensionToken = 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
    const tokenCheck = await query(
      `SELECT u.id, u.email
       FROM users u
       JOIN user_settings us ON u.id = us.id
       WHERE us.api_key = $1`,
      [extensionToken]
    );

    console.log(`\n🔑 Extension token check (${extensionToken}):`);
    if (tokenCheck.rows.length > 0) {
      console.log('✅ Token is VALID');
      console.log(`   User: ${tokenCheck.rows[0].email} (${tokenCheck.rows[0].id})`);
    } else {
      console.log('❌ Token is INVALID (not found in database)');
      console.log('\n💡 Solution: Update extension with one of the valid API keys above');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkApiToken();
