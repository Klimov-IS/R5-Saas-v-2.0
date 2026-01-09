import { config } from 'dotenv';
import { resolve } from 'path';
import { query } from '@/db/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface Store {
  id: string;
  name: string;
  total_reviews: number | null;
}

interface ReviewCount {
  store_id: string;
  count: string;
}

async function recalculateTotalReviews() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          RECALCULATING TOTAL_REVIEWS FIELD                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Get all stores
  const storesResult = await query<Store>('SELECT id, name, total_reviews FROM stores ORDER BY name');
  const stores = storesResult.rows;

  console.log(`Found ${stores.length} stores\n`);

  let updatedCount = 0;
  let unchangedCount = 0;

  for (const store of stores) {
    // Count actual reviews for this store
    const reviewCountResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM reviews WHERE store_id = $1',
      [store.id]
    );
    const actualCount = parseInt(reviewCountResult.rows[0].count);
    const storedCount = store.total_reviews || 0;

    if (actualCount !== storedCount) {
      // Update the total_reviews field
      await query(
        'UPDATE stores SET total_reviews = $1, updated_at = NOW() WHERE id = $2',
        [actualCount, store.id]
      );

      const diff = actualCount - storedCount;
      const sign = diff > 0 ? '+' : '';
      console.log(`✅ ${store.name}: ${storedCount.toLocaleString()} → ${actualCount.toLocaleString()} (${sign}${diff.toLocaleString()})`);
      updatedCount++;
    } else {
      unchangedCount++;
    }
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      SUMMARY                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Total stores: ${stores.length}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Already correct: ${unchangedCount}\n`);

  // Show final totals
  const totalFromStoresTable = await query<{ sum: string }>(
    'SELECT SUM(total_reviews) as sum FROM stores'
  );
  const sumFromStores = parseInt(totalFromStoresTable.rows[0].sum) || 0;

  const actualTotal = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM reviews'
  );
  const actualCount = parseInt(actualTotal.rows[0].count);

  console.log(`📊 stores.total_reviews SUM: ${sumFromStores.toLocaleString()}`);
  console.log(`📊 Actual reviews in DB: ${actualCount.toLocaleString()}`);

  if (sumFromStores === actualCount) {
    console.log('\n✅ All stores.total_reviews fields are now CORRECT!\n');
  } else {
    console.log(`\n⚠️  Difference: ${actualCount - sumFromStores} reviews\n`);
  }

  process.exit(0);
}

recalculateTotalReviews().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
