/**
 * Close Old Chats Migration Script
 *
 * Automatically closes all chats where the last message was sent 3+ months ago.
 * Logic: If a chat has been inactive for 3 months, it's likely not related to our business.
 *
 * Usage: npx tsx scripts/close-old-chats.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

interface ChatRow {
  id: string;
  client_name: string;
  last_message_date: string | null;
  status: string | null;
  store_id: string;
}

async function closeOldChats() {
  console.log('🔍 [CLOSE-OLD-CHATS] Starting migration...\n');

  try {
    // Calculate date 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoffDate = threeMonthsAgo.toISOString();

    console.log(`📅 Cutoff date: ${cutoffDate} (${threeMonthsAgo.toLocaleDateString('ru-RU')})`);
    console.log(`📊 Chats with last_message_date BEFORE this date will be closed\n`);

    // Find all chats where last_message_date is older than 3 months OR null
    const findQuery = `
      SELECT
        id,
        client_name,
        last_message_date,
        status,
        store_id
      FROM chats
      WHERE
        (last_message_date IS NULL OR last_message_date < $1)
        AND status != 'closed'
      ORDER BY last_message_date ASC NULLS FIRST
    `;

    const { rows: oldChats } = await pool.query<ChatRow>(findQuery, [cutoffDate]);

    if (oldChats.length === 0) {
      console.log('✅ No old chats found that need to be closed');
      await pool.end();
      return;
    }

    console.log(`🎯 Found ${oldChats.length} old chats to close:\n`);

    // Show sample of chats that will be closed
    const sampleSize = Math.min(10, oldChats.length);
    console.log(`📋 Sample (showing first ${sampleSize} of ${oldChats.length}):`);
    oldChats.slice(0, sampleSize).forEach((chat, index) => {
      const lastMessageDate = chat.last_message_date
        ? new Date(chat.last_message_date).toLocaleDateString('ru-RU')
        : 'NULL (no messages)';
      console.log(`   ${index + 1}. Chat ${chat.id.substring(0, 20)}... | Client: ${chat.client_name || 'Unknown'} | Last message: ${lastMessageDate} | Current status: ${chat.status || 'NULL'}`);
    });

    if (oldChats.length > sampleSize) {
      console.log(`   ... and ${oldChats.length - sampleSize} more chats\n`);
    } else {
      console.log('');
    }

    // Breakdown by current status
    const statusBreakdown: Record<string, number> = {};
    oldChats.forEach(chat => {
      const status = chat.status || 'NULL';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    console.log('📊 Breakdown by current status:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} chats`);
    });
    console.log('');

    // Ask for confirmation
    console.log(`⚠️  This will update ${oldChats.length} chats to status='closed'\n`);
    console.log('Press CTRL+C to cancel, or wait 5 seconds to continue...\n');

    // Wait 5 seconds before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🚀 Starting migration...\n');

    // Update all old chats to closed status
    const updateQuery = `
      UPDATE chats
      SET
        status = 'closed',
        updated_at = NOW()
      WHERE
        (last_message_date IS NULL OR last_message_date < $1)
        AND status != 'closed'
    `;

    const startTime = Date.now();
    const result = await pool.query(updateQuery, [cutoffDate]);
    const duration = Date.now() - startTime;

    console.log(`✅ Migration completed in ${duration}ms`);
    console.log(`📊 Updated ${result.rowCount} chats to status='closed'\n`);

    // Show final statistics
    const statsQuery = `
      SELECT
        status,
        COUNT(*) as count
      FROM chats
      GROUP BY status
      ORDER BY count DESC
    `;

    const { rows: stats } = await pool.query(statsQuery);
    console.log('📊 Final status distribution:');
    stats.forEach(stat => {
      console.log(`   - ${stat.status || 'NULL'}: ${stat.count} chats`);
    });

    console.log('\n✅ [CLOSE-OLD-CHATS] Migration completed successfully!');

  } catch (error) {
    console.error('❌ [CLOSE-OLD-CHATS] Error during migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
closeOldChats().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
