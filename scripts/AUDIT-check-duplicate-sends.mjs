#!/usr/bin/env node
/**
 * 🔍 AUDIT: Check for duplicate message sends and cron overlaps
 *
 * This script analyzes:
 * 1. Duplicate messages sent to same chat within short time window
 * 2. Multiple sequence starts for same chat
 * 3. Cron job overlaps (multiple runs at same time)
 *
 * Usage: node scripts/AUDIT-check-duplicate-sends.mjs
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function auditDuplicates() {
  console.log('\n🔍 ========== AUDIT: Duplicate Send Detection ==========');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);

  const client = await pool.connect();

  try {
    // 1. Check for duplicate messages in last 24 hours
    console.log('📧 Checking for duplicate messages (last 24 hours)...\n');

    const duplicateMessages = await client.query(
      `SELECT
         chat_id,
         text,
         COUNT(*) as send_count,
         ARRAY_AGG(timestamp ORDER BY timestamp) as timestamps,
         ARRAY_AGG(id) as message_ids
       FROM chat_messages
       WHERE timestamp > NOW() - INTERVAL '24 hours'
         AND sender = 'seller'
         AND is_auto_reply = TRUE
       GROUP BY chat_id, text
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 20`
    );

    if (duplicateMessages.rows.length > 0) {
      console.log(`⚠️  Found ${duplicateMessages.rows.length} chats with duplicate messages:\n`);

      duplicateMessages.rows.forEach(dup => {
        const timeDiffs = [];
        for (let i = 1; i < dup.timestamps.length; i++) {
          const diff = Math.round((new Date(dup.timestamps[i]) - new Date(dup.timestamps[i-1])) / 1000 / 60);
          timeDiffs.push(`${diff}min`);
        }

        console.log(`   Chat ${dup.chat_id}:`);
        console.log(`   - Sent ${dup.send_count} times`);
        console.log(`   - Time between: ${timeDiffs.join(', ')}`);
        console.log(`   - Message: "${dup.text.substring(0, 60)}..."`);
        console.log(`   - IDs: ${dup.message_ids.join(', ')}\n`);
      });
    } else {
      console.log('✅ No duplicate messages found in last 24 hours\n');
    }

    // 2. Check for multiple active sequences for same chat
    console.log('🔄 Checking for duplicate active sequences...\n');

    const duplicateSequences = await client.query(
      `SELECT
         chat_id,
         COUNT(*) as seq_count,
         ARRAY_AGG(id ORDER BY started_at) as sequence_ids,
         ARRAY_AGG(started_at ORDER BY started_at) as start_times
       FROM chat_auto_sequences
       WHERE status = 'active'
       GROUP BY chat_id
       HAVING COUNT(*) > 1`
    );

    if (duplicateSequences.rows.length > 0) {
      console.log(`⚠️  Found ${duplicateSequences.rows.length} chats with multiple active sequences:\n`);

      duplicateSequences.rows.forEach(dup => {
        console.log(`   Chat ${dup.chat_id}:`);
        console.log(`   - ${dup.seq_count} active sequences (SHOULD BE 1 MAX!)`);
        console.log(`   - Sequence IDs: ${dup.sequence_ids.join(', ')}`);
        console.log(`   - Started: ${dup.start_times.join(', ')}\n`);
      });
    } else {
      console.log('✅ No duplicate active sequences found\n');
    }

    // 3. Check for rapid sequence message sends (< 5 min apart)
    console.log('⚡ Checking for rapid sequence sends (< 5 min apart)...\n');

    const rapidSends = await client.query(
      `WITH message_pairs AS (
         SELECT
           m1.chat_id,
           m1.id as msg1_id,
           m2.id as msg2_id,
           m1.timestamp as time1,
           m2.timestamp as time2,
           EXTRACT(EPOCH FROM (m2.timestamp - m1.timestamp))/60 as minutes_apart
         FROM chat_messages m1
         INNER JOIN chat_messages m2
           ON m1.chat_id = m2.chat_id
           AND m2.timestamp > m1.timestamp
           AND m2.timestamp < m1.timestamp + INTERVAL '5 minutes'
         WHERE m1.timestamp > NOW() - INTERVAL '24 hours'
           AND m1.sender = 'seller'
           AND m2.sender = 'seller'
           AND m1.is_auto_reply = TRUE
           AND m2.is_auto_reply = TRUE
       )
       SELECT * FROM message_pairs
       WHERE minutes_apart < 5
       ORDER BY minutes_apart ASC
       LIMIT 20`
    );

    if (rapidSends.rows.length > 0) {
      console.log(`⚠️  Found ${rapidSends.rows.length} rapid sends (< 5 min):\n`);

      rapidSends.rows.forEach(send => {
        console.log(`   Chat ${send.chat_id}:`);
        console.log(`   - Messages: ${send.msg1_id} → ${send.msg2_id}`);
        console.log(`   - Time apart: ${Math.round(send.minutes_apart * 10) / 10} minutes`);
        console.log(`   - Times: ${send.time1} → ${send.time2}\n`);
      });
    } else {
      console.log('✅ No rapid sends detected\n');
    }

    // 4. Check sequence processing lock patterns
    console.log('🔒 Checking sequence processing locks...\n');

    const lockedSequences = await client.query(
      `SELECT
         id,
         chat_id,
         processing_locked_at,
         EXTRACT(EPOCH FROM (NOW() - processing_locked_at))/60 as locked_minutes
       FROM chat_auto_sequences
       WHERE processing_locked_at IS NOT NULL
         AND status = 'active'
       ORDER BY processing_locked_at DESC
       LIMIT 10`
    );

    if (lockedSequences.rows.length > 0) {
      console.log(`⚠️  Found ${lockedSequences.rows.length} sequences with active locks:\n`);

      lockedSequences.rows.forEach(seq => {
        const isStale = seq.locked_minutes > 10;
        console.log(`   Seq ${seq.id} (Chat ${seq.chat_id}):`);
        console.log(`   - Locked for: ${Math.round(seq.locked_minutes * 10) / 10} minutes ${isStale ? '⚠️  STALE (>10min)' : ''}`);
        console.log(`   - Locked at: ${seq.processing_locked_at}\n`);
      });
    } else {
      console.log('✅ No active processing locks\n');
    }

    // 5. Summary statistics
    console.log('📊 Summary Statistics (last 24 hours):\n');

    const stats = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE sender = 'seller' AND is_auto_reply = TRUE) as auto_messages_sent,
         COUNT(DISTINCT chat_id) FILTER (WHERE sender = 'seller' AND is_auto_reply = TRUE) as chats_with_auto_messages,
         COUNT(*) FILTER (WHERE status = 'active') as active_sequences_now
       FROM chat_messages
       LEFT JOIN chat_auto_sequences ON 1=1
       WHERE chat_messages.timestamp > NOW() - INTERVAL '24 hours'
          OR chat_auto_sequences.id IS NOT NULL
       GROUP BY ()::record`
    );

    const summary = stats.rows[0];
    console.log(`   - Auto messages sent: ${summary.auto_messages_sent}`);
    console.log(`   - Chats affected: ${summary.chats_with_auto_messages}`);
    console.log(`   - Active sequences now: ${summary.active_sequences_now}`);
    console.log(`   - Avg messages per chat: ${Math.round((summary.auto_messages_sent / summary.chats_with_auto_messages) * 10) / 10}\n`);

    console.log('✅ ========== AUDIT COMPLETE ==========\n');

  } catch (error) {
    console.error('\n❌ Error during audit:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
auditDuplicates().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
