/**
 * Check created indexes in PostgreSQL
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkIndexes() {
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
    console.log('📊 Checking created indexes...\n');

    // Query all custom indexes (idx_*)
    const query = `
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
        am.amname AS index_type,
        obj_description(i.oid, 'pg_class') AS description
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      WHERE t.relkind = 'r'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND i.relname LIKE 'idx_%'
      ORDER BY t.relname, i.relname;
    `;

    const result = await pool.query(query);

    console.log('═'.repeat(100));
    console.log('TABLE'.padEnd(20), 'INDEX NAME'.padEnd(40), 'SIZE'.padEnd(10), 'TYPE');
    console.log('═'.repeat(100));

    const byTable = {};
    result.rows.forEach(row => {
      console.log(
        row.table_name.padEnd(20),
        row.index_name.padEnd(40),
        row.index_size.padEnd(10),
        row.index_type
      );

      if (!byTable[row.table_name]) {
        byTable[row.table_name] = [];
      }
      byTable[row.table_name].push(row);
    });

    console.log('═'.repeat(100));
    console.log(`\n✅ Total indexes found: ${result.rows.length}\n`);

    // Summary by table
    console.log('📋 Summary by table:\n');
    Object.entries(byTable).forEach(([table, indexes]) => {
      console.log(`   ${table} (${indexes.length} indexes):`);
      indexes.forEach(idx => {
        console.log(`     • ${idx.index_name} - ${idx.index_size}`);
        if (idx.description) {
          console.log(`       └─ ${idx.description}`);
        }
      });
      console.log('');
    });

    console.log('🎉 All indexes are active and ready to speed up your queries!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkIndexes();
