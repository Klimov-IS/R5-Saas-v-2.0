'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { generateFirebaseId } from '@/lib/utils';
import type { StoreStatus } from '@/db/helpers';

interface AddStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddStoreModal({ isOpen, onClose }: AddStoreModalProps) {
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название магазина обязательно';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Минимум 3 символа';
    }

    if (!formData.api_token.trim()) {
      newErrors.api_token = 'API токен обязателен';
    } else if (formData.api_token.trim().length < 10) {
      newErrors.api_token = 'Невалидный токен';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Ошибка валидации', 'Пожалуйста, заполните обязательные поля');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Создание магазина...', 'Генерируем ID и сохраняем данные');

    try {
      const storeId = generateFirebaseId();

      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue`,
        },
        body: JSON.stringify({
          id: storeId,
          name: formData.name.trim(),
          api_token: formData.api_token.trim(),
          content_api_token: formData.content_api_token.trim() || formData.api_token.trim(),
          feedbacks_api_token: formData.feedbacks_api_token.trim() || formData.api_token.trim(),
          chat_api_token: formData.chat_api_token.trim() || formData.api_token.trim(),
          status: formData.status,
          owner_id: 'default', // TODO: Replace with actual user ID from auth
          total_reviews: 0,
          total_chats: 0,
          chat_tag_counts: {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось создать магазин');
      }

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Invalidate queries to refetch stores list
      await queryClient.invalidateQueries({ queryKey: ['stores'] });

      // Show success toast
      toast.success('Магазин создан', `"${formData.name}" успешно добавлен в систему`);

      // Reset form and close modal
      setFormData({
        name: '',
        api_token: '',
        content_api_token: '',
        feedbacks_api_token: '',
        chat_api_token: '',
        status: 'active',
      });
      setErrors({});
      onClose();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(
        'Ошибка создания',
        error instanceof Error ? error.message : 'Не удалось создать магазин'
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

  if (!isOpen) return null;

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
            overflow: 'hidden'
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
              Добавить новый магазин
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
          <form onSubmit={handleSubmit} style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 140px)'
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
                API Token (WB) <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.api_token}
                onChange={(e) => handleChange('api_token', e.target.value)}
                disabled={isSubmitting}
                placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6..."
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

            {/* Status */}
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
            </div>
          </form>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '24px',
            borderTop: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--muted))'
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
              onClick={handleSubmit}
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
              {isSubmitting ? 'Создание...' : 'Добавить магазин'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
