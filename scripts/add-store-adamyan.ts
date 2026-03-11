/**
 * Script: Add store "ИП Адамян" to database
 *
 * This script adds a new store with WB API token and syncs its data.
 */

import { createStore, getUserSettings } from '../src/db/helpers';

// Generate Firebase-style ID (20 characters)
function generateFirebaseId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function addStoreAdamyan() {
  try {
    console.log('🏪 [Add Store] Starting to add store "ИП Адамян"...\n');

    // 1. Get owner ID from user_settings (first user)
    const userSettings = await getUserSettings();
    if (!userSettings) {
      throw new Error('User settings not found. Please ensure user exists in database.');
    }

    console.log(`✅ Found user: ${userSettings.id}`);

    // 2. Store data
    const storeId = generateFirebaseId();
    const storeData = {
      id: storeId,
      name: 'ИП Адамян',
      marketplace: 'wb' as const,
      api_token: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgzODk5NDM2LCJpZCI6IjAxOWJhY2Q4LWEwZjYtN2ViZC04YTdjLWE2MWRlMDE1ZGEwMCIsImlpZCI6NTg5Nzg1MzksIm9pZCI6MzI2MzYwLCJzIjo2NDIsInNpZCI6ImE1YzgzNzc5LWVhZTMtNGM1ZC1hOTA2LTg5ODczN2I1ZWU5YiIsInQiOmZhbHNlLCJ1aWQiOjU4OTc4NTM5fQ.OstvGdmgi_GSK-jAMXbLDPns6PFW-6YJrsLJXnFc9bBUYRWOG1q4w5kS7eVn3oaZ-lg_T0a_egLCtJcDlGPpAw',
      owner_id: userSettings.id,
      status: 'active' as const,
      stage: 'contract' as const,  // Sprint 006: new store starts at contract stage
      total_reviews: 0,
      total_chats: 0,
    };

    console.log(`📋 Store ID generated: ${storeId}`);
    console.log(`👤 Owner ID: ${userSettings.id}`);
    console.log(`🔑 API Token: ${storeData.api_token.substring(0, 30)}...`);

    // 3. Create store in database
    const newStore = await createStore(storeData);

    console.log('\n✅ Store created successfully!');
    console.log(JSON.stringify({
      id: newStore.id,
      name: newStore.name,
      status: newStore.status,
      created_at: newStore.created_at,
    }, null, 2));

    console.log('\n📝 Next steps:');
    console.log('1. Sync products: curl -X POST "http://localhost:9002/api/stores/' + storeId + '/products/update" -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"');
    console.log('2. Sync reviews: curl -X POST "http://localhost:9002/api/stores/' + storeId + '/reviews/update?mode=incremental" -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"');
    console.log('3. Check store: curl "http://localhost:9002/api/stores/' + storeId + '" -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error adding store:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
addStoreAdamyan();
