#!/usr/bin/env node
/**
 * Test sync for ONE store only
 * Usage: npx tsx scripts/sync-one-store-test.ts <storeId>
 */

import { query } from '../src/db/client';
import { fetchWBAllChats, fetchWBChatMessages, sleep, retryWithBackoff } from '../src/lib/wb-chat-sync';

const STORE_ID = process.argv[2] || '1Hjrlzp1OLfYNmgC6HQd'; // ИП Тургунов

async function testSync() {
  console.log(`\n🧪 Testing sync for store: ${STORE_ID}\n`);

  try {
    // Get store
    const storeResult = await query(`
      SELECT id, name, owner_id, chat_api_token, api_token
      FROM stores
      WHERE id = $1
    `, [STORE_ID]);

    if (storeResult.rows.length === 0) {
      console.error('❌ Store not found');
      process.exit(1);
    }

    const store = storeResult.rows[0];
    const token = store.chat_api_token || store.api_token;

    console.log(`Store: ${store.name}`);
    console.log(`Owner: ${store.owner_id}\n`);

    // Fetch chats
    console.log('📋 Fetching chats from WB...');
    const chats = await retryWithBackoff(() => fetchWBAllChats(token));
    console.log(`✅ Found ${chats.length} chats\n`);

    // Test with first 3 chats
    console.log('🔍 Testing first 3 chats:\n');
    for (let i = 0; i < Math.min(3, chats.length); i++) {
      const chat = chats[i];
      console.log(`Chat ${i + 1}: ${chat.clientName} (${chat.chatID})`);

      try {
        const messages = await retryWithBackoff(() => fetchWBChatMessages(chat.chatID, token));
        console.log(`  ✅ ${messages.length} messages found`);

        if (messages.length > 0) {
          console.log(`     First message: "${messages[0].text.substring(0, 50)}..."`);
          console.log(`     Last message: "${messages[messages.length - 1].text.substring(0, 50)}..."`);
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }

      await sleep(500);
      console.log('');
    }

    console.log('✅ Test complete!\n');
    console.log('To sync ALL chats, run:');
    console.log('  npx tsx scripts/sync-all-chat-history.ts\n');

    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSync();
