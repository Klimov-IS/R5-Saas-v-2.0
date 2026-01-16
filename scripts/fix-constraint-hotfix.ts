/**
 * HOTFIX: Recreate chats_tag_check constraint properly
 * This fixes the issue where constraint was created but PostgreSQL still uses old cached version
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { query } from '../src/db/client';

async function fixConstraint() {
  console.log('🔧 HOTFIX: Fixing chats_tag_check constraint...\n');

  try {
    // Step 1: Drop existing constraint (even if it exists)
    console.log('1️⃣  Dropping old constraint...');
    await query(`
      ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_tag_check;
    `);
    console.log('✅ Old constraint dropped\n');

    // Step 2: Create new constraint with all 12 values
    console.log('2️⃣  Creating new constraint with 12 tag values...');
    await query(`
      ALTER TABLE chats
      ADD CONSTRAINT chats_tag_check CHECK (
        tag IN (
          'untagged',
          'active',
          'successful',
          'unsuccessful',
          'no_reply',
          'completed',
          'deletion_candidate',
          'deletion_offered',
          'deletion_agreed',
          'deletion_confirmed',
          'refund_requested',
          'spam'
        )
      );
    `);
    console.log('✅ New constraint created\n');

    // Step 3: Verify constraint exists
    console.log('3️⃣  Verifying constraint...');
    const result = await query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'chats_tag_check';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Constraint verified:\n');
      console.log(`   Name: ${result.rows[0].constraint_name}`);
      console.log(`   Check: ${result.rows[0].check_clause}\n`);
    } else {
      console.log('❌ Constraint NOT found!\n');
    }

    // Step 4: Test with sample deletion_candidate tag
    console.log('4️⃣  Testing constraint with deletion_candidate...');

    // First, find a chat to test with
    const testChat = await query(`
      SELECT id FROM chats LIMIT 1;
    `);

    if (testChat.rows.length > 0) {
      const chatId = testChat.rows[0].id;

      try {
        // Try to update with deletion_candidate
        await query(`
          UPDATE chats SET tag = 'deletion_candidate' WHERE id = $1;
        `, [chatId]);

        console.log('✅ Successfully set tag to deletion_candidate!\n');

        // Restore original tag
        await query(`
          UPDATE chats SET tag = 'untagged' WHERE id = $1;
        `, [chatId]);

      } catch (err: any) {
        console.log('❌ Failed to set deletion_candidate tag:', err.message, '\n');
      }
    }

    console.log('🎉 Constraint fix complete!\n');
    console.log('📝 Next step: Restart dialogue synchronization\n');

    process.exit(0);

  } catch (error: any) {
    console.error('💥 Error fixing constraint:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

fixConstraint();
