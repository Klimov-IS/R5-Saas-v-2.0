# EPIC-015: Массовая рассылка в чаты покупателей

**Статус:** 📋 Backlog
**Приоритет:** P1 (Высокий)
**RICE Score:** 160
**Квартал:** Q2 2025 (Апрель - Июнь)
**Оценка:** 1 неделя (5 SP)
**Владелец:** Product Manager

---

## Проблема

Менеджеры магазинов часто хотят отправить одно и то же сообщение сразу во все активные чаты или в отфильтрованную группу (например, только в чаты с тегом "active" или чаты без ответа > 3 дней).

**Текущая ситуация:**
- Приходится копировать сообщение вручную в каждый чат
- На 50 чатов уходит 30+ минут
- Высокий риск ошибок (забыть чат, опечатки)

**Use Cases:**
1. Отправить всем клиентам информацию об изменении условий доставки
2. Напомнить клиентам с "no_reply" о возможности оставить отзыв
3. Массово отправить промо-код активным покупателям
4. Уведомить о поступлении товара тех, кто спрашивал

---

## Решение

Добавить функционал массовой рассылки сообщений в дашборде чатов с:
- Фильтрацией по тегам, дате последнего сообщения, статусу
- Preview перед отправкой (кол-во получателей)
- Rate limiting для WB API (не более 10 сообщений/сек)
- Логирование всех отправленных сообщений
- Возможность отменить рассылку

---

## User Stories

### US-026: Массовая отправка в чаты с фильтрами
**Как:** менеджер магазина
**Я хочу:** отправить одно сообщение во все чаты, соответствующие фильтру
**Чтобы:** сэкономить время на массовых коммуникациях

**Acceptance Criteria:**
- ✅ Кнопка "Массовая рассылка" в дашборде чатов
- ✅ Могу выбрать фильтры: теги, дата последнего сообщения, статус
- ✅ Вижу preview: "Будет отправлено 47 сообщений"
- ✅ Могу написать текст сообщения (до 1000 символов)
- ✅ Получаю подтверждение перед отправкой
- ✅ Вижу прогресс отправки в реальном времени
- ✅ Сообщения отправляются с rate limiting (безопасно для WB API)
- ✅ Все отправленные сообщения логируются

**Story Points:** 5 SP (3-5 дней)

---

### US-027: История массовых рассылок
**Как:** администратор магазина
**Я хочу:** видеть историю всех массовых рассылок
**Чтобы:** контролировать, кому и что было отправлено

**Acceptance Criteria:**
- ✅ Страница "История рассылок"
- ✅ Вижу: дату, текст, кол-во получателей, статус (успешно/ошибки)
- ✅ Могу кликнуть на рассылку и увидеть список чатов
- ✅ Есть фильтр по дате и статусу

**Story Points:** 2 SP (1-2 дня)

---

## Технические детали

### UI Flow

```
Дашборд чатов
  ↓ (кнопка "Массовая рассылка")
Модальное окно:
  1. Выбор фильтров
     - Теги: [active] [no_reply] [успешный] [неуспешный]
     - Дата последнего сообщения: последние X дней
     - Отправитель: только где клиент писал последним

  2. Preview
     "Будет отправлено в 47 чатов"
     [Показать список чатов]

  3. Текст сообщения
     [Textarea: до 1000 символов]

  4. Подтверждение
     ⚠️ Вы уверены? Это действие нельзя отменить.
     [Отмена] [Отправить]

  5. Прогресс
     Отправлено: 35/47
     [━━━━━━━━━━░░░] 74%
```

### Firestore Schema

```typescript
// stores/{storeId}/broadcasts/{broadcastId}
interface BroadcastCampaign {
  storeId: string;
  storeName: string;

  // Конфигурация
  filters: {
    tags?: Array<'active' | 'no_reply' | 'successful' | 'unsuccessful'>;
    lastMessageWithinDays?: number; // Последнее сообщение за N дней
    lastMessageSender?: 'user' | 'seller'; // Кто писал последним
  };
  message: string; // Текст сообщения

  // Статистика
  totalRecipients: number; // Кол-во получателей
  sentCount: number; // Отправлено успешно
  errorCount: number; // Ошибки отправки
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  // Логи
  chatIds: string[]; // ID чатов, куда отправили
  errors: Array<{chatId: string, error: string}>; // Ошибки

  // Metadata
  createdBy: string; // UID пользователя
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// stores/{storeId}/chats/{chatId}/messages/{messageId}
// Сообщения из broadcast помечаются:
interface Message {
  // ... existing fields
  isBroadcast?: boolean;
  broadcastId?: string; // Ссылка на BroadcastCampaign
}
```

### Server Action Implementation

```typescript
// src/lib/server-actions/send-broadcast.ts

'use server';

import { firestore } from '@/firebase/config';
import { sendMessageToChat } from '@/lib/wb-actions';

interface BroadcastFilters {
  tags?: string[];
  lastMessageWithinDays?: number;
  lastMessageSender?: 'user' | 'seller';
}

export async function sendBroadcastToChats(
  storeId: string,
  filters: BroadcastFilters,
  message: string
): Promise<{ success: boolean; broadcastId: string; totalSent: number }> {

  // 1. Получаем чаты по фильтрам
  const chatsQuery = firestore
    .collection('stores').doc(storeId)
    .collection('chats');

  let query = chatsQuery.where('storeId', '==', storeId);

  // Применяем фильтры
  if (filters.tags && filters.tags.length > 0) {
    query = query.where('tag', 'in', filters.tags);
  }

  if (filters.lastMessageWithinDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.lastMessageWithinDays);
    query = query.where('lastMessageDate', '>=', cutoffDate);
  }

  if (filters.lastMessageSender) {
    query = query.where('lastMessageSender', '==', filters.lastMessageSender);
  }

  const chatsSnapshot = await query.get();
  const chatIds = chatsSnapshot.docs.map(doc => doc.id);

  // 2. Создаем запись о broadcast campaign
  const broadcastRef = firestore
    .collection('stores').doc(storeId)
    .collection('broadcasts').doc();

  await broadcastRef.set({
    storeId,
    filters,
    message,
    totalRecipients: chatIds.length,
    sentCount: 0,
    errorCount: 0,
    status: 'in_progress',
    chatIds,
    errors: [],
    createdAt: new Date(),
  });

  // 3. Отправляем сообщения с rate limiting
  const errors: Array<{chatId: string, error: string}> = [];
  let sentCount = 0;

  for (let i = 0; i < chatIds.length; i++) {
    const chatId = chatIds[i];

    try {
      // Отправляем через WB API
      await sendMessageToChat(storeId, chatId, message);

      // Сохраняем в Firestore
      await firestore
        .collection('stores').doc(storeId)
        .collection('chats').doc(chatId)
        .collection('messages').add({
          text: message,
          sender: 'seller',
          isBroadcast: true,
          broadcastId: broadcastRef.id,
          createdAt: new Date(),
        });

      sentCount++;

      // Обновляем прогресс каждые 10 сообщений
      if (i % 10 === 0) {
        await broadcastRef.update({
          sentCount,
          errorCount: errors.length,
        });
      }

    } catch (error) {
      errors.push({ chatId, error: error.message });
    }

    // Rate limiting: 10 сообщений/сек = 100ms между запросами
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 4. Финализируем
  await broadcastRef.update({
    status: 'completed',
    sentCount,
    errorCount: errors.length,
    errors: errors.slice(0, 50), // Первые 50 ошибок
    completedAt: new Date(),
  });

  return {
    success: true,
    broadcastId: broadcastRef.id,
    totalSent: sentCount,
  };
}

// Preview: подсчет чатов без отправки
export async function previewBroadcast(
  storeId: string,
  filters: BroadcastFilters
): Promise<{ count: number; chatIds: string[] }> {

  let query = firestore
    .collection('stores').doc(storeId)
    .collection('chats')
    .where('storeId', '==', storeId);

  if (filters.tags && filters.tags.length > 0) {
    query = query.where('tag', 'in', filters.tags);
  }

  if (filters.lastMessageWithinDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.lastMessageWithinDays);
    query = query.where('lastMessageDate', '>=', cutoffDate);
  }

  if (filters.lastMessageSender) {
    query = query.where('lastMessageSender', '==', filters.lastMessageSender);
  }

  const snapshot = await query.get();
  const chatIds = snapshot.docs.map(doc => doc.id);

  return { count: chatIds.length, chatIds };
}
```

### UI Component

```tsx
// src/components/BroadcastModal.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { previewBroadcast, sendBroadcastToChats } from '@/lib/server-actions/send-broadcast';

export function BroadcastModal({ storeId, isOpen, onClose }: Props) {
  const [step, setStep] = useState(1); // 1: Фильтры, 2: Текст, 3: Подтверждение, 4: Прогресс
  const [filters, setFilters] = useState({
    tags: [],
    lastMessageWithinDays: undefined,
    lastMessageSender: undefined,
  });
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState({ count: 0, chatIds: [] });
  const [progress, setProgress] = useState({ sent: 0, total: 0 });

  const handlePreview = async () => {
    const result = await previewBroadcast(storeId, filters);
    setPreview(result);
    setStep(2);
  };

  const handleSend = async () => {
    setStep(4);
    const result = await sendBroadcastToChats(storeId, filters, message);
    setProgress({ sent: result.totalSent, total: preview.count });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Массовая рассылка в чаты</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="font-medium">Теги чатов</label>
              <div className="flex gap-2 mt-2">
                {['active', 'no_reply', 'successful', 'unsuccessful'].map(tag => (
                  <Checkbox
                    key={tag}
                    checked={filters.tags.includes(tag)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFilters(f => ({ ...f, tags: [...f.tags, tag] }));
                      } else {
                        setFilters(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
                      }
                    }}
                  >
                    {tag}
                  </Checkbox>
                ))}
              </div>
            </div>

            <Button onClick={handlePreview}>Далее</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-lg font-medium">
              Будет отправлено в {preview.count} чатов
            </p>

            <Textarea
              placeholder="Введите текст сообщения..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={6}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Назад</Button>
              <Button onClick={() => setStep(3)} disabled={!message.trim()}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
              ⚠️ Вы уверены? Будет отправлено <strong>{preview.count}</strong> сообщений. Это действие нельзя отменить.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Отмена</Button>
              <Button onClick={handleSend}>Отправить</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p>Отправлено: {progress.sent} / {progress.total}</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(progress.sent / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Метрики успеха

**KPIs:**
- ⏱️ Экономия времени: 30 мин/рассылку → 2 мин
- 📨 Кол-во массовых рассылок: > 50/месяц (на все магазины)
- ✅ Success Rate отправки: > 95%
- 😊 User satisfaction: +20% (из опросов)

**Мониторинг:**
- Кол-во broadcast campaigns/день
- Среднее кол-во получателей/рассылку
- Error rate при отправке

---

## Зависимости

**Внешние:**
- Wildberries Chat API (rate limits)
- Firestore write limits

**Внутренние:**
- Существующая архитектура чатов
- `sendMessageToChat` функция

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| WB API rate limit ban | Средняя | Высокое | Rate limiting (100ms/сообщение), retry logic |
| Спам-жалобы от покупателей | Низкая | Среднее | Предупреждение в UI, история рассылок |
| Firestore write costs | Средняя | Низкое | Batch writes, лимит на 500 сообщений/рассылку |

---

## Timeline

**Week 1:**
- Day 1-2: Server Action + Firestore schema
- Day 3-4: UI компонент с фильтрами и preview
- Day 5: Тестирование + production rollout

---

## Монетизация

**Не влияет напрямую**, но:
- Killer feature для магазинов с большим объемом чатов
- Упоминается в маркетинговых материалах
- Снижает churn за счет улучшения UX

**Value Proposition:**
- "Отправьте промо-код всем активным клиентам за 2 минуты вместо 30"

---

## Definition of Done

- ✅ Модальное окно с фильтрами и preview
- ✅ Server Action для отправки с rate limiting
- ✅ Firestore schema для BroadcastCampaign
- ✅ Логирование всех рассылок
- ✅ Страница истории рассылок
- ✅ Протестировано на 100+ чатах
- ✅ Документация для пользователей

---

**Создано:** 30 декабря 2024
**Обновлено:** 30 декабря 2024
**Следующий ревью:** Sprint Planning Q2 2025
