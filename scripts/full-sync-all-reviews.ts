import { config } from 'dotenv';
import { resolve } from 'path';
import * as dbHelpers from '@/db/helpers';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

interface SyncResult {
  storeId: string;
  storeName: string;
  success: boolean;
  reviewsAdded: number;
  error?: string;
  duration: number;
}

async function syncStoreReviews(storeId: string, storeName: string): Promise<SyncResult> {
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] 🔄 Starting FULL sync for: ${storeName}`);

  try {
    const response = await fetch(`${BASE_URL}/api/stores/${storeId}/reviews/update?mode=full`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Failed (HTTP ${response.status}): ${errorText.substring(0, 100)}`);
      return {
        storeId,
        storeName,
        success: false,
        reviewsAdded: 0,
        error: `HTTP ${response.status}`,
        duration,
      };
    }

    const result = await response.json();
    const reviewsAdded = result.message?.match(/\d+/)?.[0] || 0;
    console.log(`✅ Success: ${reviewsAdded} reviews (${duration}s)`);

    return {
      storeId,
      storeName,
      success: true,
      reviewsAdded: parseInt(reviewsAdded as string),
      duration,
    };
  } catch (error: any) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`❌ Error: ${error.message}`);
    return {
      storeId,
      storeName,
      success: false,
      reviewsAdded: 0,
      error: error.message,
      duration,
    };
  }
}

async function fullSyncAllStores() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         FULL REVIEW SYNC FOR ALL STORES                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  // Get all stores
  console.log('📋 Fetching all stores...');
  const stores = await dbHelpers.getAllStores();
  console.log(`Found ${stores.length} stores\n`);

  const results: SyncResult[] = [];
  let totalReviewsAdded = 0;

  // Sync each store
  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    console.log(`\n[${i + 1}/${stores.length}] Processing: ${store.name}`);

    const result = await syncStoreReviews(store.id, store.name);
    results.push(result);
    totalReviewsAdded += result.reviewsAdded;

    // Delay between stores to avoid rate limiting
    if (i < stores.length - 1) {
      console.log('⏳ Waiting 3 seconds before next store...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Summary
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    SYNC COMPLETED                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Summary:');
  console.log(`   Total stores: ${stores.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📝 Total reviews added: ${totalReviewsAdded.toLocaleString()}`);
  console.log(`   ⏱️  Total duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s\n`);

  // Failed stores
  if (failureCount > 0) {
    console.log('⚠️  Failed stores:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   - ${r.storeName}: ${r.error}`);
      });
    console.log('');
  }

  // Top stores by reviews added
  const topStores = results
    .filter(r => r.success && r.reviewsAdded > 0)
    .sort((a, b) => b.reviewsAdded - a.reviewsAdded)
    .slice(0, 10);

  if (topStores.length > 0) {
    console.log('🏆 Top stores by reviews added:');
    topStores.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.storeName}: ${r.reviewsAdded.toLocaleString()} reviews`);
    });
    console.log('');
  }

  // Check final DB stats
  console.log('📈 Checking final database stats...\n');
  const { query } = await import('@/db/client');
  const totalResult = await query<{ total: string }>('SELECT COUNT(*) as total FROM reviews');
  const total = parseInt(totalResult.rows[0].total);
  console.log(`🎉 Total reviews in database: ${total.toLocaleString()}\n`);

  process.exit(0);
}

fullSyncAllStores().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
