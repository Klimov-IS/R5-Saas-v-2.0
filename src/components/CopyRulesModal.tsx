'use client';

import { useState } from 'react';

type Product = {
  id: string;
  name: string;
  nm_id: number;
  vendor_code: string;
  rules: any | null;
};

type CopyRulesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onCopy: (sourceProductId: string) => void;
};

export function CopyRulesModal({ isOpen, onClose, products, onCopy }: CopyRulesModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Filter products that have rules configured
  const productsWithRules = products.filter(p => p.rules !== null);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (selectedProductId) {
      onCopy(selectedProductId);
      onClose();
      setSelectedProductId(null);
    }
  };

  const formatRulesSummary = (rules: any) => {
    if (!rules) return 'Нет правил';

    const complaints = [];
    if (rules.complaint_rating_1) complaints.push('1⭐');
    if (rules.complaint_rating_2) complaints.push('2⭐');
    if (rules.complaint_rating_3) complaints.push('3⭐');
    if (rules.complaint_rating_4) complaints.push('4⭐');

    const chats = [];
    if (rules.chat_rating_1) chats.push('1⭐');
    if (rules.chat_rating_2) chats.push('2⭐');
    if (rules.chat_rating_3) chats.push('3⭐');
    if (rules.chat_rating_4) chats.push('4⭐');

    const strategyMap: Record<string, string> = {
      'upgrade_to_5': 'дополнить до 5⭐',
      'delete': 'удалить',
      'both': 'обе стратегии'
    };

    const complaintsText = rules.submit_complaints && complaints.length > 0
      ? `Жалобы: ${complaints.join('')}`
      : 'Жалобы: выкл';

    const chatsText = rules.work_in_chats && chats.length > 0
      ? `Чаты: ${chats.join('')} (${strategyMap[rules.chat_strategy || 'both']})`
      : 'Чаты: выкл';

    const compensationText = rules.offer_compensation
      ? `Компенсация: ${rules.max_compensation}₽`
      : 'Компенсация: выкл';

    return `${complaintsText} | ${chatsText} | ${compensationText}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid hsl(var(--border))'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            marginBottom: '4px'
          }}>
            📋 Скопировать правила из другого товара
          </h3>
          <p style={{
            fontSize: '13px',
            color: 'hsl(var(--muted-foreground))'
          }}>
            Выберите товар, правила которого хотите скопировать
          </p>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px'
        }}>
          {productsWithRules.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'hsl(var(--muted-foreground))'
            }}>
              <p>Нет товаров с настроенными правилами</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {productsWithRules.map(product => (
                <div
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                  style={{
                    padding: '12px',
                    border: selectedProductId === product.id
                      ? '2px solid #3b82f6'
                      : '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: selectedProductId === product.id ? '#eff6ff' : 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedProductId !== product.id) {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = '#f8fafc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedProductId !== product.id) {
                      e.currentTarget.style.borderColor = 'hsl(var(--border))';
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  <div style={{
                    fontWeight: 600,
                    color: 'hsl(var(--foreground))',
                    marginBottom: '4px'
                  }}>
                    {product.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'hsl(var(--muted-foreground))'
                  }}>
                    Артикул WB: {product.nm_id}
                  </div>
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px dashed hsl(var(--border))',
                    fontSize: '11px',
                    color: '#64748b'
                  }}>
                    {formatRulesSummary(product.rules)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 32px',
          borderTop: '1px solid hsl(var(--border))',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            className="btn btn-outline"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCopy}
            disabled={!selectedProductId || productsWithRules.length === 0}
            style={{
              opacity: (!selectedProductId || productsWithRules.length === 0) ? 0.5 : 1,
              cursor: (!selectedProductId || productsWithRules.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            📋 Скопировать правила
          </button>
        </div>
      </div>
    </>
  );
}
