/**
 * Test script to check API tokens and product rules in database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: 6432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: 'wb_reputation',
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  try {
    console.log('🔍 Проверка базы данных...\n');

    // 1. Check API tokens
    console.log('📋 1. Проверка API токенов:');
    const tokensResult = await pool.query(`
      SELECT id, api_key, created_at
      FROM user_settings
      WHERE api_key IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`Найдено токенов: ${tokensResult.rows.length}`);
    tokensResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. User ID: ${row.id}`);
      console.log(`     API Key: ${row.api_key}`);
      console.log(`     Created: ${row.created_at}\n`);
    });

    // 2. Check store exists
    const storeId = 'TwKRrPji2KhTS8TmYJlD';
    console.log(`\n📦 2. Проверка магазина ${storeId}:`);
    const storeResult = await pool.query(`
      SELECT id, name, owner_id
      FROM stores
      WHERE id = $1
    `, [storeId]);

    if (storeResult.rows.length === 0) {
      console.log(`❌ Магазин ${storeId} не найден`);
    } else {
      const store = storeResult.rows[0];
      console.log(`✅ Магазин найден:`);
      console.log(`   Name: ${store.name}`);
      console.log(`   Owner ID: ${store.owner_id}\n`);

      // 3. Check active products
      console.log(`\n🏷️ 3. Проверка активных продуктов:`);
      const productsResult = await pool.query(`
        SELECT
          id, wb_product_id, vendor_code, name, work_status
        FROM products
        WHERE store_id = $1
          AND work_status = 'active'
        ORDER BY name ASC
        LIMIT 10
      `, [storeId]);

      console.log(`Найдено активных продуктов: ${productsResult.rows.length}`);
      productsResult.rows.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ${p.name}`);
        console.log(`     ID: ${p.id}`);
        console.log(`     Артикул: ${p.vendor_code}`);
        console.log(`     WB Product ID: ${p.wb_product_id}`);
        console.log(`     Status: ${p.work_status}\n`);
      });

      // 4. Check product rules
      console.log(`\n⚙️ 4. Проверка правил для продуктов:`);
      const rulesResult = await pool.query(`
        SELECT
          pr.product_id,
          p.vendor_code,
          p.name,
          pr.submit_complaints,
          pr.complaint_rating_1,
          pr.complaint_rating_2,
          pr.complaint_rating_3,
          pr.complaint_rating_4,
          pr.work_in_chats,
          pr.chat_strategy
        FROM product_rules pr
        INNER JOIN products p ON p.id = pr.product_id
        WHERE p.store_id = $1
          AND p.work_status = 'active'
        LIMIT 10
      `, [storeId]);

      console.log(`Найдено правил: ${rulesResult.rows.length}`);
      rulesResult.rows.forEach((rule, idx) => {
        console.log(`  ${idx + 1}. ${rule.name} (${rule.vendor_code})`);
        console.log(`     Submit Complaints: ${rule.submit_complaints}`);
        console.log(`     Ratings: [1:${rule.complaint_rating_1}, 2:${rule.complaint_rating_2}, 3:${rule.complaint_rating_3}, 4:${rule.complaint_rating_4}]`);
        console.log(`     Work in Chats: ${rule.work_in_chats}`);
        console.log(`     Chat Strategy: ${rule.chat_strategy}\n`);
      });

      // 5. Count products WITHOUT rules
      const noRulesResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM products p
        LEFT JOIN product_rules pr ON pr.product_id = p.id
        WHERE p.store_id = $1
          AND p.work_status = 'active'
          AND pr.id IS NULL
      `, [storeId]);

      const noRulesCount = noRulesResult.rows[0].count;
      if (parseInt(noRulesCount) > 0) {
        console.log(`\n⚠️ Внимание: ${noRulesCount} активных продуктов БЕЗ правил`);
      } else {
        console.log(`\n✅ Все активные продукты имеют правила`);
      }
    }

    console.log('\n✅ Проверка завершена');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkDatabase();
