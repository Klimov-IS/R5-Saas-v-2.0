import { config } from 'dotenv';
import { resolve } from 'path';
import { query } from '@/db/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface Store {
  id: string;
  name: string;
  feedbacks_api_token: string | null;
  api_token: string;
  last_review_update_date: string | null;
}

async function testWBApiTime() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         TESTING WB API TOKEN TIME ISSUE                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Get a store with valid token
  const storesResult = await query<Store>(
    `SELECT id, name, feedbacks_api_token, api_token, last_review_update_date
     FROM stores
     WHERE feedbacks_api_token IS NOT NULL OR api_token IS NOT NULL
     LIMIT 1`
  );

  if (storesResult.rows.length === 0) {
    console.log('❌ No stores with API tokens found');
    process.exit(1);
  }

  const store = storesResult.rows[0];
  const wbToken = store.feedbacks_api_token || store.api_token;

  console.log(`Testing store: ${store.name}`);
  console.log(`Store ID: ${store.id}`);
  console.log(`Token: ${wbToken?.substring(0, 20)}...`);
  console.log(`Last update: ${store.last_review_update_date || 'never'}\n`);

  // Calculate dateFrom (1 hour back from last update)
  const now = new Date();
  const dateFrom = store.last_review_update_date
    ? Math.floor((new Date(store.last_review_update_date).getTime() / 1000) - 3600)
    : undefined;

  console.log('🕐 Time calculations:');
  console.log(`   Server time (now): ${now.toISOString()}`);
  console.log(`   Server time (Unix): ${Math.floor(now.getTime() / 1000)}`);

  if (dateFrom) {
    console.log(`   Calculated dateFrom: ${new Date(dateFrom * 1000).toISOString()}`);
    console.log(`   Calculated dateFrom (Unix): ${dateFrom}`);

    // Check if dateFrom is in the future
    const nowUnix = Math.floor(now.getTime() / 1000);
    if (dateFrom > nowUnix) {
      console.log(`   ⚠️  WARNING: dateFrom is ${dateFrom - nowUnix} seconds in the FUTURE!`);
    }
  }

  // Test API call
  console.log('\n🔧 Testing WB API call...\n');

  const params: any = {
    isAnswered: 'false',
    take: '10',
    skip: '0',
    order: 'dateDesc'
  };
  if (dateFrom) params.dateFrom = String(dateFrom);

  const url = new URL('https://feedbacks-api.wildberries.ru/api/v1/feedbacks');
  url.search = new URLSearchParams(params).toString();

  console.log(`Request URL: ${url.toString()}`);
  console.log(`Request headers: Authorization: ${wbToken?.substring(0, 20)}...`);

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': wbToken || '' }
    });

    console.log(`\nResponse status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ SUCCESS! Fetched ${result?.data?.feedbacks?.length || 0} reviews`);
    } else {
      const errorText = await response.text();
      console.error(`\n❌ FAILED!`);
      console.error(`Response status: ${response.status} ${response.statusText}`);
      console.error(`Response body: ${errorText}`);

      if (response.status === 401) {
        console.log(`\n🔍 Debugging 401 error:`);
        console.log(`   - Check if token is valid in WB cabinet`);
        console.log(`   - Check if token has correct permissions (feedbacks scope)`);
        console.log(`   - Check if system time is synchronized with NTP server`);

        // Try again WITHOUT dateFrom
        console.log(`\n🔄 Retrying WITHOUT dateFrom parameter...`);
        const paramsNoDate: any = {
          isAnswered: 'false',
          take: '10',
          skip: '0',
          order: 'dateDesc'
        };
        const urlNoDate = new URL('https://feedbacks-api.wildberries.ru/api/v1/feedbacks');
        urlNoDate.search = new URLSearchParams(paramsNoDate).toString();

        const response2 = await fetch(urlNoDate.toString(), {
          headers: { 'Authorization': wbToken || '' }
        });

        console.log(`Response status: ${response2.status} ${response2.statusText}`);
        if (response2.ok) {
          const result2 = await response2.json();
          console.log(`✅ SUCCESS without dateFrom! Fetched ${result2?.data?.feedbacks?.length || 0} reviews`);
          console.log(`\n💡 SOLUTION: The problem is with the dateFrom parameter calculation!`);
        } else {
          const errorText2 = await response2.text();
          console.log(`❌ FAILED again: ${errorText2}`);
          console.log(`\n💡 SOLUTION: The token itself is invalid or expired. Please regenerate in WB cabinet.`);
        }
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Request failed:`, error.message);
  }

  process.exit(0);
}

testWBApiTime().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
