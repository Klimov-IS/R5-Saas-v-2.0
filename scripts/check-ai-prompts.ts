/**
 * Check AI Prompts in Database
 *
 * Diagnose which prompts exist and their lengths
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

async function checkAIPrompts() {
  console.log('🔍 Checking AI Prompts in Database...\n');

  try {
    const result = await query(
      `SELECT
        prompt_chat_reply IS NOT NULL as has_chat_reply,
        prompt_chat_deletion_tag IS NOT NULL as has_deletion_tag,
        prompt_chat_tag IS NOT NULL as has_chat_tag,
        prompt_review_reply IS NOT NULL as has_review_reply,
        LENGTH(prompt_chat_reply) as chat_reply_length,
        LENGTH(prompt_chat_deletion_tag) as deletion_tag_length,
        LENGTH(prompt_chat_tag) as chat_tag_length,
        LENGTH(prompt_review_reply) as review_reply_length
       FROM user_settings LIMIT 1`
    );

    if (result.rows.length === 0) {
      console.error('❌ No user_settings found in database!');
      process.exit(1);
    }

    const data = result.rows[0];

    console.log('📊 AI Prompts Status:\n');
    console.log('┌─────────────────────────────┬────────┬─────────┐');
    console.log('│ Prompt                      │ Status │ Length  │');
    console.log('├─────────────────────────────┼────────┼─────────┤');

    const prompts = [
      { name: 'prompt_chat_reply', has: data.has_chat_reply, length: data.chat_reply_length, purpose: 'Генерация ответов' },
      { name: 'prompt_chat_deletion_tag', has: data.has_deletion_tag, length: data.deletion_tag_length, purpose: 'Deletion классификация' },
      { name: 'prompt_chat_tag', has: data.has_chat_tag, length: data.chat_tag_length, purpose: 'Общая классификация (fallback)' },
      { name: 'prompt_review_reply', has: data.has_review_reply, length: data.review_reply_length, purpose: 'Ответы на отзывы' },
    ];

    let hasIssues = false;

    prompts.forEach(p => {
      const status = p.has ? '✅' : '❌';
      const length = p.has ? `${p.length} chars` : 'NULL';
      console.log(`│ ${p.name.padEnd(27)} │ ${status}     │ ${length.padEnd(7)} │`);

      if (!p.has && p.name !== 'prompt_review_reply') {
        hasIssues = true;
      }
    });

    console.log('└─────────────────────────────┴────────┴─────────┘\n');

    // Analysis
    console.log('📋 Analysis:\n');

    if (!data.has_chat_reply) {
      console.log('⚠️  CRITICAL: prompt_chat_reply missing - AI chat generation will fail');
    } else {
      console.log('✅ prompt_chat_reply exists');
    }

    if (!data.has_deletion_tag) {
      console.log('⚠️  CRITICAL: prompt_chat_deletion_tag missing - deletion workflow broken');
    } else {
      console.log('✅ prompt_chat_deletion_tag exists');
    }

    if (!data.has_chat_tag) {
      console.log('⚠️  WARNING: prompt_chat_tag missing - no fallback for classification');
      console.log('   Impact: If deletion workflow prompt fails, classification will use regex-only');
      console.log('   Recommendation: Copy prompt_chat_deletion_tag → prompt_chat_tag');
    } else {
      console.log('✅ prompt_chat_tag exists (fallback available)');
    }

    console.log('');

    if (hasIssues) {
      console.log('🔧 Recommended Fix:');
      console.log('   Run: npx tsx scripts/fix-missing-prompts.ts');
      console.log('   Or manually restore from Firebase export\n');
      process.exit(1);
    } else {
      console.log('🎉 All prompts configured correctly!\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error checking prompts:', error);
    process.exit(1);
  }
}

checkAIPrompts();
