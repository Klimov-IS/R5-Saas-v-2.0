/**
 * Apply product_rules from CSV file to database
 *
 * Matches CSV "Артикул WB" to products.wb_product_id
 * Creates product_rules with exact configuration from CSV
 *
 * Usage:
 *   node apply-csv-product-rules.js --dry-run  (preview only)
 *   node apply-csv-product-rules.js            (apply changes)
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) { // Skip header
    const match = lines[i].match(/^([^,]+),(\d+),([^,]+),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*)$/);
    if (match) {
      const [_, client, article, status, minDate, submitComplaints, r1, r2, r3, r4] = match;

      rows.push({
        client: client.replace(/^"|"$/g, '').replace(/""/g, '"'), // Clean quotes
        article: article.trim(),
        status: status.trim(),
        submitComplaints: submitComplaints.trim() === 'да',
        rating1: r1.trim() === 'TRUE',
        rating2: r2.trim() === 'TRUE',
        rating3: r3.trim() === 'TRUE',
        rating4: r4.trim() === 'TRUE',
      });
    }
  }

  return rows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const startTime = Date.now();

  console.log('\n=== APPLY PRODUCT_RULES FROM CSV ===\n');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '✅ LIVE MODE (will apply changes)'}\n`);

  try {
    // 1. Load CSV
    const csvPath = path.join(__dirname, '../docs/Rating5_OPS - Артикулы (копия).csv');
    const csvData = parseCSV(csvPath);

    console.log(`1. CSV loaded: ${csvData.length} rows\n`);

    // 2. Filter only active products with submit_complaints = да
    const activeProducts = csvData.filter(r => r.status === 'Активен' && r.submitComplaints);

    console.log(`2. Filtered active products with complaints enabled: ${activeProducts.length}\n`);

    // 3. Group by client for batch processing
    const byClient = {};
    activeProducts.forEach(p => {
      if (!byClient[p.client]) {
        byClient[p.client] = [];
      }
      byClient[p.client].push(p);
    });

    console.log(`3. Grouped by ${Object.keys(byClient).length} clients\n`);

    // 4. Get all stores from DB
    const storesRes = await pool.query('SELECT id, name FROM stores');
    const dbStores = storesRes.rows;

    console.log(`4. Loaded ${dbStores.length} stores from DB\n`);

    // 5. Process each client
    console.log('5. Processing clients:\n');
    console.log('='.repeat(100));

    let totalProcessed = 0;
    let totalMatched = 0;
    let totalNotFound = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const [clientName, products] of Object.entries(byClient)) {
      // Match client to store
      const store = dbStores.find(s => {
        const sName = s.name.replace(/[""«»]/g, '').trim().toLowerCase();
        const cName = clientName.replace(/[""«»]/g, '').trim().toLowerCase();
        return sName === cName || sName.includes(cName.split(' ').slice(0, 2).join(' '));
      });

      if (!store) {
        console.log(`⚠️  "${clientName}" → NOT FOUND in DB (${products.length} products skipped)`);
        totalNotFound += products.length;
        continue;
      }

      console.log(`\n📦 "${clientName}" → "${store.name}" (${store.id})`);
      console.log(`   CSV products: ${products.length}`);

      // Get product IDs by wb_product_id
      const articles = products.map(p => p.article);
      const productsRes = await pool.query(`
        SELECT id, wb_product_id, name
        FROM products
        WHERE store_id = $1
          AND wb_product_id::text = ANY($2::text[])
      `, [store.id, articles]);

      const foundProducts = productsRes.rows;
      console.log(`   Matched in DB: ${foundProducts.length}`);

      totalProcessed += products.length;
      totalMatched += foundProducts.length;
      totalNotFound += products.length - foundProducts.length;

      if (foundProducts.length === 0) {
        console.log(`   ⚠️  No products matched for this store`);
        continue;
      }

      // Create product_rules for each matched product
      for (const dbProduct of foundProducts) {
        const csvProduct = products.find(p => p.article === dbProduct.wb_product_id.toString());

        if (!csvProduct) continue;

        const rules = {
          product_id: dbProduct.id,
          store_id: store.id,
          submit_complaints: csvProduct.submitComplaints,
          complaint_rating_1: csvProduct.rating1,
          complaint_rating_2: csvProduct.rating2,
          complaint_rating_3: csvProduct.rating3,
          complaint_rating_4: csvProduct.rating4,
          // Default values for other fields
          work_in_chats: true,
          chat_rating_1: true,
          chat_rating_2: true,
          chat_rating_3: true,
          chat_rating_4: true,
          chat_strategy: 'both',
          offer_compensation: true,
          max_compensation: '500',
          compensation_type: 'cashback',
          compensation_by: 'r5',
        };

        if (!dryRun) {
          try {
            // Upsert product_rules
            const result = await pool.query(`
              INSERT INTO product_rules (
                id, product_id, store_id,
                submit_complaints, complaint_rating_1, complaint_rating_2, complaint_rating_3, complaint_rating_4,
                work_in_chats, chat_rating_1, chat_rating_2, chat_rating_3, chat_rating_4, chat_strategy,
                offer_compensation, max_compensation, compensation_type, compensation_by,
                created_at, updated_at
              )
              VALUES (
                gen_random_uuid()::text, $1, $2,
                $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17,
                NOW(), NOW()
              )
              ON CONFLICT (product_id)
              DO UPDATE SET
                submit_complaints = EXCLUDED.submit_complaints,
                complaint_rating_1 = EXCLUDED.complaint_rating_1,
                complaint_rating_2 = EXCLUDED.complaint_rating_2,
                complaint_rating_3 = EXCLUDED.complaint_rating_3,
                complaint_rating_4 = EXCLUDED.complaint_rating_4,
                work_in_chats = EXCLUDED.work_in_chats,
                chat_rating_1 = EXCLUDED.chat_rating_1,
                chat_rating_2 = EXCLUDED.chat_rating_2,
                chat_rating_3 = EXCLUDED.chat_rating_3,
                chat_rating_4 = EXCLUDED.chat_rating_4,
                chat_strategy = EXCLUDED.chat_strategy,
                offer_compensation = EXCLUDED.offer_compensation,
                max_compensation = EXCLUDED.max_compensation,
                compensation_type = EXCLUDED.compensation_type,
                compensation_by = EXCLUDED.compensation_by,
                updated_at = NOW()
              RETURNING (xmax = 0) AS inserted
            `, [
              rules.product_id,
              rules.store_id,
              rules.submit_complaints,
              rules.complaint_rating_1,
              rules.complaint_rating_2,
              rules.complaint_rating_3,
              rules.complaint_rating_4,
              rules.work_in_chats,
              rules.chat_rating_1,
              rules.chat_rating_2,
              rules.chat_rating_3,
              rules.chat_rating_4,
              rules.chat_strategy,
              rules.offer_compensation,
              rules.max_compensation,
              rules.compensation_type,
              rules.compensation_by,
            ]);

            if (result.rows[0].inserted) {
              totalCreated++;
            } else {
              totalUpdated++;
            }
          } catch (error) {
            console.error(`     ❌ Error for product ${dbProduct.id}: ${error.message}`);
            totalFailed++;
          }
        }
      }

      if (dryRun) {
        console.log(`   📋 Would create/update rules for ${foundProducts.length} products`);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   CSV products processed: ${totalProcessed}`);
    console.log(`   ✅ Matched in DB: ${totalMatched}`);
    console.log(`   ❌ Not found in DB: ${totalNotFound}`);
    console.log(`   Match rate: ${(totalMatched / totalProcessed * 100).toFixed(1)}%`);

    if (!dryRun) {
      console.log(`\n   🆕 Created new rules: ${totalCreated}`);
      console.log(`   🔄 Updated existing rules: ${totalUpdated}`);
      console.log(`   ❌ Failed: ${totalFailed}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Duration: ${duration}s\n`);

    if (dryRun) {
      console.log('💡 Run without --dry-run to apply changes\n');
    } else {
      console.log('✅ Product rules applied successfully!\n');
      console.log('🎯 Event-Driven automation should now work for these stores.\n');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

main();
