# EPIC-014: Автоответы на отзывы и вопросы (Premium)

**Статус:** 📋 Backlog
**Приоритет:** P1 (Высокий)
**RICE Score:** 67.5
**Квартал:** Q2 2025 (Май - Июнь)
**Оценка:** 4 недели (18 SP)
**Владелец:** Product Manager

---

## Проблема

**Текущий процесс ответа на отзывы:**
1. Менеджер читает отзыв
2. Генерирует AI-ответ (нажимает кнопку)
3. Копирует текст
4. Отправляет через WB интерфейс вручную

**Боль:**
- Все еще требует ручных действий (копировать-вставить)
- Нужно помнить отвечать ежедневно
- На 50 отзывов/день уходит 1+ час

**Конкуренты:**
- Предлагают автоответы, НО только по шаблонам (без AI)
- Наше преимущество: **AI + автоматизация**

---

## Решение

Полностью автоматическая система ответов на отзывы и вопросы:
1. **Триггер:** каждые 30 минут проверяем новые отзывы/вопросы
2. **AI-генерация:** создаем персонализированные ответы (не шаблоны!)
3. **Фильтрация:** отвечаем только на отзывы 4-5★ (или по настройке)
4. **Автоотправка:** через WB API
5. **Логирование:** все автоответы сохраняются для аудита

**Монетизация:**
- **Premium feature** (только в подписке $100/месяц)
- Killer feature для привлечения клиентов
- Конкурентное преимущество: AI вместо шаблонов

---

## User Stories

### US-033: Автоответы на позитивные отзывы
**Как:** владелец магазина
**Я хочу:** чтобы система автоматически отвечала на позитивные отзывы
**Чтобы:** экономить время и поддерживать высокий engagement

**Acceptance Criteria:**
- ✅ Включаю автоответы в настройках магазина
- ✅ Выбираю фильтр: рейтинг ≥ 4★, или все отзывы
- ✅ Каждые 30 минут система проверяет новые отзывы
- ✅ AI генерирует персонализированный ответ (не шаблон!)
- ✅ Ответ автоматически отправляется через WB API
- ✅ Вижу лог всех автоответов в UI
- ✅ Могу приостановить автоответы одной кнопкой

**Story Points:** 8 SP (1 неделя)

---

### US-034: Автоответы на вопросы о товарах
**Как:** владелец магазина
**Я хочу:** чтобы система автоматически отвечала на типовые вопросы
**Чтобы:** не терять клиентов из-за медленных ответов

**Acceptance Criteria:**
- ✅ Настраиваю FAQ базу для AI (характеристики товаров, доставка, возврат)
- ✅ AI автоматически отвечает на вопросы, если уверенность > 0.8
- ✅ Сложные вопросы (confidence < 0.8) помечаются для ручного ответа
- ✅ Вижу какие вопросы были отвечены автоматически
- ✅ Могу заблокировать автоответы на определенные темы

**Story Points:** 5 SP (3-5 дней)

---

### US-035: Настройка тона и стиля AI
**Как:** владелец магазина
**Я хочу:** настроить тон и стиль автоответов под свой бренд
**Чтобы:** ответы выглядели естественно и соответствовали имиджу магазина

**Acceptance Criteria:**
- ✅ Выбираю стиль: формальный, дружелюбный, краткий, развернутый
- ✅ Добавляю фирменные фразы (например, "С заботой, команда X")
- ✅ Настраиваю запрещенные слова/фразы
- ✅ Preview: вижу примеры ответов в выбранном стиле
- ✅ AI использует мои настройки при генерации

**Story Points:** 5 SP (3-5 дней)

---

## Технические детали

### Firestore Schema

```typescript
// stores/{storeId}/settings
interface StoreSettings {
  // ... existing fields

  autoReplies: {
    enabled: boolean;
    reviews: {
      enabled: boolean;
      minRating: 1 | 2 | 3 | 4 | 5; // Отвечать только на отзывы ≥ этого рейтинга
      maxPerDay: number; // Лимит автоответов/день (защита от спама)
    };
    questions: {
      enabled: boolean;
      confidenceThreshold: number; // 0.0-1.0, минимальная уверенность для автоответа
    };

    // Стиль ответов
    tone: 'formal' | 'friendly' | 'brief' | 'detailed';
    signature: string; // Подпись в конце ответа
    forbiddenWords: string[]; // Запрещенные слова

    // FAQ для вопросов
    faqKnowledge: Array<{
      question: string;
      answer: string;
      tags: string[];
    }>;
  };
}

// stores/{storeId}/autoReplyLogs/{logId}
interface AutoReplyLog {
  storeId: string;
  type: 'review' | 'question';

  // Оригинал
  itemId: string; // reviewId или questionId
  originalText: string;
  rating?: number; // Для отзывов

  // AI ответ
  generatedReply: string;
  confidence: number;
  sentToWB: boolean;

  // Metadata
  generatedAt: Timestamp;
  sentAt?: Timestamp;
  error?: string;
}
```

### Cloud Function для автоответов

```typescript
// functions/src/scheduled/auto-reply-reviews.ts

import * as functions from 'firebase-functions';
import { firestore } from '../firebase-admin';
import { generateReviewReply } from '../ai/generate-review-reply';
import { sendReplyToWB } from '../wb/send-reply';

export const scheduledAutoReplies = functions.pubsub
  .schedule('every 30 minutes')
  .timeZone('Europe/Moscow')
  .onRun(async (context) => {
    const stores = await firestore.collection('stores').get();

    for (const storeDoc of stores.docs) {
      const settings = storeDoc.data().settings;

      if (!settings?.autoReplies?.enabled) {
        continue;
      }

      try {
        // Автоответы на отзывы
        if (settings.autoReplies.reviews.enabled) {
          await processAutoRepliesForStore(storeDoc.id, settings);
        }

        // Автоответы на вопросы
        if (settings.autoReplies.questions.enabled) {
          await processAutoAnswersForStore(storeDoc.id, settings);
        }

      } catch (error) {
        console.error(`Store ${storeDoc.id}: Auto-reply failed`, error);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return null;
  });

async function processAutoRepliesForStore(storeId: string, settings: any) {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  // Получаем новые отзывы за последние 30 минут
  const reviewsQuery = firestore
    .collectionGroup('reviews')
    .where('storeId', '==', storeId)
    .where('rating', '>=', settings.autoReplies.reviews.minRating)
    .where('date', '>=', thirtyMinutesAgo)
    .where('date', '<=', now)
    .where('replied', '==', false); // Только без ответа

  const reviewsSnapshot = await reviewsQuery.get();

  // Лимит автоответов в день
  const todayCount = await getAutoReplyCountToday(storeId);
  const maxPerDay = settings.autoReplies.reviews.maxPerDay || 100;

  let sentCount = 0;

  for (const reviewDoc of reviewsSnapshot.docs) {
    if (todayCount + sentCount >= maxPerDay) {
      console.log(`Store ${storeId}: Daily limit reached (${maxPerDay})`);
      break;
    }

    const review = reviewDoc.data();

    try {
      // Генерируем AI-ответ
      const reply = await generateReviewReply(
        review.text,
        review.rating,
        settings.autoReplies.tone,
        settings.autoReplies.signature
      );

      // Отправляем в WB
      await sendReplyToWB(storeId, review.wbReviewId, reply.text);

      // Обновляем отзыв
      await reviewDoc.ref.update({
        replied: true,
        replyText: reply.text,
        repliedAt: new Date(),
        autoReplied: true,
      });

      // Логируем
      await firestore
        .collection('stores').doc(storeId)
        .collection('autoReplyLogs').add({
          storeId,
          type: 'review',
          itemId: reviewDoc.id,
          originalText: review.text,
          rating: review.rating,
          generatedReply: reply.text,
          confidence: reply.confidence,
          sentToWB: true,
          generatedAt: new Date(),
          sentAt: new Date(),
        });

      sentCount++;

    } catch (error) {
      console.error(`Failed to auto-reply to review ${reviewDoc.id}:`, error);

      await firestore
        .collection('stores').doc(storeId)
        .collection('autoReplyLogs').add({
          storeId,
          type: 'review',
          itemId: reviewDoc.id,
          originalText: review.text,
          generatedReply: '',
          confidence: 0,
          sentToWB: false,
          error: error.message,
          generatedAt: new Date(),
        });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`Store ${storeId}: Sent ${sentCount} auto-replies`);
}

async function getAutoReplyCountToday(storeId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logsSnapshot = await firestore
    .collection('stores').doc(storeId)
    .collection('autoReplyLogs')
    .where('generatedAt', '>=', today)
    .where('sentToWB', '==', true)
    .get();

  return logsSnapshot.size;
}
```

### AI Generation Logic

```typescript
// src/ai/generate-review-reply.ts

import { deepseek } from '@/lib/deepseek-client';

interface ReplyResult {
  text: string;
  confidence: number;
}

export async function generateReviewReply(
  reviewText: string,
  rating: number,
  tone: string,
  signature: string
): Promise<ReplyResult> {

  const toneInstructions = {
    formal: 'Используй формальный деловой стиль, избегай сленга',
    friendly: 'Будь дружелюбным и неформальным, используй эмодзи умеренно',
    brief: 'Ответ должен быть коротким (1-2 предложения)',
    detailed: 'Дай развернутый ответ (3-4 предложения)',
  };

  const prompt = `
Ты — менеджер магазина на Wildberries. Твоя задача — написать персонализированный ответ на отзыв покупателя.

Отзыв (${rating}★): "${reviewText}"

Требования:
- ${toneInstructions[tone]}
- Поблагодари за отзыв
- ${rating >= 4 ? 'Вырази радость, что покупателю понравилось' : 'Извинись и предложи решение'}
- Будь искренним, избегай шаблонных фраз
- Не упоминай конкурентов
- Длина: 2-4 предложения

Подпись в конце: "${signature}"

Ответ:
`;

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200,
  });

  const replyText = response.choices[0].message.content.trim();

  // Простая эвристика для confidence
  const confidence = replyText.length > 20 && replyText.length < 300 ? 0.9 : 0.6;

  return {
    text: replyText,
    confidence,
  };
}
```

### UI Component

```tsx
// src/app/stores/[storeId]/settings/AutoRepliesSettings.tsx

'use client';

import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AutoRepliesSettings({ storeId }: { storeId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [minRating, setMinRating] = useState(4);
  const [tone, setTone] = useState('friendly');
  const [signature, setSignature] = useState('С заботой, команда магазина');

  const handleSave = async () => {
    await updateDoc(doc(firestore, 'stores', storeId), {
      'settings.autoReplies': {
        enabled,
        reviews: {
          enabled,
          minRating,
          maxPerDay: 100,
        },
        tone,
        signature,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Автоответы (Premium)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label>Включить автоответы</label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            <div>
              <label>Отвечать на отзывы с рейтингом</label>
              <Select value={minRating} onValueChange={setMinRating}>
                <option value={5}>Только 5★</option>
                <option value={4}>4★ и выше</option>
                <option value={3}>3★ и выше</option>
                <option value={1}>Все отзывы</option>
              </Select>
            </div>

            <div>
              <label>Стиль ответов</label>
              <Select value={tone} onValueChange={setTone}>
                <option value="formal">Формальный</option>
                <option value="friendly">Дружелюбный</option>
                <option value="brief">Краткий</option>
                <option value="detailed">Развернутый</option>
              </Select>
            </div>

            <div>
              <label>Подпись</label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="С уважением, ..."
              />
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              ℹ️ <strong>Пример ответа в стиле "{tone}":</strong>
              <p className="text-sm mt-2">
                {generateExampleReply(tone, signature)}
              </p>
            </div>
          </>
        )}

        <Button onClick={handleSave}>Сохранить настройки</Button>
      </CardContent>
    </Card>
  );
}

function generateExampleReply(tone: string, signature: string): string {
  const examples = {
    formal: `Благодарим Вас за положительный отзыв. Мы рады, что товар соответствует Вашим ожиданиям. ${signature}`,
    friendly: `Спасибо за теплые слова! 😊 Очень приятно, что вам понравилось! ${signature}`,
    brief: `Спасибо за отзыв! ${signature}`,
    detailed: `Большое спасибо за такой подробный отзыв! Мы очень ценим ваше мнение и рады, что товар вас порадовал. Надеемся увидеть вас снова среди наших покупателей! ${signature}`,
  };

  return examples[tone];
}
```

---

## Метрики успеха

**KPIs:**
- ⏱️ Экономия времени: 1 час/день → 5 мин/день (проверка логов)
- 📈 Процент отвеченных отзывов: 30% → 95%
- ⚡ Среднее время ответа: 24ч → 30 минут
- 💰 Conversion в Premium подписку: +40% (из-за killer feature)

**Мониторинг:**
- Кол-во автоответов/день
- Success rate отправки (% без ошибок)
- User satisfaction (опросы)

---

## Зависимости

**Внешние:**
- Wildberries API для отправки ответов
- Deepseek API для AI-генерации

**Внутренние:**
- Cloud Functions + Cloud Scheduler
- Existing reviews/questions architecture

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| WB блокирует за автоответы | Низкая | Критично | Rate limiting (100/день), человекоподобные тексты (AI) |
| AI генерирует неподходящий ответ | Средняя | Высокое | Preview mode (тест 30 дней), ручное одобрение |
| Покупатели жалуются на "роботов" | Низкая | Среднее | Персонализация через AI (не шаблоны) |
| Высокая стоимость AI | Средняя | Среднее | Лимит 100 ответов/день, оптимизация промптов |

---

## Timeline

**Week 1-2:**
- Cloud Function для автоответов на отзывы
- AI prompt optimization
- WB API integration

**Week 3:**
- Автоответы на вопросы
- FAQ knowledge base

**Week 4:**
- UI настроек (тон, стиль, подпись)
- Логирование и мониторинг
- Testing + rollout

---

## Монетизация

**Ключевая Premium функция для $100/месяц подписки:**
- Автоответы = **главный дифференциатор** vs конкуренты
- Конкуренты: только шаблоны
- Мы: AI + персонализация + автоматизация

**Impact на цель 8,000 клиентов:**
- Killer feature для conversion
- Estimated: +30% signup rate

**Value Proposition:**
- "AI автоматически отвечает на отзывы 24/7"
- "Экономьте 7+ часов/неделю"
- "Увеличьте engagement на 200%"

---

## Definition of Done

- ✅ Cloud Function проверяет новые отзывы каждые 30 минут
- ✅ AI генерирует персонализированные ответы (не шаблоны)
- ✅ Автоотправка через WB API
- ✅ Фильтрация по рейтингу (настраиваемая)
- ✅ Лимит автоответов/день (защита от спама)
- ✅ Настройка тона, стиля, подписи
- ✅ FAQ база для вопросов
- ✅ Логирование всех автоответов
- ✅ UI страница настроек
- ✅ UI страница истории автоответов
- ✅ Протестировано на 100+ отзывах/вопросах
- ✅ Feature flag для постепенного rollout

---

**Создано:** 30 декабря 2024
**Обновлено:** 30 декабря 2024
**Следующий ревью:** Sprint Planning Q2 2025
