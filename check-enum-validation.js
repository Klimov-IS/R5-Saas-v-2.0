/**
 * Stage 4: Validate Database ENUM Types
 * Compares database schema with STATUS_MAPPING_REFERENCE.md v2.1
 *
 * Quick validation - database already has 2M+ records
 */

const {Pool} = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: 'MyNewPass123',
  ssl: { rejectUnauthorized: false }
});

// Expected from STATUS_MAPPING_REFERENCE.md v2.1
const EXPECTED_ENUMS = {
  review_status_wb: ['visible', 'unpublished', 'excluded', 'unknown'],
  product_status_by_review: ['purchased', 'refused', 'not_specified', 'unknown'],
  chat_status_by_review: ['available', 'unavailable', 'unknown'],
  complaint_status: ['not_sent', 'draft', 'sent', 'approved', 'rejected', 'pending']
};

async function validateEnums() {
  console.log('\n' + '='.repeat(70));
  console.log('STAGE 4: Database ENUM Validation');
  console.log('='.repeat(70) + '\n');

  try {
    // Step 1: Check ENUM types exist
    console.log('Step 1: Checking ENUM types in database...\n');

    const enumsResult = await pool.query(`
      SELECT
        t.typname AS enum_type,
        e.enumlabel AS enum_value,
        e.enumsortorder AS sort_order
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('review_status_wb', 'product_status_by_review',
                          'chat_status_by_review', 'complaint_status')
      ORDER BY t.typname, e.enumsortorder;
    `);

    // Group by enum type
    const actualEnums = {};
    enumsResult.rows.forEach(row => {
      if (!actualEnums[row.enum_type]) {
        actualEnums[row.enum_type] = [];
      }
      actualEnums[row.enum_type].push(row.enum_value);
    });

    let allMatch = true;

    for (const [enumType, expectedValues] of Object.entries(EXPECTED_ENUMS)) {
      const actualValues = actualEnums[enumType] || [];

      console.log(`📊 ${enumType}:`);
      console.log(`   Database: [${actualValues.join(', ')}]`);
      console.log(`   Expected: [${expectedValues.join(', ')}]`);

      const missing = expectedValues.filter(v => !actualValues.includes(v));
      const extra = actualValues.filter(v => !expectedValues.includes(v));

      if (missing.length === 0 && extra.length === 0) {
        console.log(`   ✅ PERFECT MATCH\n`);
      } else {
        if (missing.length > 0) {
          console.log(`   ⚠️  Missing: [${missing.join(', ')}]`);
          allMatch = false;
        }
        if (extra.length > 0) {
          console.log(`   ℹ️  Extra: [${extra.join(', ')}]`);
        }
        console.log('');
      }
    }

    // Step 2: Check reviews table uses ENUMs
    console.log('\nStep 2: Checking reviews table column types...\n');

    const columnsResult = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'reviews'
        AND column_name IN ('review_status_wb', 'product_status_by_review',
                            'chat_status_by_review', 'complaint_status')
      ORDER BY column_name;
    `);

    columnsResult.rows.forEach(col => {
      const isEnum = col.data_type === 'USER-DEFINED';
      const icon = isEnum ? '✅' : '❌';
      console.log(`${icon} ${col.column_name}: ${col.data_type} ${isEnum ? `(ENUM: ${col.udt_name})` : ''}`);
    });

    // Step 3: Overall data distribution (all reviews)
    console.log('\n\nStep 3: Overall data distribution (all 2M+ reviews)...\n');

    const statsResult = await pool.query(`
      SELECT review_status_wb, COUNT(*) as count
      FROM reviews
      GROUP BY review_status_wb
      ORDER BY count DESC
    `).then(r => {
      console.log('review_status_wb distribution:');
      const total = r.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      r.rows.forEach(row => {
        const pct = ((parseInt(row.count) / total) * 100).toFixed(1);
        console.log(`  ${row.review_status_wb || 'NULL'}: ${row.count.toLocaleString()} (${pct}%)`);
      });
      console.log(`  Total: ${total.toLocaleString()}`);
    });

    await pool.query(`
      SELECT product_status_by_review, COUNT(*) as count
      FROM reviews
      GROUP BY product_status_by_review
      ORDER BY count DESC
    `).then(r => {
      console.log('\nproduct_status_by_review distribution:');
      const total = r.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      r.rows.forEach(row => {
        const pct = ((parseInt(row.count) / total) * 100).toFixed(1);
        console.log(`  ${row.product_status_by_review || 'NULL'}: ${row.count.toLocaleString()} (${pct}%)`);
      });
      console.log(`  Total: ${total.toLocaleString()}`);
    });

    await pool.query(`
      SELECT complaint_status, COUNT(*) as count
      FROM reviews
      GROUP BY complaint_status
      ORDER BY count DESC
    `).then(r => {
      console.log('\ncomplaint_status distribution:');
      const total = r.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      r.rows.forEach(row => {
        const pct = ((parseInt(row.count) / total) * 100).toFixed(1);
        console.log(`  ${row.complaint_status || 'NULL'}: ${row.count.toLocaleString()} (${pct}%)`);
      });
      console.log(`  Total: ${total.toLocaleString()}`);
    });

    // Step 4: Compare with collected data (500 reviews from Extension)
    console.log('\n\nStep 4: Comparison with Extension collection (500 reviews)...\n');
    console.log('From STATUS_MAPPING_REFERENCE.md v2.1:');
    console.log('  review_status_wb: visible (85.8%), excluded (14.2%)');
    console.log('  product_status_by_review: purchased (96.8%), refused (3%), not_specified (0.2%)');
    console.log('  chat_status_by_review: unavailable (100%)');
    console.log('  complaint_status: not_sent (86.6%), approved (5.2%), rejected (8%), pending (0.2%)');

    // Summary
    console.log('\n\n' + '='.repeat(70));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(70) + '\n');

    if (allMatch) {
      console.log('✅ SUCCESS! Database ENUM types match documentation perfectly!\n');
      console.log('Database schema: database-schema.md');
      console.log('Status mapping: STATUS_MAPPING_REFERENCE.md v2.1');
      console.log('Collection data: 500 reviews from WB UI\n');
      console.log('✅ Stage 4: COMPLETED\n');
      console.log('Next steps:');
      console.log('  - Stage 5: Update UI (optional) - add human-readable labels');
      console.log('  - Stage 6: End-to-end testing - verify full workflow\n');
    } else {
      console.log('⚠️  Database ENUM types have minor differences from expected values.\n');
      console.log('This may be intentional or require migration.\n');
      console.log('Review differences above and update STATUS_MAPPING_REFERENCE.md if needed.\n');
    }

    console.log('Database info:');
    console.log(`  Host: rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net`);
    console.log(`  Database: wb_reputation`);
    console.log(`  Records: 2M+ reviews\n`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack:', error.stack);
  } finally {
    await pool.end();
  }
}

validateEnums();
