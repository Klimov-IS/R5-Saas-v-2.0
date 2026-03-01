# AI Autonomy Roadmap — R5 Chat Automation

**Дата:** 2026-03-01
**Автор:** Claude Code + Product Analysis
**Статус:** Draft

---

## Текущий уровень автономности: ~40%

### Что работает автоматически

| Компонент | Состояние | Качество |
|-----------|-----------|----------|
| Классификация чатов (тегирование) | Автоматическая (regex + AI) | 9/10 |
| Генерация черновиков ответов | Качественные, требуют review | 8/10 |
| Обнаружение кандидатов на удаление | Гибрид regex + AI | 8/10 |
| Генерация офферов компенсации | AI с контекстом product_rules | 7/10 |
| Рассылки follow-up | Шаблонные (0 токенов), ручной запуск | 8/10 |
| Контекстное обогащение | Store instructions + FAQ + guides | 9/10 |
| Phase-aware responses | AI знает фазу диалога | 7/10 |
| Review-resolved guards | Автоматическая блокировка | 10/10 |

### Что требует ручного участия

| Компонент | Текущее состояние | Блокер автоматизации |
|-----------|-------------------|---------------------|
| Отправка сообщений | Только через TG Mini App (1 клик) | Нет confidence scoring |
| Логика компенсаций | Фиксированная из product_rules | Нет dynamic pricing |
| Эскалация сложных кейсов | Нет системы | Нет детекции edge cases |
| Обратная связь AI | Нет | Нет feedback loop |
| Смена тега (этап воронки) | Ручная (новые кнопки в TG) | Нет auto-classification по контексту |

---

## Аналитика реальных диалогов (прод, 2026-03-01)

### Ключевые метрики

| Метрика | Значение |
|---------|----------|
| Всего review-linked чатов | 1940 |
| С тегом `deletion_candidate` | 1236 (63.7%) |
| С тегом `refund_requested` | 28 (1.4%) |
| Без тега (`untagged`) | 599 (30.9%) |
| `deletion_offered/agreed/confirmed` | 0 (теги не используются) |

### Buyer Reply Patterns

| Метрика | Значение |
|---------|----------|
| Reply rate (deletion_candidate) | 26.3% (325/1236) |
| Reply rate (untagged) | 11.9% |
| Median time to first reply | 0.8 дня |
| Buyer replied then went silent | 267 чатов |
| Most replies at sequence step | 0-2 (первые сообщения) |

### Sequence Effectiveness

| Метрика | Значение |
|---------|----------|
| Чаты С рассылкой | 996, reply rate 5.5% |
| Чаты БЕЗ рассылки | 944, reply rate 41.6% |
| Всего 14-day sequences | 4554 (legacy) |
| Всего 30-day sequences | 194 (новая система) |
| Stopped by client_replied | 491 |

> Высокий reply rate для чатов без рассылки объясняется тем, что рассылки запускаются для "молчащих" чатов, а активные чаты изначально не нуждаются в follow-up.

---

## Roadmap: 3 этапа к полной автономности

### Этап A: "Умные рассылки" (Sprint 005, текущий)

**Цель:** 60% автоматизации

**Что делается:**
- Рассылки по этапам воронки (3 новых набора шаблонов)
- Ручная смена тегов менеджером (кнопки в TG Mini App)
- Tag-specific кнопки запуска рассылок
- 0 токенов AI на follow-up (все шаблонные)

**Результат:**
- Менеджер делает 1 клик вместо написания сообщения
- 80% коммуникации покрывается шаблонами
- Экономия ~90% токенов на follow-up сообщениях

**Файлы:**
- `src/lib/auto-sequence-templates.ts` — 3 новых набора + `TAG_SEQUENCE_CONFIG`
- `src/app/api/telegram/chats/[chatId]/sequence/start/route.ts` — поддержка `sequenceType`
- `src/app/api/telegram/chats/[chatId]/status/route.ts` — поддержка `tag` в body
- `src/app/(telegram)/tg/chat/[chatId]/page.tsx` — tag badge, кнопки прогрессии, tag-specific labels

---

### Этап B: "AI с одобрением" (следующий спринт)

**Цель:** 75% автоматизации

**Что нужно:**

1. **Confidence scoring:**
   - AI оценивает уверенность в ответе (0-100%)
   - > 90% → авто-отправка (простые случаи: "спасибо", "когда получу?")
   - < 90% → показать менеджеру для одобрения
   - Реализация: дополнительный prompt → число

2. **Dynamic compensation:**
   - Формула: base_amount * rating_multiplier * price_factor
   - Min/max лимиты из product_rules
   - AI предлагает сумму, менеджер подтверждает

3. **Auto-tag advancement:**
   - AI анализирует ответ покупателя → автоматически меняет тег
   - "Согласен" → `deletion_agreed`
   - "Хочу возврат" → `refund_requested`
   - "Ок, как удалить?" → `deletion_agreed`
   - Реализация: extend classify-chat-tag flow

4. **Approval queue:**
   - TG Mini App: "Очередь на одобрение" — AI сгенерировал, ждёт 1 клик
   - Swipe-based UI: влево = reject, вправо = approve & send
   - Batch approve: "Отправить все уверенные (>90%)"

**Зависимости:**
- Нужен A/B тест confidence scoring vs ручная отправка
- Нужна метрика "отказов менеджера" (сколько AI-ответов отклоняется)
- Нужен rate limit на авто-отправку (макс 20 сообщений/час/магазин)

---

### Этап C: "Полная автономия" (2-3 месяца)

**Цель:** 95% автоматизации

**Что нужно:**

1. **End-to-end automation:**
   - AI получает новый чат → классифицирует → отвечает → меняет тег → запускает follow-up
   - Полный цикл без участия человека
   - Менеджер видит результаты и вмешивается только в сложных случаях

2. **Escalation system:**
   - Детекция edge cases: юридические угрозы, грубость, манипуляции
   - Автоматический перевод на менеджера с пометкой причины
   - Priority scoring: срочность × потенциальный ущерб

3. **Feedback loop:**
   - Менеджер оценивает ответы AI (approve / edit / reject)
   - Edited ответы → fine-tuning данные
   - Rejected → negative examples
   - Еженедельный отчёт: точность AI по категориям

4. **A/B тестирование промптов:**
   - 2 варианта system prompt → рандомное распределение
   - Метрика: reply rate, conversion, satisfaction
   - Автоматический rollout лучшего варианта

5. **Budget controls:**
   - Макс. токенов/день/магазин
   - Макс. авто-отправок/час
   - Макс. сумма компенсаций/месяц без одобрения
   - Dashboard: расход AI vs ручная работа

6. **Analytics dashboard:**
   - Воронка по этапам: candidate → offered → agreed → confirmed
   - Conversion rates по магазинам
   - Cost per deletion (токены + компенсации)
   - ROI: удалённые отзывы × средний чек × lifetime value

---

## Что уже готово и можно использовать

| Готовый компонент | Где используется | Потенциал для автоматизации |
|---|---|---|
| 8 AI flows (reply, classify, deletion, offer, complaint, review, question) | Все сценарии покрыты | Нужен только auto-send |
| Context injection (store instructions, FAQ, guides) | System prompt | Уже контекстно-зависим |
| Phase-aware offers (discovery/understanding/resolution) | Chat reply generation | AI знает фазу диалога |
| Review-resolved guards | Auto-sequence processor | Автоматическая безопасность |
| Per-store AI personalization | stores.ai_instructions | Каждый магазин уникален |
| Product rules (compensation, strategy) | Chat reply + offer generation | AI знает правила |
| Tag-based sequences (Sprint 005) | Follow-up по этапам | 0 токенов на шаблоны |

---

## Что отделяет нас от полной автономности

| Разрыв | Сложность | Приоритет | Зависимости |
|--------|-----------|-----------|-------------|
| Auto-send (confidence scoring) | Средняя | P0 | A/B тест, rate limit |
| Auto-tag advancement | Низкая | P1 | Extend classify flow |
| Dynamic compensation | Средняя | P1 | Формула, product_rules |
| Escalation detection | Высокая | P2 | Training data |
| Feedback loop | Высокая | P2 | UI + storage + analytics |
| A/B prompts | Средняя | P3 | Experiment framework |
| Budget controls | Низкая | P1 | Dashboard UI |

---

## Рыночный потенциал

Система AI-автономного общения с покупателями — сильный SaaS-продукт:

1. **Масштабирование:** Работает на WB + OZON, архитектура готова к Яндекс.Маркет, AliExpress
2. **Unit economics:** Себестоимость AI-ответа ~$0.001-0.005 vs стоимость менеджера ~$0.50-1.00
3. **Value prop:** "Автоматическое удаление негативных отзывов 24/7" — прямой ROI для селлеров
4. **Defensibility:** Накопленные данные о паттернах ответов покупателей по нишам
5. **Upsell path:** Free (шаблоны) → Pro (AI с одобрением) → Enterprise (полная автономия)
