#!/usr/bin/env node
/**
 * Simple Chat History Sync (JavaScript version - no TypeScript issues)
 *
 * Usage:
 *   node scripts/sync-chat-history-simple.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE, // Try both
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  ssl: { rejectUnauthorized: false } // Always use SSL for Yandex Cloud
});

// Helpers
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWBAllEvents(token) {
  let allEvents = [];
  let next = null;
  let pageCount = 0;
  const MAX_PAGES = 1000;

  console.log('[WB] Fetching all events from beginning...');

  while (pageCount < MAX_PAGES) {
    const url = new URL('https://buyer-chat-api.wildberries.ru/api/v1/seller/events');
    if (next) url.searchParams.set('next', next);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': token }
    });

    if (!response.ok) {
      throw new Error(`WB API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const events = data.result?.events || [];

    allEvents.push(...events);
    pageCount++;

    const newNext = data.result?.next;
    const hasMore = !!newNext && events.length > 0 && newNext !== next;

    console.log(`  Page ${pageCount}: ${events.length} events`);

    if (hasMore) {
      next = newNext;
      await sleep(1500); // Rate limiting
    } else {
      break;
    }
  }

  console.log(`[WB] ✅ Total: ${allEvents.length} events (${pageCount} pages)\n`);
  return allEvents;
}

async function syncStore(storeId, storeName, token, ownerId) {
  console.log('\n' + '='.repeat(80));
  console.log(`[SYNC] ${storeName} (${storeId})`);
  console.log('='.repeat(80) + '\n');

  try {
    // Create sync log
    const logResult = await pool.query(`
      INSERT INTO sync_logs (store_id, sync_type, status, started_at)
      VALUES ($1, 'chat_history', 'running', NOW())
      RETURNING id
    `, [storeId]);
    const logId = logResult.rows[0].id;

    // Fetch all events
    const events = await fetchWBAllEvents(token);

    // Group by chat
    const chatMessages = {};
    for (const event of events) {
      if (event.eventType === 'message' && event.chatID) {
        if (!chatMessages[event.chatID]) chatMessages[event.chatID] = [];
        chatMessages[event.chatID].push(event);
      }
    }

    console.log(`[SYNC] Found messages for ${Object.keys(chatMessages).length} chats\n`);

    // Save to database
    let totalMessages = 0;
    let chatsProcessed = 0;

    for (const [chatId, messages] of Object.entries(chatMessages)) {
      for (const event of messages) {
        await pool.query(`
          INSERT INTO chat_messages (id, chat_id, store_id, owner_id, text, sender, timestamp, download_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [
          event.eventID,
          chatId,
          storeId,
          ownerId,
          event.message?.text || '',
          event.sender,
          event.addTime,
          event.downloadID || null
        ]);
      }

      // Update last_message
      const lastEvent = messages[messages.length - 1];
      await pool.query(`
        UPDATE chats
        SET last_message_text = $1, last_message_sender = $2, last_message_date = $3
        WHERE id = $4
      `, [
        lastEvent.message?.text || 'Вложение',
        lastEvent.sender,
        lastEvent.addTime,
        chatId
      ]);

      totalMessages += messages.length;
      chatsProcessed++;

      if (chatsProcessed % 10 === 0) {
        console.log(`  Processed ${chatsProcessed} chats, ${totalMessages} messages...`);
      }
    }

    // Mark success
    await pool.query(`
      UPDATE sync_logs
      SET status = 'success', chats_synced = $1, messages_added = $2, completed_at = NOW()
      WHERE id = $3
    `, [chatsProcessed, totalMessages, logId]);

    console.log(`\n✅ COMPLETE: ${storeName}`);
    console.log(`   Chats: ${chatsProcessed}`);
    console.log(`   Messages: ${totalMessages}\n`);

  } catch (error) {
    console.error(`❌ ERROR: ${error.message}\n`);
    throw error;
  }
}

async function main() {
  console.log('\n🚀 Starting Chat History Sync...\n');

  try {
    // Get all stores
    const result = await pool.query(`
      SELECT id, name, owner_id, chat_api_token, api_token
      FROM stores
      WHERE (chat_api_token IS NOT NULL OR api_token IS NOT NULL)
    `);

    console.log(`📊 Found ${result.rows.length} stores\n`);

    for (let i = 0; i < result.rows.length; i++) {
      const store = result.rows[i];
      const token = store.chat_api_token || store.api_token;

      console.log(`[${i + 1}/${result.rows.length}] ${store.name}`);

      try {
        await syncStore(store.id, store.name, token, store.owner_id);
      } catch (error) {
        console.error(`Failed: ${error.message}`);
      }

      if (i < result.rows.length - 1) {
        console.log('⏸️  Waiting 5 seconds...\n');
        await sleep(5000);
      }
    }

    console.log('\n✅ ALL STORES SYNC COMPLETE!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL:', error);
    process.exit(1);
  }
}

main();
