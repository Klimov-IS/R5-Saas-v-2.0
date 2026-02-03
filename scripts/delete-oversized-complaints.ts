/**
 * Delete oversized complaint drafts (> 975 characters)
 *
 * This script:
 * 1. Finds all draft complaints with text > 975 characters
 * 2. Shows statistics and sample records
 * 3. Deletes them (they will be regenerated on next request)
 * 4. Updates reviews table to reset complaint flags
 *
 * Usage: npx tsx scripts/delete-oversized-complaints.ts
 *
 * @date 2026-02-03
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

const CHARACTER_LIMIT = 975;
const DRY_RUN = process.argv.includes('--dry-run');

async function deleteOversizedComplaints() {
  console.log('━'.repeat(80));
  console.log('🔍 УДАЛЕНИЕ ЧЕРНОВИКОВ ЖАЛОБ > 975 СИМВОЛОВ');
  console.log('━'.repeat(80));
  console.log(`\nЛимит символов: ${CHARACTER_LIMIT}`);
  console.log(`Режим: ${DRY_RUN ? '🔬 DRY RUN (без удаления)' : '⚠️  РЕАЛЬНОЕ УДАЛЕНИЕ'}\n`);

  try {
    // 1. Подсчёт черновиков > 975 символов
    console.log('1️⃣  Подсчёт черновиков для удаления\n');

    const countResult = await query(`
      SELECT
        COUNT(*) as total,
        MIN(LENGTH(complaint_text)) as min_length,
        MAX(LENGTH(complaint_text)) as max_length,
        AVG(LENGTH(complaint_text))::int as avg_length
      FROM review_complaints
      WHERE status = 'draft'
        AND LENGTH(complaint_text) > $1
    `, [CHARACTER_LIMIT]);

    const stats = countResult.rows[0];
    const totalToDelete = parseInt(stats.total, 10);

    console.log(`📊 Статистика черновиков > ${CHARACTER_LIMIT} символов:`);
    console.log(`   Всего к удалению: ${totalToDelete}`);
    console.log(`   Мин. длина: ${stats.min_length || 'N/A'}`);
    console.log(`   Макс. длина: ${stats.max_length || 'N/A'}`);
    console.log(`   Средняя длина: ${stats.avg_length || 'N/A'}`);

    if (totalToDelete === 0) {
      console.log('\n✅ Нет черновиков для удаления!');
      process.exit(0);
    }

    // 2. Список черновиков для удаления
    console.log('\n━'.repeat(80));
    console.log('2️⃣  Список черновиков для удаления (топ-10)\n');

    const listResult = await query(`
      SELECT
        rc.id,
        rc.review_id,
        rc.store_id,
        s.name as store_name,
        LENGTH(rc.complaint_text) as length,
        LEFT(rc.complaint_text, 100) as preview,
        rc.created_at
      FROM review_complaints rc
      JOIN stores s ON rc.store_id = s.id
      WHERE rc.status = 'draft'
        AND LENGTH(rc.complaint_text) > $1
      ORDER BY LENGTH(rc.complaint_text) DESC
      LIMIT 10
    `, [CHARACTER_LIMIT]);

    listResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. [${row.length} символов] ${row.store_name}`);
      console.log(`   Review ID: ${row.review_id}`);
      console.log(`   Preview: "${row.preview}..."`);
      console.log('');
    });

    // 3. Распределение по магазинам
    console.log('━'.repeat(80));
    console.log('3️⃣  Распределение по магазинам\n');

    const storeDistResult = await query(`
      SELECT
        s.name as store_name,
        COUNT(*) as count
      FROM review_complaints rc
      JOIN stores s ON rc.store_id = s.id
      WHERE rc.status = 'draft'
        AND LENGTH(rc.complaint_text) > $1
      GROUP BY s.name
      ORDER BY count DESC
    `, [CHARACTER_LIMIT]);

    storeDistResult.rows.forEach(row => {
      console.log(`   ${row.store_name}: ${row.count} шт`);
    });

    // 4. Удаление
    if (!DRY_RUN) {
      console.log('\n━'.repeat(80));
      console.log('4️⃣  УДАЛЕНИЕ\n');

      // Получаем review_id для обновления reviews
      const reviewIdsResult = await query(`
        SELECT review_id
        FROM review_complaints
        WHERE status = 'draft'
          AND LENGTH(complaint_text) > $1
      `, [CHARACTER_LIMIT]);

      const reviewIds = reviewIdsResult.rows.map(r => r.review_id);

      // Удаляем из review_complaints
      const deleteResult = await query(`
        DELETE FROM review_complaints
        WHERE status = 'draft'
          AND LENGTH(complaint_text) > $1
        RETURNING id
      `, [CHARACTER_LIMIT]);

      const deletedCount = deleteResult.rowCount ?? 0;
      console.log(`🗑️  Удалено записей из review_complaints: ${deletedCount}`);

      // Обновляем флаги в reviews
      if (reviewIds.length > 0) {
        const updateResult = await query(`
          UPDATE reviews
          SET has_complaint = FALSE,
              has_complaint_draft = FALSE,
              complaint_status = 'not_sent'
          WHERE id = ANY($1::text[])
        `, [reviewIds]);

        const updatedCount = updateResult.rowCount ?? 0;
        console.log(`📝 Обновлено записей в reviews: ${updatedCount}`);
      }

      console.log('\n✅ Удаление завершено!');
      console.log('💡 Жалобы будут регенерированы при следующем запросе.');
    } else {
      console.log('\n━'.repeat(80));
      console.log('🔬 DRY RUN: Удаление пропущено');
      console.log('   Для реального удаления запустите без --dry-run');
    }

    // 5. Проверка после удаления
    console.log('\n━'.repeat(80));
    console.log('5️⃣  Проверка после операции\n');

    const checkResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE LENGTH(complaint_text) > 975) as over_975,
        COUNT(*) FILTER (WHERE LENGTH(complaint_text) > 1000) as over_1000,
        COUNT(*) as total
      FROM review_complaints
      WHERE status = 'draft'
    `);

    const check = checkResult.rows[0];
    console.log(`   Всего черновиков: ${check.total}`);
    console.log(`   > 975 символов: ${check.over_975}`);
    console.log(`   > 1000 символов: ${check.over_1000}`);

    console.log('\n━'.repeat(80));
    console.log('✅ Скрипт завершён\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deleteOversizedComplaints();
