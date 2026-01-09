# EPIC-016: Автоматическая генерация жалоб на негативные отзывы

**Статус:** 📋 Backlog
**Приоритет:** P1 (Высокий)
**RICE Score:** 72
**Квартал:** Q2 2025 (Апрель - Июнь)
**Оценка:** 2 недели (8 SP)
**Владелец:** Product Manager

---

## Проблема

**Текущий процесс удаления негативных отзывов:**
1. Менеджер вручную читает негативный отзыв
2. Анализирует причину (нарушение правил WB или нет)
3. Пишет жалобу в Wildberries Support
4. Отправляет через форму WB
5. **Стоимость услуги: 600₽ за удаление**

**Боль:**
- Тратится 15-20 минут на каждую жалобу
- Нужно помнить шаблоны и правила WB
- Человеческий фактор: забывают отправить жалобы
- Теряется время = теряются деньги (600₽/жалобу)

**Возможность:**
- 80% жалоб можно автоматизировать с помощью AI
- Шаблоны для типовых нарушений (мат, офф-топик, реклама)

---

## Решение

Автоматическая AI-генерация жалоб сразу после синхронизации негативных отзывов (рейтинг 1-2 звезды).

**Функционал:**
1. Триггер: после `refreshReviews()` анализируем новые отзывы с рейтингом ≤ 2
2. AI классифицирует причину негативности (доставка, качество, мат, офф-топик)
3. Если обнаружено нарушение правил WB → генерируем черновик жалобы
4. Менеджер видит готовый черновик в UI
5. Одна кнопка "Отправить жалобу" (опционально с редактированием)
6. Логирование всех жалоб (статус, дата, результат)

**Бизнес-модель:**
- Текущий доход: 600₽ за удаление
- Автоматизация → можем обрабатывать больше жалоб
- Улучшает unit economics сервиса удаления отзывов

---

## User Stories

### US-031: Автогенерация черновиков жалоб
**Как:** менеджер магазина
**Я хочу:** чтобы жалобы на негативные отзывы автоматически создавались
**Чтобы:** не тратить время на написание шаблонов

**Acceptance Criteria:**
- ✅ Каждый новый отзыв с рейтингом ≤ 2 автоматически анализируется AI
- ✅ Если обнаружено нарушение WB → создается черновик жалобы
- ✅ В UI отзыва вижу бейдж "Жалоба готова"
- ✅ Могу открыть черновик, отредактировать и отправить
- ✅ Или отклонить жалобу (если не согласен с AI)

**Story Points:** 5 SP (3-5 дней)

---

### US-032: Отправка жалоб в WB
**Как:** менеджер магазина
**Я хочу:** отправлять жалобы в Wildberries одной кнопкой
**Чтобы:** ускорить процесс удаления негативных отзывов

**Acceptance Criteria:**
- ✅ Кнопка "Отправить жалобу" в UI отзыва
- ✅ Жалоба отправляется через WB API (или form submission)
- ✅ Вижу статус жалобы: "Отправлена", "На рассмотрении", "Одобрена", "Отклонена"
- ✅ Push-уведомление при изменении статуса

**Story Points:** 3 SP (2-3 дня)

---

## Технические детали

### AI Prompt для классификации

```typescript
const COMPLAINT_CLASSIFICATION_PROMPT = `
Ты — эксперт по правилам Wildberries. Твоя задача — проанализировать негативный отзыв и определить, нарушает ли он правила платформы.

Правила WB (запрещено):
1. Ненормативная лексика, оскорбления
2. Off-topic (отзыв не о товаре, а о доставке/WB)
3. Реклама других товаров/магазинов
4. Spam, бессмысленный текст
5. Угрозы, вымогательство

Отзыв:
"${reviewText}"

Ответь в формате JSON:
{
  "violates_rules": true/false,
  "violation_type": "profanity" | "off_topic" | "advertising" | "spam" | "threats" | "none",
  "complaint_text": "Текст жалобы для WB Support (если нарушение обнаружено)",
  "confidence": 0.0-1.0
}
`;
```

### Firestore Schema

```typescript
// stores/{storeId}/products/{productId}/reviews/{reviewId}
interface Review {
  // ... existing fields

  // Новые поля для жалоб
  complaintDraft?: {
    generated: boolean; // Создана AI?
    violationType: 'profanity' | 'off_topic' | 'advertising' | 'spam' | 'threats';
    complaintText: string; // Текст жалобы
    confidence: number; // 0.0-1.0
    generatedAt: Timestamp;
  };

  complaintStatus?: 'draft' | 'sent' | 'under_review' | 'approved' | 'rejected';
  complaintSentAt?: Timestamp;
  complaintResult?: string; // Ответ от WB
}

// stores/{storeId}/complaints/{complaintId}
interface Complaint {
  storeId: string;
  reviewId: string;
  productId: string;

  // Детали отзыва
  reviewRating: number;
  reviewText: string;
  reviewAuthor: string;
  reviewDate: Timestamp;

  // Жалоба
  violationType: string;
  complaintText: string;
  status: 'draft' | 'sent' | 'under_review' | 'approved' | 'rejected';

  // Metadata
  generatedByAI: boolean;
  editedByUser: boolean;
  sentAt?: Timestamp;
  resolvedAt?: Timestamp;
  wbResponse?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Cloud Function Implementation

```typescript
// functions/src/triggers/on-review-created.ts

import * as functions from 'firebase-functions';
import { firestore } from '../firebase-admin';
import { generateComplaint } from '../ai/generate-complaint';

export const onReviewCreated = functions.firestore
  .document('stores/{storeId}/products/{productId}/reviews/{reviewId}')
  .onCreate(async (snap, context) => {
    const review = snap.data();
    const { storeId, productId, reviewId } = context.params;

    // Только для негативных отзывов (≤ 2 звезды)
    if (review.rating > 2) {
      return null;
    }

    try {
      // Генерируем жалобу через AI
      const result = await generateComplaint(review.text);

      if (result.violates_rules && result.confidence > 0.7) {
        // Обновляем отзыв
        await snap.ref.update({
          complaintDraft: {
            generated: true,
            violationType: result.violation_type,
            complaintText: result.complaint_text,
            confidence: result.confidence,
            generatedAt: new Date(),
          },
          complaintStatus: 'draft',
        });

        // Создаем запись в коллекции complaints
        await firestore
          .collection('stores').doc(storeId)
          .collection('complaints').add({
            storeId,
            reviewId,
            productId,
            reviewRating: review.rating,
            reviewText: review.text,
            reviewAuthor: review.author,
            reviewDate: review.date,
            violationType: result.violation_type,
            complaintText: result.complaint_text,
            status: 'draft',
            generatedByAI: true,
            editedByUser: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

        console.log(`Complaint generated for review ${reviewId}`);
      } else {
        console.log(`No violation detected for review ${reviewId}`);
      }

    } catch (error) {
      console.error(`Failed to generate complaint for review ${reviewId}:`, error);
    }

    return null;
  });
```

### AI Generation Logic

```typescript
// src/ai/generate-complaint.ts

import { deepseek } from '@/lib/deepseek-client';

interface ComplaintResult {
  violates_rules: boolean;
  violation_type: string;
  complaint_text: string;
  confidence: number;
}

export async function generateComplaint(reviewText: string): Promise<ComplaintResult> {
  const prompt = `
Ты — эксперт по правилам Wildberries. Проанализируй отзыв и определи нарушение.

Правила WB (запрещено):
1. Ненормативная лексика, оскорбления
2. Off-topic (отзыв не о товаре, а о доставке/WB)
3. Реклама других товаров/магазинов
4. Spam, бессмысленный текст
5. Угрозы, вымогательство

Отзыв: "${reviewText}"

Ответь в формате JSON:
{
  "violates_rules": true/false,
  "violation_type": "profanity" | "off_topic" | "advertising" | "spam" | "threats" | "none",
  "complaint_text": "Текст жалобы для WB Support",
  "confidence": 0.0-1.0
}
`;

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content);

  // Fallback если AI не вернул правильный формат
  if (!result.violation_type) {
    return {
      violates_rules: false,
      violation_type: 'none',
      complaint_text: '',
      confidence: 0,
    };
  }

  // Добавляем шаблон жалобы
  if (result.violates_rules) {
    result.complaint_text = formatComplaintText(
      result.violation_type,
      reviewText
    );
  }

  return result;
}

function formatComplaintText(violationType: string, reviewText: string): string {
  const templates = {
    profanity: `
Здравствуйте! Прошу удалить отзыв, содержащий ненормативную лексику и оскорбления, что нарушает правила платформы Wildberries.

Текст отзыва: "${reviewText}"

Данный отзыв не соответствует требованиям к содержанию отзывов и содержит запрещенную лексику.

С уважением.
    `,
    off_topic: `
Здравствуйте! Прошу удалить отзыв, не относящийся к товару.

Текст отзыва: "${reviewText}"

Отзыв содержит претензии к работе службы доставки/Wildberries, а не оценку качества товара. Это нарушает правила публикации отзывов.

С уважением.
    `,
    advertising: `
Здравствуйте! Прошу удалить отзыв, содержащий рекламу сторонних ресурсов.

Текст отзыва: "${reviewText}"

Отзыв содержит рекламную информацию, что запрещено правилами Wildberries.

С уважением.
    `,
    spam: `
Здравствуйте! Прошу удалить спам-отзыв.

Текст отзыва: "${reviewText}"

Отзыв не содержит полезной информации о товаре и является бессмысленным набором символов/текста.

С уважением.
    `,
    threats: `
Здравствуйте! Прошу удалить отзыв, содержащий угрозы.

Текст отзыва: "${reviewText}"

Отзыв содержит угрозы и попытки вымогательства, что является серьезным нарушением правил платформы.

С уважением.
    `,
  };

  return templates[violationType] || '';
}
```

### UI Component

```tsx
// src/components/ComplaintBadge.tsx

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

export function ComplaintBadge({ review }: { review: Review }) {
  const [isOpen, setIsOpen] = useState(false);
  const [complaintText, setComplaintText] = useState(review.complaintDraft?.complaintText || '');
  const [isSending, setIsSending] = useState(false);

  if (!review.complaintDraft) {
    return null;
  }

  const handleSendComplaint = async () => {
    setIsSending(true);
    try {
      await fetch('/api/complaints/send', {
        method: 'POST',
        body: JSON.stringify({
          reviewId: review.id,
          complaintText,
        }),
      });

      // Обновляем статус
      alert('Жалоба отправлена!');
      setIsOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Badge
        variant={review.complaintStatus === 'draft' ? 'secondary' : 'default'}
        className="cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        {review.complaintStatus === 'draft' && '📝 Жалоба готова'}
        {review.complaintStatus === 'sent' && '📤 Отправлена'}
        {review.complaintStatus === 'approved' && '✅ Одобрена'}
        {review.complaintStatus === 'rejected' && '❌ Отклонена'}
      </Badge>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Жалоба на отзыв</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="font-medium">Отзыв ({review.rating}★)</label>
              <p className="text-sm text-muted-foreground">{review.text}</p>
            </div>

            <div>
              <label className="font-medium">Тип нарушения</label>
              <Badge>{review.complaintDraft.violationType}</Badge>
              <span className="text-sm text-muted-foreground ml-2">
                (уверенность: {(review.complaintDraft.confidence * 100).toFixed(0)}%)
              </span>
            </div>

            <div>
              <label className="font-medium">Текст жалобы</label>
              <Textarea
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Вы можете отредактировать текст перед отправкой
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSendComplaint}
                disabled={isSending || !complaintText.trim()}
              >
                {isSending ? 'Отправка...' : 'Отправить жалобу'}
              </Button>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## Метрики успеха

**KPIs:**
- ⏱️ Экономия времени: 15 мин → 2 мин (на жалобу)
- 🎯 Точность AI классификации: > 80%
- 📈 Кол-во жалоб/месяц: +200% (автоматизация)
- 💰 Доход от удалений: +200% (600₽ × больше жалоб)

**Мониторинг:**
- Кол-во автосгенерированных жалоб
- Процент одобренных WB жалоб
- Время от отзыва до отправки жалобы

---

## Зависимости

**Внешние:**
- Deepseek API для AI-анализа
- Wildberries API для отправки жалоб (или form submission)

**Внутренние:**
- Firestore triggers (onCreate для reviews)
- Существующая архитектура отзывов

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| AI ошибается (false positive) | Средняя | Среднее | Confidence threshold 0.7, ручная проверка перед отправкой |
| WB блокирует за спам жалоб | Низкая | Высокое | Rate limiting, только жалобы с confidence > 0.8 |
| Нет API для отправки жалоб | Высокая | Среднее | Fallback: показываем текст + ссылку на WB Support форму |

---

## Timeline

**Week 1:**
- Day 1-2: AI prompt + generation logic
- Day 3-4: Firestore trigger + schema
- Day 5: UI компонент для просмотра/редактирования жалоб

**Week 2:**
- Day 1-2: Интеграция с WB API (отправка жалоб)
- Day 3-4: Статусы жалоб + уведомления
- Day 5: Тестирование + rollout

---

## Монетизация

**Прямое влияние на доход:**
- Текущий доход: **600₽ за удаление отзыва**
- Автоматизация → обрабатываем в 7x раз больше жалоб
- **Потенциал: 50+ удалений/месяц = 30,000₽/месяц дополнительного дохода**

**Влияние на $100 подписку:**
- Автожалобы = **Premium feature** (только в Full версии)
- Конкуренты не предлагают такую автоматизацию

**Value Proposition:**
- "AI автоматически создает жалобы на нарушения правил WB"
- "Удаляйте негативные отзывы в 7x раз быстрее"

---

## Definition of Done

- ✅ AI анализирует каждый отзыв ≤ 2★ после синхронизации
- ✅ Автогенерация черновиков жалоб (confidence > 0.7)
- ✅ UI для просмотра, редактирования, отправки жалоб
- ✅ Интеграция с WB API для отправки
- ✅ Статусы жалоб: draft → sent → under_review → approved/rejected
- ✅ Push-уведомления при изменении статуса
- ✅ Логирование всех жалоб в отдельной коллекции
- ✅ Протестировано на 50+ негативных отзывах
- ✅ Точность AI > 80% (manual review)

---

**Создано:** 30 декабря 2024
**Обновлено:** 30 декабря 2024
**Следующий ревью:** Sprint Planning Q2 2025
