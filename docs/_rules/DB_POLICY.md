# Политика работы с базой данных

**Дата:** 2026-02-08
**Версия:** 1.0
**Статус:** Обязательно к исполнению

---

## Принципы

1. **БД — продакшен-актив**. Любые изменения потенциально опасны.
2. **Все изменения через миграции**. Никаких ручных ALTER на проде.
3. **Сначала документация, потом код**. Обновить database-schema.md ДО деплоя.

---

## Запрещено без согласования

| Действие | Риск | Альтернатива |
|----------|------|--------------|
| `ALTER TABLE` на проде вручную | Потеря данных | Миграция через CI/CD |
| Удаление таблиц/колонок | Breaking change | Soft delete, deprecation |
| Изменение ENUM значений | Breaking API | Добавить новое, не удалять старое |
| Массовые UPDATE/DELETE | Потеря данных | Dry-run + backup |
| Изменение constraint | Блокировка таблицы | Off-peak hours |

---

## Обязательно при изменениях

### 1. Создать миграцию

```
supabase/migrations/YYYYMMDD_description.sql
```

### 2. Обновить документацию

```
docs/database-schema.md
```

### 3. Протестировать на dev

### 4. Backup перед применением на prod

---

## Правила для типов изменений

### Добавление таблицы

```sql
-- Миграция
CREATE TABLE new_table (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_new_table_xxx ON new_table(xxx);
```

**Docs:** Добавить полное описание в database-schema.md

### Добавление колонки

```sql
-- Миграция
ALTER TABLE existing_table
ADD COLUMN new_column TYPE DEFAULT value;
```

**Требования:**
- Обязательно `DEFAULT` для NOT NULL колонок
- Или `NULL` для опциональных

### Изменение ENUM

```sql
-- Только добавление значений!
ALTER TYPE enum_type ADD VALUE 'new_value';
```

**Нельзя:**
- Удалять значения
- Переименовывать значения

### Удаление колонки

```sql
-- Шаг 1: Сделать nullable (если была NOT NULL)
ALTER TABLE table_name ALTER COLUMN column DROP NOT NULL;

-- Шаг 2: Удалить код, использующий колонку

-- Шаг 3: Через 1-2 релиза — удалить колонку
ALTER TABLE table_name DROP COLUMN column;
```

---

## Snapshot-логика

### Принцип

Некоторые таблицы хранят **snapshot данных на момент создания**:

- `review_complaints` — snapshot отзыва
- Не синхронизируются обратно с источником

### Правила

1. Snapshot-поля помечены в schema
2. НЕ обновлять snapshot при изменении источника
3. Snapshot нужен для исторической точности

---

## Защита от дублей

### Уникальные constraint

```sql
-- Пример: один отзыв = одна жалоба
ALTER TABLE review_complaints
ADD CONSTRAINT review_complaints_review_id_key UNIQUE (review_id);
```

### Upsert pattern

```sql
INSERT INTO table (id, ...)
VALUES ($1, ...)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW(),
  ...;
```

---

## Индексы

### Создание

1. Анализировать EXPLAIN ANALYZE для slow queries
2. Composite indexes: порядок колонок важен
3. Partial indexes для частых WHERE conditions

### Документирование

```markdown
### Indexes for `reviews`

| Index | Columns | Condition | Purpose |
|-------|---------|-----------|---------|
| idx_reviews_store_date | store_id, date DESC | - | Основная сортировка |
| idx_reviews_default_filter | store_id, rating, ... | rating ≤ 3 | Фильтр жалоб |
```

---

## Stop Conditions

### Остановиться и спросить, если:

- Неясно, прод это или dev
- Затрагивается > 1000 строк
- Требуется удаление данных
- Изменяется структура critical таблиц (reviews, stores, products)
- Нет backup

---

## Связанные документы

- [Database Schema](../database-schema.md) — полная схема
- [Docs Update Policy](./DOCS_UPDATE_POLICY.md) — когда обновлять docs

---

**Last Updated:** 2026-02-08
