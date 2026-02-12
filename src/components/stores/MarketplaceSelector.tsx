'use client';

import { X } from 'lucide-react';

interface MarketplaceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWB: () => void;
  onSelectOzon: () => void;
}

export function MarketplaceSelector({
  isOpen,
  onClose,
  onSelectWB,
  onSelectOzon,
}: MarketplaceSelectorProps) {
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
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'hsl(var(--card))',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '480px',
          width: '100%',
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
            padding: '20px 24px',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
            }}
          >
            Подключить магазин
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'hsl(var(--muted-foreground))',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Marketplace Cards */}
        <div
          style={{
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          {/* Wildberries Card */}
          <MarketplaceCard
            name="Wildberries"
            badgeText="WB"
            badgeBg="linear-gradient(135deg, #CB11AB, #7B2D8E)"
            borderColor="#CB11AB"
            description="API-токены для товаров, отзывов и чатов"
            onClick={() => {
              onClose();
              onSelectWB();
            }}
          />

          {/* OZON Card */}
          <MarketplaceCard
            name="OZON"
            badgeText="OZ"
            badgeBg="linear-gradient(135deg, #005BFF, #003399)"
            borderColor="#005BFF"
            description="Client-Id и Api-Key от Seller API"
            onClick={() => {
              onClose();
              onSelectOzon();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MarketplaceCard({
  name,
  badgeText,
  badgeBg,
  borderColor,
  description,
  onClick,
}: {
  name: string;
  badgeText: string;
  badgeBg: string;
  borderColor: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '24px 16px',
        border: '2px solid hsl(var(--border))',
        borderRadius: '10px',
        backgroundColor: 'hsl(var(--card))',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 4px 12px ${borderColor}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'hsl(var(--border))';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '10px',
          background: badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}
      >
        {badgeText}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            marginBottom: '4px',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'hsl(var(--muted-foreground))',
            lineHeight: '1.4',
          }}
        >
          {description}
        </div>
      </div>
    </button>
  );
}
