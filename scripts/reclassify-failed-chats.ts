/**
 * Reclassify chats that failed with constraint error
 *
 * This script takes a list of chat IDs that got constraint errors
 * and reclassifies them with the new fixed schema
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';
import { classifyChatDeletion } from '../src/ai/flows/classify-chat-deletion-flow';

// Chat IDs that failed with constraint error (extracted from logs)
const FAILED_CHAT_IDS = [
  '1:dd5851b1-23af-831e-2bb3-919ec39a8198',
  '1:7ce03a84-abb3-1141-aa65-83fc81d43aff',
  '1:34134393-9fae-27d3-8840-96d658ae4a8c',
  '1:f73632ba-6b9f-3e54-8124-41ef7688dfcc',
  '1:f7ebdb70-7cb4-cf91-b34e-2fd712a4cb14',
  '1:a7c8723f-abe2-99be-f1b5-12e4f7c84bbe',
  '1:d284139c-3b77-5cf0-920c-e35bc1ff0a75',
  '1:4b378891-1f5c-ffaa-dd59-f21502503ae9',
  '1:ba0368ce-5eae-734d-aacd-0f9478bcaba6',
  '1:9f9a061c-d46f-b080-0cf0-8c886d74a03c',
  '1:3cfdd107-c8ab-01bf-ef42-1fe3ffc40d45',
  '1:46165fb8-ce10-9cab-bb83-ffa6b9fe848c',
  '1:9d4cf292-6d1f-9f51-7078-982e71d5f9e7',
  '1:bff678a7-48a8-0444-6912-334320ca5c76',
  '1:9756f337-d1a7-60ca-2d04-6dc768890640',
  '1:1c5eee23-a93b-2181-c123-85716d794ddf',
  '1:92feae75-823f-5b2a-7311-8e6717508318',
  '1:1785d788-e355-570f-d2ff-754905ec3d2a',
  '1:2f54440f-f375-ef47-5256-f9de0cba5fb3',
  '1:cbe213ff-2c70-b114-9894-6e9dbc2b07f6',
  '1:9992badf-2c78-f9f7-41eb-32dbcfefd747',
  '1:f048b064-488e-0c59-9f3f-042d2c2c285f',
  '1:7e6a38d0-58fd-8d70-d75d-fe440b10d4f6',
  '1:9429cadc-7e93-482e-9474-9346d6ba8e89',
  '1:4ce67d8d-bcc9-a2ea-01cc-69f699ab9b44',
  '1:0bb168fc-86ee-d0d6-99c0-1dc05b43117c',
  '1:2538be97-f234-4580-c13a-b5a223186b09',
  '1:78818d5c-b99e-897e-ad3f-68ca44c64591',
  '1:f8f13185-cb9c-60cf-3b9a-58bc5f5bb669',
  '1:df791540-38ca-ee6d-28ad-f1db75684338',
  '1:55362ee1-70b4-508e-8b66-411eddd19d6f',
  '1:2f59428f-7219-027c-c16b-83cc2c455a2b',
  '1:5a94a0b8-c8ce-faac-e640-6913355115ec',
  '1:3b962bac-0b4f-b53c-30e0-0274198229d2',
  '1:f0ad9233-2cff-e1a0-6785-6cd68290f841',
  '1:eb2ae634-d803-7649-1206-017847ffc3c5',
  '1:2f3062f3-cf62-81b1-204b-7aad0e2a607d',
  '1:794260a6-2fed-d961-4cc6-0beae2350cf6',
  '1:aea7a41d-9d59-fe63-360e-b13eae60f186',
  '1:34f5f31f-33e3-6b23-70ea-891287e05334',
  '1:78228ed1-e7d4-e142-a058-04936ec3380e',
  '1:683823eb-2be3-17f1-843e-e200a8c2633e',
  '1:2c353c3c-5d05-a707-76f3-e1e363b960ed',
  '1:e255033d-16a8-d80a-0e82-fc896e388146',
  '1:9e5fba31-7315-c130-4c1b-7256e7ca9121',
  '1:07a4d6ab-2132-b62f-24c5-c405c5813f71',
  '1:709cbcf6-38df-72e6-2bdf-0dd58df85d0e',
  '1:41f18c70-d314-8328-ffcd-0f4ea86f17ec',
  '1:46d14093-b22a-5edf-2ab7-eb6bfb82818a',
  '1:f9b17d22-fea8-e0a2-d949-85a82950b7d7',
  '1:e59bb6e3-457b-ef0e-30bc-2ca48736f18b',
  '1:2b228349-d89b-4f60-b693-06d006f90929',
  '1:9c3f9d05-7438-e968-bb47-cd5a3056e1f8',
  '1:19d1af89-1613-d5af-2c09-9569675e18ae',
  '1:72ee19d4-8f18-340f-9fca-1fd2059d4739',
  '1:4491e8c2-7364-6251-64a3-29e24de46cb6',
  '1:49a7f75a-1520-f166-c5eb-215cadb6da50',
  '1:d1299c7c-84b3-9355-3617-c99687006c2a',
  '1:cd40ebc6-2c58-de1b-0b78-810283313ddc',
  '1:fad8e7af-6526-7306-e2ca-df1cd09439f7',
  '1:0ee8b841-de57-d094-826d-b499e7cd1c83',
  '1:5d17f671-173f-9ca3-f781-680c12e9c1a1',
  '1:d5d3cebf-bf5e-fda9-8d1b-510d6f07cc3a',
];

async function reclassifyFailedChats() {
  console.log('🔧 Reclassifying chats that failed with constraint error...\n');
  console.log(`📊 Total chats to process: ${FAILED_CHAT_IDS.length}\n`);

  let successful = 0;
  let failed = 0;
  let notFound = 0;
  const tagDistribution: Record<string, number> = {};

  for (let i = 0; i < FAILED_CHAT_IDS.length; i++) {
    const chatId = FAILED_CHAT_IDS[i];
    const progress = `[${i + 1}/${FAILED_CHAT_IDS.length}]`;

    try {
      // Get chat data
      const chatResult = await query(
        `SELECT id, store_id, owner_id, last_message_text, product_name, product_nm_id
         FROM chats
         WHERE id = $1`,
        [chatId]
      );

      if (chatResult.rows.length === 0) {
        console.log(`${progress} Chat ${chatId}: ❌ Not found in database`);
        notFound++;
        continue;
      }

      const chat = chatResult.rows[0];

      // Get chat messages for history
      const messagesResult = await query(
        `SELECT sender, text, timestamp
         FROM chat_messages
         WHERE chat_id = $1
         ORDER BY timestamp ASC`,
        [chatId]
      );

      const messages = messagesResult.rows;

      if (messages.length === 0) {
        console.log(`${progress} Chat ${chatId}: ⚠️  No messages, skipping`);
        continue;
      }

      // Build chat history
      const chatHistory = messages
        .map(m => `${m.sender === 'client' ? 'Клиент' : 'Продавец'}: ${m.text || '[Вложение]'}`)
        .join('\n');

      // Classify with AI
      const result = await classifyChatDeletion({
        chatHistory,
        lastMessageText: chat.last_message_text || '',
        storeId: chat.store_id,
        ownerId: chat.owner_id,
        chatId: chat.id,
        productName: chat.product_name || undefined,
      });

      // Update chat tag
      await query(
        `UPDATE chats SET tag = $1, updated_at = NOW() WHERE id = $2`,
        [result.tag, chatId]
      );

      console.log(`${progress} Chat ${chatId}: ✅ Classified as '${result.tag}' (confidence: ${(result.confidence * 100).toFixed(0)}%)`);

      successful++;
      tagDistribution[result.tag] = (tagDistribution[result.tag] || 0) + 1;

    } catch (error: any) {
      console.log(`${progress} Chat ${chatId}: ❌ Error - ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RECLASSIFICATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`\n✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Not found: ${notFound}`);
  console.log(`📋 Total processed: ${FAILED_CHAT_IDS.length}\n`);

  if (Object.keys(tagDistribution).length > 0) {
    console.log('🏷️  Tag Distribution:');
    Object.entries(tagDistribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        console.log(`   ${tag}: ${count}`);
      });
    console.log('');
  }

  process.exit(successful === FAILED_CHAT_IDS.length ? 0 : 1);
}

reclassifyFailedChats();
