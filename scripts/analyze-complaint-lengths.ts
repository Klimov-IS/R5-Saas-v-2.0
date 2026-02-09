/**
 * Analyze complaint text lengths and prepare regeneration
 *
 * Правила из промпта:
 * - Рекомендуемая длина: 500-800 символов
 * - Soft limit: 800 символов
 * - Hard limit WB: 1000 символов
 *
 * Usage:
 *   npx tsx scripts/analyze-complaint-lengths.ts
 *   npx tsx scripts/analyze-complaint-lengths.ts --regenerate  # Регенерировать > 950
 *
 * @date 2026-02-08
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

// Границы из промпта и валидатора
const PROMPT_MIN = 500;        // Минимум по промпту
const PROMPT_MAX = 800;        // Максимум по промпту (рекомендуемый)
const SOFT_LIMIT = 800;        // Soft limit из валидатора
const REGENERATE_THRESHOLD = 950; // Порог для регенерации
const HARD_LIMIT = 1000;       // Hard limit WB

const REGENERATE_MODE = process.argv.includes('--regenerate');
const DRY_RUN = process.argv.includes('--dry-run');

async function analyzeComplaintLengths() {
  console.log('━'.repeat(80));
  console.log('📊 АНАЛИЗ ДЛИНЫ ЖАЛОБ');
  console.log('━'.repeat(80));
  console.log(`\nПравила из промпта: ${PROMPT_MIN}-${PROMPT_MAX} символов`);
  console.log(`Soft limit: ${SOFT_LIMIT} символов`);
  console.log(`Порог регенерации: ${REGENERATE_THRESHOLD} символов`);
  console.log(`Hard limit WB: ${HARD_LIMIT} символов`);
  console.log(`Режим: ${REGENERATE_MODE ? (DRY_RUN ? '🔬 DRY RUN' : '⚠️ РЕГЕНЕРАЦИЯ') : '📊 Только анализ'}\n`);

  try {
    // =========================================================================
    // 1. Распределение по диапазонам длины
    // =========================================================================
    console.log('━'.repeat(80));
    console.log('1️⃣  РАСПРЕДЕЛЕНИЕ ПО ДИАПАЗОНАМ ДЛИНЫ\n');

    const distributionResult = await query(`
      WITH ranges AS (
        SELECT
          CASE
            WHEN LENGTH(complaint_text) < 300 THEN 1
            WHEN LENGTH(complaint_text) >= 300 AND LENGTH(complaint_text) < 500 THEN 2
            WHEN LENGTH(complaint_text) >= 500 AND LENGTH(complaint_text) <= 700 THEN 3
            WHEN LENGTH(complaint_text) > 700 AND LENGTH(complaint_text) <= 800 THEN 4
            WHEN LENGTH(complaint_text) > 800 AND LENGTH(complaint_text) <= 900 THEN 5
            WHEN LENGTH(complaint_text) > 900 AND LENGTH(complaint_text) <= 950 THEN 6
            WHEN LENGTH(complaint_text) > 950 AND LENGTH(complaint_text) <= 1000 THEN 7
            ELSE 8
          END as range_order,
          CASE
            WHEN LENGTH(complaint_text) < 300 THEN '< 300 (слишком короткие)'
            WHEN LENGTH(complaint_text) >= 300 AND LENGTH(complaint_text) < 500 THEN '300-499 (короткие)'
            WHEN LENGTH(complaint_text) >= 500 AND LENGTH(complaint_text) <= 700 THEN '500-700 (идеально)'
            WHEN LENGTH(complaint_text) > 700 AND LENGTH(complaint_text) <= 800 THEN '701-800 (норма)'
            WHEN LENGTH(complaint_text) > 800 AND LENGTH(complaint_text) <= 900 THEN '801-900 (soft limit)'
            WHEN LENGTH(complaint_text) > 900 AND LENGTH(complaint_text) <= 950 THEN '901-950 (близко)'
            WHEN LENGTH(complaint_text) > 950 AND LENGTH(complaint_text) <= 1000 THEN '951-1000 (REGENERATE)'
            ELSE '> 1000 (hard limit)'
          END as range_name
        FROM review_complaints
      )
      SELECT
        range_name as range,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percent
      FROM ranges
      GROUP BY range_order, range_name
      ORDER BY range_order
    `);

    console.log('Диапазон                        | Количество |   %');
    console.log('─'.repeat(55));
    distributionResult.rows.forEach(row => {
      const range = (row.range || 'N/A').padEnd(31);
      const count = String(row.count).padStart(10);
      const percent = String(row.percent + '%').padStart(6);
      console.log(`${range} | ${count} | ${percent}`);
    });

    // =========================================================================
    // 2. Статистика по жалобам > 950 символов
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('2️⃣  ЖАЛОБЫ > 950 СИМВОЛОВ (К РЕГЕНЕРАЦИИ)\n');

    const over950Result = await query(`
      SELECT
        status,
        COUNT(*) as count,
        MIN(LENGTH(complaint_text)) as min_length,
        MAX(LENGTH(complaint_text)) as max_length,
        AVG(LENGTH(complaint_text))::int as avg_length
      FROM review_complaints
      WHERE LENGTH(complaint_text) > ${REGENERATE_THRESHOLD}
      GROUP BY status
      ORDER BY count DESC
    `);

    if (over950Result.rows.length === 0) {
      console.log('✅ Нет жалоб > 950 символов!');
    } else {
      console.log('Статус     | Кол-во | Мин | Макс | Сред');
      console.log('─'.repeat(50));
      over950Result.rows.forEach(row => {
        const status = (row.status || 'N/A').padEnd(10);
        const count = String(row.count).padStart(6);
        const min = String(row.min_length).padStart(4);
        const max = String(row.max_length).padStart(5);
        const avg = String(row.avg_length).padStart(5);
        console.log(`${status} | ${count} | ${min} | ${max} | ${avg}`);
      });
    }

    // =========================================================================
    // 3. Draft жалобы > 950 (можно регенерировать)
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('3️⃣  DRAFT ЖАЛОБЫ > 950 СИМВОЛОВ (МОЖНО РЕГЕНЕРИРОВАТЬ)\n');

    const draftOver950Result = await query(`
      SELECT
        rc.id,
        rc.review_id,
        rc.store_id,
        s.name as store_name,
        LENGTH(rc.complaint_text) as length,
        rc.reason_id,
        rc.regenerated_count,
        rc.generated_at
      FROM review_complaints rc
      JOIN stores s ON rc.store_id = s.id
      WHERE rc.status = 'draft'
        AND LENGTH(rc.complaint_text) > ${REGENERATE_THRESHOLD}
      ORDER BY LENGTH(rc.complaint_text) DESC
    `);

    const draftCount = draftOver950Result.rows.length;
    console.log(`📊 Всего draft > 950 символов: ${draftCount}`);

    if (draftCount === 0) {
      console.log('✅ Нет draft жалоб для регенерации!');
    } else {
      console.log('\nТоп-10 по длине:');
      console.log('Длина | Магазин                         | Reason | Regen#');
      console.log('─'.repeat(65));
      draftOver950Result.rows.slice(0, 10).forEach(row => {
        const length = String(row.length).padStart(5);
        const store = (row.store_name || 'N/A').substring(0, 30).padEnd(31);
        const reason = String(row.reason_id).padStart(6);
        const regen = String(row.regenerated_count).padStart(6);
        console.log(`${length} | ${store} | ${reason} | ${regen}`);
      });

      // Распределение по магазинам
      console.log('\nРаспределение по магазинам:');
      const storeDistResult = await query(`
        SELECT
          s.name as store_name,
          COUNT(*) as count
        FROM review_complaints rc
        JOIN stores s ON rc.store_id = s.id
        WHERE rc.status = 'draft'
          AND LENGTH(rc.complaint_text) > ${REGENERATE_THRESHOLD}
        GROUP BY s.name
        ORDER BY count DESC
      `);

      storeDistResult.rows.forEach(row => {
        console.log(`   ${row.store_name}: ${row.count}`);
      });
    }

    // =========================================================================
    // 4. Отправленные жалобы > 950 (нельзя изменить)
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('4️⃣  ОТПРАВЛЕННЫЕ ЖАЛОБЫ > 950 СИМВОЛОВ (READ-ONLY)\n');

    const sentOver950Result = await query(`
      SELECT
        status,
        COUNT(*) as count
      FROM review_complaints
      WHERE status != 'draft'
        AND LENGTH(complaint_text) > ${REGENERATE_THRESHOLD}
      GROUP BY status
      ORDER BY count DESC
    `);

    if (sentOver950Result.rows.length === 0) {
      console.log('✅ Нет отправленных жалоб > 950 символов!');
    } else {
      sentOver950Result.rows.forEach(row => {
        console.log(`   ${row.status}: ${row.count}`);
      });
      console.log('\n⚠️  Эти жалобы уже отправлены и не могут быть изменены.');
    }

    // =========================================================================
    // 5. Шаблоны vs AI
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('5️⃣  ШАБЛОНЫ VS AI (по длине)\n');

    const templateVsAiResult = await query(`
      SELECT
        CASE WHEN ai_cost_usd = 0 OR ai_cost_usd IS NULL THEN 'Template' ELSE 'AI' END as source,
        COUNT(*) as count,
        AVG(LENGTH(complaint_text))::int as avg_length,
        MIN(LENGTH(complaint_text)) as min_length,
        MAX(LENGTH(complaint_text)) as max_length
      FROM review_complaints
      GROUP BY 1
    `);

    console.log('Источник | Кол-во | Сред. | Мин | Макс');
    console.log('─'.repeat(50));
    templateVsAiResult.rows.forEach(row => {
      const source = (row.source || 'N/A').padEnd(8);
      const count = String(row.count).padStart(6);
      const avg = String(row.avg_length).padStart(6);
      const min = String(row.min_length).padStart(4);
      const max = String(row.max_length).padStart(5);
      console.log(`${source} | ${count} | ${avg} | ${min} | ${max}`);
    });

    // =========================================================================
    // 6. Регенерация (если включена)
    // =========================================================================
    if (REGENERATE_MODE && draftCount > 0) {
      console.log('\n━'.repeat(80));
      console.log('6️⃣  РЕГЕНЕРАЦИЯ DRAFT ЖАЛОБ > 950 СИМВОЛОВ\n');

      if (DRY_RUN) {
        console.log('🔬 DRY RUN: Удаление пропущено');
        console.log(`   Будет удалено: ${draftCount} жалоб`);
        console.log('   Для реального удаления запустите без --dry-run');
      } else {
        // Получаем review_id для обновления reviews
        const reviewIdsResult = await query(`
          SELECT review_id
          FROM review_complaints
          WHERE status = 'draft'
            AND LENGTH(complaint_text) > ${REGENERATE_THRESHOLD}
        `);

        const reviewIds = reviewIdsResult.rows.map(r => r.review_id);

        // Удаляем из review_complaints
        const deleteResult = await query(`
          DELETE FROM review_complaints
          WHERE status = 'draft'
            AND LENGTH(complaint_text) > ${REGENERATE_THRESHOLD}
          RETURNING id
        `);

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
        console.log('💡 Жалобы будут регенерированы при следующем CRON цикле.');
        console.log('   Или вручную через UI / API.');
      }
    }

    // =========================================================================
    // 7. Команда для регенерации
    // =========================================================================
    if (!REGENERATE_MODE && draftCount > 0) {
      console.log('\n━'.repeat(80));
      console.log('7️⃣  КОМАНДА ДЛЯ РЕГЕНЕРАЦИИ\n');

      console.log('Для удаления draft жалоб > 950 символов выполните:');
      console.log('');
      console.log('   # Проверка (dry-run):');
      console.log('   npx tsx scripts/analyze-complaint-lengths.ts --regenerate --dry-run');
      console.log('');
      console.log('   # Реальное удаление:');
      console.log('   npx tsx scripts/analyze-complaint-lengths.ts --regenerate');
      console.log('');
      console.log('После удаления жалобы будут регенерированы с учётом промпта (500-800 символов).');
    }

    console.log('\n━'.repeat(80));
    console.log('✅ АНАЛИЗ ЗАВЕРШЁН\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeComplaintLengths();
