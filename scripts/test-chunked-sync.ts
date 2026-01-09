import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Test the new chunked sync strategy on a single store
 * This script calls the updated API endpoint to test full sync with date chunking
 */

const API_TOKEN = process.env.APP_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
const API_URL = 'http://localhost:9002';

// Get store ID from command line or use default (Тайди Центр)
const STORE_ID = process.argv[2] || 'xOMA8naL3Q9eSuR2Oewr'; // ООО "Тайди центр"

async function testChunkedSync() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         TEST CHUNKED SYNC STRATEGY                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get store info first
    console.log(`📋 Fetching store info for: ${STORE_ID}...`);
    const storeResponse = await fetch(`${API_URL}/api/stores/${STORE_ID}`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });

    if (!storeResponse.ok) {
      throw new Error(`Failed to fetch store: ${storeResponse.status}`);
    }

    const storeData = await storeResponse.json();
    console.log(`✅ Store: ${storeData.name}`);
    console.log(`   Current reviews in DB: ${storeData.total_reviews || 0}`);
    console.log(`   Last sync: ${storeData.last_review_update_date || 'Never'}\n`);

    // Start full sync
    console.log(`🔄 Starting FULL sync with date chunking...\n`);
    const startTime = Date.now();

    const syncResponse = await fetch(`${API_URL}/api/stores/${STORE_ID}/reviews/update?mode=full`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json();
      throw new Error(`Sync failed: ${syncResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await syncResponse.json();
    console.log(`\n✅ Sync completed in ${duration}s`);
    console.log(`📊 Result: ${result.message}\n`);

    // Fetch updated store stats
    console.log(`📊 Fetching updated store stats...`);
    const updatedStoreResponse = await fetch(`${API_URL}/api/stores/${STORE_ID}`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });

    if (updatedStoreResponse.ok) {
      const updatedStore = await updatedStoreResponse.json();
      console.log(`✅ Updated stats:`);
      console.log(`   Total reviews in DB: ${updatedStore.total_reviews || 0}`);
      console.log(`   Last sync: ${updatedStore.last_review_update_date}`);
      console.log(`   Status: ${updatedStore.last_review_update_status}\n`);
    }

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         TEST COMPLETED SUCCESSFULLY                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

testChunkedSync();
