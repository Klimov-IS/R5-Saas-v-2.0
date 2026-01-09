/**
 * Apply composite indexes migration to PostgreSQL
 * This script runs the migration file: 20260107_002_add_composite_indexes.sql
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '6432', 10),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Connecting to PostgreSQL...');
    console.log(`   Host: ${process.env.POSTGRES_HOST}`);
    console.log(`   DB: ${process.env.POSTGRES_DB}`);
    console.log(`   User: ${process.env.POSTGRES_USER}`);
    console.log('');

    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260107_002_add_composite_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log(`   File: 20260107_002_add_composite_indexes.sql`);
    console.log('');

    // Execute migration
    console.log('⚡ Executing migration...');
    const startTime = Date.now();

    await pool.query(migrationSQL);

    const duration = Date.now() - startTime;
    console.log(`✅ Migration applied successfully! (${duration}ms)`);
    console.log('');

    // Query index statistics
    console.log('📊 Checking created indexes...');
    const indexQuery = `
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;

    const result = await pool.query(indexQuery);

    console.log('');
    console.log('📋 Index Report:');
    console.log('─'.repeat(80));
    console.log('TABLE'.padEnd(20), 'INDEX NAME'.padEnd(35), 'SIZE');
    console.log('─'.repeat(80));

    result.rows.forEach(row => {
      console.log(
        row.tablename.padEnd(20),
        row.indexname.padEnd(35),
        row.index_size
      );
    });

    console.log('─'.repeat(80));
    console.log(`Total indexes: ${result.rows.length}`);
    console.log('');

    // Show indexes by table
    const tableGroups = result.rows.reduce((acc, row) => {
      if (!acc[row.tablename]) acc[row.tablename] = [];
      acc[row.tablename].push(row.indexname);
      return acc;
    }, {});

    console.log('📊 Indexes by table:');
    Object.entries(tableGroups).forEach(([table, indexes]) => {
      console.log(`   ${table}: ${indexes.length} indexes`);
      indexes.forEach(idx => console.log(`     - ${idx}`));
    });
    console.log('');

    console.log('🎉 All done! Your queries should be much faster now!');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
applyMigration();
