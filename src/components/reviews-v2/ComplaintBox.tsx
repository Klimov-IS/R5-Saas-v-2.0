/**
 * ComplaintBox Component
 * Display and manage complaints (draft/sent/approved/rejected states)
 */

import React, { useState } from 'react';
import { AlertTriangle, Edit2, RefreshCw, Send, CheckCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Review } from '@/types/reviews';
import { StatusBadge } from './StatusBadge';

type Props = {
  review: Review;
};

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

export const ComplaintBox: React.FC<Props> = ({ review }) => {
  const params = useParams();
  const storeId = params?.storeId as string;
  const queryClient = useQueryClient();

  // Helper function to extract complaint text from JSON format or return as-is
  const extractComplaintText = (text: string | null): string => {
    if (!text) return '';

    try {
      // Try to extract JSON from markdown code block
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const jsonObj = JSON.parse(jsonMatch[1]);
        return jsonObj.complaintText || text;
      }

      // Try to parse as direct JSON
      const jsonObj = JSON.parse(text);
      if (jsonObj.complaintText) {
        return jsonObj.complaintText;
      }
    } catch {
      // If parsing fails, return original text
    }

    return text;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [complaintText, setComplaintText] = useState(extractComplaintText(review.complaint_text));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Generate complaint
  const handleGenerate = async () => {
    setIsGenerating(true);
    const generateToast = toast.loading('Генерация жалобы через AI...');

    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/${review.id}/generate-complaint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка генерации жалобы');
      }

      const result = await response.json();
      setComplaintText(result.complaintText);

      toast.success('Жалоба успешно сгенерирована', {
        id: generateToast,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['reviews-v2', storeId] });
    } catch (error: any) {
      toast.error(error.message || 'Не удалось сгенерировать жалобу', {
        id: generateToast,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save complaint draft
  const handleSave = async () => {
    setIsSaving(true);
    const saveToast = toast.loading('Сохранение черновика...');

    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/${review.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          complaintText: complaintText,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка сохранения');
      }

      toast.success('Черновик сохранен', {
        id: saveToast,
      });

      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['reviews-v2', storeId] });
    } catch (error: any) {
      toast.error(error.message || 'Не удалось сохранить черновик', {
        id: saveToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Regenerate complaint
  const handleRegenerate = async () => {
    await handleGenerate();
  };

  // Mark as sent
  const handleMarkAsSent = async () => {
    setIsMarking(true);
    const markToast = toast.loading('Отметка как отправленная...');

    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/${review.id}/mark-complaint-sent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка');
      }

      toast.success('Жалоба отмечена как отправленная', {
        id: markToast,
      });

      queryClient.invalidateQueries({ queryKey: ['reviews-v2', storeId] });
    } catch (error: any) {
      toast.error(error.message || 'Не удалось отметить жалобу', {
        id: markToast,
      });
    } finally {
      setIsMarking(false);
    }
  };

  // Handle different complaint states
  const renderComplaintContent = () => {
    // No complaint generated yet
    if (review.complaint_status === 'not_sent' && !review.complaint_text) {
      return (
        <div className="no-complaint">
          <p className="no-complaint-text">
            Жалоба еще не сгенерирована. Система автоматически генерирует жалобы на негативные отзывы (1-3★) каждый день в 6-8 утра МСК для активных товаров.
          </p>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <RefreshCw style={{ width: '14px', height: '14px' }} className={isGenerating ? 'spinning' : ''} />
            {isGenerating ? 'Генерация...' : 'Сгенерировать сейчас'}
          </button>
        </div>
      );
    }

    // Draft complaint
    if (review.complaint_status === 'draft' || (review.complaint_text && !review.complaint_sent_date)) {
      return (
        <div className="complaint-draft">
          <div className="complaint-header">
            <AlertTriangle className="complaint-icon" style={{ width: '18px', height: '18px', color: 'var(--color-warning)' }} />
            <span className="complaint-title">Черновик жалобы (AI)</span>
            <StatusBadge type="complaint_status" status="draft" />
          </div>

          {isEditing ? (
            <>
              <textarea
                className="complaint-textarea"
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                rows={6}
              />
              <div className="complaint-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setIsEditing(false);
                    setComplaintText(extractComplaintText(review.complaint_text));
                  }}
                  disabled={isSaving}
                >
                  Отмена
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <CheckCircle style={{ width: '14px', height: '14px' }} />
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="complaint-text">{extractComplaintText(review.complaint_text)}</div>
              {review.complaint_generated_at && (
                <div className="complaint-meta">
                  Сгенерирована: {formatDate(review.complaint_generated_at)}
                </div>
              )}
              <div className="complaint-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsEditing(true)}
                  disabled={isGenerating}
                >
                  <Edit2 style={{ width: '14px', height: '14px' }} />
                  Редактировать
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                >
                  <RefreshCw style={{ width: '14px', height: '14px' }} className={isGenerating ? 'spinning' : ''} />
                  {isGenerating ? 'Генерация...' : 'Перегенерировать'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleMarkAsSent}
                  disabled={isMarking}
                >
                  <Send style={{ width: '14px', height: '14px' }} />
                  {isMarking ? 'Отметка...' : 'Отметить отправленной'}
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    // Sent complaint
    if (review.complaint_status === 'sent' || review.complaint_sent_date) {
      return (
        <div className="complaint-status-box sent">
          <div className="complaint-header">
            <Send className="complaint-icon" style={{ width: '18px', height: '18px' }} />
            <span className="complaint-title">Жалоба отправлена</span>
            <StatusBadge type="complaint_status" status="sent" />
          </div>
          <div className="complaint-text">{extractComplaintText(review.complaint_text)}</div>
          <div className="complaint-meta">
            Отправлена: {formatDate(review.complaint_sent_date)}
          </div>
        </div>
      );
    }

    // Approved complaint
    if (review.complaint_status === 'approved') {
      return (
        <div className="complaint-status-box approved">
          <div className="complaint-header">
            <CheckCircle className="complaint-icon" style={{ width: '18px', height: '18px', color: 'var(--color-success)' }} />
            <span className="complaint-title">Жалоба одобрена WB</span>
            <StatusBadge type="complaint_status" status="approved" />
          </div>
          <div className="complaint-text">{extractComplaintText(review.complaint_text)}</div>
          <div className="complaint-success">
            ✅ Wildberries рассмотрел вашу жалобу и принял меры согласно правилам площадки.
          </div>
        </div>
      );
    }

    // Rejected complaint
    if (review.complaint_status === 'rejected') {
      return (
        <div className="complaint-status-box rejected">
          <div className="complaint-header">
            <AlertTriangle className="complaint-icon" style={{ width: '18px', height: '18px', color: 'var(--color-error)' }} />
            <span className="complaint-title">Жалоба отклонена WB</span>
            <StatusBadge type="complaint_status" status="rejected" />
          </div>
          <div className="complaint-text">{extractComplaintText(review.complaint_text)}</div>
          <div className="complaint-error">
            ❌ Wildberries отклонил жалобу. Отзыв не нарушает правила площадки.
          </div>
        </div>
      );
    }

    // Pending complaint
    if (review.complaint_status === 'pending') {
      return (
        <div className="complaint-status-box pending">
          <div className="complaint-header">
            <RefreshCw className="complaint-icon" style={{ width: '18px', height: '18px', color: 'var(--color-warning)' }} />
            <span className="complaint-title">Жалоба на рассмотрении</span>
            <StatusBadge type="complaint_status" status="pending" />
          </div>
          <div className="complaint-text">{extractComplaintText(review.complaint_text)}</div>
          <div className="complaint-pending">
            ⏳ Wildberries рассматривает вашу жалобу. Обычно это занимает 1-3 дня.
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {renderComplaintContent()}

      <style jsx>{`
        .no-complaint {
          background: var(--color-border-light);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          text-align: center;
        }

        .no-complaint-text {
          font-size: var(--font-size-sm);
          color: var(--color-muted);
          margin-bottom: var(--spacing-md);
          line-height: 1.5;
        }

        .complaint-draft {
          background: #fffbeb;
          border: 1px solid #fbbf24;
          border-left: 4px solid var(--color-warning);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
        }

        .complaint-status-box {
          background: white;
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          border-left: 4px solid;
        }

        .complaint-status-box.sent {
          border-color: #3b82f6;
          background: #f0f9ff;
        }

        .complaint-status-box.approved {
          border-color: var(--color-success);
          background: #f0fdf4;
        }

        .complaint-status-box.rejected {
          border-color: var(--color-error);
          background: #fef2f2;
        }

        .complaint-status-box.pending {
          border-color: var(--color-warning);
          background: #fffbeb;
        }

        .complaint-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .complaint-icon {
          color: var(--color-warning);
        }

        .complaint-title {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-foreground);
          flex: 1;
        }

        .complaint-text {
          background: white;
          border: 1px solid #fbbf24;
          border-radius: var(--radius-base);
          padding: var(--spacing-md);
          font-size: var(--font-size-sm);
          line-height: 1.5;
          color: #78350f;
          margin-bottom: var(--spacing-md);
        }

        .complaint-textarea {
          width: 100%;
          padding: var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-base);
          font-size: var(--font-size-sm);
          font-family: inherit;
          line-height: 1.5;
          resize: vertical;
          margin-bottom: var(--spacing-md);
        }

        .complaint-textarea:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .complaint-meta {
          font-size: var(--font-size-xs);
          color: var(--color-muted);
          margin-bottom: var(--spacing-md);
        }

        .complaint-actions {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .complaint-success,
        .complaint-error,
        .complaint-pending {
          font-size: var(--font-size-sm);
          padding: var(--spacing-md);
          border-radius: var(--radius-base);
          margin-top: var(--spacing-md);
        }

        .complaint-success {
          background: #d1fae5;
          color: #065f46;
        }

        .complaint-error {
          background: #fee2e2;
          color: #991b1b;
        }

        .complaint-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          outline: none;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: var(--font-size-xs);
        }

        .btn-primary {
          background-color: var(--color-primary);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .btn-outline {
          background-color: white;
          color: var(--color-foreground);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-sm);
        }

        .btn-outline:hover:not(:disabled) {
          background-color: var(--color-border-light);
          box-shadow: var(--shadow-md);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};
