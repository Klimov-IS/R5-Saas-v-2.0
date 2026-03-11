/**
 * AI Eval — Step 2: Generate drafts, validate, report.
 *
 * Reads sample from ai-eval-sample.json, calls production generate-ai API
 * for each chat, validates the draft against business rules, outputs report.
 *
 * Usage:
 *   R5_TOKEN=<cookie> node scripts/ai-eval-run.mjs
 *
 * Options:
 *   --base-url=https://rating5.ru   (default)
 *   --concurrency=3                 (parallel API calls, default 3)
 *   --delay=1000                    (ms between batches, default 1000)
 *   --sample=analysis-output/ai-eval-sample.json
 *
 * Output:
 *   analysis-output/ai-eval-results.json   — full results
 *   analysis-output/ai-eval-report.csv     — CSV for review
 *   Console summary table
 */
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function getArg(name, defaultVal) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : defaultVal;
}

const BASE_URL    = getArg('base-url', 'https://rating5.ru');
const CONCURRENCY = parseInt(getArg('concurrency', '3'), 10);
const DELAY_MS    = parseInt(getArg('delay', '1000'), 10);
const SAMPLE_PATH = getArg('sample', 'analysis-output/ai-eval-sample.json');
const TOKEN       = process.env.R5_TOKEN;

if (!TOKEN) {
  console.error('ERROR: R5_TOKEN env var required.\n');
  console.error('Get it from browser DevTools → Application → Cookies → r5_token');
  console.error('Usage: R5_TOKEN=eyJ... node scripts/ai-eval-run.mjs');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validation rules (mirrors src/ai/output-validator.ts)
// ---------------------------------------------------------------------------
const RULES = {
  GREETING:       /^(добрый\s+(день|вечер|утро)|здравствуй|приветств|привет[,!\s])/i,
  MARKDOWN:       /(\*\*|##|```|`[^`]+`)/,
  DIRECT_DELETE:  /(удалите\s+отзыв|удалить\s+отзыв)/i,
  OZON_DELETE:    /(удал[иеёья]|удалени[еяю]|убрать\s+отзыв|снять\s+отзыв)/i,
  COMP_AMOUNT:    /\d+\s*[₽руб]/i,
  QUESTION_END:   /[?»][\s)]*$/,
  EMPTY_PROMISE:  /после\s+решения\s+вопроса|разберёмся\s+и\s+поможем|хотел\s+бы\s+разобраться\s+и\s+помочь/i,
  CORP_SPEAK:     /жест\s+доброй\s+воли|в\s+рамках\s+программы\s+лояльности|компенсация\s+за\s+неудобства/i,
};

// Business-specific patterns
const BIZ = {
  REMOVAL_WORDS:    /(убрать|снять|убрал|снял)/i,
  SUPPLEMENT_WORDS: /(дополнить|обновить оценку|повысить оценку|изменить оценку|пересмотреть оценку|обновите оценку|повысите)/i,
  DELETE_DIRECT:    /(удалить|удалите|удаление|удалени)/i,
};

function validateDraft(text, ctx) {
  const violations = [];
  const t = text.trim();

  // Length
  if (t.length < 50) violations.push({ rule: 'length_min', sev: 'error', msg: `Too short: ${t.length}` });
  if (t.length > 2000) violations.push({ rule: 'length_max', sev: 'error', msg: `Too long: ${t.length}` });
  if (ctx.marketplace === 'ozon' && t.length > 1000) violations.push({ rule: 'ozon_length', sev: 'error', msg: `OZON >1000: ${t.length}` });

  // Markdown
  if (RULES.MARKDOWN.test(t)) violations.push({ rule: 'no_markdown', sev: 'error', msg: 'Markdown detected' });

  // Direct deletion phrase
  if (RULES.DIRECT_DELETE.test(t)) violations.push({ rule: 'no_direct_deletion', sev: 'error', msg: '"удалите/удалить отзыв"' });

  // OZON no deletion
  if (ctx.marketplace === 'ozon' && RULES.OZON_DELETE.test(t)) violations.push({ rule: 'ozon_no_deletion', sev: 'error', msg: 'OZON deletion words' });

  // Rating >= 4 no compensation amounts
  if (ctx.reviewRating >= 4 && RULES.COMP_AMOUNT.test(t)) violations.push({ rule: 'no_comp_high_rating', sev: 'error', msg: `${ctx.reviewRating}★ + compensation amount` });

  // Warnings
  if (RULES.EMPTY_PROMISE.test(t)) violations.push({ rule: 'empty_promise', sev: 'warning', msg: 'Empty promise' });
  if (RULES.CORP_SPEAK.test(t)) violations.push({ rule: 'corporate_speak', sev: 'warning', msg: 'Corporate speak' });
  if (ctx.sellerMsgCount > 0 && RULES.GREETING.test(t)) violations.push({ rule: 'repeated_greeting', sev: 'warning', msg: 'Repeated greeting' });
  if (ctx.phase === 'discovery' && !RULES.QUESTION_END.test(t)) violations.push({ rule: 'no_question_end', sev: 'warning', msg: 'Discovery: no trailing question' });

  return {
    errors: violations.filter(v => v.sev === 'error'),
    warnings: violations.filter(v => v.sev === 'warning'),
    violations,
  };
}

function runBusinessChecks(text, ctx) {
  const t = text.trim();
  const checks = [];

  // Only check strategy in proposal/resolution phases
  if (ctx.phase === 'discovery') return checks;

  if (ctx.marketplace === 'wb') {
    if (ctx.reviewRating <= 3) {
      // 1-3★ WB: should ask to REMOVE, not supplement to 5★
      const mentionsRemoval = BIZ.REMOVAL_WORDS.test(t);
      const mentionsSupplement = /дополнить.*5|обновить.*5|повысить.*5|поставить.*5/i.test(t);
      if (!mentionsRemoval) checks.push({ check: 'wb_neg_no_removal', pass: false, msg: '1-3★ WB: не просит убрать отзыв' });
      else checks.push({ check: 'wb_neg_has_removal', pass: true, msg: '1-3★ WB: просит убрать' });
      if (mentionsSupplement) checks.push({ check: 'wb_neg_wrong_supplement', pass: false, msg: '1-3★ WB: просит дополнить до 5★ (неверно!)' });
    } else if (ctx.reviewRating === 4) {
      // 4★ WB: should ask to SUPPLEMENT/UPDATE, not remove
      const mentionsSupplement = BIZ.SUPPLEMENT_WORDS.test(t);
      const mentionsRemoval = BIZ.REMOVAL_WORDS.test(t) || BIZ.DELETE_DIRECT.test(t);
      if (!mentionsSupplement) checks.push({ check: 'wb_4star_no_supplement', pass: false, msg: '4★ WB: не просит дополнить' });
      else checks.push({ check: 'wb_4star_has_supplement', pass: true, msg: '4★ WB: просит дополнить' });
      if (mentionsRemoval) checks.push({ check: 'wb_4star_wrong_removal', pass: false, msg: '4★ WB: просит убрать/удалить (неверно!)' });
    }
  }

  if (ctx.marketplace === 'ozon') {
    // OZON: should ask to supplement, never delete
    const mentionsSupplement = BIZ.SUPPLEMENT_WORDS.test(t) || /дополнить/i.test(t);
    const mentionsDelete = BIZ.DELETE_DIRECT.test(t) || BIZ.REMOVAL_WORDS.test(t);
    if (mentionsDelete) checks.push({ check: 'ozon_mentions_delete', pass: false, msg: 'OZON: упоминает удаление' });
    if (!mentionsSupplement && ctx.phase === 'proposal') {
      checks.push({ check: 'ozon_no_supplement', pass: false, msg: 'OZON proposal: не просит дополнить' });
    }
  }

  return checks;
}

// ---------------------------------------------------------------------------
// API caller
// ---------------------------------------------------------------------------
async function generateForChat(chatId, storeId) {
  const url = `${BASE_URL}/api/stores/${storeId}/chats/${chatId}/generate-ai`;
  const start = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Cookie': `r5_token=${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const latency = Date.now() - start;
  const body = await res.json();

  if (!res.ok || !body.success) {
    return { ok: false, error: body.error || body.details || `HTTP ${res.status}`, latency };
  }

  return { ok: true, draft: body.text || body.draftReply, latency };
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------
async function runWithConcurrency(items, fn, concurrency, delayMs) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function printReport(results, segments) {
  console.log('\n' + '='.repeat(70));
  console.log('  AI EVAL REPORT');
  console.log('='.repeat(70));

  const success = results.filter(r => r.ok);
  const errors = results.filter(r => !r.ok);
  console.log(`\nCases: ${results.length} | Success: ${success.length} | API Errors: ${errors.length}`);

  const avgLatency = success.length > 0
    ? Math.round(success.reduce((s, r) => s + r.latency, 0) / success.length)
    : 0;
  console.log(`Avg latency: ${avgLatency}ms\n`);

  // --- Pass rates by segment ---
  console.log('SEGMENT PASS RATES (no errors + correct strategy):');
  console.log('-'.repeat(60));

  for (const seg of segments) {
    const segResults = success.filter(r => r.segment === seg.segment);
    if (segResults.length === 0) {
      console.log(`  ${seg.segment.padEnd(28)} -/-  (no data)`);
      continue;
    }
    const passed = segResults.filter(r => r.validationErrors === 0 && r.bizFails === 0).length;
    const pct = Math.round(passed / segResults.length * 100);
    const mark = pct >= 90 ? 'OK' : pct >= 70 ? '!!' : 'FAIL';
    console.log(`  ${seg.segment.padEnd(28)} ${String(passed).padStart(2)}/${segResults.length}  ${String(pct).padStart(3)}%  ${mark}`);
  }

  // --- Violation breakdown ---
  console.log('\nVIOLATION BREAKDOWN:');
  console.log('-'.repeat(60));
  const violationCounts = {};
  for (const r of success) {
    for (const v of r.violations) {
      const key = `[${v.sev}] ${v.rule}`;
      violationCounts[key] = (violationCounts[key] || 0) + 1;
    }
  }
  const sorted = Object.entries(violationCounts).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sorted) {
    console.log(`  ${key.padEnd(40)} ${count}`);
  }
  if (sorted.length === 0) console.log('  (none)');

  // --- Business check breakdown ---
  console.log('\nBUSINESS CHECKS:');
  console.log('-'.repeat(60));
  const bizCounts = {};
  for (const r of success) {
    for (const b of r.bizChecks) {
      const key = b.check;
      if (!bizCounts[key]) bizCounts[key] = { pass: 0, fail: 0 };
      bizCounts[key][b.pass ? 'pass' : 'fail']++;
    }
  }
  for (const [check, counts] of Object.entries(bizCounts)) {
    const total = counts.pass + counts.fail;
    const pct = Math.round(counts.pass / total * 100);
    console.log(`  ${check.padEnd(35)} ${counts.pass}/${total}  ${pct}%`);
  }
  if (Object.keys(bizCounts).length === 0) console.log('  (none — all discovery phase?)');

  // --- Worst cases ---
  console.log('\nWORST CASES (errors + biz fails):');
  console.log('-'.repeat(60));
  const worst = success
    .filter(r => r.validationErrors > 0 || r.bizFails > 0)
    .sort((a, b) => (b.validationErrors + b.bizFails) - (a.validationErrors + a.bizFails))
    .slice(0, 10);
  for (const r of worst) {
    const issues = [...r.violations.filter(v => v.sev === 'error').map(v => v.msg), ...r.bizChecks.filter(b => !b.pass).map(b => b.msg)];
    console.log(`  ${r.chatId.slice(0, 12)}.. ${r.reviewRating}★ ${r.phase} ${r.marketplace} — ${issues.join('; ')}`);
    if (r.draft) console.log(`    "${r.draft.slice(0, 120)}..."`);
  }
  if (worst.length === 0) console.log('  (none — all passed!)');

  console.log('\n' + '='.repeat(70));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== AI EVAL: Run ===\n');
  console.log(`Base URL:    ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Delay:       ${DELAY_MS}ms\n`);

  // Load sample
  if (!fs.existsSync(SAMPLE_PATH)) {
    console.error(`Sample not found: ${SAMPLE_PATH}`);
    console.error('Run ai-eval-sample.mjs first.');
    process.exit(1);
  }

  const sample = JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf8'));
  console.log(`Loaded ${sample.totalCases} cases from ${SAMPLE_PATH}\n`);

  // Process each case
  let completed = 0;
  const results = await runWithConcurrency(sample.cases, async (c, i) => {
    try {
      const apiResult = await generateForChat(c.chatId, c.storeId);
      completed++;

      if (!apiResult.ok) {
        process.stdout.write(`  [${completed}/${sample.totalCases}] ${c.segment} — ERROR: ${apiResult.error}\n`);
        return {
          ...c, ok: false, error: apiResult.error, latency: apiResult.latency,
          draft: null, violations: [], bizChecks: [], validationErrors: 0, bizFails: 0,
        };
      }

      const draft = apiResult.draft;

      // Validate
      const sellerMsgCount = c.clientMsgCount === 0 ? 0 : 1; // approximate
      const validation = validateDraft(draft, {
        marketplace: c.marketplace,
        reviewRating: c.reviewRating,
        phase: c.phase,
        sellerMsgCount,
      });

      // Business checks
      const bizChecks = runBusinessChecks(draft, {
        marketplace: c.marketplace,
        reviewRating: c.reviewRating,
        phase: c.phase,
      });

      const validationErrors = validation.errors.length;
      const bizFails = bizChecks.filter(b => !b.pass).length;
      const status = validationErrors === 0 && bizFails === 0 ? 'PASS' : 'FAIL';

      process.stdout.write(`  [${completed}/${sample.totalCases}] ${c.segment} ${c.reviewRating}★ — ${status} (${apiResult.latency}ms)\n`);

      return {
        ...c, ok: true, draft, latency: apiResult.latency,
        violations: validation.violations,
        bizChecks,
        validationErrors,
        bizFails,
      };
    } catch (err) {
      completed++;
      process.stdout.write(`  [${completed}/${sample.totalCases}] ${c.segment} — EXCEPTION: ${err.message}\n`);
      return {
        ...c, ok: false, error: err.message, latency: 0,
        draft: null, violations: [], bizChecks: [], validationErrors: 0, bizFails: 0,
      };
    }
  }, CONCURRENCY, DELAY_MS);

  // Save results
  const outputDir = 'analysis-output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const resultsPath = path.join(outputDir, 'ai-eval-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    runAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalCases: results.length,
    results,
  }, null, 2));
  console.log(`\nResults saved to ${resultsPath}`);

  // Save CSV
  const csvPath = path.join(outputDir, 'ai-eval-report.csv');
  const csvHeader = 'chatId,storeId,marketplace,rating,phase,segment,status,errors,warnings,bizFails,latencyMs,draft_preview,violations';
  const csvRows = results.map(r => {
    const status = !r.ok ? 'API_ERROR' : (r.validationErrors === 0 && r.bizFails === 0) ? 'PASS' : 'FAIL';
    const draftPreview = r.draft ? `"${r.draft.slice(0, 100).replace(/"/g, '""').replace(/\n/g, ' ')}"` : '';
    const violationList = r.violations.map(v => `${v.sev}:${v.rule}`).join('|');
    return [
      r.chatId, r.storeId, r.marketplace, r.reviewRating, r.phase, r.segment,
      status, r.validationErrors, r.violations.filter(v => v.sev === 'warning').length,
      r.bizFails, r.latency, draftPreview, violationList,
    ].join(',');
  });
  fs.writeFileSync(csvPath, csvHeader + '\n' + csvRows.join('\n'));
  console.log(`CSV saved to ${csvPath}`);

  // Print report
  printReport(results, sample.segments);
}

main().catch(e => { console.error(e); process.exit(1); });
