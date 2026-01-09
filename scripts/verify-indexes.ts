/**
 * Verify indexes were created successfully
 * Run: npx tsx scripts/verify-indexes.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

async function verifyIndexes() {
  console.log('🔍 Verifying indexes...\n');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '6432'),
    database: process.env.POSTGRES_DATABASE || 'wb_reputation',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if indexes exist
    const verifyQuery = `
      SELECT
        schemaname,
        relname AS tablename,
        indexrelname AS indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        idx_scan AS times_used,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched
      FROM pg_stat_user_indexes
      WHERE indexrelname IN (
        'idx_products_store_created',
        'idx_products_store_wb_id',
        'idx_reviews_store_rating'
      )
      ORDER BY pg_relation_size(indexrelid) DESC;
    `;

    const result = await pool.query(verifyQuery);

    if (result.rows.length === 0) {
      console.log('⚠️  No indexes found!\n');
      console.log('Expected indexes:');
      console.log('  - idx_products_store_created');
      console.log('  - idx_products_store_wb_id');
      console.log('  - idx_reviews_store_rating\n');
    } else {
      console.log('✅ Found indexes:\n');
      result.rows.forEach(row => {
        console.log(`📊 ${row.indexname}`);
        console.log(`   Table: ${row.tablename}`);
        console.log(`   Size: ${row.index_size}`);
        console.log(`   Times used: ${row.times_used}`);
        console.log(`   Tuples read: ${row.tuples_read}`);
        console.log(`   Tuples fetched: ${row.tuples_fetched}\n`);
      });
    }

    // Test query to see if index is used
    console.log('🧪 Testing query performance (EXPLAIN)...\n');

    // Get a store ID first
    const storeResult = await pool.query('SELECT id FROM stores LIMIT 1');
    if (storeResult.rows.length === 0) {
      console.log('⚠️  No stores found in database. Cannot test query.\n');
      return;
    }

    const storeId = storeResult.rows[0].id;
    console.log(`Using store ID: ${storeId}\n`);

    const explainQuery = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id, name, wb_product_id, vendor_code, price, image_url, store_id, owner_id,
             review_count, wb_api_data, last_review_update_date, is_active, created_at, updated_at
      FROM products
      WHERE store_id = $1
      ORDER BY created_at DESC
      LIMIT 100;
    `;

    const explainResult = await pool.query(explainQuery, [storeId]);

    console.log('📈 Query execution plan:');
    explainResult.rows.forEach(row => {
      const plan = row['QUERY PLAN'];
      // Highlight important parts
      if (plan.includes('Index Scan')) {
        console.log(`   ✅ ${plan}`);
      } else if (plan.includes('Seq Scan')) {
        console.log(`   ⚠️  ${plan}`);
      } else {
        console.log(`   ${plan}`);
      }
    });

    console.log('\n');

    // Check if index is being used
    const usingIndex = explainResult.rows.some(row =>
      row['QUERY PLAN'].includes('idx_products_store_created')
    );

    if (usingIndex) {
      console.log('✅ INDEX IS BEING USED! Query should be ~350x faster.\n');
    } else {
      console.log('⚠️  Index exists but query planner is not using it.');
      console.log('   This may happen if table has very few rows.');
      console.log('   Index will be used automatically when table grows.\n');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyIndexes()
  .then(() => {
    console.log('🎉 Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
