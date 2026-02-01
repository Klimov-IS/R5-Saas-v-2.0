'use client';

import { useState } from 'react';
import { FileText, X, AlertCircle } from 'lucide-react';

type ReviewBulkActionsBarProps = {
  selectedCount: number;
  eligibleCount: number; // Reviews that can have complaints generated
  onClearSelection: () => void;
  onGenerateComplaints: () => void;
  isGenerating?: boolean;
};

export function ReviewBulkActionsBar({
  selectedCount,
  eligibleCount,
  onClearSelection,
  onGenerateComplaints,
  isGenerating = false,
}: ReviewBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  const ineligibleCount = selectedCount - eligibleCount;

  return (
    <div className="bulk-actions-bar">
      <span className="selection-info">
        <span className="selection-count">
          Выбрано: {selectedCount} {selectedCount === 1 ? 'отзыв' : selectedCount < 5 ? 'отзыва' : 'отзывов'}
        </span>
        {ineligibleCount > 0 && (
          <span className="ineligible-warning">
            <AlertCircle style={{ width: '14px', height: '14px' }} />
            {ineligibleCount} не подходят для жалоб
          </span>
        )}
      </span>

      <div className="actions">
        <button
          className="btn btn-outline btn-sm"
          onClick={onClearSelection}
          disabled={isGenerating}
        >
          <X style={{ width: '14px', height: '14px' }} />
          Снять выделение
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={onGenerateComplaints}
          disabled={isGenerating || eligibleCount === 0}
          title={eligibleCount === 0 ? 'Нет отзывов, подходящих для генерации жалоб' : undefined}
        >
          <FileText style={{ width: '14px', height: '14px' }} />
          {isGenerating
            ? 'Генерация...'
            : `Сгенерировать жалобы${eligibleCount > 0 ? ` (${eligibleCount})` : ''}`
          }
        </button>
      </div>

      <style jsx>{`
        .bulk-actions-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 32px;
          background: #eff6ff;
          border-bottom: 2px solid #3b82f6;
        }

        .selection-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .selection-count {
          font-size: 14px;
          color: #1e40af;
          font-weight: 600;
        }

        .ineligible-warning {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #b45309;
          background: #fef3c7;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          outline: none;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn-outline {
          background: white;
          border: 1px solid #d1d5db;
          color: #374151;
        }

        .btn-outline:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .btn-primary {
          background-color: #3b82f6;
          color: white;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #2563eb;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .bulk-actions-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 16px;
          }

          .selection-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
