/**
 * JSON to SQL Generator
 *
 * Generates SQL INSERT scripts from exported JSON files.
 * This is PHASE 2B (preparation) of the two-phase migration strategy.
 *
 * Usage:
 *   npm run generate-sql
 *
 * Input:
 *   firebase-export/*.json
 *
 * Output:
 *   sql-import/
 *     ├── 01_import_users.sql
 *     ├── 02_import_user_settings.sql
 *     ├── 03_import_stores.sql
 *     ├── 04_import_products.sql
 *     ├── 05_import_reviews.sql
 *     ├── 06_import_chats.sql
 *     ├── 07_import_chat_messages.sql
 *     ├── 08_import_questions.sql
 *     ├── 09_import_ai_logs.sql
 *     └── 10_verify_import.sql
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Configuration
// ============================================

const EXPORT_DIR = path.resolve(__dirname, '../firebase-export');
const SQL_DIR = path.resolve(__dirname, '../sql-import');
const BATCH_SIZE = 500; // Records per INSERT statement

// ============================================
// Helper Functions
// ============================================

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function ensureSqlDir() {
  if (!fs.existsSync(SQL_DIR)) {
    fs.mkdirSync(SQL_DIR, { recursive: true });
  }
  log(`📁 SQL directory: ${SQL_DIR}`);
}

function readJsonFile(filename: string): any[] {
  const filePath = path.join(EXPORT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    log(`⚠️  File not found: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function writeSqlFile(filename: string, content: string) {
  const filePath = path.join(SQL_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  log(`✅ Generated ${filename}`);
}

function escapeSqlString(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${value.toString().replace(/'/g, "''")}'`;
}

// ============================================
// SQL Generation Functions
// ============================================

/**
 * Generate SQL for users
 */
function generateUsersSQL() {
  log('🔄 Generating SQL for users...');
  const users = readJsonFile('users.json');

  if (users.length === 0) {
    writeSqlFile('01_import_users.sql', '-- No users to import\n');
    return;
  }

  const values = users.map(u =>
    `(${escapeSqlString(u.id)}, ${escapeSqlString(u.email)}, ${escapeSqlString(u.is_approved)}, ${escapeSqlString(u.created_at)}, ${escapeSqlString(u.updated_at)})`
  ).join(',\n  ');

  const sql = `-- Import users (${users.length} records)
-- Generated: ${new Date().toISOString()}

BEGIN;

INSERT INTO users (id, email, is_approved, created_at, updated_at)
VALUES
  ${values}
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  is_approved = EXCLUDED.is_approved,
  updated_at = EXCLUDED.updated_at;

COMMIT;

-- Verify
SELECT COUNT(*) as imported_users FROM users;
`;

  writeSqlFile('01_import_users.sql', sql);
}

/**
 * Generate SQL for user_settings
 */
function generateUserSettingsSQL() {
  log('🔄 Generating SQL for user_settings...');
  const settings = readJsonFile('user_settings.json');

  if (settings.length === 0) {
    writeSqlFile('02_import_user_settings.sql', '-- No user settings to import\n');
    return;
  }

  const values = settings.map(s =>
    `(${escapeSqlString(s.id)}, ${escapeSqlString(s.deepseek_api_key)}, ${escapeSqlString(s.api_key)}, ${escapeSqlString(s.ai_concurrency)}, ${escapeSqlString(s.prompt_chat_reply)}, ${escapeSqlString(s.prompt_chat_tag)}, ${escapeSqlString(s.prompt_question_reply)}, ${escapeSqlString(s.prompt_review_complaint)}, ${escapeSqlString(s.prompt_review_reply)}, ${escapeSqlString(s.openai_api_key)}, ${escapeSqlString(s.assistant_chat_reply)}, ${escapeSqlString(s.assistant_chat_tag)}, ${escapeSqlString(s.assistant_question_reply)}, ${escapeSqlString(s.assistant_review_complaint)}, ${escapeSqlString(s.assistant_review_reply)}, ${escapeSqlString(s.no_reply_messages)}, ${escapeSqlString(s.no_reply_trigger_phrase)}, ${escapeSqlString(s.no_reply_stop_message)}, ${escapeSqlString(s.no_reply_messages2)}, ${escapeSqlString(s.no_reply_trigger_phrase2)}, ${escapeSqlString(s.no_reply_stop_message2)}, ${escapeSqlString(s.created_at)}, ${escapeSqlString(s.updated_at)})`
  ).join(',\n  ');

  const sql = `-- Import user_settings (${settings.length} records)
-- Generated: ${new Date().toISOString()}

BEGIN;

INSERT INTO user_settings (
  id, deepseek_api_key, api_key, ai_concurrency,
  prompt_chat_reply, prompt_chat_tag, prompt_question_reply,
  prompt_review_complaint, prompt_review_reply,
  openai_api_key, assistant_chat_reply, assistant_chat_tag,
  assistant_question_reply, assistant_review_complaint, assistant_review_reply,
  no_reply_messages, no_reply_trigger_phrase, no_reply_stop_message,
  no_reply_messages2, no_reply_trigger_phrase2, no_reply_stop_message2,
  created_at, updated_at
)
VALUES
  ${values}
ON CONFLICT (id) DO UPDATE SET
  deepseek_api_key = EXCLUDED.deepseek_api_key,
  api_key = EXCLUDED.api_key,
  updated_at = EXCLUDED.updated_at;

COMMIT;

-- Verify
SELECT COUNT(*) as imported_user_settings FROM user_settings;
`;

  writeSqlFile('02_import_user_settings.sql', sql);
}

/**
 * Generate SQL for stores
 */
function generateStoresSQL() {
  log('🔄 Generating SQL for stores...');
  const stores = readJsonFile('stores.json');

  if (stores.length === 0) {
    writeSqlFile('03_import_stores.sql', '-- No stores to import\n');
    return;
  }

  const values = stores.map(s =>
    `(${escapeSqlString(s.id)}, ${escapeSqlString(s.name)}, ${escapeSqlString(s.owner_id)}, ${escapeSqlString(s.api_token)}, ${escapeSqlString(s.content_api_token)}, ${escapeSqlString(s.feedbacks_api_token)}, ${escapeSqlString(s.chat_api_token)}, ${escapeSqlString(s.is_auto_no_reply_enabled)}, ${escapeSqlString(s.last_product_update_status)}, ${escapeSqlString(s.last_product_update_date)}, ${escapeSqlString(s.last_product_update_error)}, ${escapeSqlString(s.last_review_update_status)}, ${escapeSqlString(s.last_review_update_date)}, ${escapeSqlString(s.last_review_update_error)}, ${escapeSqlString(s.last_chat_update_status)}, ${escapeSqlString(s.last_chat_update_date)}, ${escapeSqlString(s.last_chat_update_next)}, ${escapeSqlString(s.last_chat_update_error)}, ${escapeSqlString(s.last_question_update_status)}, ${escapeSqlString(s.last_question_update_date)}, ${escapeSqlString(s.last_question_update_error)}, ${escapeSqlString(s.total_reviews)}, ${escapeSqlString(s.total_chats)}, ${escapeSqlString(s.chat_tag_counts)}, ${escapeSqlString(s.created_at)}, ${escapeSqlString(s.updated_at)})`
  ).join(',\n  ');

  const sql = `-- Import stores (${stores.length} records)
-- Generated: ${new Date().toISOString()}

BEGIN;

INSERT INTO stores (
  id, name, owner_id, api_token, content_api_token, feedbacks_api_token, chat_api_token,
  is_auto_no_reply_enabled,
  last_product_update_status, last_product_update_date, last_product_update_error,
  last_review_update_status, last_review_update_date, last_review_update_error,
  last_chat_update_status, last_chat_update_date, last_chat_update_next, last_chat_update_error,
  last_question_update_status, last_question_update_date, last_question_update_error,
  total_reviews, total_chats, chat_tag_counts,
  created_at, updated_at
)
VALUES
  ${values}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  api_token = EXCLUDED.api_token,
  updated_at = EXCLUDED.updated_at;

COMMIT;

-- Verify
SELECT COUNT(*) as imported_stores FROM stores;
`;

  writeSqlFile('03_import_stores.sql', sql);
}

/**
 * Generate SQL for products (with batching)
 */
function generateProductsSQL() {
  log('🔄 Generating SQL for products...');
  const products = readJsonFile('products.json');

  if (products.length === 0) {
    writeSqlFile('04_import_products.sql', '-- No products to import\n');
    return;
  }

  let sql = `-- Import products (${products.length} records)
-- Generated: ${new Date().toISOString()}
-- Batched imports for performance

BEGIN;

`;

  // Split into batches
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, Math.min(i + BATCH_SIZE, products.length));
    const values = batch.map(p =>
      `(${escapeSqlString(p.id)}, ${escapeSqlString(p.store_id)}, ${escapeSqlString(p.owner_id)}, ${escapeSqlString(p.name)}, ${escapeSqlString(p.wb_product_id)}, ${escapeSqlString(p.vendor_code)}, ${escapeSqlString(p.price)}, ${escapeSqlString(p.image_url)}, ${escapeSqlString(p.review_count)}, ${escapeSqlString(p.is_active)}, ${escapeSqlString(p.compensation_method)}, ${escapeSqlString(p.wb_api_data)}, ${escapeSqlString(p.last_review_update_date)}, ${escapeSqlString(p.created_at)}, ${escapeSqlString(p.updated_at)})`
    ).join(',\n  ');

    sql += `-- Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)
INSERT INTO products (
  id, store_id, owner_id, name, wb_product_id, vendor_code, price, image_url,
  review_count, is_active, compensation_method, wb_api_data, last_review_update_date,
  created_at, updated_at
)
VALUES
  ${values}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  updated_at = EXCLUDED.updated_at;

`;
  }

  sql += `COMMIT;

-- Verify
SELECT COUNT(*) as imported_products FROM products;
`;

  writeSqlFile('04_import_products.sql', sql);
}

/**
 * Generate SQL for reviews (with batching)
 */
function generateReviewsSQL() {
  log('🔄 Generating SQL for reviews...');
  const reviews = readJsonFile('reviews.json');

  if (reviews.length === 0) {
    writeSqlFile('05_import_reviews.sql', '-- No reviews to import\n');
    return;
  }

  let sql = `-- Import reviews (${reviews.length} records)
-- Generated: ${new Date().toISOString()}
-- Batched imports for performance

BEGIN;

`;

  // Split into batches
  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const batch = reviews.slice(i, Math.min(i + BATCH_SIZE, reviews.length));
    const values = batch.map(r =>
      `(${escapeSqlString(r.id)}, ${escapeSqlString(r.product_id)}, ${escapeSqlString(r.store_id)}, ${escapeSqlString(r.owner_id)}, ${escapeSqlString(r.rating)}, ${escapeSqlString(r.text)}, ${escapeSqlString(r.pros)}, ${escapeSqlString(r.cons)}, ${escapeSqlString(r.author)}, ${escapeSqlString(r.date)}, ${escapeSqlString(r.answer)}, ${escapeSqlString(r.photo_links)}, ${escapeSqlString(r.video)}, ${escapeSqlString(r.supplier_feedback_valuation)}, ${escapeSqlString(r.supplier_product_valuation)}, ${escapeSqlString(r.complaint_text)}, ${escapeSqlString(r.complaint_sent_date)}, ${escapeSqlString(r.draft_reply)}, ${escapeSqlString(r.draft_reply_thread_id)}, ${escapeSqlString(r.is_product_active)}, ${escapeSqlString(r.has_answer)}, ${escapeSqlString(r.has_complaint)}, ${escapeSqlString(r.has_complaint_draft)}, ${escapeSqlString(r.created_at)}, ${escapeSqlString(r.updated_at)})`
    ).join(',\n  ');

    sql += `-- Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)
INSERT INTO reviews (
  id, product_id, store_id, owner_id, rating, text, pros, cons, author, date,
  answer, photo_links, video,
  supplier_feedback_valuation, supplier_product_valuation,
  complaint_text, complaint_sent_date, draft_reply, draft_reply_thread_id,
  is_product_active, has_answer, has_complaint, has_complaint_draft,
  created_at, updated_at
)
VALUES
  ${values}
ON CONFLICT (id) DO UPDATE SET
  answer = EXCLUDED.answer,
  has_answer = EXCLUDED.has_answer,
  updated_at = EXCLUDED.updated_at;

`;
  }

  sql += `COMMIT;

-- Verify
SELECT COUNT(*) as imported_reviews FROM reviews;
`;

  writeSqlFile('05_import_reviews.sql', sql);
}

/**
 * Generate SQL for chats
 */
function generateChatsSQL() {
  log('🔄 Generating SQL for chats...');
  const chats = readJsonFile('chats.json');

  if (chats.length === 0) {
    writeSqlFile('06_import_chats.sql', '-- No chats to import\n');
    return;
  }

  const values = chats.map(c =>
    `(${escapeSqlString(c.id)}, ${escapeSqlString(c.store_id)}, ${escapeSqlString(c.owner_id)}, ${escapeSqlString(c.client_name)}, ${escapeSqlString(c.reply_sign)}, ${escapeSqlString(c.product_nm_id)}, ${escapeSqlString(c.product_name)}, ${escapeSqlString(c.product_vendor_code)}, ${escapeSqlString(c.last_message_date)}, ${escapeSqlString(c.last_message_text)}, ${escapeSqlString(c.last_message_sender)}, ${escapeSqlString(c.tag)}, ${escapeSqlString(c.tag_update_date)}, ${escapeSqlString(c.draft_reply)}, ${escapeSqlString(c.draft_reply_thread_id)}, ${escapeSqlString(c.sent_no_reply_messages)}, ${escapeSqlString(c.sent_no_reply_messages2)}, ${escapeSqlString(c.created_at)}, ${escapeSqlString(c.updated_at)})`
  ).join(',\n  ');

  const sql = `-- Import chats (${chats.length} records)
-- Generated: ${new Date().toISOString()}

BEGIN;

INSERT INTO chats (
  id, store_id, owner_id, client_name, reply_sign,
  product_nm_id, product_name, product_vendor_code,
  last_message_date, last_message_text, last_message_sender,
  tag, tag_update_date, draft_reply, draft_reply_thread_id,
  sent_no_reply_messages, sent_no_reply_messages2,
  created_at, updated_at
)
VALUES
  ${values}
ON CONFLICT (id) DO UPDATE SET
  last_message_date = EXCLUDED.last_message_date,
  last_message_text = EXCLUDED.last_message_text,
  tag = EXCLUDED.tag,
  updated_at = EXCLUDED.updated_at;

COMMIT;

-- Verify
SELECT COUNT(*) as imported_chats FROM chats;
`;

  writeSqlFile('06_import_chats.sql', sql);
}

/**
 * Generate SQL for chat_messages (with batching)
 */
function generateChatMessagesSQL() {
  log('🔄 Generating SQL for chat_messages...');
  const messages = readJsonFile('chat_messages.json');

  if (messages.length === 0) {
    writeSqlFile('07_import_chat_messages.sql', '-- No chat messages to import\n');
    return;
  }

  let sql = `-- Import chat_messages (${messages.length} records)
-- Generated: ${new Date().toISOString()}
-- Batched imports for performance

BEGIN;

`;

  // Split into batches
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, Math.min(i + BATCH_SIZE, messages.length));
    const values = batch.map(m =>
      `(${escapeSqlString(m.id)}, ${escapeSqlString(m.chat_id)}, ${escapeSqlString(m.store_id)}, ${escapeSqlString(m.owner_id)}, ${escapeSqlString(m.text)}, ${escapeSqlString(m.sender)}, ${escapeSqlString(m.timestamp)}, ${escapeSqlString(m.download_id)}, ${escapeSqlString(m.created_at)})`
    ).join(',\n  ');

    sql += `-- Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)
INSERT INTO chat_messages (
  id, chat_id, store_id, owner_id, text, sender, timestamp, download_id, created_at
)
VALUES
  ${values}
ON CONFLICT (id) DO NOTHING;

`;
  }

  sql += `COMMIT;

-- Verify
SELECT COUNT(*) as imported_chat_messages FROM chat_messages;
`;

  writeSqlFile('07_import_chat_messages.sql', sql);
}

/**
 * Generate SQL for questions
 */
function generateQuestionsSQL() {
  log('🔄 Generating SQL for questions...');
  const questions = readJsonFile('questions.json');

  if (questions.length === 0) {
    writeSqlFile('08_import_questions.sql', '-- No questions to import\n');
    return;
  }

  const values = questions.map(q =>
    `(${escapeSqlString(q.id)}, ${escapeSqlString(q.store_id)}, ${escapeSqlString(q.owner_id)}, ${escapeSqlString(q.text)}, ${escapeSqlString(q.created_date)}, ${escapeSqlString(q.state)}, ${escapeSqlString(q.was_viewed)}, ${escapeSqlString(q.is_answered)}, ${escapeSqlString(q.answer)}, ${escapeSqlString(q.product_nm_id)}, ${escapeSqlString(q.product_name)}, ${escapeSqlString(q.product_supplier_article)}, ${escapeSqlString(q.product_brand_name)}, ${escapeSqlString(q.draft_reply_thread_id)}, ${escapeSqlString(q.created_at)}, ${escapeSqlString(q.updated_at)})`
  ).join(',\n  ');

  const sql = `-- Import questions (${questions.length} records)
-- Generated: ${new Date().toISOString()}

BEGIN;

INSERT INTO questions (
  id, store_id, owner_id, text, created_date, state, was_viewed, is_answered,
  answer, product_nm_id, product_name, product_supplier_article, product_brand_name,
  draft_reply_thread_id, created_at, updated_at
)
VALUES
  ${values}
ON CONFLICT (id) DO UPDATE SET
  answer = EXCLUDED.answer,
  is_answered = EXCLUDED.is_answered,
  updated_at = EXCLUDED.updated_at;

COMMIT;

-- Verify
SELECT COUNT(*) as imported_questions FROM questions;
`;

  writeSqlFile('08_import_questions.sql', sql);
}

/**
 * Generate SQL for ai_logs
 */
function generateAiLogsSQL() {
  log('🔄 Generating SQL for ai_logs...');
  const logs = readJsonFile('ai_logs.json');

  if (logs.length === 0) {
    writeSqlFile('09_import_ai_logs.sql', '-- No AI logs to import\n');
    return;
  }

  const values = logs.map(l =>
    `(${escapeSqlString(l.timestamp)}, ${escapeSqlString(l.operation)}, ${escapeSqlString(l.system_prompt)}, ${escapeSqlString(l.user_content)}, ${escapeSqlString(l.response)}, ${escapeSqlString(l.status)}, ${escapeSqlString(l.error)}, ${escapeSqlString(l.created_at)})`
  ).join(',\n  ');

  const sql = `-- Import ai_logs (${logs.length} records)
-- Generated: ${new Date().toISOString()}

BEGIN;

INSERT INTO ai_logs (
  timestamp, operation, system_prompt, user_content, response, status, error, created_at
)
VALUES
  ${values};

COMMIT;

-- Verify
SELECT COUNT(*) as imported_ai_logs FROM ai_logs;
`;

  writeSqlFile('09_import_ai_logs.sql', sql);
}

/**
 * Generate verification SQL
 */
function generateVerifySQL() {
  log('🔄 Generating verification SQL...');

  const stats = readJsonFile('migration_stats.json');
  const expected = stats[0] || {};

  const sql = `-- Verification Script
-- Compare imported counts with expected counts from Firebase export
-- Generated: ${new Date().toISOString()}

-- Expected counts from Firebase:
-- Users:         ${expected.users || 0}
-- User Settings: ${expected.userSettings || 0}
-- Stores:        ${expected.stores || 0}
-- Products:      ${expected.products || 0}
-- Reviews:       ${expected.reviews || 0}
-- Chats:         ${expected.chats || 0}
-- Chat Messages: ${expected.chatMessages || 0}
-- Questions:     ${expected.questions || 0}
-- AI Logs:       ${expected.aiLogs || 0}

-- ============================================
-- Count Verification
-- ============================================

SELECT
  'users' as table_name,
  COUNT(*) as actual_count,
  ${expected.users || 0} as expected_count,
  CASE WHEN COUNT(*) = ${expected.users || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END as status
FROM users

UNION ALL

SELECT
  'user_settings',
  COUNT(*),
  ${expected.userSettings || 0},
  CASE WHEN COUNT(*) = ${expected.userSettings || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM user_settings

UNION ALL

SELECT
  'stores',
  COUNT(*),
  ${expected.stores || 0},
  CASE WHEN COUNT(*) = ${expected.stores || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM stores

UNION ALL

SELECT
  'products',
  COUNT(*),
  ${expected.products || 0},
  CASE WHEN COUNT(*) = ${expected.products || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM products

UNION ALL

SELECT
  'reviews',
  COUNT(*),
  ${expected.reviews || 0},
  CASE WHEN COUNT(*) = ${expected.reviews || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM reviews

UNION ALL

SELECT
  'chats',
  COUNT(*),
  ${expected.chats || 0},
  CASE WHEN COUNT(*) = ${expected.chats || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM chats

UNION ALL

SELECT
  'chat_messages',
  COUNT(*),
  ${expected.chatMessages || 0},
  CASE WHEN COUNT(*) = ${expected.chatMessages || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM chat_messages

UNION ALL

SELECT
  'questions',
  COUNT(*),
  ${expected.questions || 0},
  CASE WHEN COUNT(*) = ${expected.questions || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM questions

UNION ALL

SELECT
  'ai_logs',
  COUNT(*),
  ${expected.aiLogs || 0},
  CASE WHEN COUNT(*) >= ${expected.aiLogs || 0} THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM ai_logs;

-- ============================================
-- Referential Integrity Check
-- ============================================

-- Check for orphaned products (products without stores)
SELECT
  'orphaned_products' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM products p
LEFT JOIN stores s ON p.store_id = s.id
WHERE s.id IS NULL;

-- Check for orphaned reviews (reviews without products)
SELECT
  'orphaned_reviews' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM reviews r
LEFT JOIN products p ON r.product_id = p.id
WHERE p.id IS NULL;

-- Check for orphaned chats (chats without stores)
SELECT
  'orphaned_chats' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM chats c
LEFT JOIN stores s ON c.store_id = s.id
WHERE s.id IS NULL;

-- Check for orphaned chat_messages (messages without chats)
SELECT
  'orphaned_chat_messages' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM chat_messages m
LEFT JOIN chats c ON m.chat_id = c.id
WHERE c.id IS NULL;

-- ============================================
-- Data Sampling (spot check)
-- ============================================

-- Sample stores
SELECT 'Sample stores:' as info;
SELECT id, name, owner_id, total_reviews, total_chats
FROM stores
ORDER BY created_at DESC
LIMIT 5;

-- Sample products
SELECT 'Sample products:' as info;
SELECT id, name, wb_product_id, store_id, review_count
FROM products
ORDER BY created_at DESC
LIMIT 5;

-- Sample reviews
SELECT 'Sample reviews:' as info;
SELECT id, product_id, rating, author, date
FROM reviews
ORDER BY date DESC
LIMIT 5;
`;

  writeSqlFile('10_verify_import.sql', sql);
}

// ============================================
// Main Generation Flow
// ============================================

async function main() {
  console.log('');
  console.log('========================================');
  console.log('⚙️  SQL Generation (Phase 2B Prep)');
  console.log('========================================');
  console.log('');

  try {
    // Check if export directory exists
    if (!fs.existsSync(EXPORT_DIR)) {
      console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
      console.error('   Please run "npm run export" first.');
      process.exit(1);
    }

    ensureSqlDir();
    console.log('');

    // Generate SQL files
    generateUsersSQL();
    generateUserSettingsSQL();
    generateStoresSQL();
    generateProductsSQL();
    generateReviewsSQL();
    generateChatsSQL();
    generateChatMessagesSQL();
    generateQuestionsSQL();
    generateAiLogsSQL();
    generateVerifySQL();

    // Print summary
    console.log('');
    console.log('========================================');
    console.log('✅ SQL Generation Complete!');
    console.log('========================================');
    console.log('');
    console.log(`📁 SQL files saved to: ${SQL_DIR}`);
    console.log('');
    console.log('🔜 Next steps:');
    console.log('   1. Open Yandex Cloud WebSQL');
    console.log('   2. Execute SQL files in order (01 → 10)');
    console.log('   3. Check verification results from 10_verify_import.sql');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR during SQL generation:');
    console.error(error);
    process.exit(1);
  }
}

// Run generation
main();
