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
    console.log('\n=== CSV MATCHING ANALYSIS ===\n');

    // 1. Check products from stores in CSV
    console.log('1. Products from stores matching CSV clients:');
    console.log('='.repeat(80));

    const res = await pool.query(`
      SELECT
        p.id,
        p.store_id,
        p.name,
        p.vendor_code,
        p.wb_product_id,
        s.name as store_name
      FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE s.name ILIKE '%Ахметов%'
         OR s.name ILIKE '%КотоМото%'
         OR s.name ILIKE '%Корольков%'
         OR s.name ILIKE '%Тайди%'
      LIMIT 30
    `);

    res.rows.forEach((p, i) => {
      console.log(`${i+1}. Store: ${p.store_name}`);
      console.log(`   Product: ${p.name}`);
      console.log(`   wb_product_id: ${p.wb_product_id}`);
      console.log(`   vendor_code: ${p.vendor_code}`);
      console.log(`   Full ID: ${p.id}`);
      console.log();
    });

    // 2. Check if wb_product_id matches CSV article numbers
    console.log('\n2. Testing match with CSV article numbers:');
    console.log('='.repeat(80));

    // From CSV: ИП Ахметов Д. Э., 218791291
    // From CSV: ООО "КотоМото", 302396212, 302396211, etc.
    const testArticles = ['218791291', '302396212', '302396211', '342368059', '275177655'];

    const matchTest = await pool.query(`
      SELECT
        p.id,
        p.wb_product_id,
        p.name,
        s.name as store_name
      FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE p.wb_product_id::text = ANY($1)
    `, [testArticles]);

    if (matchTest.rows.length > 0) {
      console.log(`✅ MATCH FOUND! wb_product_id matches CSV "Артикул WB"\n`);
      matchTest.rows.forEach(p => {
        console.log(`  Article: ${p.wb_product_id}`);
        console.log(`  Store: ${p.store_name}`);
        console.log(`  Product: ${p.name}`);
        console.log();
      });
    } else {
      console.log(`❌ NO MATCH with wb_product_id\n`);
    }

    // 3. Check all stores with name variations
    console.log('\n3. Store name matching (CSV vs DB):');
    console.log('='.repeat(80));

    const stores = await pool.query(`
      SELECT id, name FROM stores ORDER BY name
    `);

    // CSV store names we saw
    const csvStores = [
      'ИП Ахметов Д. Э.',
      'ООО "КотоМото"',
      'ИП Корольков А. В.',
      'ИП Николаева А. В.',
      'ООО "Тайди-Центр"',
      'ИП Артюшина О. А.',
      'ИП Гаврилов С. А.',
      'ООО "АМОР ФЛЁРС"'
    ];

    console.log('CSV Stores → DB Stores (fuzzy match):');
    csvStores.forEach(csvName => {
      const cleanCsv = csvName.replace(/[""«»]/g, '').trim();
      const match = stores.rows.find(s => {
        const cleanDb = s.name.replace(/[""«»]/g, '').trim();
        return cleanDb.includes(cleanCsv.split(' ')[1]) || // Match by main name part
               cleanCsv.includes(cleanDb.split(' ')[1]) ||
               cleanCsv.toLowerCase() === cleanDb.toLowerCase();
      });

      if (match) {
        console.log(`  ✅ "${csvName}" → "${match.name}" (${match.id})`);
      } else {
        console.log(`  ❌ "${csvName}" → NOT FOUND`);
      }
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
