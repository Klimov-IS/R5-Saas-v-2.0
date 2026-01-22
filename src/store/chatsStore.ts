import { create } from 'zustand';
import type { ChatStatus } from '@/db/helpers';

export type ViewMode = 'table' | 'messenger' | 'kanban';

export type LastSenderFilter = 'all' | 'client' | 'seller';

interface ChatsState {
  // Current Store ID
  currentStoreId: string | null;
  setCurrentStoreId: (storeId: string) => void;

  // View Mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Active Chat (in messenger view)
  activeChatId: string | null;
  setActiveChatId: (chatId: string | null) => void;

  // Bulk Selection
  selectedChatIds: Set<string>;
  toggleChatSelection: (chatId: string) => void;
  selectAllChats: (chatIds: string[]) => void;
  deselectAllChats: () => void;
  isSelected: (chatId: string) => boolean;

  // Sidebar state
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Global Filters (applied to all stores)
  statusFilter: ChatStatus | 'all';
  setStatusFilter: (status: ChatStatus | 'all') => void;
  lastSender: LastSenderFilter;
  setLastSender: (sender: LastSenderFilter) => void;
  hasDraft: boolean;
  setHasDraft: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Reset temporary state only (selection, active chat)
  resetTemporaryState: () => void;
}

export const useChatsStore = create<ChatsState>()((set, get) => ({
  // Current Store ID
  currentStoreId: null,
  setCurrentStoreId: (storeId) => {
    set({ currentStoreId: storeId });
  },

  // View Mode
  viewMode: 'kanban',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Active Chat
  activeChatId: null,
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),

  // Bulk Selection
  selectedChatIds: new Set(),
  toggleChatSelection: (chatId) =>
    set((state) => {
      const newSet = new Set(state.selectedChatIds);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return { selectedChatIds: newSet };
    }),
  selectAllChats: (chatIds) =>
    set({ selectedChatIds: new Set(chatIds) }),
  deselectAllChats: () =>
    set({ selectedChatIds: new Set() }),
  isSelected: (chatId) => get().selectedChatIds.has(chatId),

  // Sidebar
  isSidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  // Global Filters (applied to all stores)
  statusFilter: 'all',
  setStatusFilter: (status) => set({ statusFilter: status }),
  lastSender: 'all',
  setLastSender: (sender) => set({ lastSender: sender }),
  hasDraft: false,
  setHasDraft: (value) => set({ hasDraft: value }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Reset only temporary state (selection, active chat)
  resetTemporaryState: () => set({
    activeChatId: null,
    selectedChatIds: new Set(),
  }),
}));
