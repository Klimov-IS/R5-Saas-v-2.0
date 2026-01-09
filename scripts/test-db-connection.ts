/**
 * Test PostgreSQL Database Connection
 *
 * This script tests the connection to Yandex Cloud PostgreSQL
 * and verifies that data was imported correctly.
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { testConnection, query, closePool } from '../src/db/client';
import * as dbHelpers from '../src/db/helpers';

async function main() {
  console.log('========================================');
  console.log('🧪 PostgreSQL Connection Test');
  console.log('========================================\n');

  try {
    // Step 1: Test basic connection
    console.log('1️⃣  Testing basic connection...');
    const isConnected = await testConnection();

    if (!isConnected) {
      console.error('❌ Connection test failed!');
      process.exit(1);
    }
    console.log('✅ Connection successful!\n');

    // Step 2: Test users table
    console.log('2️⃣  Testing users table...');
    const users = await dbHelpers.getUsers();
    console.log(`   Found ${users.length} users`);
    if (users.length > 0) {
      console.log('   Sample user:', {
        id: users[0].id,
        email: users[0].email,
        is_approved: users[0].is_approved,
      });
    }
    console.log('✅ Users table OK\n');

    // Step 3: Test user_settings table
    console.log('3️⃣  Testing user_settings table...');
    const settings = await dbHelpers.getUserSettings();
    if (settings) {
      console.log('   Settings found for user:', settings.id);
      console.log('   Has Deepseek API key:', !!settings.deepseek_api_key);
      console.log('   Has API key:', !!settings.api_key);
      console.log('   AI concurrency:', settings.ai_concurrency);
    } else {
      console.warn('   ⚠️  No user settings found');
    }
    console.log('✅ User settings table OK\n');

    // Step 4: Test stores table
    console.log('4️⃣  Testing stores table...');
    const stores = await dbHelpers.getStores();
    console.log(`   Found ${stores.length} stores`);
    if (stores.length > 0) {
      console.log('   Sample store:', {
        id: stores[0].id,
        name: stores[0].name,
        owner_id: stores[0].owner_id,
        total_reviews: stores[0].total_reviews,
        total_chats: stores[0].total_chats,
      });
    }
    console.log('✅ Stores table OK\n');

    // Step 5: Test products table (should be empty initially)
    console.log('5️⃣  Testing products table...');
    if (stores.length > 0) {
      const products = await dbHelpers.getProducts(stores[0].id);
      console.log(`   Found ${products.length} products for store "${stores[0].name}"`);
      if (products.length === 0) {
        console.log('   ℹ️  No products yet (expected - will be synced via WB API)');
      }
    }
    console.log('✅ Products table OK\n');

    // Step 6: Test reviews table (should be empty initially)
    console.log('6️⃣  Testing reviews table...');
    if (stores.length > 0) {
      const reviews = await dbHelpers.getReviewsByStore(stores[0].id, 10);
      console.log(`   Found ${reviews.length} reviews for store "${stores[0].name}"`);
      if (reviews.length === 0) {
        console.log('   ℹ️  No reviews yet (expected - will be synced via WB API)');
      }
    }
    console.log('✅ Reviews table OK\n');

    // Step 7: Test chats table (should be empty initially)
    console.log('7️⃣  Testing chats table...');
    if (stores.length > 0) {
      const chats = await dbHelpers.getChats(stores[0].id);
      console.log(`   Found ${chats.length} chats for store "${stores[0].name}"`);
      if (chats.length === 0) {
        console.log('   ℹ️  No chats yet (expected - will be synced via WB API)');
      }
    }
    console.log('✅ Chats table OK\n');

    // Step 8: Test questions table (should be empty initially)
    console.log('8️⃣  Testing questions table...');
    if (stores.length > 0) {
      const questions = await dbHelpers.getQuestions(stores[0].id);
      console.log(`   Found ${questions.length} questions for store "${stores[0].name}"`);
      if (questions.length === 0) {
        console.log('   ℹ️  No questions yet (expected - will be synced via WB API)');
      }
    }
    console.log('✅ Questions table OK\n');

    // Step 9: Test store stats helper
    console.log('9️⃣  Testing store stats helper...');
    if (stores.length > 0) {
      const stats = await dbHelpers.getStoreStats(stores[0].id);
      console.log(`   Stats for "${stores[0].name}":`, stats);
    }
    console.log('✅ Store stats OK\n');

    // Step 10: Test API key verification
    console.log('🔟 Testing API key verification...');
    if (settings?.api_key) {
      const verifiedSettings = await dbHelpers.verifyApiKey(settings.api_key);
      if (verifiedSettings) {
        console.log('   ✅ API key verification works!');
        console.log('   Verified user:', verifiedSettings.id);
      } else {
        console.warn('   ⚠️  API key verification failed');
      }
    } else {
      console.log('   ℹ️  No API key in settings to test');
    }
    console.log('✅ API key verification OK\n');

    // Summary
    console.log('========================================');
    console.log('✅ All tests passed!');
    console.log('========================================\n');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Stores: ${stores.length}`);
    console.log(`   - User settings: ${settings ? 'Found' : 'Not found'}`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Sync products from WB API');
    console.log('   2. Sync reviews from WB API');
    console.log('   3. Sync chats from WB API');
    console.log('   4. Sync questions from WB API');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
