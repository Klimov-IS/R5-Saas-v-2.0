/**
 * Script to generate API tokens for Chrome Extension authentication
 *
 * Usage:
 *   npm run dev  # Make sure DB is accessible
 *   ts-node scripts/generate-extension-api-token.ts <storeId> <tokenName>
 *
 * Example:
 *   ts-node scripts/generate-extension-api-token.ts cm5abc123 "Chrome Extension - Production"
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';
import crypto from 'crypto';

async function generateApiToken(storeId: string, tokenName: string) {
  console.log('🔑 Generating API Token for Chrome Extension...\n');

  try {
    // Verify store exists
    const storeResult = await query('SELECT id, name FROM stores WHERE id = $1', [storeId]);

    if (storeResult.rows.length === 0) {
      console.error(`❌ Error: Store with ID "${storeId}" not found`);
      console.error('\n💡 Tip: Run "ts-node scripts/list-all-stores.ts" to see available stores');
      process.exit(1);
    }

    const store = storeResult.rows[0];
    console.log(`✅ Store found: ${store.name} (${store.id})\n`);

    // Generate secure random token (64 characters)
    const token = crypto.randomBytes(32).toString('hex');

    // Insert token into database
    const tokenResult = await query(
      `INSERT INTO api_tokens (store_id, token, name)
       VALUES ($1, $2, $3)
       RETURNING id, token, name, created_at`,
      [storeId, token, tokenName]
    );

    const apiToken = tokenResult.rows[0];

    console.log('━'.repeat(80));
    console.log('✨ API Token Generated Successfully!\n');
    console.log(`📋 Token ID:       ${apiToken.id}`);
    console.log(`🏪 Store ID:       ${storeId}`);
    console.log(`🏷️  Store Name:     ${store.name}`);
    console.log(`📝 Token Name:     ${tokenName}`);
    console.log(`📅 Created At:     ${apiToken.created_at}`);
    console.log('━'.repeat(80));
    console.log('\n🔐 Bearer Token (copy this - shown only once):\n');
    console.log(`   ${token}\n`);
    console.log('━'.repeat(80));
    console.log('\n📌 Usage Example (curl):\n');
    console.log(`   curl -H "Authorization: Bearer ${token}" \\`);
    console.log(`        http://158.160.217.236/api/stores/${storeId}/complaints\n`);
    console.log('📌 Usage Example (JavaScript):\n');
    console.log(`   fetch('http://158.160.217.236/api/stores/${storeId}/complaints', {`);
    console.log(`     headers: { 'Authorization': 'Bearer ${token}' }`);
    console.log(`   })\n`);
    console.log('━'.repeat(80));
    console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   • Keep this token secure - it provides full access to store data');
    console.log('   • Store in Chrome Extension secure storage (not in code)');
    console.log('   • Rate limit: 100 requests per minute');
    console.log('   • To revoke: UPDATE api_tokens SET is_active = false WHERE id = \'' + apiToken.id + '\'');
    console.log('━'.repeat(80));

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error generating token:', error.message);
    if (error.code === '42P01') {
      console.error('\n💡 Table api_tokens does not exist. Run migration first:');
      console.error('   psql -h <host> -U <user> -d <database> -f migrations/001_create_api_tokens_table.sql');
    }
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ Usage: ts-node scripts/generate-extension-api-token.ts <storeId> <tokenName>');
  console.error('\nExample:');
  console.error('  ts-node scripts/generate-extension-api-token.ts cm5abc123 "Chrome Extension - Production"');
  console.error('\n💡 To see available stores:');
  console.error('  ts-node scripts/list-all-stores.ts');
  process.exit(1);
}

const [storeId, ...tokenNameParts] = args;
const tokenName = tokenNameParts.join(' ');

generateApiToken(storeId, tokenName);
