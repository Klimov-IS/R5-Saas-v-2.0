// Common types for the application

export type WithId<T> = T & {
  id: string;
};

export type Store = {
  name: string;
  apiToken: string;
  contentApiToken?: string | null;
  feedbacksApiToken?: string | null;
  chatApiToken?: string | null;
  ownerId?: string;
  totalReviews?: number;
  totalChats?: number;
  chatTagCounts?: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
};

export type Review = {
  id: string;
  store_id: string;
  product_id: string;
  product_name?: string;
  user_name?: string;
  rating: number;
  text: string;
  answer?: string | null;
  draft_reply?: string | null;
  status: 'available' | 'sent' | 'error';
  date: string;
  created_at: string;
  updated_at: string;
};

export type Chat = {
  id: string;
  store_id: string;
  user_id: string;
  user_name?: string;
  last_message?: string;
  tag: 'untagged' | 'active' | 'successful' | 'unsuccessful' | 'no_reply';
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender: 'user' | 'seller';
  text: string;
  timestamp: string;
};
