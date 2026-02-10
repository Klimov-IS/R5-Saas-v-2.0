/**
 * Telegram Authentication Helpers
 *
 * Validates Telegram Mini App initData using HMAC-SHA256.
 * Used by API routes under /api/telegram/* to authenticate requests.
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import { createHmac } from 'crypto';
import { getTelegramUserByTelegramId } from '@/db/telegram-helpers';

interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface ValidatedInitData {
  user: TelegramUserData;
  authDate: number;
  hash: string;
  queryId?: string;
}

interface AuthResult {
  valid: boolean;
  telegramId?: number;
  userId?: string;      // R5 user ID (if linked)
  telegramUser?: TelegramUserData;
  error?: string;
}

/**
 * Validate Telegram Mini App initData
 *
 * Follows the official Telegram validation algorithm:
 * 1. Parse initData query string
 * 2. Sort params alphabetically (excluding hash)
 * 3. Build data-check-string
 * 4. Compute HMAC-SHA256 with WebAppData secret key
 * 5. Compare with provided hash
 */
export function validateInitData(initData: string, botToken: string): ValidatedInitData | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) return null;

    // Build data-check-string: sort params alphabetically, exclude hash
    const dataCheckParts: string[] = [];
    const sortedKeys = Array.from(params.keys()).filter(k => k !== 'hash').sort();

    for (const key of sortedKeys) {
      dataCheckParts.push(`${key}=${params.get(key)}`);
    }

    const dataCheckString = dataCheckParts.join('\n');

    // Compute secret key: HMAC-SHA256 of bot token with "WebAppData" as key
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

    // Compute hash: HMAC-SHA256 of data-check-string with secret key
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) return null;

    // Parse user data
    const userStr = params.get('user');
    if (!userStr) return null;

    const user: TelegramUserData = JSON.parse(userStr);
    const authDate = parseInt(params.get('auth_date') || '0', 10);

    return { user, authDate, hash, queryId: params.get('query_id') || undefined };
  } catch {
    return null;
  }
}

/**
 * Full authentication: validate initData + check freshness + lookup R5 user
 *
 * @param initData Raw initData string from Telegram
 * @param maxAgeHours Maximum age of auth_date (default 24 hours)
 * @returns AuthResult with R5 user ID if linked
 */
export async function authenticateTelegramRequest(
  initData: string,
  maxAgeHours: number = 24
): Promise<AuthResult> {
  // Dev mode bypass: X-Dev-User-Id header
  if (initData.startsWith('dev_user:') && process.env.TELEGRAM_DEV_MODE === 'true') {
    const devUserId = initData.replace('dev_user:', '');
    console.log('[TG-AUTH] Dev mode: bypassing HMAC for user', devUserId);
    return { valid: true, userId: devUserId };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { valid: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  // Validate HMAC signature
  const validated = validateInitData(initData, botToken);
  if (!validated) {
    return { valid: false, error: 'Invalid initData signature' };
  }

  // Check freshness
  const authAge = Date.now() / 1000 - validated.authDate;
  if (authAge > maxAgeHours * 3600) {
    return { valid: false, error: 'initData expired' };
  }

  // Look up linked R5 user
  const telegramUser = await getTelegramUserByTelegramId(validated.user.id);

  if (!telegramUser) {
    return {
      valid: true,
      telegramId: validated.user.id,
      telegramUser: validated.user,
      error: 'Account not linked',
    };
  }

  return {
    valid: true,
    telegramId: validated.user.id,
    userId: telegramUser.user_id,
    telegramUser: validated.user,
  };
}
