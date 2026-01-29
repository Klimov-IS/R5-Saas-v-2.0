require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432,
  database: 'wb_reputation',
  user: 'admin_R5',
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log('\n=== PRODUCT_RULES: Подробное объяснение ===\n');

    // 1. Table structure
    console.log('📋 1. СТРУКТУРА ТАБЛИЦЫ product_rules:');
    const tableInfo = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'product_rules'
      ORDER BY ordinal_position
    `);

    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // 2. Total statistics across ALL stores
    console.log('\n📊 2. ОБЩАЯ СТАТИСТИКА (все магазины):');
    const totalStats = await pool.query(`
      SELECT
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT pr.product_id) as products_with_rules,
        COUNT(DISTINCT CASE WHEN pr.submit_complaints = true THEN pr.product_id END) as products_submit_enabled
      FROM products p
      LEFT JOIN product_rules pr ON pr.product_id = p.id
    `);

    const stats = totalStats.rows[0];
    console.log(`   Всего продуктов в БД: ${stats.total_products}`);
    console.log(`   Продуктов С настроенными rules: ${stats.products_with_rules} (${(stats.products_with_rules / stats.total_products * 100).toFixed(1)}%)`);
    console.log(`   Продуктов С submit_complaints=true: ${stats.products_submit_enabled} (${(stats.products_submit_enabled / stats.total_products * 100).toFixed(1)}%)`);

    // 3. Sample product_rules
    console.log('\n🔍 3. ПРИМЕРЫ НАСТРОЕННЫХ PRODUCT_RULES:');
    const samples = await pool.query(`
      SELECT
        pr.product_id,
        p.name as product_name,
        s.name as store_name,
        pr.submit_complaints,
        pr.complaint_rating_1,
        pr.complaint_rating_2,
        pr.complaint_rating_3,
        pr.complaint_rating_4,
        pr.created_at,
        pr.updated_at
      FROM product_rules pr
      JOIN products p ON p.id = pr.product_id
      JOIN stores s ON s.id = p.store_id
      ORDER BY pr.created_at DESC
      LIMIT 5
    `);

    if (samples.rows.length === 0) {
      console.log('   ❌ НЕТ НАСТРОЕННЫХ PRODUCT_RULES В БД!');
    } else {
      samples.rows.forEach((row, i) => {
        console.log(`\n   Пример ${i + 1}:`);
        console.log(`   Магазин: ${row.store_name}`);
        console.log(`   Продукт: ${row.product_name}`);
        console.log(`   ID: ${row.product_id}`);
        console.log(`   submit_complaints: ${row.submit_complaints}`);
        console.log(`   Включенные рейтинги: ${[1, 2, 3, 4].filter(r => row[`complaint_rating_${r}`]).join(', ') || 'none'}`);
        console.log(`   Создано: ${row.created_at}`);
        console.log(`   Обновлено: ${row.updated_at}`);
      });
    }

    // 4. Check API endpoints
    console.log('\n🔌 4. API ДЛЯ УПРАВЛЕНИЯ PRODUCT_RULES:');
    console.log('   Поищем в коде, какие есть эндпоинты...');

    // 5. Stores by rule configuration
    console.log('\n📦 5. МАГАЗИНЫ ПО НАЛИЧИЮ RULES:');
    const storeStats = await pool.query(`
      SELECT
        s.name as store_name,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT pr.product_id) as products_with_rules,
        COUNT(DISTINCT CASE WHEN pr.submit_complaints = true THEN pr.product_id END) as products_enabled
      FROM stores s
      JOIN products p ON p.store_id = s.id
      LEFT JOIN product_rules pr ON pr.product_id = p.id
      GROUP BY s.id, s.name
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY products_with_rules DESC
      LIMIT 10
    `);

    storeStats.rows.forEach((row, i) => {
      const coverage = row.total_products > 0 ? (row.products_with_rules / row.total_products * 100).toFixed(1) : 0;
      console.log(`\n   ${i + 1}. ${row.store_name}`);
      console.log(`      Всего продуктов: ${row.total_products}`);
      console.log(`      С rules: ${row.products_with_rules} (${coverage}%)`);
      console.log(`      С submit enabled: ${row.products_enabled}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
