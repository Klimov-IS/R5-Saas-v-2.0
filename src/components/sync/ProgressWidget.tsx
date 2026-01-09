'use client';

import { RefreshCw, CheckCircle2, XCircle, X } from 'lucide-react';
import type { SyncTask } from '@/lib/sync-store';

interface ProgressWidgetProps {
  task: SyncTask;
  onExpand: () => void;
  onCancel: () => void;
}

export function ProgressWidget({ task, onExpand, onCancel }: ProgressWidgetProps) {
  const total = task.storeIds.length;
  const processed = task.currentIndex;
  const percentage = Math.round((processed / total) * 100);

  const elapsedSeconds = Math.floor((Date.now() - task.startTime) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        .shimmer {
          animation: shimmer 2s infinite;
        }
        .slide-in {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>

      <div
        onClick={onExpand}
        className="slide-in"
        style={{
          backgroundColor: 'hsl(var(--card))',
          borderRadius: '8px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '2px solid hsl(var(--primary))',
          padding: '16px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.4)';
          e.currentTarget.style.transform = 'translateY(-4px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(217, 91%, 50%) 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <RefreshCw className="spinner" style={{ width: '20px', height: '20px', color: 'white' }} />
          </div>
          <div style={{
            flex: 1,
            minWidth: 0
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {task.title}
            </h4>
            <p style={{
              fontSize: '12px',
              color: 'hsl(var(--muted-foreground))',
              margin: 0
            }}>
              Обработано: {processed}/{total}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            style={{
              flexShrink: 0,
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              borderRadius: '4px',
              padding: '4px',
              border: 'none',
              background: 'transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'hsl(var(--destructive))';
              e.currentTarget.style.backgroundColor = 'hsl(0, 86%, 97%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            height: '6px',
            backgroundColor: 'hsl(var(--muted))',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(217, 91%, 50%) 100%)',
              borderRadius: '9999px',
              transition: 'width 0.3s',
              width: `${percentage}%`,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className="shimmer" style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)'
              }} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px'
        }}>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>{percentage}%</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'hsl(142, 71%, 45%)' // Green-600
            }}>
              <CheckCircle2 style={{ width: '12px', height: '12px' }} />
              <span>{task.successCount}</span>
            </div>
            {task.errorCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'hsl(var(--destructive))'
              }}>
                <XCircle style={{ width: '12px', height: '12px' }} />
                <span>{task.errorCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timer */}
        <div style={{
          fontSize: '12px',
          color: 'hsl(var(--muted-foreground))',
          marginTop: '8px'
        }}>
          ⏱ {timeStr}
        </div>
      </div>
    </>
  );
}
