'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Key, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

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
