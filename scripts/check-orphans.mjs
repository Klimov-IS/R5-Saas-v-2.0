import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: 6432, database: 'wb_reputation', user: 'admin_R5', password: 'MyNewPass123',
  ssl: { rejectUnauthorized: false }
});
const q = async (l, s) => { const r = await pool.query(s); console.log('\n=== ' + l + ' ==='); console.table(r.rows); };

await q('Orphaned awaiting_reply: active vs inactive stores', `
  SELECT
    CASE WHEN s.is_active THEN 'active_store' ELSE 'inactive_store' END as store_status,
    COUNT(*)::int as cnt
  FROM chats c
  LEFT JOIN stores s ON c.store_id = s.id
  WHERE c.status = 'awaiting_reply'
    AND NOT EXISTS (SELECT 1 FROM chat_auto_sequences cas WHERE cas.chat_id = c.id AND cas.status = 'active')
  GROUP BY 1
`);

await q('Orphaned awaiting_reply: how old is status?', `
  SELECT
    CASE
      WHEN c.status_updated_at > NOW() - INTERVAL '5 minutes' THEN 'last_5min'
      WHEN c.status_updated_at > NOW() - INTERVAL '1 hour' THEN 'last_hour'
      WHEN c.status_updated_at > NOW() - INTERVAL '1 day' THEN 'last_day'
      WHEN c.status_updated_at > NOW() - INTERVAL '7 days' THEN 'last_week'
      ELSE 'older'
    END as age,
    COUNT(*)::int as cnt
  FROM chats c
  WHERE c.status = 'awaiting_reply'
    AND NOT EXISTS (SELECT 1 FROM chat_auto_sequences cas WHERE cas.chat_id = c.id AND cas.status = 'active')
  GROUP BY 1 ORDER BY cnt DESC
`);

await q('Orphaned awaiting_reply on ACTIVE stores (should be fixed by cleanup)', `
  SELECT COUNT(*)::int as cnt
  FROM chats c
  JOIN stores s ON c.store_id = s.id AND s.is_active = TRUE
  WHERE c.status = 'awaiting_reply'
    AND c.status_updated_at < NOW() - INTERVAL '5 minutes'
    AND NOT EXISTS (SELECT 1 FROM chat_auto_sequences cas WHERE cas.chat_id = c.id AND cas.status = 'active')
`);

await q('CRON cleanup should fix but didnt - sample', `
  SELECT c.id, c.store_id, c.status_updated_at::text, c.last_message_sender, s.name as store_name, s.is_active
  FROM chats c
  JOIN stores s ON c.store_id = s.id AND s.is_active = TRUE
  WHERE c.status = 'awaiting_reply'
    AND c.status_updated_at < NOW() - INTERVAL '5 minutes'
    AND NOT EXISTS (SELECT 1 FROM chat_auto_sequences cas WHERE cas.chat_id = c.id AND cas.status = 'active')
  LIMIT 5
`);

await pool.end();
