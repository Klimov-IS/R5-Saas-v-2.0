import { Bot, Flag } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onGenerateReplies: () => void;
  onGenerateComplaints: () => void;
  onClearDrafts: () => void;
  isGeneratingReplies: boolean;
  isGeneratingComplaints: boolean;
  isClearingDrafts: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onGenerateReplies,
  onGenerateComplaints,
  onClearDrafts,
  isGeneratingReplies,
  isGeneratingComplaints,
  isClearingDrafts
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <>
      <style jsx>{`
        .bulk-actions-card {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg) var(--spacing-2xl);
          margin-bottom: var(--spacing-2xl);
          box-shadow: var(--shadow-sm);
        }
        .bulk-actions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
        }
        .bulk-actions-title {
          font-size: var(--font-size-base);
          font-weight: 600;
        }
        .bulk-actions-buttons {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
      `}</style>

      <div className="bulk-actions-card">
        <div className="bulk-actions-header">
          <h3 className="bulk-actions-title">Массовые действия</h3>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)' }}>
            Выбрано отзывов: <strong>{selectedCount}</strong>
          </span>
        </div>
        <div className="bulk-actions-buttons">
          <button
            className="btn btn-primary btn-sm btn-icon"
            onClick={onGenerateReplies}
            disabled={isGeneratingReplies}
          >
            <Bot size={16} />
            {isGeneratingReplies ? 'Генерация...' : 'Сгенерировать ответы'}
          </button>
          <button
            className="btn btn-outline btn-sm btn-icon"
            onClick={onGenerateComplaints}
            disabled={isGeneratingComplaints}
          >
            <Flag size={16} />
            {isGeneratingComplaints ? 'Генерация...' : 'Сгенерировать жалобы'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={onClearDrafts}
            disabled={isClearingDrafts}
          >
            {isClearingDrafts ? 'Очистка...' : 'Очистить черновики'}
          </button>
        </div>
      </div>
    </>
  );
}
