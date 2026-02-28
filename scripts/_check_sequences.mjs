import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // 1. Count by status and type
  const r1 = await pool.query(`
    SELECT status, sequence_type, COUNT(*) as cnt
    FROM chat_auto_sequences
    GROUP BY status, sequence_type
    ORDER BY status, sequence_type
  `);
  console.log('=== ALL SEQUENCES BY STATUS & TYPE ===');
  console.table(r1.rows);

  // 2. Active sequences detail
  const r2 = await pool.query(`
    SELECT
      sequence_type,
      COUNT(*) as cnt,
      MIN(created_at)::text as oldest,
      MAX(created_at)::text as newest,
      MIN(current_step) as min_step,
      MAX(current_step) as max_step,
      AVG(current_step)::int as avg_step
    FROM chat_auto_sequences
    WHERE status = 'active'
    GROUP BY sequence_type
  `);
  console.log('\n=== ACTIVE SEQUENCES DETAIL ===');
  console.table(r2.rows);

  // 3. New 30d sequences (our new code)
  const r3 = await pool.query(`
    SELECT id, chat_id, store_id, sequence_type, status, created_at::text, current_step, max_steps
    FROM chat_auto_sequences
    WHERE sequence_type LIKE '%_30d'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('\n=== NEW 30D SEQUENCES ===');
  if (r3.rows.length > 0) {
    console.table(r3.rows);
  } else {
    console.log('None found');
  }

  // 4. Created in last 2 hours
  const r4 = await pool.query(`
    SELECT sequence_type, status, COUNT(*) as cnt
    FROM chat_auto_sequences
    WHERE created_at > NOW() - INTERVAL '2 hours'
    GROUP BY sequence_type, status
  `);
  console.log('\n=== CREATED IN LAST 2 HOURS ===');
  if (r4.rows.length > 0) {
    console.table(r4.rows);
  } else {
    console.log('None created');
  }

  // 5. Total active count (what shows in TG queue)
  const r5 = await pool.query(`
    SELECT COUNT(*) as total_active
    FROM chat_auto_sequences
    WHERE status = 'active'
  `);
  console.log('\n=== TOTAL ACTIVE (visible in TG badge) ===');
  console.log(r5.rows[0]);

  // 6. Check recent PM2 logs for AUTO-SEQ
  console.log('\n=== Check server logs for [AUTO-SEQ] entries ===');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
