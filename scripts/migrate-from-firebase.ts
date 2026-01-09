/**
 * Firebase to PostgreSQL Migration Script
 *
 * This script migrates all data from Firebase Firestore to Yandex Cloud PostgreSQL.
 *
 * Usage:
 *   npx ts-node scripts/migrate-from-firebase.ts
 *
 * Prerequisites:
 *   1. PostgreSQL schema already created (20260104_001_initial_schema.sql applied)
 *   2. Firebase serviceAccountKey.json available
 *   3. .env.local with DATABASE_URL configured
 */

import admin from 'firebase-admin';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Disable SSL certificate validation for development (Yandex Cloud)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ============================================
// Configuration
// ============================================

const FIREBASE_SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../../wb-reputation/serviceAccountKey.json');
const BATCH_SIZE = 100; // Number of records to insert per batch

// ============================================
// Initialize Firebase Admin
// ============================================

let firebaseApp: admin.app.App;

function initFirebase() {
  if (admin.apps.length > 0) {
    firebaseApp = admin.app();
  } else {
    const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  console.log('✅ Firebase Admin initialized');
}

// ============================================
// Initialize PostgreSQL
// ============================================

// Debug environment variables
console.log('🔍 Debug PostgreSQL credentials:');
console.log(`  Host: ${process.env.POSTGRES_HOST}`);
console.log(`  Port: ${process.env.POSTGRES_PORT}`);
console.log(`  User: ${process.env.POSTGRES_USER}`);
console.log(`  Password length: ${process.env.POSTGRES_PASSWORD?.length} chars`);
console.log(`  Password starts with: ${process.env.POSTGRES_PASSWORD?.substring(0, 2)}`);
console.log(`  Database: ${process.env.POSTGRES_DATABASE}`);
console.log('');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  ssl: { rejectUnauthorized: false }, // Required for Yandex Cloud

  // Yandex Cloud Odyssey pooler specific settings
  application_name: 'firebase-migration',
  statement_timeout: 600000, // 10 minutes
  connectionTimeoutMillis: 30000,
});

// ============================================
// Migration Statistics
// ============================================

interface MigrationStats {
  users: number;
  userSettings: number;
  stores: number;
  products: number;
  reviews: number;
  chats: number;
  chatMessages: number;
  questions: number;
  aiLogs: number;
  errors: number;
}

const stats: MigrationStats = {
  users: 0,
  userSettings: 0,
  stores: 0,
  products: 0,
  reviews: 0,
  chats: 0,
  chatMessages: 0,
  questions: 0,
  aiLogs: 0,
  errors: 0,
};

// ============================================
// Helper Functions
// ============================================

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logError(message: string, error: any) {
  console.error(`[${new Date().toISOString()}] ❌ ${message}`, error);
  stats.errors++;
}

// ============================================
// Migration Functions
// ============================================

/**
 * Migrate users collection
 */
async function migrateUsers() {
  log('🔄 Migrating users...');
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('users').get();

  if (snapshot.empty) {
    log('⚠️  No users found');
    return;
  }

  const values: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    values.push([
      doc.id,
      data.email || '',
      data.isApproved || false,
      data.createdAt ? new Date(data.createdAt) : new Date(),
      data.updatedAt ? new Date(data.updatedAt) : new Date(),
    ]);
  });

  const query = `
    INSERT INTO users (id, email, is_approved, created_at, updated_at)
    VALUES ${values.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      is_approved = EXCLUDED.is_approved,
      updated_at = EXCLUDED.updated_at
  `;

  const flatValues = values.flat();
  await pool.query(query, flatValues);

  stats.users = values.length;
  log(`✅ Migrated ${values.length} users`);
}

/**
 * Migrate user_settings collection
 */
async function migrateUserSettings() {
  log('🔄 Migrating user_settings...');
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('user_settings').get();

  if (snapshot.empty) {
    log('⚠️  No user settings found');
    return;
  }

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      await pool.query(
        `
        INSERT INTO user_settings (
          id, deepseek_api_key, api_key, ai_concurrency,
          prompt_chat_reply, prompt_chat_tag, prompt_question_reply,
          prompt_review_complaint, prompt_review_reply,
          openai_api_key, assistant_chat_reply, assistant_chat_tag,
          assistant_question_reply, assistant_review_complaint, assistant_review_reply,
          no_reply_messages, no_reply_trigger_phrase, no_reply_stop_message,
          no_reply_messages2, no_reply_trigger_phrase2, no_reply_stop_message2,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23
        )
        ON CONFLICT (id) DO UPDATE SET
          deepseek_api_key = EXCLUDED.deepseek_api_key,
          api_key = EXCLUDED.api_key,
          ai_concurrency = EXCLUDED.ai_concurrency,
          updated_at = EXCLUDED.updated_at
        `,
        [
          doc.id,
          data.deepseekApiKey || null,
          data.apiKey || null,
          data.aiConcurrency || 5,
          data.promptChatReply || null,
          data.promptChatTag || null,
          data.promptQuestionReply || null,
          data.promptReviewComplaint || null,
          data.promptReviewReply || null,
          data.openaiApiKey || null,
          data.assistantChatReply || null,
          data.assistantChatTag || null,
          data.assistantQuestionReply || null,
          data.assistantReviewComplaint || null,
          data.assistantReviewReply || null,
          JSON.stringify(data.noReplyMessages || []),
          data.noReplyTriggerPhrase || null,
          data.noReplyStopMessage || null,
          JSON.stringify(data.noReplyMessages2 || []),
          data.noReplyTriggerPhrase2 || null,
          data.noReplyStopMessage2 || null,
          data.createdAt ? new Date(data.createdAt) : new Date(),
          data.updatedAt ? new Date(data.updatedAt) : new Date(),
        ]
      );

      stats.userSettings++;
    } catch (error) {
      logError(`Failed to migrate user_settings ${doc.id}`, error);
    }
  }

  log(`✅ Migrated ${stats.userSettings} user settings`);
}

/**
 * Migrate stores collection
 */
async function migrateStores() {
  log('🔄 Migrating stores...');
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('stores').get();

  if (snapshot.empty) {
    log('⚠️  No stores found');
    return;
  }

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      await pool.query(
        `
        INSERT INTO stores (
          id, name, owner_id, api_token, content_api_token, feedbacks_api_token, chat_api_token,
          is_auto_no_reply_enabled,
          last_product_update_status, last_product_update_date, last_product_update_error,
          last_review_update_status, last_review_update_date, last_review_update_error,
          last_chat_update_status, last_chat_update_date, last_chat_update_next, last_chat_update_error,
          last_question_update_status, last_question_update_date, last_question_update_error,
          total_reviews, total_chats, chat_tag_counts,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          api_token = EXCLUDED.api_token,
          updated_at = EXCLUDED.updated_at
        `,
        [
          doc.id,
          data.name || 'Unnamed Store',
          data.ownerId || '',
          data.apiToken || '',
          data.contentApiToken || null,
          data.feedbacksApiToken || null,
          data.chatApiToken || null,
          data.isAutoNoReplyEnabled || false,
          data.lastProductUpdateStatus || null,
          data.lastProductUpdateDate ? new Date(data.lastProductUpdateDate) : null,
          data.lastProductUpdateError || null,
          data.lastReviewUpdateStatus || null,
          data.lastReviewUpdateDate ? new Date(data.lastReviewUpdateDate) : null,
          data.lastReviewUpdateError || null,
          data.lastChatUpdateStatus || null,
          data.lastChatUpdateDate ? new Date(data.lastChatUpdateDate) : null,
          data.lastChatUpdateNext || null,
          data.lastChatUpdateError || null,
          data.lastQuestionUpdateStatus || null,
          data.lastQuestionUpdateDate ? new Date(data.lastQuestionUpdateDate) : null,
          data.lastQuestionUpdateError || null,
          data.totalReviews || 0,
          data.totalChats || 0,
          JSON.stringify(data.chatTagCounts || {}),
          data.createdAt ? new Date(data.createdAt) : new Date(),
          data.updatedAt ? new Date(data.updatedAt) : new Date(),
        ]
      );

      stats.stores++;
    } catch (error) {
      logError(`Failed to migrate store ${doc.id}`, error);
    }
  }

  log(`✅ Migrated ${stats.stores} stores`);
}

/**
 * Migrate products subcollection for all stores
 */
async function migrateProducts() {
  log('🔄 Migrating products...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  for (const storeDoc of storesSnapshot.docs) {
    const productsSnapshot = await storeDoc.ref.collection('products').get();

    if (productsSnapshot.empty) continue;

    for (const productDoc of productsSnapshot.docs) {
      try {
        const data = productDoc.data();

        await pool.query(
          `
          INSERT INTO products (
            id, store_id, owner_id, name, wb_product_id, vendor_code, price, image_url,
            review_count, is_active, compensation_method, wb_api_data, last_review_update_date,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            review_count = EXCLUDED.review_count,
            updated_at = EXCLUDED.updated_at
          `,
          [
            productDoc.id,
            storeDoc.id,
            data.ownerId || storeDoc.data().ownerId,
            data.name || 'Unnamed Product',
            data.wbProductId || data.nmId || '',
            data.vendorCode || '',
            data.price || null,
            data.imageUrl || null,
            data.reviewCount || 0,
            data.isActive !== false, // Default to true
            data.compensationMethod || null,
            data.wbApiData ? JSON.stringify(data.wbApiData) : null,
            data.lastReviewUpdateDate ? new Date(data.lastReviewUpdateDate) : null,
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date(),
          ]
        );

        stats.products++;
      } catch (error) {
        logError(`Failed to migrate product ${productDoc.id}`, error);
      }
    }
  }

  log(`✅ Migrated ${stats.products} products`);
}

/**
 * Migrate reviews subcollection for all products
 */
async function migrateReviews() {
  log('🔄 Migrating reviews...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const productsSnapshot = await storeDoc.ref.collection('products').get();

    for (const productDoc of productsSnapshot.docs) {
      const reviewsSnapshot = await productDoc.ref.collection('reviews').get();

      if (reviewsSnapshot.empty) continue;

      for (const reviewDoc of reviewsSnapshot.docs) {
        try {
          const data = reviewDoc.data();

          await pool.query(
            `
            INSERT INTO reviews (
              id, product_id, store_id, owner_id, rating, text, pros, cons, author, date,
              answer, photo_links, video,
              supplier_feedback_valuation, supplier_product_valuation,
              complaint_text, complaint_sent_date, draft_reply, draft_reply_thread_id,
              is_product_active, has_answer, has_complaint, has_complaint_draft,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24, $25
            )
            ON CONFLICT (id) DO UPDATE SET
              answer = EXCLUDED.answer,
              has_answer = EXCLUDED.has_answer,
              updated_at = EXCLUDED.updated_at
            `,
            [
              reviewDoc.id,
              productDoc.id,
              storeDoc.id,
              storeData.ownerId || '',
              data.rating || 5,
              data.text || '',
              data.pros || null,
              data.cons || null,
              data.author || 'Anonymous',
              data.date ? new Date(data.date) : new Date(),
              data.answer ? JSON.stringify(data.answer) : null,
              data.photoLinks ? JSON.stringify(data.photoLinks) : null,
              data.video ? JSON.stringify(data.video) : null,
              data.supplierFeedbackValuation || null,
              data.supplierProductValuation || null,
              data.complaintText || null,
              data.complaintSentDate ? new Date(data.complaintSentDate) : null,
              data.draftReply || null,
              data.draftReplyThreadId || null,
              data.isProductActive !== false,
              !!data.answer,
              !!data.complaintSentDate,
              !!data.complaintText,
              data.createdAt ? new Date(data.createdAt) : new Date(),
              data.updatedAt ? new Date(data.updatedAt) : new Date(),
            ]
          );

          stats.reviews++;
        } catch (error) {
          logError(`Failed to migrate review ${reviewDoc.id}`, error);
        }
      }
    }
  }

  log(`✅ Migrated ${stats.reviews} reviews`);
}

/**
 * Migrate chats subcollection for all stores
 */
async function migrateChats() {
  log('🔄 Migrating chats...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const chatsSnapshot = await storeDoc.ref.collection('chats').get();

    if (chatsSnapshot.empty) continue;

    for (const chatDoc of chatsSnapshot.docs) {
      try {
        const data = chatDoc.data();

        await pool.query(
          `
          INSERT INTO chats (
            id, store_id, owner_id, client_name, reply_sign,
            product_nm_id, product_name, product_vendor_code,
            last_message_date, last_message_text, last_message_sender,
            tag, tag_update_date, draft_reply, draft_reply_thread_id,
            sent_no_reply_messages, sent_no_reply_messages2,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
          ON CONFLICT (id) DO UPDATE SET
            last_message_date = EXCLUDED.last_message_date,
            last_message_text = EXCLUDED.last_message_text,
            tag = EXCLUDED.tag,
            updated_at = EXCLUDED.updated_at
          `,
          [
            chatDoc.id,
            storeDoc.id,
            storeData.ownerId || '',
            data.clientName || 'Unknown',
            data.replySign || '',
            data.productNmId || null,
            data.productName || null,
            data.productVendorCode || null,
            data.lastMessageDate ? new Date(data.lastMessageDate) : null,
            data.lastMessageText || null,
            data.lastMessageSender || null,
            data.tag || 'untagged',
            data.tagUpdateDate ? new Date(data.tagUpdateDate) : null,
            data.draftReply || null,
            data.draftReplyThreadId || null,
            JSON.stringify(data.sentNoReplyMessages || []),
            JSON.stringify(data.sentNoReplyMessages2 || []),
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date(),
          ]
        );

        stats.chats++;

        // Migrate chat messages
        const messagesSnapshot = await chatDoc.ref.collection('messages').get();
        for (const messageDoc of messagesSnapshot.docs) {
          try {
            const msgData = messageDoc.data();

            await pool.query(
              `
              INSERT INTO chat_messages (
                id, chat_id, store_id, owner_id, text, sender, timestamp, download_id, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO NOTHING
              `,
              [
                messageDoc.id,
                chatDoc.id,
                storeDoc.id,
                storeData.ownerId || '',
                msgData.text || null,
                msgData.sender || 'client',
                msgData.timestamp ? new Date(msgData.timestamp) : new Date(),
                msgData.downloadId || null,
                msgData.createdAt ? new Date(msgData.createdAt) : new Date(),
              ]
            );

            stats.chatMessages++;
          } catch (error) {
            logError(`Failed to migrate chat message ${messageDoc.id}`, error);
          }
        }
      } catch (error) {
        logError(`Failed to migrate chat ${chatDoc.id}`, error);
      }
    }
  }

  log(`✅ Migrated ${stats.chats} chats and ${stats.chatMessages} messages`);
}

/**
 * Migrate questions subcollection for all stores
 */
async function migrateQuestions() {
  log('🔄 Migrating questions...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const questionsSnapshot = await storeDoc.ref.collection('questions').get();

    if (questionsSnapshot.empty) continue;

    for (const questionDoc of questionsSnapshot.docs) {
      try {
        const data = questionDoc.data();

        await pool.query(
          `
          INSERT INTO questions (
            id, store_id, owner_id, text, created_date, state, was_viewed, is_answered,
            answer, product_nm_id, product_name, product_supplier_article, product_brand_name,
            draft_reply_thread_id, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          )
          ON CONFLICT (id) DO UPDATE SET
            answer = EXCLUDED.answer,
            is_answered = EXCLUDED.is_answered,
            updated_at = EXCLUDED.updated_at
          `,
          [
            questionDoc.id,
            storeDoc.id,
            storeData.ownerId || '',
            data.text || '',
            data.createdDate ? new Date(data.createdDate) : new Date(),
            data.state || 'new',
            data.wasViewed || false,
            data.isAnswered || false,
            data.answer ? JSON.stringify(data.answer) : null,
            data.productNmId || 0,
            data.productName || '',
            data.productSupplierArticle || null,
            data.productBrandName || null,
            data.draftReplyThreadId || null,
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date(),
          ]
        );

        stats.questions++;
      } catch (error) {
        logError(`Failed to migrate question ${questionDoc.id}`, error);
      }
    }
  }

  log(`✅ Migrated ${stats.questions} questions`);
}

/**
 * Migrate ai_logs collection (optional, may be skipped if not critical)
 */
async function migrateAiLogs() {
  log('🔄 Migrating ai_logs...');
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('ai_logs').limit(1000).get(); // Limit to recent logs

  if (snapshot.empty) {
    log('⚠️  No AI logs found (or skipping old logs)');
    return;
  }

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      await pool.query(
        `
        INSERT INTO ai_logs (
          timestamp, operation, system_prompt, user_content, response, status, error, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          data.timestamp ? new Date(data.timestamp) : new Date(),
          data.operation || 'unknown',
          data.systemPrompt || '',
          data.userContent || '',
          data.response || null,
          data.status || 'success',
          data.error || null,
          data.createdAt ? new Date(data.createdAt) : new Date(),
        ]
      );

      stats.aiLogs++;
    } catch (error) {
      logError(`Failed to migrate ai_log ${doc.id}`, error);
    }
  }

  log(`✅ Migrated ${stats.aiLogs} AI logs`);
}

// ============================================
// Main Migration Flow
// ============================================

async function main() {
  console.log('');
  console.log('========================================');
  console.log('🚀 Firebase → PostgreSQL Migration');
  console.log('========================================');
  console.log('');

  try {
    // Initialize connections
    initFirebase();
    await pool.query('SELECT NOW()');
    log('✅ PostgreSQL connected');
    console.log('');

    // Run migrations in order (respecting foreign key constraints)
    await migrateUsers();
    await migrateUserSettings();
    await migrateStores();
    await migrateProducts();
    await migrateReviews();
    await migrateChats();
    await migrateQuestions();
    await migrateAiLogs();

    // Print summary
    console.log('');
    console.log('========================================');
    console.log('✅ Migration Complete!');
    console.log('========================================');
    console.log('');
    console.log('📊 Migration Statistics:');
    console.log(`   Users:         ${stats.users}`);
    console.log(`   User Settings: ${stats.userSettings}`);
    console.log(`   Stores:        ${stats.stores}`);
    console.log(`   Products:      ${stats.products}`);
    console.log(`   Reviews:       ${stats.reviews}`);
    console.log(`   Chats:         ${stats.chats}`);
    console.log(`   Chat Messages: ${stats.chatMessages}`);
    console.log(`   Questions:     ${stats.questions}`);
    console.log(`   AI Logs:       ${stats.aiLogs}`);
    console.log(`   Errors:        ${stats.errors}`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR during migration:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
    log('🔌 PostgreSQL connection closed');
  }
}

// Run migration
main();
