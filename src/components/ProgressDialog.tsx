'use client';

type ProgressDialogProps = {
  isOpen: boolean;
  title: string;
  current: number;
  total: number;
  result?: {
    success: boolean;
    message: string;
  };
};

export function ProgressDialog({ isOpen, title, current, total, result }: ProgressDialogProps) {
  if (!isOpen) return null;

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

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
          zIndex: 999
        }}
      />

      {/* Progress Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          padding: '32px',
          minWidth: '400px',
          zIndex: 1001
        }}
      >
        {/* Header */}
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'hsl(var(--foreground))',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          {title}
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '12px',
          background: '#e2e8f0',
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: '12px'
        }}>
          <div
            style={{
              height: '100%',
              background: '#3b82f6',
              borderRadius: '6px',
              transition: 'width 0.3s ease',
              width: `${percent}%`
            }}
          />
        </div>

        {/* Progress Text */}
        <div style={{
          fontSize: '14px',
          color: 'hsl(var(--muted-foreground))',
          textAlign: 'center'
        }}>
          {current} из {total} товаров ({percent}%)
        </div>

        {/* Result Message */}
        {result && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: result.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${result.success ? '#22c55e' : '#ef4444'}`,
            borderRadius: '8px',
            fontSize: '14px',
            color: result.success ? '#166534' : '#991b1b',
            textAlign: 'center'
          }}>
            {result.message}
          </div>
        )}
      </div>
    </>
  );
}
