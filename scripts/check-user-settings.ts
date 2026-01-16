/**
 * Check user_settings table structure and current prompts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

async function checkUserSettings() {
  console.log('🔍 Checking user_settings table...\n');

  try {
    // Check columns
    console.log('1️⃣  Checking table structure...');
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_settings'
      ORDER BY ordinal_position;
    `);

    console.log('\nColumns in user_settings:');
    columns.rows.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check current prompt values
    console.log('\n2️⃣  Checking current prompt values...');
    const settings = await query(`
      SELECT
        id,
        prompt_review_reply IS NOT NULL as has_review_prompt,
        prompt_chat_reply IS NOT NULL as has_chat_prompt,
        prompt_chat_deletion_tag IS NOT NULL as has_deletion_prompt,
        LENGTH(prompt_review_reply) as review_prompt_length,
        LENGTH(prompt_chat_reply) as chat_prompt_length,
        LENGTH(prompt_chat_deletion_tag) as deletion_prompt_length
      FROM user_settings
      LIMIT 1;
    `);

    if (settings.rows.length > 0) {
      const row = settings.rows[0];
      console.log('\nCurrent prompts status:');
      console.log(`  Review Reply Prompt: ${row.has_review_prompt ? '✅ EXISTS (' + row.review_prompt_length + ' chars)' : '❌ MISSING'}`);
      console.log(`  Chat Reply Prompt: ${row.has_chat_prompt ? '✅ EXISTS (' + row.chat_prompt_length + ' chars)' : '❌ MISSING'}`);
      console.log(`  Chat Deletion Tag Prompt: ${row.has_deletion_prompt ? '✅ EXISTS (' + row.deletion_prompt_length + ' chars)' : '❌ MISSING'}`);
    } else {
      console.log('⚠️  No user_settings record found!');
    }

    // Show sample of existing prompts if they exist
    console.log('\n3️⃣  Sample prompt content...');
    const promptSample = await query(`
      SELECT
        LEFT(prompt_review_reply, 100) as review_sample,
        LEFT(prompt_chat_reply, 100) as chat_sample,
        LEFT(prompt_chat_deletion_tag, 100) as deletion_sample
      FROM user_settings
      LIMIT 1;
    `);

    if (promptSample.rows.length > 0) {
      const sample = promptSample.rows[0];

      if (sample.review_sample) {
        console.log('\nReview Reply Prompt (first 100 chars):');
        console.log(`  "${sample.review_sample}..."`);
      }

      if (sample.chat_sample) {
        console.log('\nChat Reply Prompt (first 100 chars):');
        console.log(`  "${sample.chat_sample}..."`);
      }

      if (sample.deletion_sample) {
        console.log('\nChat Deletion Tag Prompt (first 100 chars):');
        console.log(`  "${sample.deletion_sample}..."`);
      }
    }

    console.log('\n✅ Check complete!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('💥 Error checking user_settings:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

checkUserSettings();
