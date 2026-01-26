'use client';

import { useState } from 'react';
import type { CompletionReason } from '@/db/helpers';

interface CompletionReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: CompletionReason) => void;
  chatCount?: number; // For bulk actions
}

const COMPLETION_REASONS: Array<{
  value: CompletionReason;
  label: string;
  icon: string;
  color: string;
}> = [
  { value: 'review_deleted', label: 'Отзыв удален', icon: '🗑️', color: 'text-green-600' },
  { value: 'review_upgraded', label: 'Отзыв дополнен', icon: '⭐', color: 'text-green-600' },
  { value: 'no_reply', label: 'Нет ответа', icon: '🔇', color: 'text-gray-500' },
  { value: 'old_dialog', label: 'Старый диалог', icon: '⏰', color: 'text-gray-500' },
  { value: 'not_our_issue', label: 'Не наш вопрос', icon: '❓', color: 'text-yellow-600' },
  { value: 'spam', label: 'Спам', icon: '🚫', color: 'text-red-600' },
  { value: 'negative', label: 'Негатив', icon: '😠', color: 'text-red-600' },
  { value: 'other', label: 'Другое', icon: '📋', color: 'text-gray-600' },
];

export default function CompletionReasonModal({
  isOpen,
  onClose,
  onConfirm,
  chatCount = 1,
}: CompletionReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<CompletionReason | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedReason) return;
    onConfirm(selectedReason);
    setSelectedReason(null);
  };

  const handleCancel = () => {
    setSelectedReason(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Закрыть {chatCount > 1 ? `${chatCount} чатов` : 'чат'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Укажите причину закрытия для аналитики
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="space-y-2">
            {COMPLETION_REASONS.map((reason) => (
              <label
                key={reason.value}
                className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                  selectedReason === reason.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="completion_reason"
                  value={reason.value}
                  checked={selectedReason === reason.value}
                  onChange={(e) => setSelectedReason(e.target.value as CompletionReason)}
                  className="sr-only"
                />
                <span className="text-2xl mr-3">{reason.icon}</span>
                <span className={`font-medium ${reason.color}`}>{reason.label}</span>
                {selectedReason === reason.value && (
                  <svg
                    className="ml-auto w-5 h-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              selectedReason
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            Закрыть {chatCount > 1 ? `${chatCount} чатов` : 'чат'}
          </button>
        </div>
      </div>
    </div>
  );
}
