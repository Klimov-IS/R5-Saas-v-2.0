/**
 * Test improved store name matching logic
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

// Normalize store name for matching
function normalizeStoreName(name) {
  return name
    .toLowerCase()
    .replace(/[""«»]/g, '') // Remove quotes
    .replace(/\s*(ооо|ип)\s*/g, '') // Remove ООО/ИП with spaces
    .replace(/[ёе]/g, 'е') // Normalize ё to е
    .replace(/[-\s.]/g, '') // Remove dashes, spaces, dots
    .trim();
}

// Parse CSV
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^([^,]+),(\d+),([^,]+),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*)$/);
    if (match) {
      const [_, client, article, status, minDate, submitComplaints, r1, r2, r3, r4] = match;
      rows.push({
        client: client.replace(/^"|"$/g, '').replace(/""/g, '"'),
        article: article.trim(),
        status: status.trim(),
        submitComplaints: submitComplaints.trim() === 'да',
      });
    }
  }
  return rows;
}

(async () => {
  try {
    console.log('\n=== IMPROVED MATCHING ANALYSIS ===\n');

    // 1. Load CSV
    const csvPath = path.join(__dirname, '../docs/Rating5_OPS - Артикулы (копия).csv');
    const csvData = parseCSV(csvPath);
    const activeProducts = csvData.filter(r => r.status === 'Активен' && r.submitComplaints);

    console.log(`CSV active products: ${activeProducts.length}\n`);

    // 2. Group by client
    const byClient = {};
    activeProducts.forEach(p => {
      if (!byClient[p.client]) {
        byClient[p.client] = [];
      }
      byClient[p.client].push(p);
    });

    console.log(`CSV clients: ${Object.keys(byClient).length}\n`);

    // 3. Get stores from DB
    const storesRes = await pool.query('SELECT id, name FROM stores ORDER BY name');
    const dbStores = storesRes.rows;

    console.log(`DB stores: ${dbStores.length}\n`);

    // 4. Test improved matching
    console.log('IMPROVED MATCHING RESULTS:\n');
    console.log('='.repeat(100));

    let matchedClients = 0;
    let unmatchedClients = 0;
    let totalProductsMatched = 0;
    let totalProductsUnmatched = 0;

    const matches = [];
    const unmatched = [];

    for (const [clientName, products] of Object.entries(byClient)) {
      const csvNormalized = normalizeStoreName(clientName);

      const match = dbStores.find(s => {
        const dbNormalized = normalizeStoreName(s.name);
        return dbNormalized === csvNormalized;
      });

      if (match) {
        matchedClients++;
        totalProductsMatched += products.length;
        matches.push({ csv: clientName, db: match.name, dbId: match.id, count: products.length });
      } else {
        unmatchedClients++;
        totalProductsUnmatched += products.length;
        unmatched.push({ csv: clientName, count: products.length });
      }
    }

    // Show matches
    console.log(`\n✅ MATCHED CLIENTS (${matchedClients}):\n`);
    matches.forEach((m, i) => {
      console.log(`${i + 1}. CSV: "${m.csv}"`);
      console.log(`   DB:  "${m.db}"`);
      console.log(`   Products: ${m.count}`);
      console.log();
    });

    // Show unmatched
    console.log(`\n❌ UNMATCHED CLIENTS (${unmatchedClients}):\n`);
    unmatched.forEach((u, i) => {
      console.log(`${i + 1}. "${u.csv}" (${u.count} products)`);
    });

    // Summary
    console.log('\n' + '='.repeat(100));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   CSV Clients: ${Object.keys(byClient).length}`);
    console.log(`   ✅ Matched: ${matchedClients} clients`);
    console.log(`   ❌ Unmatched: ${unmatchedClients} clients\n`);
    console.log(`   CSV Products (active): ${activeProducts.length}`);
    console.log(`   ✅ Will get rules: ${totalProductsMatched} products`);
    console.log(`   ❌ Won't get rules: ${totalProductsUnmatched} products\n`);
    console.log(`   Match rate: ${(totalProductsMatched / activeProducts.length * 100).toFixed(1)}%\n`);

    // Critical stores check
    console.log('🔍 CRITICAL STORES CHECK:\n');

    const criticalStores = [
      'МакШуз ООО',
      'ООО "Тайди-Центр"',
      'ООО "ТОРГМАРКЕТ102"',
    ];

    criticalStores.forEach(csvName => {
      const found = matches.find(m => m.csv === csvName);
      if (found) {
        console.log(`   ✅ "${csvName}" → "${found.db}" (${found.count} products)`);
      } else {
        const unm = unmatched.find(u => u.csv === csvName);
        console.log(`   ❌ "${csvName}" → NOT FOUND (${unm ? unm.count : 0} products)`);
      }
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
