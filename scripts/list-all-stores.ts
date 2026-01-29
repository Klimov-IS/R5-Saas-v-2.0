/**
 * List all stores in database
 *
 * Usage: npx tsx scripts/list-all-stores.ts
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

async function listAllStores() {
  console.log('🔍 Listing all stores in database...\n');

  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.status,
        u.email as owner_email,
        us.api_key
      FROM stores s
      JOIN users u ON s.owner_id = u.id
      LEFT JOIN user_settings us ON u.id = us.id
      ORDER BY s.name ASC
    `);

    if (result.rows.length === 0) {
      console.log('❌ No stores found');
      return;
    }

    console.log(`✅ Found ${result.rows.length} stores:\n`);

    result.rows.forEach((store, idx) => {
      console.log(`${idx + 1}. Store: ${store.name}`);
      console.log(`   ID: ${store.id}`);
      console.log(`   Status: ${store.status}`);
      console.log(`   Owner: ${store.owner_email}`);
      console.log(`   API Key: ${store.api_key || '❌ NOT SET'}`);
      console.log('');
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

listAllStores().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
