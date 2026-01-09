# EPIC-012: Персональный AI-ассистент для каждого магазина

**Статус:** 📋 Backlog
**Приоритет:** P2 (Средний)
**RICE Score:** 40
**Квартал:** Q3 2025 (Июль - Сентябрь)
**Оценка:** 6 недель (28 SP)
**Владелец:** Product Manager

---

## Проблема

Сейчас AI генерирует ответы на основе **общих промптов** без учета:
- Специфики товаров магазина
- Тона и стиля бренда
- FAQ и типичных вопросов покупателей
- Истории диалогов с клиентами

**Результат:**
- Ответы звучат шаблонно
- AI не знает деталей (размерная сетка, материалы, доставка)
- Менеджеры тратят время на корректировку AI-ответов

**Видение:**
Каждый магазин должен иметь **персонального AI-ассистента**, который:
- Знает все о товарах (характеристики, FAQ)
- Отвечает в стиле бренда
- Обучается на истории диалогов
- Улучшается со временем

---

## Решение

**AI-ассистент для магазина = AI модель + База знаний + Настройки**

### Компоненты:

1. **База знаний (Knowledge Base)**
   - FAQ по товарам (автозагрузка из Google Sheets)
   - Характеристики товаров из WB API
   - История успешных диалогов (для обучения)
   - Политика магазина (доставка, возврат, гарантия)

2. **Настройки AI**
   - Тон: формальный / дружелюбный / профессиональный
   - Язык: русский / английский / двуязычный
   - Запрещенные темы (не отвечаем на вопросы о конкурентах)
   - Шаблоны для типичных ситуаций

3. **RAG (Retrieval-Augmented Generation)**
   - AI сначала ищет релевантную информацию в базе знаний
   - Затем генерирует ответ с учетом найденных данных
   - Результат: точные и персонализированные ответы

4. **Монетизация: Pay-per-token**
   - Каждый запрос к AI = расход токенов
   - Пользователь платит за токены рублями
   - **Модель: 1000 токенов = 50₽**
   - Target LTV: 5,000₽/магазин в месяц

---

## User Stories

### US-036: Настройка базы знаний магазина
**Как:** владелец магазина
**Я хочу:** загрузить FAQ и информацию о товарах в AI-ассистента
**Чтобы:** AI отвечал точно и с учетом специфики моих товаров

**Acceptance Criteria:**
- ✅ Могу добавить FAQ вручную (вопрос + ответ)
- ✅ Могу загрузить FAQ из Google Sheets
- ✅ AI автоматически индексирует характеристики товаров из WB API
- ✅ Могу добавить политику магазина (доставка, возврат)
- ✅ Вижу список всех знаний в базе (с возможностью редактирования)

**Story Points:** 8 SP (1 неделя)

---

### US-037: Настройка стиля и тона ассистента
**Как:** владелец магазина
**Я хочу:** настроить как AI будет общаться с покупателями
**Чтобы:** ответы соответствовали имиджу моего бренда

**Acceptance Criteria:**
- ✅ Выбираю тон: формальный / дружелюбный / профессиональный
- ✅ Добавляю фирменные фразы (например, "Мы всегда на связи!")
- ✅ Настраиваю запрещенные темы (о чем не отвечаем)
- ✅ Вижу preview ответов в выбранном стиле
- ✅ Могу протестировать AI на тестовых вопросах

**Story Points:** 5 SP (3-5 дней)

---

### US-038: RAG (поиск в базе знаний)
**Как:** AI-ассистент
**Я хочу:** искать релевантную информацию перед генерацией ответа
**Чтобы:** давать точные ответы с фактами, а не догадками

**Acceptance Criteria:**
- ✅ При получении вопроса AI сначала ищет в базе знаний
- ✅ Использую vector embeddings для семантического поиска
- ✅ Нахожу топ-3 релевантных документа
- ✅ Генерирую ответ с учетом найденной информации
- ✅ Указываю источник (например, "Согласно FAQ: ...")

**Story Points:** 8 SP (1 неделя)

---

### US-039: Покупка и использование токенов
**Как:** владелец магазина
**Я хочу:** покупать токены для использования AI
**Чтобы:** платить только за фактическое использование

**Acceptance Criteria:**
- ✅ Вижу баланс токенов в UI
- ✅ Могу купить токены: 1,000₽ = 20,000 токенов
- ✅ Вижу расход токенов в реальном времени
- ✅ Получаю уведомление когда токены заканчиваются (< 1,000)
- ✅ Могу настроить автопополнение баланса

**Story Points:** 5 SP (3-5 дней)

---

### US-040: Обучение на истории диалогов
**Как:** AI-ассистент
**Я хочу:** анализировать успешные диалоги менеджеров
**Чтобы:** улучшать качество своих ответов

**Acceptance Criteria:**
- ✅ Еженедельно анализирую диалоги с тегом "successful"
- ✅ Извлекаю типичные вопросы и успешные ответы
- ✅ Автоматически добавляю в FAQ базу (с подтверждением владельца)
- ✅ Вижу статистику: сколько новых FAQ добавлено

**Story Points:** 2 SP (1-2 дня)

---

## Технические детали

### Firestore Schema

```typescript
// stores/{storeId}/aiAssistant
interface AIAssistant {
  storeId: string;

  // Knowledge Base
  knowledgeBase: {
    faq: Array<{
      id: string;
      question: string;
      answer: string;
      tags: string[];
      source: 'manual' | 'google_sheets' | 'auto_generated';
      createdAt: Timestamp;
    }>;

    policies: {
      shipping: string; // Политика доставки
      returns: string; // Политика возврата
      warranty: string; // Гарантия
    };

    // Автоиндексированные товары
    productsIndexed: boolean;
    lastProductSyncAt?: Timestamp;
  };

  // AI Settings
  settings: {
    tone: 'formal' | 'friendly' | 'professional';
    language: 'ru' | 'en' | 'bilingual';
    signature: string; // Подпись
    forbiddenTopics: string[]; // О чем не отвечаем
    brandPhrases: string[]; // Фирменные фразы
  };

  // Token Usage
  tokenBalance: number; // Остаток токенов
  tokenUsage: {
    today: number;
    thisMonth: number;
    total: number;
  };
  autoPurchase: {
    enabled: boolean;
    threshold: number; // Купить когда < threshold
    amount: number; // Сумма покупки (₽)
  };

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// stores/{storeId}/tokenTransactions/{txId}
interface TokenTransaction {
  storeId: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number; // Кол-во токенов
  cost?: number; // Стоимость (₽)
  description: string; // "Ответ на отзыв" / "Покупка 20k токенов"
  balance: number; // Баланс после транзакции
  createdAt: Timestamp;
}
```

### RAG Implementation (Vector Search)

```typescript
// src/ai/rag-assistant.ts

import { OpenAI } from 'openai';
import { firestore } from '@/firebase/config';
import { cosineSimilarity } from '@/lib/math-utils';

interface RAGResult {
  answer: string;
  sources: string[];
  tokensUsed: number;
}

export async function answerWithRAG(
  storeId: string,
  question: string
): Promise<RAGResult> {

  // 1. Получаем базу знаний
  const assistantDoc = await firestore
    .collection('stores').doc(storeId)
    .collection('aiAssistant').doc('config')
    .get();

  const assistant = assistantDoc.data();
  const { knowledgeBase, settings } = assistant;

  // 2. Генерируем embedding для вопроса
  const questionEmbedding = await generateEmbedding(question);

  // 3. Ищем топ-3 релевантных FAQ
  const faqWithScores = await Promise.all(
    knowledgeBase.faq.map(async (faq) => {
      const faqEmbedding = await generateEmbedding(faq.question);
      const similarity = cosineSimilarity(questionEmbedding, faqEmbedding);
      return { faq, similarity };
    })
  );

  const topFAQs = faqWithScores
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .filter(item => item.similarity > 0.7); // Только релевантные

  // 4. Формируем контекст для AI
  const context = topFAQs.length > 0
    ? `Согласно базе знаний магазина:\n${topFAQs.map(item =>
        `Q: ${item.faq.question}\nA: ${item.faq.answer}`
      ).join('\n\n')}`
    : 'База знаний не содержит релевантной информации.';

  // 5. Генерируем ответ с учетом контекста
  const prompt = `
Ты — AI-ассистент магазина на Wildberries.

Стиль: ${settings.tone}
Подпись: ${settings.signature}
Запрещенные темы: ${settings.forbiddenTopics.join(', ')}

Контекст из базы знаний:
${context}

Вопрос покупателя: "${question}"

Ответь на вопрос, используя информацию из базы знаний. Если информации недостаточно, скажи что нужно уточнить у менеджера.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  });

  const answer = response.choices[0].message.content;
  const tokensUsed = response.usage.total_tokens;

  // 6. Обновляем баланс токенов
  await deductTokens(storeId, tokensUsed, `Ответ на вопрос: ${question.substring(0, 50)}`);

  return {
    answer,
    sources: topFAQs.map(item => item.faq.question),
    tokensUsed,
  };
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

async function deductTokens(storeId: string, tokens: number, description: string) {
  const assistantRef = firestore
    .collection('stores').doc(storeId)
    .collection('aiAssistant').doc('config');

  await firestore.runTransaction(async (transaction) => {
    const doc = await transaction.get(assistantRef);
    const currentBalance = doc.data().tokenBalance;
    const newBalance = currentBalance - tokens;

    if (newBalance < 0) {
      throw new Error('Недостаточно токенов');
    }

    transaction.update(assistantRef, {
      tokenBalance: newBalance,
      'tokenUsage.today': doc.data().tokenUsage.today + tokens,
      'tokenUsage.thisMonth': doc.data().tokenUsage.thisMonth + tokens,
      'tokenUsage.total': doc.data().tokenUsage.total + tokens,
    });

    // Логируем транзакцию
    const txRef = firestore
      .collection('stores').doc(storeId)
      .collection('tokenTransactions').doc();

    transaction.set(txRef, {
      storeId,
      type: 'usage',
      amount: -tokens,
      description,
      balance: newBalance,
      createdAt: new Date(),
    });
  });
}
```

### UI Component

```tsx
// src/app/stores/[storeId]/ai-assistant/page.tsx

export default function AIAssistantPage({ params }: { params: { storeId: string } }) {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">AI-ассистент магазина</h1>

      {/* Баланс токенов */}
      <Card>
        <CardHeader>
          <CardTitle>Баланс токенов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">12,450</p>
              <p className="text-sm text-muted-foreground">токенов осталось</p>
            </div>
            <Button>Пополнить баланс</Button>
          </div>

          <div className="mt-4">
            <p className="text-sm">Израсходовано сегодня: 580 токенов</p>
            <p className="text-sm">Израсходовано в этом месяце: 8,200 токенов (~410₽)</p>
          </div>
        </CardContent>
      </Card>

      {/* База знаний */}
      <Card>
        <CardHeader>
          <CardTitle>База знаний (FAQ)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {faqs.map(faq => (
              <div key={faq.id} className="border p-3 rounded">
                <p className="font-medium">{faq.question}</p>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Button>Добавить FAQ вручную</Button>
            <Button variant="outline">Загрузить из Google Sheets</Button>
          </div>
        </CardContent>
      </Card>

      {/* Настройки стиля */}
      <Card>
        <CardHeader>
          <CardTitle>Настройки стиля</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label>Тон</label>
            <Select>
              <option value="formal">Формальный</option>
              <option value="friendly">Дружелюбный</option>
              <option value="professional">Профессиональный</option>
            </Select>
          </div>

          <div>
            <label>Подпись</label>
            <Input placeholder="С заботой, команда магазина" />
          </div>

          <Button>Сохранить</Button>
        </CardContent>
      </Card>

      {/* Тестирование */}
      <Card>
        <CardHeader>
          <CardTitle>Протестировать AI</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea placeholder="Задайте тестовый вопрос..." rows={3} />
          <Button className="mt-2">Получить ответ</Button>

          <div className="mt-4 bg-gray-50 p-3 rounded">
            <p className="text-sm font-medium">Ответ AI:</p>
            <p className="text-sm mt-1">[Здесь появится ответ]</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Метрики успеха

**KPIs:**
- 🎯 Точность AI ответов: > 85% (по feedback)
- 💰 Средний расход токенов: 5,000₽/магазин в месяц
- ⏱️ Экономия времени менеджеров: 10 часов/неделю
- 📈 Adoption rate: 60%+ магазинов используют AI-ассистента

**Монетизация:**
- Target LTV: 5,000₽/магазин в месяц (токены)
- При 8,000 клиентов × 60% adoption × 5,000₽ = **24M₽/месяц** дополнительного дохода

---

## Зависимости

**Внешние:**
- OpenAI API (GPT-4 + Embeddings)
- Vector database (Pinecone или Firestore)
- Платежная система (Stripe/ЮKassa)

**Внутренние:**
- Existing knowledge base (FAQ, products)
- EPIC-017 (Google Sheets sync)
- EPIC-018 (Auto-FAQ generation)

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Высокая стоимость OpenAI | Высокая | Критично | Переход на Deepseek (в 10x дешевле) |
| Низкая adoption (не покупают токены) | Средняя | Высокое | Free tier (1,000 токенов бесплатно), demo |
| AI дает неточные ответы | Средняя | Высокое | RAG + база знаний, confidence threshold |

---

## Timeline

**Week 1-2:**
- Firestore schema для Knowledge Base
- UI для управления FAQ
- Google Sheets integration

**Week 3-4:**
- RAG implementation (vector search)
- OpenAI integration
- Token deduction logic

**Week 5:**
- UI настроек стиля и тона
- Testing interface
- Token purchase flow (Stripe)

**Week 6:**
- Auto-learning from dialogues
- Analytics dashboard
- Production rollout

---

## Монетизация

**Модель: Pay-per-token**
- 1,000 токенов = 50₽
- Пакеты:
  - Starter: 1,000₽ = 20,000 токенов
  - Pro: 5,000₽ = 120,000 токенов (+20% bonus)
  - Enterprise: 20,000₽ = 500,000 токенов (+25% bonus)

**Revenue Projection:**
- 8,000 клиентов × 60% adoption = 4,800 активных
- 4,800 × 5,000₽/месяц = **24M₽/месяц** = **$300k/месяц**

**В дополнение к $100 подписке:**
- $100/месяц × 8,000 = $800k/месяц (subscription)
- $300k/месяц (tokens)
- **Total: $1.1M/месяц**

---

## Definition of Done

- ✅ UI для управления FAQ (добавить, редактировать, удалить)
- ✅ Google Sheets sync для FAQ
- ✅ Автоиндексация товаров из WB API
- ✅ RAG implementation с vector search
- ✅ Настройки стиля, тона, подписи
- ✅ Token purchase flow (Stripe)
- ✅ Token deduction при использовании AI
- ✅ Уведомления о низком балансе
- ✅ Testing interface для проверки AI
- ✅ Analytics: расход токенов, популярные вопросы
- ✅ Auto-learning from successful dialogues
- ✅ Документация для пользователей
- ✅ Протестировано на 10+ магазинах

---

**Создано:** 30 декабря 2024
**Обновлено:** 30 декабря 2024
**Следующий ревью:** Sprint Planning Q3 2025
