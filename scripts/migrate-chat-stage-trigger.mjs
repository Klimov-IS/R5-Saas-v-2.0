/**
 * Migration: Create DB trigger enforce_chat_stage_rules
 *
 * When last_message_sender changes to 'client' and there's no active sequence,
 * automatically set status to 'inbox' (instant enforcement).
 *
 * Run: POSTGRES_HOST=... node scripts/migrate-chat-stage-trigger.mjs
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net',
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB || 'wb_reputation',
  user: process.env.POSTGRES_USER || 'admin_R5',
  password: process.env.POSTGRES_PASSWORD || 'MyNewPass123',
  ssl: { rejectUnauthorized: false },
});

try {
  console.log('Creating enforce_chat_stage_rules() function...');

  await pool.query(`
    CREATE OR REPLACE FUNCTION enforce_chat_stage_rules()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Rule: client wrote last → inbox (if no active sequence and not closed)
      IF NEW.last_message_sender = 'client'
         AND NEW.status NOT IN ('inbox', 'closed')
      THEN
        IF NOT EXISTS (
          SELECT 1 FROM chat_auto_sequences
          WHERE chat_id = NEW.id AND status = 'active'
        ) THEN
          NEW.status := 'inbox';
          NEW.status_updated_at := NOW();
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('✅ Function created');

  // Drop existing trigger if any (safe to re-run)
  await pool.query(`DROP TRIGGER IF EXISTS trg_enforce_chat_stage ON chats;`);

  await pool.query(`
    CREATE TRIGGER trg_enforce_chat_stage
      BEFORE UPDATE ON chats
      FOR EACH ROW
      WHEN (OLD.last_message_sender IS DISTINCT FROM NEW.last_message_sender)
      EXECUTE FUNCTION enforce_chat_stage_rules();
  `);
  console.log('✅ Trigger created on chats table');

  // Verify
  const check = await pool.query(`
    SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_enforce_chat_stage'
  `);
  console.log('Verification:', check.rows);

  console.log('\n✅ Migration complete. DB trigger will enforce chat stage rules instantly.');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
