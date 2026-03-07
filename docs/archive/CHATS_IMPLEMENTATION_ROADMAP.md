> **ARCHIVED (2026-03-06):** Historical sprint plan -- completed and superseded

# План реализации рефакторинга страницы Чаты

**Дата:** 2026-01-16
**Версия:** 1.0
**Автор:** Product & Dev Team

---

## Оглавление

1. [Методология](#методология)
2. [Приоритизация MoSCoW](#приоритизация-moscow)
3. [Разбивка на спринты](#разбивка-на-спринты)
4. [Детальные задачи по спринтам](#детальные-задачи-по-спринтам)
5. [Технические риски](#технические-риски)
6. [Definition of Done](#definition-of-done)
7. [Rollout Strategy](#rollout-strategy)

---

## Методология

### Agile/Scrum подход

- **Длительность спринта:** 1 неделя (5 рабочих дней)
- **Planning:** понедельник утро
- **Daily standups:** каждый день 10:00
- **Demo:** пятница 16:00
- **Retro:** пятница 17:00

### Story Points

- **1 SP** = 2-3 часа работы
- **2 SP** = полдня работы
- **3 SP** = день работы
- **5 SP** = 2-3 дня работы
- **8 SP** = неделя работы

### Velocity

- **Целевая velocity:** 20-25 SP/спринт (1 разработчик)
- **Буфер:** 20% на неожиданные задачи и bug fixes

---

## Приоритизация MoSCoW

### Must Have (Обязательно в MVP)

**Критичность:** Без этих фич MVP не может быть запущен

1. ✅ Messenger View Layout (split-view)
2. ✅ AI генерация ответов
3. ✅ Редактирование AI ответа
4. ✅ Использование AI ответа
5. ✅ Переключение Table ↔ Messenger
6. ✅ Фильтрация по тегам
7. ✅ Отправка сообщений в WB

**Total Story Points:** ~40 SP

---

### Should Have (Важно для качественного UX)

**Критичность:** Можно отложить на 1-2 спринта после MVP, но желательно включить

8. ✅ Перегенерация AI ответа
9. ✅ Поиск чатов
10. ✅ Автосохранение черновиков
11. ✅ Быстрая смена тега

**Total Story Points:** ~12 SP

---

### Could Have (Желательно)

**Критичность:** Nice-to-have, можно отложить на следующие версии

12. ⏳ Keyboard shortcuts
13. ⏳ Визуальная индикация непрочитанных
14. ⏳ Bulk AI классификация (кнопка)

**Total Story Points:** ~8 SP

---

### Won't Have (Не в MVP)

**Критичность:** Отложено на Future Scope

15. ❌ Real-time updates (WebSocket)
16. ❌ Групповая работа (assignment)
17. ❌ Шаблоны быстрых ответов
18. ❌ Voice messages

---

## Разбивка на спринты

### Sprint 0: Подготовка (1 день)

**Цель:** Настройка окружения и подготовка

**Задачи:**
- [ ] Создать ветку `feature/chats-messenger-view`
- [ ] Установить зависимости (если нужны)
- [ ] Настроить Storybook для изолированной разработки компонентов (опционально)
- [ ] Подготовить тестовые данные (50+ чатов в dev БД)

**Deliverables:**
- Рабочая dev ветка
- Mock данные готовы

---

### Sprint 1: Фундамент Messenger View (Неделя 1)

**Цель:** Создать базовую структуру мессенджера

**Story Points:** 24 SP

**Задачи:**

#### TASK-001: Layout и структура компонентов (5 SP)
- [ ] Создать `ChatMessengerView.tsx` — главный контейнер
- [ ] Создать `ChatListSidebar.tsx` — левая панель (30%)
- [ ] Создать `ChatConversation.tsx` — правая панель (70%)
- [ ] Responsive layout (flexbox/grid)
- [ ] Добавить переключатель режимов (Tabs: Table | Messenger)
- [ ] localStorage для сохранения выбранного режима

**AC:**
- Экран разделён 30/70
- Переключение работает с анимацией fade

---

#### TASK-002: Список чатов (ChatListSidebar) (5 SP)
- [ ] Компонент `ChatListItem.tsx`
- [ ] Fetch чатов: `GET /api/stores/[storeId]/chats`
- [ ] React Query setup с cache
- [ ] Отображение: аватар, имя, превью сообщения, время
- [ ] Active state для выбранного чата
- [ ] Клик → выбор чата

**AC:**
- Список чатов отображается
- Клик на чат выделяет его голубым бордером
- Данные кешируются

---

#### TASK-003: История сообщений (ChatConversation) (5 SP)
- [ ] Компонент `MessageBubble.tsx`
- [ ] Fetch истории: `GET /api/stores/[storeId]/chats/[chatId]`
- [ ] Отображение сообщений клиента/продавца (разные стили)
- [ ] ScrollArea с автоскроллом вниз
- [ ] Loading state (skeleton)

**AC:**
- История загружается при выборе чата
- Сообщения отображаются корректно (клиент слева, продавец справа)
- Автоскролл к последнему сообщению

---

#### TASK-004: Базовое поле ввода (MessageComposer) (3 SP)
- [ ] Компонент `MessageComposer.tsx`
- [ ] Textarea с auto-resize
- [ ] Кнопка "Отправить"
- [ ] POST `/api/stores/[storeId]/chats/[chatId]/send`
- [ ] Loading state при отправке
- [ ] Очистка поля после отправки
- [ ] Обновление истории

**AC:**
- Можно набрать текст и отправить
- Сообщение появляется в истории
- Toast уведомления

---

#### TASK-005: Фильтры по тегам (3 SP)
- [ ] Чекбоксы в левой панели
- [ ] Фильтрация клиентская (на основе загруженных чатов)
- [ ] Счётчики рядом с каждым тегом
- [ ] Сохранение в localStorage

**AC:**
- Фильтры работают мгновенно
- Счётчики обновляются
- Фильтры сохраняются

---

#### TASK-006: Testing + Bug Fixes (3 SP)
- [ ] Unit tests для компонентов
- [ ] E2E тест: открыть мессенджер → выбрать чат → отправить сообщение
- [ ] Фикс багов из тестирования

**Deliverables Sprint 1:**
- ✅ Рабочий Messenger View
- ✅ Можно просматривать и отправлять сообщения
- ✅ Фильтры работают

---

### Sprint 2: AI Интеграция (Неделя 2)

**Цель:** Подключить AI генерацию ответов

**Story Points:** 22 SP

**Задачи:**

#### TASK-007: AI Suggestion Box компонент (3 SP)
- [ ] Создать `AISuggestionBox.tsx`
- [ ] Состояния: Empty | Generating | Generated | Editing
- [ ] UI для каждого состояния
- [ ] Кнопки: Редактировать | Перегенерировать

**AC:**
- Компонент отображается над полем ввода
- Все состояния работают

---

#### TASK-008: Интеграция generateChatReply() (5 SP)
- [ ] Хук `useAIReply(chatId)` для вызова AI flow
- [ ] Кнопка "🤖 Генерировать AI" в MessageComposer
- [ ] Сборка контекста: история + товар
- [ ] Вызов `generateChatReply()` из существующего flow
- [ ] Обработка loading/error states
- [ ] Отображение результата в AISuggestionBox

**AC:**
- Клик на кнопку → AI генерирует ответ
- Текст появляется в suggestion box
- Логирование в ai_logs

---

#### TASK-009: Редактирование AI ответа (3 SP)
- [ ] Кнопка "Редактировать" → режим editing
- [ ] Textarea с текущим текстом
- [ ] Кнопки "Сохранить" | "Отмена"
- [ ] Обновление текста в suggestion box

**AC:**
- Можно редактировать AI текст
- Сохранение обновляет текст
- Отмена возвращает исходный

---

#### TASK-010: Использование AI ответа (2 SP)
- [ ] Кнопка "Использовать" (или двойной клик)
- [ ] Копирование текста в MessageComposer textarea
- [ ] Фокус на textarea

**AC:**
- Текст копируется в поле ввода
- Можно отредактировать перед отправкой

---

#### TASK-011: Перегенерация AI (2 SP)
- [ ] Кнопка "Перегенерировать"
- [ ] Новый AI запрос с тем же контекстом
- [ ] Loading state + замена текста

**AC:**
- Можно перегенерировать ответ
- Логируется каждая генерация

---

#### TASK-012: API Endpoint для AI генерации (5 SP)
- [ ] Создать `POST /api/stores/[storeId]/chats/[chatId]/generate-reply`
- [ ] Сборка контекста (история + товар)
- [ ] Вызов `generateChatReply()` flow
- [ ] Return JSON: { text, tokens, cost, duration }
- [ ] Error handling

**AC:**
- Endpoint работает
- Контекст правильный
- Ошибки обрабатываются

---

#### TASK-013: Testing + Bug Fixes (2 SP)
- [ ] Unit tests для AI компонентов
- [ ] Mock Deepseek API в тестах
- [ ] E2E: генерация → редактирование → использование → отправка
- [ ] Фикс багов

**Deliverables Sprint 2:**
- ✅ AI генерация работает
- ✅ Можно редактировать и использовать AI ответы
- ✅ Логирование AI операций

---

### Sprint 3: UX Полировка (Неделя 3)

**Цель:** Улучшить UX и добавить Should Have фичи

**Story Points:** 18 SP

**Задачи:**

#### TASK-014: Поиск чатов (3 SP)
- [ ] Input поле в верхней части ChatListSidebar
- [ ] Debounce 300ms
- [ ] Поиск по: client_name, product_name, last_message_text
- [ ] Case-insensitive
- [ ] Кнопка [X] для очистки

**AC:**
- Поиск работает в реальном времени
- Очистка восстанавливает полный список

---

#### TASK-015: Автосохранение черновиков (4 SP)
- [ ] Debounced onChange в MessageComposer (2s)
- [ ] PUT `/api/stores/[storeId]/chats/[chatId]` с `draft_reply`
- [ ] Индикатор "Сохранено ✓" / "Сохранение..."
- [ ] Загрузка черновика при открытии чата
- [ ] Очистка после отправки

**AC:**
- Текст сохраняется каждые 2 секунды
- Черновик загружается при открытии
- Индикатор статуса работает

---

#### TASK-016: Быстрая смена тега (2 SP)
- [ ] Dropdown в шапке ChatConversation
- [ ] PUT `/api/stores/[storeId]/chats/[chatId]` с `tag`
- [ ] Обновление UI + toast
- [ ] Обновление badge и счётчика

**AC:**
- Dropdown работает
- Тег обновляется мгновенно
- Toast показывается

---

#### TASK-017: Keyboard Shortcuts (3 SP)
- [ ] Хук `useKeyboardShortcuts()`
- [ ] Enter → отправить (если фокус в textarea)
- [ ] Shift+Enter → новая строка
- [ ] Ctrl+E → фокус на AI suggestion
- [ ] Ctrl+G → генерировать AI
- [ ] Esc → очистить поле / отменить edit
- [ ] Hint внизу страницы

**AC:**
- Все hotkeys работают
- Hint отображается

---

#### TASK-018: Визуальная индикация непрочитанных (3 SP)
- [ ] Красная точка 🔴 для непрочитанных
- [ ] Bold шрифт для last_message_text
- [ ] Mark as read при открытии чата
- [ ] Счётчик в шапке: "💬 Чаты (5 новых)"

**AC:**
- Непрочитанные выделены
- После открытия → точка исчезает

---

#### TASK-019: Testing + Bug Fixes (3 SP)
- [ ] Полное E2E тестирование всех фич
- [ ] Performance testing (Lighthouse)
- [ ] Фикс багов

**Deliverables Sprint 3:**
- ✅ Все Should Have фичи реализованы
- ✅ Keyboard shortcuts работают
- ✅ UX отполирован

---

### Sprint 4: Документация и Deployment (Неделя 4)

**Цель:** Подготовка к запуску в продакшен

**Story Points:** 12 SP

**Задачи:**

#### TASK-020: User Guide (2 SP)
- [ ] Создать `docs/USER_GUIDE_CHATS.md`
- [ ] Скриншоты режимов Table/Messenger
- [ ] Описание AI генерации
- [ ] Список hotkeys
- [ ] FAQ

**AC:**
- Документация понятная
- Скриншоты актуальные

---

#### TASK-021: Admin Guide (2 SP)
- [ ] Обновить `docs/DEVELOPMENT.md`
- [ ] Описание новых компонентов
- [ ] API endpoints
- [ ] Troubleshooting

**AC:**
- Dev документация актуальна

---

#### TASK-022: Final Testing (3 SP)
- [ ] QA тестирование на staging
- [ ] User Acceptance Testing (UAT) с менеджерами
- [ ] Performance audit
- [ ] Security audit
- [ ] Фикс критических багов

**AC:**
- Все критические баги исправлены
- UAT passed

---

#### TASK-023: Production Deployment (3 SP)
- [ ] Merge в main ветку
- [ ] Git tag: `v2.1.0-chats-messenger`
- [ ] Deploy на production
- [ ] Мониторинг после деплоя (24 часа)
- [ ] Rollback plan готов

**AC:**
- Деплой успешен
- Мониторинг показывает стабильность

---

#### TASK-024: Post-Launch Monitoring (2 SP)
- [ ] Настроить алерты для AI errors
- [ ] Dashboard для метрик:
  - Количество AI генераций
  - Average response time
  - Conversion rate (successful chats)
- [ ] Сбор фидбека от менеджеров

**Deliverables Sprint 4:**
- ✅ MVP запущен в продакшен
- ✅ Документация готова
- ✅ Мониторинг настроен

---

## Детальные задачи по спринтам

### Sprint 1 — Breakdown

**Day 1 (Monday):**
- TASK-001: Layout и структура (5 SP) — full day

**Day 2 (Tuesday):**
- TASK-002: ChatListSidebar (5 SP) — full day

**Day 3 (Wednesday):**
- TASK-003: ChatConversation (5 SP) — full day

**Day 4 (Thursday):**
- TASK-004: MessageComposer (3 SP) — morning
- TASK-005: Фильтры (3 SP) — afternoon

**Day 5 (Friday):**
- TASK-006: Testing + Bug Fixes (3 SP) — full day
- Demo at 16:00
- Retro at 17:00

---

### Sprint 2 — Breakdown

**Day 1 (Monday):**
- TASK-007: AISuggestionBox (3 SP) — morning
- TASK-008: AI Integration (начало) — afternoon

**Day 2 (Tuesday):**
- TASK-008: AI Integration (продолжение) — full day

**Day 3 (Wednesday):**
- TASK-008: AI Integration (завершение) — morning
- TASK-009: Редактирование (3 SP) — afternoon

**Day 4 (Thursday):**
- TASK-010: Использование AI (2 SP) — morning
- TASK-011: Перегенерация (2 SP) — afternoon

**Day 5 (Friday):**
- TASK-012: API Endpoint (5 SP) — morning
- TASK-013: Testing (2 SP) — afternoon
- Demo + Retro

---

### Sprint 3 — Breakdown

**Day 1 (Monday):**
- TASK-014: Поиск (3 SP) — morning
- TASK-015: Автосохранение (начало) — afternoon

**Day 2 (Tuesday):**
- TASK-015: Автосохранение (завершение) — morning
- TASK-016: Смена тега (2 SP) — afternoon

**Day 3 (Wednesday):**
- TASK-017: Keyboard Shortcuts (3 SP) — full day

**Day 4 (Thursday):**
- TASK-018: Непрочитанные (3 SP) — full day

**Day 5 (Friday):**
- TASK-019: Testing (3 SP) — full day
- Demo + Retro

---

## Технические риски

### RISK-001: Deepseek API Unavailable

**Вероятность:** Средняя (20%)
**Влияние:** Критическое

**Mitigation:**
- Fallback: показать шаблоны быстрых ответов
- Retry механизм (3 попытки)
- Toast: "AI недоступен, попробуйте позже"

**Contingency:**
- Переключиться на другой AI provider (OpenAI)
- Локальная модель (если возможно)

---

### RISK-002: Performance Issues с 1000+ чатов

**Вероятность:** Средняя (30%)
**Влияние:** Среднее

**Mitigation:**
- Pagination для списка чатов
- Virtualized list (react-window)
- Lazy loading истории

**Monitoring:**
- Lighthouse audit
- React DevTools Profiler

---

### RISK-003: WB API Rate Limiting

**Вероятность:** Низкая (10%)
**Влияние:** Среднее

**Mitigation:**
- Задержка между запросами (2s)
- Кеширование на сервере
- Backoff strategy

---

### RISK-004: Browser Compatibility

**Вероятность:** Низкая (15%)
**Влияние:** Низкое

**Mitigation:**
- Тестирование на Chrome, Firefox, Safari
- Polyfills для старых браузеров
- Graceful degradation

---

## Definition of Done

### For each Task:

- [ ] Code написан и соответствует style guide
- [ ] Unit tests написаны и passing (coverage > 80%)
- [ ] Code review пройден (1 approver)
- [ ] Документация обновлена (если требуется)
- [ ] No console errors/warnings
- [ ] Работает в dev environment
- [ ] Accessibility проверена (keyboard navigation, screen readers)

### For each Sprint:

- [ ] Все задачи Sprint выполнены (DoD reached)
- [ ] E2E тесты написаны и passing
- [ ] Demo проведена (stakeholders approved)
- [ ] Retro завершена (action items записаны)
- [ ] Branch merged в develop (или main)

### For MVP Launch:

- [ ] Все Must Have фичи реализованы
- [ ] UAT пройдено (менеджеры протестировали)
- [ ] Performance > 90 Lighthouse score
- [ ] Security audit пройден
- [ ] User Guide написан
- [ ] Deployment plan готов
- [ ] Rollback plan готов
- [ ] Monitoring настроен

---

## Rollout Strategy

### Phase 1: Soft Launch (Beta)

**Дата:** После Sprint 4
**Аудитория:** 2-3 менеджера (early adopters)

**Цель:**
- Проверить работоспособность
- Собрать первичный фидбек
- Найти критические баги

**Длительность:** 1 неделя

**Метрики:**
- Количество AI генераций
- Количество отправленных сообщений
- Crash rate

---

### Phase 2: Limited Rollout

**Дата:** Через 1 неделю после Beta
**Аудитория:** 50% менеджеров

**Цель:**
- Проверить масштабируемость
- Собрать расширенный фидбек

**Длительность:** 1 неделя

**Метрики:**
- AI usage rate (% чатов с AI)
- Average response time
- User satisfaction (NPS survey)

---

### Phase 3: Full Rollout

**Дата:** Через 2 недели после Beta
**Аудитория:** Все пользователи

**Цель:**
- Полный запуск

**Анонс:**
- Email всем пользователям
- In-app notification
- User Guide ссылка

**Мониторинг:**
- 24/7 первые 3 дня
- Error tracking (Sentry)
- Performance monitoring

---

## Success Metrics (OKRs)

### Objective 1: Ускорить работу менеджеров

**Key Results:**
- KR1: Среднее время ответа на чат < 1 минута (vs 2-3 минуты сейчас)
- KR2: Количество обработанных чатов в час > 60 (vs 20-25 сейчас)
- KR3: AI usage rate > 60% (процент чатов, где использован AI)

### Objective 2: Повысить удовлетворённость менеджеров

**Key Results:**
- KR1: NPS (Net Promoter Score) > 8/10
- KR2: 90% менеджеров используют Messenger View регулярно
- KR3: Менее 5 критических багов в первый месяц

### Objective 3: Снизить стоимость поддержки

**Key Results:**
- KR1: AI генерация дешевле ручного ответа (< $0.001 per chat)
- KR2: Conversion rate "Активный" → "Успешный" > 70%
- KR3: Время обучения новых менеджеров < 30 минут

---

## Следующие шаги

1. ✅ Документация создана
2. 🔄 Согласование Roadmap с командой
3. ⏳ Начало Sprint 1 (после одобрения)
4. ⏳ Создание JIRA/GitHub Issues для каждой задачи

---

## Приложения

### Appendix A: Технический стек (напоминание)

- React 18 + TypeScript
- Next.js 14.2 App Router
- React Query v5
- Shadcn/ui components
- Tailwind CSS
- Deepseek AI API
- PostgreSQL (Yandex Cloud)

### Appendix B: Git Workflow

**Branches:**
- `main` — production
- `develop` — development
- `feature/chats-messenger-view` — feature branch

**Commits:**
- Conventional Commits style
- Example: `feat(chats): add AI suggestion box component`

**PR Review:**
- Минимум 1 approver
- Squash and merge

---

**Вопросы и утверждение:**
- Согласовываем plan?
- Какие корректировки нужны?
- Готовы начать Sprint 1?

**GitHub:** [Klimov-IS/R5-Saas-v-2.0](https://github.com/Klimov-IS/R5-Saas-v-2.0)
