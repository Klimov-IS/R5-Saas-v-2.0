# EPIC-018: Автоматическая генерация FAQ из диалогов

**Статус:** 📋 Backlog
**Приоритет:** P3 (Низкий)
**RICE Score:** 26.25
**Квартал:** Q3 2025 (Август - Сентябрь)
**Оценка:** 8 недель (35 SP)
**Владелец:** Product Manager

---

## Проблема

**Создание FAQ вручную — трудоемкий процесс:**
- Менеджеры отвечают на одни и те же вопросы десятки раз
- Нужно помнить все типичные вопросы и ответы
- FAQ устаревает (новые товары, изменение политики)
- Нет системы для выявления популярных вопросов

**Потерянная ценность:**
- В истории диалогов уже есть все ответы
- 80% вопросов повторяются
- Можно автоматизировать извлечение паттернов

---

## Решение

AI-система, которая:
1. Анализирует успешные диалоги с покупателями (тег "successful")
2. Извлекает типичные вопросы и ответы
3. Кластеризует похожие вопросы
4. Генерирует FAQ для базы знаний AI-ассистента
5. Предлагает владельцу магазина одобрить/отклонить

**Технологии:**
- NLP для извлечения вопросов из диалогов
- Clustering для группировки похожих вопросов
- LLM для генерации обобщенных FAQ
- Human-in-the-loop (одобрение владельцем)

---

## User Stories

### US-041: Анализ диалогов и извлечение вопросов
**Как:** AI-система
**Я хочу:** анализировать успешные диалоги
**Чтобы:** находить типичные вопросы покупателей

**Acceptance Criteria:**
- ✅ Еженедельно анализирую все чаты с тегом "successful"
- ✅ Извлекаю вопросы покупателей (фильтрую сообщения от клиентов)
- ✅ Группирую похожие вопросы (semantic similarity)
- ✅ Вижу топ-20 самых частых вопросов

**Story Points:** 13 SP (2 недели)

---

### US-042: Генерация FAQ из кластеров
**Как:** AI-система
**Я хочу:** генерировать обобщенные FAQ из групп похожих вопросов
**Чтобы:** создать универсальную базу знаний

**Acceptance Criteria:**
- ✅ Для каждого кластера вопросов генерирую обобщенный вопрос
- ✅ Нахожу лучший ответ из успешных диалогов
- ✅ Генерирую FAQ entry (вопрос + ответ + теги)
- ✅ Сохраняю в staging (не публикую сразу)

**Story Points:** 13 SP (2 недели)

---

### US-043: Одобрение FAQ владельцем магазина
**Как:** владелец магазина
**Я хочу:** просматривать и одобрять автосгенерированные FAQ
**Чтобы:** контролировать качество базы знаний

**Acceptance Criteria:**
- ✅ Вижу список предложенных FAQ (вопрос + ответ)
- ✅ Для каждого FAQ вижу: частота (сколько раз встречался), источник (диалоги)
- ✅ Могу одобрить (добавится в базу знаний)
- ✅ Могу отклонить (не добавится)
- ✅ Могу отредактировать перед одобрением

**Story Points:** 5 SP (3-5 дней)

---

### US-044: Мониторинг и статистика FAQ
**Как:** владелец магазина
**Я хочу:** видеть статистику использования FAQ
**Чтобы:** понимать какие вопросы самые популярные

**Acceptance Criteria:**
- ✅ Вижу топ-10 FAQ по частоте использования
- ✅ Вижу тренды: новые популярные вопросы
- ✅ Получаю уведомления: "Новый частый вопрос обнаружен"
- ✅ Могу экспортировать FAQ в PDF/Excel

**Story Points:** 4 SP (2-3 дня)

---

## Технические детали

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Cloud Function (еженедельно)                   │
├─────────────────────────────────────────────────┤
│  1. Загружаем successful chats за неделю        │
│  2. Извлекаем вопросы клиентов (NLP)            │
│  3. Генерируем embeddings для каждого вопроса   │
│  4. Кластеризуем похожие вопросы (K-Means)      │
│  5. Для каждого кластера:                       │
│     - Генерируем обобщенный вопрос (LLM)        │
│     - Находим лучший ответ (LLM)                │
│     - Сохраняем в staging FAQ                   │
│  6. Уведомляем владельца                        │
└─────────────────────────────────────────────────┘
```

### Firestore Schema

```typescript
// stores/{storeId}/faqSuggestions/{suggestionId}
interface FAQSuggestion {
  storeId: string;

  // Generated FAQ
  question: string; // Обобщенный вопрос
  answer: string; // Обобщенный ответ
  tags: string[]; // Теги (товар, доставка, возврат, ...)

  // Metadata
  frequency: number; // Сколько раз встречался
  confidence: number; // 0.0-1.0
  sourceDialogues: string[]; // ID диалогов, откуда извлечено

  // Status
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string; // UID владельца
  reviewedAt?: Timestamp;

  createdAt: Timestamp;
}

// stores/{storeId}/faqAnalytics/{date}
interface FAQAnalytics {
  storeId: string;
  date: Timestamp; // Дата анализа

  // Stats
  totalDialoguesAnalyzed: number;
  questionsExtracted: number;
  clustersFound: number;
  faqGenerated: number;

  // Top Questions
  topQuestions: Array<{
    question: string;
    frequency: number;
    cluster: number;
  }>;

  // Execution time
  processingTimeMs: number;
}
```

### Cloud Function Implementation

```typescript
// functions/src/scheduled/generate-faq.ts

import * as functions from 'firebase-functions';
import { firestore } from '../firebase-admin';
import { extractQuestions, clusterQuestions, generateFAQ } from '../ai/faq-generator';

export const scheduledFAQGeneration = functions.pubsub
  .schedule('every sunday 03:00')
  .timeZone('Europe/Moscow')
  .onRun(async (context) => {
    const stores = await firestore.collection('stores').get();

    for (const storeDoc of stores.docs) {
      const storeId = storeDoc.id;

      try {
        await generateFAQForStore(storeId);
      } catch (error) {
        console.error(`Store ${storeId}: FAQ generation failed`, error);
      }
    }

    return null;
  });

async function generateFAQForStore(storeId: string) {
  const startTime = Date.now();

  // 1. Получаем успешные диалоги за последнюю неделю
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const chatsQuery = firestore
    .collectionGroup('chats')
    .where('storeId', '==', storeId)
    .where('tag', '==', 'successful')
    .where('updatedAt', '>=', oneWeekAgo);

  const chatsSnapshot = await chatsQuery.get();

  if (chatsSnapshot.empty) {
    console.log(`Store ${storeId}: No successful chats this week`);
    return;
  }

  // 2. Извлекаем вопросы из диалогов
  const allQuestions: Array<{ chatId: string, text: string }> = [];

  for (const chatDoc of chatsSnapshot.docs) {
    const messagesSnapshot = await chatDoc.ref.collection('messages')
      .where('sender', '==', 'user')
      .get();

    const questions = messagesSnapshot.docs.map(msgDoc => ({
      chatId: chatDoc.id,
      text: msgDoc.data().text,
    }));

    allQuestions.push(...questions);
  }

  console.log(`Store ${storeId}: Extracted ${allQuestions.length} questions`);

  // 3. Кластеризуем похожие вопросы
  const clusters = await clusterQuestions(allQuestions);

  console.log(`Store ${storeId}: Found ${clusters.length} question clusters`);

  // 4. Генерируем FAQ для каждого кластера
  for (const cluster of clusters) {
    // Пропускаем маленькие кластеры (< 3 вопросов)
    if (cluster.questions.length < 3) {
      continue;
    }

    const faq = await generateFAQ(cluster.questions, storeId);

    // Сохраняем как suggestion
    await firestore
      .collection('stores').doc(storeId)
      .collection('faqSuggestions').add({
        storeId,
        question: faq.question,
        answer: faq.answer,
        tags: faq.tags,
        frequency: cluster.questions.length,
        confidence: faq.confidence,
        sourceDialogues: cluster.questions.map(q => q.chatId),
        status: 'pending',
        createdAt: new Date(),
      });
  }

  // 5. Логируем статистику
  await firestore
    .collection('stores').doc(storeId)
    .collection('faqAnalytics').add({
      storeId,
      date: new Date(),
      totalDialoguesAnalyzed: chatsSnapshot.size,
      questionsExtracted: allQuestions.length,
      clustersFound: clusters.length,
      faqGenerated: clusters.filter(c => c.questions.length >= 3).length,
      processingTimeMs: Date.now() - startTime,
    });

  // 6. Уведомляем владельца
  await notifyStoreOwner(storeId, clusters.length);
}
```

### AI Logic for Clustering & FAQ Generation

```typescript
// src/ai/faq-generator.ts

import { deepseek } from '@/lib/deepseek-client';
import { generateEmbedding, cosineSimilarity } from '@/lib/embeddings';

interface Question {
  chatId: string;
  text: string;
}

interface Cluster {
  id: number;
  questions: Question[];
  centroid: number[]; // Embedding centroid
}

export async function clusterQuestions(questions: Question[]): Promise<Cluster[]> {
  // 1. Генерируем embeddings для каждого вопроса
  const embeddings = await Promise.all(
    questions.map(q => generateEmbedding(q.text))
  );

  // 2. K-Means clustering (упрощенная версия)
  const K = Math.min(10, Math.floor(questions.length / 5)); // Динамическое K
  const clusters: Cluster[] = [];

  // Инициализация кластеров (случайные центроиды)
  for (let i = 0; i < K; i++) {
    clusters.push({
      id: i,
      questions: [],
      centroid: embeddings[Math.floor(Math.random() * embeddings.length)],
    });
  }

  // Итеративное назначение вопросов к ближайшему кластеру
  for (let iter = 0; iter < 10; iter++) {
    // Reset clusters
    clusters.forEach(c => c.questions = []);

    // Assign to nearest cluster
    questions.forEach((q, idx) => {
      const embedding = embeddings[idx];
      let maxSimilarity = -1;
      let bestCluster = 0;

      clusters.forEach((cluster, clusterIdx) => {
        const similarity = cosineSimilarity(embedding, cluster.centroid);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestCluster = clusterIdx;
        }
      });

      clusters[bestCluster].questions.push(q);
    });

    // Recompute centroids
    clusters.forEach(cluster => {
      if (cluster.questions.length > 0) {
        const clusterEmbeddings = cluster.questions.map(q =>
          embeddings[questions.indexOf(q)]
        );

        // Average embedding
        cluster.centroid = clusterEmbeddings[0].map((_, dim) =>
          clusterEmbeddings.reduce((sum, emb) => sum + emb[dim], 0) / clusterEmbeddings.length
        );
      }
    });
  }

  // Фильтруем пустые кластеры
  return clusters.filter(c => c.questions.length > 0);
}

export async function generateFAQ(
  questions: Question[],
  storeId: string
): Promise<{ question: string; answer: string; tags: string[]; confidence: number }> {

  // Берем топ-5 самых частых вопросов из кластера
  const sampleQuestions = questions.slice(0, 5).map(q => q.text);

  const prompt = `
Ты — эксперт по FAQ. Твоя задача — создать обобщенный вопрос и ответ на основе группы похожих вопросов покупателей.

Вопросы покупателей:
${sampleQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Задание:
1. Сформулируй один обобщенный вопрос, который покрывает все эти вопросы
2. Напиши универсальный ответ (2-3 предложения)
3. Определи теги (товар, доставка, возврат, оплата, размер, качество)

Ответь в формате JSON:
{
  "question": "Обобщенный вопрос",
  "answer": "Универсальный ответ",
  "tags": ["тег1", "тег2"],
  "confidence": 0.0-1.0
}
`;

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const result = JSON.parse(response.choices[0].message.content);

  return {
    question: result.question,
    answer: result.answer,
    tags: result.tags || [],
    confidence: result.confidence || 0.7,
  };
}
```

### UI Component

```tsx
// src/app/stores/[storeId]/faq-suggestions/page.tsx

export default async function FAQSuggestionsPage({ params }: { params: { storeId: string } }) {
  const suggestions = await getFAQSuggestions(params.storeId);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Предложенные FAQ</h1>

      <div className="space-y-4">
        {suggestions.map(suggestion => (
          <Card key={suggestion.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-lg">{suggestion.question}</p>
                  <p className="text-sm text-muted-foreground mt-1">{suggestion.answer}</p>

                  <div className="flex gap-2 mt-2">
                    {suggestion.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    Встречалось {suggestion.frequency} раз | Уверенность: {(suggestion.confidence * 100).toFixed(0)}%
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveFAQ(suggestion.id)}
                  >
                    ✅ Одобрить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectFAQ(suggestion.id)}
                  >
                    ❌ Отклонить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## Метрики успеха

**KPIs:**
- 🎯 Точность автосгенерированных FAQ: > 75% (approval rate)
- 📈 Кол-во FAQ в базе знаний: рост на 300%
- ⏱️ Экономия времени на создание FAQ: 5 часов/неделю
- 🤖 Adoption: 40%+ магазинов используют auto-FAQ

**Мониторинг:**
- Кол-во автосгенерированных FAQ/неделю
- Approval vs rejection rate
- Топ-3 самые частые категории вопросов

---

## Зависимости

**Внешние:**
- Deepseek API для NLP и generation
- OpenAI Embeddings для semantic search
- K-Means clustering library

**Внутренние:**
- EPIC-012 (AI Assistant с базой знаний)
- Successful chats (требуется правильное теггирование)

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Низкая точность кластеризации | Средняя | Среднее | Human-in-the-loop (одобрение), confidence threshold |
| Мало успешных диалогов для анализа | Высокая | Высокое | Требуется минимум 50 чатов/неделю, иначе пропускаем |
| Высокая стоимость AI | Средняя | Среднее | Запускать раз в неделю (не ежедневно) |

---

## Timeline

**Week 1-2:**
- NLP logic для извлечения вопросов
- Embeddings generation

**Week 3-4:**
- K-Means clustering implementation
- Testing на sample data

**Week 5-6:**
- LLM для генерации обобщенных FAQ
- Firestore schema + Cloud Function

**Week 7:**
- UI для одобрения/отклонения FAQ
- Интеграция с AI Assistant knowledge base

**Week 8:**
- Analytics dashboard
- Testing + rollout

---

## Монетизация

**Не прямое влияние**, но:
- Улучшает качество AI-ассистента (EPIC-012)
- Снижает churn за счет лучшего UX
- Уникальная функция (конкуренты не предлагают)

**Value Proposition:**
- "AI автоматически учится на ваших диалогах"
- "FAQ база обновляется сама, без вашего участия"

---

## Definition of Done

- ✅ Cloud Function анализирует successful chats еженедельно
- ✅ Извлечение вопросов клиентов из диалогов
- ✅ Clustering похожих вопросов (K-Means)
- ✅ LLM генерация обобщенных FAQ
- ✅ Firestore schema для FAQ suggestions
- ✅ UI для одобрения/отклонения FAQ
- ✅ Одобренные FAQ добавляются в AI Assistant knowledge base
- ✅ Analytics: частота вопросов, топ категории
- ✅ Email-уведомления владельцу о новых FAQ
- ✅ Протестировано на 100+ диалогах
- ✅ Approval rate > 70%

---

**Создано:** 30 декабря 2024
**Обновлено:** 30 декабря 2024
**Следующий ревью:** Sprint Planning Q3 2025
