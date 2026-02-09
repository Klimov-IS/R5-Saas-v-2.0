/**
 * Test: Send one auto-sequence message manually
 * Usage: node scripts/test-send-one.mjs
 * Sends step 1 message for the FIRST active sequence, bypassing "seller sent today" check.
 */

import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

let connectionString = DATABASE_URL;
if (connectionString.includes('?sslmode=')) {
  connectionString = connectionString.split('?')[0];
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();

  try {
    // Get first active sequence
    const seqRes = await client.query(`
      SELECT cas.*, c.client_name, c.reply_sign
      FROM chat_auto_sequences cas
      JOIN chats c ON c.id = cas.chat_id
      WHERE cas.status = 'active'
      ORDER BY cas.created_at
      LIMIT 1
    `);

    if (seqRes.rows.length === 0) {
      console.log('No active sequences found');
      return;
    }

    const seq = seqRes.rows[0];
    const messages = typeof seq.messages === 'string' ? JSON.parse(seq.messages) : seq.messages;
    const template = messages[seq.current_step];

    console.log('========================================');
    console.log('TEST SEND: 1 message');
    console.log('========================================');
    console.log('Sequence:', seq.id.substring(0, 8) + '...');
    console.log('Client:', seq.client_name || 'unknown');
    console.log('Step:', (seq.current_step + 1) + '/' + seq.max_steps);
    console.log('Message:', template.text.substring(0, 80) + '...');

    // Check reply_sign
    if (!seq.reply_sign) {
      console.error('\nERROR: No reply_sign for this chat. Cannot send.');
      return;
    }
    console.log('reply_sign: ...', seq.reply_sign.substring(seq.reply_sign.length - 12));

    // Get store token
    const storeRes = await client.query(
      'SELECT chat_api_token, api_token, name FROM stores WHERE id = $1',
      [seq.store_id]
    );
    const store = storeRes.rows[0];
    const token = store.chat_api_token || store.api_token;

    if (!token) {
      console.error('\nERROR: No API token for store', store.name);
      return;
    }
    console.log('Store:', store.name);
    console.log('Token: ...', token.substring(token.length - 8));

    // Send via WB Chat API
    console.log('\n--- Sending via WB Chat API ---');

    const formData = new FormData();
    formData.append('replySign', seq.reply_sign);
    formData.append('message', template.text);

    const response = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/message', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: formData,
    });

    console.log('HTTP status:', response.status);
    const body = await response.text();
    if (body) console.log('Response:', body.substring(0, 300));

    if (response.ok) {
      console.log('\n✅ Message sent successfully!');

      // Advance sequence
      const nextSendAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await client.query(
        `UPDATE chat_auto_sequences
         SET current_step = current_step + 1, last_sent_at = NOW(), next_send_at = $2, updated_at = NOW()
         WHERE id = $1`,
        [seq.id, nextSendAt]
      );
      console.log('Sequence advanced: step', (seq.current_step + 2) + '/' + seq.max_steps);

      // Record in chat_messages
      const msgId = 'auto_' + seq.id.substring(0, 8) + '_' + seq.current_step;
      await client.query(
        `INSERT INTO chat_messages (id, chat_id, store_id, owner_id, sender, text, timestamp)
         VALUES ($1, $2, $3, $4, 'seller', $5, NOW())`,
        [msgId, seq.chat_id, seq.store_id, seq.owner_id, template.text]
      );
      console.log('Message recorded in chat_messages');

      // Update chat
      await client.query(
        `UPDATE chats SET last_message_text = $2, last_message_sender = 'seller', last_message_date = NOW(), updated_at = NOW() WHERE id = $1`,
        [seq.chat_id, template.text]
      );
      console.log('Chat last_message updated');
      console.log('\nNext send:', nextSendAt.split('T')[0]);
    } else {
      console.log('\n❌ Failed to send. Check token/reply_sign.');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
