import { create } from 'zustand';

export type ViewMode = 'table' | 'messenger';

export type ChatTag = 'active' | 'successful' | 'unsuccessful' | 'no_reply' | 'untagged' | 'completed';

interface ChatsState {
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

  // Filters
  tagFilter: ChatTag | 'all';
  setTagFilter: (tag: ChatTag | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useChatsStore = create<ChatsState>((set, get) => ({
  // View Mode
  viewMode: 'table',
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

  // Filters
  tagFilter: 'all',
  setTagFilter: (tag) => set({ tagFilter: tag }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
