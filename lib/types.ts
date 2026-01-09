/**
 * Shared Types for WB Reputation Manager
 * PostgreSQL-based types (replaces Firebase types)
 */

// ============================================================================
// Core Types
// ============================================================================

export type UpdateStatus = "idle" | "pending" | "success" | "error";
export type ChatTag = 'untagged' | 'active' | 'successful' | 'unsuccessful' | 'no_reply' | 'completed';

// ============================================================================
// User & Settings
// ============================================================================

export interface User {
  id: string;
  email: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
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

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isApproved: boolean;
  settings?: UserSettings;
}

// ============================================================================
// Store
// ============================================================================

export interface Store {
  id: string;
  name: string;
  api_token: string;
  content_api_token?: string | null;
  feedbacks_api_token?: string | null;
  chat_api_token?: string | null;
  owner_id: string;
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

// ============================================================================
// Product
// ============================================================================

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
  wb_api_data?: any | null;
  last_review_update_date?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Review
// ============================================================================

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
  answer?: any | null;
  photo_links?: any | null;
  video?: any | null;
  supplier_feedback_valuation?: number | null;
  supplier_product_valuation?: number | null;
  complaint_text?: string | null;
  complaint_sent_date?: string | null;
  draft_reply?: string | null;
  wb_feedback_id?: string;  // For WB API integration
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Chat
// ============================================================================

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

// ============================================================================
// Question
// ============================================================================

export interface Question {
  id: string;
  store_id: string;
  owner_id: string;
  text: string;
  created_date: string;
  state: string;
  answer?: any | null;
  product_details: any;
  was_viewed: boolean;
  is_answered: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AI Log
// ============================================================================

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
  metadata?: any | null;
  created_at: string;
}

// ============================================================================
// Helper Types
// ============================================================================

export type WithId<T> = T & { id: string };
