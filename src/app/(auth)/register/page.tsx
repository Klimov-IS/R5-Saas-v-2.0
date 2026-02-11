'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface InviteInfo {
  email: string;
  role: string;
  orgName: string;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // Validate invite token on mount
  useEffect(() => {
    if (!token) {
      setError('Ссылка приглашения недействительна');
      setIsValidating(false);
      return;
    }

    fetch(`/api/auth/invite-info?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setInviteInfo(data);
        }
      })
      .catch(() => setError('Ошибка проверки приглашения'))
      .finally(() => setIsValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, displayName, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка регистрации');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-background rounded-xl border shadow-sm p-8 text-center">
          <p className="text-muted-foreground">Проверка приглашения...</p>
        </div>
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-background rounded-xl border shadow-sm p-8 text-center">
          <h1 className="text-xl font-bold mb-2">Ошибка</h1>
          <p className="text-muted-foreground text-sm mb-4">{error || 'Приглашение недействительно'}</p>
          <Link href="/login" className="text-primary text-sm hover:underline">
            Перейти к входу
          </Link>
        </div>
      </div>
    );
  }

  const roleLabel = inviteInfo.role === 'admin' ? 'Администратор' : 'Менеджер';

  return (
    <div className="w-full max-w-sm">
      <div className="bg-background rounded-xl border shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">R5</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Вас пригласили в <strong>{inviteInfo.orgName}</strong>
          </p>
          <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
            {roleLabel}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input
              type="email"
              value={inviteInfo.email}
              disabled
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted text-muted-foreground"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Имя</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Ваше имя"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Повторите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Загрузка...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
