/**
 * Analyze empty reviews statistics
 * Shows how many reviews qualify for template-based complaints
 */

import 'dotenv/config';
import { query } from '../src/db/client';

interface EmptyReviewStats {
  rating: number;
  total_reviews: string;
  with_complaint: string;
  without_complaint: string;
}

interface OverallStats {
  total_reviews_1_3: string;
  empty_reviews_1_3: string;
  empty_with_complaint: string;
  empty_without_complaint: string;
}

async function analyzeEmptyReviews() {
  console.log('📊 Анализ пустых отзывов для шаблонов жалоб\n');
  console.log('='.repeat(80));

  // 1. Overall statistics for rating 1-3
  console.log('\n1️⃣  ОБЩАЯ СТАТИСТИКА (рейтинг 1-3 звезды)\n');

  const overallResult = await query<OverallStats>(`
    SELECT
      COUNT(*) FILTER (WHERE rating BETWEEN 1 AND 3) as total_reviews_1_3,
      COUNT(*) FILTER (
        WHERE rating BETWEEN 1 AND 3
        AND (text IS NULL OR TRIM(text) = '')
        AND (pros IS NULL OR TRIM(pros) = '')
        AND (cons IS NULL OR TRIM(cons) = '')
      ) as empty_reviews_1_3,
      COUNT(rc.id) FILTER (
        WHERE r.rating BETWEEN 1 AND 3
        AND (r.text IS NULL OR TRIM(r.text) = '')
        AND (r.pros IS NULL OR TRIM(r.pros) = '')
        AND (r.cons IS NULL OR TRIM(r.cons) = '')
      ) as empty_with_complaint,
      COUNT(*) FILTER (
        WHERE r.rating BETWEEN 1 AND 3
        AND (r.text IS NULL OR TRIM(r.text) = '')
        AND (r.pros IS NULL OR TRIM(r.pros) = '')
        AND (r.cons IS NULL OR TRIM(r.cons) = '')
        AND rc.id IS NULL
      ) as empty_without_complaint
    FROM reviews r
    LEFT JOIN review_complaints rc ON rc.review_id = r.id
  `);

  const overall = overallResult.rows[0];
  const totalReviews13 = parseInt(overall.total_reviews_1_3);
  const emptyReviews13 = parseInt(overall.empty_reviews_1_3);
  const emptyWithComplaint = parseInt(overall.empty_with_complaint);
  const emptyWithoutComplaint = parseInt(overall.empty_without_complaint);

  console.log(`  Всего отзывов 1-3★:           ${totalReviews13.toLocaleString()}`);
  console.log(`  Из них пустых (без текста):   ${emptyReviews13.toLocaleString()} (${((emptyReviews13/totalReviews13)*100).toFixed(1)}%)`);
  console.log(`  ├─ Уже есть жалобы:           ${emptyWithComplaint.toLocaleString()}`);
  console.log(`  └─ БЕЗ жалоб (можем добавить): ${emptyWithoutComplaint.toLocaleString()} 🎯`);

  // 2. Breakdown by rating (1-3 stars)
  console.log('\n2️⃣  ДЕТАЛИЗАЦИЯ ПО РЕЙТИНГУ\n');

  const breakdownResult = await query<EmptyReviewStats>(`
    SELECT
      r.rating,
      COUNT(*) as total_reviews,
      COUNT(rc.id) as with_complaint,
      COUNT(*) FILTER (WHERE rc.id IS NULL) as without_complaint
    FROM reviews r
    LEFT JOIN review_complaints rc ON rc.review_id = r.id
    WHERE r.rating BETWEEN 1 AND 3
      AND (r.text IS NULL OR TRIM(r.text) = '')
      AND (r.pros IS NULL OR TRIM(r.pros) = '')
      AND (r.cons IS NULL OR TRIM(r.cons) = '')
    GROUP BY r.rating
    ORDER BY r.rating
  `);

  console.log('  Рейтинг │ Всего пустых │ С жалобой │ Без жалобы │ % без жалобы');
  console.log('  ────────┼──────────────┼───────────┼────────────┼─────────────');

  for (const row of breakdownResult.rows) {
    const total = parseInt(row.total_reviews);
    const withC = parseInt(row.with_complaint);
    const withoutC = parseInt(row.without_complaint);
    const pct = ((withoutC / total) * 100).toFixed(1);

    console.log(
      `  ${row.rating}★      │ ${total.toLocaleString().padStart(12)} │ ` +
      `${withC.toLocaleString().padStart(9)} │ ${withoutC.toLocaleString().padStart(10)} │ ${pct.padStart(11)}%`
    );
  }

  // 3. Old rule (1-2 stars) vs New rule (1-3 stars)
  console.log('\n3️⃣  СРАВНЕНИЕ СТАРОГО И НОВОГО ПРАВИЛА\n');

  const oldRuleResult = await query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM reviews r
    LEFT JOIN review_complaints rc ON rc.review_id = r.id
    WHERE r.rating BETWEEN 1 AND 2
      AND (r.text IS NULL OR TRIM(r.text) = '')
      AND (r.pros IS NULL OR TRIM(r.pros) = '')
      AND (r.cons IS NULL OR TRIM(r.cons) = '')
      AND rc.id IS NULL
  `);

  const newRuleResult = await query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM reviews r
    LEFT JOIN review_complaints rc ON rc.review_id = r.id
    WHERE r.rating BETWEEN 1 AND 3
      AND (r.text IS NULL OR TRIM(r.text) = '')
      AND (r.pros IS NULL OR TRIM(r.pros) = '')
      AND (r.cons IS NULL OR TRIM(r.cons) = '')
      AND rc.id IS NULL
  `);

  const oldRuleCount = parseInt(oldRuleResult.rows[0].count);
  const newRuleCount = parseInt(newRuleResult.rows[0].count);
  const additionalReviews = newRuleCount - oldRuleCount;
  const increasePercent = ((additionalReviews / oldRuleCount) * 100).toFixed(1);

  console.log(`  Старое правило (1-2★):        ${oldRuleCount.toLocaleString()} отзывов без жалоб`);
  console.log(`  Новое правило (1-3★):         ${newRuleCount.toLocaleString()} отзывов без жалоб`);
  console.log(`  Прирост:                      +${additionalReviews.toLocaleString()} отзывов (+${increasePercent}%) 📈`);

  // 4. Estimated savings
  console.log('\n4️⃣  ОЦЕНКА ЭКОНОМИИ ТОКЕНОВ\n');

  const avgTokensPerAIComplaint = 150; // Примерная оценка
  const costPer1MTokens = 0.28; // Deepseek output cost
  const estimatedCostPerComplaint = (avgTokensPerAIComplaint / 1_000_000) * costPer1MTokens;

  const totalSavingsOldRule = oldRuleCount * estimatedCostPerComplaint;
  const totalSavingsNewRule = newRuleCount * estimatedCostPerComplaint;
  const additionalSavings = totalSavingsOldRule > 0 ? totalSavingsNewRule - totalSavingsOldRule : totalSavingsNewRule;

  console.log(`  Средняя стоимость AI-жалобы:  ~$${estimatedCostPerComplaint.toFixed(4)}`);
  console.log(`  Экономия (старое правило):    ~$${totalSavingsOldRule.toFixed(2)}`);
  console.log(`  Экономия (новое правило):     ~$${totalSavingsNewRule.toFixed(2)}`);
  console.log(`  Дополнительная экономия:      +$${additionalSavings.toFixed(2)} 💰`);

  // 5. Ready to generate
  console.log('\n5️⃣  ГОТОВО К ГЕНЕРАЦИИ ШАБЛОНОВ\n');
  console.log(`  🎯 Всего отзывов для шаблонов: ${emptyWithoutComplaint.toLocaleString()}`);
  console.log(`  💰 Экономия при генерации:     ~$${(emptyWithoutComplaint * estimatedCostPerComplaint).toFixed(2)}`);
  console.log(`  ⚡ Разделение на варианты:`);
  console.log(`     - Вариант A (reason 11): ~${Math.floor(emptyWithoutComplaint * 0.25).toLocaleString()} жалоб`);
  console.log(`     - Вариант B (reason 12): ~${Math.floor(emptyWithoutComplaint * 0.25).toLocaleString()} жалоб`);
  console.log(`     - Вариант C (reason 20): ~${Math.floor(emptyWithoutComplaint * 0.25).toLocaleString()} жалоб`);
  console.log(`     - Вариант D (reason 11): ~${Math.floor(emptyWithoutComplaint * 0.25).toLocaleString()} жалоб`);

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Анализ завершен!\n');
}

// Run analysis
analyzeEmptyReviews()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
