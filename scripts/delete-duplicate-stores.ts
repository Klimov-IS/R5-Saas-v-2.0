import { config } from 'dotenv';
import { resolve } from 'path';
import { query } from '@/db/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const STORES_TO_DELETE = [
  {
    id: 'dkHBFs7lGKoBwhM31Sqh',
    name: 'ИП Крылов Д. Б.',
    reason: 'Same api_token'
  },
  {
    id: 'qFCXjaKxwv2vRQkBvUrM',
    name: 'ИП Пересадина Д. А.',
    reason: 'Same api_token'
  }
];

async function deleteStore(id: string, name: string) {
  console.log(`\n🗑️  Deleting store: ${name} (${id})...`);

  // Get stats before deletion
  const reviewCount = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM reviews WHERE store_id = $1',
    [id]
  );
  const productCount = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM products WHERE store_id = $1',
    [id]
  );
  const chatCount = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM chats WHERE store_id = $1',
    [id]
  );

  console.log(`   Reviews to delete: ${parseInt(reviewCount.rows[0].count).toLocaleString()}`);
  console.log(`   Products to delete: ${parseInt(productCount.rows[0].count).toLocaleString()}`);
  console.log(`   Chats to delete: ${parseInt(chatCount.rows[0].count).toLocaleString()}`);

  // Delete the store (CASCADE will delete all related data)
  const result = await query(
    'DELETE FROM stores WHERE id = $1 RETURNING id, name',
    [id]
  );

  if (result.rowCount && result.rowCount > 0) {
    console.log(`   ✅ Store deleted successfully!`);
    return {
      id,
      name,
      reviewsDeleted: parseInt(reviewCount.rows[0].count),
      productsDeleted: parseInt(productCount.rows[0].count),
      chatsDeleted: parseInt(chatCount.rows[0].count)
    };
  } else {
    console.log(`   ❌ Store not found!`);
    return null;
  }
}

async function deleteDuplicateStores() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           DELETING DUPLICATE STORES                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Stores to delete: ${STORES_TO_DELETE.length}\n`);

  const results = [];

  for (const store of STORES_TO_DELETE) {
    const result = await deleteStore(store.id, store.name);
    if (result) {
      results.push(result);
    }
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    DELETION SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Stores deleted: ${results.length}/${STORES_TO_DELETE.length}\n`);

  const totalReviewsDeleted = results.reduce((sum, r) => sum + r.reviewsDeleted, 0);
  const totalProductsDeleted = results.reduce((sum, r) => sum + r.productsDeleted, 0);
  const totalChatsDeleted = results.reduce((sum, r) => sum + r.chatsDeleted, 0);

  console.log(`Total records deleted from database:`);
  console.log(`  - Reviews: ${totalReviewsDeleted.toLocaleString()}`);
  console.log(`  - Products: ${totalProductsDeleted.toLocaleString()}`);
  console.log(`  - Chats: ${totalChatsDeleted.toLocaleString()}`);

  // Check final store count
  const finalCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM stores');
  console.log(`\n✅ Stores remaining in database: ${parseInt(finalCount.rows[0].count)}\n`);

  // Check if the stores we wanted to keep are still there
  console.log('🔍 Verifying original stores are intact...\n');

  const krylov = await query(
    'SELECT id, name FROM stores WHERE name LIKE \'%Крылов Д. Б.%\' AND id != $1',
    ['dkHBFs7lGKoBwhM31Sqh']
  );
  if (krylov.rows.length > 0) {
    console.log(`   ✅ ИП Крылов Д. Б. (original): ${krylov.rows[0].id}`);
  }

  const peresadina = await query(
    'SELECT id, name FROM stores WHERE name LIKE \'%Пересадина%\' AND id != $1',
    ['qFCXjaKxwv2vRQkBvUrM']
  );
  if (peresadina.rows.length > 0) {
    console.log(`   ✅ ИП Пересадина Д. А. (original): ${peresadina.rows[0].id}`);
  }

  console.log('\n✨ Deletion completed successfully!\n');

  process.exit(0);
}

deleteDuplicateStores().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
