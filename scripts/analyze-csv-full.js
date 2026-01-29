require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) { // Skip header
    const match = lines[i].match(/^([^,]+),(\d+),([^,]+),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*)$/);
    if (match) {
      const [_, client, article, status, minDate, submitComplaints, r1, r2, r3, r4] = match;

      rows.push({
        client: client.replace(/^"|"$/g, '').replace(/""/g, '"'), // Clean quotes
        article: article.trim(),
        status: status.trim(),
        minDate: minDate.trim(),
        submitComplaints: submitComplaints.trim() === 'да',
        rating1: r1.trim() === 'TRUE',
        rating2: r2.trim() === 'TRUE',
        rating3: r3.trim() === 'TRUE',
        rating4: r4.trim() === 'TRUE',
      });
    }
  }

  return rows;
}

(async () => {
  try {
    console.log('\n=== ПОЛНЫЙ АНАЛИЗ CSV ФАЙЛА ===\n');

    // 1. Parse CSV
    const csvPath = path.join(__dirname, '../docs/Rating5_OPS - Артикулы (копия).csv');
    const csvData = parseCSV(csvPath);

    console.log(`1. CSV файл загружен: ${csvData.length} строк\n`);

    // 2. Get all stores from DB
    const storesRes = await pool.query('SELECT id, name FROM stores ORDER BY name');
    const dbStores = storesRes.rows;

    console.log(`2. Магазины в БД: ${dbStores.length}\n`);

    // 3. Analyze CSV data
    const csvClients = {};
    const statusStats = { 'Активен': 0, 'Стоп': 0 };
    const ratingStats = {};

    csvData.forEach(row => {
      if (!csvClients[row.client]) {
        csvClients[row.client] = {
          name: row.client,
          products: [],
          total: 0,
          active: 0,
          stopped: 0,
        };
      }

      csvClients[row.client].products.push(row);
      csvClients[row.client].total++;

      if (row.status === 'Активен') {
        csvClients[row.client].active++;
        statusStats['Активен']++;
      } else if (row.status === 'Стоп') {
        csvClients[row.client].stopped++;
        statusStats['Стоп']++;
      }

      const ratingKey = `${row.rating1?'1':''}${row.rating2?'2':''}${row.rating3?'3':''}${row.rating4?'4':''}`;
      ratingStats[ratingKey] = (ratingStats[ratingKey] || 0) + 1;
    });

    console.log('3. Статистика CSV:');
    console.log(`   Уникальных клиентов: ${Object.keys(csvClients).length}`);
    console.log(`   Активных товаров: ${statusStats['Активен']}`);
    console.log(`   Стоп товаров: ${statusStats['Стоп']}`);
    console.log(`\n   Комбинации рейтингов:`);
    Object.entries(ratingStats).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
      const display = key ? key.split('').map(r => `${r}★`).join(' ') : 'none';
      console.log(`     ${display}: ${count}`);
    });

    // 4. Match CSV clients to DB stores
    console.log(`\n4. Сопоставление клиентов CSV → Магазины БД:\n`);
    console.log('='.repeat(100));

    const matchedStores = [];
    const unmatchedCSV = [];
    const unmatchedDB = [...dbStores];

    Object.values(csvClients).forEach(client => {
      // Try exact match first
      let match = dbStores.find(s => s.name.toLowerCase() === client.name.toLowerCase());

      // Try fuzzy match
      if (!match) {
        match = dbStores.find(s => {
          const sName = s.name.replace(/[""«»ООО|ИП]/g, '').trim().toLowerCase();
          const cName = client.name.replace(/[""«»ООО|ИП]/g, '').trim().toLowerCase();
          return sName.includes(cName.split(' ')[0]) || cName.includes(sName.split(' ')[0]);
        });
      }

      if (match) {
        matchedStores.push({ csv: client, db: match });
        const idx = unmatchedDB.findIndex(s => s.id === match.id);
        if (idx >= 0) unmatchedDB.splice(idx, 1);
        console.log(`✅ "${client.name}"`);
        console.log(`   → "${match.name}" (${match.id})`);
        console.log(`   Товаров: ${client.total} (${client.active} активных, ${client.stopped} стоп)`);
        console.log();
      } else {
        unmatchedCSV.push(client);
        console.log(`❌ "${client.name}" → НЕ НАЙДЕН в БД`);
        console.log(`   Товаров в CSV: ${client.total}`);
        console.log();
      }
    });

    console.log('='.repeat(100));
    console.log(`\nИТОГО сопоставление:`);
    console.log(`  ✅ Найдено совпадений: ${matchedStores.length}`);
    console.log(`  ❌ Не найдено в БД: ${unmatchedCSV.length}`);
    console.log(`  ⚠️  Магазины в БД без CSV: ${unmatchedDB.length}`);

    if (unmatchedCSV.length > 0) {
      console.log(`\nКлиенты из CSV без совпадений в БД:`);
      unmatchedCSV.forEach(c => console.log(`  - ${c.name} (${c.total} товаров)`));
    }

    if (unmatchedDB.length > 0) {
      console.log(`\nМагазины в БД без данных в CSV:`);
      unmatchedDB.forEach(s => console.log(`  - ${s.name}`));
    }

    // 5. Check if wb_product_id matches
    console.log(`\n\n5. Проверка соответствия артикулов (wb_product_id):\n`);
    console.log('='.repeat(100));

    // Sample 50 random articles from active products
    const activeArticles = csvData
      .filter(r => r.status === 'Активен')
      .slice(0, 50)
      .map(r => r.article);

    const matchTest = await pool.query(`
      SELECT wb_product_id, id, name
      FROM products
      WHERE wb_product_id::text = ANY($1)
    `, [activeArticles]);

    console.log(`Проверено случайных артикулов: ${activeArticles.length}`);
    console.log(`Найдено совпадений по wb_product_id: ${matchTest.rows.length}`);
    console.log(`Процент совпадения: ${(matchTest.rows.length / activeArticles.length * 100).toFixed(1)}%`);

    if (matchTest.rows.length > 0) {
      console.log(`\n✅ wb_product_id ПРАВИЛЬНОЕ ПОЛЕ для сопоставления!\n`);
      console.log(`Примеры найденных товаров:`);
      matchTest.rows.slice(0, 5).forEach(p => {
        console.log(`  ${p.wb_product_id}: ${p.name}`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
