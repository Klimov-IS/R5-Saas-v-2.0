import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Chat, ChatsResponse, ChatWithMessages, ChatTag } from '@/types/chats';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

interface UseChatsOptions {
  storeId: string;
  skip?: number;
  take?: number;
  tag?: ChatTag | 'all';
  search?: string;
}

/**
 * Hook для получения списка чатов с фильтрацией и пагинацией
 */
export function useChats(options: UseChatsOptions) {
  const { storeId, skip = 0, take = 100, tag = 'all', search = '' } = options;

  return useQuery({
    queryKey: ['chats', storeId, skip, take, tag, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        skip: skip.toString(),
        take: take.toString(),
        tag,
        search,
      });

      const response = await fetch(`/api/stores/${storeId}/chats?${params}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      return response.json() as Promise<ChatsResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook для получения одного чата с историей сообщений
 */
export function useChatMessages(storeId: string, chatId: string | null) {
  return useQuery({
    queryKey: ['chat-messages', storeId, chatId],
    queryFn: async () => {
      if (!chatId) return null;

      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chat messages');
      }

      const data = await response.json();
      return data.data as ChatWithMessages;
    },
    enabled: !!chatId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook для генерации AI ответа
 */
export function useGenerateAI(storeId: string, chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/generate-ai`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI response');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate chat messages to refetch
      queryClient.invalidateQueries({ queryKey: ['chat-messages', storeId, chatId] });
    },
  });
}

/**
 * Hook для отправки сообщения
 */
export function useSendMessage(storeId: string, chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate both chat list and messages
      queryClient.invalidateQueries({ queryKey: ['chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', storeId, chatId] });
    },
  });
}

/**
 * Hook для массовой генерации AI ответов
 */
export function useBulkGenerateAI(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatIds: string[]) => {
      const response = await fetch(`/api/stores/${storeId}/chats/bulk/generate-ai`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk generate AI responses');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', storeId] });
    },
  });
}

/**
 * Hook для массовой отправки сообщений
 */
export function useBulkSendMessages(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatIds: string[]) => {
      const response = await fetch(`/api/stores/${storeId}/chats/bulk/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk send messages');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', storeId] });
    },
  });
}

/**
 * Hook для массовой классификации чатов
 */
export function useBulkClassify(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatIds: string[]) => {
      const response = await fetch(`/api/stores/${storeId}/chats/classify-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to classify chats');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', storeId] });
    },
  });
}

/**
 * Hook для обновления чатов с WB
 */
export function useRefreshChats(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/dialogues/update`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh chats');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', storeId] });
    },
  });
}
