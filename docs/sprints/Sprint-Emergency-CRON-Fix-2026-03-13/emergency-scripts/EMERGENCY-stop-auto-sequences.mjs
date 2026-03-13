#!/usr/bin/env node
/**
 * 🚨 EMERGENCY: Stop all active auto-sequences immediately
 *
 * This script:
 * 1. Finds all active auto-sequences
 * 2. Stops them with reason 'emergency_stop'
 * 3. Prevents new messages from being sent
 *
 * Usage: node scripts/EMERGENCY-stop-auto-sequences.mjs
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function emergencyStop() {
  console.log('\n🚨 ========== EMERGENCY AUTO-SEQUENCE STOP ==========');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('📋 Stopping all active auto-sequences...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get count of active sequences BEFORE stopping
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM chat_auto_sequences WHERE status = 'active'`
    );
    const activeCount = parseInt(countResult.rows[0].count);

    if (activeCount === 0) {
      console.log('✅ No active sequences found. Nothing to stop.');
      await client.query('COMMIT');
      return;
    }

    console.log(`⚠️  Found ${activeCount} active sequences to stop...`);

    // Stop all active sequences
    const stopResult = await client.query(
      `UPDATE chat_auto_sequences
       SET status = 'stopped',
           stopped_at = NOW(),
           stopped_reason = 'emergency_stop',
           updated_at = NOW()
       WHERE status = 'active'
       RETURNING id, chat_id, sequence_type, current_step, max_steps`
    );

    const stoppedSequences = stopResult.rows;

    console.log(`\n✅ Successfully stopped ${stoppedSequences.length} sequences:\n`);

    // Group by sequence type for summary
    const typeCounts = {};
    stoppedSequences.forEach(seq => {
      typeCounts[seq.sequence_type] = (typeCounts[seq.sequence_type] || 0) + 1;
    });

    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} sequences`);
    });

    // Show sample of stopped sequences
    console.log('\n📊 Sample of stopped sequences:');
    stoppedSequences.slice(0, 10).forEach(seq => {
      console.log(`   - Seq ${seq.id}: Chat ${seq.chat_id}, Type: ${seq.sequence_type}, Step: ${seq.current_step}/${seq.max_steps}`);
    });

    if (stoppedSequences.length > 10) {
      console.log(`   ... and ${stoppedSequences.length - 10} more`);
    }

    // Update chat statuses for chats that were in awaiting_reply
    const chatUpdateResult = await client.query(
      `UPDATE chats
       SET status = CASE
         WHEN last_message_sender = 'client' THEN 'inbox'
         ELSE 'in_progress'
       END,
       status_updated_at = NOW()
       WHERE status = 'awaiting_reply'
         AND id IN (SELECT DISTINCT chat_id FROM chat_auto_sequences WHERE status = 'stopped' AND stopped_reason = 'emergency_stop')
       RETURNING id, status`
    );

    if (chatUpdateResult.rows.length > 0) {
      console.log(`\n📥 Updated ${chatUpdateResult.rows.length} chat statuses from awaiting_reply`);
    }

    await client.query('COMMIT');

    console.log('\n✅ ========== EMERGENCY STOP COMPLETE ==========');
    console.log('⚠️  Next steps:');
    console.log('   1. Check logs for duplicate sending patterns');
    console.log('   2. Verify PM2 process count (should be 1 cron instance)');
    console.log('   3. Review AUTO_SEQUENCE_DRY_RUN setting');
    console.log('   4. Restart cron process if needed\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during emergency stop:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
emergencyStop().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
