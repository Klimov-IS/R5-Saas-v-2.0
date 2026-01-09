/**
 * Test script for complaint helpers
 * Verifies TypeScript types and DB operations work correctly
 */

// Load .env.local BEFORE any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  getComplaintStats,
  getComplaintsByStore,
  getComplaintByReviewId,
  findEligibleReviewsForComplaints,
  getComplaintBacklogCount,
} from '../src/db/complaint-helpers';

async function testComplaintHelpers() {
  console.log('🧪 Testing complaint helpers...\n');

  try {
    // Test 1: Get complaint stats for a store
    console.log('1️⃣ Testing getComplaintStats...');
    const testStoreId = 'TwKRrPji2KhTS8TmYJlD'; // Example store ID
    const stats = await getComplaintStats(testStoreId);
    console.log('   Stats:', stats);

    // Test 2: Get complaints by store
    console.log('\n2️⃣ Testing getComplaintsByStore...');
    const complaints = await getComplaintsByStore(testStoreId, { limit: 5 });
    console.log(`   Found ${complaints.length} complaints (limit 5)`);
    if (complaints.length > 0) {
      console.log('   First complaint:');
      console.log(`     - Review ID: ${complaints[0].review_id}`);
      console.log(`     - Status: ${complaints[0].status}`);
      console.log(`     - Reason: [${complaints[0].reason_id}] ${complaints[0].reason_name}`);
      console.log(`     - Generated: ${complaints[0].generated_at}`);
      console.log(`     - Regenerated: ${complaints[0].regenerated_count} times`);
    }

    // Test 3: Get complaint by review ID
    if (complaints.length > 0) {
      console.log('\n3️⃣ Testing getComplaintByReviewId...');
      const reviewId = complaints[0].review_id;
      const complaint = await getComplaintByReviewId(reviewId);
      console.log(`   Complaint found for review ${reviewId}:`, !!complaint);
      if (complaint) {
        console.log(`     - Complaint text length: ${complaint.complaint_text.length} chars`);
        console.log(`     - AI tokens: ${complaint.ai_total_tokens || 'N/A'}`);
        console.log(`     - AI cost: $${complaint.ai_cost_usd || 'N/A'}`);
      }
    }

    // Test 4: Find eligible reviews for auto-generation
    console.log('\n4️⃣ Testing findEligibleReviewsForComplaints...');
    const eligibleReviews = await findEligibleReviewsForComplaints({ limit: 10 });
    console.log(`   Found ${eligibleReviews.length} eligible reviews for complaint generation`);
    if (eligibleReviews.length > 0) {
      console.log('   Sample eligible review:');
      console.log(`     - Store: ${eligibleReviews[0].store_name}`);
      console.log(`     - Product: ${eligibleReviews[0].product_name}`);
      console.log(`     - Rating: ${eligibleReviews[0].rating}★`);
      console.log(`     - Date: ${eligibleReviews[0].date}`);
      console.log(`     - Text: "${eligibleReviews[0].text.substring(0, 100)}..."`);
    }

    // Test 5: Get backlog count
    console.log('\n5️⃣ Testing getComplaintBacklogCount...');
    const backlogTotal = await getComplaintBacklogCount();
    const backlogStore = await getComplaintBacklogCount(testStoreId);
    console.log(`   Total backlog (all stores): ${backlogTotal} reviews`);
    console.log(`   Backlog for test store: ${backlogStore} reviews`);

    console.log('\n✅ All tests completed successfully!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testComplaintHelpers();
