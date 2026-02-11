/**
 * Diagnostic script: investigate missing review bclEZpTllay1CAWnoGfs
 * Calls WB API directly and checks what nmIds are returned vs what's in our DB
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // 1. Get МакШуз store + token
  const storeRes = await pool.query("SELECT id, name, api_token, feedbacks_api_token FROM stores WHERE id = 'BhWUBJfOFTozPN1EkFml'");
  if (!storeRes.rows.length) { console.log('Store not found'); return; }
  const store = storeRes.rows[0];
  console.log('Store:', store.id, store.name);
  console.log('Has api_token:', !!store.api_token);
  console.log('Has feedbacks_token:', !!store.feedbacks_api_token);

  const token = store.feedbacks_api_token || store.api_token;

  // 2. Fetch reviews from WB API for Jan 15-25 2026
  const dateFrom = Math.floor(new Date('2026-01-15').getTime() / 1000);
  const dateTo = Math.floor(new Date('2026-01-25').getTime() / 1000);

  let allFeedbacks = [];

  for (const isAnswered of [false, true]) {
    const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=${isAnswered}&take=500&skip=0&order=dateDesc&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    console.log(`\nFetching ${isAnswered ? 'answered' : 'unanswered'} reviews (Jan 15-25)...`);

    const resp = await fetch(url, { headers: { 'Authorization': token } });
    if (!resp.ok) {
      console.log('API Error:', resp.status, resp.statusText);
      const body = await resp.text();
      console.log('Body:', body.substring(0, 500));
      continue;
    }

    const data = await resp.json();
    const feedbacks = data.data?.feedbacks || [];
    console.log(`Got ${feedbacks.length} ${isAnswered ? 'answered' : 'unanswered'} reviews`);
    allFeedbacks.push(...feedbacks);
  }

  console.log(`\nTotal reviews from WB API: ${allFeedbacks.length}`);

  // 3. Look for target review
  const target = allFeedbacks.find(f => f.id === 'bclEZpTllay1CAWnoGfs');
  if (target) {
    console.log('\n=== TARGET REVIEW FOUND ===');
    console.log(JSON.stringify({
      id: target.id,
      nmId: target.productDetails?.nmId,
      rootNmId: target.productDetails?.rootNmId,
      imtId: target.productDetails?.imtId,
      productName: target.productDetails?.productName?.substring(0, 60),
      supplierArticle: target.productDetails?.supplierArticle,
      rating: target.productValuation,
      createdDate: target.createdDate,
      text: target.text?.substring(0, 100),
    }, null, 2));
  } else {
    console.log('\n=== TARGET REVIEW NOT FOUND in Jan 15-25 window ===');
    console.log('Trying wider range Jan 10-31...');

    const dateFrom2 = Math.floor(new Date('2026-01-10').getTime() / 1000);
    const dateTo2 = Math.floor(new Date('2026-01-31').getTime() / 1000);

    for (const isAnswered of [false, true]) {
      const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=${isAnswered}&take=500&skip=0&order=dateDesc&dateFrom=${dateFrom2}&dateTo=${dateTo2}`;
      const resp = await fetch(url, { headers: { 'Authorization': token } });
      if (!resp.ok) continue;
      const data = await resp.json();
      const feedbacks = data.data?.feedbacks || [];
      const found = feedbacks.find(f => f.id === 'bclEZpTllay1CAWnoGfs');
      if (found) {
        console.log(`Found in ${isAnswered ? 'answered' : 'unanswered'}!`);
        console.log(JSON.stringify({
          id: found.id,
          nmId: found.productDetails?.nmId,
          rootNmId: found.productDetails?.rootNmId,
          imtId: found.productDetails?.imtId,
          productName: found.productDetails?.productName?.substring(0, 60),
          supplierArticle: found.productDetails?.supplierArticle,
          rating: found.productValuation,
          createdDate: found.createdDate,
          text: found.text?.substring(0, 100),
        }, null, 2));
        allFeedbacks.push(...feedbacks);
        break;
      }
    }
  }

  // 4. Check all nmIds from reviews for nmId 210047592
  const reviewsFor210047592 = allFeedbacks.filter(f => String(f.productDetails?.nmId) === '210047592');
  console.log(`\nReviews with nmId=210047592: ${reviewsFor210047592.length}`);
  for (const r of reviewsFor210047592.slice(0, 5)) {
    console.log(`  ${r.id} | ${r.createdDate} | rating ${r.productValuation}`);
  }

  // 5. Check which nmIds from WB are NOT in our products table
  const allNmIds = [...new Set(allFeedbacks.map(f => String(f.productDetails?.nmId)).filter(Boolean))];
  console.log(`\nUnique nmIds in WB response: ${allNmIds.length}`);

  const dbProducts = await pool.query(
    'SELECT wb_product_id FROM products WHERE store_id = $1 AND wb_product_id = ANY($2)',
    [store.id, allNmIds]
  );
  const foundNmIds = new Set(dbProducts.rows.map(r => r.wb_product_id));
  const missingNmIds = allNmIds.filter(id => !foundNmIds.has(id));

  console.log(`nmIds found in our DB: ${foundNmIds.size} / ${allNmIds.length}`);
  if (missingNmIds.length > 0) {
    console.log(`\n=== MISSING nmIds (not in our products table) ===`);
    for (const nmId of missingNmIds) {
      const affected = allFeedbacks.filter(f => String(f.productDetails?.nmId) === nmId);
      const sampleName = affected[0]?.productDetails?.productName?.substring(0, 50) || 'unknown';
      console.log(`  nmId ${nmId}: ${affected.length} reviews lost | "${sampleName}"`);
    }

    const totalAffected = allFeedbacks.filter(f => missingNmIds.includes(String(f.productDetails?.nmId))).length;
    console.log(`\nTotal reviews lost due to missing products: ${totalAffected} / ${allFeedbacks.length}`);
  } else {
    console.log('All nmIds found in DB - no missing products');
  }

  // 6. Check: does target review's nmId match 210047592?
  if (target) {
    const targetNmId = String(target.productDetails?.nmId);
    console.log(`\nTarget review nmId: ${targetNmId}`);
    console.log(`Expected nmId: 210047592`);
    console.log(`Match: ${targetNmId === '210047592'}`);

    if (targetNmId !== '210047592') {
      const inDb = foundNmIds.has(targetNmId);
      console.log(`Target nmId ${targetNmId} in our DB: ${inDb}`);
    }
  }

  await pool.end();
  console.log('\nDiagnosis complete.');
}

run().catch(e => { console.error(e); process.exit(1); });
