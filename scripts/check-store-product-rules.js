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
    console.log('\n=== Product Rules Statistics for Тайди Центр ===\n');

    // Get store ID
    const storeResult = await pool.query(`
      SELECT id, name FROM stores WHERE name ILIKE '%Тайди%' LIMIT 1
    `);

    if (storeResult.rows.length === 0) {
      console.log('❌ Store not found!');
      process.exit(1);
    }

    const store = storeResult.rows[0];
    console.log(`Store: ${store.name}`);
    console.log(`Store ID: ${store.id}\n`);

    // Total products
    const totalProducts = await pool.query(`
      SELECT COUNT(*) as count FROM products WHERE store_id = $1
    `, [store.id]);

    // Products WITH rules
    const productsWithRules = await pool.query(`
      SELECT COUNT(*) as count
      FROM products p
      WHERE p.store_id = $1
        AND EXISTS(SELECT 1 FROM product_rules WHERE product_id = p.id)
    `, [store.id]);

    // Products WITH submit_complaints enabled
    const productsWithSubmitEnabled = await pool.query(`
      SELECT COUNT(*) as count
      FROM products p
      JOIN product_rules pr ON pr.product_id = p.id
      WHERE p.store_id = $1
        AND pr.submit_complaints = true
    `, [store.id]);

    console.log('📊 Product Rules Statistics:');
    console.log(`   Total Products: ${totalProducts.rows[0].count}`);
    console.log(`   Products WITH rules configured: ${productsWithRules.rows[0].count}`);
    console.log(`   Products WITH submit_complaints enabled: ${productsWithSubmitEnabled.rows[0].count}\n`);

    // Sample products WITH rules
    const sampleWithRules = await pool.query(`
      SELECT
        p.id,
        p.name,
        pr.submit_complaints,
        pr.complaint_rating_1,
        pr.complaint_rating_2,
        pr.complaint_rating_3,
        pr.complaint_rating_4
      FROM products p
      JOIN product_rules pr ON pr.product_id = p.id
      WHERE p.store_id = $1
      LIMIT 5
    `, [store.id]);

    console.log('🔍 Sample products WITH rules:');
    sampleWithRules.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. ${row.name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   submit_complaints: ${row.submit_complaints}`);
      console.log(`   Enabled ratings: ${[1, 2, 3, 4].filter(r => row[`complaint_rating_${r}`]).join(', ') || 'none'}`);
    });

    // Sample products WITHOUT rules
    const sampleWithoutRules = await pool.query(`
      SELECT p.id, p.name
      FROM products p
      WHERE p.store_id = $1
        AND NOT EXISTS(SELECT 1 FROM product_rules WHERE product_id = p.id)
      LIMIT 5
    `, [store.id]);

    console.log('\n\n🔍 Sample products WITHOUT rules:');
    sampleWithoutRules.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.name} (ID: ${row.id})`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
