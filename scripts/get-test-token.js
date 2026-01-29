/**
 * Get test API token from user_settings for testing Extension API
 */

const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === 'require' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get first user with API key
    const result = await client.query(`
      SELECT
        u.id as user_id,
        u.email,
        us.api_key,
        COUNT(s.id) as stores_count
      FROM users u
      JOIN user_settings us ON u.id = us.id
      LEFT JOIN stores s ON s.owner_id = u.id
      WHERE us.api_key IS NOT NULL
      GROUP BY u.id, u.email, us.api_key
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No users with API keys found');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('📋 Test User Info:');
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Stores: ${user.stores_count}`);
    console.log(`\n🔑 API Token:\n   ${user.api_key}\n`);

    // Get user's stores
    const storesResult = await client.query(
      'SELECT id, name, status FROM stores WHERE owner_id = $1 ORDER BY name ASC',
      [user.user_id]
    );

    console.log(`📦 Stores (${storesResult.rows.length}):`);
    storesResult.rows.forEach((store, i) => {
      console.log(`   ${i + 1}. ${store.name}`);
      console.log(`      ID: ${store.id}`);
      console.log(`      Status: ${store.status}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
