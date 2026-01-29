require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log('\n=== Checking for AI-generated complaints (ai_cost_usd > 0) ===\n');

    const aiResult = await pool.query(`
      SELECT
        rc.id,
        rc.review_id,
        rc.created_at,
        LEFT(rc.complaint_text, 100) as complaint_preview,
        rc.ai_cost_usd,
        rc.generation_duration_ms,
        s.name as store_name,
        r.rating,
        LEFT(r.text, 50) as review_preview
      FROM review_complaints rc
      JOIN reviews r ON r.id = rc.review_id
      JOIN stores s ON s.id = rc.store_id
      WHERE rc.ai_cost_usd > 0
      ORDER BY rc.created_at DESC
      LIMIT 10
    `);

    if (aiResult.rows.length === 0) {
      console.log('❌ No AI-generated complaints found.\n');
      console.log('=== Checking template-based complaints (ai_cost_usd = 0) ===\n');

      const templateResult = await pool.query(`
        SELECT
          rc.id,
          rc.review_id,
          rc.created_at,
          LEFT(rc.complaint_text, 100) as complaint_preview,
          s.name as store_name,
          r.rating,
          LEFT(r.text, 50) as review_preview
        FROM review_complaints rc
        JOIN reviews r ON r.id = rc.review_id
        JOIN stores s ON s.id = rc.store_id
        WHERE rc.ai_cost_usd = 0
        ORDER BY rc.created_at DESC
        LIMIT 10
      `);

      console.log(`✅ Found ${templateResult.rows.length} recent template-based complaints:\n`);
      templateResult.rows.forEach((row, i) => {
        console.log(`${i + 1}. Store: ${row.store_name}`);
        console.log(`   Review ID: ${row.review_id}`);
        console.log(`   Rating: ${row.rating} stars`);
        console.log(`   Review: ${row.review_preview || '(empty)'}...`);
        console.log(`   Complaint: ${row.complaint_preview}...`);
        console.log(`   Created: ${row.created_at}`);
        console.log(`   Type: Template ($0.00)\n`);
      });
    } else {
      console.log(`✅ Found ${aiResult.rows.length} recent AI-generated complaints:\n`);
      aiResult.rows.forEach((row, i) => {
        console.log(`${i + 1}. Store: ${row.store_name}`);
        console.log(`   Review ID: ${row.review_id}`);
        console.log(`   Rating: ${row.rating} stars`);
        console.log(`   Review: ${row.review_preview || '(empty)'}...`);
        console.log(`   Complaint: ${row.complaint_preview}...`);
        console.log(`   Created: ${row.created_at}`);
        console.log(`   Cost: $${row.ai_cost_usd} | Duration: ${row.generation_duration_ms}ms\n`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
