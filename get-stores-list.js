const { Pool } = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: 'MyNewPass123',
  ssl: { rejectUnauthorized: false }
});

async function getStores() {
  try {
    const result = await pool.query(`
      SELECT id, name, status, total_reviews
      FROM stores
      ORDER BY name
    `);

    console.log('\n📊 Список магазинов для синхронизации:\n');
    console.log('ID'.padEnd(25) + 'Название'.padEnd(40) + 'Статус'.padEnd(10) + 'Отзывов');
    console.log('='.repeat(95));

    result.rows.forEach(store => {
      console.log(
        store.id.padEnd(25) +
        store.name.padEnd(40) +
        (store.status || 'active').padEnd(10) +
        (store.total_reviews || 0).toLocaleString()
      );
    });

    console.log('\n' + '='.repeat(95));
    console.log(`Всего магазинов: ${result.rows.length}\n`);

    console.log('💡 Для использования в StatusSyncBulk скопируйте нужный ID, например:');
    console.log('   await StatusSyncBulk.syncPages("' + result.rows[0].id + '", 10, 50)\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

getStores();
