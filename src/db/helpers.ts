/**
 * PostgreSQL Database Helpers
 *
 * Type-safe database operations for all tables.
 * Replaces Firebase Firestore queries with PostgreSQL.
 */

import { query, transaction, getClient } from './client';
import type { PoolClient } from 'pg';

// Export complaint helpers
export * from './complaint-helpers';

// ============================================================================
// Types (matching PostgreSQL schema and old Firebase structure)
// ============================================================================

export type UpdateStatus = "idle" | "pending" | "success" | "error";
export type ChatTag = 'untagged' | 'active' | 'successful' | 'unsuccessful' | 'no_reply' | 'completed';
export type StoreStatus = 'active' | 'paused' | 'stopped' | 'trial' | 'archived';

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
  api_token: string;
  content_api_token?: string | null;
  feedbacks_api_token?: string | null;
  chat_api_token?: string | null;
  owner_id: string;
  status: StoreStatus; // NEW: Store lifecycle status
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
  created_at: string;
  updated_at: string;
}

export type WorkStatus = 'not_working' | 'active' | 'paused' | 'completed';

export interface Product {
  id: string;
  name: string;
  wb_product_id: string;
  vendor_code: string;
  price?: number | null;
  image_url?: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  store_id: string;
  owner_id: string;
  client_name: string;
  product_nm_id?: string | null;
  product_name?: string | null;
  product_vendor_code?: string | null;
  last_message_date?: string | null;
  last_message_text?: string | null;
  last_message_sender?: 'client' | 'seller' | null;
  reply_sign: string;
  tag: ChatTag;
  draft_reply?: string | null;
  draft_reply_thread_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  store_id: string;
  owner_id: string;
  text?: string | null;
  sender: 'client' | 'seller';
  timestamp: string;
  download_id?: string | null;
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
      s.id, s.name, s.api_token, s.content_api_token, s.feedbacks_api_token, s.chat_api_token,
      s.owner_id, s.status,
      s.last_product_update_status, s.last_product_update_date, s.last_product_update_error,
      s.last_review_update_status, s.last_review_update_date, s.last_review_update_error,
      s.last_chat_update_status, s.last_chat_update_date, s.last_chat_update_next, s.last_chat_update_error,
      s.last_question_update_status, s.last_question_update_date, s.last_question_update_error,
      s.total_reviews, s.total_chats, s.chat_tag_counts, s.created_at, s.updated_at,
      (SELECT COUNT(*) FROM products WHERE store_id = s.id) as product_count
    FROM stores s
  `;

  if (ownerId) {
    const result = await query<Store>(
      `${selectQuery} WHERE s.owner_id = $1 ORDER BY s.created_at DESC`,
      [ownerId]
    );
    return result.rows;
  }
  const result = await query<Store>(`${selectQuery} ORDER BY s.created_at DESC`);
  return result.rows;
}

export async function getStoreById(id: string): Promise<Store | null> {
  const result = await query<Store>('SELECT * FROM stores WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getAllStores(): Promise<Store[]> {
  // Only return active stores for CRON jobs and automated operations
  const result = await query<Store>(
    "SELECT * FROM stores WHERE status = 'active' ORDER BY name"
  );
  return result.rows;
}

export async function createStore(store: Omit<Store, 'created_at' | 'updated_at' | 'product_count'>): Promise<Store> {
  const result = await query<Store>(
    `INSERT INTO stores (
      id, name, api_token, content_api_token, feedbacks_api_token, chat_api_token,
      owner_id, status, total_reviews, total_chats, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING *`,
    [
      store.id,
      store.name,
      store.api_token,
      store.content_api_token || null,
      store.feedbacks_api_token || null,
      store.chat_api_token || null,
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
    `SELECT id, name, wb_product_id, vendor_code, price, image_url, store_id, owner_id,
            review_count, wb_api_data, last_review_update_date, is_active, created_at, updated_at
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

export async function createProduct(product: Omit<Product, 'created_at' | 'updated_at'>): Promise<Product> {
  const result = await query<Product>(
    `INSERT INTO products (
      id, name, wb_product_id, vendor_code, price, image_url, store_id, owner_id,
      review_count, wb_api_data, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING *`,
    [
      product.id,
      product.name,
      product.wb_product_id,
      product.vendor_code,
      product.price || null,
      product.image_url || null,
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
    ['wb_product_id', 'wb_product_id'],
    ['vendor_code', 'vendor_code'],
    ['price', 'price'],
    ['image_url', 'image_url'],
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
      id, name, wb_product_id, vendor_code, price, image_url, store_id, owner_id,
      review_count, wb_api_data, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      wb_product_id = EXCLUDED.wb_product_id,
      vendor_code = EXCLUDED.vendor_code,
      price = EXCLUDED.price,
      image_url = EXCLUDED.image_url,
      review_count = EXCLUDED.review_count,
      wb_api_data = EXCLUDED.wb_api_data,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING *`,
    [
      product.id,
      product.name,
      product.wb_product_id,
      product.vendor_code,
      product.price || null,
      product.image_url || null,
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
      id, product_id, store_id, rating, text, pros, cons, author, date, owner_id,
      answer, photo_links, video, supplier_feedback_valuation, supplier_product_valuation,
      complaint_text, complaint_sent_date, draft_reply, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
    RETURNING *`,
    [
      review.id,
      review.product_id,
      review.store_id,
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
      id, product_id, store_id, rating, text, pros, cons, author, date, owner_id,
      answer, photo_links, video, supplier_feedback_valuation, supplier_product_valuation,
      complaint_text, complaint_sent_date, draft_reply, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
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
      updated_at = NOW()
    RETURNING *`,
    [
      review.id,
      review.product_id,
      review.store_id,
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
  const result = await query<Chat>('SELECT * FROM chats WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function createChat(chat: Omit<Chat, 'created_at' | 'updated_at'>): Promise<Chat> {
  const result = await query<Chat>(
    `INSERT INTO chats (
      id, store_id, owner_id, client_name, product_nm_id, product_name, product_vendor_code,
      last_message_date, last_message_text, last_message_sender, reply_sign, tag,
      draft_reply, draft_reply_thread_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    RETURNING *`,
    [
      chat.id,
      chat.store_id,
      chat.owner_id,
      chat.client_name,
      chat.product_nm_id || null,
      chat.product_name || null,
      chat.product_vendor_code || null,
      chat.last_message_date || null,
      chat.last_message_text || null,
      chat.last_message_sender || null,
      chat.reply_sign,
      chat.tag,
      chat.draft_reply || null,
      chat.draft_reply_thread_id || null,
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
    ['draft_reply', 'draft_reply'],
    ['draft_reply_thread_id', 'draft_reply_thread_id'],
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
      id, store_id, owner_id, client_name, product_nm_id, product_name, product_vendor_code,
      last_message_date, last_message_text, last_message_sender, reply_sign, tag,
      draft_reply, draft_reply_thread_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      client_name = EXCLUDED.client_name,
      product_nm_id = EXCLUDED.product_nm_id,
      product_name = EXCLUDED.product_name,
      product_vendor_code = EXCLUDED.product_vendor_code,
      last_message_date = EXCLUDED.last_message_date,
      last_message_text = EXCLUDED.last_message_text,
      last_message_sender = EXCLUDED.last_message_sender,
      reply_sign = EXCLUDED.reply_sign,
      tag = EXCLUDED.tag,
      draft_reply = EXCLUDED.draft_reply,
      draft_reply_thread_id = EXCLUDED.draft_reply_thread_id,
      updated_at = NOW()
    RETURNING *`,
    [
      chat.id,
      chat.store_id,
      chat.owner_id,
      chat.client_name,
      chat.product_nm_id || null,
      chat.product_name || null,
      chat.product_vendor_code || null,
      chat.last_message_date || null,
      chat.last_message_text || null,
      chat.last_message_sender || null,
      chat.reply_sign,
      chat.tag,
      chat.draft_reply || null,
      chat.draft_reply_thread_id || null,
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

export async function createChatMessage(message: Omit<ChatMessage, 'created_at'>): Promise<ChatMessage> {
  const result = await query<ChatMessage>(
    `INSERT INTO chat_messages (
      id, chat_id, store_id, owner_id, text, sender, timestamp, download_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *`,
    [
      message.id,
      message.chat_id,
      message.store_id,
      message.owner_id,
      message.text || null,
      message.sender,
      message.timestamp,
      message.download_id || null,
    ]
  );
  return result.rows[0];
}

export async function upsertChatMessage(message: Omit<ChatMessage, 'created_at'>): Promise<ChatMessage> {
  const result = await query<ChatMessage>(
    `INSERT INTO chat_messages (
      id, chat_id, store_id, owner_id, text, sender, timestamp, download_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (id) DO UPDATE SET
      text = EXCLUDED.text,
      sender = EXCLUDED.sender,
      timestamp = EXCLUDED.timestamp,
      download_id = EXCLUDED.download_id
    RETURNING *`,
    [
      message.id,
      message.chat_id,
      message.store_id,
      message.owner_id,
      message.text || null,
      message.sender,
      message.timestamp,
      message.download_id || null,
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
 * Get reviews for a store with pagination and filtering support
 */
export async function getReviewsByStoreWithPagination(
  storeId: string,
  options?: {
    limit?: number;
    offset?: number;
    rating?: string; // 'all' | '1,2,3' (comma-separated) | '1-2' | '3' | '4-5'
    hasAnswer?: string; // 'all' | 'yes' | 'no'
    hasComplaint?: string; // 'all' | 'with' | 'draft' | 'without'
    productId?: string; // product ID to filter by
    activeOnly?: boolean; // filter by is_product_active
    search?: string;
    reviewStatusWB?: string; // 'all' | 'visible' | 'unpublished' | 'excluded'
    productStatusByReview?: string; // 'all' | 'purchased' | 'refused' | 'not_specified'
    complaintStatus?: string; // 'all' | 'not_sent' | 'draft' | 'sent' | 'approved' | 'rejected' | 'pending'
  }
): Promise<Review[]> {
  const whereClauses: string[] = ['store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by rating (supports comma-separated values like "1,2,3" or single values like "1")
  if (options?.rating && options.rating !== 'all') {
    // Check if it's a range shortcut
    if (options.rating === '1-2') {
      whereClauses.push(`rating <= 2`);
    } else if (options.rating === '3') {
      whereClauses.push(`rating = 3`);
    } else if (options.rating === '4-5') {
      whereClauses.push(`rating >= 4`);
    } else {
      // Check if comma-separated (e.g., "1,2,3") or single number (e.g., "1")
      const ratings = options.rating.split(',').map(r => parseInt(r.trim(), 10)).filter(r => !isNaN(r));
      if (ratings.length > 0) {
        whereClauses.push(`rating = ANY($${paramIndex})`);
        params.push(ratings);
        paramIndex++;
      }
    }
  }

  // Filter by answer status
  if (options?.hasAnswer && options.hasAnswer !== 'all') {
    if (options.hasAnswer === 'yes') {
      whereClauses.push(`answer IS NOT NULL`);
    } else if (options.hasAnswer === 'no') {
      whereClauses.push(`answer IS NULL`);
    }
  }

  // Filter by complaint status
  if (options?.hasComplaint && options.hasComplaint !== 'all') {
    if (options.hasComplaint === 'with') {
      whereClauses.push(`complaint_sent_date IS NOT NULL`);
    } else if (options.hasComplaint === 'draft') {
      whereClauses.push(`complaint_text IS NOT NULL AND complaint_sent_date IS NULL`);
    } else if (options.hasComplaint === 'without') {
      whereClauses.push(`complaint_text IS NULL AND complaint_sent_date IS NULL`);
    }
  }

  // Filter by product ID
  if (options?.productId && options.productId.trim()) {
    whereClauses.push(`product_id = $${paramIndex}`);
    params.push(options.productId.trim());
    paramIndex++;
  }

  // Filter by active products only
  if (options?.activeOnly) {
    whereClauses.push(`EXISTS (SELECT 1 FROM products WHERE products.id = reviews.product_id AND products.is_active = true)`);
  }

  // Search in text
  if (options?.search && options.search.trim()) {
    whereClauses.push(`(text ILIKE $${paramIndex} OR pros ILIKE $${paramIndex} OR cons ILIKE $${paramIndex})`);
    params.push(`%${options.search.trim()}%`);
    paramIndex++;
  }

  // New status filters
  if (options?.reviewStatusWB && options.reviewStatusWB !== 'all') {
    whereClauses.push(`review_status_wb = $${paramIndex}`);
    params.push(options.reviewStatusWB);
    paramIndex++;
  }

  if (options?.productStatusByReview && options.productStatusByReview !== 'all') {
    whereClauses.push(`product_status_by_review = $${paramIndex}`);
    params.push(options.productStatusByReview);
    paramIndex++;
  }

  if (options?.complaintStatus && options.complaintStatus !== 'all') {
    whereClauses.push(`complaint_status = $${paramIndex}`);
    params.push(options.complaintStatus);
    paramIndex++;
  }

  let sql = `SELECT * FROM reviews WHERE ${whereClauses.join(' AND ')} ORDER BY date DESC`;

  if (options?.limit !== undefined) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset !== undefined) {
    sql += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  const result = await query<Review>(sql, params);
  return result.rows;
}

/**
 * Get total count of reviews for a store with filters
 */
export async function getReviewsCount(
  storeId: string,
  options?: {
    rating?: string;
    hasAnswer?: string;
    hasComplaint?: string;
    productId?: string;
    activeOnly?: boolean;
    search?: string;
    reviewStatusWB?: string;
    productStatusByReview?: string;
    complaintStatus?: string;
  }
): Promise<number> {
  const whereClauses: string[] = ['store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by rating (supports comma-separated values like "1,2,3" or single values like "1")
  if (options?.rating && options.rating !== 'all') {
    // Check if it's a range shortcut
    if (options.rating === '1-2') {
      whereClauses.push(`rating <= 2`);
    } else if (options.rating === '3') {
      whereClauses.push(`rating = 3`);
    } else if (options.rating === '4-5') {
      whereClauses.push(`rating >= 4`);
    } else {
      // Check if comma-separated (e.g., "1,2,3") or single number (e.g., "1")
      const ratings = options.rating.split(',').map(r => parseInt(r.trim(), 10)).filter(r => !isNaN(r));
      if (ratings.length > 0) {
        whereClauses.push(`rating = ANY($${paramIndex})`);
        params.push(ratings);
        paramIndex++;
      }
    }
  }

  // Filter by answer status
  if (options?.hasAnswer && options.hasAnswer !== 'all') {
    if (options.hasAnswer === 'yes') {
      whereClauses.push(`answer IS NOT NULL`);
    } else if (options.hasAnswer === 'no') {
      whereClauses.push(`answer IS NULL`);
    }
  }

  // Filter by complaint status
  if (options?.hasComplaint && options.hasComplaint !== 'all') {
    if (options.hasComplaint === 'with') {
      whereClauses.push(`complaint_sent_date IS NOT NULL`);
    } else if (options.hasComplaint === 'draft') {
      whereClauses.push(`complaint_text IS NOT NULL AND complaint_sent_date IS NULL`);
    } else if (options.hasComplaint === 'without') {
      whereClauses.push(`complaint_text IS NULL AND complaint_sent_date IS NULL`);
    }
  }

  // Filter by product ID
  if (options?.productId && options.productId.trim()) {
    whereClauses.push(`product_id = $${paramIndex}`);
    params.push(options.productId.trim());
    paramIndex++;
  }

  // Filter by active products only
  if (options?.activeOnly) {
    whereClauses.push(`EXISTS (SELECT 1 FROM products WHERE products.id = reviews.product_id AND products.is_active = true)`);
  }

  // Search in text
  if (options?.search && options.search.trim()) {
    whereClauses.push(`(text ILIKE $${paramIndex} OR pros ILIKE $${paramIndex} OR cons ILIKE $${paramIndex})`);
    params.push(`%${options.search.trim()}%`);
    paramIndex++;
  }

  // New status filters
  if (options?.reviewStatusWB && options.reviewStatusWB !== 'all') {
    whereClauses.push(`review_status_wb = $${paramIndex}`);
    params.push(options.reviewStatusWB);
    paramIndex++;
  }

  if (options?.productStatusByReview && options.productStatusByReview !== 'all') {
    whereClauses.push(`product_status_by_review = $${paramIndex}`);
    params.push(options.productStatusByReview);
    paramIndex++;
  }

  if (options?.complaintStatus && options.complaintStatus !== 'all') {
    whereClauses.push(`complaint_status = $${paramIndex}`);
    params.push(options.complaintStatus);
    paramIndex++;
  }

  const sql = `SELECT COUNT(*) as count FROM reviews WHERE ${whereClauses.join(' AND ')}`;
  const result = await query<{ count: string }>(sql, params);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get chats for a store with pagination support
 */
export async function getChatsByStoreWithPagination(
  storeId: string,
  options?: { limit?: number; offset?: number; tag?: string; search?: string }
): Promise<Chat[]> {
  const whereClauses: string[] = ['store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by tag
  if (options?.tag && options.tag !== 'all') {
    whereClauses.push(`tag = $${paramIndex++}`);
    params.push(options.tag);
  }

  // Search in last message text
  if (options?.search && options.search.trim()) {
    whereClauses.push(`last_message_text ILIKE $${paramIndex++}`);
    params.push(`%${options.search.trim()}%`);
  }

  let sql = `SELECT * FROM chats WHERE ${whereClauses.join(' AND ')} ORDER BY last_message_date DESC NULLS LAST`;

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
    tag?: string;
    search?: string;
  }
): Promise<number> {
  const whereClauses: string[] = ['store_id = $1'];
  const params: any[] = [storeId];
  let paramIndex = 2;

  // Filter by tag
  if (options?.tag && options.tag !== 'all') {
    whereClauses.push(`tag = $${paramIndex++}`);
    params.push(options.tag);
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
 * Update chat tag
 */
export async function updateChatTag(
  chatId: string,
  tag: ChatTag
): Promise<Chat | null> {
  return updateChat(chatId, { tag });
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
      p.id, p.name, p.wb_product_id, p.vendor_code, p.price, p.image_url,
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
