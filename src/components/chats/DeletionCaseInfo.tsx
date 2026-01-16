'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, DollarSign, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DeletionCase {
  id: string;
  status: string;
  offerAmount: number;
  compensationType: string;
  offerMessage: string;
  offerStrategy: string | null;
  aiEstimatedSuccess: number | null;
  clientResponse: string | null;
  clientAgreedAt: string | null;
  createdAt: string;
  offerSentAt: string | null;
}

interface DeletionCaseInfoProps {
  storeId: string;
  chatId: string;
  chatTag: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  offer_generated: { label: 'Оффер сгенерирован', color: 'bg-blue-100 text-blue-800', icon: '📝' },
  offer_sent: { label: 'Оффер отправлен', color: 'bg-purple-100 text-purple-800', icon: '📤' },
  client_replied: { label: 'Клиент ответил', color: 'bg-yellow-100 text-yellow-800', icon: '💬' },
  agreed: { label: 'Клиент согласился', color: 'bg-green-100 text-green-800', icon: '🤝' },
  refund_processing: { label: 'Обработка возврата', color: 'bg-orange-100 text-orange-800', icon: '⏳' },
  refund_completed: { label: 'Возврат выполнен', color: 'bg-green-100 text-green-800', icon: '💸' },
  deletion_pending: { label: 'Ожидание удаления', color: 'bg-blue-100 text-blue-800', icon: '⏰' },
  deletion_confirmed: { label: 'Отзыв удалён', color: 'bg-emerald-100 text-emerald-800', icon: '✅' },
  failed: { label: 'Не удалось', color: 'bg-red-100 text-red-800', icon: '❌' },
  cancelled: { label: 'Отменено', color: 'bg-gray-100 text-gray-800', icon: '🚫' },
};

export function DeletionCaseInfo({ storeId, chatId, chatTag }: DeletionCaseInfoProps) {
  // Only show for deletion-related tags
  const deletionTags = ['deletion_candidate', 'deletion_offered', 'deletion_agreed', 'deletion_confirmed', 'refund_requested'];
  if (!deletionTags.includes(chatTag)) {
    return null;
  }

  // Fetch deletion case data
  const { data: deletionCase, isLoading, error } = useQuery<DeletionCase>({
    queryKey: ['deletion-case', chatId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/deletion-cases/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No deletion case yet
          return null;
        }
        throw new Error('Failed to fetch deletion case');
      }

      return response.json();
    },
    enabled: !!chatId,
  });

  if (isLoading) {
    return (
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-blue-700">Загрузка информации...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mr-2" />
            Ошибка загрузки deletion case
          </div>
        </CardContent>
      </Card>
    );
  }

  // No deletion case yet - show action button for deletion_candidate
  if (!deletionCase && chatTag === 'deletion_candidate') {
    return (
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center">
            🎯 Кандидат на удаление отзыва
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 mb-4">
            AI обнаружил, что клиент может быть готов удалить/изменить отзыв.
            Сгенерируйте персонализированное предложение компенсации.
          </p>
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              // TODO: Call API to generate offer
              console.log('Generate offer for chat:', chatId);
            }}
          >
            Сгенерировать предложение компенсации
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!deletionCase) {
    return null;
  }

  const statusInfo = STATUS_LABELS[deletionCase.status] || {
    label: deletionCase.status,
    color: 'bg-gray-100 text-gray-800',
    icon: '❓',
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center">
            💰 Deletion Case
          </CardTitle>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.icon} {statusInfo.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Offer Amount */}
        <div className="flex items-center justify-between bg-white/50 rounded-lg p-3">
          <div className="flex items-center text-sm">
            <DollarSign className="w-4 h-4 mr-2 text-green-600" />
            <span className="text-slate-700">Компенсация:</span>
          </div>
          <span className="font-semibold text-lg text-green-700">
            {deletionCase.offerAmount}₽
          </span>
        </div>

        {/* Compensation Type */}
        <div className="text-sm text-slate-600">
          <span className="font-medium">Тип:</span>{' '}
          {deletionCase.compensationType === 'cashback' ? '🎁 Кешбэк' : '💳 Возврат на карту'}
        </div>

        {/* AI Success Rate */}
        {deletionCase.aiEstimatedSuccess && (
          <div className="flex items-center justify-between bg-white/50 rounded-lg p-3">
            <div className="flex items-center text-sm">
              <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-slate-700">AI прогноз успеха:</span>
            </div>
            <span className="font-semibold text-blue-700">
              {(deletionCase.aiEstimatedSuccess * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* Strategy */}
        {deletionCase.offerStrategy && (
          <div className="text-sm text-slate-600">
            <span className="font-medium">Стратегия:</span>{' '}
            {deletionCase.offerStrategy === 'delete' && '🗑️ Удаление'}
            {deletionCase.offerStrategy === 'upgrade_to_5' && '⭐ Повышение до 5★'}
            {deletionCase.offerStrategy === 'both' && '🔄 Универсальная'}
          </div>
        )}

        {/* Offer Message */}
        <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Сообщение клиенту:
          </div>
          <div className="text-sm text-slate-800 whitespace-pre-wrap">
            {deletionCase.offerMessage}
          </div>
        </div>

        {/* Client Response */}
        {deletionCase.clientResponse && (
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <div className="text-xs font-medium text-green-700 mb-2">
              💬 Ответ клиента:
            </div>
            <div className="text-sm text-green-900">
              {deletionCase.clientResponse}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex items-center text-xs text-slate-500 pt-2 border-t border-blue-100">
          <Calendar className="w-3 h-3 mr-1" />
          Создан: {new Date(deletionCase.createdAt).toLocaleString('ru-RU')}
        </div>

        {/* Actions */}
        {deletionCase.status === 'offer_generated' && (
          <Button
            size="sm"
            className="w-full mt-2"
            variant="outline"
            onClick={() => {
              // TODO: Send offer to client
              console.log('Send offer:', deletionCase.id);
            }}
          >
            📤 Отправить предложение клиенту
          </Button>
        )}

        {deletionCase.status === 'agreed' && (
          <Button
            size="sm"
            className="w-full mt-2"
            onClick={() => {
              // TODO: Confirm refund completed
              console.log('Confirm refund:', deletionCase.id);
            }}
          >
            ✅ Подтвердить возврат выполнен
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
