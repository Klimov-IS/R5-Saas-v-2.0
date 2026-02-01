'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export interface CustomRules {
  submit_complaints: boolean;
  complaint_rating_1: boolean;
  complaint_rating_2: boolean;
  complaint_rating_3: boolean;
  complaint_rating_4: boolean;
  work_in_chats: boolean;
  chat_rating_1: boolean;
  chat_rating_2: boolean;
  chat_rating_3: boolean;
  chat_rating_4: boolean;
  chat_strategy: 'upgrade_to_5' | 'delete' | 'both';
  offer_compensation: boolean;
  max_compensation: string;
  compensation_type: 'cashback' | 'refund';
  compensation_by: 'r5' | 'seller';
}

interface CustomRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (rules: CustomRules) => void;
  selectedCount: number;
}

const DEFAULT_RULES: CustomRules = {
  submit_complaints: true,
  complaint_rating_1: true,
  complaint_rating_2: true,
  complaint_rating_3: true,
  complaint_rating_4: false,
  work_in_chats: true,
  chat_rating_1: true,
  chat_rating_2: true,
  chat_rating_3: true,
  chat_rating_4: true,
  chat_strategy: 'both',
  offer_compensation: true,
  max_compensation: '500',
  compensation_type: 'cashback',
  compensation_by: 'r5',
};

export function CustomRulesModal({ isOpen, onClose, onApply, selectedCount }: CustomRulesModalProps) {
  const [rules, setRules] = useState<CustomRules>(DEFAULT_RULES);

  const updateRule = <K extends keyof CustomRules>(key: K, value: CustomRules[K]) => {
    setRules(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    onApply(rules);
    onClose();
  };

  if (!isOpen) return null;

  return (
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
          maxWidth: '560px',
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
          padding: '20px 24px',
          borderBottom: '1px solid hsl(var(--border))'
        }}>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              margin: 0
            }}>
              Настройка правил
            </h2>
            <p style={{
              fontSize: '13px',
              color: 'hsl(var(--muted-foreground))',
              margin: '4px 0 0 0'
            }}>
              Применить к {selectedCount} товар{selectedCount === 1 ? 'у' : selectedCount < 5 ? 'ам' : 'ам'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Complaints Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                id="submit_complaints"
                checked={rules.submit_complaints}
                onChange={(e) => updateRule('submit_complaints', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="submit_complaints" style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                cursor: 'pointer'
              }}>
                Подавать жалобы
              </label>
            </div>

            {rules.submit_complaints && (
              <div style={{
                display: 'flex',
                gap: '12px',
                marginLeft: '24px',
                flexWrap: 'wrap'
              }}>
                {[1, 2, 3, 4].map(rating => (
                  <label key={rating} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: rules[`complaint_rating_${rating}` as keyof CustomRules]
                      ? 'hsl(var(--primary) / 0.1)'
                      : 'hsl(var(--muted))',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    border: rules[`complaint_rating_${rating}` as keyof CustomRules]
                      ? '1px solid hsl(var(--primary))'
                      : '1px solid transparent'
                  }}>
                    <input
                      type="checkbox"
                      checked={rules[`complaint_rating_${rating}` as keyof CustomRules] as boolean}
                      onChange={(e) => updateRule(`complaint_rating_${rating}` as keyof CustomRules, e.target.checked)}
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    {'⭐'.repeat(rating)} {rating}
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Chats Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                id="work_in_chats"
                checked={rules.work_in_chats}
                onChange={(e) => updateRule('work_in_chats', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="work_in_chats" style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                cursor: 'pointer'
              }}>
                Работать в чатах
              </label>
            </div>

            {rules.work_in_chats && (
              <div style={{ marginLeft: '24px' }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '12px',
                  flexWrap: 'wrap'
                }}>
                  {[1, 2, 3, 4].map(rating => (
                    <label key={rating} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: rules[`chat_rating_${rating}` as keyof CustomRules]
                        ? 'hsl(var(--primary) / 0.1)'
                        : 'hsl(var(--muted))',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      border: rules[`chat_rating_${rating}` as keyof CustomRules]
                        ? '1px solid hsl(var(--primary))'
                        : '1px solid transparent'
                    }}>
                      <input
                        type="checkbox"
                        checked={rules[`chat_rating_${rating}` as keyof CustomRules] as boolean}
                        onChange={(e) => updateRule(`chat_rating_${rating}` as keyof CustomRules, e.target.checked)}
                        style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                      />
                      {'⭐'.repeat(rating)} {rating}
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{
                    fontSize: '13px',
                    color: 'hsl(var(--muted-foreground))',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    Стратегия чатов
                  </label>
                  <select
                    value={rules.chat_strategy}
                    onChange={(e) => updateRule('chat_strategy', e.target.value as CustomRules['chat_strategy'])}
                    style={{
                      width: '100%',
                      maxWidth: '280px',
                      padding: '8px 12px',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="upgrade_to_5">Поднять до 5 звезд</option>
                    <option value="delete">Удаление отзыва</option>
                    <option value="both">Оба варианта</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Compensation Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                id="offer_compensation"
                checked={rules.offer_compensation}
                onChange={(e) => updateRule('offer_compensation', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="offer_compensation" style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                cursor: 'pointer'
              }}>
                Предлагать компенсацию
              </label>
            </div>

            {rules.offer_compensation && (
              <div style={{
                marginLeft: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div>
                  <label style={{
                    fontSize: '13px',
                    color: 'hsl(var(--muted-foreground))',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    Максимальная сумма (₽)
                  </label>
                  <input
                    type="text"
                    value={rules.max_compensation}
                    onChange={(e) => updateRule('max_compensation', e.target.value)}
                    placeholder="500"
                    style={{
                      width: '120px',
                      padding: '8px 12px',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{
                      fontSize: '13px',
                      color: 'hsl(var(--muted-foreground))',
                      display: 'block',
                      marginBottom: '6px'
                    }}>
                      Тип компенсации
                    </label>
                    <select
                      value={rules.compensation_type}
                      onChange={(e) => updateRule('compensation_type', e.target.value as CustomRules['compensation_type'])}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '13px',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="cashback">Кешбэк</option>
                      <option value="refund">Возврат</option>
                    </select>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '13px',
                      color: 'hsl(var(--muted-foreground))',
                      display: 'block',
                      marginBottom: '6px'
                    }}>
                      Кто платит
                    </label>
                    <select
                      value={rules.compensation_by}
                      onChange={(e) => updateRule('compensation_by', e.target.value as CustomRules['compensation_by'])}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '13px',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="r5">R5</option>
                      <option value="seller">Продавец</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          padding: '16px 24px',
          borderTop: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--muted))'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'hsl(var(--foreground))',
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'white',
              backgroundColor: 'hsl(var(--primary))',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Применить правила
          </button>
        </div>
      </div>
    </div>
  );
}
