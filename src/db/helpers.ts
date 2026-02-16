/**
 * PostgreSQL Database Helpers
 *
 * Type-safe database operations for all tables.
 * Replaces Firebase Firestore queries with PostgreSQL.
 */

import { query, transaction, getClient } from './client';
import type { PoolClient } from 'pg';
import { getNextSlotTime } from '@/lib/auto-sequence-templates';

// Export complaint helpers
export * from './complaint-helpers';

// ============================================================================
// Types (matching PostgreSQL schema and old Firebase structure)
// ============================================================================

export type UpdateStatus = "idle" | "pending" | "success" | "error";
export type ChatTag = 'untagged' | 'active' | 'successful' | 'unsuccessful' | 'no_reply' | 'completed'
  | 'deletion_candidate' | 'deletion_offered' | 'deletion_agreed' | 'deletion_confirmed' | 'refund_requested' | 'spam';
export type ChatStatus = 'inbox' | 'in_progress' | 'awaiting_reply' | 'closed';
export type CompletionReason = 'review_deleted' | 'review_upgraded' | 'no_reply' | 'old_dialog' | 'not_our_issue' | 'spam' | 'negative' | 'other';
export type StoreStatus = 'active' | 'paused' | 'stopped' | 'trial' | 'archived';
export type Marketplace = 'wb' | 'ozon';

export interface User {
  id: string;
  email: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string; // References users.id
  deepseek_api_key?: string | null;
  openai_api_key?: string | null;
  api_key?: string | null;
  ai_concurrency?: number;
  prompt_chat_reply?: string | null;
  prompt_chat_tag?: string | null;
  prompt_question_reply?: string | null;
  prompt_review_complaint?: string | null;
  prompt_review_reply?: string | null;
  assistant_chat_reply?: string | null;
  assistant_chat_tag?: string | null;
  assistant_question_reply?: string | null;
  assistant_review_complaint?: string | null;
  assistant_review_reply?: string | null;
  no_reply_messages?: string[] | null;
  no_reply_trigger_phrase?: string | null;
  no_reply_stop_message?: string | null;
  no_reply_messages2?: string[] | null;
  no_reply_trigger_phrase2?: string | null;
  no_reply_stop_message2?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  marketplace: Marketplace;
  api_token: string;
  content_api_token?: string | null;
  feedbacks_api_token?: string | null;
  chat_api_token?: string | null;
  // OZON credentials (only for marketplace='ozon')
  ozon_client_id?: string | null;
  ozon_api_key?: string | null;
  ozon_subscription?: string | null;
  owner_id: string;
  status: StoreStatus;
  product_count?: number; // NEW: Computed product count
  last_product_update_status?: UpdateStatus | null;
  last_product_update_date?: string | null;
  last_product_update_error?: string | null;
  last_review_update_status?: UpdateStatus | null;
  last_review_update_date?: string | null;
  last_review_update_error?: string | null;
  last_chat_update_status?: UpdateStatus | null;
  last_chat_update_date?: string | null;
  last_chat_update_next?: string | null;
  last_chat_update_error?: string | null;
  last_question_update_status?: UpdateStatus | null;
  last_question_update_date?: string | null;
  last_question_update_error?: string | null;
  total_reviews?: number;
  total_chats?: number;
  chat_tag_counts?: Record<ChatTag, number> | null;
  ai_instructions?: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkStatus = 'not_working' | 'active' | 'paused' | 'completed';

export interface Product {
  id: string;
  name: string;
  marketplace: Marketplace;
  wb_product_id: string;
  vendor_code: string;
  price?: number | null;
  image_url?: string | null;
  description?: string | null;
  // OZON identifiers (only for marketplace='ozon')
  ozon_product_id?: number | null;
  ozon_offer_id?: string | null;
  ozon_sku?: string | null;
  ozon_fbs_sku?: string | null;
  store_id: string;
  owner_id: string;
  review_count?: number;
  wb_api_data?: any | null; // JSONB
  last_review_update_date?: string | null;
  is_active?: boolean; // Deprecated: use work_status instead
  work_status?: WorkStatus; // NEW: Replaces is_active
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  store_id: string;
  marketplace: Marketplace;
  rating: number;
  text?: string | null;
  pros?: string | null;
  cons?: string | null;
  author: string;
  date: string;
  owner_id: string;
  answer?: any | null; // JSONB
  photo_links?: any | null; // JSONB
  video?: any | null; // JSONB
  supplier_feedback_valuation?: number | null;
  supplier_product_valuation?: number | null;
  complaint_text?: string | null;
  complaint_sent_date?: string | null;
  draft_reply?: string | null;
  wb_feedback_id?: string | null;  // For WB API integration
  review_status_wb?: string | null; // visible / deleted (DB enum)
  // OZON-specific fields
  ozon_review_status?: string | null; // PROCESSED / UNPROCESSED
  ozon_order_status?: string | null;
  is_rating_participant?: boolean | null;
  likes_amount?: number | null;
  dislikes_amount?: number | null;
  ozon_sku?: string | null;
  ozon_comment_id?: string | null;
  ozon_comments_amount?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  store_id: string;
  owner_id: string;
  marketplace: Marketplace;
  client_name: string;
  product_nm_id?: string | null;
  product_name?: string | null;
  product_vendor_code?: string | null;
  last_message_date?: string | null;
  last_message_text?: string | null;
  last_message_sender?: 'client' | 'seller' | null;
  reply_sign: string;
  tag?: ChatTag | null;
  status: ChatStatus;
  status_updated_at?: string | null;
  completion_reason?: CompletionReason | null;
  draft_reply?: string | null;
  draft_reply_thread_id?: string | null;
  draft_reply_generated_at?: string | null;
  draft_reply_edited?: boolean | null;
  message_count?: number;
  // OZON-specific fields
  ozon_chat_type?: string | null; // BUYER_SELLER, SELLER_SUPPORT, UNSPECIFIED
  ozon_chat_status?: string | null; // OPENED, CLOSED
  ozon_unread_count?: number | null;
  ozon_last_message_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  store_id: string;
  owner_id: string;
  marketplace: Marketplace;
  text?: string | null;
  sender: 'client' | 'seller';
  timestamp: string;
  download_id?: string | null;
  is_auto_reply?: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  store_id: string;
  owner_id: string;
  text: string;
  created_date: string;
  state: string;
  answer?: any | null; // JSONB
  product_details: any; // JSONB
  was_viewed: boolean;
  is_answered: boolean;
  created_at: string;
  updated_at: string;
}

export interface AILog {
  id: string;
  store_id: string;
  owner_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  prompt?: string | null;
  response?: string | null;
  model?: string | null;
  tokens_used?: number | null;
  cost?: number | null;
  error?: string | null;
  metadata?: any | null; // JSONB
  created_at: string;
}

// ============================================================================
// Users
// ============================================================================

export async function getUsers(): Promise<User[]> {
  const result = await query<User>('SELECT * FROM users ORDER BY created_at DESC');
  return result.rows;
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

export async function createUser(user: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
  const result = await query<User>(
    `INSERT INTO users (id, email, is_approved, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING *`,
    [user.id, user.email, user.is_approved]
  );
  return result.rows[0];
}

export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.is_approved !== undefined) {
    fields.push(`is_approved = $${paramIndex++}`);
    values.push(updates.is_approved);
  }

  if (fields.length === 0) return getUserById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

// ============================================================================
// User Settings
// ============================================================================

export async function getUserSettings(userId?: string): Promise<UserSettings | null> {
  let result;
  if (userId) {
    result = await query<UserSettings>('SELECT * FROM user_settings WHERE id = $1', [userId]);
  } else {
    // Get first user settings (for single-user mode)
    result = await query<UserSettings>('SELECT * FROM user_settings LIMIT 1');
  }
  return result.rows[0] || null;
}

export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'id' | 'created_at'>>
): Promise<UserSettings | null> {
  // Get old settings BEFORE update (to invalidate old API key if changed)
  const oldSettings = await getUserSettings(userId);

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Map all possible fields
  const fieldMappings: [keyof typeof updates, string][] = [
    ['deepseek_api_key', 'deepseek_api_key'],
    ['openai_api_key', 'openai_api_key'],
    ['api_key', 'api_key'],
    ['ai_concurrency', 'ai_concurrency'],
    ['prompt_chat_reply', 'prompt_chat_reply'],
    ['prompt_chat_tag', 'prompt_chat_tag'],
    ['prompt_question_reply', 'prompt_question_reply'],
    ['prompt_review_complaint', 'prompt_review_complaint'],
    ['prompt_review_reply', 'prompt_review_reply'],
    ['assistant_chat_reply', 'assistant_chat_reply'],
    ['assistant_chat_tag', 'assistant_chat_tag'],
    ['assistant_question_reply', 'assistant_question_reply'],
    ['assistant_review_complaint', 'assistant_review_complaint'],
    ['assistant_review_reply', 'assistant_review_reply'],
    ['no_reply_messages', 'no_reply_messages'],
    ['no_reply_trigger_phrase', 'no_reply_trigger_phrase'],
    ['no_reply_stop_message', 'no_reply_stop_message'],
    ['no_reply_messages2', 'no_reply_messages2'],
    ['no_reply_trigger_phrase2', 'no_reply_trigger_phrase2'],
    ['no_reply_stop_message2', 'no_reply_stop_message2'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return getUserSettings(userId);

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query<UserSettings>(
    `UPDATE user_settings SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  const updatedSettings = result.rows[0] || null;

  // Invalidate cache for old API key (if it existed and was changed)
  if (oldSettings?.api_key && updates.api_key && oldSettings.api_key !== updates.api_key) {
    // Dynamic import to avoid circular dependency
    import('@/lib/api-key-cache').then(({ invalidateCache }) => {
      invalidateCache(oldSettings.api_key!);
    });
  }

  // Also invalidate cache if ANY setting changed (to reflect new settings immediately)
  if (updatedSettings?.api_key) {
    import('@/lib/api-key-cache').then(({ invalidateCache }) => {
      invalidateCache(updatedSettings.api_key!);
    });
  }

  return updatedSettings;
}

// ============================================================================
// Stores
// ============================================================================

export async function getStores(ownerId?: string): Promise<Store[]> {
  // Include status and compute product_count from products table
  const selectQuery = `
    SELECT
      s.id, s.name, s.marketplace, s.api_token, s.content_api_token, s.feedbacks_api_token, s.chat_api_token,
      s.ozon_client_id, s.ozon_api_key, s.ozon_subscription,
      s.owner_id, s.status,
      s.last_product_update_status, s.last_product_update_date, s.last_product_update_error,
      s.last_review_update_status, s.last_review_update_date, s.last_review_update_error,
      s.last_chat_update_status, s.last_chat_update_date, s.last_chat_update_next, s.last_chat_update_error,
      s.last_question_update_status, s.last_question_update_date, s.last_question_update_error,
      s.created_at, s.updated_at,
      (SELECT COUNT(*)::int FROM products WHERE store_id = s.id) as product_count,
      (SELECT COUNT(*)::int FROM reviews WHERE store_id = s.id) as total_reviews,
      (SELECT COUNT(*)::int FROM chats WHERE store_id = s.id) as total_chats,
      (SELECT jsonb_object_agg(tag, count) FROM (
        SELECT tag, COUNT(*)::int as count FROM chats WHERE store_id = s.id GROUP BY tag
      ) t) as chat_tag_counts
    FROM stores s
  `;

  let result;
  if (ownerId) {
    result = await query<Store>(
      `${selectQuery} WHERE s.owner_id = $1 ORDER BY s.created_at DESC`,
      [ownerId]
    );
  } else {
    result = await query<Store>(`${selectQuery} ORDER BY s.created_at DESC`);
  }

  // Convert count fields from strings to numbers (PostgreSQL driver returns bigint as string)
  return result.rows.map(store => ({
    ...store,
    product_count: typeof store.product_count === 'string' ? parseInt(store.product_count, 10) : store.product_count,
    total_reviews: typeof store.total_reviews === 'string' ? parseInt(store.total_reviews, 10) : store.total_reviews,
    total_chats: typeof store.total_chats === 'string' ? parseInt(store.total_chats, 10) : store.total_chats,
  }));
}

export async function getStoreById(id: string): Promise<Store | null> {
  const result = await query<Store>('SELECT * FROM stores WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getAllStores(marketplace?: Marketplace): Promise<Store[]> {
  // Only return active stores for CRON jobs and automated operations
  if (marketplace) {
    const result = await query<Store>(
      "SELECT * FROM stores WHERE status = 'active' AND marketplace = $1 ORDER BY name",
      [marketplace]
    );
    return result.rows;
  }
  const result = await query<Store>(
    "SELECT * FROM stores WHERE status = 'active' ORDER BY name"
  );
  return result.rows;
}

export async function createStore(store: Omit<Store, 'created_at' | 'updated_at' | 'product_count'>): Promise<Store> {
  const result = await query<Store>(
    `INSERT INTO stores (
      id, name, marketplace, api_token, content_api_token, feedbacks_api_token, chat_api_token,
      ozon_client_id, ozon_api_key, ozon_subscription,
      owner_id, status, total_reviews, total_chats, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    RETURNING *`,
    [
      store.id,
      store.name,
      store.marketplace || 'wb',
      store.api_token,
      store.content_api_token || null,
      store.feedbacks_api_token || null,
      store.chat_api_token || null,
      store.ozon_client_id || null,
      store.ozon_api_key || null,
      store.ozon_subscription || null,
      store.owner_id,
      store.status || 'active',
      store.total_reviews || 0,
      store.total_chats || 0,
    ]
  );
  return result.rows[0];
}

export async function updateStore(
  id: string,
  updates: Partial<Omit<Store, 'id' | 'created_at'>>
): Promise<Store | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMappings: [keyof typeof updates, string][] = [
    ['name', 'name'],
    ['api_token', 'api_token'],
    ['content_api_token', 'content_api_token'],
    ['feedbacks_api_token', 'feedbacks_api_token'],
    ['chat_api_token', 'chat_api_token'],
    ['owner_id', 'owner_id'],
    ['status', 'status'],
    ['last_product_update_status', 'last_product_update_status'],
    ['last_product_update_date', 'last_product_update_date'],
    ['last_product_update_error', 'last_product_update_error'],
    ['last_review_update_status', 'last_review_update_status'],
    ['last_review_update_date', 'last_review_update_date'],
    ['last_review_update_error', 'last_review_update_error'],
    ['last_chat_update_status', 'last_chat_update_status'],
    ['last_chat_update_date', 'last_chat_update_date'],
    ['last_chat_update_next', 'last_chat_update_next'],
    ['last_chat_update_error', 'last_chat_update_error'],
    ['last_question_update_status', 'last_question_update_status'],
    ['last_question_update_date', 'last_question_update_date'],
    ['last_question_update_error', 'last_question_update_error'],
    ['total_reviews', 'total_reviews'],
    ['total_chats', 'total_chats'],
    ['chat_tag_counts', 'chat_tag_counts'],
    ['ai_instructions', 'ai_instructions'],
    ['marketplace', 'marketplace'],
    ['ozon_client_id', 'ozon_client_id'],
    ['ozon_api_key', 'ozon_api_key'],
    ['ozon_subscription', 'ozon_subscription'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return getStoreById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Store>(
    `UPDATE stores SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteStore(id: string): Promise<boolean> {
  const result = await query('DELETE FROM stores WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Products
// ============================================================================

export async function getProducts(storeId: string): Promise<Product[]> {
  const result = await query<Product>(
    `SELECT id, name, marketplace, wb_product_id, vendor_code, price, image_url, description,
            ozon_product_id, ozon_offer_id, ozon_sku, ozon_fbs_sku,
            store_id, owner_id, review_count, wb_api_data, last_review_update_date,
            is_active, created_at, updated_at
     FROM products WHERE store_id = $1 ORDER BY created_at DESC`,
    [storeId]
  );
  return result.rows;
}

export async function getProductById(id: string): Promise<Product | null> {
  const result = await query<Product>('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getProductByWbId(wbProductId: string, storeId: string): Promise<Product | null> {
  const result = await query<Product>(
    'SELECT * FROM products WHERE wb_product_id = $1 AND store_id = $2',
    [wbProductId, storeId]
  );
  return result.rows[0] || null;
}

/**
 * Get multiple products by their IDs (batch fetch for optimization)
 * Used to load only the products needed for current page of reviews
 */
export async function getProductsByIds(productIds: string[]): Promise<Product[]> {
  if (!productIds || productIds.length === 0) {
    return [];
  }
  const result = await query<Product>(
    'SELECT * FROM products WHERE id = ANY($1)',
    [productIds]
  );
  return result.rows;
}

export async function createProduct(product: Omit<Product, 'created_at' | 'updated_at'>): Promise<Product> {
  const result = await query<Product>(
    `INSERT INTO products (
      id, name, marketplace, wb_product_id, vendor_code, price, image_url, description,
      ozon_product_id, ozon_offer_id, ozon_sku, ozon_fbs_sku,
      store_id, owner_id, review_count, wb_api_data, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
    RETURNING *`,
    [
      product.id,
      product.name,
      product.marketplace || 'wb',
      product.wb_product_id,
      product.vendor_code,
      product.price || null,
      product.image_url || null,
      product.description || null,
      product.ozon_product_id || null,
      product.ozon_offer_id || null,
      product.ozon_sku || null,
      product.ozon_fbs_sku || null,
      product.store_id,
      product.owner_id,
      product.review_count || 0,
      product.wb_api_data || null,
      product.is_active !== false,
    ]
  );
  return result.rows[0];
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'created_at'>>
): Promise<Product | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMappings: [keyof typeof updates, string][] = [
    ['name', 'name'],
    ['marketplace', 'marketplace'],
    ['wb_product_id', 'wb_product_id'],
    ['vendor_code', 'vendor_code'],
    ['price', 'price'],
    ['image_url', 'image_url'],
    ['description', 'description'],
    ['ozon_product_id', 'ozon_product_id'],
    ['ozon_offer_id', 'ozon_offer_id'],
    ['ozon_sku', 'ozon_sku'],
    ['ozon_fbs_sku', 'ozon_fbs_sku'],
    ['store_id', 'store_id'],
    ['owner_id', 'owner_id'],
    ['review_count', 'review_count'],
    ['wb_api_data', 'wb_api_data'],
    ['last_review_update_date', 'last_review_update_date'],
    ['is_active', 'is_active'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return getProductById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Product>(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function upsertProduct(product: Omit<Product, 'created_at' | 'updated_at'>): Promise<Product> {
  const result = await query<Product>(
    `INSERT INTO products (
      id, name, marketplace, wb_product_id, vendor_code, price, image_url, description,
      ozon_product_id, ozon_offer_id, ozon_sku, ozon_fbs_sku,
      store_id, owner_id, review_count, wb_api_data, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      wb_product_id = EXCLUDED.wb_product_id,
      vendor_code = EXCLUDED.vendor_code,
      price = EXCLUDED.price,
      image_url = EXCLUDED.image_url,
      description = EXCLUDED.description,
      ozon_product_id = EXCLUDED.ozon_product_id,
      ozon_offer_id = EXCLUDED.ozon_offer_id,
      ozon_sku = EXCLUDED.ozon_sku,
      ozon_fbs_sku = EXCLUDED.ozon_fbs_sku,
      review_count = EXCLUDED.review_count,
      wb_api_data = EXCLUDED.wb_api_data,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING *`,
    [
      product.id,
      product.name,
      product.marketplace || 'wb',
      product.wb_product_id,
      product.vendor_code,
      product.price || null,
      product.image_url || null,
      product.description || null,
      product.ozon_product_id || null,
      product.ozon_offer_id || null,
      product.ozon_sku || null,
      product.ozon_fbs_sku || null,
      product.store_id,
      product.owner_id,
      product.review_count || 0,
      product.wb_api_data || null,
      product.is_active !== false,
    ]
  );
  return result.rows[0];
}

// ============================================================================
// Reviews
// ============================================================================

export async function getReviews(productId: string): Promise<Review[]> {
  const result = await query<Review>(
    'SELECT * FROM reviews WHERE product_id = $1 ORDER BY date DESC',
    [productId]
  );
  return result.rows;
}

export async function getReviewsByStore(storeId: string, limit?: number): Promise<Review[]> {
  const sql = limit
    ? 'SELECT * FROM reviews WHERE store_id = $1 ORDER BY date DESC LIMIT $2'
    : 'SELECT * FROM reviews WHERE store_id = $1 ORDER BY date DESC';
  const params = limit ? [storeId, limit] : [storeId];
  const result = await query<Review>(sql, params);
  return result.rows;
}

export async function getReviewById(id: string): Promise<Review | null> {
  const result = await query<Review>('SELECT * FROM reviews WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function createReview(review: Omit<Review, 'created_at' | 'updated_at'>): Promise<Review> {
  const result = await query<Review>(
    `INSERT INTO reviews (
      id, product_id, store_id, marketplace, rating, text, pros, cons, author, date, owner_id,
      answer, photo_links, video, supplier_feedback_valuation, supplier_product_valuation,
      complaint_text, complaint_sent_date, draft_reply,
      ozon_review_status, ozon_order_status, is_rating_participant, ozon_sku,
      ozon_comment_id, ozon_comments_amount, likes_amount, dislikes_amount,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW())
    RETURNING *`,
    [
      review.id,
      review.product_id,
      review.store_id,
      review.marketplace || 'wb',
      review.rating,
      review.text || null,
      review.pros || null,
      review.cons || null,
      review.author,
      review.date,
      review.owner_id,
      review.answer || null,
      review.photo_links || null,
      review.video || null,
      review.supplier_feedback_valuation || null,
      review.supplier_product_valuation || null,
      review.complaint_text || null,
      review.complaint_sent_date || null,
      review.draft_reply || null,
      review.ozon_review_status || null,
      review.ozon_order_status || null,
      review.is_rating_participant ?? null,
      review.ozon_sku || null,
      review.ozon_comment_id || null,
      review.ozon_comments_amount ?? null,
      review.likes_amount ?? null,
      review.dislikes_amount ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateReview(
  id: string,
  updates: Partial<Omit<Review, 'id' | 'created_at'>>
): Promise<Review | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMappings: [keyof typeof updates, string][] = [
    ['rating', 'rating'],
    ['text', 'text'],
    ['pros', 'pros'],
    ['cons', 'cons'],
    ['author', 'author'],
    ['date', 'date'],
    ['answer', 'answer'],
    ['photo_links', 'photo_links'],
    ['video', 'video'],
    ['supplier_feedback_valuation', 'supplier_feedback_valuation'],
    ['supplier_product_valuation', 'supplier_product_valuation'],
    ['complaint_text', 'complaint_text'],
    ['complaint_sent_date', 'complaint_sent_date'],
    ['draft_reply', 'draft_reply'],
    ['ozon_review_status', 'ozon_review_status'],
    ['ozon_order_status', 'ozon_order_status'],
    ['is_rating_participant', 'is_rating_participant'],
    ['ozon_sku', 'ozon_sku'],
    ['ozon_comment_id', 'ozon_comment_id'],
    ['ozon_comments_amount', 'ozon_comments_amount'],
    ['likes_amount', 'likes_amount'],
    ['dislikes_amount', 'dislikes_amount'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return getReviewById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Review>(
    `UPDATE reviews SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function upsertReview(review: Omit<Review, 'created_at' | 'updated_at'>): Promise<Review> {
  const result = await query<Review>(
    `INSERT INTO reviews (
      id, product_id, store_id, marketplace, rating, text, pros, cons, author, date, owner_id,
      answer, photo_links, video, supplier_feedback_valuation, supplier_product_valuation,
      complaint_text, complaint_sent_date, draft_reply,
      ozon_review_status, ozon_order_status, is_rating_participant, ozon_sku,
      ozon_comment_id, ozon_comments_amount, likes_amount, dislikes_amount,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      rating = EXCLUDED.rating,
      text = EXCLUDED.text,
      pros = EXCLUDED.pros,
      cons = EXCLUDED.cons,
      author = EXCLUDED.author,
      date = EXCLUDED.date,
      answer = EXCLUDED.answer,
      photo_links = EXCLUDED.photo_links,
      video = EXCLUDED.video,
      supplier_feedback_valuation = EXCLUDED.supplier_feedback_valuation,
      supplier_product_valuation = EXCLUDED.supplier_product_valuation,
      complaint_text = COALESCE(EXCLUDED.complaint_text, reviews.complaint_text),
      complaint_sent_date = COALESCE(EXCLUDED.complaint_sent_date, reviews.complaint_sent_date),
      draft_reply = COALESCE(EXCLUDED.draft_reply, reviews.draft_reply),
      review_status_wb = CASE
        WHEN reviews.review_status_wb = 'deleted' THEN 'visible'::review_status_wb
        ELSE reviews.review_status_wb
      END,
      deleted_from_wb_at = CASE
        WHEN reviews.review_status_wb = 'deleted' THEN NULL
        ELSE reviews.deleted_from_wb_at
      END,
      ozon_review_status = COALESCE(EXCLUDED.ozon_review_status, reviews.ozon_review_status),
      ozon_order_status = COALESCE(EXCLUDED.ozon_order_status, reviews.ozon_order_status),
      is_rating_participant = COALESCE(EXCLUDED.is_rating_participant, reviews.is_rating_participant),
      ozon_sku = COALESCE(EXCLUDED.ozon_sku, reviews.ozon_sku),
      ozon_comment_id = COALESCE(EXCLUDED.ozon_comment_id, reviews.ozon_comment_id),
      ozon_comments_amount = COALESCE(EXCLUDED.ozon_comments_amount, reviews.ozon_comments_amount),
      likes_amount = COALESCE(EXCLUDED.likes_amount, reviews.likes_amount),
      dislikes_amount = COALESCE(EXCLUDED.dislikes_amount, reviews.dislikes_amount),
      updated_at = NOW()
    RETURNING *`,
    [
      review.id,
      review.product_id,
      review.store_id,
      review.marketplace || 'wb',
      review.rating,
      review.text !== undefined && review.text !== null ? review.text : '',
      review.pros || '',
      review.cons || '',
      review.author,
      review.date,
      review.owner_id,
      review.answer ? JSON.stringify(review.answer) : null,
      review.photo_links ? JSON.stringify(review.photo_links) : null,
      review.video ? JSON.stringify(review.video) : null,
      review.supplier_feedback_valuation || null,
      review.supplier_product_valuation || null,
      review.complaint_text || null,
      review.complaint_sent_date || null,
      review.draft_reply || null,
      review.ozon_review_status || null,
      review.ozon_order_status || null,
      review.is_rating_participant ?? null,
      review.ozon_sku || null,
      review.ozon_comment_id || null,
      review.ozon_comments_amount ?? null,
      review.likes_amount ?? null,
      review.dislikes_amount ?? null,
    ]
  );
  return result.rows[0];
}

// ============================================================================
// Chats
// ============================================================================

export async function getChats(storeId: string): Promise<Chat[]> {
  const result = await query<Chat>(
    'SELECT * FROM chats WHERE store_id = $1 ORDER BY last_message_date DESC NULLS LAST',
    [storeId]
  );
  return result.rows;
}

export async function getChatById(id: string): Promise<Chat | null> {
  const sql = `
    SELECT
      c.*,
      p.name as product_name,
      p.vendor_code as product_vendor_code
    FROM chats c
    LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND c.store_id = p.store_id
    WHERE c.id = $1
  `;
  const result = await query<Chat>(sql, [id]);
  return result.rows[0] || null;
}

export async function createChat(chat: Omit<Chat, 'created_at' | 'updated_at'>): Promise<Chat> {
  const result = await query<Chat>(
    `INSERT INTO chats (
      id, store_id, owner_id, marketplace, client_name, product_nm_id, product_name, product_vendor_code,
      last_message_date, last_message_text, last_message_sender, reply_sign, status,
      draft_reply, draft_reply_thread_id,
      ozon_chat_type, ozon_chat_status, ozon_unread_count, ozon_last_message_id,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
    RETURNING *`,
    [
      chat.id,
      chat.store_id,
      chat.owner_id,
      chat.marketplace || 'wb',
      chat.client_name,
      chat.product_nm_id || null,
      chat.product_name || null,
      chat.product_vendor_code || null,
      chat.last_message_date || null,
      chat.last_message_text || null,
      chat.last_message_sender || null,
      chat.reply_sign,
      chat.status || 'inbox',
      chat.draft_reply || null,
      chat.draft_reply_thread_id || null,
      chat.ozon_chat_type || null,
      chat.ozon_chat_status || null,
      chat.ozon_unread_count ?? null,
      chat.ozon_last_message_id || null,
    ]
  );
  return result.rows[0];
}

export async function updateChat(
  id: string,
  updates: Partial<Omit<Chat, 'id' | 'created_at'>>
): Promise<Chat | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMappings: [keyof typeof updates, string][] = [
    ['client_name', 'client_name'],
    ['product_nm_id', 'product_nm_id'],
    ['product_name', 'product_name'],
    ['product_vendor_code', 'product_vendor_code'],
    ['last_message_date', 'last_message_date'],
    ['last_message_text', 'last_message_text'],
    ['last_message_sender', 'last_message_sender'],
    ['reply_sign', 'reply_sign'],
    ['tag', 'tag'],
    ['status', 'status'], // NEW: Kanban status
    ['status_updated_at', 'status_updated_at'], // NEW
    ['completion_reason', 'completion_reason'], // NEW: Why chat was closed
    ['draft_reply', 'draft_reply'],
    ['draft_reply_thread_id', 'draft_reply_thread_id'],
    ['draft_reply_generated_at', 'draft_reply_generated_at'],
    ['draft_reply_edited', 'draft_reply_edited'],
    ['ozon_chat_type', 'ozon_chat_type'],
    ['ozon_chat_status', 'ozon_chat_status'],
    ['ozon_unread_count', 'ozon_unread_count'],
    ['ozon_last_message_id', 'ozon_last_message_id'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return getChatById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Chat>(
    `UPDATE chats SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function upsertChat(chat: Omit<Chat, 'created_at' | 'updated_at'>): Promise<Chat> {
  const result = await query<Chat>(
    `INSERT INTO chats (
      id, store_id, owner_id, marketplace, client_name, product_nm_id, product_name, product_vendor_code,
      last_message_date, last_message_text, last_message_sender, reply_sign, status,
      draft_reply, draft_reply_thread_id,
      ozon_chat_type, ozon_chat_status, ozon_unread_count, ozon_last_message_id,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      client_name = EXCLUDED.client_name,
      product_nm_id = EXCLUDED.product_nm_id,
      product_name = EXCLUDED.product_name,
      product_vendor_code = EXCLUDED.product_vendor_code,
      last_message_date = EXCLUDED.last_message_date,
      last_message_text = EXCLUDED.last_message_text,
      last_message_sender = EXCLUDED.last_message_sender,
      reply_sign = EXCLUDED.reply_sign,
      status = EXCLUDED.status,
      draft_reply = EXCLUDED.draft_reply,
      draft_reply_thread_id = EXCLUDED.draft_reply_thread_id,
      ozon_chat_type = COALESCE(EXCLUDED.ozon_chat_type, chats.ozon_chat_type),
      ozon_chat_status = COALESCE(EXCLUDED.ozon_chat_status, chats.ozon_chat_status),
      ozon_unread_count = COALESCE(EXCLUDED.ozon_unread_count, chats.ozon_unread_count),
      ozon_last_message_id = COALESCE(EXCLUDED.ozon_last_message_id, chats.ozon_last_message_id),
      updated_at = NOW()
    RETURNING *`,
    [
      chat.id,
      chat.store_id,
      chat.owner_id,
      chat.marketplace || 'wb',
      chat.client_name,
      chat.product_nm_id || null,
      chat.product_name || null,
      chat.product_vendor_code || null,
      chat.last_message_date || null,
      chat.last_message_text || null,
      chat.last_message_sender || null,
      chat.reply_sign,
      chat.status || 'inbox',
      chat.draft_reply || null,
      chat.draft_reply_thread_id || null,
      chat.ozon_chat_type || null,
      chat.ozon_chat_status || null,
      chat.ozon_unread_count ?? null,
      chat.ozon_last_message_id || null,
    ]
  );
  return result.rows[0];
}

// ============================================================================
// Chat Messages
// ============================================================================

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  const result = await query<ChatMessage>(
    'SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY timestamp ASC',
    [chatId]
  );
  return result.rows;
}

export interface DialogueSummary {
  chat_id: string;
  client_name: string;
  tag: string;
  product_name: string | null;
  messages: { sender: string; text: string }[];
}

/**
 * Fetch N most recent dialogues (chats + their messages) for a store.
 * Used for AI analysis of common patterns in customer conversations.
 */
export async function getRecentDialogues(storeId: string, limit = 500): Promise<DialogueSummary[]> {
  // Step 1: Get recent chats with at least 2 messages
  const chatsResult = await query<{ id: string; client_name: string; tag: string; product_name: string | null }>(
    `SELECT c.id, c.client_name, c.tag, c.product_name
     FROM chats c
     WHERE c.store_id = $1
       AND c.last_message_date IS NOT NULL
       AND (SELECT COUNT(*) FROM chat_messages cm WHERE cm.chat_id = c.id) >= 2
     ORDER BY c.last_message_date DESC
     LIMIT $2`,
    [storeId, limit]
  );

  if (chatsResult.rows.length === 0) return [];

  const chatIds = chatsResult.rows.map(c => c.id);

  // Step 2: Get all messages for these chats
  const messagesResult = await query<{ chat_id: string; sender: string; text: string | null }>(
    `SELECT chat_id, sender, text
     FROM chat_messages
     WHERE chat_id = ANY($1)
     ORDER BY chat_id, timestamp ASC`,
    [chatIds]
  );

  // Step 3: Group messages by chat
  const messagesByChatId = new Map<string, { sender: string; text: string }[]>();
  for (const msg of messagesResult.rows) {
    if (!msg.text) continue;
    if (!messagesByChatId.has(msg.chat_id)) messagesByChatId.set(msg.chat_id, []);
    messagesByChatId.get(msg.chat_id)!.push({ sender: msg.sender, text: msg.text });
  }

  return chatsResult.rows
    .filter(c => messagesByChatId.has(c.id))
    .map(c => ({
      chat_id: c.id,
      client_name: c.client_name,
      tag: c.tag,
      product_name: c.product_name,
      messages: messagesByChatId.get(c.id)!,
    }));
}

export async function createChatMessage(message: Omit<ChatMessage, 'created_at'>): Promise<ChatMessage> {
  const result = await query<ChatMessage>(
    `INSERT INTO chat_messages (
      id, chat_id, store_id, owner_id, marketplace, text, sender, timestamp, download_id, is_auto_reply, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING *`,
    [
      message.id,
      message.chat_id,
      message.store_id,
      message.owner_id,
      message.marketplace || 'wb',
      message.text || null,
      message.sender,
      message.timestamp,
      message.download_id || null,
      message.is_auto_reply || false,
    ]
  );
  return result.rows[0];
}

export async function upsertChatMessage(message: Omit<ChatMessage, 'created_at'>): Promise<ChatMessage> {
  const result = await query<ChatMessage>(
    `INSERT INTO chat_messages (
      id, chat_id, store_id, owner_id, marketplace, text, sender, timestamp, download_id, is_auto_reply, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (id) DO UPDATE SET
      text = EXCLUDED.text,
      sender = EXCLUDED.sender,
      timestamp = EXCLUDED.timestamp,
      download_id = EXCLUDED.download_id,
      is_auto_reply = EXCLUDED.is_auto_reply
    RETURNING *`,
    [
      message.id,
      message.chat_id,
      message.store_id,
      message.owner_id,
      message.marketplace || 'wb',
      message.text || null,
      message.sender,
      message.timestamp,
      message.download_id || null,
      message.is_auto_reply || false,
    ]
  );
  return result.rows[0];
}

// ============================================================================
// Questions
// ============================================================================

export async function getQuestions(storeId: string): Promise<Question[]> {
  const result = await query<Question>(
    'SELECT * FROM questions WHERE store_id = $1 ORDER BY created_date DESC',
    [storeId]
  );
  return result.rows;
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const result = await query<Question>('SELECT * FROM questions WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function createQuestion(question: Omit<Question, 'created_at' | 'updated_at'>): Promise<Question> {
  const result = await query<Question>(
    `INSERT INTO questions (
      id, store_id, owner_id, text, created_date, state, answer, product_details,
      was_viewed, is_answered, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING *`,
    [
      question.id,
      question.store_id,
      question.owner_id,
      question.text,
      question.created_date,
      question.state,
      question.answer || null,
      question.product_details,
      question.was_viewed,
      question.is_answered,
    ]
  );
  return result.rows[0];
}

export async function updateQuestion(
  id: string,
  updates: Partial<Omit<Question, 'id' | 'created_at'>>
): Promise<Question | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMappings: [keyof typeof updates, string][] = [
    ['text', 'text'],
    ['state', 'state'],
    ['answer', 'answer'],
    ['was_viewed', 'was_viewed'],
    ['is_answered', 'is_answered'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return getQuestionById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Question>(
    `UPDATE questions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function upsertQuestion(question: Omit<Question, 'created_at' | 'updated_at'>): Promise<Question> {
  const result = await query<Question>(
    `INSERT INTO questions (
      id, store_id, owner_id, text, created_date, state, answer, product_details,
      was_viewed, is_answered, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      text = EXCLUDED.text,
      state = EXCLUDED.state,
      answer = EXCLUDED.answer,
      was_viewed = EXCLUDED.was_viewed,
      is_answered = EXCLUDED.is_answered,
      updated_at = NOW()
    RETURNING *`,
    [
      question.id,
      question.store_id,
      question.owner_id,
      question.text,
      question.created_date,
      question.state,
      question.answer || null,
      question.product_details,
      question.was_viewed,
      question.is_answered,
    ]
  );
  return result.rows[0];
}

// ============================================================================
// AI Logs
// ============================================================================

export async function getAILogs(storeId: string, limit: number = 100): Promise<AILog[]> {
  const result = await query<AILog>(
    'SELECT * FROM ai_logs WHERE store_id = $1 ORDER BY created_at DESC LIMIT $2',
    [storeId, limit]
  );
  return result.rows;
}

export async function createAILog(log: Omit<AILog, 'id' | 'created_at'>): Promise<AILog> {
  const result = await query<AILog>(
    `INSERT INTO ai_logs (
      id, store_id, owner_id, entity_type, entity_id, action, prompt, response,
      model, tokens_used, cost, error, metadata, created_at
    ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    RETURNING *`,
    [
      log.store_id,
      log.owner_id,
      log.entity_type,
      log.entity_id,
      log.action,
      log.prompt || null,
      log.response || null,
      log.model || null,
      log.tokens_used || null,
      log.cost || null,
      log.error || null,
      log.metadata || null,
    ]
  );
  return result.rows[0];
}

export async function updateAILog(
  id: string,
  updates: Partial<Pick<AILog, 'response' | 'error' | 'tokens_used' | 'cost' | 'metadata'>>
): Promise<AILog | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMappings: [keyof typeof updates, string][] = [
    ['response', 'response'],
    ['error', 'error'],
    ['tokens_used', 'tokens_used'],
    ['cost', 'cost'],
    ['metadata', 'metadata'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) {
    // No fields to update, just fetch the log
    const result = await query<AILog>('SELECT * FROM ai_logs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  values.push(id);

  const result = await query<AILog>(
    `UPDATE ai_logs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Get store statistics (counts)
 */
export async function getStoreStats(storeId: string) {
  const result = await query<{
    total_products: string;
    total_reviews: string;
    total_chats: string;
    total_questions: string;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM products WHERE store_id = $1) as total_products,
      (SELECT COUNT(*) FROM reviews WHERE store_id = $1) as total_reviews,
      (SELECT COUNT(*) FROM chats WHERE store_id = $1) as total_chats,
      (SELECT COUNT(*) FROM questions WHERE store_id = $1) as total_questions
    `,
    [storeId]
  );

  return {
    totalProducts: parseInt(result.rows[0].total_products, 10),
    totalReviews: parseInt(result.rows[0].total_reviews, 10),
    totalChats: parseInt(result.rows[0].total_chats, 10),
    totalQuestions: parseInt(result.rows[0].total_questions, 10),
  };
}

/**
 * Get review rating statistics for a store (used for filter badges)
 * Returns total count for each rating (1-5) regardless of filters
 */
export async function getReviewRatingStats(storeId: string): Promise<Record<number, number>> {
  const result = await query<{ rating: number; count: string }>(
    `SELECT rating, COUNT(*) as count
     FROM reviews
     WHERE store_id = $1
     GROUP BY rating
     ORDER BY rating`,
    [storeId]
  );

  // Initialize with zeros for all ratings
  const stats: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  // Fill in actual counts
  result.rows.forEach(row => {
    if (row.rating >= 1 && row.rating <= 5) {
      stats[row.rating] = parseInt(row.count, 10);
    }
  });

  return stats;
}

/**
 * Verify API key and return user settings
 */
export async function verifyApiKey(apiKey: string): Promise<UserSettings | null> {
  const result = await query<UserSettings>(
    `SELECT id, deepseek_api_key, openai_api_key, api_key, ai_concurrency,
            prompt_chat_reply, prompt_chat_tag, prompt_question_reply,
            prompt_review_complaint, prompt_review_reply,
            assistant_chat_reply, assistant_chat_tag, assistant_question_reply,
            assistant_review_complaint, assistant_review_reply,
            no_reply_messages, no_reply_trigger_phrase, no_reply_stop_message,
            no_reply_messages2, no_reply_trigger_phrase2, no_reply_stop_message2,
            created_at, updated_at
     FROM user_settings WHERE api_key = $1`,
    [apiKey]
  );
  return result.rows[0] || null;
}

// ============================================================================
// Additional helper for pagination
// ============================================================================

/**
 * Build WHERE clauses for review queries.
 * Shared between count and data queries to ensure consistency.
 * @param forCountOnly - When true, uses denormalized r.complaint_status for hasComplaint filter (avoids JOIN)
 */
function buildReviewFilterClauses(
  storeId: string,
  options?: ReviewsFilterOptions,
  forCountOnly = false
): { whereClauses: string[]; params: any[]; nextParamIndex: number } {
  const whereClauses: string[] = ['r.store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by rating
  if (options?.rating && options.rating !== 'all') {
    if (options.rating === '1-2') {
      whereClauses.push(`r.rating <= 2`);
    } else if (options.rating === '3') {
      whereClauses.push(`r.rating = 3`);
    } else if (options.rating === '4-5') {
      whereClauses.push(`r.rating >= 4`);
    } else {
      const ratings = options.rating.split(',').map(r => parseInt(r.trim(), 10)).filter(r => !isNaN(r));
      if (ratings.length > 0) {
        whereClauses.push(`r.rating = ANY($${paramIndex})`);
        params.push(ratings);
        paramIndex++;
      }
    }
  }

  // Filter by answer status
  if (options?.hasAnswer && options.hasAnswer !== 'all') {
    if (options.hasAnswer === 'yes') {
      whereClauses.push(`r.answer IS NOT NULL`);
    } else if (options.hasAnswer === 'no') {
      whereClauses.push(`r.answer IS NULL`);
    }
  }

  // Filter by complaint (hasComplaint)
  if (options?.hasComplaint && options.hasComplaint !== 'all') {
    if (forCountOnly) {
      // Use denormalized r.complaint_status to avoid LEFT JOIN on review_complaints
      if (options.hasComplaint === 'with') {
        whereClauses.push(`r.complaint_status IN ('sent', 'pending', 'approved', 'rejected')`);
      } else if (options.hasComplaint === 'draft') {
        whereClauses.push(`r.complaint_status = 'draft'`);
      } else if (options.hasComplaint === 'without') {
        whereClauses.push(`(r.complaint_status IS NULL OR r.complaint_status = 'not_sent')`);
      }
    } else {
      // Use JOIN columns for precise filtering in data queries
      if (options.hasComplaint === 'with') {
        whereClauses.push(`rc.sent_at IS NOT NULL`);
      } else if (options.hasComplaint === 'draft') {
        whereClauses.push(`rc.complaint_text IS NOT NULL AND rc.sent_at IS NULL`);
      } else if (options.hasComplaint === 'without') {
        whereClauses.push(`rc.complaint_text IS NULL`);
      }
    }
  }

  // Filter by product ID — exact match using storeId_nmId format (index-friendly)
  if (options?.productId && options.productId.trim()) {
    whereClauses.push(`r.product_id = $${paramIndex}`);
    params.push(`${storeId}_${options.productId.trim()}`);
    paramIndex++;
  }

  // Filter by multiple product IDs — exact match using ANY (index-friendly)
  if (options?.productIds && options.productIds.length > 0) {
    whereClauses.push(`r.product_id = ANY($${paramIndex})`);
    params.push(options.productIds.map(id => `${storeId}_${id}`));
    paramIndex++;
  }

  // Filter by product work_status
  if (options?.productStatus && options.productStatus !== 'all') {
    const statuses = options.productStatus.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      whereClauses.push(`EXISTS (SELECT 1 FROM products WHERE products.id = r.product_id AND products.work_status = $${paramIndex})`);
      params.push(statuses[0]);
      paramIndex++;
    } else if (statuses.length > 1) {
      whereClauses.push(`EXISTS (SELECT 1 FROM products WHERE products.id = r.product_id AND products.work_status = ANY($${paramIndex}))`);
      params.push(statuses);
      paramIndex++;
    }
  } else if (options?.activeOnly) {
    whereClauses.push(`EXISTS (SELECT 1 FROM products WHERE products.id = r.product_id AND products.work_status = 'active')`);
  }

  // Search in text
  if (options?.search && options.search.trim()) {
    whereClauses.push(`(r.text ILIKE $${paramIndex} OR r.pros ILIKE $${paramIndex} OR r.cons ILIKE $${paramIndex})`);
    params.push(`%${options.search.trim()}%`);
    paramIndex++;
  }

  // Status filters
  if (options?.reviewStatusWB && options.reviewStatusWB !== 'all') {
    const statuses = options.reviewStatusWB.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      whereClauses.push(`r.review_status_wb = $${paramIndex}`);
      params.push(statuses[0]);
      paramIndex++;
    } else if (statuses.length > 1) {
      whereClauses.push(`r.review_status_wb = ANY($${paramIndex})`);
      params.push(statuses);
      paramIndex++;
    }
  }

  if (options?.productStatusByReview && options.productStatusByReview !== 'all') {
    whereClauses.push(`r.product_status_by_review = $${paramIndex}`);
    params.push(options.productStatusByReview);
    paramIndex++;
  }

  if (options?.complaintStatus && options.complaintStatus !== 'all') {
    const statuses = options.complaintStatus.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      whereClauses.push(`r.complaint_status = $${paramIndex}`);
      params.push(statuses[0]);
      paramIndex++;
    } else if (statuses.length > 1) {
      whereClauses.push(`r.complaint_status = ANY($${paramIndex})`);
      params.push(statuses);
      paramIndex++;
    }
  }

  return { whereClauses, params, nextParamIndex: paramIndex };
}

/**
 * Get reviews for a store with pagination and filtering support
 */
export type ReviewsFilterOptions = {
  limit?: number;
  offset?: number;
  rating?: string; // 'all' | '1,2,3' (comma-separated) | '1-2' | '3' | '4-5'
  hasAnswer?: string; // 'all' | 'yes' | 'no'
  hasComplaint?: string; // 'all' | 'with' | 'draft' | 'without'
  productId?: string; // product ID to filter by (single)
  productIds?: string[]; // product IDs to filter by (multiple)
  activeOnly?: boolean; // legacy: filter by is_product_active
  productStatus?: string; // 'all' | 'active' | 'not_working' | 'paused' | 'completed' (supports comma-separated)
  search?: string;
  reviewStatusWB?: string; // 'all' | 'visible' | 'unpublished' | 'excluded'
  productStatusByReview?: string; // 'all' | 'purchased' | 'refused' | 'not_specified'
  complaintStatus?: string; // 'all' | 'not_sent' | 'draft' | 'sent' | 'approved' | 'rejected' | 'pending'
};

export type ReviewsWithCount = {
  reviews: Review[];
  totalCount: number;
};

/**
 * Get reviews for a store with pagination and filters
 * OPTIMIZED: Uses COUNT(*) OVER() to get total count in single query
 */
export async function getReviewsByStoreWithPagination(
  storeId: string,
  options?: ReviewsFilterOptions
): Promise<ReviewsWithCount> {
  // Build WHERE clauses separately for count (no JOIN) and data (with JOIN)
  const countFilter = buildReviewFilterClauses(storeId, options, true);
  const dataFilter = buildReviewFilterClauses(storeId, options, false);

  // COUNT query: lightweight — no JOIN, no ORDER BY, no data columns
  const countSql = `
    SELECT COUNT(*) as cnt
    FROM reviews r
    WHERE ${countFilter.whereClauses.join(' AND ')}
  `;

  // DATA query: full data with complaint JOIN, ORDER BY, LIMIT/OFFSET
  const dataParams = [...dataFilter.params];
  let dataParamIdx = dataFilter.nextParamIndex;
  let dataSql = `
    SELECT
      r.*,
      rc.id as complaint_id,
      rc.complaint_text,
      rc.reason_id as complaint_reason_id,
      rc.reason_name as complaint_category,
      COALESCE(r.complaint_status::text, rc.status, 'not_sent') as complaint_status,
      rc.generated_at as complaint_generated_at,
      rc.sent_at as complaint_sent_date,
      rc.regenerated_count
    FROM reviews r
    LEFT JOIN review_complaints rc ON r.id = rc.review_id
    WHERE ${dataFilter.whereClauses.join(' AND ')}
    ORDER BY r.date DESC
  `;

  if (options?.limit !== undefined) {
    dataSql += ` LIMIT $${dataParamIdx++}`;
    dataParams.push(options.limit);
  }

  if (options?.offset !== undefined) {
    dataSql += ` OFFSET $${dataParamIdx}`;
    dataParams.push(options.offset);
  }

  // Run count and data queries in parallel for maximum performance
  const [countResult, dataResult] = await Promise.all([
    query<{ cnt: string }>(countSql, countFilter.params),
    query<Review>(dataSql, dataParams),
  ]);

  const totalCount = parseInt(countResult.rows[0].cnt, 10);
  const reviews = dataResult.rows as Review[];

  return { reviews, totalCount };
}

/**
 * Get total count of reviews for a store with filters
 * @deprecated Use getReviewsByStoreWithPagination which returns { reviews, totalCount }
 */
export async function getReviewsCount(
  storeId: string,
  options?: {
    rating?: string;
    hasAnswer?: string;
    hasComplaint?: string;
    productId?: string;
    productIds?: string[];
    activeOnly?: boolean;
    productStatus?: string;
    search?: string;
    reviewStatusWB?: string;
    productStatusByReview?: string;
    complaintStatus?: string;
  }
): Promise<number> {
  const { whereClauses, params } = buildReviewFilterClauses(storeId, options as ReviewsFilterOptions, true);
  const sql = `SELECT COUNT(*) as count FROM reviews r WHERE ${whereClauses.join(' AND ')}`;
  const result = await query<{ count: string }>(sql, params);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get chats for a store with pagination support
 */
export async function getChatsByStoreWithPagination(
  storeId: string,
  options?: { limit?: number; offset?: number; status?: ChatStatus; sender?: 'client' | 'seller'; tag?: string; search?: string; hasDraft?: boolean }
): Promise<Chat[]> {
  const whereClauses: string[] = ['c.store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by status (NEW - Kanban)
  if (options?.status) {
    whereClauses.push(`c.status = $${paramIndex++}`);
    params.push(options.status);
  }

  // Filter by last message sender (NEW - for sender filter)
  if (options?.sender && options.sender !== 'all') {
    whereClauses.push(`c.last_message_sender = $${paramIndex++}`);
    params.push(options.sender);
  }

  // Filter by tag (AI classification)
  if (options?.tag && options.tag !== 'all') {
    whereClauses.push(`c.tag = $${paramIndex++}`);
    params.push(options.tag);
  }

  // Filter by draft reply (NEW - for draft filter)
  if (options?.hasDraft) {
    whereClauses.push(`c.draft_reply IS NOT NULL AND c.draft_reply != ''`);
  }

  // Search in last message text or client name
  if (options?.search && options.search.trim()) {
    whereClauses.push(`(c.last_message_text ILIKE $${paramIndex} OR c.client_name ILIKE $${paramIndex})`);
    params.push(`%${options.search.trim()}%`);
    paramIndex++;
  }

  let sql = `
    SELECT
      c.*,
      p.name as product_name,
      p.vendor_code as product_vendor_code,
      (SELECT COUNT(*)::int FROM chat_messages WHERE chat_id = c.id) as message_count
    FROM chats c
    LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND c.store_id = p.store_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY c.last_message_date DESC NULLS LAST
  `;

  if (options?.limit !== undefined) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset !== undefined) {
    sql += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  const result = await query<Chat>(sql, params);
  return result.rows;
}

/**
 * Get total count of chats for a store with filters
 */
export async function getChatsCount(
  storeId: string,
  options?: {
    status?: ChatStatus;
    sender?: 'client' | 'seller';
    tag?: string;
    search?: string;
    hasDraft?: boolean;
  }
): Promise<number> {
  const whereClauses: string[] = ['store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by status (NEW - Kanban)
  if (options?.status) {
    whereClauses.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }

  // Filter by last message sender (NEW - for sender filter)
  if (options?.sender && options.sender !== 'all') {
    whereClauses.push(`last_message_sender = $${paramIndex++}`);
    params.push(options.sender);
  }

  // Filter by tag (AI classification)
  if (options?.tag && options.tag !== 'all') {
    whereClauses.push(`tag = $${paramIndex++}`);
    params.push(options.tag);
  }

  // Filter by draft reply (NEW - for draft filter)
  if (options?.hasDraft) {
    whereClauses.push(`draft_reply IS NOT NULL AND draft_reply != ''`);
  }

  // Search in last message text
  if (options?.search && options.search.trim()) {
    whereClauses.push(`last_message_text ILIKE $${paramIndex++}`);
    params.push(`%${options.search.trim()}%`);
  }

  const sql = `SELECT COUNT(*) as count FROM chats WHERE ${whereClauses.join(' AND ')}`;
  const result = await query<{ count: string }>(sql, params);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get AI logs with pagination and filtering
 */
export async function getAILogsWithPagination(
  storeId: string,
  options?: {
    limit?: number;
    offset?: number;
    hasError?: string; // 'all' | 'yes' | 'no'
  }
): Promise<AILog[]> {
  const whereClauses: string[] = ['store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by error status
  if (options?.hasError && options.hasError !== 'all') {
    if (options.hasError === 'yes') {
      whereClauses.push(`error IS NOT NULL`);
    } else if (options.hasError === 'no') {
      whereClauses.push(`error IS NULL`);
    }
  }

  let sql = `SELECT * FROM ai_logs WHERE ${whereClauses.join(' AND ')} ORDER BY created_at DESC`;

  if (options?.limit !== undefined) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset !== undefined) {
    sql += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  const result = await query<AILog>(sql, params);
  return result.rows;
}

/**
 * Get total count of AI logs for a store with filters
 */
export async function getAILogsCount(
  storeId: string,
  options?: {
    hasError?: string;
  }
): Promise<number> {
  const whereClauses: string[] = ['store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by error status
  if (options?.hasError && options.hasError !== 'all') {
    if (options.hasError === 'yes') {
      whereClauses.push(`error IS NOT NULL`);
    } else if (options.hasError === 'no') {
      whereClauses.push(`error IS NULL`);
    }
  }

  const sql = `SELECT COUNT(*) as count FROM ai_logs WHERE ${whereClauses.join(' AND')}`;
  const result = await query<{ count: string }>(sql, params);
  return parseInt(result.rows[0].count, 10);
}

// ============================================================================
// Review Detail Page Helpers
// ============================================================================

/**
 * Update review draft reply
 */
export async function updateReviewDraftReply(
  reviewId: string,
  draftReply: string
): Promise<Review | null> {
  return updateReview(reviewId, { draft_reply: draftReply });
}

/**
 * Send review reply to WB API
 * NOTE: This updates the local DB. Actual WB API call should be done in API route.
 */
export async function markReviewReplySent(
  reviewId: string,
  replyText: string
): Promise<Review | null> {
  const review = await getReviewById(reviewId);
  if (!review) return null;

  // Update answer field with reply data
  const answerData = {
    text: replyText,
    sentAt: new Date().toISOString(),
  };

  return updateReview(reviewId, {
    answer: answerData,
    draft_reply: null, // Clear draft after sending
  });
}

/**
 * Update review draft complaint
 */
export async function updateReviewComplaint(
  reviewId: string,
  complaintText: string
): Promise<Review | null> {
  return updateReview(reviewId, { complaint_text: complaintText });
}

/**
 * Mark complaint as sent
 */
export async function markReviewComplaintSent(
  reviewId: string
): Promise<Review | null> {
  return updateReview(reviewId, {
    complaint_sent_date: new Date().toISOString(),
  });
}


// ============================================================================
// Chat Detail Page Helpers
// ============================================================================

/**
 * Update chat tag (AI classification)
 */
export async function updateChatTag(
  chatId: string,
  tag: ChatTag
): Promise<Chat | null> {
  return updateChat(chatId, { tag });
}

/**
 * Update chat status (NEW - for Kanban Board)
 */
export async function updateChatStatus(
  chatId: string,
  status: ChatStatus
): Promise<Chat | null> {
  return updateChat(chatId, {
    status,
    status_updated_at: new Date().toISOString()
  });
}

/**
 * Transition stale in_progress chats to awaiting_reply.
 * Moves chats where seller was last to reply and it's been > N days.
 * Returns number of chats transitioned.
 */
export async function transitionStaleInProgressChats(days: number = 2): Promise<number> {
  const result = await query(
    `UPDATE chats
     SET status = 'awaiting_reply', status_updated_at = NOW(), updated_at = NOW()
     WHERE status = 'in_progress'
       AND last_message_sender = 'seller'
       AND last_message_date < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [days]
  );
  return result.rowCount || 0;
}

// ============================================================================
// Product Rules
// ============================================================================

export type ChatStrategy = 'upgrade_to_5' | 'delete' | 'both';

export interface ProductRule {
  id: string;
  product_id: string;
  store_id: string;

  // Жалобы
  submit_complaints: boolean;
  complaint_rating_1: boolean;
  complaint_rating_2: boolean;
  complaint_rating_3: boolean;
  complaint_rating_4: boolean;

  // Чаты
  work_in_chats: boolean;
  chat_rating_1: boolean;
  chat_rating_2: boolean;
  chat_rating_3: boolean;
  chat_rating_4: boolean;
  chat_strategy?: ChatStrategy; // NEW: Strategy for chat work

  // Компенсация
  offer_compensation: boolean;
  compensation_type?: string | null;
  max_compensation?: string | null;
  compensation_by?: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Get product rule by product ID
 */
export async function getProductRule(productId: string): Promise<ProductRule | null> {
  const result = await query<ProductRule>(
    'SELECT * FROM product_rules WHERE product_id = $1',
    [productId]
  );
  return result.rows[0] || null;
}

/**
 * Get product rules by store + WB product NM ID (for AI context enrichment)
 */
export async function getProductRulesByNmId(storeId: string, productNmId: string): Promise<ProductRule | null> {
  const result = await query<ProductRule>(
    `SELECT pr.* FROM product_rules pr
     JOIN products p ON p.id = pr.product_id
     WHERE p.store_id = $1 AND p.wb_product_id = $2`,
    [storeId, productNmId]
  );
  return result.rows[0] || null;
}

/**
 * Get all product rules for a store
 */
export async function getProductRulesByStore(storeId: string): Promise<ProductRule[]> {
  const result = await query<ProductRule>(
    'SELECT * FROM product_rules WHERE store_id = $1',
    [storeId]
  );
  return result.rows;
}

/**
 * Create or update product rule
 */
export async function upsertProductRule(
  rule: Omit<ProductRule, 'id' | 'created_at' | 'updated_at'>
): Promise<ProductRule> {
  const result = await query<ProductRule>(
    `INSERT INTO product_rules (
      product_id, store_id,
      submit_complaints, complaint_rating_1, complaint_rating_2, complaint_rating_3, complaint_rating_4,
      work_in_chats, chat_rating_1, chat_rating_2, chat_rating_3, chat_rating_4, chat_strategy,
      offer_compensation, compensation_type, max_compensation, compensation_by,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
    ON CONFLICT (product_id) DO UPDATE SET
      submit_complaints = EXCLUDED.submit_complaints,
      complaint_rating_1 = EXCLUDED.complaint_rating_1,
      complaint_rating_2 = EXCLUDED.complaint_rating_2,
      complaint_rating_3 = EXCLUDED.complaint_rating_3,
      complaint_rating_4 = EXCLUDED.complaint_rating_4,
      work_in_chats = EXCLUDED.work_in_chats,
      chat_rating_1 = EXCLUDED.chat_rating_1,
      chat_rating_2 = EXCLUDED.chat_rating_2,
      chat_rating_3 = EXCLUDED.chat_rating_3,
      chat_rating_4 = EXCLUDED.chat_rating_4,
      chat_strategy = EXCLUDED.chat_strategy,
      offer_compensation = EXCLUDED.offer_compensation,
      compensation_type = EXCLUDED.compensation_type,
      max_compensation = EXCLUDED.max_compensation,
      compensation_by = EXCLUDED.compensation_by,
      updated_at = NOW()
    RETURNING *`,
    [
      rule.product_id,
      rule.store_id,
      rule.submit_complaints,
      rule.complaint_rating_1,
      rule.complaint_rating_2,
      rule.complaint_rating_3,
      rule.complaint_rating_4,
      rule.work_in_chats,
      rule.chat_rating_1,
      rule.chat_rating_2,
      rule.chat_rating_3,
      rule.chat_rating_4,
      rule.chat_strategy || 'both',
      rule.offer_compensation,
      rule.compensation_type || null,
      rule.max_compensation || null,
      rule.compensation_by || null,
    ]
  );
  return result.rows[0];
}

/**
 * Delete product rule
 */
export async function deleteProductRule(productId: string): Promise<boolean> {
  const result = await query('DELETE FROM product_rules WHERE product_id = $1', [productId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get products with their rules
 * Returns all products for a store with their associated rules (or null if no rule exists)
 * Includes work_status (new status field)
 */
export async function getProductsWithRules(storeId: string): Promise<Array<Product & { rule: ProductRule | null }>> {
  const result = await query<Product & { rule: string }>(
    `SELECT
      p.id, p.name, p.marketplace, p.wb_product_id, p.vendor_code, p.price, p.image_url,
      p.description, p.ozon_product_id, p.ozon_offer_id, p.ozon_sku, p.ozon_fbs_sku,
      p.store_id, p.owner_id, p.review_count, p.wb_api_data,
      p.last_review_update_date, p.is_active, p.work_status,
      p.created_at, p.updated_at,
      row_to_json(pr.*) as rule
    FROM products p
    LEFT JOIN product_rules pr ON p.id = pr.product_id
    WHERE p.store_id = $1
    ORDER BY p.created_at DESC`,
    [storeId]
  );

  return result.rows.map(row => ({
    ...row,
    rule: row.rule ? (typeof row.rule === 'string' ? JSON.parse(row.rule) : row.rule) : null
  }));
}

/**
 * Update product work status
 * NEW: For Product Management Center
 */
export async function updateProductWorkStatus(
  productId: string,
  workStatus: WorkStatus
): Promise<Product | null> {
  const result = await query<Product>(
    `UPDATE products
     SET work_status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [workStatus, productId]
  );
  return result.rows[0] || null;
}

/**
 * Get review IDs without complaints for a store
 * Used by CRON job for auto-complaint generation
 *
 * @param storeId - Store ID
 * @param maxRating - Maximum rating to include (default: 3, includes 1-3 stars)
 * @param limit - Maximum number of reviews to return (default: 50)
 * @param activeProductsOnly - Filter only reviews for active products (default: true)
 * @returns Array of review IDs that don't have complaints yet
 */
export async function getReviewsWithoutComplaints(
  storeId: string,
  maxRating: number = 3,
  limit: number = 50,
  activeProductsOnly: boolean = true
): Promise<string[]> {
  let sql = `
    SELECT r.id
    FROM reviews r
    LEFT JOIN review_complaints rc ON rc.review_id = r.id
    INNER JOIN products p ON p.id = r.product_id
    LEFT JOIN product_rules pr ON pr.product_id = p.id
    WHERE r.store_id = $1
      AND r.rating <= $2
      AND rc.id IS NULL
      AND (r.complaint_status IS NULL OR r.complaint_status = 'not_sent')
      AND r.date >= '2023-10-01'
      AND r.marketplace = 'wb'`;

  // Filter only active products (for CRON auto-generation)
  if (activeProductsOnly) {
    sql += `
      AND p.is_active = true`;
  }

  // NEW: Check product_rules to ensure complaint generation is allowed
  // Only include reviews where:
  // 1. submit_complaints = true for the product
  // 2. The specific rating is allowed (complaint_rating_1/2/3/4 = true)
  sql += `
      AND pr.submit_complaints = true
      AND (
        (r.rating = 1 AND pr.complaint_rating_1 = true) OR
        (r.rating = 2 AND pr.complaint_rating_2 = true) OR
        (r.rating = 3 AND pr.complaint_rating_3 = true) OR
        (r.rating = 4 AND pr.complaint_rating_4 = true)
      )`;

  sql += `
    ORDER BY r.created_at DESC
    LIMIT $3`;

  const result = await query<{ id: string }>(sql, [storeId, maxRating, limit]);
  return result.rows.map(row => row.id);
}

// ============================================================================
// Auto-Complaint Generation Helpers
// ============================================================================

/**
 * Get reviews for a product with optional filtering
 * Used by auto-complaint triggers when product/store status changes
 *
 * @param productId - Product ID
 * @param options - Filter options
 * @returns Promise<Review[]> - Array of reviews
 */
export async function getReviewsForProduct(
  productId: string,
  options?: {
    hasComplaint?: boolean;
    minRating?: number;
    maxRating?: number;
  }
): Promise<Review[]> {
  let sql = `
    SELECT r.*
    FROM reviews r
    LEFT JOIN review_complaints rc ON rc.review_id = r.id
    WHERE r.product_id = $1
  `;

  if (options?.hasComplaint === false) {
    sql += ` AND rc.id IS NULL`;
  } else if (options?.hasComplaint === true) {
    sql += ` AND rc.id IS NOT NULL`;
  }

  if (options?.minRating) {
    sql += ` AND r.rating >= ${options.minRating}`;
  }

  if (options?.maxRating) {
    sql += ` AND r.rating <= ${options.maxRating}`;
  }

  sql += ` ORDER BY r.created_at DESC`;

  const result = await query<Review>(sql, [productId]);
  return result.rows;
}

// ============================================================================
// Manager Tasks (Task Management Center)
// ============================================================================

export type TaskEntityType = 'review' | 'chat' | 'question';
export type TaskAction = 'generate_complaint' | 'submit_complaint' | 'check_complaint' | 'reply_to_chat' | 'reply_to_question';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ManagerTask {
  id: string;
  user_id: string;
  store_id: string;
  entity_type: TaskEntityType;
  entity_id: string;
  action: TaskAction;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  completed_at?: string | null;
  title: string;
  description?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get tasks for a user with optional filters
 */
export async function getManagerTasks(
  userId: string,
  options?: {
    storeId?: string;
    status?: TaskStatus;
    entityType?: TaskEntityType;
    action?: TaskAction;
    limit?: number;
    offset?: number;
  }
): Promise<ManagerTask[]> {
  const whereClauses: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (options?.storeId) {
    whereClauses.push(`store_id = $${paramIndex++}`);
    params.push(options.storeId);
  }

  if (options?.status) {
    whereClauses.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }

  if (options?.entityType) {
    whereClauses.push(`entity_type = $${paramIndex++}`);
    params.push(options.entityType);
  }

  if (options?.action) {
    whereClauses.push(`action = $${paramIndex++}`);
    params.push(options.action);
  }

  let sql = `
    SELECT * FROM manager_tasks
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      due_date ASC NULLS LAST,
      created_at DESC
  `;

  if (options?.limit !== undefined) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset !== undefined) {
    sql += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  const result = await query<ManagerTask>(sql, params);
  return result.rows;
}

/**
 * Get task statistics for a user
 */
export async function getManagerTaskStats(userId: string) {
  const result = await query<{
    total_tasks: string;
    pending_tasks: string;
    in_progress_tasks: string;
    overdue_tasks: string;
    complaints_tasks: string;
    chats_tasks: string;
  }>(
    `SELECT
      COUNT(*) as total_tasks,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
      COUNT(*) FILTER (WHERE status != 'completed' AND status != 'cancelled' AND due_date < NOW()) as overdue_tasks,
      COUNT(*) FILTER (WHERE action IN ('generate_complaint', 'submit_complaint', 'check_complaint')) as complaints_tasks,
      COUNT(*) FILTER (WHERE action = 'reply_to_chat') as chats_tasks
    FROM manager_tasks
    WHERE user_id = $1 AND status != 'completed' AND status != 'cancelled'`,
    [userId]
  );

  return {
    totalTasks: parseInt(result.rows[0]?.total_tasks || '0', 10),
    pendingTasks: parseInt(result.rows[0]?.pending_tasks || '0', 10),
    inProgressTasks: parseInt(result.rows[0]?.in_progress_tasks || '0', 10),
    overdueTasks: parseInt(result.rows[0]?.overdue_tasks || '0', 10),
    complaintsTasks: parseInt(result.rows[0]?.complaints_tasks || '0', 10),
    chatsTasks: parseInt(result.rows[0]?.chats_tasks || '0', 10),
  };
}

/**
 * Get task by ID
 */
export async function getManagerTaskById(id: string): Promise<ManagerTask | null> {
  const result = await query<ManagerTask>(
    'SELECT * FROM manager_tasks WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a new task
 */
export async function createManagerTask(
  task: Omit<ManagerTask, 'id' | 'created_at' | 'updated_at'>
): Promise<ManagerTask> {
  const result = await query<ManagerTask>(
    `INSERT INTO manager_tasks (
      user_id, store_id, entity_type, entity_id, action, status, priority,
      due_date, title, description, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING *`,
    [
      task.user_id,
      task.store_id,
      task.entity_type,
      task.entity_id,
      task.action,
      task.status || 'pending',
      task.priority || 'normal',
      task.due_date || null,
      task.title,
      task.description || null,
      task.notes || null,
    ]
  );
  return result.rows[0];
}

/**
 * Update a task
 */
export async function updateManagerTask(
  id: string,
  updates: Partial<Omit<ManagerTask, 'id' | 'created_at' | 'updated_at'>>
): Promise<ManagerTask | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMappings: [keyof typeof updates, string][] = [
    ['status', 'status'],
    ['priority', 'priority'],
    ['due_date', 'due_date'],
    ['completed_at', 'completed_at'],
    ['title', 'title'],
    ['description', 'description'],
    ['notes', 'notes'],
  ];

  for (const [key, dbField] of fieldMappings) {
    if (updates[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return getManagerTaskById(id);

  // Auto-set completed_at when status changes to completed
  if (updates.status === 'completed' && !updates.completed_at) {
    fields.push(`completed_at = NOW()`);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<ManagerTask>(
    `UPDATE manager_tasks SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a task
 */
export async function deleteManagerTask(id: string): Promise<boolean> {
  const result = await query('DELETE FROM manager_tasks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get tasks count for filters
 */
export async function getManagerTasksCount(
  userId: string,
  options?: {
    storeId?: string;
    status?: TaskStatus;
    entityType?: TaskEntityType;
    action?: TaskAction;
  }
): Promise<number> {
  const whereClauses: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (options?.storeId) {
    whereClauses.push(`store_id = $${paramIndex++}`);
    params.push(options.storeId);
  }

  if (options?.status) {
    whereClauses.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }

  if (options?.entityType) {
    whereClauses.push(`entity_type = $${paramIndex++}`);
    params.push(options.entityType);
  }

  if (options?.action) {
    whereClauses.push(`action = $${paramIndex++}`);
    params.push(options.action);
  }

  const sql = `SELECT COUNT(*) as count FROM manager_tasks WHERE ${whereClauses.join(' AND ')}`;
  const result = await query<{ count: string }>(sql, params);
  return parseInt(result.rows[0].count, 10);
}

// ============================================================================
// Chat Auto Sequences
// ============================================================================

export interface SequenceMessage {
  day: number;
  text: string;
}

export type AutoSequenceStatus = 'active' | 'paused' | 'completed' | 'stopped';

export interface ChatAutoSequence {
  id: string;
  chat_id: string;
  store_id: string;
  owner_id: string;
  sequence_type: string;
  messages: SequenceMessage[];
  current_step: number;
  max_steps: number;
  status: AutoSequenceStatus;
  stop_reason: string | null;
  started_at: string;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new auto-sequence for a chat
 */
export async function createAutoSequence(
  chatId: string,
  storeId: string,
  ownerId: string,
  messages: SequenceMessage[],
  sequenceType: string = 'no_reply_followup'
): Promise<ChatAutoSequence> {
  const nextSendAt = getNextSlotTime();
  const result = await query<ChatAutoSequence>(
    `INSERT INTO chat_auto_sequences
      (chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [chatId, storeId, ownerId, sequenceType, JSON.stringify(messages), messages.length, nextSendAt]
  );
  return result.rows[0];
}

/**
 * Get active sequence for a chat (if any)
 */
export async function getActiveSequenceForChat(chatId: string): Promise<ChatAutoSequence | null> {
  const result = await query<ChatAutoSequence>(
    `SELECT * FROM chat_auto_sequences WHERE chat_id = $1 AND status = 'active' LIMIT 1`,
    [chatId]
  );
  return result.rows[0] || null;
}

/**
 * Get all pending sequences ready to send (cron job)
 */
export async function getPendingSequences(limit: number = 50): Promise<ChatAutoSequence[]> {
  const result = await query<ChatAutoSequence>(
    `SELECT * FROM chat_auto_sequences
     WHERE status = 'active' AND next_send_at <= NOW()
     ORDER BY next_send_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Advance sequence to next step after sending a message
 */
export async function advanceSequence(id: string): Promise<ChatAutoSequence | null> {
  const nextSendAt = getNextSlotTime();
  const result = await query<ChatAutoSequence>(
    `UPDATE chat_auto_sequences
     SET current_step = current_step + 1,
         last_sent_at = NOW(),
         next_send_at = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, nextSendAt]
  );
  const seq = result.rows[0];
  // Auto-complete if max steps reached
  if (seq && seq.current_step >= seq.max_steps) {
    return completeSequence(id);
  }
  return seq || null;
}

/**
 * Stop a sequence (client replied, stop message, manual)
 */
export async function stopSequence(
  id: string,
  reason: string
): Promise<ChatAutoSequence | null> {
  const result = await query<ChatAutoSequence>(
    `UPDATE chat_auto_sequences
     SET status = 'stopped',
         stop_reason = $2,
         next_send_at = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, reason]
  );
  return result.rows[0] || null;
}

/**
 * Reschedule a sequence to a new send time (without advancing step)
 */
export async function rescheduleSequence(id: string, nextSendAt: string): Promise<void> {
  await query(
    `UPDATE chat_auto_sequences SET next_send_at = $2, updated_at = NOW() WHERE id = $1`,
    [id, nextSendAt]
  );
}

/**
 * Complete a sequence (all messages sent)
 */
export async function completeSequence(id: string): Promise<ChatAutoSequence | null> {
  const result = await query<ChatAutoSequence>(
    `UPDATE chat_auto_sequences
     SET status = 'completed',
         stop_reason = 'max_reached',
         next_send_at = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

// ============================================================================
// Store FAQ (Knowledge Base)
// ============================================================================

export interface StoreFaqEntry {
  id: string;
  store_id: string;
  question: string;
  answer: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getStoreFaq(storeId: string): Promise<StoreFaqEntry[]> {
  const result = await query<StoreFaqEntry>(
    `SELECT * FROM store_faq WHERE store_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [storeId]
  );
  return result.rows;
}

export async function createStoreFaqEntry(
  storeId: string,
  question: string,
  answer: string
): Promise<StoreFaqEntry> {
  const result = await query<StoreFaqEntry>(
    `INSERT INTO store_faq (store_id, question, answer)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [storeId, question, answer]
  );
  return result.rows[0];
}

export async function updateStoreFaqEntry(
  id: string,
  fields: Partial<Pick<StoreFaqEntry, 'question' | 'answer' | 'is_active' | 'sort_order'>>
): Promise<StoreFaqEntry | null> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (fields.question !== undefined) {
    setClauses.push(`question = $${idx++}`);
    values.push(fields.question);
  }
  if (fields.answer !== undefined) {
    setClauses.push(`answer = $${idx++}`);
    values.push(fields.answer);
  }
  if (fields.is_active !== undefined) {
    setClauses.push(`is_active = $${idx++}`);
    values.push(fields.is_active);
  }
  if (fields.sort_order !== undefined) {
    setClauses.push(`sort_order = $${idx++}`);
    values.push(fields.sort_order);
  }

  if (setClauses.length === 0) return null;

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<StoreFaqEntry>(
    `UPDATE store_faq SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteStoreFaqEntry(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM store_faq WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// STORE GUIDES (step-by-step instructions for AI context)
// ============================================================

export interface StoreGuide {
  id: string;
  store_id: string;
  title: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getStoreGuides(storeId: string): Promise<StoreGuide[]> {
  const result = await query(
    `SELECT * FROM store_guides WHERE store_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [storeId]
  );
  return result.rows;
}

export async function createStoreGuide(storeId: string, title: string, content: string): Promise<StoreGuide> {
  const result = await query(
    `INSERT INTO store_guides (store_id, title, content) VALUES ($1, $2, $3) RETURNING *`,
    [storeId, title, content]
  );
  return result.rows[0];
}

export async function updateStoreGuide(
  id: string,
  fields: Partial<Pick<StoreGuide, 'title' | 'content' | 'is_active' | 'sort_order'>>
): Promise<StoreGuide | null> {
  const sets: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (fields.title !== undefined) { sets.push(`title = $${idx++}`); values.push(fields.title); }
  if (fields.content !== undefined) { sets.push(`content = $${idx++}`); values.push(fields.content); }
  if (fields.is_active !== undefined) { sets.push(`is_active = $${idx++}`); values.push(fields.is_active); }
  if (fields.sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); values.push(fields.sort_order); }

  if (sets.length === 0) return null;

  sets.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE store_guides SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteStoreGuide(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM store_guides WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
