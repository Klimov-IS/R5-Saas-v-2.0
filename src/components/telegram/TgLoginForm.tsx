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
    }}>
      <div style={{
        width: '100%',
        maxWidth: '340px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '32px',
          fontWeight: 800,
          color: 'var(--tg-text)',
          marginBottom: '4px',
        }}>
          R5
        </div>
        <div style={{
          fontSize: '14px',
          color: 'var(--tg-hint)',
          marginBottom: '24px',
        }}>
          Вход в систему
        </div>

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
                borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.12)',
                backgroundColor: 'var(--tg-secondary-bg)',
                color: 'var(--tg-text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
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
                borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.12)',
                backgroundColor: 'var(--tg-secondary-bg)',
                color: 'var(--tg-text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: '13px',
              color: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.1)',
              padding: '8px 12px',
              borderRadius: '8px',
              marginBottom: '12px',
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
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'var(--tg-button)',
              color: 'var(--tg-button-text)',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div style={{
          fontSize: '12px',
          color: 'var(--tg-hint)',
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
