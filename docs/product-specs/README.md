# Product Specifications: Рефакторинг страницы Чаты

**Дата создания:** 2026-01-16
**Статус:** 📋 Готово к согласованию
**Автор:** Product Team

---

## 📚 Документация

Полная документация для рефакторинга страницы чатов с двумя режимами отображения (Table + Messenger) и AI-автоматизацией.

### Структура документации

1. **~~CHATS_CURRENT_STATE_ANALYSIS.md~~** *(archived)* — Анализ текущего состояния
   - Что работает / не работает
   - Технический стек
   - Database schema
   - Проблемы и боли пользователей
   - Рекомендации

2. **[CHATS_UI_UX_PROTOTYPES.md](./CHATS_UI_UX_PROTOTYPES.md)** — UI/UX Прототипы
   - ASCII прототипы режимов Table/Messenger
   - Детальное описание всех компонентов
   - Цветовая схема и иконография
   - Mobile адаптация
   - Интерактивность и анимации

3. **[CHATS_FEATURE_SPEC.md](./CHATS_FEATURE_SPEC.md)** — Спецификация функционала
   - User Stories (Epic-based)
   - Функциональные требования
   - Нефункциональные требования
   - API Specifications
   - Edge Cases и Testing Strategy

4. **~~CHATS_IMPLEMENTATION_ROADMAP.md~~** *(archived)* — План реализации
   - Приоритизация MoSCoW
   - Разбивка на 4 спринта (по неделям)
   - Детальные задачи с Story Points
   - Технические риски
   - Rollout Strategy

---

## 🎯 Цель проекта

> **Ускорить работу менеджеров по обработке чатов в 3-5 раз** за счёт режима мессенджера (WhatsApp-like UI) и AI-автоматизации ответов.

### Ключевые метрики успеха

| Метрика | Сейчас | Цель MVP |
|---------|---------|----------|
| Время ответа на чат | ~2-3 мин | ~30-60 сек |
| Использование AI | 0% | 60-70% |
| Чатов обработано в час | ~20-25 | ~60-80 |

---

## 🚀 Быстрый старт

### Для Product Owner / Stakeholders

1. Прочитайте **Executive Summary** в [CHATS_CURRENT_STATE_ANALYSIS.md](../archive/CHATS_CURRENT_STATE_ANALYSIS.md#executive-summary) *(archived)*
2. Посмотрите **прототипы UI** в [CHATS_UI_UX_PROTOTYPES.md](./CHATS_UI_UX_PROTOTYPES.md#режим-2-messenger-view-мессенджер)
3. Ознакомьтесь с **User Stories** в [CHATS_FEATURE_SPEC.md](./CHATS_FEATURE_SPEC.md#user-stories)
4. Одобрите **Roadmap** в [CHATS_IMPLEMENTATION_ROADMAP.md](../archive/CHATS_IMPLEMENTATION_ROADMAP.md#разбивка-на-спринты) *(archived)*

### Для Разработчиков

1. Изучите **технический стек** в [CHATS_CURRENT_STATE_ANALYSIS.md](../archive/CHATS_CURRENT_STATE_ANALYSIS.md#технический-стек) *(archived)*
2. Посмотрите **компоненты** в [CHATS_UI_UX_PROTOTYPES.md](./CHATS_UI_UX_PROTOTYPES.md#компоненты-ui)
3. Ознакомьтесь с **API specs** в [CHATS_FEATURE_SPEC.md](./CHATS_FEATURE_SPEC.md#api-specifications)
4. Начните с **Sprint 1 tasks** в [CHATS_IMPLEMENTATION_ROADMAP.md](../archive/CHATS_IMPLEMENTATION_ROADMAP.md#sprint-1-фундамент-messenger-view-неделя-1) *(archived)*

### Для Дизайнеров

1. Посмотрите **прототипы** в [CHATS_UI_UX_PROTOTYPES.md](./CHATS_UI_UX_PROTOTYPES.md)
2. Изучите **цветовую схему** в разделе [Цветовая схема](./CHATS_UI_UX_PROTOTYPES.md#цветовая-схема)
3. Проверьте **accessibility** требования в [CHATS_UI_UX_PROTOTYPES.md](./CHATS_UI_UX_PROTOTYPES.md#accessibility)

---

## 📊 Концепция двух режимов

### Режим 1: Table View (Таблица)
**Для обзора и фильтрации**
- Видно много чатов одновременно
- Фильтры по тегам, поиск
- Статистика и аналитика

### Режим 2: Messenger View (Мессенджер)
**Для быстрой обработки**
- WhatsApp-like UI
- Split-view: список + активный чат
- AI-подсказки одной кнопкой
- Минимум кликов для ответа

---

## 🏗️ Архитектура MVP

### Этапы разработки (4 недели)

**Sprint 1 (Неделя 1):** Фундамент Messenger View
- Layout (30/70 split)
- Список чатов + история
- Базовое поле ввода
- Фильтры по тегам

**Sprint 2 (Неделя 2):** AI Интеграция
- AI Suggestion Box
- Генерация ответов через Deepseek
- Редактирование и перегенерация
- API endpoint

**Sprint 3 (Неделя 3):** UX Полировка
- Поиск чатов
- Автосохранение черновиков
- Keyboard shortcuts
- Непрочитанные индикаторы

**Sprint 4 (Неделя 4):** Документация и Deployment
- User Guide
- Final testing (UAT)
- Production deployment
- Monitoring setup

---

## 🎨 UI Превью (ASCII)

### Messenger View — Desktop

```
┌────────────────────────────────────────────────────────────────┐
│ [← К таблице]  💬 Чаты магазина              [📱 Режим: 💬]   │
├──────────────────────────┬─────────────────────────────────────┤
│ СПИСОК ЧАТОВ (30%)       │ АКТИВНЫЙ ЧАТ (70%)                 │
│                          │                                     │
│ 🔍 [Поиск...]           │ 👤 Иван Петров      🟢 Активный    │
│                          │ 📦 Кроссовки Nike Air Max          │
│ [Фильтры ▼]             │                                     │
│ ☑️ Активные (23)         │ ┌─────────────────────────────────┐│
│ ☐ Нет ответа (12)       │ │ История сообщений (scroll)      ││
│                          │ │ ...                             ││
│ ┌────────────────────┐  │ └─────────────────────────────────┘│
│ │ 🔴 👤 Иван П.      │  │                                     │
│ │ 5 мин назад        │◀─┤ 🤖 AI ПОДСКАЗКА:                   │
│ │ Когда придёт...    │  │ "Добрый день! Ваш заказ..."        │
│ └────────────────────┘  │ [✏️ Редактир.] [🔄 Перегенер.]     │
│                          │                                     │
│ ┌────────────────────┐  │ 📝 [Ваш ответ...]                  │
│ │ 👤 Мария К.        │  │ [✅ Отправить] [🤖 Генер. AI]      │
│ └────────────────────┘  │                                     │
└──────────────────────────┴─────────────────────────────────────┘
```

---

## ✅ Приоритизация (MoSCoW)

### Must Have (P0) — 40 SP
- ✅ Messenger View Layout
- ✅ AI генерация ответов
- ✅ Редактирование AI
- ✅ Переключение режимов
- ✅ Фильтры и отправка

### Should Have (P1) — 12 SP
- ✅ Перегенерация AI
- ✅ Поиск чатов
- ✅ Автосохранение черновиков
- ✅ Быстрая смена тега

### Could Have (P2) — 8 SP
- ⏳ Keyboard shortcuts
- ⏳ Непрочитанные индикаторы
- ⏳ Bulk AI классификация

### Won't Have
- ❌ Real-time updates (WebSocket)
- ❌ Групповая работа
- ❌ Шаблоны быстрых ответов

---

## 🔧 Технические требования

### Stack
- React 18 + TypeScript
- Next.js 14.2 App Router
- React Query v5
- Shadcn/ui components
- Tailwind CSS
- Deepseek AI API
- PostgreSQL (Yandex Cloud)

### Performance
- Загрузка списка чатов: < 500ms
- AI генерация: < 5s (95 перцентиль)
- Lighthouse score: > 90

### Security
- Authorization: API key validation
- Rate limiting: 10 AI requests/min per user
- XSS protection: валидация всех inputs

---

## 📈 Success Metrics (OKRs)

### Objective 1: Ускорить работу менеджеров
- KR1: Время ответа < 1 минута (vs 2-3 мин)
- KR2: Чатов в час > 60 (vs 20-25)
- KR3: AI usage rate > 60%

### Objective 2: Повысить удовлетворённость
- KR1: NPS > 8/10
- KR2: 90% используют Messenger View
- KR3: < 5 критических багов в первый месяц

---

## 🚦 Rollout Strategy

1. **Beta (1 неделя):** 2-3 менеджера
2. **Limited (1 неделя):** 50% менеджеров
3. **Full (после 2 недель):** Все пользователи

---

## 📝 Следующие шаги

### Для согласования:

1. ✅ Одобрить концепцию двух режимов (Table + Messenger)?
2. ✅ Согласовать UI прототипы?
3. ✅ Утвердить приоритизацию фич (MoSCoW)?
4. ✅ Одобрить план из 4 спринтов?
5. ✅ Определить дату старта Sprint 1?

### После согласования:

- Создать ветку `feature/chats-messenger-view`
- Создать JIRA/GitHub Issues для всех задач
- Провести Sprint 1 Planning
- Начать разработку

---

## 🔗 Ссылки

- **GitHub Repo:** [Klimov-IS/R5-Saas-v-2.0](https://github.com/Klimov-IS/R5-Saas-v-2.0)
- **Production:** https://wb-reputation.ru
- **Staging:** (если есть)

---

## 👥 Команда

- **Product Owner:** Иван Климов
- **Tech Lead:** Claude AI Assistant
- **Developers:** (TBD)
- **Designers:** (TBD)

---

## 📞 Контакты

**Вопросы и фидбек:**
- GitHub Issues: https://github.com/Klimov-IS/R5-Saas-v-2.0/issues
- Email: (если есть)

---

**Статус:** 📋 Готово к обсуждению и согласованию

**Создано:** 2026-01-16
**Обновлено:** 2026-01-16
