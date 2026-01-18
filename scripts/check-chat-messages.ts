import { query } from '../src/db/client';

async function checkChatMessages() {
  console.log('🔍 Searching for chat with "Юрсол" or "не делал отзыв"...\n');

  // Find the chat
  const chatResult = await query(`
    SELECT
      c.id,
      c.client_name,
      c.last_message_text,
      c.last_message_sender,
      c.store_id,
      s.name as store_name
    FROM chats c
    LEFT JOIN stores s ON c.store_id = s.id
    WHERE c.client_name ILIKE '%Юрсол%'
       OR c.last_message_text ILIKE '%не делал отзыв%'
    LIMIT 5
  `);

  if (chatResult.rows.length === 0) {
    console.log('❌ Chat not found');
    process.exit(0);
  }

  console.log(`✅ Found ${chatResult.rows.length} chat(s):\n`);

  for (const chat of chatResult.rows) {
    console.log(`📝 Chat ID: ${chat.id}`);
    console.log(`   Client: ${chat.client_name}`);
    console.log(`   Store: ${chat.store_name} (${chat.store_id})`);
    console.log(`   Last Message: "${chat.last_message_text.substring(0, 100)}..."`);
    console.log(`   Sender: ${chat.last_message_sender}\n`);

    // Check messages count
    const messagesResult = await query(`
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE chat_id = $1
    `, [chat.id]);

    const messageCount = parseInt(messagesResult.rows[0].count);
    console.log(`   💬 Messages in DB: ${messageCount}`);

    if (messageCount === 0) {
      console.log(`   ⚠️  NO MESSAGES FOUND! Only last_message_text exists in chats table.\n`);
    } else {
      // Show first 3 messages
      const sampleMessages = await query(`
        SELECT sender, text, timestamp
        FROM chat_messages
        WHERE chat_id = $1
        ORDER BY timestamp ASC
        LIMIT 3
      `, [chat.id]);

      console.log(`\n   📨 Sample messages:`);
      sampleMessages.rows.forEach((msg, i) => {
        console.log(`   ${i + 1}. [${msg.sender}] ${msg.text.substring(0, 80)}...`);
      });
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  process.exit(0);
}

checkChatMessages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
