'use client';

import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Minus, X } from 'lucide-react';
import type { SyncTask } from '@/lib/sync-store';

interface ProgressModalProps {
  task: SyncTask;
  onMinimize: () => void;
  onCancel: () => void;
}

export function ProgressModal({ task, onMinimize, onCancel }: ProgressModalProps) {
  const total = task.storeIds.length;
  const processed = task.currentIndex;
  const percentage = Math.round((processed / total) * 100);

  const elapsedSeconds = Math.floor((Date.now() - task.startTime) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const currentStoreName = task.currentIndex < task.storeNames.length
    ? task.storeNames[task.currentIndex]
    : 'Завершено';

  const handleCancel = () => {
    const confirmed = confirm('Вы уверены, что хотите отменить синхронизацию?');
    if (confirmed) {
      onCancel();
    }
  };

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
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        .shimmer {
          animation: shimmer 2s infinite;
        }
        .fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>

      {/* Overlay */}
      <div
        className="fade-in"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === e.currentTarget) {
            onMinimize();
          }
        }}
      >
        {/* Modal */}
        <div
          className="slide-up"
          style={{
            backgroundColor: 'hsl(var(--card))',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '24px',
            borderBottom: '1px solid hsl(var(--border))'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(217, 91%, 50%) 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <RefreshCw className="spinner" style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                margin: 0,
                marginBottom: '4px'
              }}>
                {task.title}
              </h3>
              <p style={{
                fontSize: '14px',
                color: 'hsl(var(--muted-foreground))',
                margin: 0
              }}>
                {task.subtitle}
              </p>
            </div>
            <div style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'hsl(var(--muted-foreground))',
              fontFamily: 'monospace'
            }}>
              ⏱ {timeStr}
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            padding: '24px',
            borderBottom: '1px solid hsl(var(--border))'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{
                fontSize: '12px',
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Обработано</span>
              <span style={{
                fontSize: '24px',
                fontWeight: 600,
                color: 'hsl(var(--foreground))'
              }}>
                {processed}/{total}
              </span>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{
                fontSize: '12px',
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Успешно</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 style={{ width: '20px', height: '20px', color: 'hsl(142, 71%, 45%)' }} />
                <span style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: 'hsl(142, 71%, 45%)'
                }}>
                  {task.successCount}
                </span>
              </div>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{
                fontSize: '12px',
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Ошибки</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <XCircle style={{ width: '20px', height: '20px', color: 'hsl(var(--destructive))' }} />
                <span style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: task.errorCount > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))'
                }}>
                  {task.errorCount}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ padding: '24px', borderBottom: '1px solid hsl(var(--border))' }}>
            <div style={{
              height: '8px',
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '14px'
            }}>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{percentage}%</span>
              <span style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                {currentStoreName}
              </span>
            </div>
          </div>

          {/* Log Viewer */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
            minHeight: '200px',
            maxHeight: '400px'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              marginTop: 0,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Журнал синхронизации
            </h4>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {task.logs.length === 0 ? (
                <div style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '14px'
                }}>
                  Записей пока нет...
                </div>
              ) : (
                task.logs.map((log, index) => {
                  const logTime = new Date(log.timestamp);
                  const logTimeStr = `${logTime.getHours().toString().padStart(2, '0')}:${logTime.getMinutes().toString().padStart(2, '0')}:${logTime.getSeconds().toString().padStart(2, '0')}`;

                  let icon;
                  let iconColor;
                  let iconBg;

                  if (log.status === 'success') {
                    icon = <CheckCircle2 style={{ width: '16px', height: '16px' }} />;
                    iconColor = 'hsl(142, 71%, 45%)';
                    iconBg = 'hsl(142, 76%, 95%)';
                  } else if (log.status === 'error') {
                    icon = <XCircle style={{ width: '16px', height: '16px' }} />;
                    iconColor = 'hsl(var(--destructive))';
                    iconBg = 'hsl(0, 86%, 97%)';
                  } else {
                    icon = <AlertCircle style={{ width: '16px', height: '16px' }} />;
                    iconColor = 'hsl(38, 92%, 50%)';
                    iconBg = 'hsl(48, 100%, 96%)';
                  }

                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: 'hsl(var(--muted))',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{
                        backgroundColor: iconBg,
                        color: iconColor,
                        borderRadius: '9999px',
                        padding: '6px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px'
                        }}>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'hsl(var(--foreground))'
                          }}>
                            {log.storeName}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: 'hsl(var(--muted-foreground))',
                            fontFamily: 'monospace'
                          }}>
                            {logTimeStr}
                          </span>
                        </div>
                        <p style={{
                          fontSize: '13px',
                          color: 'hsl(var(--muted-foreground))',
                          margin: 0
                        }}>
                          {log.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '24px',
            borderTop: '1px solid hsl(var(--border))'
          }}>
            <button
              onClick={onMinimize}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                backgroundColor: 'hsl(var(--muted))',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(var(--accent))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
              }}
            >
              <Minus style={{ width: '16px', height: '16px' }} />
              Свернуть
            </button>
            <button
              onClick={handleCancel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'white',
                backgroundColor: 'hsl(var(--destructive))',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(0, 84%, 55%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(var(--destructive))';
              }}
            >
              <X style={{ width: '16px', height: '16px' }} />
              Отменить
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
