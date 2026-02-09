/**
 * Backfill + Immediate Send for a specific store
 * Usage: node scripts/backfill-and-send.mjs "Бейлин" 300
 *
 * For each candidate:
 * 1. Creates auto-sequence
 * 2. Checks: reply_sign exists, client didn't reply, chat not closed
 * 3. Sends step 1 message via WB Chat API
 * 4. Records in chat_messages, updates chat
 * 5. 3s pause between sends (WB rate limit)
 */

import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const storePattern = process.argv[2] || 'Бейлин';
  const limit = parseInt(process.argv[3]) || 300;

  const client = await pool.connect();

  try {
    // 1. Find store
    const storeRes = await client.query(
      "SELECT id, name, owner_id, chat_api_token, api_token FROM stores WHERE name ILIKE $1 AND status = 'active' LIMIT 1",
      ['%' + storePattern + '%']
    );

    if (storeRes.rows.length === 0) {
      console.error('Store not found:', storePattern);
      return;
    }

    const store = storeRes.rows[0];
    const token = store.chat_api_token || store.api_token;

    if (!token) {
      console.error('No API token for store', store.name);
      return;
    }

    console.log('\n========================================');
    console.log('BACKFILL + SEND');
    console.log('========================================');
    console.log('Store:', store.name);
    console.log('Limit:', limit);

    // 2. Get trigger phrase
    const settingsRes = await client.query("SELECT no_reply_trigger_phrase FROM user_settings LIMIT 1");
    const triggerPhrase = settingsRes.rows[0]?.no_reply_trigger_phrase || DEFAULT_TRIGGER_PHRASE;

    // 3. Find candidates
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
        SELECT cm.chat_id
        FROM chat_messages cm
        JOIN trigger_msgs tm ON tm.chat_id = cm.chat_id
        WHERE cm.sender = 'client'
          AND cm.timestamp > tm.trigger_sent_at
        GROUP BY cm.chat_id
      )
      SELECT
        c.id AS chat_id,
        c.client_name,
        c.reply_sign,
        c.tag,
        c.status,
        c.owner_id
      FROM trigger_msgs tm
      JOIN chats c ON c.id = tm.chat_id
      LEFT JOIN client_replies cr ON cr.chat_id = tm.chat_id
      LEFT JOIN chat_auto_sequences cas ON cas.chat_id = c.id AND cas.status = 'active'
      WHERE c.store_id = $1
        AND cr.chat_id IS NULL
        AND cas.id IS NULL
        AND c.status != 'closed'
      ORDER BY tm.trigger_sent_at DESC
      LIMIT $3
    `, [store.id, triggerPhrase, limit]);

    console.log('Candidates found:', candidatesRes.rows.length);

    if (candidatesRes.rows.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    const template = DEFAULT_TEMPLATES[0]; // Step 1 message
    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const startTime = Date.now();

    console.log('\n--- Processing ---');

    for (let i = 0; i < candidatesRes.rows.length; i++) {
      const row = candidatesRes.rows[i];
      const name = row.client_name || 'N/A';

      // Safety: must have reply_sign
      if (!row.reply_sign) {
        console.log(`  [${i + 1}/${candidatesRes.rows.length}] ${name}: SKIP (no reply_sign)`);
        skipped++;
        continue;
      }

      try {
        // Create sequence with distributed time slot
        const nextSendAt = getNextSlotTime();
        const seqRes = await client.query(`
          INSERT INTO chat_auto_sequences
            (chat_id, store_id, owner_id, sequence_type, messages, max_steps, current_step, last_sent_at, next_send_at)
          VALUES ($1, $2, $3, 'no_reply_followup', $4, $5, 1, NOW(), $6)
          RETURNING id
        `, [row.chat_id, store.id, row.owner_id, JSON.stringify(DEFAULT_TEMPLATES), DEFAULT_TEMPLATES.length, nextSendAt]);
        const seqId = seqRes.rows[0].id;

        // Update chat tag/status
        await client.query(`
          UPDATE chats SET
            tag = 'deletion_candidate',
            status = 'awaiting_reply',
            status_updated_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `, [row.chat_id]);

        // Send via WB Chat API
        const formData = new FormData();
        formData.append('replySign', row.reply_sign);
        formData.append('message', template.text);

        const response = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/message', {
          method: 'POST',
          headers: { 'Authorization': token },
          body: formData,
        });

        if (response.ok) {
          // Record message
          const msgId = 'auto_' + seqId.substring(0, 8) + '_0';
          await client.query(
            `INSERT INTO chat_messages (id, chat_id, store_id, owner_id, sender, text, timestamp)
             VALUES ($1, $2, $3, $4, 'seller', $5, NOW())`,
            [msgId, row.chat_id, store.id, row.owner_id, template.text]
          );

          // Update chat last message
          await client.query(
            `UPDATE chats SET last_message_text = $2, last_message_sender = 'seller', last_message_date = NOW(), updated_at = NOW() WHERE id = $1`,
            [row.chat_id, template.text]
          );

          sent++;
          if (sent % 25 === 0 || i === candidatesRes.rows.length - 1) {
            console.log(`  [${i + 1}/${candidatesRes.rows.length}] ${name}: ✅ sent (total: ${sent})`);
          }
        } else {
          const body = await response.text();
          console.log(`  [${i + 1}/${candidatesRes.rows.length}] ${name}: ❌ HTTP ${response.status} - ${body.substring(0, 100)}`);
          errors++;
        }

        // Rate limit: 3s between sends
        if (i < candidatesRes.rows.length - 1) {
          await sleep(3000);
        }

      } catch (err) {
        console.log(`  [${i + 1}/${candidatesRes.rows.length}] ${name}: ❌ ${err.message}`);
        errors++;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log('Sent:', sent);
    console.log('Skipped:', skipped, '(no reply_sign)');
    console.log('Errors:', errors);
    console.log('Duration:', duration + 's');
    console.log('Next follow-up: tomorrow');

    // Verify
    const verifyRes = await client.query(
      "SELECT COUNT(*) AS cnt FROM chat_auto_sequences WHERE store_id = $1 AND status = 'active'",
      [store.id]
    );
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
