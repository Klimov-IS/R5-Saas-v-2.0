/**
 * Test script for Store Onboarding Service
 *
 * Usage: npx tsx scripts/test-onboarding.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { onboardStore, isOnboardingConfigured } from '../src/services/store-onboarding';

async function main() {
  console.log('=== Store Onboarding Test ===\n');

  // Check configuration
  console.log('Checking configuration...');
  console.log('  GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✓' : '✗');
  console.log('  GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✓ (length: ' + process.env.GOOGLE_PRIVATE_KEY.length + ')' : '✗');
  console.log('  GOOGLE_DRIVE_CLIENTS_FOLDER_ID:', process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID || '(using default)');
  console.log('  GOOGLE_DRIVE_REPORT_TEMPLATE_ID:', process.env.GOOGLE_DRIVE_REPORT_TEMPLATE_ID || '(using default)');
  console.log('  isOnboardingConfigured():', isOnboardingConfigured());
  console.log('');

  if (!isOnboardingConfigured()) {
    console.error('❌ Onboarding is not configured. Check environment variables.');
    process.exit(1);
  }

  // Test store data - unique name to create new folder
  const testStoreId = 'test-store-' + Date.now();
  const testStoreName = 'Тест-' + Date.now().toString().slice(-6);

  console.log(`Testing onboarding for: ${testStoreName} (${testStoreId})\n`);

  // Run onboarding
  const result = await onboardStore(testStoreId, testStoreName);

  console.log('\n=== Result ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✅ Onboarding test PASSED');
    console.log('\nCreated resources:');
    console.log(`  📁 Folder: ${result.folderLink}`);
    console.log(`  📊 Report: ${result.reportLink}`);
    console.log(`  📸 Screenshots: ${result.screenshotsLink}`);
  } else {
    console.log('\n❌ Onboarding test FAILED');
    console.log(`  Error: ${result.error}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
