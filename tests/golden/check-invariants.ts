/**
 * Golden Dataset — Invariant Checker
 *
 * Reads all JSON snapshots from tests/golden/conversations/
 * and validates each draft against business invariants using the
 * shared validateDraft() function from output-validator.
 *
 * Usage:
 *   npx tsx tests/golden/check-invariants.ts
 *
 * No DB or API access needed — works purely on saved snapshots.
 *
 * PR-07
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateDraft, type ValidatorContext } from '../../src/ai/output-validator';

interface GoldenSnapshot {
  id: string;
  chatId: string;
  marketplace: 'wb' | 'ozon';
  reviewRating: number | null;
  phase: 'discovery' | 'proposal' | 'resolution';
  sellerMessageCount: number;
  draft: string;
  manualScore: number | null;
  promptVersion?: number;
}

const CONVERSATIONS_DIR = path.join(__dirname, 'conversations');

function loadSnapshots(): GoldenSnapshot[] {
  const files = fs.readdirSync(CONVERSATIONS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'));

  return files.map(f => {
    const raw = fs.readFileSync(path.join(CONVERSATIONS_DIR, f), 'utf-8');
    return JSON.parse(raw) as GoldenSnapshot;
  });
}

function main() {
  const snapshots = loadSnapshots();

  if (snapshots.length === 0) {
    console.log('⚠ No golden snapshots found (files starting with _ are skipped).');
    console.log('  Record real chats first. See tests/golden/README.md');
    process.exit(0);
  }

  console.log(`\nChecking ${snapshots.length} golden snapshot(s)...\n`);

  let totalErrors = 0;
  let totalWarnings = 0;
  let passedCount = 0;

  for (const snap of snapshots) {
    if (!snap.draft || snap.draft === 'TODO') {
      console.log(`⏭  ${snap.id} — no draft recorded, skipping`);
      continue;
    }

    const ctx: ValidatorContext = {
      marketplace: snap.marketplace,
      reviewRating: snap.reviewRating,
      phase: snap.phase,
      sellerMessageCount: snap.sellerMessageCount,
      chatId: snap.chatId,
    };

    const result = validateDraft(snap.draft, ctx);

    const errors = result.violations.filter(v => v.severity === 'error');
    const warnings = result.violations.filter(v => v.severity === 'warning');

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✓  ${snap.id} — OK (${snap.draft.length} chars, ${snap.marketplace}, ${snap.phase})`);
      passedCount++;
    } else {
      if (errors.length > 0) {
        console.log(`✗  ${snap.id} — ${errors.length} error(s):`);
        errors.forEach(e => console.log(`     ERROR: ${e.message}`));
      }
      if (warnings.length > 0) {
        console.log(`⚠  ${snap.id} — ${warnings.length} warning(s):`);
        warnings.forEach(w => console.log(`     WARN:  ${w.message}`));
      }
    }

    totalErrors += errors.length;
    totalWarnings += warnings.length;

    // Show manual score if available
    if (snap.manualScore != null) {
      console.log(`     Manual score: ${snap.manualScore}/5`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passedCount} passed, ${totalErrors} errors, ${totalWarnings} warnings`);
  console.log(`Snapshots: ${snapshots.length} total`);

  if (totalErrors > 0) {
    console.log('\nFAILED — invariant violations detected.');
    process.exit(1);
  } else {
    console.log('\nPASSED — all invariants satisfied.');
    process.exit(0);
  }
}

main();
