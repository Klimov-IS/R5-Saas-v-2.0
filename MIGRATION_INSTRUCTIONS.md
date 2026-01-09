# Firebase → PostgreSQL Migration Instructions

**Проект:** WB Reputation Manager
**Метод:** Двухэтапная миграция (Firebase → JSON → PostgreSQL)
**Дата создания:** 2026-01-04

---

## Обзор процесса

Миграция состоит из двух основных этапов:

1. **ЭТАП 2A:** Экспорт данных из Firebase в JSON файлы (локально)
2. **ЭТАП 2B:** Импорт данных из JSON в PostgreSQL через WebSQL (Yandex Cloud)

---

## Предварительные требования

✅ PostgreSQL схема уже создана (9 таблиц, 36 индексов)
✅ Firebase Admin SDK настроен (`serviceAccountKey.json` скопирован)
✅ Node.js зависимости установлены (`npm install` выполнен)
✅ Yandex Cloud WebSQL доступен и работает

---

## ЭТАП 2A: Экспорт Firebase → JSON

### Шаг 1: Запустить экспорт данных

```bash
cd "wb-reputation V 1.0"
npm run export
```

**Что происходит:**
- Скрипт подключается к Firebase (старый проект `wb-reputation`)
- Читает все коллекции: users, stores, products, reviews, chats, questions, и т.д.
- Сохраняет данные в JSON файлы в папку `firebase-export/`
- Генерирует статистику экспорта в `migration_stats.json`

**Ожидаемое время:** 5-15 минут (зависит от объема данных)

**Результат:**
```
firebase-export/
├── users.json              # Пользователи
├── user_settings.json      # Настройки пользователей
├── stores.json             # Магазины
├── products.json           # Продукты
├── reviews.json            # Отзывы
├── chats.json              # Чаты
├── chat_messages.json      # Сообщения в чатах
├── questions.json          # Вопросы
├── ai_logs.json            # AI логи (последние 1000)
└── migration_stats.json    # Статистика экспорта
```

### Шаг 2: Проверить экспортированные данные

Откройте `firebase-export/migration_stats.json` и проверьте количество экспортированных записей:

```json
{
  "users": 10,
  "stores": 5,
  "products": 150,
  "reviews": 3000,
  "chats": 500,
  "chatMessages": 2000,
  "questions": 100,
  ...
}
```

**Проверочные вопросы:**
- ✅ Все JSON файлы созданы?
- ✅ Размеры файлов не нулевые?
- ✅ Количество записей соответствует ожиданиям?

### Шаг 3: Сгенерировать SQL скрипты

```bash
npm run generate-sql
```

**Что происходит:**
- Скрипт читает JSON файлы из `firebase-export/`
- Генерирует SQL INSERT команды
- Разбивает большие таблицы на батчи (по 500 записей)
- Сохраняет SQL файлы в папку `sql-import/`

**Ожидаемое время:** 1-2 минуты

**Результат:**
```
sql-import/
├── 01_import_users.sql
├── 02_import_user_settings.sql
├── 03_import_stores.sql
├── 04_import_products.sql
├── 05_import_reviews.sql
├── 06_import_chats.sql
├── 07_import_chat_messages.sql
├── 08_import_questions.sql
├── 09_import_ai_logs.sql
└── 10_verify_import.sql
```

---

## ЭТАП 2B: Импорт JSON → PostgreSQL

### Шаг 4: Открыть Yandex Cloud WebSQL

1. Перейдите в Yandex Cloud Console
2. Откройте кластер `wb-reputation-prod-db`
3. Перейдите на вкладку **WebSQL**
4. Убедитесь, что подключение активно (должно показать базу `wb_reputation`)

### Шаг 5: Выполнить SQL скрипты по порядку

**ВАЖНО:** Выполняйте скрипты **строго по порядку** (01 → 10), так как существуют зависимости между таблицами (foreign keys).

#### 5.1. Импорт users

1. Откройте файл `sql-import/01_import_users.sql`
2. Скопируйте весь SQL код
3. Вставьте в WebSQL редактор
4. Нажмите **"Выполнить"**
5. Дождитесь сообщения: `Запрос выполнен`
6. Проверьте результат внизу: должно показать количество импортированных пользователей

**Что делать при ошибке:**
- Проверьте, что таблица `users` существует: `SELECT COUNT(*) FROM users;`
- Если ошибка "duplicate key" → данные уже импортированы (можно пропустить)
- Если ошибка "foreign key" → проверьте порядок выполнения (users должны быть первыми)

#### 5.2. Импорт user_settings

1. Откройте файл `sql-import/02_import_user_settings.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните
4. Проверьте результат

#### 5.3. Импорт stores

1. Откройте файл `sql-import/03_import_stores.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните
4. Проверьте результат

#### 5.4. Импорт products

1. Откройте файл `sql-import/04_import_products.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните (может занять 10-30 секунд если много продуктов)
4. Проверьте результат

**Примечание:** Этот скрипт может быть большим, если у вас много продуктов. Он разбит на батчи по 500 записей для производительности.

#### 5.5. Импорт reviews

1. Откройте файл `sql-import/05_import_reviews.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните (может занять 30-60 секунд если много отзывов)
4. Проверьте результат

**Примечание:** Это может быть самый большой файл. Будьте терпеливы.

#### 5.6. Импорт chats

1. Откройте файл `sql-import/06_import_chats.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните
4. Проверьте результат

#### 5.7. Импорт chat_messages

1. Откройте файл `sql-import/07_import_chat_messages.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните
4. Проверьте результат

#### 5.8. Импорт questions

1. Откройте файл `sql-import/08_import_questions.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните
4. Проверьте результат

#### 5.9. Импорт ai_logs (опционально)

1. Откройте файл `sql-import/09_import_ai_logs.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните
4. Проверьте результат

**Примечание:** AI логи не критичны для работы приложения, можно пропустить.

---

## Шаг 6: Проверка импорта

### 6.1. Выполнить скрипт проверки

1. Откройте файл `sql-import/10_verify_import.sql`
2. Скопируйте и вставьте в WebSQL
3. Выполните

**Что проверяет скрипт:**

#### A. Количество записей
Сравнивает количество импортированных записей с ожидаемыми:

| Таблица        | Ожидаемо | Фактически | Статус   |
|----------------|----------|------------|----------|
| users          | 10       | 10         | ✅ OK    |
| stores         | 5        | 5          | ✅ OK    |
| products       | 150      | 150        | ✅ OK    |
| reviews        | 3000     | 3000       | ✅ OK    |
| chats          | 500      | 500        | ✅ OK    |
| chat_messages  | 2000     | 2000       | ✅ OK    |
| questions      | 100      | 100        | ✅ OK    |

#### B. Целостность связей (Foreign Keys)
Проверяет, что нет "осиротевших" записей:

| Проверка             | Orphans | Статус   |
|----------------------|---------|----------|
| orphaned_products    | 0       | ✅ OK    |
| orphaned_reviews     | 0       | ✅ OK    |
| orphaned_chats       | 0       | ✅ OK    |
| orphaned_messages    | 0       | ✅ OK    |

#### C. Выборка данных
Показывает несколько записей из каждой таблицы для визуальной проверки.

### 6.2. Что делать если есть ошибки

#### Проблема: Количество не совпадает

**Причина:** Неполный импорт или ошибка при выполнении SQL

**Решение:**
1. Проверьте логи WebSQL на наличие ошибок
2. Пересоздайте SQL файлы: `npm run generate-sql`
3. Повторите импорт для проблемной таблицы
4. Используйте `ON CONFLICT` для избежания дубликатов

#### Проблема: Найдены orphaned записи

**Причина:** Нарушен порядок импорта или отсутствуют parent записи

**Решение:**
1. Проверьте, что импорт выполнен в правильном порядке (01 → 09)
2. Проверьте, что все parent таблицы импортированы (например, products требуют stores)
3. При необходимости удалите orphaned записи:
   ```sql
   DELETE FROM reviews WHERE product_id NOT IN (SELECT id FROM products);
   ```

### 6.3. Ручная проверка данных

Выполните несколько контрольных запросов:

```sql
-- Количество магазинов по владельцам
SELECT owner_id, COUNT(*) as store_count
FROM stores
GROUP BY owner_id;

-- Количество отзывов по магазинам
SELECT s.name, COUNT(r.id) as review_count
FROM stores s
LEFT JOIN reviews r ON r.store_id = s.id
GROUP BY s.id, s.name
ORDER BY review_count DESC;

-- Средний рейтинг по продуктам
SELECT p.name, AVG(r.rating)::numeric(10,2) as avg_rating, COUNT(r.id) as review_count
FROM products p
LEFT JOIN reviews r ON r.product_id = p.id
GROUP BY p.id, p.name
ORDER BY review_count DESC
LIMIT 10;

-- Количество чатов по тегам
SELECT tag, COUNT(*) as chat_count
FROM chats
GROUP BY tag
ORDER BY chat_count DESC;
```

**Проверьте:**
- ✅ Данные выглядят корректно?
- ✅ Цифры соответствуют ожиданиям?
- ✅ Нет NULL значений где не должно быть?

---

## Шаг 7: Финальная проверка

### Чек-лист успешной миграции

- [ ] Все 9 таблиц содержат данные
- [ ] Количество записей совпадает с Firebase export
- [ ] Нет orphaned записей (foreign keys корректны)
- [ ] Данные визуально корректны (рандомная выборка)
- [ ] Индексы созданы (36 индексов)
- [ ] Все SQL скрипты выполнены без критичных ошибок

---

## Что делать дальше?

После успешной миграции данных переходим к **ЭТАПУ 3: Обновление кода приложения**.

### Следующие шаги:

1. **Скопировать код приложения** из `wb-reputation` в `wb-reputation V 1.0`
2. **Создать PostgreSQL клиент** (`src/lib/db.ts`)
3. **Обновить Server Actions** (заменить Firestore → PostgreSQL)
4. **Обновить API Routes** (заменить Firestore → PostgreSQL)
5. **Локальное тестирование** (`npm run dev`)
6. **Production deployment**

---

## Откат изменений (Rollback)

Если что-то пошло не так и нужно откатить изменения:

### Вариант 1: Очистить все таблицы

```sql
BEGIN;

TRUNCATE TABLE ai_logs CASCADE;
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE chats CASCADE;
TRUNCATE TABLE questions CASCADE;
TRUNCATE TABLE reviews CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE stores CASCADE;
TRUNCATE TABLE user_settings CASCADE;
TRUNCATE TABLE users CASCADE;

COMMIT;
```

**Внимание:** Это удалит ВСЕ данные из PostgreSQL. Используйте только если нужно начать миграцию заново.

### Вариант 2: Удалить конкретную таблицу

```sql
-- Пример: пересоздать только reviews
TRUNCATE TABLE reviews CASCADE;

-- Затем повторно выполните 05_import_reviews.sql
```

---

## Частые проблемы и решения

### Проблема: "permission denied"

**Решение:** Убедитесь, что используете пользователя `admin_R5` в WebSQL

### Проблема: "syntax error near..."

**Решение:**
1. Проверьте, что скопировали весь SQL код целиком
2. Проверьте, что не было искажения кодировки (кириллица в строках)

### Проблема: "duplicate key value violates unique constraint"

**Решение:** Данные уже импортированы. Можно пропустить или использовать `TRUNCATE` перед повторным импортом.

### Проблема: "foreign key constraint violated"

**Решение:** Нарушен порядок импорта. Выполните скрипты в правильном порядке (01 → 09).

### Проблема: WebSQL timeout

**Решение:**
1. Разбейте большой SQL файл на несколько частей
2. Выполните по частям
3. Увеличьте timeout в настройках WebSQL (если доступно)

---

## Поддержка

Если возникли проблемы:

1. Проверьте логи WebSQL на наличие ошибок
2. Проверьте `firebase-export/migration_stats.json` для статистики
3. Выполните `10_verify_import.sql` для диагностики
4. Сохраните скриншоты ошибок

---

## Резюме команд

```bash
# ЭТАП 2A: Экспорт из Firebase
cd "wb-reputation V 1.0"
npm run export            # Создаст firebase-export/*.json
npm run generate-sql      # Создаст sql-import/*.sql

# ЭТАП 2B: Импорт в PostgreSQL
# 1. Открыть Yandex Cloud WebSQL
# 2. Выполнить sql-import/01_import_users.sql
# 3. Выполнить sql-import/02_import_user_settings.sql
# 4. ... (продолжить до 09)
# 5. Выполнить sql-import/10_verify_import.sql

# Проверка
# Убедиться что все данные импортированы корректно
```

---

**Дата обновления:** 2026-01-04
**Версия:** 1.0
