'use client';

import { useState } from 'react';
import { useTelegramAuth } from '@/lib/telegram-auth-context';

/**
 * Email+password login form for TG Mini App.
 * Shown when user opens Mini App but their Telegram account is not linked via /link.
 */
export default function TgLoginForm() {
  const { loginWithEmail } = useTelegramAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await loginWithEmail(email, password);
    if (!result.success) {
      setError(result.error || 'Ошибка входа');
    }

    setIsLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      padding: '20px',
      backgroundColor: '#F7F8FA',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '340px',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
        }}>
          <span style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.5px',
          }}>
            R5
          </span>
        </div>

        <div style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '4px',
        }}>
          Вход в систему
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '28px',
        }}>
          R5 Reputation Manager
        </div>

        {/* Form card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E6E8EC',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '15px',
                  borderRadius: '12px',
                  border: '1px solid #E6E8EC',
                  backgroundColor: '#F7F8FA',
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease-out',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#2563EB'}
                onBlur={e => e.currentTarget.style.borderColor = '#E6E8EC'}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Пароль"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '15px',
                  borderRadius: '12px',
                  border: '1px solid #E6E8EC',
                  backgroundColor: '#F7F8FA',
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease-out',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#2563EB'}
                onBlur={e => e.currentTarget.style.borderColor = '#E6E8EC'}
              />
            </div>

            {error && (
              <div style={{
                fontSize: '13px',
                color: '#991B1B',
                backgroundColor: '#FEE2E2',
                padding: '10px 14px',
                borderRadius: '10px',
                marginBottom: '12px',
                textAlign: 'left',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: '12px',
                border: 'none',
                background: isLoading
                  ? '#93C5FD'
                  : 'linear-gradient(135deg, #2563EB, #3B82F6)',
                color: '#FFFFFF',
                cursor: isLoading ? 'default' : 'pointer',
                boxShadow: isLoading ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.15s ease-out',
              }}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>

        <div style={{
          fontSize: '12px',
          color: '#9CA3AF',
          marginTop: '20px',
          lineHeight: 1.5,
        }}>
          Используйте email и пароль,<br />
          полученные от администратора
        </div>
      </div>
    </div>
  );
}
