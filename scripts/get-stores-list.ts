import { config } from 'dotenv';
import { resolve } from 'path';
import { query } from '@/db/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface StoreRow {
  id: string;
  name: string;
  api_token: string | null;
  feedbacks_api_token: string | null;
  content_api_token: string | null;
  chat_api_token: string | null;
  created_at: string;
}

async function getStoresList() {
  console.log('\n📋 Fetching all stores from database...\n');

  const result = await query<StoreRow>(
    `SELECT
      id,
      name,
      api_token,
      feedbacks_api_token,
      content_api_token,
      chat_api_token,
      created_at
    FROM stores
    ORDER BY name, created_at`
  );

  console.log(`Found ${result.rows.length} stores\n`);

  // Group stores by similar names (ignoring numbers in parentheses)
  const grouped: { [key: string]: StoreRow[] } = {};

  for (const store of result.rows) {
    // Remove trailing numbers in parentheses and trim
    const baseName = store.name.replace(/\s*\(\d+\)\s*$/, '').replace(/\s*\d+\s*$/, '').trim();
    if (!grouped[baseName]) {
      grouped[baseName] = [];
    }
    grouped[baseName].push(store);
  }

  // Find duplicates
  const duplicates: { [key: string]: StoreRow[] } = {};
  for (const [baseName, stores] of Object.entries(grouped)) {
    if (stores.length > 1) {
      duplicates[baseName] = stores;
    }
  }

  if (Object.keys(duplicates).length === 0) {
    console.log('✅ No duplicate store names found!\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${Object.keys(duplicates).length} stores with duplicates:\n`);
  console.log('═'.repeat(80));

  const storesToDelete: { id: string; name: string; reason: string }[] = [];

  for (const [baseName, stores] of Object.entries(duplicates)) {
    console.log(`\n📦 "${baseName}" (${stores.length} entries):`);
    console.log('─'.repeat(80));

    // Sort by creation date (oldest first)
    stores.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    stores.forEach((store, idx) => {
      console.log(`\n  ${idx + 1}. ${store.name}`);
      console.log(`     ID: ${store.id}`);
      console.log(`     Created: ${new Date(store.created_at).toLocaleString('ru-RU')}`);
      console.log(`     API Token: ${store.api_token?.substring(0, 20) || 'NULL'}...`);
      console.log(`     Feedbacks Token: ${store.feedbacks_api_token?.substring(0, 20) || 'NULL'}...`);
      console.log(`     Content Token: ${store.content_api_token?.substring(0, 20) || 'NULL'}...`);
      console.log(`     Chat Token: ${store.chat_api_token?.substring(0, 20) || 'NULL'}...`);
    });

    // Check if tokens are identical
    const feedbacksTokens = stores.map(s => s.feedbacks_api_token).filter(t => t);
    const hasSameFeedbacksToken = feedbacksTokens.length > 1 && new Set(feedbacksTokens).size === 1;

    const apiTokens = stores.map(s => s.api_token).filter(t => t);
    const hasSameApiToken = apiTokens.length > 1 && new Set(apiTokens).size === 1;

    console.log('\n  🔍 Analysis:');
    if (hasSameFeedbacksToken) {
      console.log('     🚨 IDENTICAL Feedbacks API tokens - TRUE DUPLICATES!');
    } else {
      console.log('     ⚠️  Different Feedbacks API tokens - possibly different WB accounts');
    }

    if (hasSameApiToken) {
      console.log('     🚨 IDENTICAL API tokens');
    }

    // Recommend deletion (keep oldest, delete newer)
    if (hasSameFeedbacksToken || hasSameApiToken) {
      console.log('\n  📝 Recommendation: DELETE newer duplicates, KEEP oldest:');
      console.log(`     ✅ KEEP: ${stores[0].name} (ID: ${stores[0].id.substring(0, 8)}...) - Created first`);

      for (let i = 1; i < stores.length; i++) {
        console.log(`     ❌ DELETE: ${stores[i].name} (ID: ${stores[i].id.substring(0, 8)}...)`);
        storesToDelete.push({
          id: stores[i].id,
          name: stores[i].name,
          reason: hasSameFeedbacksToken ? 'Same feedbacks_api_token' : 'Same api_token'
        });
      }
    } else {
      console.log('\n  ℹ️  Different API tokens - these might be legitimate separate stores');
    }
  }

  // Summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        STORES TO DELETE                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  if (storesToDelete.length === 0) {
    console.log('✅ No stores need to be deleted (no true duplicates found)\n');
  } else {
    console.log(`Found ${storesToDelete.length} stores that should be deleted:\n`);

    storesToDelete.forEach((store, idx) => {
      console.log(`${idx + 1}. ${store.name}`);
      console.log(`   ID: ${store.id}`);
      console.log(`   Reason: ${store.reason}`);
      console.log('');
    });

    console.log('\n⚠️  ВАЖНО:');
    console.log('   При удалении магазина через интерфейс автоматически удалятся:');
    console.log('   - Все отзывы (reviews)');
    console.log('   - Все товары (products)');
    console.log('   - Все чаты (chats)');
    console.log('   - Все вопросы (questions)');
    console.log('   - Все логи (logs)');
    console.log('');

    // Save to file
    const fs = require('fs');
    const outputPath = resolve(__dirname, 'stores-to-delete.json');
    fs.writeFileSync(outputPath, JSON.stringify(storesToDelete, null, 2));
    console.log(`📄 List saved to: ${outputPath}\n`);
  }

  process.exit(0);
}

getStoresList().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
