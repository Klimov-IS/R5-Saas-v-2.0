#!/usr/bin/env tsx
/**
 * Script to sync products for newly added stores
 * Usage: npx tsx scripts/sync-new-stores-products.ts
 */

const API_URL = 'http://localhost:9002/api/stores';
const API_KEY = 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

// IDs of newly added stores (from add-new-stores.ts output)
const NEW_STORE_IDS = [
  { id: 'bTOtBtK5qDiydqEQmbB7', name: 'ИП Чаевцев Р. Ю.' },
  { id: '6TbcNUQ6tt8AWfJU8YDI', name: 'ИП Крылов Б. В.' },
  { id: 'dkHBFs7lGKoBwhM31Sqh', name: 'ИП Крылов Д. Б.' },
  { id: '7A1nEmSYSi1ejHkeqB2j', name: 'ИП Русаков Р. А.' },
  { id: 'wI7Qwj7ScOdqqVDtwJKv', name: 'ИП Русакова Н. Р.' },
  { id: '1Hjrlzp1OLfYNmgC6HQd', name: 'ИП Тургунов Ф. Ф.' }
];

/**
 * Sync products for a single store
 */
async function syncProducts(storeId: string, storeName: string) {
  console.log(`\n🔄 Syncing products for: ${storeName}`);
  console.log(`   Store ID: ${storeId}`);

  try {
    const response = await fetch(`${API_URL}/${storeId}/products/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Failed: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      return { success: false, storeId, name: storeName, error: errorText };
    }

    const result = await response.json();
    console.log(`   ✅ Success! ${result.message || 'Products synced'}`);
    return { success: true, storeId, name: storeName, message: result.message };

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, storeId, name: storeName, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting products sync for new stores...\n');
  console.log(`📊 Total stores to sync: ${NEW_STORE_IDS.length}`);
  console.log('─'.repeat(60));

  const results = [];

  for (const store of NEW_STORE_IDS) {
    const result = await syncProducts(store.id, store.name);
    results.push(result);

    // Delay between requests to avoid overloading
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📈 Summary:');
  console.log(`   Total: ${results.length}`);
  console.log(`   ✅ Success: ${results.filter(r => r.success).length}`);
  console.log(`   ❌ Failed: ${results.filter(r => !r.success).length}`);

  if (results.some(r => r.success)) {
    console.log('\n✅ Successfully synced:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.name}`);
    });
  }

  if (results.some(r => !r.success)) {
    console.log('\n❌ Failed syncs:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n🎉 Done!\n');
}

// Run the script
main().catch(console.error);
