#!/usr/bin/env node
/**
 * Sync All Chat History Script
 *
 * Loads full chat history for all stores from Wildberries API
 * Can run in background independently (close laptop and it continues)
 *
 * Usage:
 *   npx tsx scripts/sync-all-chat-history.ts
 *
 * Or in background:
 *   nohup npx tsx scripts/sync-all-chat-history.ts > logs/sync.log 2>&1 &
 */

import { query } from '../src/db/client';
import { fetchWBAllChats, fetchWBAllEvents, sleep, retryWithBackoff } from '../src/lib/wb-chat-sync';
// import { classifyChatDeletion } from '../src/ai/flows/classify-chat-deletion-flow'; // Skip AI for now

interface SyncLog {
  id: number;
  store_id: string;
  chats_total: number;
  chats_synced: number;
  messages_added: number;
  chats_classified: number;
}

// ============================================================================
// Database Helpers
// ============================================================================

async function createSyncLog(storeId: string): Promise<number> {
  const result = await query(`
    INSERT INTO sync_logs (store_id, sync_type, status, started_at)
    VALUES ($1, 'chat_history', 'running', NOW())
    RETURNING id
  `, [storeId]);
  return result.rows[0].id;
}

async function updateSyncLog(logId: number, updates: Partial<SyncLog> & { status?: string; error_message?: string }) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.chats_total !== undefined) {
    fields.push(`chats_total = $${paramIndex++}`);
    values.push(updates.chats_total);
  }
  if (updates.chats_synced !== undefined) {
    fields.push(`chats_synced = $${paramIndex++}`);
    values.push(updates.chats_synced);
  }
  if (updates.messages_added !== undefined) {
    fields.push(`messages_added = $${paramIndex++}`);
    values.push(updates.messages_added);
  }
  if (updates.chats_classified !== undefined) {
    fields.push(`chats_classified = $${paramIndex++}`);
    values.push(updates.chats_classified);
  }
  if (updates.status) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.error_message) {
    fields.push(`error_message = $${paramIndex++}`);
    values.push(updates.error_message);
  }

  if (updates.status === 'success' || updates.status === 'error') {
    fields.push('completed_at = NOW()');
  }

  values.push(logId);

  await query(`
    UPDATE sync_logs
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
  `, values);
}

// ============================================================================
// Sync Logic
// ============================================================================

async function syncStoreHistory(storeId: string, storeName: string, token: string, ownerId: string): Promise<void> {
  const logId = await createSyncLog(storeId);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[SYNC] Starting sync for store: ${storeName} (${storeId})`);
  console.log(`${'='.repeat(80)}\n`);

  let totalMessagesAdded = 0;
  let chatsSynced = 0;

  try {
    // Step 1: Fetch all chats from WB
    console.log(`[SYNC] Step 1: Fetching all chats from WB API...`);
    const chats = await retryWithBackoff(() => fetchWBAllChats(token));
    console.log(`[SYNC] ✅ Found ${chats.length} chats\n`);

    await updateSyncLog(logId, { chats_total: chats.length });

    // Step 2: Fetch ALL events (messages) from WB API
    // NOTE: WB API doesn't have /chats/{id}/messages endpoint
    // We must load all events from the beginning (without cursor)
    console.log(`[SYNC] Step 2: Fetching ALL message events from WB API...`);
    console.log(`[SYNC] This will load full history from the beginning (no cursor)\n`);

    const events = await retryWithBackoff(() => fetchWBAllEvents(token, null));

    console.log(`[SYNC] Processing ${events.length} events...`);

    // Group events by chat
    const chatMessages: { [chatId: string]: any[] } = {};

    for (const event of events) {
      if (event.eventType === 'message' && event.chatID) {
        if (!chatMessages[event.chatID]) {
          chatMessages[event.chatID] = [];
        }
        chatMessages[event.chatID].push(event);
      }
    }

    console.log(`[SYNC] Found messages for ${Object.keys(chatMessages).length} chats\n`);

    // Save messages to database
    for (const [chatId, messages] of Object.entries(chatMessages)) {
      try {
        for (const event of messages) {
          await query(`
            INSERT INTO chat_messages (
              id, chat_id, store_id, owner_id, text, sender, timestamp, download_id
            )
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

        // Update chat's last_message fields
        const lastEvent = messages[messages.length - 1];
        await query(`
          UPDATE chats
          SET
            last_message_text = $1,
            last_message_sender = $2,
            last_message_date = $3
          WHERE id = $4
        `, [
          lastEvent.message?.text || 'Вложение',
          lastEvent.sender,
          lastEvent.addTime,
          chatId
        ]);

        totalMessagesAdded += messages.length;
        chatsSynced++;

        if (chatsSynced % 10 === 0) {
          console.log(`  Processed ${chatsSynced} chats, ${totalMessagesAdded} messages...`);
          await updateSyncLog(logId, {
            chats_synced: chatsSynced,
            messages_added: totalMessagesAdded
          });
        }

      } catch (error: any) {
        console.error(`  ❌ Chat ${chatId}: ${error.message}`);
      }
    }

    await updateSyncLog(logId, {
      chats_synced: chatsSynced,
      messages_added: totalMessagesAdded
    });

    console.log(`\n[SYNC] Step 2 Complete: ${chatsSynced} chats synced, ${totalMessagesAdded} messages added\n`);

    // Step 3: AI Classification (SKIPPED for speed)
    console.log(`[SYNC] Step 3: Skipping AI classification (can run separately later)\n`);
    const classified = 0;
    await updateSyncLog(logId, { chats_classified: classified });

    // Step 4: Update store statistics
    console.log(`[SYNC] Step 4: Updating store statistics...`);
    const tagCounts = await query(`
      SELECT
        COUNT(*) FILTER (WHERE tag = 'active') as active,
        COUNT(*) FILTER (WHERE tag = 'untagged') as untagged,
        COUNT(*) FILTER (WHERE tag = 'deletion_candidate') as deletion_candidate,
        COUNT(*) FILTER (WHERE tag = 'deletion_offered') as deletion_offered,
        COUNT(*) FILTER (WHERE tag = 'deletion_agreed') as deletion_agreed,
        COUNT(*) FILTER (WHERE tag = 'deletion_confirmed') as deletion_confirmed,
        COUNT(*) FILTER (WHERE tag = 'refund_requested') as refund_requested,
        COUNT(*) FILTER (WHERE tag = 'spam') as spam
      FROM chats
      WHERE store_id = $1
    `, [storeId]);

    await query(`
      UPDATE stores
      SET chat_tag_counts = $1
      WHERE id = $2
    `, [JSON.stringify(tagCounts.rows[0]), storeId]);

    console.log(`[SYNC] ✅ Store statistics updated\n`);

    // Mark as success
    await updateSyncLog(logId, { status: 'success' });

    console.log(`${'='.repeat(80)}`);
    console.log(`[SYNC] ✅ COMPLETE: ${storeName}`);
    console.log(`       Chats: ${chatsSynced}/${chats.length}`);
    console.log(`       Messages: ${totalMessagesAdded}`);
    console.log(`       Classified: ${classified}`);
    console.log(`${'='.repeat(80)}\n`);

  } catch (error: any) {
    console.error(`\n[SYNC] ❌ ERROR: ${error.message}\n`);
    await updateSyncLog(logId, {
      status: 'error',
      error_message: error.message
    });
    throw error;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('\n🚀 Starting Chat History Sync for ALL stores...\n');
  console.log('⚠️  This will run in background. You can close this terminal.\n');

  try {
    // Get all stores
    const storesResult = await query(`
      SELECT id, name, owner_id, chat_api_token, api_token
      FROM stores
      WHERE (chat_api_token IS NOT NULL OR api_token IS NOT NULL)
    `);

    const stores = storesResult.rows;
    console.log(`📊 Found ${stores.length} stores to sync\n`);

    // Process each store
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      const token = store.chat_api_token || store.api_token;

      console.log(`\n[${i + 1}/${stores.length}] Processing: ${store.name}`);

      try {
        await syncStoreHistory(store.id, store.name, token, store.owner_id);
      } catch (error: any) {
        console.error(`Failed to sync store ${store.name}: ${error.message}`);
        console.log('Continuing with next store...\n');
      }

      // Delay between stores to avoid overwhelming the API
      if (i < stores.length - 1) {
        console.log('⏸️  Waiting 5 seconds before next store...\n');
        await sleep(5000);
      }
    }

    console.log('\n✅ ALL STORES SYNC COMPLETE!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
