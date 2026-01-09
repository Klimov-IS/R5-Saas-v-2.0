'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import type { StoreStatus } from '@/db/helpers';

interface Store {
  id: string;
  name: string;
  api_token: string;
  content_api_token: string;
  feedbacks_api_token: string;
  chat_api_token: string;
  status: StoreStatus;
}

interface EditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store | null;
}

export function EditStoreModal({ isOpen, onClose, store }: EditStoreModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    api_token: '',
    content_api_token: '',
    feedbacks_api_token: '',
    chat_api_token: '',
    status: 'active' as StoreStatus,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill form when store changes
  useEffect(() => {
    if (store) {
      setFormData({
        name: store.name,
        // Show masked token instead of real value for security
        api_token: '••••••••',
        content_api_token: store.content_api_token ? '••••••••' : '',
        feedbacks_api_token: store.feedbacks_api_token ? '••••••••' : '',
        chat_api_token: store.chat_api_token ? '••••••••' : '',
        status: store.status,
      });
    }
  }, [store]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название магазина обязательно';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Минимум 3 символа';
    }

    // API Token is optional when editing - only validate if user is changing it
    if (formData.api_token.trim() && formData.api_token !== '••••••••' && formData.api_token.trim().length < 10) {
      newErrors.api_token = 'Невалидный токен (минимум 10 символов)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!store) return;

    if (!validateForm()) {
      toast.error('Ошибка валидации', 'Пожалуйста, заполните обязательные поля');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Сохранение...', 'Обновляем данные магазина');

    try {
      // Build update payload - only send changed fields
      const updates: any = {
        name: formData.name.trim(),
        status: formData.status,
      };

      // Only include tokens if they were changed (not masked)
      if (formData.api_token && formData.api_token !== '••••••••') {
        updates.apiToken = formData.api_token.trim();
      }

      if (formData.content_api_token && formData.content_api_token !== '••••••••') {
        updates.contentApiToken = formData.content_api_token.trim();
      }

      if (formData.feedbacks_api_token && formData.feedbacks_api_token !== '••••••••') {
        updates.feedbacksApiToken = formData.feedbacks_api_token.trim();
      }

      if (formData.chat_api_token && formData.chat_api_token !== '••••••••') {
        updates.chatApiToken = formData.chat_api_token.trim();
      }

      const response = await fetch(`/api/stores/${store.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось обновить магазин');
      }

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Invalidate queries to refetch stores list
      await queryClient.invalidateQueries({ queryKey: ['stores'] });

      // Show success toast
      toast.success('Успешно сохранено', `Магазин "${formData.name}" обновлен`);

      // Close modal
      onClose();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(
        'Ошибка обновления',
        error instanceof Error ? error.message : 'Не удалось обновить магазин'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen || !store) return null;

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          padding: '16px'
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'hsl(var(--card))',
            borderRadius: '8px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '672px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px',
            borderBottom: '1px solid hsl(var(--border))'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'hsl(var(--foreground))'
            }}>
              Редактировать магазин
            </h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                color: 'hsl(var(--muted-foreground))',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                padding: '4px',
                borderRadius: '2px',
                border: 'none',
                background: 'transparent',
                transition: 'all 0.2s',
                opacity: isSubmitting ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.color = 'hsl(var(--foreground))';
                  e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>
          </div>

          {/* Body */}
          <div style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overflowY: 'auto',
            flex: '1 1 auto'
          }}>
            {/* Store Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                marginBottom: '6px'
              }}>
                Название магазина <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isSubmitting}
                placeholder="ИП Иванов А. А."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${errors.name ? 'hsl(var(--destructive))' : 'hsl(var(--border))'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  cursor: isSubmitting ? 'not-allowed' : 'text',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (!errors.name) {
                    e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                    e.currentTarget.style.boxShadow = '0 0 0 3px hsla(var(--primary), 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.name ? 'hsl(var(--destructive))' : 'hsl(var(--border))';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {errors.name && (
                <p style={{
                  fontSize: '12px',
                  color: 'hsl(var(--destructive))',
                  marginTop: '4px'
                }}>{errors.name}</p>
              )}
            </div>

            {/* API Token */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                marginBottom: '6px'
              }}>
                API Token (WB)
              </label>
              <input
                type="text"
                value={formData.api_token}
                onChange={(e) => handleChange('api_token', e.target.value)}
                disabled={isSubmitting}
                placeholder="Оставьте ••••••••, чтобы не менять токен"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${errors.api_token ? 'hsl(var(--destructive))' : 'hsl(var(--border))'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  cursor: isSubmitting ? 'not-allowed' : 'text',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (!errors.api_token) {
                    e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                    e.currentTarget.style.boxShadow = '0 0 0 3px hsla(var(--primary), 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.api_token ? 'hsl(var(--destructive))' : 'hsl(var(--border))';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {errors.api_token && (
                <p style={{
                  fontSize: '12px',
                  color: 'hsl(var(--destructive))',
                  marginTop: '4px'
                }}>{errors.api_token}</p>
              )}
            </div>

            {/* Optional Tokens */}
            <div style={{
              borderTop: '1px solid hsl(var(--border))',
              paddingTop: '16px'
            }}>
              <p style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                marginBottom: '12px'
              }}>
                Дополнительные токены (опционально)
              </p>
              <p style={{
                fontSize: '12px',
                color: 'hsl(var(--muted-foreground))',
                marginBottom: '16px'
              }}>
                Если токены отличаются от основного, укажите их ниже. Иначе будет использован основной токен.
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Content API Token */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '6px'
                  }}>
                    Content API Token
                  </label>
                  <input
                    type="text"
                    value={formData.content_api_token}
                    onChange={(e) => handleChange('content_api_token', e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Если отличается от основного"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      outline: 'none',
                      transition: 'all 0.2s',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      cursor: isSubmitting ? 'not-allowed' : 'text',
                      opacity: isSubmitting ? 0.6 : 1
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                      e.currentTarget.style.boxShadow = '0 0 0 3px hsla(var(--primary), 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(var(--border))';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Feedbacks API Token */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '6px'
                  }}>
                    Feedbacks API Token
                  </label>
                  <input
                    type="text"
                    value={formData.feedbacks_api_token}
                    onChange={(e) => handleChange('feedbacks_api_token', e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Если отличается от основного"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      outline: 'none',
                      transition: 'all 0.2s',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      cursor: isSubmitting ? 'not-allowed' : 'text',
                      opacity: isSubmitting ? 0.6 : 1
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                      e.currentTarget.style.boxShadow = '0 0 0 3px hsla(var(--primary), 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(var(--border))';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Chat API Token */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '6px'
                  }}>
                    Chat API Token
                  </label>
                  <input
                    type="text"
                    value={formData.chat_api_token}
                    onChange={(e) => handleChange('chat_api_token', e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Если отличается от основного"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      outline: 'none',
                      transition: 'all 0.2s',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      cursor: isSubmitting ? 'not-allowed' : 'text',
                      opacity: isSubmitting ? 0.6 : 1
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                      e.currentTarget.style.boxShadow = '0 0 0 3px hsla(var(--primary), 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(var(--border))';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Status - All 5 options */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                marginBottom: '6px'
              }}>
                Статус
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                  e.currentTarget.style.boxShadow = '0 0 0 3px hsla(var(--primary), 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'hsl(var(--border))';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <option value="active">Активен</option>
                <option value="trial">Тестовый</option>
                <option value="paused">На паузе</option>
                <option value="stopped">Остановлен</option>
                <option value="archived">Архивный</option>
              </select>
              <p style={{
                fontSize: '12px',
                color: 'hsl(var(--muted-foreground))',
                marginTop: '4px'
              }}>
                {formData.status === 'archived' && '⚠️ Архивные магазины скрыты из основного списка'}
                {formData.status === 'stopped' && '⚠️ Синхронизация приостановлена'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '24px',
              borderTop: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--muted))',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'hsl(var(--foreground))',
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isSubmitting ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--card))';
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'white',
                  backgroundColor: 'hsl(var(--primary))',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isSubmitting ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'hsl(217, 91%, 50%)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--primary))';
                }}
              >
                {isSubmitting && <Loader2 className="spinner" style={{ width: '16px', height: '16px' }} />}
                {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
