/**
 * Verify review_complaints table migration
 * Check migrated data and table structure
 */

// Load .env.local BEFORE any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function verifyMigration() {
  console.log('🔍 Verifying review_complaints migration...\n');

  try {
    // 1. Count total rows
    const countResult = await query('SELECT COUNT(*) as count FROM review_complaints');
    console.log(`📊 Total complaints migrated: ${countResult.rows[0].count}`);

    // 2. Status breakdown
    const statusResult = await query(`
      SELECT
        status,
        COUNT(*) as count
      FROM review_complaints
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('\n📈 Status breakdown:');
    statusResult.rows.forEach(row => {
      console.log(`   - ${row.status}: ${row.count}`);
    });

    // 3. Sample complaints
    const sampleResult = await query(`
      SELECT
        id,
        review_id,
        status,
        reason_id,
        reason_name,
        LEFT(complaint_text, 100) as complaint_preview,
        generated_at
      FROM review_complaints
      ORDER BY generated_at DESC
      LIMIT 5
    `);
    console.log('\n🔎 Sample complaints (latest 5):');
    sampleResult.rows.forEach((row, idx) => {
      console.log(`\n   ${idx + 1}. Status: ${row.status}`);
      console.log(`      Reason: [${row.reason_id}] ${row.reason_name}`);
      console.log(`      Preview: "${row.complaint_preview}..."`);
      console.log(`      Generated: ${row.generated_at}`);
    });

    // 4. Check for reviews with complaints
    const reviewCheckResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM reviews WHERE complaint_text IS NOT NULL) as old_reviews_with_complaints,
        (SELECT COUNT(*) FROM review_complaints) as new_complaints_table,
        (SELECT COUNT(*) FROM reviews r WHERE EXISTS (SELECT 1 FROM review_complaints c WHERE c.review_id = r.id)) as reviews_with_new_complaints
    `);
    console.log('\n🔗 Review-Complaint relationship:');
    console.log(`   - Old reviews.complaint_text (not null): ${reviewCheckResult.rows[0].old_reviews_with_complaints}`);
    console.log(`   - New review_complaints table: ${reviewCheckResult.rows[0].new_complaints_table}`);
    console.log(`   - Reviews linked to new table: ${reviewCheckResult.rows[0].reviews_with_new_complaints}`);

    //5. Check AI metadata (cost tracking)
    const costResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE ai_cost_usd IS NOT NULL) as with_cost_data,
        COUNT(*) FILTER (WHERE ai_cost_usd IS NULL) as without_cost_data,
        SUM(ai_total_tokens) as total_tokens,
        SUM(ai_cost_usd) as total_cost
      FROM review_complaints
    `);
    console.log('\n💰 AI Cost tracking:');
    console.log(`   - With cost data: ${costResult.rows[0].with_cost_data}`);
    console.log(`   - Without cost data: ${costResult.rows[0].without_cost_data}`);
    console.log(`   - Total tokens used: ${costResult.rows[0].total_tokens || 0}`);
    console.log(`   - Total cost: $${(costResult.rows[0].total_cost || 0).toFixed(4)}`);

    // 6. Check denormalized fields in reviews table
    const denormResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE has_complaint = TRUE) as has_complaint_true,
        COUNT(*) FILTER (WHERE has_complaint_draft = TRUE) as has_complaint_draft_true
      FROM reviews
    `);
    console.log('\n🔄 Reviews table denormalized fields:');
    console.log(`   - has_complaint = TRUE: ${denormResult.rows[0].has_complaint_true}`);
    console.log(`   - has_complaint_draft = TRUE: ${denormResult.rows[0].has_complaint_draft_true}`);

    console.log('\n✅ Migration verification complete!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Verification failed:');
    console.error(error.message);
    process.exit(1);
  }
}

verifyMigration();
