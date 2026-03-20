// Run migration 037: Create reviews_archive table + reviews_all view
// Executes each statement individually for reliability
import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const pg = require2('pg');

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  statement_timeout: 300000,
});

async function exec(label, sql) {
  console.log(`[${label}]`);
  try {
    const t = Date.now();
    await pool.query(sql);
    console.log(`  Done in ${Date.now() - t}ms ✅`);
    return true;
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log(`  Already exists — skipped ✅`);
      return true;
    }
    console.error(`  ERROR: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('Running migration 037: Create reviews_archive + reviews_all view\n');

  // 1. Create archive table with identical schema
  await exec('1. CREATE TABLE reviews_archive',
    `CREATE TABLE IF NOT EXISTS reviews_archive (LIKE reviews INCLUDING DEFAULTS)`
  );

  // 2. Add primary key
  await exec('2. ADD PRIMARY KEY',
    `ALTER TABLE reviews_archive ADD PRIMARY KEY (id)`
  );

  // 3. CHECK constraint: archive only holds 5★
  await exec('3. CHECK constraint (rating = 5)',
    `ALTER TABLE reviews_archive ADD CONSTRAINT chk_archive_rating_5 CHECK (rating = 5)`
  );

  // 4. Indexes
  await exec('4a. Index: idx_ra_store_date',
    `CREATE INDEX IF NOT EXISTS idx_ra_store_date ON reviews_archive(store_id, date DESC)`
  );
  await exec('4b. Index: idx_ra_product_date',
    `CREATE INDEX IF NOT EXISTS idx_ra_product_date ON reviews_archive(product_id, date DESC)`
  );
  await exec('4c. Index: idx_ra_store_rating',
    `CREATE INDEX IF NOT EXISTS idx_ra_store_rating ON reviews_archive(store_id, rating, date DESC)`
  );
  await exec('4d. Index: idx_ra_marketplace',
    `CREATE INDEX IF NOT EXISTS idx_ra_marketplace ON reviews_archive(marketplace)`
  );

  // 5. Triggers
  await exec('5a. Trigger: complaint flags',
    `CREATE TRIGGER update_reviews_archive_complaint_flags
     BEFORE INSERT OR UPDATE OF complaint_status, complaint_text, complaint_sent_date
     ON reviews_archive FOR EACH ROW
     EXECUTE FUNCTION update_review_complaint_flags()`
  );
  await exec('5b. Trigger: updated_at',
    `CREATE TRIGGER update_reviews_archive_updated_at
     BEFORE UPDATE ON reviews_archive FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column()`
  );

  // 6. UNION ALL view
  await exec('6. CREATE VIEW reviews_all',
    `CREATE OR REPLACE VIEW reviews_all AS
     SELECT * FROM reviews UNION ALL SELECT * FROM reviews_archive`
  );

  // 7. Drop FK constraints (can't reference two tables)
  await exec('7a. Drop FK: review_complaints',
    `ALTER TABLE review_complaints DROP CONSTRAINT IF EXISTS review_complaints_review_id_fkey`
  );
  await exec('7b. Drop FK: complaint_details',
    `ALTER TABLE complaint_details DROP CONSTRAINT IF EXISTS complaint_details_review_id_fkey`
  );
  await exec('7c. Drop FK: review_chat_links',
    `ALTER TABLE review_chat_links DROP CONSTRAINT IF EXISTS review_chat_links_review_id_fkey`
  );
  await exec('7d. Drop FK: review_deletion_cases',
    `ALTER TABLE review_deletion_cases DROP CONSTRAINT IF EXISTS review_deletion_cases_review_id_fkey`
  );

  // === Validation ===
  console.log('\n=== Validation ===');

  const tableCheck = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews_archive') as exists`
  );
  console.log(`reviews_archive table: ${tableCheck.rows[0].exists ? 'EXISTS ✅' : 'MISSING ❌'}`);

  const viewCheck = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'reviews_all') as exists`
  );
  console.log(`reviews_all view: ${viewCheck.rows[0].exists ? 'EXISTS ✅' : 'MISSING ❌'}`);

  const countCheck = await pool.query('SELECT COUNT(*) as cnt FROM reviews_archive');
  console.log(`reviews_archive rows: ${countCheck.rows[0].cnt}`);

  const viewCount = await pool.query('SELECT COUNT(*) as cnt FROM reviews_all');
  const reviewsCount = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
  console.log(`reviews_all count: ${viewCount.rows[0].cnt} (reviews: ${reviewsCount.rows[0].cnt})`);
  console.log(`Match: ${viewCount.rows[0].cnt === reviewsCount.rows[0].cnt ? '✅' : '❌'}`);

  const constraints = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint WHERE conrelid = 'reviews_archive'::regclass ORDER BY conname
  `);
  console.log('\nArchive constraints:');
  constraints.rows.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

  const indexes = await pool.query(`
    SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size
    FROM pg_indexes WHERE tablename = 'reviews_archive' ORDER BY indexname
  `);
  console.log('\nArchive indexes:');
  indexes.rows.forEach(r => console.log(`  ${r.indexname}: ${r.size}`));

  const triggers = await pool.query(`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'reviews_archive'::regclass AND NOT tgisinternal
  `);
  console.log('\nArchive triggers:');
  triggers.rows.forEach(r => console.log(`  ${r.tgname}`));

  const fks = await pool.query(`
    SELECT conname, conrelid::regclass as table_name
    FROM pg_constraint WHERE confrelid = 'reviews'::regclass AND contype = 'f'
  `);
  console.log(`\nFK constraints referencing reviews: ${fks.rows.length}`);
  if (fks.rows.length === 0) {
    console.log('  All FK constraints dropped ✅');
  } else {
    fks.rows.forEach(r => console.log(`  ${r.table_name}: ${r.conname}`));
  }

  console.log('\nMigration 037 complete!');
  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  await pool.end();
  process.exit(1);
});
