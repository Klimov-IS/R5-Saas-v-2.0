import { config } from 'dotenv';
import { resolve } from 'path';
import { query } from '@/db/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface StoreReviewCount {
  id: string;
  name: string;
  total_reviews: number | null;
}

async function checkTotalReviewsField() {
  console.log('\n📊 Comparing stores.total_reviews vs actual reviews table...\n');

  // Get top 10 stores by total_reviews field
  const topStores = await query<StoreReviewCount>(
    'SELECT id, name, total_reviews FROM stores ORDER BY total_reviews DESC NULLS LAST LIMIT 10'
  );

  console.log('Top 10 stores by total_reviews field (stores table):');
  topStores.rows.forEach((row, idx) => {
    console.log(`${idx + 1}. ${row.name}: ${row.total_reviews || 0}`);
  });

  // Sum total_reviews from stores table
  const totalFromStoresTable = await query<{ sum: string }>(
    'SELECT SUM(total_reviews) as sum FROM stores'
  );
  const sumFromStores = parseInt(totalFromStoresTable.rows[0].sum) || 0;
  console.log(`\n📊 TOTAL from stores.total_reviews field: ${sumFromStores.toLocaleString()}`);

  // Count actual reviews from reviews table
  const actualTotal = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM reviews'
  );
  const actualCount = parseInt(actualTotal.rows[0].count);
  console.log(`📊 ACTUAL TOTAL from reviews table: ${actualCount.toLocaleString()}`);

  const difference = actualCount - sumFromStores;
  console.log(`\n⚠️  DIFFERENCE: ${difference.toLocaleString()} reviews`);

  if (difference > 0) {
    console.log(`\n❌ The stores.total_reviews field is OUTDATED by ${difference.toLocaleString()} reviews!`);
    console.log('   This explains why the UI shows fewer reviews than exist in the database.');
  } else if (difference === 0) {
    console.log('\n✅ The stores.total_reviews field is UP TO DATE!');
  }

  // Check stores that were recently updated by the sync
  console.log('\n\n📋 Checking stores updated by full sync (last 2 hours):\n');
  const recentlyUpdated = await query<{
    id: string;
    name: string;
    total_reviews: number | null;
    actual_count: string;
    last_review_update_date: string;
  }>(`
    SELECT
      s.id,
      s.name,
      s.total_reviews,
      (SELECT COUNT(*) FROM reviews WHERE store_id = s.id) as actual_count,
      s.last_review_update_date
    FROM stores s
    WHERE s.last_review_update_date > NOW() - INTERVAL '2 hours'
    ORDER BY s.last_review_update_date DESC
  `);

  if (recentlyUpdated.rows.length > 0) {
    recentlyUpdated.rows.forEach((row) => {
      const actualCount = parseInt(row.actual_count);
      const storedCount = row.total_reviews || 0;
      const match = actualCount === storedCount ? '✅' : '❌';
      console.log(`${match} ${row.name}:`);
      console.log(`   stores.total_reviews = ${storedCount.toLocaleString()}`);
      console.log(`   actual reviews = ${actualCount.toLocaleString()}`);
      console.log(`   last updated: ${new Date(row.last_review_update_date).toLocaleTimeString()}`);
      console.log('');
    });
  } else {
    console.log('No stores were updated in the last 2 hours.\n');
  }

  process.exit(0);
}

checkTotalReviewsField().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
