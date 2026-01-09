/**
 * Firebase to JSON Export Script
 *
 * Exports all data from Firebase Firestore to JSON files.
 * This is PHASE 2A of the two-phase migration strategy.
 *
 * Usage:
 *   npm run export
 *
 * Output:
 *   firebase-export/
 *     ├── users.json
 *     ├── user_settings.json
 *     ├── stores.json
 *     ├── products.json
 *     ├── reviews.json
 *     ├── chats.json
 *     ├── chat_messages.json
 *     ├── questions.json
 *     ├── ai_logs.json (optional, last 1000 only)
 *     └── migration_stats.json
 */

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Configuration
// ============================================

const FIREBASE_SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../../wb-reputation/serviceAccountKey.json');
const EXPORT_DIR = path.resolve(__dirname, '../firebase-export');
const AI_LOGS_LIMIT = 1000; // Limit AI logs to recent 1000 records

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
// Export Statistics
// ============================================

interface ExportStats {
  users: number;
  userSettings: number;
  stores: number;
  products: number;
  reviews: number;
  chats: number;
  chatMessages: number;
  questions: number;
  aiLogs: number;
  startTime: string;
  endTime?: string;
  duration?: string;
}

const stats: ExportStats = {
  users: 0,
  userSettings: 0,
  stores: 0,
  products: 0,
  reviews: 0,
  chats: 0,
  chatMessages: 0,
  questions: 0,
  aiLogs: 0,
  startTime: new Date().toISOString(),
};

// ============================================
// Helper Functions
// ============================================

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
  log(`📁 Export directory: ${EXPORT_DIR}`);
}

function writeJsonFile(filename: string, data: any[]) {
  const filePath = path.join(EXPORT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  log(`✅ Saved ${data.length} records to ${filename}`);
}

function convertTimestamp(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (value._seconds !== undefined) {
    return new Date(value._seconds * 1000).toISOString();
  }
  if (typeof value === 'string') return value;
  return null;
}

// ============================================
// Export Functions
// ============================================

/**
 * Export users collection
 */
async function exportUsers() {
  log('🔄 Exporting users...');
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('users').get();

  if (snapshot.empty) {
    log('⚠️  No users found');
    writeJsonFile('users.json', []);
    return;
  }

  const users: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    users.push({
      id: doc.id,
      email: data.email || '',
      is_approved: data.isApproved || false,
      created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
      updated_at: convertTimestamp(data.updatedAt) || new Date().toISOString(),
    });
  });

  stats.users = users.length;
  writeJsonFile('users.json', users);
}

/**
 * Export user_settings collection
 */
async function exportUserSettings() {
  log('🔄 Exporting user_settings...');
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('user_settings').get();

  if (snapshot.empty) {
    log('⚠️  No user settings found');
    writeJsonFile('user_settings.json', []);
    return;
  }

  const settings: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    settings.push({
      id: doc.id,
      deepseek_api_key: data.deepseekApiKey || null,
      api_key: data.apiKey || null,
      ai_concurrency: data.aiConcurrency || 5,
      prompt_chat_reply: data.promptChatReply || null,
      prompt_chat_tag: data.promptChatTag || null,
      prompt_question_reply: data.promptQuestionReply || null,
      prompt_review_complaint: data.promptReviewComplaint || null,
      prompt_review_reply: data.promptReviewReply || null,
      openai_api_key: data.openaiApiKey || null,
      assistant_chat_reply: data.assistantChatReply || null,
      assistant_chat_tag: data.assistantChatTag || null,
      assistant_question_reply: data.assistantQuestionReply || null,
      assistant_review_complaint: data.assistantReviewComplaint || null,
      assistant_review_reply: data.assistantReviewReply || null,
      no_reply_messages: data.noReplyMessages || [],
      no_reply_trigger_phrase: data.noReplyTriggerPhrase || null,
      no_reply_stop_message: data.noReplyStopMessage || null,
      no_reply_messages2: data.noReplyMessages2 || [],
      no_reply_trigger_phrase2: data.noReplyTriggerPhrase2 || null,
      no_reply_stop_message2: data.noReplyStopMessage2 || null,
      created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
      updated_at: convertTimestamp(data.updatedAt) || new Date().toISOString(),
    });
  });

  stats.userSettings = settings.length;
  writeJsonFile('user_settings.json', settings);
}

/**
 * Export stores collection
 */
async function exportStores() {
  log('🔄 Exporting stores...');
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('stores').get();

  if (snapshot.empty) {
    log('⚠️  No stores found');
    writeJsonFile('stores.json', []);
    return;
  }

  const stores: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    stores.push({
      id: doc.id,
      name: data.name || 'Unnamed Store',
      owner_id: data.ownerId || '',
      api_token: data.apiToken || '',
      content_api_token: data.contentApiToken || null,
      feedbacks_api_token: data.feedbacksApiToken || null,
      chat_api_token: data.chatApiToken || null,
      is_auto_no_reply_enabled: data.isAutoNoReplyEnabled || false,
      last_product_update_status: data.lastProductUpdateStatus || null,
      last_product_update_date: convertTimestamp(data.lastProductUpdateDate),
      last_product_update_error: data.lastProductUpdateError || null,
      last_review_update_status: data.lastReviewUpdateStatus || null,
      last_review_update_date: convertTimestamp(data.lastReviewUpdateDate),
      last_review_update_error: data.lastReviewUpdateError || null,
      last_chat_update_status: data.lastChatUpdateStatus || null,
      last_chat_update_date: convertTimestamp(data.lastChatUpdateDate),
      last_chat_update_next: data.lastChatUpdateNext || null,
      last_chat_update_error: data.lastChatUpdateError || null,
      last_question_update_status: data.lastQuestionUpdateStatus || null,
      last_question_update_date: convertTimestamp(data.lastQuestionUpdateDate),
      last_question_update_error: data.lastQuestionUpdateError || null,
      total_reviews: data.totalReviews || 0,
      total_chats: data.totalChats || 0,
      chat_tag_counts: data.chatTagCounts || {},
      created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
      updated_at: convertTimestamp(data.updatedAt) || new Date().toISOString(),
    });
  });

  stats.stores = stores.length;
  writeJsonFile('stores.json', stores);
}

/**
 * Export products from all stores
 */
async function exportProducts() {
  log('🔄 Exporting products...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  const products: any[] = [];

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const productsSnapshot = await storeDoc.ref.collection('products').get();

    productsSnapshot.forEach(productDoc => {
      const data = productDoc.data();
      products.push({
        id: productDoc.id,
        store_id: storeDoc.id,
        owner_id: data.ownerId || storeData.ownerId,
        name: data.name || 'Unnamed Product',
        wb_product_id: data.wbProductId || data.nmId || '',
        vendor_code: data.vendorCode || '',
        price: data.price || null,
        image_url: data.imageUrl || null,
        review_count: data.reviewCount || 0,
        is_active: data.isActive !== false,
        compensation_method: data.compensationMethod || null,
        wb_api_data: data.wbApiData || null,
        last_review_update_date: convertTimestamp(data.lastReviewUpdateDate),
        created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
        updated_at: convertTimestamp(data.updatedAt) || new Date().toISOString(),
      });
    });
  }

  stats.products = products.length;
  writeJsonFile('products.json', products);
}

/**
 * Export reviews from all products
 */
async function exportReviews() {
  log('🔄 Exporting reviews...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  const reviews: any[] = [];

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const productsSnapshot = await storeDoc.ref.collection('products').get();

    for (const productDoc of productsSnapshot.docs) {
      const reviewsSnapshot = await productDoc.ref.collection('reviews').get();

      reviewsSnapshot.forEach(reviewDoc => {
        const data = reviewDoc.data();
        reviews.push({
          id: reviewDoc.id,
          product_id: productDoc.id,
          store_id: storeDoc.id,
          owner_id: storeData.ownerId || '',
          rating: data.rating || 5,
          text: data.text || '',
          pros: data.pros || null,
          cons: data.cons || null,
          author: data.author || 'Anonymous',
          date: convertTimestamp(data.date) || new Date().toISOString(),
          answer: data.answer || null,
          photo_links: data.photoLinks || null,
          video: data.video || null,
          supplier_feedback_valuation: data.supplierFeedbackValuation || null,
          supplier_product_valuation: data.supplierProductValuation || null,
          complaint_text: data.complaintText || null,
          complaint_sent_date: convertTimestamp(data.complaintSentDate),
          draft_reply: data.draftReply || null,
          draft_reply_thread_id: data.draftReplyThreadId || null,
          is_product_active: data.isProductActive !== false,
          has_answer: !!data.answer,
          has_complaint: !!data.complaintSentDate,
          has_complaint_draft: !!data.complaintText,
          created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
          updated_at: convertTimestamp(data.updatedAt) || new Date().toISOString(),
        });
      });
    }
  }

  stats.reviews = reviews.length;
  writeJsonFile('reviews.json', reviews);
}

/**
 * Export chats from all stores
 */
async function exportChats() {
  log('🔄 Exporting chats...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  const chats: any[] = [];

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const chatsSnapshot = await storeDoc.ref.collection('chats').get();

    chatsSnapshot.forEach(chatDoc => {
      const data = chatDoc.data();
      chats.push({
        id: chatDoc.id,
        store_id: storeDoc.id,
        owner_id: storeData.ownerId || '',
        client_name: data.clientName || 'Unknown',
        reply_sign: data.replySign || '',
        product_nm_id: data.productNmId || null,
        product_name: data.productName || null,
        product_vendor_code: data.productVendorCode || null,
        last_message_date: convertTimestamp(data.lastMessageDate),
        last_message_text: data.lastMessageText || null,
        last_message_sender: data.lastMessageSender || null,
        tag: data.tag || 'untagged',
        tag_update_date: convertTimestamp(data.tagUpdateDate),
        draft_reply: data.draftReply || null,
        draft_reply_thread_id: data.draftReplyThreadId || null,
        sent_no_reply_messages: data.sentNoReplyMessages || [],
        sent_no_reply_messages2: data.sentNoReplyMessages2 || [],
        created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
        updated_at: convertTimestamp(data.updatedAt) || new Date().toISOString(),
      });
    });
  }

  stats.chats = chats.length;
  writeJsonFile('chats.json', chats);
}

/**
 * Export chat messages from all chats
 */
async function exportChatMessages() {
  log('🔄 Exporting chat messages...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  const messages: any[] = [];

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const chatsSnapshot = await storeDoc.ref.collection('chats').get();

    for (const chatDoc of chatsSnapshot.docs) {
      const messagesSnapshot = await chatDoc.ref.collection('messages').get();

      messagesSnapshot.forEach(messageDoc => {
        const data = messageDoc.data();
        messages.push({
          id: messageDoc.id,
          chat_id: chatDoc.id,
          store_id: storeDoc.id,
          owner_id: storeData.ownerId || '',
          text: data.text || null,
          sender: data.sender || 'client',
          timestamp: convertTimestamp(data.timestamp) || new Date().toISOString(),
          download_id: data.downloadId || null,
          created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
        });
      });
    }
  }

  stats.chatMessages = messages.length;
  writeJsonFile('chat_messages.json', messages);
}

/**
 * Export questions from all stores
 */
async function exportQuestions() {
  log('🔄 Exporting questions...');
  const firestore = firebaseApp.firestore();
  const storesSnapshot = await firestore.collection('stores').get();

  const questions: any[] = [];

  for (const storeDoc of storesSnapshot.docs) {
    const storeData = storeDoc.data();
    const questionsSnapshot = await storeDoc.ref.collection('questions').get();

    questionsSnapshot.forEach(questionDoc => {
      const data = questionDoc.data();
      questions.push({
        id: questionDoc.id,
        store_id: storeDoc.id,
        owner_id: storeData.ownerId || '',
        text: data.text || '',
        created_date: convertTimestamp(data.createdDate) || new Date().toISOString(),
        state: data.state || 'new',
        was_viewed: data.wasViewed || false,
        is_answered: data.isAnswered || false,
        answer: data.answer || null,
        product_nm_id: data.productNmId || 0,
        product_name: data.productName || '',
        product_supplier_article: data.productSupplierArticle || null,
        product_brand_name: data.productBrandName || null,
        draft_reply_thread_id: data.draftReplyThreadId || null,
        created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
        updated_at: convertTimestamp(data.updatedAt) || new Date().toISOString(),
      });
    });
  }

  stats.questions = questions.length;
  writeJsonFile('questions.json', questions);
}

/**
 * Export AI logs (limited to recent records)
 */
async function exportAiLogs() {
  log(`🔄 Exporting AI logs (last ${AI_LOGS_LIMIT})...`);
  const firestore = firebaseApp.firestore();
  const snapshot = await firestore.collection('ai_logs')
    .orderBy('timestamp', 'desc')
    .limit(AI_LOGS_LIMIT)
    .get();

  if (snapshot.empty) {
    log('⚠️  No AI logs found');
    writeJsonFile('ai_logs.json', []);
    return;
  }

  const logs: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    logs.push({
      timestamp: convertTimestamp(data.timestamp) || new Date().toISOString(),
      operation: data.operation || 'unknown',
      system_prompt: data.systemPrompt || '',
      user_content: data.userContent || '',
      response: data.response || null,
      status: data.status || 'success',
      error: data.error || null,
      created_at: convertTimestamp(data.createdAt) || new Date().toISOString(),
    });
  });

  stats.aiLogs = logs.length;
  writeJsonFile('ai_logs.json', logs);
}

// ============================================
// Main Export Flow
// ============================================

async function main() {
  console.log('');
  console.log('========================================');
  console.log('📦 Firebase Data Export (Phase 2A)');
  console.log('========================================');
  console.log('');

  try {
    // Initialize
    initFirebase();
    ensureExportDir();
    console.log('');

    // ПЛАН А: Минимальная миграция + WB API синхронизация
    // Экспортируем только критичные данные (users, settings, stores)
    // Остальное загрузим через WB API после миграции кода

    log('');
    log('🎯 ПЛАН А: Минимальная миграция');
    log('   Экспортируем: users, user_settings, stores');
    log('   Пропускаем: products, reviews, chats, questions (загрузим через WB API)');
    log('');

    await exportUsers();
    await exportUserSettings();
    await exportStores();

    // Создаем пустые placeholder файлы для SQL генератора
    log('⏭️  Creating empty placeholders for WB API data...');
    writeJsonFile('products.json', []);
    writeJsonFile('reviews.json', []);
    writeJsonFile('chats.json', []);
    writeJsonFile('chat_messages.json', []);
    writeJsonFile('questions.json', []);
    writeJsonFile('ai_logs.json', []);

    // Save statistics
    stats.endTime = new Date().toISOString();
    const startMs = new Date(stats.startTime).getTime();
    const endMs = new Date(stats.endTime).getTime();
    const durationSec = Math.round((endMs - startMs) / 1000);
    stats.duration = `${durationSec} seconds`;

    writeJsonFile('migration_stats.json', [stats]);

    // Print summary
    console.log('');
    console.log('========================================');
    console.log('✅ Export Complete!');
    console.log('========================================');
    console.log('');
    console.log('📊 Export Statistics:');
    console.log(`   Users:         ${stats.users}`);
    console.log(`   User Settings: ${stats.userSettings}`);
    console.log(`   Stores:        ${stats.stores}`);
    console.log(`   Products:      ${stats.products}`);
    console.log(`   Reviews:       ${stats.reviews}`);
    console.log(`   Chats:         ${stats.chats}`);
    console.log(`   Chat Messages: ${stats.chatMessages}`);
    console.log(`   Questions:     ${stats.questions}`);
    console.log(`   AI Logs:       ${stats.aiLogs}`);
    console.log(`   Duration:      ${stats.duration}`);
    console.log('');
    console.log(`📁 Files saved to: ${EXPORT_DIR}`);
    console.log('');
    console.log('🔜 Next step: npm run generate-sql');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR during export:');
    console.error(error);
    process.exit(1);
  }
}

// Run export
main();
