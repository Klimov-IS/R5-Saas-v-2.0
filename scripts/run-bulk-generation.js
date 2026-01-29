/**
 * Bulk template generation script
 * Generates template-based complaints for all empty reviews (1-3 stars)
 */

const API_KEY = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
const BASE_URL = 'http://localhost:9002';
const BATCH_SIZE = 1000;

async function runBatch(batchNum) {
  const url = `${BASE_URL}/api/admin/generate-empty-review-complaints?limit=${BATCH_SIZE}`;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Batch #${batchNum} (max ${BATCH_SIZE} reviews)...`);

  const startTime = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!data.success) {
    console.error('ERROR:', data.error || 'Unknown error');
    return { generated: 0, continue: false };
  }

  const stats = data.stats;
  console.log(`  ✓ Created: ${stats.generated_count} complaints in ${stats.duration_sec}s`);
  console.log(`  ✓ Variants: A=${stats.variant_distribution.A}, B=${stats.variant_distribution.B}, C=${stats.variant_distribution.C}, D=${stats.variant_distribution.D}`);
  console.log(`  ✓ Speed: ${stats.reviews_per_second} reviews/sec`);

  // Continue if we got a full batch (more reviews available)
  const shouldContinue = stats.generated_count === BATCH_SIZE;

  return {
    generated: stats.generated_count,
    continue: shouldContinue
  };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('WB Reputation Manager - Bulk Template Generation');
  console.log('='.repeat(80));

  // Get initial stats
  console.log('\nFetching current statistics...');
  const statsResponse = await fetch(`${BASE_URL}/api/admin/analyze-empty-reviews`);
  const statsData = await statsResponse.json();
  const totalToGenerate = statsData.overall.empty_without_complaint;

  console.log(`Total empty reviews without complaints: ${totalToGenerate.toLocaleString()}`);
  console.log(`Estimated batches: ${Math.ceil(totalToGenerate / BATCH_SIZE)}`);
  console.log(`Estimated time: ${Math.ceil(totalToGenerate / (BATCH_SIZE / 25))} minutes`);

  let batchNum = 1;
  let totalGenerated = 0;
  let shouldContinue = true;

  while (shouldContinue && totalGenerated < totalToGenerate) {
    const result = await runBatch(batchNum);
    totalGenerated += result.generated;
    shouldContinue = result.continue;

    console.log(`  ✓ Total progress: ${totalGenerated.toLocaleString()} / ${totalToGenerate.toLocaleString()} (${((totalGenerated / totalToGenerate) * 100).toFixed(1)}%)`);

    if (shouldContinue) {
      console.log('  ⏸  Pausing 2 seconds before next batch...');
      await sleep(2000);
      batchNum++;
    } else {
      console.log('  ℹ  Last batch (no more empty reviews)');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✓ COMPLETED!');
  console.log(`  Total complaints generated: ${totalGenerated.toLocaleString()}`);
  console.log(`  Token savings: ~$${(totalGenerated * 0.0042).toFixed(2)}`);
  console.log('='.repeat(80));

  // Final stats
  console.log('\nFinal statistics:');
  const finalStats = await fetch(`${BASE_URL}/api/admin/analyze-empty-reviews`);
  const finalData = await finalStats.json();
  console.log(JSON.stringify(finalData.overall, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
