# EPIC-013: Аналитические дашборды для магазинов

**Статус:** 📋 Backlog
**Приоритет:** P1 (Высокий)
**RICE Score:** 100
**Квартал:** Q2 2025 (Апрель - Июнь)
**Оценка:** 2 недели (10 SP)
**Владелец:** Product Manager

---

## Проблема

Сейчас владельцы магазинов видят только сырые данные (таблицы отзывов, чатов), но нет **аналитических инсайтов**:
- Какой средний рейтинг по магазину за период?
- Сколько отзывов получено за последний месяц?
- Какой процент чатов успешно закрыт?
- Динамика негативных отзывов по времени

**Боль пользователей:**
- Приходится вручную считать статистику в Excel
- Невозможно быстро оценить тренды (улучшается/ухудшается репутация)
- Нет данных для принятия решений

**Конкуренты:**
- У конкурентов есть базовые дашборды, но без AI-инсайтов
- Возможность добавить уникальную ценность через AI-анализ

---

## Решение

Создать комплексный аналитический дашборд для каждого магазина с:
1. **Обзорные метрики** (KPI cards): средний рейтинг, кол-во отзывов, время ответа
2. **Графики динамики**: отзывы по времени, распределение рейтингов
3. **Sentiment Analysis**: доля позитивных/негативных/нейтральных отзывов
4. **Chat Analytics**: успешность диалогов, среднее время ответа
5. **Сравнение периодов**: "На 15% больше отзывов, чем в прошлом месяце"
6. **AI Insights**: автоматические рекомендации ("Увеличилось кол-во жалоб на доставку")

---

## User Stories

### US-028: Обзорный дашборд магазина
**Как:** владелец магазина
**Я хочу:** видеть ключевые метрики магазина на одной странице
**Чтобы:** быстро оценивать состояние репутации

**Acceptance Criteria:**
- ✅ Вижу 6 KPI cards: средний рейтинг, кол-во отзывов (месяц), кол-во чатов, % закрытых чатов, среднее время ответа, кол-во жалоб
- ✅ Каждая метрика показывает изменение vs прошлый период (+15% ↑)
- ✅ График динамики отзывов за последние 30 дней
- ✅ Круговая диаграмма распределения рейтингов (5★: 60%, 4★: 20%, ...)
- ✅ Могу выбрать период: 7 дней, 30 дней, 90 дней, год

**Story Points:** 5 SP (3-5 дней)

---

### US-029: Sentiment Analysis отзывов
**Как:** владелец магазина
**Я хочу:** видеть долю позитивных/негативных отзывов
**Чтобы:** понимать общее настроение покупателей

**Acceptance Criteria:**
- ✅ Вижу график: позитивные (green), нейтральные (yellow), негативные (red)
- ✅ Динамика sentiment по времени (тренд)
- ✅ Могу кликнуть на сегмент и увидеть отзывы этой категории
- ✅ AI автоматически классифицирует sentiment при синхронизации

**Story Points:** 3 SP (2-3 дня)

---

### US-030: AI Insights и рекомендации
**Как:** владелец магазина
**Я хочу:** получать автоматические инсайты из данных
**Чтобы:** не пропустить важные тренды

**Acceptance Criteria:**
- ✅ Вижу секцию "AI Insights" с 3-5 автоматическими находками
- ✅ Примеры:
  - "⚠️ Рост негативных отзывов на 25% за последнюю неделю"
  - "✅ Среднее время ответа улучшилось на 40%"
  - "📈 Топ-3 жалобы: доставка (12), размер (8), качество (5)"
- ✅ Каждый инсайт кликабельный (ведет к деталям)

**Story Points:** 2 SP (1-2 дня)

---

## Технические детали

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│  Дашборд магазина "Магазин А"                       │
│  Период: [Последние 30 дней ▼]                     │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  4.7 ★   │ │  1,234   │ │  87%     │           │
│  │ Рейтинг  │ │ Отзывов  │ │ Закрыто  │           │
│  │ +0.2 ↑   │ │ +15% ↑   │ │ -5% ↓    │           │
│  └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────┤
│  График динамики отзывов                            │
│  [Линейный график: количество отзывов по дням]      │
├─────────────────────────────────────────────────────┤
│  Распределение рейтингов     Sentiment Analysis     │
│  [Круговая диаграмма]       [Столбчатая диаграмма] │
├─────────────────────────────────────────────────────┤
│  AI Insights                                        │
│  ⚠️ Рост негативных отзывов на 25%                 │
│  ✅ Среднее время ответа улучшилось на 40%         │
│  📈 Топ-3 жалобы: доставка (12), размер (8)        │
└─────────────────────────────────────────────────────┘
```

### Firestore Schema

```typescript
// stores/{storeId}/analytics/{period}
interface StoreAnalytics {
  storeId: string;
  period: 'day' | 'week' | 'month'; // Агрегация по периоду

  // Review Metrics
  reviewMetrics: {
    totalReviews: number;
    averageRating: number;
    ratingDistribution: {
      '5': number;
      '4': number;
      '3': number;
      '2': number;
      '1': number;
    };
    sentimentDistribution: {
      positive: number; // %
      neutral: number;
      negative: number;
    };
  };

  // Chat Metrics
  chatMetrics: {
    totalChats: number;
    activeCh ats: number;
    closedChats: number;
    successRate: number; // % успешных
    averageResponseTime: number; // Часы
  };

  // Complaint Metrics
  complaintMetrics: {
    totalComplaints: number;
    autoGenerated: number;
    manualCreated: number;
  };

  // Trends (vs previous period)
  trends: {
    reviewsChange: number; // +15%
    ratingChange: number; // +0.2
    chatSuccessChange: number; // -5%
  };

  // AI Insights
  aiInsights: Array<{
    type: 'warning' | 'success' | 'info';
    title: string;
    description: string;
    actionUrl?: string; // Куда перейти при клике
  }>;

  // Metadata
  periodStart: Timestamp;
  periodEnd: Timestamp;
  generatedAt: Timestamp;
}
```

### Cloud Function для агрегации

```typescript
// functions/src/scheduled/generate-analytics.ts

import * as functions from 'firebase-functions';
import { firestore } from '../firebase-admin';

export const scheduledAnalyticsGeneration = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('Europe/Moscow')
  .onRun(async (context) => {
    const stores = await firestore.collection('stores').get();

    for (const storeDoc of stores.docs) {
      await generateAnalyticsForStore(storeDoc.id);
    }

    return null;
  });

async function generateAnalyticsForStore(storeId: string) {
  const now = new Date();
  const last30Days = new Date(now);
  last30Days.setDate(last30Days.getDate() - 30);

  const prev30Days = new Date(last30Days);
  prev30Days.setDate(prev30Days.getDate() - 30);

  // 1. Получаем отзывы за последние 30 дней
  const reviewsQuery = firestore
    .collectionGroup('reviews')
    .where('storeId', '==', storeId)
    .where('date', '>=', last30Days)
    .where('date', '<=', now);

  const reviewsSnapshot = await reviewsQuery.get();
  const reviews = reviewsSnapshot.docs.map(doc => doc.data());

  // 2. Считаем метрики
  const totalReviews = reviews.length;
  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

  const ratingDistribution = {
    '5': reviews.filter(r => r.rating === 5).length,
    '4': reviews.filter(r => r.rating === 4).length,
    '3': reviews.filter(r => r.rating === 3).length,
    '2': reviews.filter(r => r.rating === 2).length,
    '1': reviews.filter(r => r.rating === 1).length,
  };

  // 3. Sentiment Analysis (через AI)
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  for (const review of reviews) {
    const sentiment = await analyzeSentiment(review.text);
    sentimentCounts[sentiment]++;
  }

  const sentimentDistribution = {
    positive: (sentimentCounts.positive / totalReviews) * 100,
    neutral: (sentimentCounts.neutral / totalReviews) * 100,
    negative: (sentimentCounts.negative / totalReviews) * 100,
  };

  // 4. Сравнение с предыдущим периодом
  const prevReviewsSnapshot = await firestore
    .collectionGroup('reviews')
    .where('storeId', '==', storeId)
    .where('date', '>=', prev30Days)
    .where('date', '<', last30Days)
    .get();

  const prevTotalReviews = prevReviewsSnapshot.size;
  const reviewsChange = ((totalReviews - prevTotalReviews) / prevTotalReviews) * 100;

  // 5. AI Insights
  const aiInsights = await generateAIInsights({
    reviewsChange,
    sentimentDistribution,
    topComplaints: extractTopComplaints(reviews),
  });

  // 6. Сохраняем в Firestore
  await firestore
    .collection('stores').doc(storeId)
    .collection('analytics').doc('month')
    .set({
      storeId,
      period: 'month',
      reviewMetrics: {
        totalReviews,
        averageRating,
        ratingDistribution,
        sentimentDistribution,
      },
      trends: {
        reviewsChange,
      },
      aiInsights,
      periodStart: last30Days,
      periodEnd: now,
      generatedAt: new Date(),
    });
}

async function analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
  // Упрощенная эвристика (можно заменить на AI)
  const positiveWords = ['хорошо', 'отлично', 'супер', 'рекомендую'];
  const negativeWords = ['плохо', 'ужасно', 'не рекомендую', 'разочарован'];

  const lowerText = text.toLowerCase();

  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

async function generateAIInsights(data: any): Promise<any[]> {
  const insights = [];

  // Инсайт 1: Рост/падение отзывов
  if (Math.abs(data.reviewsChange) > 15) {
    insights.push({
      type: data.reviewsChange > 0 ? 'success' : 'warning',
      title: `${data.reviewsChange > 0 ? 'Рост' : 'Снижение'} отзывов на ${Math.abs(data.reviewsChange).toFixed(0)}%`,
      description: 'По сравнению с прошлым месяцем',
      actionUrl: '/reviews',
    });
  }

  // Инсайт 2: Негативные отзывы
  if (data.sentimentDistribution.negative > 30) {
    insights.push({
      type: 'warning',
      title: `Высокая доля негативных отзывов (${data.sentimentDistribution.negative.toFixed(0)}%)`,
      description: 'Рекомендуем проанализировать причины',
      actionUrl: '/reviews?sentiment=negative',
    });
  }

  // Инсайт 3: Топ жалобы
  if (data.topComplaints.length > 0) {
    const top = data.topComplaints[0];
    insights.push({
      type: 'info',
      title: `Топ-1 жалоба: ${top.category} (${top.count} упоминаний)`,
      description: 'Обратите внимание на этот аспект',
      actionUrl: `/reviews?complaint=${top.category}`,
    });
  }

  return insights;
}

function extractTopComplaints(reviews: any[]): Array<{category: string, count: number}> {
  // Упрощенная категоризация (можно заменить на AI)
  const complaints: Record<string, number> = {};

  reviews.forEach(review => {
    if (review.rating <= 2) {
      const text = review.text.toLowerCase();

      if (text.includes('доставка')) complaints['доставка'] = (complaints['доставка'] || 0) + 1;
      if (text.includes('размер')) complaints['размер'] = (complaints['размер'] || 0) + 1;
      if (text.includes('качество')) complaints['качество'] = (complaints['качество'] || 0) + 1;
      if (text.includes('упаковка')) complaints['упаковка'] = (complaints['упаковка'] || 0) + 1;
    }
  });

  return Object.entries(complaints)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}
```

### React Component

```tsx
// src/app/stores/[storeId]/analytics/page.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, PieChart, BarChart } from 'recharts';

export default async function AnalyticsPage({ params }: { params: { storeId: string } }) {
  const analytics = await getAnalyticsForStore(params.storeId);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Аналитика</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="Средний рейтинг"
          value={analytics.reviewMetrics.averageRating.toFixed(1)}
          change={analytics.trends.ratingChange}
          icon="⭐"
        />
        <MetricCard
          title="Отзывов"
          value={analytics.reviewMetrics.totalReviews}
          change={analytics.trends.reviewsChange}
          icon="📝"
        />
        <MetricCard
          title="Чатов закрыто"
          value={`${analytics.chatMetrics.successRate}%`}
          change={analytics.trends.chatSuccessChange}
          icon="✅"
        />
      </div>

      {/* Графики */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Распределение рейтингов</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart data={analytics.reviewMetrics.ratingDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sentiment Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={analytics.reviewMetrics.sentimentDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle>AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.aiInsights.map((insight, i) => (
            <div key={i} className="p-3 border rounded mb-2">
              {insight.type === 'warning' && '⚠️'}
              {insight.type === 'success' && '✅'}
              {insight.type === 'info' && '📈'}
              <strong>{insight.title}</strong>
              <p className="text-sm text-muted-foreground">{insight.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Метрики успеха

**KPIs:**
- 📊 80%+ пользователей заходят в Analytics хотя бы 1 раз/неделю
- ⏱️ Экономия времени: 1 час/неделю (не нужен Excel)
- 😊 User satisfaction: +25% (feature surveys)
- 💼 Снижение churn на 10% (данные для принятия решений)

**Мониторинг:**
- Page views на /analytics
- Время на странице (engagement)
- Клики на AI Insights

---

## Зависимости

**Внешние:**
- Recharts для графиков
- Deepseek API для sentiment analysis (опционально)

**Внутренние:**
- Существующие коллекции reviews, chats
- Cloud Functions для агрегации

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Долгая генерация аналитики | Средняя | Среднее | Pre-compute ежедневно, кэш в Firestore |
| Firestore read costs | Высокая | Среднее | Collection Group Queries + лимит на 30k документов |
| Неточный sentiment | Средняя | Низкое | Использовать AI (Deepseek) вместо эвристик |

---

## Timeline

**Week 1:**
- Day 1-3: Firestore schema + Cloud Function агрегации
- Day 4-5: UI компоненты (KPI cards, графики)

**Week 2:**
- Day 1-2: Sentiment Analysis через AI
- Day 3-4: AI Insights генерация
- Day 5: Тестирование + rollout

---

## Монетизация

**Влияние на $100/месяц подписку:**
- Аналитика = **обязательная функция** для Full версии
- Конкуренты предлагают только базовую статистику
- AI Insights = **уникальный дифференциатор**

**Value Proposition:**
- "Принимайте решения на основе данных, а не догадок"
- "AI автоматически находит проблемы за вас"

---

## Definition of Done

- ✅ KPI cards с трендами (vs прошлый период)
- ✅ Графики: динамика отзывов, распределение рейтингов, sentiment
- ✅ Sentiment Analysis через AI
- ✅ AI Insights с 3-5 автоматическими находками
- ✅ Cloud Function для ежедневной генерации аналитики
- ✅ Выбор периода: 7д, 30д, 90д, год
- ✅ Протестировано на 5+ магазинах
- ✅ Документация для пользователей

---

**Создано:** 30 декабря 2024
**Обновлено:** 30 декабря 2024
**Следующий ревью:** Sprint Planning Q2 2025
