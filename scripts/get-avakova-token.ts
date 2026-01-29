/**
 * Get API token for ИП Авакова store owner
 *
 * Usage: npx tsx scripts/get-avakova-token.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

async function getAvakovaToken() {
  console.log('🔍 Searching for ИП Авакова store owner and their API token...\n');

  try {
    // Find the store and its owner's API key
    const result = await pool.query(`
      SELECT
        s.id as store_id,
        s.name as store_name,
        u.id as user_id,
        u.email as user_email,
        us.api_key
      FROM stores s
      JOIN users u ON s.owner_id = u.id
      LEFT JOIN user_settings us ON u.id = us.id
      WHERE s.name ILIKE '%авакова%'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ Store "ИП Авакова" not found');
      process.exit(1);
    }

    const store = result.rows[0];

    console.log('✅ Store found:');
    console.log(`   Store ID: ${store.store_id}`);
    console.log(`   Store Name: ${store.store_name}`);
    console.log(`   Owner ID: ${store.user_id}`);
    console.log(`   Owner Email: ${store.user_email}`);
    console.log(`   API Key: ${store.api_key || '❌ NOT SET'}`);

    if (!store.api_key) {
      console.log('\n⚠️ API key not set for this user');
      console.log('💡 Generating a new API key...');

      // Generate a new API key
      const newApiKey = `wbrm_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      // Check if user_settings exists for this user
      const settingsCheck = await pool.query(
        `SELECT id FROM user_settings WHERE id = $1`,
        [store.user_id]
      );

      if (settingsCheck.rows.length === 0) {
        // Create user_settings entry
        await pool.query(
          `INSERT INTO user_settings (id, api_key) VALUES ($1, $2)`,
          [store.user_id, newApiKey]
        );
      } else {
        // Update existing entry
        await pool.query(
          `UPDATE user_settings SET api_key = $1 WHERE id = $2`,
          [newApiKey, store.user_id]
        );
      }

      console.log(`\n✅ New API key generated and saved: ${newApiKey}`);
      console.log('\n📋 Use this token in your tests:');
      console.log(`   const TOKEN = '${newApiKey}';`);
    } else {
      console.log('\n📋 Use this token in your tests:');
      console.log(`   const TOKEN = '${store.api_key}';`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

getAvakovaToken().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
