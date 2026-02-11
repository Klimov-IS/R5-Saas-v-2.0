/**
 * Deeper diagnostic: search for review bclEZpTllay1CAWnoGfs and product 210047592
 * across multiple date ranges and pagination
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

const TARGET_REVIEW_ID = 'bclEZpTllay1CAWnoGfs';
const TARGET_NM_ID = '210047592';

async function run() {
  const storeRes = await pool.query("SELECT id, name, api_token, feedbacks_api_token FROM stores WHERE id = 'BhWUBJfOFTozPN1EkFml'");
  const store = storeRes.rows[0];
  const token = store.feedbacks_api_token || store.api_token;
  console.log('Store:', store.name);

  // Strategy 1: Search across multiple date chunks in January
  const chunks = [
    ['2026-01-01', '2026-01-10'],
    ['2026-01-10', '2026-01-15'],
    ['2026-01-15', '2026-01-20'],
    ['2026-01-20', '2026-01-25'],
    ['2026-01-25', '2026-01-31'],
  ];

  let targetFound = false;
  let reviewsFor210 = [];

  for (const [from, to] of chunks) {
    const dateFrom = Math.floor(new Date(from).getTime() / 1000);
    const dateTo = Math.floor(new Date(to).getTime() / 1000);

    for (const isAnswered of [false, true]) {
      let skip = 0;
      let total = 0;

      while (skip < 5000) {
        const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=${isAnswered}&take=500&skip=${skip}&order=dateDesc&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        const resp = await fetch(url, { headers: { 'Authorization': token } });

        if (!resp.ok) {
          console.log(`API Error ${resp.status} for ${from}-${to} answered=${isAnswered}`);
          break;
        }

        const data = await resp.json();
        const feedbacks = data.data?.feedbacks || [];
        total += feedbacks.length;

        // Search for target
        const found = feedbacks.find(f => f.id === TARGET_REVIEW_ID);
        if (found) {
          console.log(`\n!!! TARGET REVIEW FOUND in ${from}-${to}, answered=${isAnswered}, skip=${skip} !!!`);
          console.log(JSON.stringify({
            id: found.id,
            nmId: found.productDetails?.nmId,
            rootNmId: found.productDetails?.rootNmId,
            productName: found.productDetails?.productName?.substring(0, 60),
            rating: found.productValuation,
            createdDate: found.createdDate,
            text: found.text?.substring(0, 100),
          }, null, 2));
          targetFound = true;
        }

        // Search for product 210047592
        const forProduct = feedbacks.filter(f => String(f.productDetails?.nmId) === TARGET_NM_ID);
        if (forProduct.length > 0) {
          reviewsFor210.push(...forProduct);
        }

        if (feedbacks.length < 500) break;
        skip += 500;
        await new Promise(r => setTimeout(r, 300));
      }

      console.log(`${from} → ${to} | answered=${isAnswered}: ${total} reviews`);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!targetFound) {
    console.log(`\nTarget review ${TARGET_REVIEW_ID} NOT FOUND in any January 2026 chunk.`);
    console.log('Possible: review deleted from WB, or date is wrong.');
  }

  console.log(`\nReviews found for nmId ${TARGET_NM_ID} in Jan 2026: ${reviewsFor210.length}`);
  for (const r of reviewsFor210) {
    console.log(`  ${r.id} | ${r.createdDate} | rating ${r.productValuation} | answered=${r.answer !== undefined}`);
  }

  // Strategy 2: Check what our DB has for this product in Dec-Feb range
  const dbReviews = await pool.query(`
    SELECT id, rating, created_date, wb_product_id, text
    FROM reviews
    WHERE wb_product_id = $1
      AND created_date >= '2025-12-01' AND created_date <= '2026-02-28'
    ORDER BY created_date DESC
  `, [TARGET_NM_ID]);

  console.log(`\nDB reviews for ${TARGET_NM_ID} (Dec-Feb): ${dbReviews.rows.length}`);
  for (const r of dbReviews.rows) {
    console.log(`  ${r.id} | ${r.created_date} | rating ${r.rating}`);
  }

  // Strategy 3: Check if WB returns this product under a different nmId
  // by looking at the product name "Балетки" in reviews
  const allJanReviews = [];
  for (const isAnswered of [false, true]) {
    const dateFrom = Math.floor(new Date('2026-01-18').getTime() / 1000);
    const dateTo = Math.floor(new Date('2026-01-23').getTime() / 1000);
    let skip = 0;
    while (skip < 5000) {
      const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=${isAnswered}&take=500&skip=${skip}&order=dateDesc&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const resp = await fetch(url, { headers: { 'Authorization': token } });
      if (!resp.ok) break;
      const data = await resp.json();
      const feedbacks = data.data?.feedbacks || [];
      allJanReviews.push(...feedbacks);
      if (feedbacks.length < 500) break;
      skip += 500;
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Look for "балетки" or "210047592" in product details
  const balletki = allJanReviews.filter(f =>
    (f.productDetails?.productName || '').toLowerCase().includes('балетк') ||
    String(f.productDetails?.supplierArticle) === '210047592'
  );
  console.log(`\nReviews with "балетки" in name (Jan 18-23): ${balletki.length}`);
  for (const r of balletki) {
    console.log(`  ${r.id} | nmId=${r.productDetails?.nmId} | "${r.productDetails?.productName?.substring(0, 50)}" | ${r.createdDate}`);
  }

  await pool.end();
  console.log('\nDiagnosis v2 complete.');
}

run().catch(e => { console.error(e); process.exit(1); });
