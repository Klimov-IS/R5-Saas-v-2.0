#!/usr/bin/env node
/**
 * Safe Restart Auto-Sequences by Store
 *
 * Purpose: Restart stopped sequences for a specific store with safety checks
 * Ensures no duplicates, no same-day sends, and proper scheduling
 *
 * Usage:
 *   DRY_RUN=true node scripts/restart-sequences-by-store.mjs <store_id>  # Preview
 *   node scripts/restart-sequences-by-store.mjs <store_id>                # Execute
 *
 * Safety checks:
 *   - No active sequences for same chat (uses UNIQUE INDEX from migration 999)
 *   - No messages sent today to avoid duplicates
 *   - next_send_at set to tomorrow or later
 *   - Filter by minimum progress (default: step >= 3)
 *   - Check client hasn't replied
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const MIN_PROGRESS_STEP = parseInt(process.env.MIN_STEP || '3'); // Only restart sequences with progress >= 3
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default: dry run mode

async function restartSequencesByStore(storeId) {
  if (!storeId) {
    console.error('❌ Error: Store ID required');
    console.log('\nUsage: node scripts/restart-sequences-by-store.mjs <store_id>');
    console.log('');
    console.log('Examples:');
    console.log('  DRY_RUN=true node scripts/restart-sequences-by-store.mjs "abc123"  # Preview');
    console.log('  MIN_STEP=5 node scripts/restart-sequences-by-store.mjs "abc123"    # Only step 5+');
    console.log('  DRY_RUN=false node scripts/restart-sequences-by-store.mjs "abc123" # Execute');
    process.exit(1);
  }

  console.log('🔄 Safe Sequence Restart by Store\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
    console.log('   To execute: DRY_RUN=false node scripts/restart-sequences-by-store.mjs "<store_id>"\n');
  } else {
    console.log('🚀 EXECUTION MODE - Changes will be applied\n');
  }

  try {
    // 1. Get store info
    const storeResult = await pool.query(
      `SELECT id, name FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      console.error(`❌ Store not found: ${storeId}`);
      process.exit(1);
    }

    const store = storeResult.rows[0];
    console.log(`📦 Store: ${store.name}`);
    console.log(`   ID: ${store.id}`);
    console.log(`   Min progress filter: step >= ${MIN_PROGRESS_STEP}\n`);

    // 2. Find eligible sequences (with safety filters)
    console.log('🔍 Finding eligible sequences...\n');

    const eligibleResult = await pool.query(`
      SELECT
        cas.id,
        cas.chat_id,
        cas.current_step,
        cas.max_steps,
        cas.sequence_type,
        cas.last_sent_at,
        c.status as chat_status,
        c.client_name,
        c.product_name,
        (
          SELECT COUNT(*)
          FROM chat_messages cm
          WHERE cm.chat_id = cas.chat_id
            AND cm.sender = 'client'
            AND cm.timestamp > cas.started_at
        ) as client_replies,
        (
          SELECT COUNT(*)
          FROM chat_messages cm
          WHERE cm.chat_id = cas.chat_id
            AND cm.is_auto_reply = TRUE
            AND cm.timestamp >= CURRENT_DATE
        ) as messages_sent_today,
        (
          SELECT COUNT(*)
          FROM chat_auto_sequences cas2
          WHERE cas2.chat_id = cas.chat_id
            AND cas2.status = 'active'
        ) as active_sequences_for_chat
      FROM chat_auto_sequences cas
      JOIN chats c ON c.id = cas.chat_id
      WHERE cas.store_id = $1
        AND cas.status = 'stopped'
        AND cas.stop_reason = 'emergency_stop_2026_03_13'
        AND cas.current_step >= $2
        AND c.status IN ('inbox', 'in_progress', 'awaiting_reply')
      ORDER BY cas.current_step DESC, cas.last_sent_at DESC
    `, [storeId, MIN_PROGRESS_STEP]);

    console.log(`Found ${eligibleResult.rows.length} potentially eligible sequences\n`);

    if (eligibleResult.rows.length === 0) {
      console.log('✅ No sequences to restart (all filtered out or already restarted)');
      await pool.end();
      return;
    }

    // 3. Apply safety filters
    console.log('🛡️  Applying safety filters...\n');

    const filtered = {
      clientReplied: [],
      sentToday: [],
      chatClosed: [],
      alreadyActive: [],
      safe: []
    };

    eligibleResult.rows.forEach(seq => {
      if (seq.client_replies > 0) {
        filtered.clientReplied.push(seq);
      } else if (seq.messages_sent_today > 0) {
        filtered.sentToday.push(seq);
      } else if (!['inbox', 'in_progress', 'awaiting_reply'].includes(seq.chat_status)) {
        filtered.chatClosed.push(seq);
      } else if (seq.active_sequences_for_chat > 0) {
        filtered.alreadyActive.push(seq);
      } else {
        filtered.safe.push(seq);
      }
    });

    console.log('Safety Filter Results:');
    console.log(`  ✅ Safe to restart: ${filtered.safe.length}`);
    console.log(`  ⚠️  Client replied (skip): ${filtered.clientReplied.length}`);
    console.log(`  ⚠️  Messages sent today (skip): ${filtered.sentToday.length}`);
    console.log(`  ⚠️  Chat closed (skip): ${filtered.chatClosed.length}`);
    console.log(`  ⚠️  Already has active sequence (skip): ${filtered.alreadyActive.length}`);
    console.log('');

    if (filtered.safe.length === 0) {
      console.log('✅ No safe sequences to restart after filtering');
      await pool.end();
      return;
    }

    // 4. Show distribution of safe sequences
    const distribution = {};
    filtered.safe.forEach(seq => {
      distribution[seq.current_step] = (distribution[seq.current_step] || 0) + 1;
    });

    console.log('📊 Distribution of safe sequences by progress:');
    Object.entries(distribution)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .forEach(([step, count]) => {
        console.log(`   Step ${step}: ${count} sequences`);
      });
    console.log('');

    // 5. Preview sequences to restart
    console.log('📋 Sequences to restart (first 10):');
    console.log('─────────────────────────────────────────────────────────────');
    filtered.safe.slice(0, 10).forEach((seq, idx) => {
      console.log(`${idx + 1}. Chat: ${seq.client_name} (${seq.product_name || 'N/A'})`);
      console.log(`   Progress: ${seq.current_step}/${seq.max_steps} (type: ${seq.sequence_type})`);
      console.log(`   Last sent: ${seq.last_sent_at || 'Never'}`);
      console.log(`   Status: ${seq.chat_status}`);
      console.log('');
    });

    if (filtered.safe.length > 10) {
      console.log(`... and ${filtered.safe.length - 10} more\n`);
    }

    // 6. Calculate next send time (tomorrow + random hour 10-17 MSK)
    const getNextSendTime = () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(7 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0); // 10-17 MSK = 7-14 UTC
      return tomorrow.toISOString();
    };

    // 7. Execute restart (if not dry run)
    if (DRY_RUN) {
      console.log('⚠️  DRY RUN - No changes made');
      console.log('');
      console.log('To execute:');
      console.log(`  DRY_RUN=false node scripts/restart-sequences-by-store.mjs "${storeId}"`);
    } else {
      console.log('🚀 Restarting sequences...\n');

      let restarted = 0;
      let failed = 0;

      for (const seq of filtered.safe) {
        try {
          const nextSendAt = getNextSendTime();

          await pool.query(`
            UPDATE chat_auto_sequences
            SET
              status = 'active',
              stop_reason = NULL,
              next_send_at = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [nextSendAt, seq.id]);

          restarted++;
          console.log(`✅ Restarted: ${seq.client_name} (step ${seq.current_step}/${seq.max_steps}, next send: ${nextSendAt})`);
        } catch (error) {
          failed++;
          console.error(`❌ Failed: ${seq.client_name} - ${error.message}`);
        }
      }

      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📊 RESTART SUMMARY:');
      console.log(`   ✅ Successfully restarted: ${restarted}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`   ⏭️  Skipped (safety filters): ${eligibleResult.rows.length - filtered.safe.length}`);
      console.log('═══════════════════════════════════════════════════════════════');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Get store ID from command line
const storeId = process.argv[2];
restartSequencesByStore(storeId);
