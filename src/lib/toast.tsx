'use client';

import { Toaster, toast as hotToast, Toast as HotToast } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';

// Custom toast component with our design system
export function CustomToast({ t }: { t: HotToast }) {
  const icons = {
    success: <CheckCircle2 style={{ width: '20px', height: '20px' }} />,
    error: <XCircle style={{ width: '20px', height: '20px' }} />,
    loading: <Loader2 className="spinner" style={{ width: '20px', height: '20px' }} />,
    blank: <Info style={{ width: '20px', height: '20px' }} />,
    custom: <Info style={{ width: '20px', height: '20px' }} />,
  };

  const colors = {
    success: {
      borderColor: 'hsl(142, 71%, 45%)', // Green-600
      iconBg: 'hsl(142, 76%, 95%)', // Green-50
      iconColor: 'hsl(142, 71%, 45%)', // Green-600
    },
    error: {
      borderColor: 'hsl(var(--destructive))', // Red-500
      iconBg: 'hsl(0, 86%, 97%)', // Red-50
      iconColor: 'hsl(var(--destructive))', // Red-600
    },
    loading: {
      borderColor: 'hsl(38, 92%, 50%)', // Amber-500
      iconBg: 'hsl(48, 100%, 96%)', // Amber-50
      iconColor: 'hsl(38, 92%, 50%)', // Amber-600
    },
    blank: {
      borderColor: 'hsl(var(--primary))', // Blue-500
      iconBg: 'hsl(214, 100%, 97%)', // Blue-50
      iconColor: 'hsl(var(--primary))', // Blue-600
    },
    custom: {
      borderColor: 'hsl(var(--primary))', // Blue-500
      iconBg: 'hsl(214, 100%, 97%)', // Blue-50
      iconColor: 'hsl(var(--primary))', // Blue-600
    },
  };

  const color = colors[t.type];
  const Icon = icons[t.type];

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
          maxWidth: '448px',
          width: '100%',
          backgroundColor: 'hsl(var(--card))',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          borderRadius: '8px',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '16px',
          borderLeft: `4px solid ${color.borderColor}`,
          animation: t.visible ? 'animate-enter 0.2s ease-out' : 'animate-leave 0.15s ease-in',
        }}
      >
        <div style={{
          backgroundColor: color.iconBg,
          color: color.iconColor,
          borderRadius: '9999px',
          padding: '8px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {Icon}
        </div>

        <div style={{
          flex: 1,
          paddingTop: '2px'
        }}>
          {typeof t.message === 'string' ? (
            <p style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'hsl(var(--foreground))',
              margin: 0
            }}>{t.message}</p>
          ) : (
            t.message
          )}
        </div>

        {t.type !== 'loading' && (
          <button
            onClick={() => hotToast.dismiss(t.id)}
            style={{
              flexShrink: 0,
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              borderRadius: '2px',
              padding: '4px',
              border: 'none',
              background: 'transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'hsl(var(--foreground))';
              e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        )}
      </div>
    </>
  );
}

// Toaster wrapper component
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={12}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
        },
      }}
    >
      {(t) => <CustomToast t={t} />}
    </Toaster>
  );
}

// Custom message format for title + description
interface ToastMessageProps {
  title: string;
  description?: string;
}

export function ToastMessage({ title, description }: ToastMessageProps) {
  return (
    <div>
      <p style={{
        fontSize: '14px',
        fontWeight: 600,
        color: 'hsl(var(--foreground))',
        marginBottom: '2px',
        marginTop: 0
      }}>{title}</p>
      {description && (
        <p style={{
          fontSize: '12px',
          color: 'hsl(var(--muted-foreground))',
          margin: 0
        }}>{description}</p>
      )}
    </div>
  );
}

// Helper functions for easy usage
export const toast = {
  success: (title: string, description?: string) => {
    return hotToast.success(
      description ? <ToastMessage title={title} description={description} /> : title
    );
  },

  error: (title: string, description?: string) => {
    return hotToast.error(
      description ? <ToastMessage title={title} description={description} /> : title
    );
  },

  info: (title: string, description?: string) => {
    return hotToast(
      description ? <ToastMessage title={title} description={description} /> : title
    );
  },

  loading: (title: string, description?: string) => {
    return hotToast.loading(
      description ? <ToastMessage title={title} description={description} /> : title,
      { duration: Infinity } // Loading toasts don't auto-dismiss
    );
  },

  promise: hotToast.promise,
  dismiss: hotToast.dismiss,
  remove: hotToast.remove,
};
