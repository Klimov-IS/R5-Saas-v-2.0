'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2, CheckCircle, AlertTriangle, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from '@/lib/toast';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

interface AddOzonStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ValidationResult {
  valid: boolean;
  sellerName?: string;
  companyName?: string;
  inn?: string;
  subscription?: string;
  hasChatAccess?: boolean;
  hasReviewAccess?: boolean;
  roles?: string[];
  ratings?: Array<{ name: string; group: string; value: number }>;
  error?: string;
}

type Step = 'credentials' | 'preview';

export function AddOzonStoreModal({ isOpen, onClose }: AddOzonStoreModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('credentials');
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [storeName, setStoreName] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setStep('credentials');
    setClientId('');
    setApiKey('');
    setStoreName('');
    setValidation(null);
    setErrors({});
  };

  const handleClose = () => {
    if (!isValidating && !isCreating) {
      resetForm();
      onClose();
    }
  };

  // Step 1: Validate OZON credentials
  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!clientId.trim()) {
      newErrors.clientId = 'Client-Id обязателен';
    } else if (!/^\d+$/.test(clientId.trim())) {
      newErrors.clientId = 'Client-Id должен быть числом';
    }
    if (!apiKey.trim()) {
      newErrors.apiKey = 'Api-Key обязателен';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsValidating(true);
    setErrors({});

    try {
      const res = await fetch('/api/stores/ozon/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ clientId: clientId.trim(), apiKey: apiKey.trim() }),
      });

      const data: ValidationResult = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка валидации');
      }

      setValidation(data);

      if (data.valid) {
        setStoreName(data.sellerName || '');
        setStep('preview');
      } else {
        setErrors({ apiKey: data.error || 'Неверные учётные данные' });
      }
    } catch (error) {
      toast.error(
        'Ошибка проверки',
        error instanceof Error ? error.message : 'Не удалось проверить учётные данные'
      );
    } finally {
      setIsValidating(false);
    }
  };

  // Step 2: Create OZON store
  const handleCreate = async () => {
    setIsCreating(true);
    const loadingToast = toast.loading('Создание магазина OZON...', 'Подключаем к системе');

    try {
      const res = await fetch('/api/stores/ozon/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          clientId: clientId.trim(),
          apiKey: apiKey.trim(),
          name: storeName.trim(),
        }),
      });

      const data = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        throw new Error(data.error || 'Не удалось создать магазин');
      }

      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Магазин OZON подключён', `"${storeName}" добавлен в систему`);
      resetForm();
      onClose();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(
        'Ошибка создания',
        error instanceof Error ? error.message : 'Не удалось создать магазин'
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const isLoading = isValidating || isCreating;

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
          padding: '16px',
        }}
        onClick={handleClose}
      >
        <div
          style={{
            backgroundColor: 'hsl(var(--card))',
            borderRadius: '8px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px',
              borderBottom: '1px solid hsl(var(--border))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #005BFF, #003399)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                OZ
              </div>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                }}
              >
                {step === 'credentials' ? 'Подключить OZON магазин' : 'Подтверждение'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              style={{
                color: 'hsl(var(--muted-foreground))',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                padding: '4px',
                borderRadius: '2px',
                border: 'none',
                background: 'transparent',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              padding: '24px',
              overflowY: 'auto',
              maxHeight: 'calc(90vh - 140px)',
            }}
          >
            {step === 'credentials' && (
              <form onSubmit={handleValidate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'hsl(var(--muted-foreground))',
                    lineHeight: 1.5,
                  }}
                >
                  Введите Client-Id и Api-Key из личного кабинета OZON Seller.
                  Ключи можно получить в Настройки &rarr; Seller API.
                </p>

                {/* Client-Id */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'hsl(var(--foreground))',
                      marginBottom: '6px',
                    }}
                  >
                    Client-Id <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      if (errors.clientId) setErrors((prev) => ({ ...prev, clientId: '' }));
                    }}
                    disabled={isValidating}
                    placeholder="645186"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${errors.clientId ? 'hsl(var(--destructive))' : 'hsl(var(--border))'}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      outline: 'none',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      cursor: isValidating ? 'not-allowed' : 'text',
                      opacity: isValidating ? 0.6 : 1,
                    }}
                  />
                  {errors.clientId && (
                    <p style={{ fontSize: '12px', color: 'hsl(var(--destructive))', marginTop: '4px' }}>
                      {errors.clientId}
                    </p>
                  )}
                </div>

                {/* Api-Key */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'hsl(var(--foreground))',
                      marginBottom: '6px',
                    }}
                  >
                    Api-Key <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (errors.apiKey) setErrors((prev) => ({ ...prev, apiKey: '' }));
                    }}
                    disabled={isValidating}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${errors.apiKey ? 'hsl(var(--destructive))' : 'hsl(var(--border))'}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      outline: 'none',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      cursor: isValidating ? 'not-allowed' : 'text',
                      opacity: isValidating ? 0.6 : 1,
                    }}
                  />
                  {errors.apiKey && (
                    <p style={{ fontSize: '12px', color: 'hsl(var(--destructive))', marginTop: '4px' }}>
                      {errors.apiKey}
                    </p>
                  )}
                </div>

                {/* Validate Button */}
                <button
                  type="submit"
                  disabled={isValidating}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'white',
                    background: 'linear-gradient(135deg, #005BFF, #003399)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isValidating ? 'not-allowed' : 'pointer',
                    opacity: isValidating ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {isValidating && <Loader2 className="spinner" style={{ width: '16px', height: '16px' }} />}
                  {isValidating ? 'Проверяем...' : 'Проверить подключение'}
                </button>
              </form>
            )}

            {step === 'preview' && validation?.valid && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Success badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    backgroundColor: 'hsla(142, 76%, 36%, 0.1)',
                    border: '1px solid hsla(142, 76%, 36%, 0.2)',
                    borderRadius: '6px',
                    color: 'hsl(142, 76%, 36%)',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <CheckCircle style={{ width: '18px', height: '18px' }} />
                  Учётные данные подтверждены
                </div>

                {/* Store info card */}
                <div
                  style={{
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Store Name (editable) */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        color: 'hsl(var(--muted-foreground))',
                        marginBottom: '4px',
                      }}
                    >
                      Название магазина
                    </label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      disabled={isCreating}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '4px',
                        fontSize: '15px',
                        fontWeight: 600,
                        outline: 'none',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                  </div>

                  {/* Company + INN */}
                  {validation.companyName && (
                    <InfoRow label="Юрлицо" value={validation.companyName} />
                  )}
                  {validation.inn && <InfoRow label="ИНН" value={validation.inn} />}

                  {/* Subscription */}
                  <InfoRow label="Подписка" value={validation.subscription || '—'} />

                  {/* Access */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid hsl(var(--border))',
                    }}
                  >
                    <AccessBadge
                      label="Чаты"
                      hasAccess={!!validation.hasChatAccess}
                    />
                    <AccessBadge
                      label="Отзывы"
                      hasAccess={!!validation.hasReviewAccess}
                    />
                  </div>

                  {/* Premium Plus Warning */}
                  {!validation.hasChatAccess && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 14px',
                        backgroundColor: 'hsla(38, 92%, 50%, 0.1)',
                        border: '1px solid hsla(38, 92%, 50%, 0.2)',
                        borderRadius: '6px',
                        color: 'hsl(38, 92%, 40%)',
                        fontSize: '13px',
                        lineHeight: 1.5,
                      }}
                    >
                      <AlertTriangle
                        style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }}
                      />
                      <span>
                        Для работы с чатами и отзывами покупателей требуется подписка
                        OZON Premium Plus. Товары и рейтинги будут синхронизироваться.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: step === 'preview' ? 'space-between' : 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              borderTop: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--muted))',
            }}
          >
            {step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('credentials')}
                disabled={isCreating}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'hsl(var(--foreground))',
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  opacity: isCreating ? 0.5 : 1,
                }}
              >
                Назад
              </button>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'hsl(var(--foreground))',
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                Отмена
              </button>
              {step === 'preview' && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating || !storeName.trim()}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'white',
                    background: 'linear-gradient(135deg, #005BFF, #003399)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isCreating || !storeName.trim() ? 'not-allowed' : 'pointer',
                    opacity: isCreating || !storeName.trim() ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {isCreating && <Loader2 className="spinner" style={{ width: '16px', height: '16px' }} />}
                  {isCreating ? 'Создание...' : 'Добавить магазин'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 500, color: 'hsl(var(--foreground))' }}>
        {value}
      </span>
    </div>
  );
}

function AccessBadge({ label, hasAccess }: { label: string; hasAccess: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 500,
        backgroundColor: hasAccess ? 'hsla(142, 76%, 36%, 0.1)' : 'hsla(0, 0%, 50%, 0.1)',
        color: hasAccess ? 'hsl(142, 76%, 36%)' : 'hsl(var(--muted-foreground))',
      }}
    >
      {hasAccess ? (
        <ShieldCheck style={{ width: '14px', height: '14px' }} />
      ) : (
        <ShieldX style={{ width: '14px', height: '14px' }} />
      )}
      {label}
    </div>
  );
}
