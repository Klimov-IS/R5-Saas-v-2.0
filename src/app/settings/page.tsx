'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Key, ArrowLeft, Bot, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [hasDeepseekKey, setHasDeepseekKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDeepseek, setIsSavingDeepseek] = useState(false);
  const [isLoadingDeepseek, setIsLoadingDeepseek] = useState(true);
  const { toast } = useToast();

  // Load existing Deepseek key status on mount
  useEffect(() => {
    const loadDeepseekKeyStatus = async () => {
      try {
        const response = await fetch('/api/settings/deepseek-key', {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setHasDeepseekKey(data.hasKey);
        }
      } catch (error) {
        console.error('Failed to load Deepseek key status:', error);
      } finally {
        setIsLoadingDeepseek(false);
      }
    };

    loadDeepseekKeyStatus();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'Ошибка',
        description: 'API ключ не может быть пустым',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      // TODO: В будущем сохранять в localStorage или базу данных
      localStorage.setItem('wb_api_key', apiKey);

      toast({
        title: 'Успешно',
        description: 'API ключ сохранен',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить API ключ',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDeepseek = async () => {
    if (!deepseekApiKey.trim()) {
      toast({
        title: 'Ошибка',
        description: 'API ключ Deepseek не может быть пустым',
        variant: 'destructive'
      });
      return;
    }

    if (!deepseekApiKey.startsWith('sk-')) {
      toast({
        title: 'Ошибка',
        description: 'Неверный формат. API ключи Deepseek начинаются с "sk-"',
        variant: 'destructive'
      });
      return;
    }

    setIsSavingDeepseek(true);
    try {
      const response = await fetch('/api/settings/deepseek-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`
        },
        body: JSON.stringify({ apiKey: deepseekApiKey })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось сохранить API ключ');
      }

      setHasDeepseekKey(true);
      setDeepseekApiKey(''); // Clear input for security

      toast({
        title: 'Успешно',
        description: 'API ключ Deepseek сохранен в базу данных',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить API ключ Deepseek',
        variant: 'destructive'
      });
    } finally {
      setIsSavingDeepseek(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <Link href="/" passHref>
            <Button variant="outline" size="icon" aria-label="Назад">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Настройки</h1>
        </div>
      </header>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Wildberries API
            </CardTitle>
            <CardDescription>
              Введите ваш API ключ от Wildberries для синхронизации данных
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API ключ</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Введите API ключ"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Получить API ключ можно в личном кабинете Wildberries
              </p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Deepseek AI API
            </CardTitle>
            <CardDescription>
              API ключ для генерации жалоб на отзывы через искусственный интеллект
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasDeepseekKey ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-100 p-1">
                    <Key className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">
                      API ключ настроен
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Генерация жалоб через AI доступна. Вы можете обновить ключ ниже.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-yellow-100 p-1">
                    <Key className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900">
                      API ключ не настроен
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Генерация жалоб через AI недоступна. Добавьте API ключ ниже.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="deepseek-api-key">API ключ Deepseek</Label>
              <Input
                id="deepseek-api-key"
                type="password"
                placeholder="sk-..."
                value={deepseekApiKey}
                onChange={(e) => setDeepseekApiKey(e.target.value)}
                disabled={isLoadingDeepseek}
              />
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <p>
                  Получить API ключ можно на{' '}
                  <a
                    href="https://platform.deepseek.com/api_keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    platform.deepseek.com
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </div>

            <Button onClick={handleSaveDeepseek} disabled={isSavingDeepseek || isLoadingDeepseek}>
              <Save className="mr-2 h-4 w-4" />
              {isSavingDeepseek ? 'Сохранение...' : hasDeepseekKey ? 'Обновить ключ' : 'Сохранить ключ'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>О системе</CardTitle>
            <CardDescription>
              Информация о WB Reputation Manager
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-semibold">Версия:</span> 2.0.0
            </div>
            <div>
              <span className="font-semibold">База данных:</span> PostgreSQL (Yandex Cloud)
            </div>
            <div>
              <span className="font-semibold">AI Модель:</span> Deepseek Chat
            </div>
            <div className="pt-4 text-muted-foreground">
              WB Reputation Manager - система управления репутацией магазинов на Wildberries
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
