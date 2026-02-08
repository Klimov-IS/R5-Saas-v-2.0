/**
 * Script to add indexes for draft complaints count optimization
 * Run: node scripts/add-draft-index.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.production' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function createIndexes() {
  const client = await pool.connect();

  try {
    console.log('Creating indexes for draft complaints optimization...\n');

    // Index 1: Partial index on review_complaints for drafts only
    console.log('1. Creating idx_complaints_draft_review...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_complaints_draft_review
      ON review_complaints(review_id)
      WHERE status = 'draft'
    `);
    console.log('   ✅ Done\n');

    // Index 2: Composite index on reviews for store + product lookup
    console.log('2. Creating idx_reviews_store_product...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_store_product
      ON reviews(store_id, product_id)
    `);
    console.log('   ✅ Done\n');

    // Index 3: Partial index on products for active work_status
    console.log('3. Creating idx_products_work_active...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_work_active
      ON products(id)
      WHERE work_status = 'active'
    `);
    console.log('   ✅ Done\n');

    // Verify indexes
    console.log('Verifying indexes...');
    const result = await client.query(`
      SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_indexes
      JOIN pg_class ON pg_class.relname = pg_indexes.indexname
      WHERE indexname IN ('idx_complaints_draft_review', 'idx_reviews_store_product', 'idx_products_work_active')
    `);

    console.log('\nCreated indexes:');
    result.rows.forEach(row => {
      console.log(`  - ${row.indexname} (${row.size})`);
    });

    console.log('\n✅ All indexes created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createIndexes();
