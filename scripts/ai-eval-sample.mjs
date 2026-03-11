/**
 * AI Eval — Step 1: Sample 100 chats from DB.
 *
 * Selects chats across rating x phase x marketplace matrix.
 * Saves to analysis-output/ai-eval-sample.json
 *
 * Usage (server):  node scripts/ai-eval-sample.mjs
 * Usage (local):   node scripts/ai-eval-sample.mjs --env .env.local
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Pool } = pg;

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------
function loadEnv() {
  const envArg = process.argv.find(a => a.startsWith('--env='));
  const candidates = envArg
    ? [envArg.split('=')[1]]
    : ['.env.local', '/var/www/wb-reputation/.env.local', '/var/www/wb-reputation/.env.production'];

  for (const p of candidates) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) {
      const content = fs.readFileSync(resolved, 'utf8');
      content.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k && v && !process.env[k]) process.env[k] = v;
        }
      });
      console.log(`[ENV] Loaded: ${resolved}`);
      return;
    }
  }
  console.error('[ENV] No .env file found. Use --env=path/to/.env');
  process.exit(1);
}
loadEnv();

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

// ---------------------------------------------------------------------------
// Target distribution matrix — 100 chats total
// ---------------------------------------------------------------------------
const SEGMENTS = [
  { id: 'wb_1star_discovery',   mp: 'wb',   rMin: 1, rMax: 1, phase: 'discovery',   target: 10 },
  { id: 'wb_2star_discovery',   mp: 'wb',   rMin: 2, rMax: 2, phase: 'discovery',   target: 10 },
  { id: 'wb_3star_discovery',   mp: 'wb',   rMin: 3, rMax: 3, phase: 'discovery',   target: 10 },
  { id: 'wb_4star_discovery',   mp: 'wb',   rMin: 4, rMax: 4, phase: 'discovery',   target: 10 },
  { id: 'wb_neg_proposal',      mp: 'wb',   rMin: 1, rMax: 3, phase: 'proposal',    target: 10 },
  { id: 'wb_4star_proposal',    mp: 'wb',   rMin: 4, rMax: 4, phase: 'proposal',    target: 10 },
  { id: 'wb_neg_resolution',    mp: 'wb',   rMin: 1, rMax: 3, phase: 'resolution',  target: 10 },
  { id: 'wb_4star_resolution',  mp: 'wb',   rMin: 4, rMax: 4, phase: 'resolution',  target: 5  },
  { id: 'ozon_discovery',       mp: 'ozon', rMin: 1, rMax: 4, phase: 'discovery',   target: 10 },
  { id: 'ozon_proposal',        mp: 'ozon', rMin: 1, rMax: 4, phase: 'proposal',    target: 8  },
  { id: 'ozon_resolution',      mp: 'ozon', rMin: 1, rMax: 4, phase: 'resolution',  target: 7  },
];
// Sum: 10+10+10+10+10+10+10+5+10+8+7 = 100

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== AI EVAL: Sampling 100 chats ===\n');

  const { rows } = await pool.query(`
    SELECT
      c.id        AS chat_id,
      c.store_id,
      s.marketplace,
      r.review_rating,
      (SELECT COUNT(*) FROM chat_messages cm
       WHERE cm.chat_id = c.id AND cm.sender = 'client')::int AS client_msg_count
    FROM chats c
    JOIN stores s ON s.id = c.store_id AND s.status = 'active'
    JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
    JOIN reviews r ON r.id = rcl.review_id
    WHERE r.review_rating IS NOT NULL
      AND r.review_rating BETWEEN 1 AND 4
      AND c.status != 'closed'
    ORDER BY RANDOM()
  `);

  console.log(`Total eligible chats: ${rows.length}\n`);

  // Classify phase
  const classified = rows.map(r => ({
    ...r,
    phase: r.client_msg_count === 0 ? 'discovery'
         : r.client_msg_count === 1 ? 'proposal'
         : 'resolution',
  }));

  // Sample from each segment
  const cases = [];
  const segmentStats = [];

  for (const seg of SEGMENTS) {
    const pool_ = classified.filter(c =>
      c.marketplace === seg.mp &&
      c.review_rating >= seg.rMin &&
      c.review_rating <= seg.rMax &&
      c.phase === seg.phase
    );
    const picked = pool_.slice(0, seg.target);
    cases.push(...picked.map(p => ({
      chatId:         p.chat_id,
      storeId:        p.store_id,
      marketplace:    p.marketplace,
      reviewRating:   p.review_rating,
      phase:          p.phase,
      clientMsgCount: p.client_msg_count,
      segment:        seg.id,
    })));

    const actual = picked.length;
    segmentStats.push({ segment: seg.id, target: seg.target, actual, pool: pool_.length });
    const mark = actual >= seg.target ? 'OK' : actual === 0 ? 'EMPTY' : 'PARTIAL';
    console.log(`  ${seg.id.padEnd(25)} ${String(actual).padStart(2)}/${seg.target}  (pool: ${pool_.length}) ${mark}`);
  }

  console.log(`\nTotal sampled: ${cases.length}\n`);

  // Save
  const outputDir = 'analysis-output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const output = {
    sampledAt: new Date().toISOString(),
    totalCases: cases.length,
    segments: segmentStats,
    cases,
  };

  const outPath = path.join(outputDir, 'ai-eval-sample.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Saved to ${outPath}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
