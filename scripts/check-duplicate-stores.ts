import { config } from 'dotenv';
import { resolve } from 'path';
import { query } from '@/db/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface StoreWithStats {
  id: string;
  name: string;
  api_token: string | null;
  feedbacks_api_token: string | null;
  owner_id: string;
  created_at: string;
  review_count: string;
  product_count: string;
  chat_count: string;
}

async function checkDuplicateStores() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              DUPLICATE STORES ANALYSIS                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Find stores with similar names (simplified)
  const duplicateNamesQuery = `
    SELECT
      s.id,
      s.name,
      s.api_token,
      s.feedbacks_api_token,
      s.owner_id,
      s.created_at,
      COUNT(DISTINCT r.id) as review_count,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT c.id) as chat_count
    FROM stores s
    LEFT JOIN reviews r ON r.store_id = s.id
    LEFT JOIN products p ON p.store_id = s.id
    LEFT JOIN chats c ON c.store_id = s.id
    GROUP BY s.id, s.name, s.api_token, s.feedbacks_api_token, s.owner_id, s.created_at
    ORDER BY s.name, s.created_at;
  `;

  console.log('🔍 Searching for stores with similar names...\n');

  const result = await query<StoreWithStats>(duplicateNamesQuery);

  if (result.rows.length === 0) {
    console.log('✅ No potential duplicates found based on name similarity.\n');
  } else {
    console.log(`⚠️  Found ${result.rows.length} stores with potentially similar names:\n`);

    // Group by similar names
    const grouped: { [key: string]: StoreWithStats[] } = {};

    for (const store of result.rows) {
      const baseName = store.name.replace(/\s*\(\d+\)\s*$/, '').trim();
      if (!grouped[baseName]) {
        grouped[baseName] = [];
      }
      grouped[baseName].push(store);
    }

    for (const [baseName, stores] of Object.entries(grouped)) {
      if (stores.length > 1) {
        console.log(`📦 "${baseName}" (${stores.length} stores):`);
        console.log('─'.repeat(70));

        stores.forEach((store, idx) => {
          console.log(`  ${idx + 1}. ID: ${store.id}`);
          console.log(`     Name: ${store.name}`);
          console.log(`     Created: ${new Date(store.created_at).toLocaleString()}`);
          console.log(`     Owner: ${store.owner_id}`);
          console.log(`     API Token: ${store.api_token ? `${store.api_token.substring(0, 20)}...` : 'NULL'}`);
          console.log(`     Feedbacks Token: ${store.feedbacks_api_token ? `${store.feedbacks_api_token.substring(0, 20)}...` : 'NULL'}`);
          console.log(`     Reviews: ${parseInt(store.review_count).toLocaleString()}`);
          console.log(`     Products: ${parseInt(store.product_count).toLocaleString()}`);
          console.log(`     Chats: ${parseInt(store.chat_count).toLocaleString()}`);
          console.log('');
        });
      }
    }
  }

  // Check for exact name duplicates
  console.log('\n🔍 Checking for exact name duplicates...\n');

  const exactDuplicates = await query<{ name: string; count: string }>(
    `SELECT name, COUNT(*) as count
     FROM stores
     GROUP BY name
     HAVING COUNT(*) > 1
     ORDER BY count DESC, name`
  );

  if (exactDuplicates.rows.length === 0) {
    console.log('✅ No exact name duplicates found.\n');
  } else {
    console.log(`⚠️  Found ${exactDuplicates.rows.length} exact duplicate names:\n`);
    exactDuplicates.rows.forEach((row) => {
      console.log(`  - "${row.name}": ${row.count} stores`);
    });
    console.log('');
  }

  // Check for same feedbacks API tokens (real duplicates)
  console.log('\n🔍 Checking for stores with identical Feedbacks API tokens...\n');

  const sameApiKeys = await query<StoreWithStats>(
    `SELECT
      s.id,
      s.name,
      s.api_token,
      s.feedbacks_api_token,
      s.owner_id,
      s.created_at,
      COUNT(DISTINCT r.id) as review_count,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT c.id) as chat_count
    FROM stores s
    LEFT JOIN reviews r ON r.store_id = s.id
    LEFT JOIN products p ON p.store_id = s.id
    LEFT JOIN chats c ON c.store_id = s.id
    WHERE s.feedbacks_api_token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM stores s2
      WHERE s2.id != s.id
      AND s2.feedbacks_api_token = s.feedbacks_api_token
    )
    GROUP BY s.id, s.name, s.api_token, s.feedbacks_api_token, s.owner_id, s.created_at
    ORDER BY s.feedbacks_api_token, s.created_at`
  );

  if (sameApiKeys.rows.length === 0) {
    console.log('✅ No stores with identical API keys found.\n');
  } else {
    console.log(`🚨 Found ${sameApiKeys.rows.length} stores sharing API keys (TRUE DUPLICATES):\n`);

    // Group by feedbacks API token
    const byApiKey: { [key: string]: StoreWithStats[] } = {};
    for (const store of sameApiKeys.rows) {
      const key = store.feedbacks_api_token || '';
      if (!byApiKey[key]) {
        byApiKey[key] = [];
      }
      byApiKey[key].push(store);
    }

    for (const [apiKey, stores] of Object.entries(byApiKey)) {
      console.log(`🔑 Feedbacks API Token: ${apiKey.substring(0, 30)}...`);
      console.log('─'.repeat(70));

      const totalReviews = stores.reduce((sum, s) => sum + parseInt(s.review_count), 0);
      const totalProducts = stores.reduce((sum, s) => sum + parseInt(s.product_count), 0);
      const totalChats = stores.reduce((sum, s) => sum + parseInt(s.chat_count), 0);

      stores.forEach((store, idx) => {
        console.log(`  ${idx + 1}. ${store.name} (ID: ${store.id.substring(0, 8)}...)`);
        console.log(`     Created: ${new Date(store.created_at).toLocaleString()}`);
        console.log(`     Reviews: ${parseInt(store.review_count).toLocaleString()}`);
        console.log(`     Products: ${parseInt(store.product_count).toLocaleString()}`);
        console.log(`     Chats: ${parseInt(store.chat_count).toLocaleString()}`);
      });

      console.log(`\n  📊 TOTAL for this API key:`);
      console.log(`     Reviews: ${totalReviews.toLocaleString()}`);
      console.log(`     Products: ${totalProducts.toLocaleString()}`);
      console.log(`     Chats: ${totalChats.toLocaleString()}`);
      console.log('');
    }

    console.log('\n⚠️  ВАЖНО: Магазины с одинаковым API ключом - это ДУБЛИ одного кабинета WB!');
    console.log('   Их отзывы, товары и чаты ДУБЛИРУЮТСЯ в базе данных.');
    console.log('   При удалении магазина через интерфейс - ВСЕ его данные удалятся из БД.\n');
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const totalStores = await query<{ count: string }>('SELECT COUNT(*) as count FROM stores');
  const totalReviews = await query<{ count: string }>('SELECT COUNT(*) as count FROM reviews');
  const uniqueApiKeys = await query<{ count: string }>(
    'SELECT COUNT(DISTINCT feedbacks_api_token) as count FROM stores WHERE feedbacks_api_token IS NOT NULL'
  );

  console.log(`Total stores in DB: ${parseInt(totalStores.rows[0].count)}`);
  console.log(`Unique API keys: ${parseInt(uniqueApiKeys.rows[0].count)}`);
  console.log(`Total reviews: ${parseInt(totalReviews.rows[0].count).toLocaleString()}`);
  console.log(`Stores with duplicate API keys: ${sameApiKeys.rows.length}`);

  if (sameApiKeys.rows.length > 0) {
    const duplicateStoreCount = sameApiKeys.rows.length;
    const estimatedDuplicateReviews = sameApiKeys.rows.reduce((sum, s) => sum + parseInt(s.review_count), 0) / 2;
    console.log(`\n⚠️  Estimated duplicate reviews in DB: ~${Math.round(estimatedDuplicateReviews).toLocaleString()}`);
  }

  console.log('');
  process.exit(0);
}

checkDuplicateStores().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
