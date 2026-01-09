'use client';

import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

type ActionType = 'dialogues' | 'reviews' | 'recalculate' | 'send-no-reply' | 'reconcile-no-reply';

export function useApiActions() {
    const { toast } = useToast();
    const [updating, setUpdating] = useState<Record<string, ActionType[]>>({});

    const isUpdating = useCallback((storeId: string | undefined, action: ActionType) => {
        const id = storeId || 'global';
        return updating[id]?.includes(action) ?? false;
    }, [updating]);

    const triggerUpdate = useCallback(async (storeId: string | undefined, action: ActionType) => {
        // Hardcoded API key for now (TODO: get from settings)
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

        const id = storeId || 'global';
        setUpdating(prev => ({ ...prev, [id]: [...(prev[id] || []), action] }));

        let url = '';
        let successMessage = '';
        let title = 'Запрос отправлен';

        switch (action) {
            case 'dialogues':
                url = storeId ? `/api/stores/${storeId}/dialogues/update` : '/api/stores/dialogues/update-all';
                successMessage = 'Обновление диалогов запущено в фоновом режиме.';
                title = 'Обновление диалогов';
                break;
            case 'reviews':
                 url = storeId ? `/api/stores/${storeId}/reviews/update?mode=incremental` : '/api/stores/reviews/update-all';
                 successMessage = 'Обновление отзывов запущено в фоновом режиме.';
                 title = 'Обновление отзывов';
                break;
            case 'recalculate':
                url = storeId ? `/api/stores/${storeId}/recalculate-all` : '/api/stores/recalculate-all';
                successMessage = `Пересчет статистики для ${storeId ? 'магазина' : 'всех магазинов'} запущен.`;
                title = 'Пересчет статистики';
                break;
            case 'send-no-reply':
                url = storeId ? `/api/stores/${storeId}/dialogues/send-no-reply-message` : '/api/stores/dialogues/send-no-reply-message-all';
                successMessage = `Отправка "no-reply" сообщений запущена.`;
                title = 'Отправка сообщений';
                break;
            case 'reconcile-no-reply':
                if (!storeId) {
                    toast({variant: 'destructive', title: 'Ошибка', description: 'Для этой операции требуется ID магазина.'});
                    setUpdating(prev => ({...prev, [id]: prev[id]?.filter(a => a !== action) || []}));
                    return;
                }
                url = `/api/stores/${storeId}/dialogues/reconcile-no-reply`;
                successMessage = 'Синхронизация старых сообщений запущена.';
                title = 'Синхронизация рассылок';
                break;
        }

        toast({ title, description: 'Процесс выполняется на сервере...' });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });

            const responseData = await response.json();

            if (response.status === 202 || response.status === 200) {
                toast({ title: 'Процесс запущен', description: responseData.message || successMessage });
            } else {
                 const errorMessage = String(responseData.details || responseData.error || `Ошибка API: ${response.status}`);
                throw new Error(errorMessage);
            }

        } catch (error: any) {
            console.error(`Failed to trigger action '${action}' for store '${id}':`, error);
            const errorMessage = String(error?.message || 'Произошла неизвестная ошибка');
            toast({ variant: 'destructive', title: `Ошибка: ${title}`, description: errorMessage });
        } finally {
            setUpdating(prev => ({
                ...prev,
                [id]: prev[id]?.filter(a => a !== action) || [],
            }));
        }
    }, [toast]);

    return { triggerUpdate, isUpdating };
}
