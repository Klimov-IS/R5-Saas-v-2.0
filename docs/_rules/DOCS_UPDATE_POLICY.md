# Политика обновления документации

**Дата:** 2026-02-08
**Версия:** 1.0
**Статус:** Обязательно к исполнению

---

## Золотое правило

> **Если ты изменил поведение системы — ты изменил документацию.**

Документация — неотъемлемая часть изменений. Код без обновлённой документации = технический долг.

---

## Source of Truth

| Область | Source of Truth | Приоритет |
|---------|-----------------|-----------|
| Схема БД | `docs/database-schema.md` | 1 (высший) |
| CRON jobs | `docs/CRON_JOBS.md` | 1 |
| Деплой | `DEPLOYMENT.md` | 1 |
| API | `docs/reference/api.md` | 2 |
| Архитектура | `docs/ARCHITECTURE.md` | 2 |
| Продуктовая логика | `docs/product/*`, `docs/domains/*` | 3 |

**При конфликте:** Source of Truth > код > README

---

## Когда обновлять документацию

### Обязательно обновить

| Изменение | Какие документы обновить |
|-----------|-------------------------|
| Добавлена таблица в БД | `docs/database-schema.md` |
| Добавлена/изменена колонка | `docs/database-schema.md` |
| Изменён ENUM | `docs/database-schema.md`, `docs/statuses-reference.md` |
| Добавлен API endpoint | `docs/reference/api.md` |
| Изменён API endpoint | `docs/reference/api.md` |
| Добавлен/изменён CRON job | `docs/CRON_JOBS.md` |
| Изменена логика жалоб | `docs/domains/complaints.md` |
| Изменена логика AI в чатах | `docs/domains/chats-ai.md` |
| Изменён процесс деплоя | `DEPLOYMENT.md` |
| Архитектурное решение | `docs/decisions/ADR-XXX.md` |

### Желательно обновить

| Изменение | Какие документы обновить |
|-----------|-------------------------|
| Добавлен UI компонент | `docs/COMPONENT_LIBRARY.md` |
| Изменена логика фильтров | `docs/FILTERS_SYSTEM.md` |
| Оптимизация производительности | `docs/archive/reports/` |
| Баг-фикс с важным контекстом | `docs/TROUBLESHOOTING.md` |

---

## Формат обновлений

### 1. Обновить "Last Updated"

```markdown
---
**Last Updated:** YYYY-MM-DD
```

### 2. Добавить в changelog (для major changes)

Если документ имеет раздел "Changelog" или "History":

```markdown
## Changelog

### 2026-02-08
- Добавлен endpoint POST /api/stores/:id/complaints
- Удалён deprecated статус 'sent'
```

### 3. Проверить связанные документы

Если изменение затрагивает несколько документов — обновить все:

```
Изменение: добавлен новый статус complaint_status = 'processing'

Обновить:
1. docs/database-schema.md (ENUM)
2. docs/statuses-reference.md (описание)
3. docs/domains/complaints.md (lifecycle)
4. docs/reference/api.md (API response)
```

---

## Процесс при изменении БД

### Checklist

- [ ] Создать миграцию в `supabase/migrations/`
- [ ] Применить миграцию на dev
- [ ] Обновить `docs/database-schema.md`
- [ ] Если новая таблица — добавить в Entity Relationships
- [ ] Если новый индекс — добавить в Indexes Strategy
- [ ] Проверить, затронуты ли другие документы
- [ ] Commit с message: `docs: update database-schema.md for new column X`

### Пример

```sql
-- Migration: 20260208_add_complaint_processing_status.sql
ALTER TYPE complaint_status ADD VALUE 'processing' AFTER 'pending';
```

```markdown
<!-- docs/database-schema.md -->

### complaint_status (обновлено)

| Статус | Описание |
|--------|----------|
| ... | ... |
| `processing` | В обработке (WB принял, ожидает модерации) | ← НОВЫЙ
| ... | ... |
```

---

## Процесс при изменении API

### Checklist

- [ ] Реализовать endpoint
- [ ] Добавить в `docs/reference/api.md`
- [ ] Если breaking change — добавить warning
- [ ] Обновить Swagger (если используется)
- [ ] Commit с message: `docs: add endpoint POST /api/stores/:id/new-endpoint`

### Формат описания endpoint

```markdown
### POST /api/stores/:storeId/new-endpoint

**Описание:** Краткое описание

**Request:**
\`\`\`json
{
  "field": "value"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {}
}
\`\`\`

**Errors:**
- 400: Bad Request
- 401: Unauthorized
```

---

## Процесс при изменении CRON

### Checklist

- [ ] Реализовать job в `src/lib/cron-jobs.ts`
- [ ] Зарегистрировать в `src/lib/init-server.ts`
- [ ] Обновить `docs/CRON_JOBS.md`
- [ ] Добавить расписание, описание, лимиты
- [ ] Описать поведение при повторном запуске
- [ ] Описать возможные ошибки
- [ ] Commit с message: `docs: add daily-chat-sync cron job`

### Формат описания job

```markdown
### Daily Chat Sync

**Job Name:** `daily-chat-sync`
**Schedule:**
- Production: `0 6 * * *` (9:00 MSK)
- Development: `*/10 * * * *`

**What It Does:**
1. Получает все активные магазины
2. Для каждого синхронизирует чаты
3. Логирует результат

**Source:** `src/lib/cron-jobs.ts:XXX`

**Idempotency:** Да (безопасен для повторного запуска)

**Error Handling:**
- Retry 3 раза с exponential backoff
- При фатальной ошибке — логирование + пропуск
```

---

## Что делать при расхождении кода и docs

### 1. Обнаружено расхождение

```
docs/database-schema.md говорит: complaint_status enum имеет 5 значений
Реальность: в БД 6 значений (добавлен 'processing')
```

### 2. Определить Source of Truth

В данном случае: БД реальная > docs

### 3. Обновить документацию

НЕ менять код под docs (если код работает корректно).

### 4. Залогировать как tech debt (если нужно)

Создать issue или задачу: "Синхронизировать docs/database-schema.md с реальной схемой"

---

## Структура папки docs/

```
docs/
├── _rules/                     # Политики (этот файл)
│   ├── DOCS_UPDATE_POLICY.md
│   └── ...
│
├── reference/                  # Техническая справка
│   ├── api.md                  # API Reference
│   └── database-schema.md      # БД (TODO: переместить)
│
├── product/                    # Продуктовая документация
│   ├── cabinets.md
│   └── client-tabs.md
│
├── domains/                    # Доменная документация
│   ├── complaints.md
│   └── chats-ai.md
│
├── decisions/                  # ADRs
│   └── ADR-XXX-*.md
│
├── product-specs/              # Feature specs (существующая)
│   └── *.md
│
├── tasks/                      # Task documents (существующая)
│   └── TASK-XXX-*.md
│
├── archive/                    # Исторические документы
│   └── ...
│
└── *.md                        # Прочие документы (legacy)
```

---

## Ответственность

### Разработчик

- Обновляет документацию при каждом PR
- Проверяет актуальность связанных документов
- Отмечает "Last Updated"

### Reviewer

- Проверяет наличие обновлений документации
- Блокирует PR без документации для значимых изменений

### AI Agent (Claude Code)

- Следует этой политике
- Предупреждает о необходимости обновления docs
- Создаёт/обновляет документы при изменениях

---

## Anti-patterns

### ❌ Не делать

1. Менять код без обновления docs
2. Откладывать обновление docs "на потом"
3. Дублировать информацию вместо ссылок
4. Оставлять устаревшие примеры
5. Игнорировать "Last Updated"

### ✅ Делать

1. Обновлять docs в том же PR, что и код
2. Использовать ссылки между документами
3. Проверять примеры кода
4. Архивировать устаревшие документы
5. Создавать ADR для архитектурных решений

---

## Связанные документы

- [ARCHITECTURE.md](../ARCHITECTURE.md) — обзор системы
- [Database Schema](../database-schema.md) — схема БД
- [CRON Jobs](../CRON_JOBS.md) — автоматизация
- [API Reference](../reference/api.md) — карта API

---

**Last Updated:** 2026-02-08
