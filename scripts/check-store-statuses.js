require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL?.split('?')[0];
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkStatuses() {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM stores
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('📊 Статусы магазинов в базе данных:\n');
    result.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} магазинов`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkStatuses();
