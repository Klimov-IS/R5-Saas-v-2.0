/**
 * Backfill auto-sequences for a specific store
 * Usage: node scripts/backfill-store-sequences.mjs [storeNamePattern] [limit]
 * Example: node scripts/backfill-store-sequences.mjs "Бейлин" 10
 */

import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local');
  process.exit(1);
}

let connectionString = DATABASE_URL;
if (connectionString.includes('?sslmode=')) {
  connectionString = connectionString.split('?')[0];
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const DEFAULT_TRIGGER_PHRASE = 'Мы увидели ваш отзыв и очень хотим разобраться';

// Default templates (same as auto-sequence-templates.ts)
const DEFAULT_TEMPLATES = [
  { day: 1, text: 'Здравствуйте! Напоминаем о нашем предложении. Мы готовы помочь решить вопрос максимально удобно для вас.' },
  { day: 2, text: 'Добрый день! Хотели уточнить — вы успели ознакомиться с нашим предложением? Будем рады ответить на любые вопросы.' },
  { day: 3, text: 'Здравствуйте! Мы по-прежнему готовы к диалогу. Если у вас есть вопросы или сомнения — напишите, мы всё обсудим.' },
  { day: 4, text: 'Добрый день! Мы заметили, что вы ещё не ответили. Возможно, есть какие-то дополнительные вопросы? Мы на связи.' },
  { day: 5, text: 'Здравствуйте! Мы очень ценим вашу обратную связь и хотели бы найти решение, которое устроит обе стороны.' },
  { day: 6, text: 'Добрый день! Мы понимаем, что у вас может быть мало времени. Наше предложение остаётся актуальным — ответьте, когда будет удобно.' },
  { day: 7, text: 'Здравствуйте! Мы хотели бы узнать ваше мнение по нашему предложению. Возможно, мы можем предложить что-то другое?' },
  { day: 8, text: 'Добрый день! Наше предложение по-прежнему актуально. Мы готовы пойти навстречу и обсудить детали.' },
  { day: 9, text: 'Здравствуйте! Мы хотели бы напомнить о нашем предложении. Мы открыты для диалога и готовы учесть ваши пожелания.' },
  { day: 10, text: 'Добрый день! Мы по-прежнему заинтересованы в решении вопроса. Если вам нужно время на обдумывание — мы подождём.' },
  { day: 11, text: 'Здравствуйте! Мы ценим ваше время и хотели бы найти удобное решение. Напишите нам, когда будете готовы обсудить.' },
  { day: 12, text: 'Добрый день! Мы напоминаем, что наше предложение скоро перестанет быть актуальным. Пожалуйста, ответьте, если вам интересно.' },
  { day: 13, text: 'Здравствуйте! Это предпоследнее напоминание о нашем предложении. Мы по-прежнему готовы к диалогу.' },
  { day: 14, text: 'Добрый день! Это последнее напоминание. Если вы не ответите, мы закроем данное обращение. Спасибо за внимание!' },
];

/**
 * Time slots for distributed sending (MSK hours → weight).
 * Matches SEND_SLOTS in src/lib/auto-sequence-templates.ts
 */
const SEND_SLOTS = [
  { hour: 10, weight: 15 },
  { hour: 11, weight: 15 },
  { hour: 12, weight: 15 },
  { hour: 13, weight: 15 },
  { hour: 14, weight: 10 },
  { hour: 15, weight: 10 },
  { hour: 16, weight: 10 },
  { hour: 17, weight: 10 },
];

function getNextSlotTime() {
  const totalWeight = SEND_SLOTS.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * totalWeight;
  let selectedHour = SEND_SLOTS[0].hour;
  for (const slot of SEND_SLOTS) {
    rand -= slot.weight;
    if (rand <= 0) { selectedHour = slot.hour; break; }
  }
  const randomMinute = Math.floor(Math.random() * 60);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const utcHour = selectedHour - 3; // MSK = UTC+3
  tomorrow.setUTCHours(utcHour, randomMinute, 0, 0);
  return tomorrow.toISOString();
}

async function run() {
  const storePattern = process.argv[2] || 'Бейлин';
  const limit = parseInt(process.argv[3]) || 10;
  const dryRun = process.argv.includes('--dry-run');

  const client = await pool.connect();

  try {
    // 1. Find store
    const storeRes = await client.query(
      "SELECT id, name, owner_id FROM stores WHERE name ILIKE $1 AND status = 'active' LIMIT 1",
      ['%' + storePattern + '%']
    );

    if (storeRes.rows.length === 0) {
      console.error('Store not found for pattern:', storePattern);
      return;
    }

    const store = storeRes.rows[0];
    console.log('\n========================================');
    console.log('BACKFILL AUTO-SEQUENCES' + (dryRun ? ' [DRY RUN]' : ''));
    console.log('========================================');
    console.log('Store:', store.name);
    console.log('Store ID:', store.id);
    console.log('Limit:', limit);

    // 2. Get trigger phrase from settings
    const settingsRes = await client.query("SELECT no_reply_trigger_phrase FROM user_settings LIMIT 1");
    const triggerPhrase = settingsRes.rows[0]?.no_reply_trigger_phrase || DEFAULT_TRIGGER_PHRASE;
    console.log('Trigger:', triggerPhrase.substring(0, 60) + '...');

    // 3. Find candidates: chats where seller sent trigger phrase + client didn't reply
    const candidatesRes = await client.query(`
      WITH trigger_msgs AS (
        SELECT cm.chat_id, MAX(cm.timestamp) AS trigger_sent_at
        FROM chat_messages cm
        WHERE cm.store_id = $1
          AND cm.sender = 'seller'
          AND cm.text LIKE '%' || $2 || '%'
        GROUP BY cm.chat_id
      ),
      client_replies AS (
        SELECT cm.chat_id, MAX(cm.timestamp) AS last_reply_at
        FROM chat_messages cm
        JOIN trigger_msgs tm ON tm.chat_id = cm.chat_id
        WHERE cm.sender = 'client'
          AND cm.timestamp > tm.trigger_sent_at
        GROUP BY cm.chat_id
      )
      SELECT
        c.id AS chat_id,
        c.client_name,
        SUBSTRING(c.product_name FROM 1 FOR 35) AS product,
        c.tag,
        c.status,
        c.last_message_sender,
        c.owner_id,
        tm.trigger_sent_at
      FROM trigger_msgs tm
      JOIN chats c ON c.id = tm.chat_id
      LEFT JOIN client_replies cr ON cr.chat_id = tm.chat_id
      LEFT JOIN chat_auto_sequences cas ON cas.chat_id = c.id AND cas.status = 'active'
      WHERE c.store_id = $1
        AND cr.chat_id IS NULL           -- client did NOT reply after trigger
        AND cas.id IS NULL               -- no active sequence already
        AND c.status != 'closed'         -- not already closed
      ORDER BY tm.trigger_sent_at DESC
      LIMIT $3
    `, [store.id, triggerPhrase, limit]);

    console.log('\nFound', candidatesRes.rows.length, 'candidates (limit:', limit + ')');

    if (candidatesRes.rows.length === 0) {
      console.log('\nNo candidates to backfill.');
      return;
    }

    console.log('\n--- Candidates ---');
    for (const row of candidatesRes.rows) {
      const triggerDate = new Date(row.trigger_sent_at).toISOString().split('T')[0];
      console.log(`  ${row.client_name || 'N/A'} | tag=${row.tag} status=${row.status} | trigger: ${triggerDate} | ${row.product || 'N/A'}`);
    }

    if (dryRun) {
      console.log('\n[DRY RUN] Would create', candidatesRes.rows.length, 'sequences. No changes made.');
      return;
    }

    // 4. Create sequences
    console.log('\n--- Creating sequences ---');
    let created = 0;
    let updated = 0;

    for (const row of candidatesRes.rows) {
      const nextSendAt = getNextSlotTime();

      // Create sequence
      await client.query(`
        INSERT INTO chat_auto_sequences
          (chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)
        VALUES ($1, $2, $3, 'no_reply_followup', $4, $5, $6)
      `, [row.chat_id, store.id, row.owner_id, JSON.stringify(DEFAULT_TEMPLATES), DEFAULT_TEMPLATES.length, nextSendAt]);
      created++;

      // Update chat tag and status if needed
      if (row.tag !== 'deletion_candidate') {
        await client.query(`
          UPDATE chats SET
            tag = 'deletion_candidate',
            status = 'awaiting_reply',
            status_updated_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `, [row.chat_id]);
        updated++;
      } else if (row.status !== 'awaiting_reply') {
        await client.query(`
          UPDATE chats SET
            status = 'awaiting_reply',
            status_updated_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `, [row.chat_id]);
        updated++;
      }

      console.log(`  ✅ ${row.client_name || 'N/A'}: sequence created, next send: ${nextSendAt.split('T')[0]}`);
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log('Sequences created:', created);
    console.log('Chats updated (tag/status):', updated);
    console.log('Next send: tomorrow');
    console.log('');

    // 5. Verify
    const verifyRes = await client.query(`
      SELECT COUNT(*) AS cnt FROM chat_auto_sequences
      WHERE store_id = $1 AND status = 'active'
    `, [store.id]);
    console.log('Active sequences for', store.name + ':', verifyRes.rows[0].cnt);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
