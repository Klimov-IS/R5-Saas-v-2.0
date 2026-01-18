/**
 * Add fallback prompt_chat_tag
 *
 * Copies prompt_chat_deletion_tag → prompt_chat_tag as fallback
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

async function addFallbackPrompt() {
  console.log('🔧 Adding fallback prompt_chat_tag...\n');

  try {
    // Check if prompt_chat_tag already exists
    console.log('1️⃣  Checking current state...');
    const checkResult = await query(`
      SELECT
        prompt_chat_tag IS NOT NULL as has_chat_tag,
        prompt_chat_deletion_tag IS NOT NULL as has_deletion_tag
      FROM user_settings
      LIMIT 1;
    `);

    if (checkResult.rows.length === 0) {
      console.log('❌ No user_settings record found!\n');
      process.exit(1);
    }

    const state = checkResult.rows[0];

    if (state.has_chat_tag) {
      console.log('✅ prompt_chat_tag already exists - nothing to do!\n');
      process.exit(0);
    }

    if (!state.has_deletion_tag) {
      console.log('❌ prompt_chat_deletion_tag missing - cannot create fallback!\n');
      console.log('   Run migration 20260116_002_add_deletion_classification_prompt.sql first\n');
      process.exit(1);
    }

    // Copy deletion tag prompt → chat tag prompt
    console.log('2️⃣  Copying prompt_chat_deletion_tag → prompt_chat_tag...');
    await query(`
      UPDATE user_settings
      SET prompt_chat_tag = prompt_chat_deletion_tag
      WHERE prompt_chat_tag IS NULL;
    `);
    console.log('✅ Fallback prompt created!\n');

    // Verify
    console.log('3️⃣  Verifying...');
    const verifyResult = await query(`
      SELECT
        prompt_chat_tag IS NOT NULL as has_chat_tag,
        LENGTH(prompt_chat_tag) as chat_tag_length
      FROM user_settings
      LIMIT 1;
    `);

    if (verifyResult.rows.length > 0) {
      const verify = verifyResult.rows[0];
      if (verify.has_chat_tag) {
        console.log(`✅ Verification successful!`);
        console.log(`   prompt_chat_tag length: ${verify.chat_tag_length} characters\n`);
      } else {
        console.log('❌ Verification failed - prompt still missing!\n');
        process.exit(1);
      }
    }

    console.log('🎉 Fallback prompt added successfully!\n');
    console.log('📋 Impact:');
    console.log('   - AI classification now has fallback path');
    console.log('   - "No AI prompt found" warnings should disappear');
    console.log('   - Cron job will use AI for classification\n');

    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error adding fallback prompt:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

addFallbackPrompt();
