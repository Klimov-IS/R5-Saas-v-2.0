import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { Chat, ChatsResponse, ChatWithMessages, ChatTag } from '@/types/chats';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

interface UseChatsOptions {
  storeId: string;
  skip?: number;
  take?: number;
  tag?: ChatTag | 'all';
  search?: string;
}

interface UseChatsInfiniteOptions {
  storeId: string;
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
 * Hook для получения чатов с бесконечной прокруткой (Infinite Scroll)
 * Используется в MessengerView для автоматической подгрузки при прокрутке
 */
export function useChatsInfinite(options: UseChatsInfiniteOptions) {
  const { storeId, take = 50, tag = 'all', search = '' } = options;

  return useInfiniteQuery({
    queryKey: ['chats-infinite', storeId, tag, search],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        skip: pageParam.toString(),
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
    getNextPageParam: (lastPage, allPages) => {
      // Считаем сколько чатов уже загружено
      const loadedCount = allPages.reduce((sum, page) => sum + page.data.length, 0);

      // Если загружено меньше чем totalCount - есть ещё страницы
      const hasMore = loadedCount < lastPage.totalCount;

      // Возвращаем skip для следующей страницы (или undefined если больше нет)
      return hasMore ? loadedCount : undefined;
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
    staleTime: 0, // ✅ Always refetch - ensures drafts are loaded from DB
    refetchOnMount: true, // ✅ Force refetch when opening chat
    refetchOnWindowFocus: false, // Don't spam on window focus
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
    onSuccess: (response) => {
      // ✅ OPTIMISTIC UPDATE: Instantly show draft in UI
      queryClient.setQueryData(['chat-messages', storeId, chatId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          chat: {
            ...old.chat,
            draftReply: response.text,
            draftReplyGeneratedAt: new Date().toISOString(),
            draftReplyEdited: false,
          },
        };
      });

      // ✅ Invalidate both chat detail and list cache
      queryClient.invalidateQueries({ queryKey: ['chat-messages', storeId, chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats', storeId] });
    },
  });
}

/**
 * Hook для отправки сообщения с оптимистичными обновлениями
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

    // 🚀 OPTIMISTIC UPDATE: Мгновенно показываем сообщение ДО ответа API
    onMutate: async (message: string) => {
      // 1. Отменяем текущие запросы, чтобы не перезаписали наше оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: ['chat-messages', storeId, chatId] });

      // 2. Сохраняем предыдущие данные (для rollback при ошибке)
      const previousMessages = queryClient.getQueryData(['chat-messages', storeId, chatId]);

      // 3. 🎯 ОПТИМИСТИЧНО обновляем кеш - сообщение появится МГНОВЕННО
      queryClient.setQueryData(['chat-messages', storeId, chatId], (old: any) => {
        if (!old) return old;

        const optimisticMessage = {
          id: `temp-${Date.now()}`, // Временный ID
          chatId,
          sender: 'seller' as const,
          text: message,
          createdAt: new Date().toISOString(),
          status: 'sending' as const, // Индикатор "отправляется..."
        };

        return {
          ...old,
          messages: [...(old.messages || []), optimisticMessage],
        };
      });

      // Возвращаем контекст для rollback
      return { previousMessages };
    },

    // ✅ УСПЕХ: Заменяем временное сообщение на реальное с ID от сервера
    onSuccess: (response, message, context) => {
      queryClient.setQueryData(['chat-messages', storeId, chatId], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          messages: old.messages.map((msg: any) =>
            msg.id.startsWith('temp-')
              ? {
                  ...msg,
                  id: response.messageId || msg.id, // Заменяем на реальный ID
                  status: 'sent', // Статус "отправлено"
                }
              : msg
          ),
        };
      });

      // Обновляем список чатов (lastMessage изменился)
      queryClient.invalidateQueries({ queryKey: ['chats', storeId] });
    },

    // ❌ ОШИБКА: Откатываем к старым данным
    onError: (error, message, context) => {
      // Restore previous state
      if (context?.previousMessages) {
        queryClient.setQueryData(['chat-messages', storeId, chatId], context.previousMessages);
      }
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
    onSuccess: (data, chatIds) => {
      // ✅ Invalidate all affected chats + list
      chatIds.forEach(chatId => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', storeId, chatId] });
      });
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
