export type ChatTag = 'active' | 'successful' | 'unsuccessful' | 'no_reply' | 'untagged' | 'completed';

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
  draftReply: string | null;
  product?: Product;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: MessageSender;
  text: string;
  createdAt: string;
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
}
