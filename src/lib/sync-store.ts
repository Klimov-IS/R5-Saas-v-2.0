import { create } from 'zustand';

export type SyncType = 'products' | 'reviews' | 'chats';
export type SyncStatus = 'running' | 'completed' | 'cancelled';

export interface SyncLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface SyncTask {
  id: string;
  type: SyncType;
  title: string;
  subtitle: string;
  storeIds: string[];
  storeNames: string[];
  currentIndex: number;
  successCount: number;
  errorCount: number;
  status: SyncStatus;
  startTime: number;
  logs: SyncLog[];
  isMinimized: boolean;
}

interface SyncStore {
  tasks: SyncTask[];
  activeKpiTypes: Set<SyncType>;

  // Actions
  startTask: (task: Omit<SyncTask, 'id' | 'currentIndex' | 'successCount' | 'errorCount' | 'status' | 'startTime' | 'logs' | 'isMinimized'>) => string;
  updateTask: (id: string, updates: Partial<SyncTask>) => void;
  minimizeTask: (id: string) => void;
  expandTask: (id: string) => void;
  removeTask: (id: string) => void;
  addLog: (id: string, log: Omit<SyncLog, 'time'>) => void;
  setActiveKpi: (type: SyncType, active: boolean) => void;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  tasks: [],
  activeKpiTypes: new Set(),

  startTask: (task) => {
    const id = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newTask: SyncTask = {
      ...task,
      id,
      currentIndex: 0,
      successCount: 0,
      errorCount: 0,
      status: 'running',
      startTime: Date.now(),
      logs: [{
        time: new Date().toLocaleTimeString('ru-RU'),
        message: 'Запуск синхронизации...',
        type: 'info',
      }],
      isMinimized: false,
    };

    set((state) => ({
      tasks: [...state.tasks, newTask],
      activeKpiTypes: new Set([...state.activeKpiTypes, task.type]),
    }));

    return id;
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
    }));
  },

  minimizeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, isMinimized: true } : task
      ),
    }));
  },

  expandTask: (id) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, isMinimized: false } : task
      ),
    }));
  },

  removeTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);

    set((state) => {
      const newTasks = state.tasks.filter((t) => t.id !== id);
      const newActiveKpiTypes = new Set(state.activeKpiTypes);

      // Remove KPI active state if no other tasks of same type
      if (task && !newTasks.some((t) => t.type === task.type)) {
        newActiveKpiTypes.delete(task.type);
      }

      return {
        tasks: newTasks,
        activeKpiTypes: newActiveKpiTypes,
      };
    });
  },

  addLog: (id, log) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              logs: [
                ...task.logs,
                {
                  ...log,
                  time: new Date().toLocaleTimeString('ru-RU'),
                },
              ],
            }
          : task
      ),
    }));
  },

  setActiveKpi: (type, active) => {
    set((state) => {
      const newActiveKpiTypes = new Set(state.activeKpiTypes);
      if (active) {
        newActiveKpiTypes.add(type);
      } else {
        newActiveKpiTypes.delete(type);
      }
      return { activeKpiTypes: newActiveKpiTypes };
    });
  },
}));
