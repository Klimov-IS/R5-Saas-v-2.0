/**
 * Simple script to get valid API key from database
 * Usage: npx tsx scripts/get-api-key.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

async function getApiKey() {
  try {
    console.log('🔍 Fetching API key from database...\n');

    const result = await query(`
      SELECT api_key
      FROM user_settings
      WHERE api_key IS NOT NULL
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No API key found in user_settings table\n');
      process.exit(1);
    }

    const apiKey = result.rows[0].api_key;

    console.log('✅ API Key found:\n');
    console.log(`   ${apiKey}\n`);
    console.log('📋 Use in curl commands:\n');
    console.log(`   -H "Authorization: Bearer ${apiKey}"\n`);
    console.log('🔧 Example - Get stores:\n');
    console.log(`   curl -X GET "http://localhost:9002/api/stores" -H "Authorization: Bearer ${apiKey}" -s\n`);
    console.log('🚀 Example - Sync all dialogues:\n');
    console.log(`   curl -X POST "http://localhost:9002/api/stores/dialogues/update-all" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -w "\\n\\nHTTP: %{http_code}\\nTime: %{time_total}s\\n" -s\n`);

    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getApiKey();
