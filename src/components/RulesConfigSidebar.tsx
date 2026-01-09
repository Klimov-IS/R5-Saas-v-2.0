'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type ChatStrategy = 'upgrade_to_5' | 'delete' | 'both';

export type ProductRule = {
  id: string;
  product_id: string;
  store_id: string;
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
  chat_strategy?: ChatStrategy;
  offer_compensation: boolean;
  max_compensation?: string | null;
  compensation_type?: string | null;
  compensation_by?: string | null;
  created_at: string;
  updated_at: string;
};

type RulesConfigSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  productId: string;
  productName: string;
  currentRules: ProductRule | null;
  onRulesSaved: () => void;
};

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

export function RulesConfigSidebar({
  isOpen,
  onClose,
  storeId,
  productId,
  productName,
  currentRules,
  onRulesSaved
}: RulesConfigSidebarProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingDefaults, setIsApplyingDefaults] = useState(false);

  // Form state
  const [submitComplaints, setSubmitComplaints] = useState(false);
  const [complaintRating1, setComplaintRating1] = useState(false);
  const [complaintRating2, setComplaintRating2] = useState(false);
  const [complaintRating3, setComplaintRating3] = useState(false);
  const [complaintRating4, setComplaintRating4] = useState(false);

  const [workInChats, setWorkInChats] = useState(false);
  const [chatRating1, setChatRating1] = useState(false);
  const [chatRating2, setChatRating2] = useState(false);
  const [chatRating3, setChatRating3] = useState(false);
  const [chatRating4, setChatRating4] = useState(false);
  const [chatStrategy, setChatStrategy] = useState<ChatStrategy>('both');

  const [offerCompensation, setOfferCompensation] = useState(false);
  const [maxCompensation, setMaxCompensation] = useState('500');
  const [compensationType, setCompensationType] = useState<'cashback' | 'refund'>('cashback');
  const [compensationBy, setCompensationBy] = useState<'r5' | 'seller'>('r5');

  // Load current rules when sidebar opens
  useEffect(() => {
    if (isOpen && currentRules) {
      setSubmitComplaints(currentRules.submit_complaints);
      setComplaintRating1(currentRules.complaint_rating_1);
      setComplaintRating2(currentRules.complaint_rating_2);
      setComplaintRating3(currentRules.complaint_rating_3);
      setComplaintRating4(currentRules.complaint_rating_4);

      setWorkInChats(currentRules.work_in_chats);
      setChatRating1(currentRules.chat_rating_1);
      setChatRating2(currentRules.chat_rating_2);
      setChatRating3(currentRules.chat_rating_3);
      setChatRating4(currentRules.chat_rating_4);
      setChatStrategy(currentRules.chat_strategy || 'both');

      setOfferCompensation(currentRules.offer_compensation);
      setMaxCompensation(currentRules.max_compensation || '500');
      setCompensationType((currentRules.compensation_type as 'cashback' | 'refund') || 'cashback');
      setCompensationBy((currentRules.compensation_by as 'r5' | 'seller') || 'r5');
    }
  }, [isOpen, currentRules]);

  const handleApplyDefaults = async () => {
    setIsApplyingDefaults(true);
    try {
      const response = await fetch(
        `/api/stores/${storeId}/products/${productId}/rules/apply-defaults`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to apply defaults');
      }

      const data = await response.json();
      const rules = data.rules;

      // Update form with default values
      setSubmitComplaints(true);
      setComplaintRating1(true);
      setComplaintRating2(true);
      setComplaintRating3(true);
      setComplaintRating4(false);

      setWorkInChats(true);
      setChatRating1(true);
      setChatRating2(true);
      setChatRating3(true);
      setChatRating4(true);
      setChatStrategy('both');

      setOfferCompensation(true);
      setMaxCompensation('500');
      setCompensationType('cashback');
      setCompensationBy('r5');

      toast({
        title: 'Успешно!',
        description: 'Применены стандартные правила',
      });

      onRulesSaved();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsApplyingDefaults(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rulesData = {
        submit_complaints: submitComplaints,
        complaint_rating_1: complaintRating1,
        complaint_rating_2: complaintRating2,
        complaint_rating_3: complaintRating3,
        complaint_rating_4: complaintRating4,
        work_in_chats: workInChats,
        chat_rating_1: chatRating1,
        chat_rating_2: chatRating2,
        chat_rating_3: chatRating3,
        chat_rating_4: chatRating4,
        chat_strategy: chatStrategy,
        offer_compensation: offerCompensation,
        max_compensation: maxCompensation,
        compensation_type: compensationType,
        compensation_by: compensationBy,
      };

      const response = await fetch(
        `/api/stores/${storeId}/products/${productId}/rules`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(rulesData)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to save rules');
      }

      toast({
        title: 'Успешно!',
        description: 'Правила сохранены',
      });

      onRulesSaved();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Ошибка сохранения',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '600px',
          maxWidth: '90vw',
          background: 'hsl(var(--card))',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'hsl(var(--card))'
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Настройка правил работы
            </h2>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginTop: '4px' }}>
              {productName}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--muted))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {/* Apply Defaults Button */}
          <div style={{ marginBottom: '32px' }}>
            <button
              className="btn btn-outline"
              onClick={handleApplyDefaults}
              disabled={isApplyingDefaults}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                opacity: isApplyingDefaults ? 0.6 : 1
              }}
            >
              {isApplyingDefaults ? (
                <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
              ) : (
                '⚡'
              )}
              {isApplyingDefaults ? 'Применение...' : 'Применить стандартные правила'}
            </button>
            <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginTop: '8px', textAlign: 'center' }}>
              Жалобы: 1-3⭐ | Чаты: 1-4⭐ (обе стратегии) | Компенсация: 500₽, кешбек, Р5
            </p>
          </div>

          {/* Section 1: Complaints */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid hsl(var(--border))'
            }}>
              <span style={{ fontSize: '24px' }}>📋</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                  Жалобы на отзывы
                </h3>
                <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                  Автоматически подавать жалобы на негативные отзывы
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={submitComplaints}
                  onChange={(e) => setSubmitComplaints(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  {submitComplaints ? 'Включено' : 'Выключено'}
                </span>
              </label>
            </div>

            {submitComplaints && (
              <div style={{ paddingLeft: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: 'hsl(var(--foreground))' }}>
                  Подавать жалобы на отзывы с рейтингом:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={complaintRating1}
                      onChange={(e) => setComplaintRating1(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>1⭐ (очень плохо)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={complaintRating2}
                      onChange={(e) => setComplaintRating2(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>2⭐ (плохо)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={complaintRating3}
                      onChange={(e) => setComplaintRating3(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>3⭐ (нормально)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={complaintRating4}
                      onChange={(e) => setComplaintRating4(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>4⭐ (хорошо)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Chats */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid hsl(var(--border))'
            }}>
              <span style={{ fontSize: '24px' }}>💬</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                  Работа в чатах
                </h3>
                <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                  Автоматически отвечать покупателям в чатах
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workInChats}
                  onChange={(e) => setWorkInChats(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  {workInChats ? 'Включено' : 'Выключено'}
                </span>
              </label>
            </div>

            {workInChats && (
              <div style={{ paddingLeft: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: 'hsl(var(--foreground))' }}>
                  Работать с чатами покупателей с рейтингом:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={chatRating1}
                      onChange={(e) => setChatRating1(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>1⭐ (очень плохо)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={chatRating2}
                      onChange={(e) => setChatRating2(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>2⭐ (плохо)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={chatRating3}
                      onChange={(e) => setChatRating3(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>3⭐ (нормально)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={chatRating4}
                      onChange={(e) => setChatRating4(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>4⭐ (хорошо)</span>
                  </label>
                </div>

                <div style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))'
                }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: 'hsl(var(--foreground))' }}>
                    Стратегия работы в чатах:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="chat_strategy"
                        value="upgrade_to_5"
                        checked={chatStrategy === 'upgrade_to_5'}
                        onChange={(e) => setChatStrategy(e.target.value as ChatStrategy)}
                        style={{ marginTop: '2px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>Просить дополнить до 5⭐</div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                          Попросить покупателя поднять рейтинг до максимального
                        </div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="chat_strategy"
                        value="delete"
                        checked={chatStrategy === 'delete'}
                        onChange={(e) => setChatStrategy(e.target.value as ChatStrategy)}
                        style={{ marginTop: '2px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>Просить удалить отзыв</div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                          Попросить покупателя полностью удалить негативный отзыв
                        </div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="chat_strategy"
                        value="both"
                        checked={chatStrategy === 'both'}
                        onChange={(e) => setChatStrategy(e.target.value as ChatStrategy)}
                        style={{ marginTop: '2px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>И то, и другое</div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                          Сначала попросить дополнить, если не получится — попросить удалить
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Compensation */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid hsl(var(--border))'
            }}>
              <span style={{ fontSize: '24px' }}>💰</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                  Компенсация покупателям
                </h3>
                <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                  Предлагать компенсацию за негативный опыт
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={offerCompensation}
                  onChange={(e) => setOfferCompensation(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  {offerCompensation ? 'Включено' : 'Выключено'}
                </span>
              </label>
            </div>

            {offerCompensation && (
              <div style={{ paddingLeft: '20px' }}>
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  gap: '8px'
                }}>
                  <AlertCircle style={{ width: '16px', height: '16px', color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '12px', color: '#92400e', lineHeight: '1.5' }}>
                    <strong>Важно:</strong> Компенсация предлагается только покупателям с рейтингом 1-3⭐ (не 4⭐)
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', display: 'block' }}>
                      Максимальная сумма компенсации, ₽
                    </label>
                    <input
                      type="number"
                      value={maxCompensation}
                      onChange={(e) => setMaxCompensation(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', display: 'block' }}>
                      Тип компенсации
                    </label>
                    <select
                      value={compensationType}
                      onChange={(e) => setCompensationType(e.target.value as 'cashback' | 'refund')}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="cashback">Кешбек</option>
                      <option value="refund">Возврат</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', display: 'block' }}>
                      Кто осуществляет компенсацию
                    </label>
                    <select
                      value={compensationBy}
                      onChange={(e) => setCompensationBy(e.target.value as 'r5' | 'seller')}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="r5">Р5 (наш сервис)</option>
                      <option value="seller">Продавец</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px 32px',
            borderTop: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
            display: 'flex',
            gap: '12px'
          }}
        >
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSaving}
            style={{ flex: 1 }}
          >
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              flex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            {isSaving && <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />}
            {isSaving ? 'Сохранение...' : 'Сохранить правила'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
