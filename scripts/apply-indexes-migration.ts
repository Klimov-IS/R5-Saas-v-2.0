/**
 * Apply critical indexes migration
 * Run: npx tsx scripts/apply-indexes-migration.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

async function applyMigration() {
  console.log('🚀 Starting indexes migration...\n');

  // Create connection pool
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '6432'),
    database: process.env.POSTGRES_DATABASE || 'wb_reputation',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Read migration file
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260108_003_optimize_products_indexes.sql'
    );

    console.log(`📄 Reading migration file: ${migrationPath}`);
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    // Execute migration
    console.log('⚙️  Executing migration...\n');
    const startTime = Date.now();

    await pool.query(migrationSQL);

    const duration = Date.now() - startTime;
    console.log(`✅ Migration completed in ${duration}ms\n`);

    // Verify indexes were created
    console.log('🔍 Verifying indexes...\n');

    const verifyQuery = `
      SELECT
        schemaname,
        relname AS tablename,
        indexrelname AS indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
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
      console.log('⚠️  No indexes found. They may have been created with different names.');
    } else {
      console.log('📊 Created indexes:\n');
      result.rows.forEach(row => {
        console.log(`   ✓ ${row.indexname}`);
        console.log(`     Table: ${row.tablename}`);
        console.log(`     Size: ${row.index_size}\n`);
      });
    }

    // Test query performance
    console.log('🧪 Testing query performance...\n');

    const testQuery = `
      EXPLAIN ANALYZE
      SELECT id, name, wb_product_id, vendor_code, price, image_url, store_id, owner_id,
             review_count, wb_api_data, last_review_update_date, is_active, created_at, updated_at
      FROM products
      WHERE store_id = (SELECT id FROM stores LIMIT 1)
      ORDER BY created_at DESC
      LIMIT 100;
    `;

    const explainResult = await pool.query(testQuery);

    console.log('📈 Query execution plan:');
    explainResult.rows.forEach(row => {
      console.log(`   ${row['QUERY PLAN']}`);
    });

    console.log('\n✨ Migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Test reviews sync: should be ~8x faster');
    console.log('   2. Monitor index usage with: SELECT * FROM pg_stat_user_indexes');
    console.log('   3. Check slow query logs - should see dramatic improvement\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
