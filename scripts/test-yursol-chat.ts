import { query } from '../src/db/client';
import { fetchWBChatMessages, retryWithBackoff } from '../src/lib/wb-chat-sync';

async function testYursolChat() {
  console.log('🔍 Testing Юрсол chat specifically...\n');

  try {
    // Get Юрсол chat from DB
    const chatResult = await query(`
      SELECT c.id, c.client_name, c.store_id, s.name as store_name, s.chat_api_token, s.api_token
      FROM chats c
      JOIN stores s ON c.store_id = s.id
      WHERE c.client_name ILIKE '%Юрсол%'
      LIMIT 1
    `);

    if (chatResult.rows.length === 0) {
      console.log('❌ Юрсол chat not found');
      process.exit(1);
    }

    const chat = chatResult.rows[0];
    const token = chat.chat_api_token || chat.api_token;

    console.log(`Chat ID: ${chat.id}`);
    console.log(`Client: ${chat.client_name}`);
    console.log(`Store: ${chat.store_name}\n`);

    console.log('📥 Fetching messages from WB API...');
    const messages = await retryWithBackoff(() => fetchWBChatMessages(chat.id, token));

    console.log(`✅ Found ${messages.length} messages\n`);

    if (messages.length > 0) {
      console.log('First 3 messages:');
      messages.slice(0, 3).forEach((msg, i) => {
        console.log(`${i + 1}. [${msg.sender}] ${msg.text}`);
      });
    }

    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testYursolChat();
