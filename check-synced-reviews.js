/**
 * Check synced reviews in database
 * Shows last 10 reviews for store TwKRrPji2KhTS8TmYJlD
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: { rejectUnauthorized: false }
});

async function checkSyncedReviews() {
  try {
    console.log('🔍 Checking synced reviews in database...\n');

    const result = await pool.query(`
      SELECT
        id,
        rating,
        LEFT(text, 80) as text_preview,
        author,
        date,
        review_status_wb,
        product_status_by_review,
        chat_status_by_review,
        complaint_status,
        created_at,
        updated_at
      FROM reviews
      WHERE store_id = 'TwKRrPji2KhTS8TmYJlD'
      ORDER BY updated_at DESC
      LIMIT 10;
    `);

    console.log('═'.repeat(120));
    console.log('📊 Last 10 reviews (ordered by updated_at DESC)');
    console.log('═'.repeat(120));

    if (result.rows.length === 0) {
      console.log('❌ No reviews found for store TwKRrPji2KhTS8TmYJlD');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Review ID: ${row.id}`);
        console.log(`   Rating: ${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)} (${row.rating}/5)`);
        console.log(`   Author: ${row.author || 'N/A'}`);
        console.log(`   Date: ${row.date || 'N/A'}`);
        console.log(`   Text: "${row.text_preview}${row.text_preview?.length === 80 ? '...' : ''}"`);
        console.log(`   `);
        console.log(`   Review Status (WB): ${row.review_status_wb}`);
        console.log(`   Product Status: ${row.product_status_by_review}`);
        console.log(`   Chat Status: ${row.chat_status_by_review}`);
        console.log(`   Complaint Status: ${row.complaint_status}`);
        console.log(`   `);
        console.log(`   Created: ${row.created_at.toISOString()}`);
        console.log(`   Updated: ${row.updated_at.toISOString()} ${isRecent(row.updated_at) ? '🔴 ТОЛЬКО ЧТО!' : ''}`);
        console.log('   ' + '─'.repeat(115));
      });

      console.log('\n' + '═'.repeat(120));
      console.log(`\n📈 Total reviews shown: ${result.rows.length}`);

      // Show how many were recently updated (last 5 minutes)
      const recentCount = result.rows.filter(r => isRecent(r.updated_at)).length;
      if (recentCount > 0) {
        console.log(`🔴 Recently updated (last 5 min): ${recentCount} reviews`);
      }
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

function isRecent(date) {
  const now = new Date();
  const diff = now - new Date(date);
  return diff < 5 * 60 * 1000; // 5 minutes
}

checkSyncedReviews();
