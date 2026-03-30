'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

interface Store {
  id: string;
  name: string;
  inn?: string;
  cost_cd?: string;
  referral?: string;
  api_token: string;
  content_api_token: string;
  feedbacks_api_token: string;
  chat_api_token: string;
  is_active: boolean;
}

interface EditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store | null;
}

export function EditStoreModal({ isOpen, onClose, store }: EditStoreModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    inn: '',
    cost_cd: '',
    referral: '',
    api_token: '',
    content_api_token: '',
    feedbacks_api_token: '',
    chat_api_token: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill form when store changes, reset delete confirm
  useEffect(() => {
    if (store) {
      setFormData({
        name: store.name,
        inn: store.inn || '',
        cost_cd: store.cost_cd || '',
        referral: store.referral || '',
        // Show masked token instead of real value for security
        api_token: '••••••••',
        content_api_token: store.content_api_token ? '••••••••' : '',
        feedbacks_api_token: store.feedbacks_api_token ? '••••••••' : '',
        chat_api_token: store.chat_api_token ? '••••••••' : '',
        is_active: store.is_active,
      });
      setShowDeleteConfirm(false);
      setDeleteConfirmName('');
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
        inn: formData.inn.trim() || null,
        costCd: formData.cost_cd.trim() || null,
        referral: formData.referral.trim() || null,
        is_active: formData.is_active,
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
          'Authorization': `Bearer ${API_KEY}`,
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

  const handleDelete = async () => {
    if (!store || deleteConfirmName !== store.name) return;

    setIsDeleting(true);
    const loadingToast = toast.loading('Удаление...', 'Удаляем магазин и все связанные данные');

    try {
      const response = await fetch(`/api/stores/${store.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось удалить магазин');
      }

      toast.dismiss(loadingToast);
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Магазин удалён', `Магазин "${store.name}" и все данные удалены безвозвратно`);
      setShowDeleteConfirm(false);
      setDeleteConfirmName('');
      onClose();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(
        'Ошибка удаления',
        error instanceof Error ? error.message : 'Не удалось удалить магазин'
      );
    } finally {
      setIsDeleting(false);
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

            {/* INN + Cost CD row */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'hsl(var(--muted-foreground))',
                  marginBottom: '6px'
                }}>
                  ИНН
                </label>
                <input
                  type="text"
                  value={formData.inn}
                  onChange={(e) => handleChange('inn', e.target.value)}
                  disabled={isSubmitting}
                  placeholder="1234567890"
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
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'hsl(var(--muted-foreground))',
                  marginBottom: '6px'
                }}>
                  Стоимость ЦД
                </label>
                <input
                  type="text"
                  value={formData.cost_cd}
                  onChange={(e) => handleChange('cost_cd', e.target.value)}
                  disabled={isSubmitting}
                  placeholder="500 ₽"
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

            {/* Referral */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--muted-foreground))',
                marginBottom: '6px'
              }}>
                Реферал
              </label>
              <input
                type="text"
                value={formData.referral}
                onChange={(e) => handleChange('referral', e.target.value)}
                disabled={isSubmitting}
                placeholder="Имя реферала"
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

            {/* Active Status */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                  disabled={isSubmitting}
                  style={{ width: 18, height: 18, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                />
                Магазин активен
              </label>
              {!formData.is_active && (
                <p style={{
                  fontSize: '12px',
                  color: 'hsl(var(--muted-foreground))',
                  marginTop: '4px'
                }}>
                  Неактивный магазин скрыт из автоматизаций и синхронизации
                </p>
              )}
            </div>

            {/* Danger Zone — Delete Store */}
            <div style={{
              borderTop: '1px solid hsl(var(--destructive) / 0.3)',
              paddingTop: '16px',
              marginTop: '4px'
            }}>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'hsl(var(--destructive))',
                    backgroundColor: 'transparent',
                    border: '1px solid hsl(var(--destructive) / 0.3)',
                    borderRadius: '6px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isSubmitting ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = 'hsl(var(--destructive) / 0.1)';
                      e.currentTarget.style.borderColor = 'hsl(var(--destructive))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'hsl(var(--destructive) / 0.3)';
                  }}
                >
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                  Удалить магазин
                </button>
              ) : (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'hsl(var(--destructive) / 0.05)',
                  border: '1px solid hsl(var(--destructive) / 0.3)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'hsl(var(--destructive))'
                  }}>
                    Безвозвратное удаление
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: 'hsl(var(--muted-foreground))'
                  }}>
                    Будут удалены все отзывы, чаты, сообщения, товары, жалобы и другие данные этого магазина. Это действие нельзя отменить.
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: 'hsl(var(--foreground))'
                  }}>
                    Введите название магазина <strong>{store.name}</strong> для подтверждения:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    disabled={isDeleting}
                    placeholder={store.name}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid hsl(var(--destructive) / 0.3)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}
                      disabled={isDeleting}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'hsl(var(--foreground))',
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting || deleteConfirmName !== store.name}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'white',
                        backgroundColor: deleteConfirmName === store.name
                          ? 'hsl(var(--destructive))'
                          : 'hsl(var(--muted-foreground))',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: (isDeleting || deleteConfirmName !== store.name) ? 'not-allowed' : 'pointer',
                        opacity: (isDeleting || deleteConfirmName !== store.name) ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isDeleting && <Loader2 className="spinner" style={{ width: '14px', height: '14px' }} />}
                      {isDeleting ? 'Удаление...' : 'Удалить безвозвратно'}
                    </button>
                  </div>
                </div>
              )}
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
