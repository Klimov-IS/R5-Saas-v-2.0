import { config } from 'dotenv';
import { resolve } from 'path';
import { query } from '@/db/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

async function checkReviewsStats() {
  console.log('\n📊 Checking reviews statistics...\n');

  // Total reviews
  const totalResult = await query<{ total: string }>(
    'SELECT COUNT(*) as total FROM reviews'
  );
  const total = parseInt(totalResult.rows[0].total);
  console.log(`Total reviews in DB: ${total.toLocaleString()}`);

  // Date range
  const dateRangeResult = await query<{ earliest: Date; latest: Date }>(
    'SELECT MIN(date) as earliest, MAX(date) as latest FROM reviews'
  );
  const { earliest, latest } = dateRangeResult.rows[0];
  console.log(`Date range: ${earliest} → ${latest}`);

  // Reviews by store
  const byStoreResult = await query<{ store_name: string; count: string; earliest: Date; latest: Date }>(
    `SELECT
      s.name as store_name,
      COUNT(r.id) as count,
      MIN(r.date) as earliest,
      MAX(r.date) as latest
    FROM reviews r
    JOIN stores s ON s.id = r.store_id
    GROUP BY s.name
    ORDER BY count DESC
    LIMIT 10`
  );

  console.log('\n📋 Top 10 stores by review count:');
  byStoreResult.rows.forEach((row, i) => {
    const count = parseInt(row.count);
    console.log(`${i + 1}. ${row.store_name}: ${count.toLocaleString()} reviews (${row.earliest?.toISOString().split('T')[0]} → ${row.latest?.toISOString().split('T')[0]})`);
  });

  // Reviews by rating
  const byRatingResult = await query<{ rating: number; count: string }>(
    `SELECT rating, COUNT(*) as count
    FROM reviews
    GROUP BY rating
    ORDER BY rating DESC`
  );

  console.log('\n⭐ Reviews by rating:');
  byRatingResult.rows.forEach((row) => {
    const count = parseInt(row.count);
    const percentage = ((count / total) * 100).toFixed(1);
    console.log(`${row.rating} ⭐: ${count.toLocaleString()} (${percentage}%)`);
  });

  // Stores with no reviews
  const noReviewsResult = await query<{ store_name: string }>(
    `SELECT s.name as store_name
    FROM stores s
    LEFT JOIN reviews r ON r.store_id = s.id
    WHERE r.id IS NULL`
  );

  if (noReviewsResult.rows.length > 0) {
    console.log(`\n⚠️  Stores with NO reviews: ${noReviewsResult.rows.length}`);
    noReviewsResult.rows.forEach((row) => {
      console.log(`   - ${row.store_name}`);
    });
  }

  // Check if we have full history or just recent
  const oldestReviewAge = await query<{ days_old: string }>(
    `SELECT EXTRACT(DAY FROM NOW() - MIN(date)) as days_old FROM reviews`
  );
  const daysOld = parseInt(oldestReviewAge.rows[0].days_old);

  console.log(`\n📅 Oldest review is ${daysOld} days old`);
  if (daysOld < 30) {
    console.log('⚠️  WARNING: We only have reviews from the last month.');
    console.log('   Consider running a FULL sync to get complete history.');
  } else if (daysOld < 180) {
    console.log('ℹ️  We have ~6 months of review history.');
  } else {
    console.log('✅ We have a good historical dataset.');
  }

  process.exit(0);
}

checkReviewsStats().catch(console.error);
