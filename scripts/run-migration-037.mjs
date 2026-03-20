// Run migration 037: Create reviews_archive table + reviews_all view
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require2 = createRequire(import.meta.url);
const pg = require2('pg');

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, '..', 'migrations', '037_create_reviews_archive.sql');

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  statement_timeout: 300000, // 5 min
});

async function main() {
  console.log('Running migration 037: Create reviews_archive + reviews_all view');
  console.log('');

  const sql = readFileSync(migrationPath, 'utf-8');

  // Split by semicolons and execute each statement separately
  // (PostgreSQL doesn't support multiple statements in a single query via pg driver)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Skip pure comments
    const cleaned = stmt.replace(/--[^\n]*/g, '').trim();
    if (!cleaned) continue;

    const preview = cleaned.substring(0, 80).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    try {
      const t = Date.now();
      await pool.query(stmt);
      console.log(`  Done in ${Date.now() - t}ms`);
    } catch (err) {
      // IF NOT EXISTS / IF EXISTS can produce non-errors we want to skip
      if (err.message.includes('already exists') || err.message.includes('does not exist')) {
        console.log(`  Skipped (already applied): ${err.message}`);
      } else {
        console.error(`  ERROR: ${err.message}`);
        throw err;
      }
    }
  }

  console.log('\n=== Validation ===');

  // Verify table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews_archive') as exists
  `);
  console.log(`reviews_archive table: ${tableCheck.rows[0].exists ? 'EXISTS ✅' : 'MISSING ❌'}`);

  // Verify view exists
  const viewCheck = await pool.query(`
    SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'reviews_all') as exists
  `);
  console.log(`reviews_all view: ${viewCheck.rows[0].exists ? 'EXISTS ✅' : 'MISSING ❌'}`);

  // Verify archive is empty
  const countCheck = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  console.log(`reviews_archive rows: ${countCheck.rows[0].cnt}`);

  // Verify view works
  const viewCount = await pool.query('SELECT COUNT(*) as cnt FROM reviews_all');
  const reviewsCount = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
  console.log(`reviews_all count: ${viewCount.rows[0].cnt} (reviews: ${reviewsCount.rows[0].cnt})`);
  console.log(`Match: ${viewCount.rows[0].cnt === reviewsCount.rows[0].cnt ? '✅' : '❌'}`);

  // Check constraints
  const constraints = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'reviews_archive'::regclass
    ORDER BY conname
  `);
  console.log('\nArchive constraints:');
  constraints.rows.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

  // Check indexes
  const indexes = await pool.query(`
    SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size
    FROM pg_indexes WHERE tablename = 'reviews_archive'
    ORDER BY indexname
  `);
  console.log('\nArchive indexes:');
  indexes.rows.forEach(r => console.log(`  ${r.indexname}: ${r.size}`));

  // Check triggers
  const triggers = await pool.query(`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'reviews_archive'::regclass AND NOT tgisinternal
  `);
  console.log('\nArchive triggers:');
  triggers.rows.forEach(r => console.log(`  ${r.tgname}`));

  // Check FK constraints were dropped
  const fks = await pool.query(`
    SELECT conname, conrelid::regclass as table_name
    FROM pg_constraint
    WHERE confrelid = 'reviews'::regclass AND contype = 'f'
  `);
  console.log(`\nFK constraints referencing reviews: ${fks.rows.length}`);
  fks.rows.forEach(r => console.log(`  ${r.table_name}: ${r.conname}`));
  if (fks.rows.length === 0) {
    console.log('  All FK constraints dropped ✅');
  }

  console.log('\nMigration 037 complete!');
  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  await pool.end();
  process.exit(1);
});
