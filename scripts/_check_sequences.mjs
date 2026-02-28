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

  // 6. Next send times for 30d sequences
  const r6 = await pool.query(`
    SELECT sequence_type, MIN(next_send_at)::text as earliest, MAX(next_send_at)::text as latest, COUNT(*) as cnt
    FROM chat_auto_sequences
    WHERE status = 'active' AND sequence_type LIKE '%_30d'
    GROUP BY sequence_type
  `);
  console.log('\n=== NEXT SEND TIMES FOR 30D ===');
  if (r6.rows.length > 0) {
    console.table(r6.rows);
  } else {
    console.log('No 30d sequences');
  }

  // 7. By store for 30d
  const r7 = await pool.query(`
    SELECT cas.store_id, s.name as store_name, cas.sequence_type, COUNT(*) as cnt
    FROM chat_auto_sequences cas
    JOIN stores s ON s.id = cas.store_id
    WHERE cas.status = 'active' AND cas.sequence_type LIKE '%_30d'
    GROUP BY cas.store_id, s.name, cas.sequence_type
    ORDER BY cnt DESC
  `);
  console.log('\n=== 30D SEQUENCES BY STORE ===');
  if (r7.rows.length > 0) {
    console.table(r7.rows);
  } else {
    console.log('None');
  }

  // 8. Old sequences: how many are past their 14-day period?
  const r8 = await pool.query(`
    SELECT
      COUNT(*) as total_old_active,
      COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '14 days') as past_14d,
      COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days') as past_7d
    FROM chat_auto_sequences
    WHERE status = 'active' AND sequence_type = 'no_reply_followup'
  `);
  console.log('\n=== OLD 14-DAY SEQUENCES AGE ===');
  console.log(r8.rows[0]);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
