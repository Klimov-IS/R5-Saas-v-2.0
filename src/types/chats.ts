export type ChatTag =
  | 'active'
  | 'successful'
  | 'unsuccessful'
  | 'no_reply'
  | 'untagged'
  | 'completed'
  // Deletion workflow tags (added 2026-01-16)
  | 'deletion_candidate'  // AI identified deletion opportunity
  | 'deletion_offered'    // Compensation offer sent
  | 'deletion_agreed'     // Client agreed to delete
  | 'deletion_confirmed'  // Review deleted/modified
  | 'refund_requested'    // Client wants refund
  | 'spam';               // Spam or competitor messages

// NEW: Kanban Board Status (2026-01-22)
export type ChatStatus =
  | 'inbox'           // Входящие
  | 'in_progress'     // В работе
  | 'awaiting_reply'  // Ожидание ответа
  | 'resolved'        // Решено
  | 'closed';         // Закрыто

export type MessageSender = 'client' | 'seller';

export interface Product {
  id: string;
  nm_id: number;
  name: string;
  vendor_code: string;
}

export interface Chat {
  id: string;
  storeId: string;
  clientName: string;
  productNmId: string;
  productName: string | null;
  productVendorCode: string | null;
  lastMessageDate: string;
  lastMessageText: string;
  lastMessageSender: MessageSender;
  tag: ChatTag;
  status: ChatStatus;
  completionReason?: string | null;
  draftReply: string | null;
  product?: Product;
}

export type MessageStatus = 'sent' | 'sending' | 'failed';

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: MessageSender;
  text: string;
  createdAt: string;
  status?: MessageStatus; // Optional: для оптимистичных обновлений
}

export interface ChatsResponse {
  data: Chat[];
  totalCount: number;
}

export interface ChatWithMessages {
  chat: Chat;
  messages: ChatMessage[];
}

export interface TagStats {
  active: number;
  successful: number;
  unsuccessful: number;
  no_reply: number;
  untagged: number;
  completed: number;
  deletion_candidate: number;
  deletion_offered: number;
  deletion_agreed: number;
  deletion_confirmed: number;
  refund_requested: number;
  spam: number;
}
