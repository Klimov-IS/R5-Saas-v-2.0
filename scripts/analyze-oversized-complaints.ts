/**
 * Analyze oversized complaints (> 1000 characters)
 *
 * This script performs read-only analysis:
 * 1. Total count and percentage of oversized complaints
 * 2. Distribution by store
 * 3. Distribution by date (to identify legacy data)
 * 4. Distribution by status
 * 5. Sample records for review
 * 6. Backlog count for comparison
 *
 * Usage: npx tsx scripts/analyze-oversized-complaints.ts
 *
 * @date 2026-02-08
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

const HARD_LIMIT = 1000;
const SOFT_LIMIT = 800;

async function analyzeOversizedComplaints() {
  console.log('━'.repeat(80));
  console.log('📊 АНАЛИЗ ЖАЛОБ > 1000 СИМВОЛОВ (READ-ONLY)');
  console.log('━'.repeat(80));
  console.log(`\nЖёсткий лимит WB: ${HARD_LIMIT} символов`);
  console.log(`Рекомендуемый лимит: ${SOFT_LIMIT} символов`);
  console.log(`Дата анализа: ${new Date().toISOString()}\n`);

  try {
    // =========================================================================
    // 1. Общая статистика
    // =========================================================================
    console.log('━'.repeat(80));
    console.log('1️⃣  ОБЩАЯ СТАТИСТИКА\n');

    const totalStatsResult = await query(`
      SELECT
        COUNT(*) as total_complaints,
        COUNT(*) FILTER (WHERE LENGTH(complaint_text) > ${HARD_LIMIT}) as over_hard_limit,
        COUNT(*) FILTER (WHERE LENGTH(complaint_text) > ${SOFT_LIMIT} AND LENGTH(complaint_text) <= ${HARD_LIMIT}) as over_soft_limit,
        COUNT(*) FILTER (WHERE LENGTH(complaint_text) <= ${SOFT_LIMIT}) as within_limits,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE LENGTH(complaint_text) > ${HARD_LIMIT}) / NULLIF(COUNT(*), 0),
          2
        ) as oversized_percent,
        MIN(LENGTH(complaint_text)) FILTER (WHERE LENGTH(complaint_text) > ${HARD_LIMIT}) as min_oversized,
        MAX(LENGTH(complaint_text)) as max_length,
        AVG(LENGTH(complaint_text))::int as avg_length
      FROM review_complaints
    `);

    const totalStats = totalStatsResult.rows[0];
    console.log(`📈 Всего жалоб в системе: ${totalStats.total_complaints}`);
    console.log(`\n📊 Распределение по длине:`);
    console.log(`   ✅ В пределах нормы (≤ ${SOFT_LIMIT}): ${totalStats.within_limits}`);
    console.log(`   ⚠️  Превышен soft limit (${SOFT_LIMIT}-${HARD_LIMIT}): ${totalStats.over_soft_limit}`);
    console.log(`   ❌ Превышен hard limit (> ${HARD_LIMIT}): ${totalStats.over_hard_limit} (${totalStats.oversized_percent || 0}%)`);
    console.log(`\n📏 Статистика длины:`);
    console.log(`   Средняя длина: ${totalStats.avg_length} символов`);
    console.log(`   Максимальная длина: ${totalStats.max_length} символов`);
    if (totalStats.min_oversized) {
      console.log(`   Минимальная oversized: ${totalStats.min_oversized} символов`);
    }

    const oversizedCount = parseInt(totalStats.over_hard_limit, 10);
    if (oversizedCount === 0) {
      console.log('\n✅ НЕТ ЖАЛОБ ПРЕВЫШАЮЩИХ 1000 СИМВОЛОВ!');
      console.log('   Валидация работает корректно.');

      // Всё равно покажем backlog для справки
      await showBacklog();
      process.exit(0);
    }

    // =========================================================================
    // 2. Распределение по статусам
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('2️⃣  РАСПРЕДЕЛЕНИЕ ПО СТАТУСАМ\n');

    const statusResult = await query(`
      SELECT
        status,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percent
      FROM review_complaints
      WHERE LENGTH(complaint_text) > ${HARD_LIMIT}
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('Статус           | Количество | Процент');
    console.log('─'.repeat(45));
    statusResult.rows.forEach(row => {
      const status = (row.status || 'NULL').padEnd(16);
      const count = String(row.count).padStart(10);
      const percent = String(row.percent + '%').padStart(8);
      console.log(`${status} | ${count} | ${percent}`);
    });

    // =========================================================================
    // 3. Распределение по магазинам
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('3️⃣  РАСПРЕДЕЛЕНИЕ ПО МАГАЗИНАМ (топ-10)\n');

    const storeResult = await query(`
      SELECT
        rc.store_id,
        s.name as store_name,
        COUNT(*) as oversized_count,
        AVG(LENGTH(rc.complaint_text))::int as avg_length,
        MAX(LENGTH(rc.complaint_text)) as max_length
      FROM review_complaints rc
      JOIN stores s ON rc.store_id = s.id
      WHERE LENGTH(rc.complaint_text) > ${HARD_LIMIT}
      GROUP BY rc.store_id, s.name
      ORDER BY oversized_count DESC
      LIMIT 10
    `);

    console.log('Магазин                              | Кол-во | Сред. | Макс.');
    console.log('─'.repeat(65));
    storeResult.rows.forEach(row => {
      const name = (row.store_name || 'N/A').substring(0, 35).padEnd(36);
      const count = String(row.oversized_count).padStart(6);
      const avg = String(row.avg_length).padStart(5);
      const max = String(row.max_length).padStart(5);
      console.log(`${name} | ${count} | ${avg} | ${max}`);
    });

    // =========================================================================
    // 4. Распределение по датам (выявление legacy)
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('4️⃣  РАСПРЕДЕЛЕНИЕ ПО ДАТАМ ГЕНЕРАЦИИ\n');

    const dateResult = await query(`
      SELECT
        DATE(generated_at) as generation_date,
        COUNT(*) as oversized_count,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status != 'draft') as sent_count
      FROM review_complaints
      WHERE LENGTH(complaint_text) > ${HARD_LIMIT}
      GROUP BY DATE(generated_at)
      ORDER BY generation_date DESC
      LIMIT 30
    `);

    console.log('Дата        | Всего | Draft | Отправлено');
    console.log('─'.repeat(50));
    dateResult.rows.forEach(row => {
      const date = (row.generation_date || 'N/A').toString().substring(0, 10).padEnd(11);
      const count = String(row.oversized_count).padStart(5);
      const draft = String(row.draft_count).padStart(5);
      const sent = String(row.sent_count).padStart(10);
      console.log(`${date} | ${count} | ${draft} | ${sent}`);
    });

    // Проверим, есть ли oversized после 2026-02-03 (дата добавления валидации)
    const recentResult = await query(`
      SELECT COUNT(*) as count
      FROM review_complaints
      WHERE LENGTH(complaint_text) > ${HARD_LIMIT}
        AND generated_at >= '2026-02-03'
    `);

    const recentCount = parseInt(recentResult.rows[0].count, 10);
    console.log(`\n📅 После 2026-02-03 (добавление валидации): ${recentCount}`);
    if (recentCount > 0) {
      console.log('   ⚠️  Есть oversized жалобы после добавления валидации!');
      console.log('   Возможные причины:');
      console.log('   - Ручное редактирование без валидации');
      console.log('   - Некорректная работа truncation');
    } else {
      console.log('   ✅ Все oversized жалобы — legacy (до валидации)');
    }

    // =========================================================================
    // 5. Примеры oversized жалоб
    // =========================================================================
    console.log('\n━'.repeat(80));
    console.log('5️⃣  ПРИМЕРЫ OVERSIZED ЖАЛОБ (топ-5 по длине)\n');

    const samplesResult = await query(`
      SELECT
        rc.id,
        rc.review_id,
        s.name as store_name,
        rc.status,
        LENGTH(rc.complaint_text) as length,
        LEFT(rc.complaint_text, 100) as preview,
        rc.generated_at,
        rc.reason_id,
        rc.reason_name
      FROM review_complaints rc
      JOIN stores s ON rc.store_id = s.id
      WHERE LENGTH(rc.complaint_text) > ${HARD_LIMIT}
      ORDER BY LENGTH(rc.complaint_text) DESC
      LIMIT 5
    `);

    samplesResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. [${row.length} символов] ${row.status.toUpperCase()}`);
      console.log(`   Магазин: ${row.store_name}`);
      console.log(`   Review ID: ${row.review_id}`);
      console.log(`   Причина: [${row.reason_id}] ${row.reason_name}`);
      console.log(`   Дата генерации: ${row.generated_at}`);
      console.log(`   Превью: "${row.preview}..."`);
      console.log('');
    });

    // =========================================================================
    // 6. Рекомендации
    // =========================================================================
    console.log('━'.repeat(80));
    console.log('6️⃣  РЕКОМЕНДАЦИИ\n');

    const draftOversized = statusResult.rows.find(r => r.status === 'draft');
    const draftCount = draftOversized ? parseInt(draftOversized.count, 10) : 0;
    const sentOversized = oversizedCount - draftCount;

    console.log(`📋 ИТОГО OVERSIZED: ${oversizedCount}`);
    console.log(`   - Draft (можно удалить): ${draftCount}`);
    console.log(`   - Отправлено (read-only): ${sentOversized}`);
    console.log('');

    if (draftCount > 0) {
      console.log('🔧 ДЕЙСТВИЕ: Удалить draft oversized жалобы');
      console.log('   Команда: npx tsx scripts/delete-oversized-complaints.ts');
      console.log('   Или с dry-run: npx tsx scripts/delete-oversized-complaints.ts --dry-run');
      console.log('   После удаления жалобы будут регенерированы с валидацией.');
    }

    if (sentOversized > 0) {
      console.log('\n⚠️  ВНИМАНИЕ: Отправленные oversized жалобы');
      console.log('   Эти жалобы уже в WB и не могут быть изменены.');
      console.log('   Они могли быть отклонены из-за превышения лимита.');
    }

    // =========================================================================
    // 7. Backlog для справки
    // =========================================================================
    await showBacklog();

    console.log('\n━'.repeat(80));
    console.log('✅ АНАЛИЗ ЗАВЕРШЁН\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function showBacklog() {
  console.log('\n━'.repeat(80));
  console.log('7️⃣  BACKLOG: ОТЗЫВЫ БЕЗ ЖАЛОБ\n');

  const backlogResult = await query(`
    SELECT
      r.store_id,
      s.name as store_name,
      COUNT(*) as backlog_count
    FROM reviews r
    JOIN stores s ON r.store_id = s.id
    WHERE r.rating IN (1, 2, 3)
      AND r.date >= '2023-10-01'
      AND r.is_product_active = TRUE
      AND s.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM review_complaints c WHERE c.review_id = r.id
      )
      AND (r.complaint_status IS NULL OR r.complaint_status = 'not_sent')
    GROUP BY r.store_id, s.name
    ORDER BY backlog_count DESC
    LIMIT 10
  `);

  const totalBacklogResult = await query(`
    SELECT COUNT(*) as count
    FROM reviews r
    JOIN stores s ON r.store_id = s.id
    WHERE r.rating IN (1, 2, 3)
      AND r.date >= '2023-10-01'
      AND r.is_product_active = TRUE
      AND s.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM review_complaints c WHERE c.review_id = r.id
      )
      AND (r.complaint_status IS NULL OR r.complaint_status = 'not_sent')
  `);

  const totalBacklog = parseInt(totalBacklogResult.rows[0].count, 10);
  console.log(`📊 Всего отзывов без жалоб: ${totalBacklog}`);
  console.log('');
  console.log('Топ-10 магазинов по backlog:');
  console.log('Магазин                              | Backlog');
  console.log('─'.repeat(50));
  backlogResult.rows.forEach(row => {
    const name = (row.store_name || 'N/A').substring(0, 35).padEnd(36);
    const count = String(row.backlog_count).padStart(7);
    console.log(`${name} | ${count}`);
  });
}

analyzeOversizedComplaints();
