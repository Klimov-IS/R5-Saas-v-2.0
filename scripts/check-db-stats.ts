import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkDBStats() {
  try {
    // Total reviews
    const totalResult = await query('SELECT COUNT(*) as total FROM reviews');
    console.log('📊 Total reviews in database:', totalResult.rows[0].total);

    // Reviews by store
    const byStoreResult = await query(`
      SELECT s.name, COUNT(r.id) as count
      FROM stores s
      LEFT JOIN reviews r ON r.store_id = s.id
      GROUP BY s.id, s.name
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('\n🏪 Top 10 stores by review count:');
    byStoreResult.rows.forEach((row: any) => {
      console.log(`  ${row.name}: ${row.count} reviews`);
    });

    // Recent reviews
    const recentResult = await query(`
      SELECT s.name as store_name, COUNT(r.id) as count
      FROM reviews r
      INNER JOIN stores s ON r.store_id = s.id
      WHERE r.created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY s.id, s.name
      ORDER BY count DESC
    `);
    console.log('\n🆕 Reviews added in last hour:');
    if (recentResult.rows.length === 0) {
      console.log('  No reviews added in last hour');
    } else {
      recentResult.rows.forEach((row: any) => {
        console.log(`  ${row.store_name}: ${row.count} reviews`);
      });
    }

    // Check complaints
    const complaintsResult = await query('SELECT COUNT(*) as total FROM review_complaints');
    console.log('\n💬 Total complaints in database:', complaintsResult.rows[0].total);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDBStats();
