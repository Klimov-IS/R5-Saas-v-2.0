/**
 * One-time script: Full review sync for Jan 1 - Feb 11 2026 across ALL active stores.
 * Calls the existing review sync API in full mode with date range.
 *
 * Usage: node scripts/backfill-reviews-jan-feb.mjs
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

const DATE_FROM = Math.floor(new Date('2026-01-01').getTime() / 1000);
const DATE_TO = Math.floor(new Date().getTime() / 1000);

async function main() {
  console.log('\n=== Backfill Reviews: Jan 1 - Now ===');
  console.log(`Date range: ${new Date(DATE_FROM * 1000).toISOString()} → ${new Date(DATE_TO * 1000).toISOString()}`);
  console.log(`API: ${BASE_URL}\n`);

  // Get all active stores
  const storesRes = await pool.query("SELECT id, name FROM stores WHERE status = 'active' ORDER BY name");
  const stores = storesRes.rows;
  console.log(`Found ${stores.length} active stores\n`);

  let success = 0;
  let failed = 0;
  const errors = [];
  const startTime = Date.now();

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const progress = `[${i + 1}/${stores.length}]`;

    try {
      console.log(`${progress} Syncing ${store.name}...`);

      const url = `${BASE_URL}/api/stores/${store.id}/reviews/update?mode=full&dateFrom=${DATE_FROM}&dateTo=${DATE_TO}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.substring(0, 200)}`);
      }

      const result = await resp.json();
      console.log(`${progress} OK: ${store.name} — ${result.message || 'done'}`);
      success++;

      // Wait 5 seconds between stores
      if (i < stores.length - 1) {
        await new Promise(r => setTimeout(r, 5000));
      }

    } catch (err) {
      failed++;
      errors.push({ store: store.name, error: err.message });
      console.error(`${progress} FAIL: ${store.name} — ${err.message}`);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log('\n=== Summary ===');
  console.log(`Duration: ${duration}s (${Math.round(duration / 60)} min)`);
  console.log(`Success: ${success}/${stores.length}`);
  console.log(`Failed: ${failed}`);
  if (errors.length > 0) {
    console.log('\nFailed stores:');
    errors.forEach(e => console.log(`  ${e.store}: ${e.error}`));
  }

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
