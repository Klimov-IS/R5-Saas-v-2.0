#!/usr/bin/env node
/**
 * Analyze Stopped Auto-Sequences
 *
 * Purpose: Audit all sequences stopped during emergency (2026-03-13)
 * Shows breakdown by store, sequence type, progress, and last activity
 *
 * Usage: node scripts/analyze-stopped-sequences.mjs
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

async function analyzeStoppedSequences() {
  console.log('🔍 Analyzing Stopped Auto-Sequences (Emergency Stop 2026-03-13)\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Overall stats
    const overallStats = await pool.query(`
      SELECT
        COUNT(*) as total_stopped,
        COUNT(DISTINCT store_id) as stores_affected,
        COUNT(DISTINCT chat_id) as chats_affected,
        MIN(updated_at) as first_stopped,
        MAX(updated_at) as last_stopped
      FROM chat_auto_sequences
      WHERE status = 'stopped'
        AND stop_reason = 'emergency_stop_2026_03_13'
    `);

    const stats = overallStats.rows[0];
    console.log('📊 OVERALL STATISTICS:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Total stopped sequences: ${stats.total_stopped}`);
    console.log(`Stores affected: ${stats.stores_affected}`);
    console.log(`Chats affected: ${stats.chats_affected}`);
    console.log(`First stopped: ${stats.first_stopped}`);
    console.log(`Last stopped: ${stats.last_stopped}`);
    console.log('');

    // 2. Breakdown by store
    console.log('📦 BREAKDOWN BY STORE:');
    console.log('─────────────────────────────────────────────────────────────');

    const byStore = await pool.query(`
      SELECT
        s.name as store_name,
        s.id as store_id,
        COUNT(*) as sequences_count,
        COUNT(DISTINCT cas.chat_id) as chats_count,
        ROUND(AVG(cas.current_step), 1) as avg_progress,
        MIN(cas.current_step) as min_step,
        MAX(cas.current_step) as max_step,
        COUNT(*) FILTER (WHERE cas.current_step = 0) as step_0,
        COUNT(*) FILTER (WHERE cas.current_step BETWEEN 1 AND 2) as step_1_2,
        COUNT(*) FILTER (WHERE cas.current_step BETWEEN 3 AND 4) as step_3_4,
        COUNT(*) FILTER (WHERE cas.current_step >= 5) as step_5_plus
      FROM chat_auto_sequences cas
      JOIN stores s ON s.id = cas.store_id
      WHERE cas.status = 'stopped'
        AND cas.stop_reason = 'emergency_stop_2026_03_13'
      GROUP BY s.name, s.id
      ORDER BY sequences_count DESC
    `);

    byStore.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.store_name}`);
      console.log(`   Store ID: ${row.store_id}`);
      console.log(`   Sequences: ${row.sequences_count} | Chats: ${row.chats_count}`);
      console.log(`   Progress: avg=${row.avg_progress}, min=${row.min_step}, max=${row.max_step}`);
      console.log(`   Distribution: step_0=${row.step_0}, step_1-2=${row.step_1_2}, step_3-4=${row.step_3_4}, step_5+=${row.step_5_plus}`);
      console.log('');
    });

    // 3. Breakdown by sequence type
    console.log('📝 BREAKDOWN BY SEQUENCE TYPE:');
    console.log('─────────────────────────────────────────────────────────────');

    const byType = await pool.query(`
      SELECT
        sequence_type,
        COUNT(*) as count,
        ROUND(AVG(current_step), 1) as avg_step,
        MIN(current_step) as min_step,
        MAX(current_step) as max_step
      FROM chat_auto_sequences
      WHERE status = 'stopped'
        AND stop_reason = 'emergency_stop_2026_03_13'
      GROUP BY sequence_type
      ORDER BY count DESC
    `);

    byType.rows.forEach(row => {
      console.log(`${row.sequence_type}:`);
      console.log(`  Count: ${row.count}`);
      console.log(`  Progress: avg=${row.avg_step}, min=${row.min_step}, max=${row.max_step}`);
      console.log('');
    });

    // 4. Check for messages sent today
    console.log('📅 MESSAGES SENT TODAY (potential duplicates if restarted):');
    console.log('─────────────────────────────────────────────────────────────');

    const sentToday = await pool.query(`
      SELECT
        s.name as store_name,
        COUNT(*) as messages_today,
        COUNT(DISTINCT cm.chat_id) as chats_with_messages
      FROM chat_messages cm
      JOIN chats c ON c.id = cm.chat_id
      JOIN stores s ON s.id = c.store_id
      WHERE cm.is_auto_reply = TRUE
        AND cm.timestamp >= CURRENT_DATE
      GROUP BY s.name
      ORDER BY messages_today DESC
    `);

    if (sentToday.rows.length === 0) {
      console.log('✅ No auto-sequence messages sent today (safe to restart)');
    } else {
      sentToday.rows.forEach(row => {
        console.log(`⚠️  ${row.store_name}: ${row.messages_today} messages in ${row.chats_with_messages} chats`);
      });
    }
    console.log('');

    // 5. Restart recommendations
    console.log('💡 RESTART RECOMMENDATIONS:');
    console.log('─────────────────────────────────────────────────────────────');

    const highProgress = await pool.query(`
      SELECT COUNT(*) as count
      FROM chat_auto_sequences
      WHERE status = 'stopped'
        AND stop_reason = 'emergency_stop_2026_03_13'
        AND current_step >= 5
    `);

    const mediumProgress = await pool.query(`
      SELECT COUNT(*) as count
      FROM chat_auto_sequences
      WHERE status = 'stopped'
        AND stop_reason = 'emergency_stop_2026_03_13'
        AND current_step BETWEEN 3 AND 4
    `);

    const lowProgress = await pool.query(`
      SELECT COUNT(*) as count
      FROM chat_auto_sequences
      WHERE status = 'stopped'
        AND stop_reason = 'emergency_stop_2026_03_13'
        AND current_step <= 2
    `);

    console.log(`High Progress (steps 5+): ${highProgress.rows[0].count} sequences`);
    console.log(`  → Recommended: Safe to restart (significant investment)`);
    console.log('');
    console.log(`Medium Progress (steps 3-4): ${mediumProgress.rows[0].count} sequences`);
    console.log(`  → Consider: Review individually before restart`);
    console.log('');
    console.log(`Low Progress (steps 0-2): ${lowProgress.rows[0].count} sequences`);
    console.log(`  → Not recommended: Better to create new sequences`);
    console.log('');

    // 6. Export store list for manual restart
    console.log('📋 STORES FOR MANUAL RESTART:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Use: node scripts/restart-sequences-by-store.mjs <store_id>\n');

    byStore.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.store_name}`);
      console.log(`   Command: node scripts/restart-sequences-by-store.mjs "${row.store_id}"`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error analyzing sequences:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

analyzeStoppedSequences();
