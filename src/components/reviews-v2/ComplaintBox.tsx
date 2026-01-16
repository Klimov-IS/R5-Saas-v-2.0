/**
 * ComplaintBox Component - Reviews Redesign Prototype
 * Matches reviews-redesign.html structure (lines 850-868)
 * Simple, clean complaint display with .complaint-box wrapper
 */

import React, { useState } from 'react';
import { Edit2, RefreshCw, Send } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Review } from '@/types/reviews';

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

      const result = await response.json();

      // Update local state with saved value
      if (result.data && result.data.complaint_text) {
        setComplaintText(extractComplaintText(result.data.complaint_text));
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

  // Determine if complaint exists
  const hasComplaint = review.complaint_text && review.complaint_text.trim().length > 0;

  return (
    <>
      <div className="complaint-box">
        <div className="complaint-header">⚠️ Жалоба на отзыв</div>

        {!hasComplaint ? (
          /* NO COMPLAINT YET */
          <>
            <div className="no-complaint-text">
              Жалоба еще не сгенерирована. Система автоматически генерирует жалобы на негативные отзывы (1-3★) каждый день в 6-8 утра МСК для активных товаров.
            </div>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <RefreshCw style={{ width: '14px', height: '14px' }} className={isGenerating ? 'spinning' : ''} />
              {isGenerating ? 'Генерация...' : 'Сгенерировать сейчас'}
            </button>
          </>
        ) : (
          /* COMPLAINT EXISTS */
          <>
            {/* Category */}
            {review.complaint_category && (
              <div className="complaint-field">
                <div className="field-label">Категория жалобы</div>
                <div className="meta-value">{review.complaint_category}</div>
              </div>
            )}

            {/* Complaint Text */}
            <div className="complaint-field">
              <div className="field-label">Текст жалобы</div>
              {isEditing ? (
                <textarea
                  className="complaint-textarea"
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  rows={8}
                />
              ) : (
                <div className="complaint-text-box">
                  {complaintText}
                </div>
              )}
              {review.complaint_generated_at && !isEditing && (
                <div className="complaint-timestamp">
                  Сгенерировано: {formatDate(review.complaint_generated_at)}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="complaint-actions">
              {isEditing ? (
                <>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setIsEditing(false);
                      setComplaintText(extractComplaintText(review.complaint_text));
                    }}
                    disabled={isSaving}
                  >
                    Отмена
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-outline"
                    onClick={() => setIsEditing(true)}
                    disabled={isGenerating}
                  >
                    <Edit2 style={{ width: '14px', height: '14px' }} />
                    Редактировать
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    <RefreshCw style={{ width: '14px', height: '14px' }} className={isGenerating ? 'spinning' : ''} />
                    {isGenerating ? 'Генерация...' : 'Перегенерировать'}
                  </button>
                  {!review.complaint_sent_date && (
                    <button
                      className="btn btn-primary"
                      onClick={handleMarkAsSent}
                      disabled={isMarking}
                    >
                      <Send style={{ width: '14px', height: '14px' }} />
                      {isMarking ? 'Отметка...' : 'Отметить отправленной'}
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        /* Complaint Box - matches reviews-redesign.html prototype */
        .complaint-box {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
        }

        .complaint-header {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }

        /* No Complaint State */
        .no-complaint-text {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 20px;
          line-height: 1.6;
          text-align: center;
          padding: 16px;
        }

        /* Complaint Fields */
        .complaint-field {
          margin-bottom: 16px;
        }

        .field-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 6px;
        }

        .meta-value {
          font-size: 13px;
          color: #1e293b;
          font-weight: 500;
        }

        /* Complaint Text Box - светло-серый фон с оранжевым левым бордером */
        .complaint-text-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          font-size: 14px;
          line-height: 1.6;
          color: #334155;
          white-space: pre-wrap;
        }

        /* Textarea for editing */
        .complaint-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          line-height: 1.5;
          resize: vertical;
          min-height: 150px;
        }

        .complaint-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        /* Timestamp */
        .complaint-timestamp {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 8px;
        }

        /* Actions */
        .complaint-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
          outline: none;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
          border: 1px solid #3b82f6;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
          border-color: #2563eb;
        }

        .btn-outline {
          background: white;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }

        .btn-outline:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        /* Spinning animation for loading icons */
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
