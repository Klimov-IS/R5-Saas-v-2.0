'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

interface TelegramStore {
  id: string;
  name: string;
  marketplace?: string;
}

interface TelegramAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isLinked: boolean;
  userId: string | null;
  stores: TelegramStore[];
  error: string | null;
  initData: string | null;
  /** JWT token from email+password login */
  jwtToken: string | null;
  /** Display name (from email login) */
  displayName: string | null;
}

interface TelegramAuthContextType extends TelegramAuthState {
  /** Fetch wrapper that includes TG auth header or JWT */
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Login with email+password (for TG Mini App users not linked via /link) */
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Logout (clear JWT session) */
  logout: () => void;
}

const TelegramAuthContext = createContext<TelegramAuthContextType | null>(null);

export function useTelegramAuth(): TelegramAuthContextType {
  const ctx = useContext(TelegramAuthContext);
  if (!ctx) throw new Error('useTelegramAuth must be used within TelegramAuthProvider');
  return ctx;
}

const TG_JWT_KEY = 'tg_auth_jwt';
const TG_USER_KEY = 'tg_auth_user';

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramAuthState>({
    isLoading: true,
    isAuthenticated: false,
    isLinked: false,
    userId: null,
    stores: [],
    error: null,
    initData: null,
    jwtToken: null,
    displayName: null,
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
              jwtToken: null,
              displayName: null,
            });
          } else {
            setState(s => ({ ...s, isLoading: false, error: data.error || 'Dev auth failed' }));
          }
          return;
        }

        // Check for saved JWT session (from previous email+password login)
        const savedJwt = sessionStorage.getItem(TG_JWT_KEY);
        const savedUser = sessionStorage.getItem(TG_USER_KEY);
        if (savedJwt && savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            // Verify token is still valid by making a test request
            const testRes = await fetch('/api/telegram/queue?limit=1', {
              headers: { 'Authorization': `Bearer ${savedJwt}` },
            });
            if (testRes.ok) {
              setState({
                isLoading: false,
                isAuthenticated: true,
                isLinked: true,
                userId: userData.userId,
                stores: userData.stores || [],
                error: null,
                initData: null,
                jwtToken: savedJwt,
                displayName: userData.displayName || null,
              });
              return;
            }
            // Token expired — clear and continue to TG auth
            sessionStorage.removeItem(TG_JWT_KEY);
            sessionStorage.removeItem(TG_USER_KEY);
          } catch {
            sessionStorage.removeItem(TG_JWT_KEY);
            sessionStorage.removeItem(TG_USER_KEY);
          }
        }

        // Get initData from Telegram WebApp
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) {
          // Not inside Telegram — show login form
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
          jwtToken: null,
          displayName: null,
        });
      } catch (err: any) {
        setState(s => ({ ...s, isLoading: false, error: err.message }));
      }
    }

    authenticate();
  }, []);

  // Login with email+password
  const loginWithEmail = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/telegram/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Ошибка входа' };
      }

      // Save JWT to sessionStorage
      sessionStorage.setItem(TG_JWT_KEY, data.token);
      sessionStorage.setItem(TG_USER_KEY, JSON.stringify({
        userId: data.userId,
        displayName: data.displayName,
        stores: data.stores,
      }));

      setState({
        isLoading: false,
        isAuthenticated: true,
        isLinked: true,
        userId: data.userId,
        stores: data.stores || [],
        error: null,
        initData: null,
        jwtToken: data.token,
        displayName: data.displayName || null,
      });

      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка сети' };
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    sessionStorage.removeItem(TG_JWT_KEY);
    sessionStorage.removeItem(TG_USER_KEY);
    setState({
      isLoading: false,
      isAuthenticated: false,
      isLinked: false,
      userId: null,
      stores: [],
      error: 'Account not linked',
      initData: null,
      jwtToken: null,
      displayName: null,
    });
  }, []);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);

    // Prefer JWT if available (email+password auth), otherwise use TG initData
    if (state.jwtToken) {
      headers.set('Authorization', `Bearer ${state.jwtToken}`);
    } else if (state.initData) {
      headers.set('X-Telegram-Init-Data', state.initData);
    }

    const response = await fetch(url, { ...options, headers });

    // JWT expired: clear session and show login form
    if (response.status === 401 && state.jwtToken) {
      sessionStorage.removeItem(TG_JWT_KEY);
      sessionStorage.removeItem(TG_USER_KEY);
      setState(s => ({
        ...s,
        isAuthenticated: false,
        isLinked: false,
        jwtToken: null,
        error: 'Сессия истекла. Войдите снова.',
      }));
    }

    return response;
  }, [state.initData, state.jwtToken]);

  return (
    <TelegramAuthContext.Provider value={{ ...state, apiFetch, loginWithEmail, logout }}>
      {children}
    </TelegramAuthContext.Provider>
  );
}
