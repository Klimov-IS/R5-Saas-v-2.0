/**
 * backfill-stores-stage.mjs
 *
 * Sets initial values for stores.stage field based on current store state.
 *
 * Logic:
 *   - client_lost: if status = 'archived' or 'stopped'
 *   - client_paused: if status = 'paused'
 *   - contract: if no API token
 *   - access_received: if has token but no products/reviews
 *   - chats_opened: if has review_chat_links records
 *   - complaints_submitted: if has reviews but no chats
 *   - cabinet_connected: default fallback
 *
 * Usage:
 *   node scripts/backfill-stores-stage.mjs --dry-run    # preview only
 *   node scripts/backfill-stores-stage.mjs              # execute
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from "pg";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Try to load .env.production first (on server), fallback to .env.local (local dev)
const productionEnvPath = '/var/www/wb-reputation/.env.production';
const localEnvPath = path.join(projectRoot, '.env.local');

let isProduction = false;

if (fs.existsSync(productionEnvPath)) {
  console.log('[ENV] Loading production environment...');
  const envFile = fs.readFileSync(productionEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  });
  isProduction = true;
} else if (fs.existsSync(localEnvPath)) {
  console.log('[ENV] Loading local development environment...');
  dotenv.config({ path: localEnvPath });
} else {
  console.error('[ENV] ERROR: No .env file found!');
  process.exit(1);
}

// Create pool with appropriate connection method
const { Pool } = pg;
const poolConfig = isProduction
  ? {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: { rejectUnauthorized: false }
    }
  : {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };

const pool = new Pool(poolConfig);

const DRY_RUN = process.argv.includes("--dry-run");

async function determineStage(store, client) {
  // Lost clients
  if (store.status === 'archived' || store.status === 'stopped') {
    return 'client_lost';
  }

  // Paused clients
  if (store.status === 'paused') {
    return 'client_paused';
  }

  // No API token = contract stage
  if (!store.api_token || store.api_token.trim() === '') {
    return 'contract';
  }

  // Check if has products
  const { rows: productCountRows } = await client.query(
    'SELECT COUNT(*)::int as count FROM products WHERE store_id = $1',
    [store.id]
  );
  const productCount = productCountRows[0].count;

  // Check if has chats
  const { rows: chatCountRows } = await client.query(
    'SELECT COUNT(DISTINCT chat_id)::int as count FROM review_chat_links WHERE store_id = $1',
    [store.id]
  );
  const chatCount = chatCountRows[0].count;

  // No data = access_received
  if (productCount === 0 && (store.total_reviews || 0) === 0) {
    return 'access_received';
  }

  // Has chats = chats_opened or monitoring (if progress high)
  if (chatCount > 0) {
    // For now, just set to chats_opened
    // In future, could check progress % and set to monitoring if >80%
    return 'chats_opened';
  }

  // Has reviews but no chats = complaints_submitted
  if ((store.total_reviews || 0) > 0) {
    return 'complaints_submitted';
  }

  // Default: cabinet connected
  return 'cabinet_connected';
}

async function main() {
  const client = await pool.connect();

  try {
    console.log(`\n=== Backfill stores.stage ===`);
    console.log(`Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "EXECUTE"}\n`);

    // Get all stores
    const { rows: stores } = await client.query(`
      SELECT
        id,
        name,
        marketplace,
        status,
        api_token,
        total_reviews,
        stage
      FROM stores
      ORDER BY created_at ASC
    `);

    console.log(`Found ${stores.length} stores\n`);

    const stageCounts = {};
    let updatedCount = 0;

    for (const store of stores) {
      const determinedStage = await determineStage(store, client);

      // Track counts
      stageCounts[determinedStage] = (stageCounts[determinedStage] || 0) + 1;

      const currentStage = store.stage || 'NULL';
      const willUpdate = currentStage !== determinedStage;

      if (willUpdate) {
        updatedCount++;
      }

      console.log(
        `[${store.marketplace.toUpperCase()}] ${store.name.padEnd(40)} | ` +
        `Current: ${currentStage.padEnd(20)} → New: ${determinedStage.padEnd(20)} ` +
        `${willUpdate ? '✓ UPDATE' : '(no change)'}`
      );

      // Execute update
      if (!DRY_RUN && willUpdate) {
        await client.query(
          'UPDATE stores SET stage = $1 WHERE id = $2',
          [determinedStage, store.id]
        );
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total stores: ${stores.length}`);
    console.log(`Stores to update: ${updatedCount}`);
    console.log(`\nStage distribution:`);
    Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([stage, count]) => {
        console.log(`  ${stage.padEnd(25)}: ${count}`);
      });

    if (DRY_RUN) {
      console.log(`\n⚠️  DRY RUN: No changes made. Run without --dry-run to execute.`);
    } else {
      console.log(`\n✅ Backfill completed successfully!`);
    }
  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
