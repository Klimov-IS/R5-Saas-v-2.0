'use client';

import { useState, useEffect } from 'react';
import {
  ListTodo,
  Scale,
  MessageCircle,
  Clock,
  Plus,
  Filter,
  CheckCircle2,
  Circle,
  PlayCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { TaskKPICard } from '@/components/tasks/TaskKPICard';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';

// Types
interface Task {
  id: string;
  store_id: string;
  entity_type: 'review' | 'chat' | 'question';
  entity_id: string;
  action: 'generate_complaint' | 'submit_complaint' | 'check_complaint' | 'reply_to_chat' | 'reply_to_question';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  description?: string;
  notes?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface TaskStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  complaintsTasks: number;
  chatsTasks: number;
}

interface Store {
  id: string;
  name: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Get API key (same approach as main page)
  const getApiKey = () => {
    return process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
  };

  // Fetch stores on mount
  useEffect(() => {
    fetchStores();
  }, []);

  // Fetch tasks and stats when filters change
  useEffect(() => {
    fetchData();
  }, [filterStatus, filterAction, filterStore, sortBy, searchQuery]);

  const fetchStores = async () => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
      const res = await fetch('/api/stores', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (data.success) {
        setStores(data.stores);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchData = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error('No API key found');
      return;
    }

    try {
      setIsLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterStore !== 'all') params.append('storeId', filterStore);

      // Fetch tasks
      const tasksRes = await fetch(`/api/tasks?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const tasksData = await tasksRes.json();

      // Fetch stats
      const statsRes = await fetch('/api/tasks/stats', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const statsData = await statsRes.json();

      if (tasksData.success) {
        // Apply client-side search and sorting
        let filteredTasks = tasksData.tasks;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filteredTasks = filteredTasks.filter((task: Task) =>
            task.title.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query)
          );
        }
        const sortedTasks = sortTasks(filteredTasks, sortBy);
        setTasks(sortedTasks);
      }
      if (statsData.success) setStats(statsData.stats);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortTasks = (tasksList: Task[], sortOrder: string): Task[] => {
    const sorted = [...tasksList];

    switch (sortOrder) {
      case 'created_desc':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'created_asc':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'priority_desc':
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        return sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      case 'priority_asc':
        const priorityOrderAsc = { low: 0, normal: 1, high: 2, urgent: 3 };
        return sorted.sort((a, b) => priorityOrderAsc[a.priority] - priorityOrderAsc[b.priority]);
      case 'due_date_asc':
        return sorted.sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
      case 'due_date_desc':
        return sorted.sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        });
      default:
        return sorted;
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Завтра';
    if (diffDays === -1) return 'Вчера';
    if (diffDays < 0) return `${Math.abs(diffDays)} дн. назад`;
    if (diffDays > 0) return `Через ${diffDays} дн.`;

    return date.toLocaleDateString('ru-RU');
  };

  const getActionBadge = (action: Task['action']) => {
    const badges = {
      generate_complaint: { label: 'Генерация', color: '#FCD34D' },
      submit_complaint: { label: 'Подача', color: '#60A5FA' },
      check_complaint: { label: 'Проверка', color: '#34D399' },
      reply_to_chat: { label: 'Ответ', color: '#A78BFA' },
      reply_to_question: { label: 'Вопрос', color: '#F472B6' },
    };
    const badge = badges[action];
    return (
      <span
        style={{
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: badge.color + '20',
          color: badge.color,
        }}
      >
        {badge.label}
      </span>
    );
  };

  const getStatusBadge = (status: Task['status']) => {
    const badges = {
      pending: { label: 'Ожидает', icon: Circle, color: '#9CA3AF' },
      in_progress: { label: 'В работе', icon: PlayCircle, color: '#FCD34D' },
      completed: { label: 'Завершено', icon: CheckCircle2, color: '#34D399' },
      cancelled: { label: 'Отменено', icon: XCircle, color: '#EF4444' },
    };
    const badge = badges[status];
    const Icon = badge.icon;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: badge.color + '20',
          color: badge.color,
        }}
      >
        <Icon size={14} />
        {badge.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: Task['priority']) => {
    const badges = {
      low: { label: 'Низкий', color: '#9CA3AF' },
      normal: { label: 'Средний', color: '#60A5FA' },
      high: { label: 'Высокий', color: '#F59E0B' },
      urgent: { label: 'Срочно', color: '#EF4444' },
    };
    const badge = badges[priority];
    return (
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: badge.color,
        }}
      >
        {badge.label}
      </span>
    );
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.due_date) < new Date();
  };

  return (
    <div className="page-container">
      {/* Navigation */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <a
          href="/"
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            textDecoration: 'none',
            color: 'var(--color-foreground)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          🏪 Кабинеты
        </a>
        <a
          href="/tasks"
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-primary)',
            border: '1px solid var(--color-primary)',
            textDecoration: 'none',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          🎯 Задачи
        </a>
      </div>

      {/* Header with Search */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📋 Список задач ({tasks.length})
        </h1>

        {/* Search Input */}
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="🔍 Поиск по задаче, магазину, товару..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="kpi-container">
          <TaskKPICard
            icon={ListTodo}
            label="Всего задач"
            value={stats.totalTasks}
            bgColor="#EFF6FF"
            iconColor="#3B82F6"
          />
          <TaskKPICard
            icon={Scale}
            label="Жалобы"
            value={stats.complaintsTasks}
            bgColor="#FEF3C7"
            iconColor="#F59E0B"
          />
          <TaskKPICard
            icon={MessageCircle}
            label="Диалоги"
            value={stats.chatsTasks}
            bgColor="#DBEAFE"
            iconColor="#3B82F6"
          />
          <TaskKPICard
            icon={Clock}
            label="Просрочено"
            value={stats.overdueTasks}
            bgColor="#FEE2E2"
            iconColor="#EF4444"
          />
        </div>
      )}

      {/* Filters and Create Button */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        {/* Store Filter */}
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          style={{
            padding: '8px 36px 8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'white',
            color: 'var(--color-foreground)',
            fontSize: '14px',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '16px',
          }}
        >
          <option value="all">🏪 Все магазины</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '8px 36px 8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'white',
            color: 'var(--color-foreground)',
            fontSize: '14px',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '16px',
          }}
        >
          <option value="all">📊 Все статусы</option>
          <option value="pending">Ожидает</option>
          <option value="in_progress">В работе</option>
          <option value="completed">Завершено</option>
          <option value="cancelled">Отменено</option>
        </select>

        {/* Action Filter */}
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{
            padding: '8px 36px 8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'white',
            color: 'var(--color-foreground)',
            fontSize: '14px',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '16px',
          }}
        >
          <option value="all">⚡ Все действия</option>
          <option value="generate_complaint">Генерация жалобы</option>
          <option value="submit_complaint">Подача жалобы</option>
          <option value="check_complaint">Проверка жалобы</option>
          <option value="reply_to_chat">Ответ на диалог</option>
        </select>

        {/* Sorting */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: '8px 36px 8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'white',
            color: 'var(--color-foreground)',
            fontSize: '14px',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '16px',
          }}
        >
          <option value="created_desc">🗓️ Все сроки</option>
          <option value="created_asc">Старые первые</option>
          <option value="priority_desc">Приоритет: высокий первый</option>
          <option value="priority_asc">Приоритет: низкий первый</option>
          <option value="due_date_asc">Срок: ближайшие первые</option>
          <option value="due_date_desc">Срок: дальние первые</option>
        </select>

        {/* Create Task Button */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          <Plus size={18} />
          Создать задачу
        </button>
      </div>

      {/* Tasks Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Задача</th>
              <th>Магазин</th>
              <th>Товар</th>
              <th>Действие</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th>Срок</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  Загрузка...
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  Нет задач
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  style={{
                    backgroundColor: isOverdue(task) ? '#FEF2F2' : undefined,
                  }}
                >
                  <td>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          {task.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '14px' }}>
                      {stores.find(s => s.id === task.store_id)?.name || '—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                      —
                    </div>
                  </td>
                  <td>{getActionBadge(task.action)}</td>
                  <td>{getStatusBadge(task.status)}</td>
                  <td>{getPriorityBadge(task.priority)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isOverdue(task) && <AlertCircle size={14} color="#EF4444" />}
                      {formatDate(task.due_date)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'in_progress')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-background)',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Начать
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'completed')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #34D399',
                            backgroundColor: '#34D39920',
                            color: '#34D399',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Завершить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchData}
        apiKey={getApiKey()}
      />
    </div>
  );
}
