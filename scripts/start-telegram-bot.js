/**
 * Telegram Bot Process
 *
 * Standalone PM2 process that handles:
 * - /start — welcome message
 * - /link <api_key> — link TG account to R5 user
 * - /stop — disable notifications
 * - /status — show link status
 *
 * Run with: node scripts/start-telegram-bot.js
 * Or via PM2: pm2 start ecosystem.config.js --only wb-reputation-tg-bot
 */

require('dotenv').config({ path: '.env.production' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://r5saas.ru/tg';

if (!BOT_TOKEN) {
  console.error('[TG-BOT] ❌ TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}

// Build DATABASE_URL from individual POSTGRES_* vars if not set directly
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '6432';
  const db = process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  if (host && db && user && password) {
    DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}`;
  }
}

if (!DATABASE_URL) {
  console.error('[TG-BOT] ❌ Database config is not set (need DATABASE_URL or POSTGRES_* vars)');
  process.exit(1);
}

console.log('[TG-BOT] 🚀 Starting Telegram bot...');
console.log('[TG-BOT] 📅 Timestamp:', new Date().toISOString());

// ============================================================================
// Database (direct pg, no Next.js imports)
// ============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  ssl: { rejectUnauthorized: false },
  application_name: 'wb-reputation-tg-bot',
  client_encoding: 'UTF8',
});

async function dbQuery(text, params) {
  return pool.query(text, params);
}

// ============================================================================
// Telegram Bot API (raw fetch, no extra dependencies)
// ============================================================================

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tgRequest(method, body = {}) {
  const response = await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) {
    console.error(`[TG-BOT] API error (${method}):`, data.description);
  }
  return data;
}

async function sendMessage(chatId, text, extra = {}) {
  return tgRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleStart(msg) {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'друг';
  const text = msg.text.trim();

  // Deep link: /start <payload>
  const parts = text.split(/\s+/);
  const payload = parts.length > 1 ? parts[1] : null;

  // /start wbrm_xxx → auto-link existing user
  if (payload && payload.startsWith('wbrm_')) {
    console.log(`[TG-BOT] Deep link auto-link: TG ${msg.from.id} with key ${payload.substring(0, 10)}...`);
    await handleLink(msg, payload);
    return;
  }

  // /start inv_xxx → auto-register from invite + link
  if (payload && payload.startsWith('inv_')) {
    const inviteToken = payload.substring(4); // remove "inv_" prefix
    console.log(`[TG-BOT] Deep link invite: TG ${msg.from.id} with token ${inviteToken.substring(0, 8)}...`);
    await handleInviteLink(msg, inviteToken);
    return;
  }

  await sendMessage(chatId,
    `👋 Привет, ${name}!\n\n` +
    `Я — бот R5 для управления чатами с покупателями Wildberries и OZON.\n\n` +
    `<b>Что я умею:</b>\n` +
    `• Уведомляю о новых ответах клиентов\n` +
    `• Открываю Mini App для быстрого ответа\n\n` +
    `<b>Для начала:</b>\n` +
    `Привяжите ваш аккаунт R5 командой:\n` +
    `<code>/link ваш_api_ключ</code>\n\n` +
    `API ключ можно найти в настройках R5 кабинета.`
  );
}

async function handleLink(msg, apiKey) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const telegramUsername = msg.from.username || null;

  if (!apiKey || !apiKey.startsWith('wbrm_')) {
    await sendMessage(chatId,
      '❌ Неверный формат API ключа.\n\n' +
      'Ключ должен начинаться с <code>wbrm_</code>\n' +
      'Пример: <code>/link wbrm_0ab7137430d4fb62948db3a7d9b4b997</code>'
    );
    return;
  }

  try {
    // Find R5 user by API key
    const userResult = await dbQuery(
      `SELECT u.id, u.email
       FROM users u
       JOIN user_settings us ON u.id = us.id
       WHERE us.api_key = $1`,
      [apiKey]
    );

    if (!userResult.rows[0]) {
      await sendMessage(chatId, '❌ API ключ не найден. Проверьте правильность ключа.');
      return;
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;

    // Check if this TG account is already linked
    const existingTg = await dbQuery(
      'SELECT id, user_id FROM telegram_users WHERE telegram_id = $1',
      [telegramId]
    );

    if (existingTg.rows[0]) {
      if (existingTg.rows[0].user_id === userId) {
        await sendMessage(chatId, '✅ Ваш аккаунт уже привязан!');
      } else {
        await sendMessage(chatId,
          '⚠️ Этот Telegram аккаунт уже привязан к другому пользователю R5.\n' +
          'Сначала отвяжите текущий аккаунт командой /unlink.'
        );
      }
      return;
    }

    // Check if R5 user already has a linked TG account
    const existingUser = await dbQuery(
      'SELECT id FROM telegram_users WHERE user_id = $1',
      [userId]
    );

    if (existingUser.rows[0]) {
      await sendMessage(chatId,
        '⚠️ Этот R5 аккаунт уже привязан к другому Telegram аккаунту.\n' +
        'Один аккаунт R5 = один Telegram.'
      );
      return;
    }

    // Create link
    await dbQuery(
      `INSERT INTO telegram_users (id, user_id, telegram_id, telegram_username, chat_id)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
      [userId, telegramId, telegramUsername, chatId]
    );

    // Get stores count via org membership (works for managers too, not just owners)
    const orgResult = await dbQuery(
      'SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    let wbCount = 0, ozonCount = 0, storeCount = 0, storeBreakdown = '';
    if (orgResult.rows[0]) {
      const storesResult = await dbQuery(
        "SELECT marketplace, COUNT(*) as count FROM stores WHERE org_id = $1 AND status = 'active' GROUP BY marketplace",
        [orgResult.rows[0].org_id]
      );
      wbCount = parseInt((storesResult.rows.find(r => r.marketplace === 'wb') || { count: 0 }).count, 10);
      ozonCount = parseInt((storesResult.rows.find(r => r.marketplace === 'ozon') || { count: 0 }).count, 10);
      storeCount = wbCount + ozonCount;
      storeBreakdown = ozonCount > 0 ? ` (WB: ${wbCount}, OZON: ${ozonCount})` : '';
    }

    await sendMessage(chatId,
      `✅ Аккаунт привязан!\n\n` +
      `📧 ${userEmail}\n` +
      `🏪 Магазинов: ${storeCount}${storeBreakdown}\n\n` +
      `Теперь вы будете получать уведомления о новых ответах клиентов.`,
      {
        reply_markup: {
          inline_keyboard: [[{
            text: '📱 Открыть Mini App',
            web_app: { url: MINI_APP_URL },
          }]],
        },
      }
    );

    console.log(`[TG-BOT] ✅ Linked TG ${telegramId} (@${telegramUsername}) → user ${userId} (${userEmail})`);

  } catch (error) {
    console.error('[TG-BOT] Error in /link:', error.message);
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Handle invite deep link: /start inv_<invite-token>
 * Auto-registers user from invite + links TG account in one step.
 * Manager doesn't need to register on the web at all.
 */
async function handleInviteLink(msg, inviteToken) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const telegramUsername = msg.from.username || null;
  const displayName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || 'Manager';

  try {
    // 1. Check if this TG account is already linked
    const existingTg = await dbQuery(
      'SELECT id, user_id FROM telegram_users WHERE telegram_id = $1',
      [telegramId]
    );
    if (existingTg.rows[0]) {
      await sendMessage(chatId,
        '✅ Ваш Telegram уже привязан к аккаунту R5!\n\n' +
        'Откройте Mini App для работы с чатами.',
        {
          reply_markup: {
            inline_keyboard: [[{
              text: '📱 Открыть Mini App',
              web_app: { url: MINI_APP_URL },
            }]],
          },
        }
      );
      return;
    }

    // 2. Look up invite
    const inviteResult = await dbQuery(
      'SELECT * FROM invites WHERE token = $1',
      [inviteToken]
    );
    const invite = inviteResult.rows[0];

    if (!invite) {
      await sendMessage(chatId, '❌ Приглашение не найдено. Запросите новую ссылку у администратора.');
      return;
    }

    if (invite.used_at) {
      await sendMessage(chatId, '⚠️ Это приглашение уже использовано. Запросите новое у администратора.');
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      await sendMessage(chatId, '⚠️ Приглашение истекло. Запросите новое у администратора.');
      return;
    }

    // 3. Check if email already registered
    const existingUser = await dbQuery(
      'SELECT id FROM users WHERE email = $1',
      [invite.email]
    );
    if (existingUser.rows[0]) {
      await sendMessage(chatId,
        '⚠️ Пользователь с этим email уже зарегистрирован.\n\n' +
        'Если это ваш аккаунт, используйте команду /link для привязки.'
      );
      return;
    }

    // 4. Auto-register: create user + settings + org member + stores + TG link
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 4a. Create user (no password — TG-only auth)
      const crypto = require('crypto');
      const apiKey = `wbrm_${crypto.randomBytes(16).toString('hex')}`;
      const userResult = await client.query(
        `INSERT INTO users (id, email, password_hash, display_name, is_approved)
         VALUES (gen_random_uuid()::text, $1, NULL, $2, TRUE)
         RETURNING id`,
        [invite.email, displayName]
      );
      const userId = userResult.rows[0].id;

      // 4b. Create user_settings with API key
      await client.query(
        `INSERT INTO user_settings (id, deepseek_api_key, api_key)
         VALUES ($1, '', $2)`,
        [userId, apiKey]
      );

      // 4c. Add to org_members
      const memberResult = await client.query(
        `INSERT INTO org_members (id, org_id, user_id, role)
         VALUES (gen_random_uuid()::text, $1, $2, $3)
         RETURNING id`,
        [invite.org_id, userId, invite.role]
      );
      const memberId = memberResult.rows[0].id;

      // 4d. Auto-assign all active org stores (for any role)
      const storesResult = await client.query(
        `SELECT id FROM stores WHERE org_id = $1 AND status = 'active'`,
        [invite.org_id]
      );
      for (const store of storesResult.rows) {
        await client.query(
          `INSERT INTO member_store_access (id, member_id, store_id)
           VALUES (gen_random_uuid()::text, $1, $2)`,
          [memberId, store.id]
        );
      }

      // 4e. Mark invite as used
      await client.query(
        'UPDATE invites SET used_at = NOW() WHERE id = $1',
        [invite.id]
      );

      // 4f. Link Telegram account
      await client.query(
        `INSERT INTO telegram_users (id, user_id, telegram_id, telegram_username, chat_id)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
        [userId, telegramId, telegramUsername, chatId]
      );

      await client.query('COMMIT');

      // 5. Get store count for success message
      const storeCount = storesResult.rows.length;
      const roleLabel = invite.role === 'admin' ? 'Администратор' : 'Менеджер';

      await sendMessage(chatId,
        `✅ Регистрация завершена!\n\n` +
        `📧 ${invite.email}\n` +
        `👤 ${displayName}\n` +
        `🏷 Роль: ${roleLabel}\n` +
        `🏪 Магазинов: ${storeCount}\n\n` +
        `Теперь вы будете получать уведомления о новых ответах клиентов.\n` +
        `Откройте Mini App для работы с чатами.`,
        {
          reply_markup: {
            inline_keyboard: [[{
              text: '📱 Открыть Mini App',
              web_app: { url: MINI_APP_URL },
            }]],
          },
        }
      );

      console.log(`[TG-BOT] ✅ Auto-registered + linked: TG ${telegramId} (@${telegramUsername}) → user ${userId} (${invite.email}), role=${invite.role}, stores=${storeCount}`);

    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[TG-BOT] Error in invite link:', error.message);
    await sendMessage(chatId, '❌ Произошла ошибка при регистрации. Попробуйте позже.');
  }
}

async function handleStop(msg) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const result = await dbQuery(
      `UPDATE telegram_users
       SET is_notifications_enabled = FALSE, updated_at = NOW()
       WHERE telegram_id = $1
       RETURNING id`,
      [telegramId]
    );

    if (result.rows[0]) {
      await sendMessage(chatId,
        '🔇 Уведомления отключены.\n\n' +
        'Вы можете снова включить их командой /start_notifications'
      );
    } else {
      await sendMessage(chatId, '⚠️ Аккаунт не привязан. Используйте /link для привязки.');
    }
  } catch (error) {
    console.error('[TG-BOT] Error in /stop:', error.message);
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

async function handleStartNotifications(msg) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const result = await dbQuery(
      `UPDATE telegram_users
       SET is_notifications_enabled = TRUE, updated_at = NOW()
       WHERE telegram_id = $1
       RETURNING id`,
      [telegramId]
    );

    if (result.rows[0]) {
      await sendMessage(chatId, '🔔 Уведомления включены!');
    } else {
      await sendMessage(chatId, '⚠️ Аккаунт не привязан. Используйте /link для привязки.');
    }
  } catch (error) {
    console.error('[TG-BOT] Error in /start_notifications:', error.message);
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

async function handleStatus(msg) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const result = await dbQuery(
      `SELECT tu.*, u.email
       FROM telegram_users tu
       JOIN users u ON tu.user_id = u.id
       WHERE tu.telegram_id = $1`,
      [telegramId]
    );

    if (!result.rows[0]) {
      await sendMessage(chatId,
        '⚠️ Аккаунт не привязан.\n\n' +
        'Используйте <code>/link ваш_api_ключ</code> для привязки.'
      );
      return;
    }

    const tgUser = result.rows[0];

    // Get stores
    const storesResult = await dbQuery(
      "SELECT name, marketplace FROM stores WHERE owner_id = $1 AND status = 'active' ORDER BY name",
      [tgUser.user_id]
    );
    const storeNames = storesResult.rows.map(r => {
      const suffix = r.marketplace === 'ozon' ? ' (OZON)' : ' (WB)';
      return r.name + suffix;
    }).join(', ') || 'Нет активных';

    // Get notification count (last 24h)
    const notifResult = await dbQuery(
      `SELECT COUNT(*) as count FROM telegram_notifications_log
       WHERE telegram_user_id = $1 AND sent_at > NOW() - INTERVAL '24 hours'`,
      [tgUser.id]
    );

    await sendMessage(chatId,
      `📊 <b>Статус аккаунта</b>\n\n` +
      `📧 ${tgUser.email}\n` +
      `🔔 Уведомления: ${tgUser.is_notifications_enabled ? '✅ Включены' : '🔇 Отключены'}\n` +
      `🏪 Магазины: ${storeNames}\n` +
      `📨 Уведомлений за 24ч: ${notifResult.rows[0].count}\n` +
      `📅 Привязан: ${new Date(tgUser.linked_at).toLocaleDateString('ru-RU')}`,
      {
        reply_markup: {
          inline_keyboard: [[{
            text: '📱 Открыть Mini App',
            web_app: { url: MINI_APP_URL },
          }]],
        },
      }
    );
  } catch (error) {
    console.error('[TG-BOT] Error in /status:', error.message);
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

async function handleUnlink(msg) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const result = await dbQuery(
      'DELETE FROM telegram_users WHERE telegram_id = $1 RETURNING id',
      [telegramId]
    );

    if (result.rows[0]) {
      await sendMessage(chatId, '✅ Аккаунт отвязан. Вы можете привязать другой командой /link.');
      console.log(`[TG-BOT] ✅ Unlinked TG ${telegramId}`);
    } else {
      await sendMessage(chatId, '⚠️ Аккаунт не был привязан.');
    }
  } catch (error) {
    console.error('[TG-BOT] Error in /unlink:', error.message);
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

// ============================================================================
// Polling Loop
// ============================================================================

let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const data = await tgRequest('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30, // Long polling (30 sec)
      allowed_updates: ['message'],
    });

    if (!data.ok || !data.result) return;

    for (const update of data.result) {
      lastUpdateId = update.update_id;

      const msg = update.message;
      if (!msg || !msg.text) continue;

      const text = msg.text.trim();

      if (text.startsWith('/start')) {
        await handleStart(msg);
      } else if (text.startsWith('/link')) {
        const apiKey = text.split(/\s+/)[1];
        await handleLink(msg, apiKey);
      } else if (text === '/stop') {
        await handleStop(msg);
      } else if (text === '/start_notifications') {
        await handleStartNotifications(msg);
      } else if (text === '/status') {
        await handleStatus(msg);
      } else if (text === '/unlink') {
        await handleUnlink(msg);
      }
    }
  } catch (error) {
    console.error('[TG-BOT] Polling error:', error.message);
    // Wait before retrying on error
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function startPolling() {
  console.log('[TG-BOT] ✅ Bot started, polling for updates...');

  // Set bot commands
  await tgRequest('setMyCommands', {
    commands: [
      { command: 'start', description: 'Начать работу' },
      { command: 'link', description: 'Привязать аккаунт R5' },
      { command: 'status', description: 'Проверить статус' },
      { command: 'stop', description: 'Отключить уведомления' },
      { command: 'start_notifications', description: 'Включить уведомления' },
      { command: 'unlink', description: 'Отвязать аккаунт' },
    ],
  });

  while (true) {
    await pollUpdates();
  }
}

// ============================================================================
// Start
// ============================================================================

startPolling().catch(error => {
  console.error('[TG-BOT] ❌ Fatal error:', error);
  process.exit(1);
});

// Heartbeat
setInterval(() => {
  console.log('[TG-BOT] 💓 Heartbeat:', new Date().toISOString());
}, 60000 * 5);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[TG-BOT] 🛑 Shutting down...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[TG-BOT] 🛑 Shutting down (SIGINT)...');
  await pool.end();
  process.exit(0);
});
