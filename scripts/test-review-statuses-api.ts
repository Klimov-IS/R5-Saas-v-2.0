/**
 * Test script for /api/extension/review-statuses endpoint
 *
 * Usage: npx tsx scripts/test-review-statuses-api.ts
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment
config({ path: join(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9002';
const API_TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997'; // Test token
const STORE_ID = '7kKX9WgLvOPiXYIHk6hi'; // ИП Артюшина

async function testPostEndpoint() {
  console.log('\n=== Testing POST /api/extension/review-statuses ===\n');

  const testData = {
    storeId: STORE_ID,
    parsedAt: new Date().toISOString(),
    reviews: [
      {
        reviewKey: '649502497_1_2026-01-07T20:09',
        productId: '649502497',
        rating: 1,
        reviewDate: '2026-01-07T20:09:37.000Z',
        statuses: ['Жалоба отклонена', 'Выкуп'],
        canSubmitComplaint: false
      },
      {
        reviewKey: '528735233_2_2026-01-15T14:30',
        productId: '528735233',
        rating: 2,
        reviewDate: '2026-01-15T14:30:00.000Z',
        statuses: ['Выкуп'],
        canSubmitComplaint: true
      },
      {
        reviewKey: '187489568_1_2026-01-20T09:15',
        productId: '187489568',
        rating: 1,
        reviewDate: '2026-01-20T09:15:00.000Z',
        statuses: ['Проверяем жалобу', 'Отказ'],
        canSubmitComplaint: false
      }
    ]
  };

  console.log('📤 Sending test data:');
  console.log(`   Store ID: ${testData.storeId}`);
  console.log(`   Reviews count: ${testData.reviews.length}`);
  console.log('');

  try {
    const response = await fetch(`${BASE_URL}/api/extension/review-statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log(`📥 Response status: ${response.status}`);
    console.log('📥 Response body:');
    console.log(JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      console.log('\n✅ POST test PASSED');
      return true;
    } else {
      console.log('\n❌ POST test FAILED');
      return false;
    }
  } catch (error: any) {
    console.error('\n❌ POST test ERROR:', error.message);
    return false;
  }
}

async function testGetEndpoint() {
  console.log('\n=== Testing GET /api/extension/review-statuses ===\n');

  try {
    const url = `${BASE_URL}/api/extension/review-statuses?storeId=${STORE_ID}&limit=10`;
    console.log(`📤 Fetching: ${url}\n`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    const result = await response.json();

    console.log(`📥 Response status: ${response.status}`);
    console.log('📥 Response body:');
    console.log(JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      console.log('\n✅ GET test PASSED');
      console.log(`   Total reviews: ${result.data.total}`);
      console.log(`   Can submit: ${result.data.stats.canSubmit}`);
      console.log(`   Cannot submit: ${result.data.stats.cannotSubmit}`);
      return true;
    } else {
      console.log('\n❌ GET test FAILED');
      return false;
    }
  } catch (error: any) {
    console.error('\n❌ GET test ERROR:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Review Statuses API');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Store ID: ${STORE_ID}`);

  const postResult = await testPostEndpoint();
  const getResult = await testGetEndpoint();

  console.log('\n========================================');
  console.log('📊 Test Results:');
  console.log(`   POST: ${postResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   GET:  ${getResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('========================================\n');

  process.exit(postResult && getResult ? 0 : 1);
}

main().catch(console.error);
