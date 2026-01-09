'use client';

import { useSyncStore } from '@/lib/sync-store';
import { ProgressWidget } from './ProgressWidget';
import { toast } from '@/lib/toast';

export function ProgressWidgetContainer() {
  const { tasks, expandTask, removeTask } = useSyncStore();

  const handleCancel = (taskId: string) => {
    const confirmed = confirm('Вы уверены, что хотите отменить синхронизацию?');
    if (confirmed) {
      removeTask(taskId);
      toast.info('Отменено', 'Синхронизация остановлена');
    }
  };

  // Only show minimized tasks
  const minimizedTasks = tasks.filter(task => task.isMinimized && task.status === 'running');

  if (minimizedTasks.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '12px',
      maxWidth: '384px'
    }}>
      {minimizedTasks.map(task => (
        <ProgressWidget
          key={task.id}
          task={task}
          onExpand={() => expandTask(task.id)}
          onCancel={() => handleCancel(task.id)}
        />
      ))}
    </div>
  );
}
