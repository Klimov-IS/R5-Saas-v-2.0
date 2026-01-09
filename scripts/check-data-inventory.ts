/**
 * Check data inventory across all stores
 */

import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

import { query, closePool } from '../src/db/client';

async function checkInventory() {
  try {
    console.log('='.repeat(70));
    console.log('DATA INVENTORY REPORT');
    console.log('='.repeat(70));
    console.log();

    // 1. Overall counts
    console.log('📊 OVERALL DATA COUNTS:');
    console.log('-'.repeat(70));

    const tables = [
      { name: 'stores', label: 'Магазины' },
      { name: 'products', label: 'Товары' },
      { name: 'reviews', label: 'Отзывы' },
      { name: 'chats', label: 'Чаты' },
      { name: 'chat_messages', label: 'Сообщения в чатах' },
      { name: 'questions', label: 'Вопросы' },
      { name: 'ai_logs', label: 'AI логи' },
    ];

    for (const table of tables) {
      const result = await query(`SELECT COUNT(*) as count FROM ${table.name}`);
      console.log(`  ${table.label.padEnd(25)}: ${result.rows[0].count}`);
    }

    console.log();

    // 2. Stores with/without products
    console.log('📦 STORES WITH PRODUCTS:');
    console.log('-'.repeat(70));

    const storesWithProducts = await query(`
      SELECT
        s.id,
        s.name,
        COUNT(p.id) as product_count,
        s.last_product_update_status,
        s.last_product_update_date
      FROM stores s
      LEFT JOIN products p ON s.id = p.store_id
      GROUP BY s.id, s.name, s.last_product_update_status, s.last_product_update_date
      ORDER BY product_count DESC
    `);

    const withProducts = storesWithProducts.rows.filter(s => parseInt(s.product_count) > 0);
    const withoutProducts = storesWithProducts.rows.filter(s => parseInt(s.product_count) === 0);

    console.log(`  Stores WITH products: ${withProducts.length}/${storesWithProducts.rows.length}`);
    console.log(`  Stores WITHOUT products: ${withoutProducts.length}/${storesWithProducts.rows.length}`);
    console.log();

    if (withProducts.length > 0) {
      console.log('  Top stores by product count:');
      withProducts.slice(0, 5).forEach(s => {
        const lastUpdate = s.last_product_update_date
          ? new Date(s.last_product_update_date).toLocaleString('ru-RU')
          : 'Never';
        console.log(`    ${s.name.padEnd(30)} - ${s.product_count} products (last: ${lastUpdate})`);
      });
      console.log();
    }

    // 3. Stores with/without reviews
    console.log('⭐ STORES WITH REVIEWS:');
    console.log('-'.repeat(70));

    const storesWithReviews = await query(`
      SELECT
        s.id,
        s.name,
        COUNT(r.id) as review_count,
        s.last_review_update_status,
        s.last_review_update_date
      FROM stores s
      LEFT JOIN reviews r ON s.id = r.store_id
      GROUP BY s.id, s.name, s.last_review_update_status, s.last_review_update_date
      ORDER BY review_count DESC
    `);

    const withReviews = storesWithReviews.rows.filter(s => parseInt(s.review_count) > 0);
    const withoutReviews = storesWithReviews.rows.filter(s => parseInt(s.review_count) === 0);

    console.log(`  Stores WITH reviews: ${withReviews.length}/${storesWithReviews.rows.length}`);
    console.log(`  Stores WITHOUT reviews: ${withoutReviews.length}/${storesWithReviews.rows.length}`);
    console.log();

    if (withReviews.length > 0) {
      console.log('  Top stores by review count:');
      withReviews.slice(0, 5).forEach(s => {
        const lastUpdate = s.last_review_update_date
          ? new Date(s.last_review_update_date).toLocaleString('ru-RU')
          : 'Never';
        console.log(`    ${s.name.padEnd(30)} - ${s.review_count} reviews (last: ${lastUpdate})`);
      });
      console.log();
    }

    // 4. Stores with/without chats
    console.log('💬 STORES WITH CHATS:');
    console.log('-'.repeat(70));

    const storesWithChats = await query(`
      SELECT
        s.id,
        s.name,
        COUNT(c.id) as chat_count,
        s.last_chat_update_status,
        s.last_chat_update_date,
        s.chat_tag_counts
      FROM stores s
      LEFT JOIN chats c ON s.id = c.store_id
      GROUP BY s.id, s.name, s.last_chat_update_status, s.last_chat_update_date, s.chat_tag_counts
      ORDER BY chat_count DESC
    `);

    const withChats = storesWithChats.rows.filter(s => parseInt(s.chat_count) > 0);
    const withoutChats = storesWithChats.rows.filter(s => parseInt(s.chat_count) === 0);

    console.log(`  Stores WITH chats: ${withChats.length}/${storesWithChats.rows.length}`);
    console.log(`  Stores WITHOUT chats: ${withoutChats.length}/${storesWithChats.rows.length}`);
    console.log();

    if (withChats.length > 0) {
      console.log('  Top stores by chat count:');
      withChats.slice(0, 5).forEach(s => {
        const lastUpdate = s.last_chat_update_date
          ? new Date(s.last_chat_update_date).toLocaleString('ru-RU')
          : 'Never';
        const tagCounts = s.chat_tag_counts || {};
        const untagged = tagCounts.untagged || 0;
        console.log(`    ${s.name.padEnd(30)} - ${s.chat_count} chats (${untagged} untagged, last: ${lastUpdate})`);
      });
      console.log();
    }

    // 5. AI classification status
    console.log('🤖 AI CLASSIFICATION STATUS:');
    console.log('-'.repeat(70));

    const aiStats = await query(`
      SELECT
        COUNT(CASE WHEN tag = 'untagged' THEN 1 END) as untagged,
        COUNT(CASE WHEN tag = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN tag = 'successful' THEN 1 END) as successful,
        COUNT(CASE WHEN tag = 'unsuccessful' THEN 1 END) as unsuccessful,
        COUNT(CASE WHEN tag = 'no_reply' THEN 1 END) as no_reply,
        COUNT(CASE WHEN tag = 'completed' THEN 1 END) as completed,
        COUNT(*) as total
      FROM chats
    `);

    const stats = aiStats.rows[0];
    console.log(`  Total chats: ${stats.total}`);
    console.log(`  Untagged: ${stats.untagged} (${((parseInt(stats.untagged) / parseInt(stats.total)) * 100).toFixed(1)}%)`);
    console.log(`  Active: ${stats.active}`);
    console.log(`  No Reply: ${stats.no_reply}`);
    console.log(`  Successful: ${stats.successful}`);
    console.log(`  Unsuccessful: ${stats.unsuccessful}`);
    console.log(`  Completed: ${stats.completed}`);
    console.log();

    // 6. Stores without API tokens
    console.log('🔑 API TOKEN STATUS:');
    console.log('-'.repeat(70));

    const storesWithoutToken = await query(`
      SELECT id, name
      FROM stores
      WHERE api_token IS NULL OR api_token = ''
    `);

    console.log(`  Stores WITHOUT api_token: ${storesWithoutToken.rows.length}`);
    if (storesWithoutToken.rows.length > 0) {
      console.log('  ⚠️  Warning: These stores cannot sync data:');
      storesWithoutToken.rows.forEach(s => {
        console.log(`    - ${s.name}`);
      });
    } else {
      console.log('  ✅ All stores have API tokens');
    }
    console.log();

    // 7. Recommendations
    console.log('💡 RECOMMENDATIONS:');
    console.log('-'.repeat(70));

    const recommendations: string[] = [];

    if (withoutProducts.length > 0) {
      recommendations.push(`Sync products for ${withoutProducts.length} stores`);
    }

    if (withoutReviews.length > 0) {
      recommendations.push(`Sync reviews for ${withoutReviews.length} stores`);
    }

    if (withoutChats.length > 0) {
      recommendations.push(`Sync chats for ${withoutChats.length} stores`);
    }

    if (parseInt(stats.untagged) > 0) {
      recommendations.push(`Classify ${stats.untagged} untagged chats with AI`);
    }

    if (recommendations.length === 0) {
      console.log('  ✅ All data is synchronized!');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log();
    console.log('='.repeat(70));
    console.log('END OF REPORT');
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error('[INVENTORY] Error:', error.message);
    throw error;
  } finally {
    await closePool();
  }
}

checkInventory().catch(console.error);
