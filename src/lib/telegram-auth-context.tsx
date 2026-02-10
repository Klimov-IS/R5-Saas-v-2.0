'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

interface TelegramStore {
  id: string;
  name: string;
}

interface TelegramAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isLinked: boolean;
  userId: string | null;
  stores: TelegramStore[];
  error: string | null;
  initData: string | null;
}

interface TelegramAuthContextType extends TelegramAuthState {
  /** Fetch wrapper that includes TG auth header */
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const TelegramAuthContext = createContext<TelegramAuthContextType | null>(null);

export function useTelegramAuth(): TelegramAuthContextType {
  const ctx = useContext(TelegramAuthContext);
  if (!ctx) throw new Error('useTelegramAuth must be used within TelegramAuthProvider');
  return ctx;
}

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramAuthState>({
    isLoading: true,
    isAuthenticated: false,
    isLinked: false,
    userId: null,
    stores: [],
    error: null,
    initData: null,
  });

  useEffect(() => {
    async function authenticate() {
      try {
        // Check for dev mode: ?dev_user=<userId>
        const urlParams = new URLSearchParams(window.location.search);
        const devUserId = urlParams.get('dev_user');

        if (devUserId) {
          // Dev mode: bypass Telegram auth
          const response = await fetch('/api/telegram/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ devUserId }),
          });
          const data = await response.json();

          if (response.ok && data.valid) {
            setState({
              isLoading: false,
              isAuthenticated: true,
              isLinked: true,
              userId: data.userId,
              stores: data.stores || [],
              error: null,
              initData: `dev_user:${devUserId}`,
            });
          } else {
            setState(s => ({ ...s, isLoading: false, error: data.error || 'Dev auth failed' }));
          }
          return;
        }

        // Get initData from Telegram WebApp
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) {
          setState(s => ({ ...s, isLoading: false, error: 'Not running inside Telegram' }));
          return;
        }

        // Expand to full height
        tg.expand();
        tg.ready();

        const initData = tg.initData;
        if (!initData) {
          setState(s => ({ ...s, isLoading: false, error: 'No initData from Telegram' }));
          return;
        }

        // Verify with our backend
        const response = await fetch('/api/telegram/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });

        const data = await response.json();

        if (!response.ok || !data.valid) {
          setState(s => ({
            ...s,
            isLoading: false,
            isAuthenticated: false,
            error: data.error || 'Authentication failed',
            initData,
          }));
          return;
        }

        setState({
          isLoading: false,
          isAuthenticated: true,
          isLinked: !!data.userId,
          userId: data.userId || null,
          stores: data.stores || [],
          error: data.userId ? null : 'Account not linked',
          initData,
        });
      } catch (err: any) {
        setState(s => ({ ...s, isLoading: false, error: err.message }));
      }
    }

    authenticate();
  }, []);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (state.initData) {
      headers.set('X-Telegram-Init-Data', state.initData);
    }
    return fetch(url, { ...options, headers });
  }, [state.initData]);

  return (
    <TelegramAuthContext.Provider value={{ ...state, apiFetch }}>
      {children}
    </TelegramAuthContext.Provider>
  );
}
