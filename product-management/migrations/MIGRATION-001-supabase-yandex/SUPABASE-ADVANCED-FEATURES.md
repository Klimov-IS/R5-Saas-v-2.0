# Supabase: Продвинутые фишки для SaaS | WB Reputation Manager

**Для кого:** Владелец проекта с базовыми знаниями Supabase
**Цель:** Изучить продвинутые возможности Supabase специфичные для SaaS продуктов
**Применение:** Каждая фишка будет использована в миграции

---

## 📚 Структура документа

1. **Row Level Security (RLS) для multi-tenancy** - безопасность
2. **Database Functions** - бизнес-логика в базе
3. **Triggers** - автоматизация
4. **Realtime Subscriptions** - live updates
5. **Generated Types** - TypeScript type-safety
6. **Connection Pooling** - производительность
7. **Materialized Views** - быстрая аналитика
8. **Full-Text Search** - поиск по тексту
9. **Database Webhooks** - интеграции
10. **Migrations** - version control схемы

---

## 1. Row Level Security (RLS) для multi-tenancy

### Что это:
Политики безопасности на уровне PostgreSQL, которые автоматически фильтруют данные:
- Пользователь видит только **свои** магазины
- Пользователь не может изменить **чужие** отзывы
- Все работает на уровне базы (невозможно обойти через API)

### Зачем нужно в WB Reputation Manager:
- **Multi-tenancy:** У нас 100+ пользователей на одной базе
- **Безопасность:** Случайно не покажем данные чужого магазина
- **Меньше кода:** Не нужно везде писать `WHERE user_id = auth.uid()`

---

### Практика: Настройка RLS для stores

#### Шаг 1: Включить RLS
```sql
-- Включить RLS для таблицы stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
```

#### Шаг 2: Создать политики

```sql
-- Политика SELECT: пользователь видит только свои магазины
CREATE POLICY "users_select_own_stores"
  ON stores
  FOR SELECT
  USING (auth.uid() = user_id);

-- Политика INSERT: пользователь может создавать только свои магазины
CREATE POLICY "users_insert_own_stores"
  ON stores
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Политика UPDATE: пользователь может редактировать только свои магазины
CREATE POLICY "users_update_own_stores"
  ON stores
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Политика DELETE: пользователь может удалять только свои магазины
CREATE POLICY "users_delete_own_stores"
  ON stores
  FOR DELETE
  USING (auth.uid() = user_id);
```

#### Шаг 3: Тестирование

```sql
-- От имени User A (id: 11111111-1111-1111-1111-111111111111)
SELECT * FROM stores;
-- Результат: только магазины User A

-- Попытка вставить магазин от имени User B
INSERT INTO stores (user_id, name)
VALUES ('22222222-2222-2222-2222-222222222222', 'Чужой магазин');
-- Ошибка: new row violates row-level security policy
```

---

### Продвинутые политики

#### Пример 1: Разные роли (admin, manager, viewer)

```sql
-- Создать enum для ролей
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');

-- Добавить роль в таблицу store_members
CREATE TABLE store_members (
  store_id UUID REFERENCES stores(id),
  user_id UUID REFERENCES auth.users(id),
  role user_role NOT NULL DEFAULT 'viewer',
  PRIMARY KEY (store_id, user_id)
);

-- Политика: admin и manager могут редактировать, viewer только читать
CREATE POLICY "store_members_can_view"
  ON stores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM store_members
      WHERE store_members.store_id = stores.id
        AND store_members.user_id = auth.uid()
    )
  );

CREATE POLICY "only_admins_can_delete"
  ON stores
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM store_members
      WHERE store_members.store_id = stores.id
        AND store_members.user_id = auth.uid()
        AND store_members.role = 'admin'
    )
  );
```

#### Пример 2: Service role bypass (для scheduled tasks)

```sql
-- Разрешить service role обходить RLS
ALTER TABLE stores FORCE ROW LEVEL SECURITY;

-- Политика для service role (например, Edge Function)
CREATE POLICY "service_role_all_access"
  ON stores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

---

### Применение в проекте:

**Sprint M2, Task:** Настроить RLS для всех таблиц (5 SP)

```sql
-- stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_stores" ON stores FOR ALL USING (auth.uid() = user_id);

-- products (через stores)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_products" ON products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = products.store_id
      AND stores.user_id = auth.uid()
  )
);

-- reviews (через products → stores)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_reviews" ON reviews FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM products
    JOIN stores ON stores.id = products.store_id
    WHERE products.id = reviews.product_id
      AND stores.user_id = auth.uid()
  )
);
```

**Результат:**
- ✅ Автоматическая изоляция данных
- ✅ Невозможно случайно показать чужие данные
- ✅ Безопасность на уровне базы (не зависит от кода)

---

## 2. Database Functions для бизнес-логики

### Что это:
SQL функции, которые выполняются внутри PostgreSQL:
- Быстрее чем N запросов с клиента
- Атомарные операции (транзакции)
- Переиспользуемая логика

### Зачем нужно в WB Reputation Manager:
- **Аналитика:** Статистика магазина за 1 запрос
- **Bulk operations:** Массовое обновление тегов
- **Complex logic:** Расчет метрик

---

### Практика: Функция для статистики магазина

#### Функция: get_store_stats(store_id)

```sql
CREATE OR REPLACE FUNCTION get_store_stats(store_id_param UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'store_id', store_id_param,
    'total_reviews', COUNT(r.*),
    'avg_rating', ROUND(AVG(r.rating)::numeric, 2),
    'rating_distribution', json_build_object(
      '5_star', COUNT(*) FILTER (WHERE r.rating = 5),
      '4_star', COUNT(*) FILTER (WHERE r.rating = 4),
      '3_star', COUNT(*) FILTER (WHERE r.rating = 3),
      '2_star', COUNT(*) FILTER (WHERE r.rating = 2),
      '1_star', COUNT(*) FILTER (WHERE r.rating = 1)
    ),
    'response_stats', json_build_object(
      'total_answered', COUNT(*) FILTER (WHERE r.answered = true),
      'response_rate', ROUND(
        COUNT(*) FILTER (WHERE r.answered = true)::numeric * 100.0 / NULLIF(COUNT(*), 0),
        2
      ),
      'avg_response_time_hours', ROUND(
        AVG(EXTRACT(EPOCH FROM (r.answered_at - r.created_at)) / 3600)::numeric,
        1
      ) FILTER (WHERE r.answered = true)
    ),
    'time_stats', json_build_object(
      'today_reviews', COUNT(*) FILTER (WHERE r.created_at >= CURRENT_DATE),
      'this_week_reviews', COUNT(*) FILTER (WHERE r.created_at >= DATE_TRUNC('week', CURRENT_DATE)),
      'this_month_reviews', COUNT(*) FILTER (WHERE r.created_at >= DATE_TRUNC('month', CURRENT_DATE))
    ),
    'sentiment', json_build_object(
      'positive', COUNT(*) FILTER (WHERE r.rating >= 4),
      'neutral', COUNT(*) FILTER (WHERE r.rating = 3),
      'negative', COUNT(*) FILTER (WHERE r.rating <= 2)
    )
  ) INTO result
  FROM reviews r
  JOIN products p ON p.id = r.product_id
  WHERE p.store_id = store_id_param;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Использование в коде:

**Before (Firebase - 5+ запросов):**
```typescript
// API route: /api/stores/[storeId]/stats
const reviews = await firestore
  .collection('stores').doc(storeId)
  .collection('reviews').get();

const totalReviews = reviews.size;
const avgRating = reviews.docs.reduce((sum, doc) => sum + doc.data().rating, 0) / totalReviews;
const answered = reviews.docs.filter(doc => doc.data().answered).length;
// ... еще 10+ строк кода
```

**After (Supabase - 1 запрос):**
```typescript
// API route: /api/stores/[storeId]/stats
const { data: stats } = await supabase
  .rpc('get_store_stats', { store_id_param: storeId });

return NextResponse.json(stats);

// Результат:
// {
//   "store_id": "...",
//   "total_reviews": 1234,
//   "avg_rating": 4.52,
//   "rating_distribution": { "5_star": 800, "4_star": 300, ... },
//   "response_stats": { "response_rate": 85.3, ... },
//   ...
// }
```

**Преимущества:**
- ⚡ **Скорость:** 1 запрос вместо 5+
- 🔒 **Безопасность:** `SECURITY DEFINER` обходит RLS (для admin функций)
- 🎯 **Точность:** Атомарная операция (consistent snapshot)

---

### Практика: Функция для bulk operations

#### Функция: bulk_update_chat_tags(chat_ids[], new_tag)

```sql
CREATE OR REPLACE FUNCTION bulk_update_chat_tags(
  chat_ids UUID[],
  new_tag TEXT
)
RETURNS TABLE (updated_count INTEGER) AS $$
BEGIN
  -- Проверка: пользователь владеет всеми чатами
  IF EXISTS (
    SELECT 1 FROM chats c
    JOIN stores s ON s.id = c.store_id
    WHERE c.id = ANY(chat_ids)
      AND s.user_id != auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: you do not own all chats';
  END IF;

  -- Массовое обновление
  UPDATE chats
  SET
    tag = new_tag,
    tag_updated_at = NOW(),
    tag_updated_by = auth.uid()
  WHERE id = ANY(chat_ids);

  -- Вернуть количество обновленных
  RETURN QUERY SELECT COUNT(*)::INTEGER FROM unnest(chat_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Использование:

```typescript
// Обновить теги для 50 чатов за 1 запрос
const { data } = await supabase.rpc('bulk_update_chat_tags', {
  chat_ids: [
    '11111111-...',
    '22222222-...',
    // ... 50 IDs
  ],
  new_tag: 'resolved'
});

console.log(`Updated ${data[0].updated_count} chats`);
```

---

### Применение в проекте:

**Sprint M3, Task:** Создать database functions (5 SP)

Функции для создания:
1. `get_store_stats(store_id)` - статистика дашборда
2. `get_reviews_with_sentiment(store_id, limit)` - отзывы с сентиментом
3. `bulk_update_chat_tags(chat_ids[], tag)` - массовое обновление
4. `calculate_response_time(store_id)` - среднее время ответа
5. `get_top_products(store_id, limit)` - топ товаров по рейтингу

---

## 3. Triggers для автоматизации

### Что это:
Автоматические действия при INSERT/UPDATE/DELETE:
- Auto-timestamps (`updated_at`)
- Денормализация (копирование `store_name` в reviews)
- Audit logs (кто и когда изменил)

### Зачем нужно:
- **DRY:** Не повторять логику в коде
- **Надежность:** Работает всегда (даже если забыли в коде)
- **Производительность:** Минус 1 запрос

---

### Практика: Auto-update timestamps

#### Создать функцию trigger:

```sql
-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Применить к таблицам:

```sql
-- Для stores
CREATE TRIGGER set_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Для products
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Для reviews
CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();
```

**Результат:**
- ✅ `updated_at` обновляется автоматически при любом UPDATE
- ✅ Не нужно писать в коде `.update({ updated_at: new Date() })`

---

### Практика: Денормализация store_name

#### Проблема:
В Firebase мы хранили `storeName` в каждом review (денормализация).
Нужно автоматически обновлять `store_name` при изменении названия магазина.

#### Решение:

```sql
-- Функция для копирования store_name
CREATE OR REPLACE FUNCTION sync_store_name_to_reviews()
RETURNS TRIGGER AS $$
BEGIN
  -- Если название магазина изменилось
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    -- Обновить все связанные reviews
    UPDATE reviews r
    SET store_name = NEW.name
    FROM products p
    WHERE p.id = r.product_id
      AND p.store_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применить trigger
CREATE TRIGGER sync_store_name
  AFTER UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION sync_store_name_to_reviews();
```

**Тестирование:**
```sql
-- Изменить название магазина
UPDATE stores SET name = 'Новое название' WHERE id = '...';

-- Проверить reviews
SELECT DISTINCT store_name FROM reviews WHERE store_id = '...';
-- Результат: 'Новое название' (обновилось автоматически!)
```

---

### Практика: Audit Log

#### Создать таблицу для логов:

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Функция для audit:

```sql
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Применить к критичным таблицам:

```sql
-- Логировать все изменения в stores
CREATE TRIGGER stores_audit
  AFTER INSERT OR UPDATE OR DELETE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- Логировать удаление отзывов (на случай спора)
CREATE TRIGGER reviews_delete_audit
  AFTER DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();
```

**Применение:**
```sql
-- Посмотреть кто удалил отзыв
SELECT
  a.action,
  a.changed_at,
  u.email AS changed_by_email,
  a.old_data->>'text' AS deleted_review_text
FROM audit_log a
JOIN auth.users u ON u.id = a.changed_by
WHERE a.table_name = 'reviews'
  AND a.action = 'DELETE'
ORDER BY a.changed_at DESC
LIMIT 10;
```

---

### Применение в проекте:

**Sprint M3, Task:** Настроить triggers (2 SP)

Triggers для создания:
1. `set_updated_at` - auto timestamps (все таблицы)
2. `sync_store_name` - денормализация (stores → reviews)
3. `audit_critical_changes` - audit log (stores, reviews)

---

## 4. Realtime Subscriptions (продвинутое)

### Базовое использование (вы уже знаете):

```typescript
const subscription = supabase
  .channel('reviews-changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'reviews'
  }, (payload) => {
    console.log('New review!', payload.new);
  })
  .subscribe();
```

---

### Продвинутое: Фильтры

#### Подписаться только на отзывы конкретного магазина:

```typescript
const subscription = supabase
  .channel(`reviews-store-${storeId}`)
  .on('postgres_changes', {
    event: '*',  // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'reviews',
    filter: `store_id=eq.${storeId}`  // Фильтр!
  }, (payload) => {
    console.log('Review changed:', payload);

    // Обновить UI
    if (payload.eventType === 'INSERT') {
      addReviewToList(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      updateReviewInList(payload.new);
    } else if (payload.eventType === 'DELETE') {
      removeReviewFromList(payload.old.id);
    }
  })
  .subscribe();
```

---

### Продвинутое: Broadcast для live notifications

#### Use case: Показать уведомление всем пользователям online

```typescript
// Создать канал для broadcast
const channel = supabase.channel('notifications');

// Отправить уведомление (с сервера)
channel.send({
  type: 'broadcast',
  event: 'new_feature',
  payload: {
    title: 'Новая фишка!',
    message: 'Теперь доступна массовая рассылка в чаты',
    url: '/features/bulk-chat'
  }
});

// Получить уведомление (у всех клиентов)
channel.on('broadcast', { event: 'new_feature' }, (payload) => {
  toast.success(payload.title, { description: payload.message });
});
```

---

### Продвинутое: Presence для "кто онлайн"

#### Use case: Показать кто сейчас смотрит чат

```typescript
const channel = supabase.channel('chat-123-presence', {
  config: { presence: { key: userId } }
});

// Отправить свое присутствие
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({
      user_id: userId,
      user_name: userName,
      online_at: new Date().toISOString()
    });
  }
});

// Получить список онлайн пользователей
channel.on('presence', { event: 'sync' }, () => {
  const presenceState = channel.presenceState();
  console.log('Online users:', presenceState);

  // UI: Показать аватары онлайн пользователей
  updateOnlineUsers(Object.values(presenceState).flat());
});

// Кто-то присоединился
channel.on('presence', { event: 'join' }, ({ newPresences }) => {
  console.log('User joined:', newPresences);
});

// Кто-то ушел
channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  console.log('User left:', leftPresences);
});
```

---

### Применение в проекте:

**Sprint M5, Task:** Заменить useCollection на Realtime (8 SP)

Что заменить:
1. `useCollection('reviews')` → `supabase.channel('reviews').on('postgres_changes')`
2. `useCollection('chats')` → с фильтром по store_id
3. `useDoc('stores/{id}')` → подписка на одну запись
4. Добавить Presence для "кто онлайн" в чатах (опционально, +2 SP)

---

## 5. Generated Types для Type-Safety

### Что это:
Автоматическая генерация TypeScript типов из PostgreSQL схемы:
- Нет ошибок в названиях полей
- Autocomplete в IDE
- Type-safe queries

---

### Генерация типов:

```bash
# Сгенерировать types из локального Supabase
supabase gen types typescript --local > src/types/database.types.ts

# Или из production
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

#### Сгенерированные типы (пример):

```typescript
// src/types/database.types.ts (автоматически)
export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          wb_api_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          wb_api_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          wb_api_key?: string | null;
          updated_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          text: string;
          rating: number;
          answered: boolean;
          created_at: string;
        };
        // ... Insert, Update
      };
      // ... другие таблицы
    };
    Functions: {
      get_store_stats: {
        Args: { store_id_param: string };
        Returns: Json;
      };
      // ... другие функции
    };
  };
};
```

---

### Использование типов:

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Теперь все типы автоматические!
```

#### Type-safe queries:

```typescript
// ✅ TypeScript знает структуру stores
const { data: stores } = await supabase
  .from('stores')
  .select('id, name, created_at')
  .eq('user_id', userId);

// stores имеет тип:
// Array<{ id: string; name: string; created_at: string }> | null

// ❌ Ошибка компиляции если поле не существует
const { data } = await supabase
  .from('stores')
  .select('nonexistent_field');  // Error: Property 'nonexistent_field' does not exist
```

#### Type-safe RPC:

```typescript
// ✅ TypeScript знает аргументы и return type
const { data: stats } = await supabase
  .rpc('get_store_stats', {
    store_id_param: storeId  // Type: string
  });

// stats имеет тип: Json | null

// ❌ Ошибка если неправильные аргументы
const { data } = await supabase
  .rpc('get_store_stats', {
    wrong_param: 123  // Error: Argument 'store_id_param' is missing
  });
```

---

### Применение в проекте:

**Sprint M4, Task:** Setup generated types (1 SP)

1. Сгенерировать типы из схемы
2. Подключить в `supabase.ts`
3. Обновить все queries с типами
4. Добавить в CI/CD: регенерация типов при изменении схемы

---

## 6. Connection Pooling для производительности

### Проблема:
PostgreSQL имеет лимит соединений (обычно 100-200).
При масштабировании (1000+ пользователей) соединения заканчиваются.

### Решение: PgBouncer (Connection Pooler)

Supabase включает PgBouncer out-of-the-box:
- **Direct connection:** `db.xxx.supabase.co:5432` (для migrations)
- **Pooled connection:** `db.xxx.supabase.co:6543` (для app)

---

### Настройка в коде:

```typescript
// .env
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
DATABASE_POOLER_URL="postgresql://postgres:password@db.xxx.supabase.co:6543/postgres?pgbouncer=true"

// Для app используем pooler
const { data } = await supabase.from('stores').select('*');

// Для migrations используем direct
npx prisma migrate deploy --url=$DATABASE_URL
```

---

### Pool modes:

1. **Session mode** (default):
   - Соединение держится на протяжении сессии
   - Подходит для transactions

2. **Transaction mode** (рекомендуется):
   - Соединение только на 1 транзакцию
   - Максимальная эффективность

```sql
-- Настроить в Supabase Studio → Database → Connection pooling
ALTER DATABASE postgres SET default_transaction_mode = 'transaction';
```

---

### Применение в проекте:

**Sprint M2, Task:** Setup connection pooling (0.5 SP)

1. Использовать pooler URL для app queries
2. Direct URL только для migrations
3. Настроить pool size (рекомендуется: 20)

---

## 7. Materialized Views для аналитики

### Что это:
"Закэшированный" результат SQL запроса:
- Пересчитывается по расписанию (не каждый раз)
- Быстрый доступ к сложной аналитике

### Когда использовать:
- Dashboard с тяжелыми агрегациями
- Отчеты за прошлые периоды (не меняются)
- Топ товаров (обновляется раз в час)

---

### Практика: Materialized View для статистики

```sql
-- Создать materialized view
CREATE MATERIALIZED VIEW store_stats_mv AS
SELECT
  s.id AS store_id,
  s.name AS store_name,
  COUNT(DISTINCT p.id) AS total_products,
  COUNT(r.id) AS total_reviews,
  ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
  COUNT(r.id) FILTER (WHERE r.answered = true) AS answered_reviews,
  ROUND(
    COUNT(r.id) FILTER (WHERE r.answered = true)::numeric * 100.0 / NULLIF(COUNT(r.id), 0),
    2
  ) AS response_rate
FROM stores s
LEFT JOIN products p ON p.store_id = s.id
LEFT JOIN reviews r ON r.product_id = p.id
GROUP BY s.id, s.name;

-- Создать уникальный индекс (обязательно для CONCURRENTLY)
CREATE UNIQUE INDEX ON store_stats_mv(store_id);
```

#### Использование:

```typescript
// Обычный SELECT (очень быстро, т.к. уже посчитано)
const { data: stats } = await supabase
  .from('store_stats_mv')
  .select('*')
  .eq('store_id', storeId)
  .single();

// Результат мгновенно (не пересчитывает каждый раз)
```

---

### Обновление Materialized View:

#### Вариант 1: Вручную
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY store_stats_mv;
```

#### Вариант 2: По расписанию (pg_cron)

```sql
-- Установить pg_cron (Supabase уже включает)
SELECT cron.schedule(
  'refresh-store-stats',  -- job name
  '0 * * * *',            -- every hour
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY store_stats_mv$$
);
```

#### Вариант 3: Trigger (при изменении данных)

```sql
-- Refresh materialized view при INSERT/UPDATE/DELETE review
CREATE OR REPLACE FUNCTION refresh_store_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY store_stats_mv;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_stats_on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_store_stats();
```

---

### Применение в проекте:

**Sprint M5, Task:** Создать materialized views для дашборда (2 SP)

Views для создания:
1. `store_stats_mv` - общая статистика
2. `top_products_mv` - топ товаров по рейтингу
3. `daily_reviews_mv` - отзывы по дням (для графиков)

---

## 8. Full-Text Search (поиск по тексту)

### Что это:
Полнотекстовый поиск по отзывам, чатам, вопросам:
- Поддержка русского языка
- Ranked results (релевантность)
- Быстрее чем `LIKE '%keyword%'`

---

### Практика: Поиск по отзывам

#### Создать GIN индекс:

```sql
-- Добавить tsvector column
ALTER TABLE reviews
ADD COLUMN text_search tsvector
GENERATED ALWAYS AS (to_tsvector('russian', text)) STORED;

-- Создать GIN индекс
CREATE INDEX reviews_text_search_idx ON reviews USING gin(text_search);
```

#### Поиск:

```sql
-- Найти отзывы со словами "отличный товар"
SELECT *
FROM reviews
WHERE text_search @@ to_tsquery('russian', 'отличный & товар')
ORDER BY ts_rank(text_search, to_tsquery('russian', 'отличный & товар')) DESC;
```

#### В коде:

```typescript
const { data: reviews } = await supabase
  .from('reviews')
  .select('*')
  .textSearch('text_search', 'отличный & товар', {
    type: 'websearch',
    config: 'russian'
  })
  .order('created_at', { ascending: false })
  .limit(20);
```

---

### Продвинутый поиск: с подсветкой

```sql
SELECT
  id,
  text,
  ts_headline(
    'russian',
    text,
    to_tsquery('russian', 'отличный & товар'),
    'StartSel=<mark>, StopSel=</mark>'
  ) AS highlighted_text,
  ts_rank(text_search, to_tsquery('russian', 'отличный & товар')) AS rank
FROM reviews
WHERE text_search @@ to_tsquery('russian', 'отличный & товар')
ORDER BY rank DESC;
```

Результат:
```json
{
  "text": "Отличный товар, очень доволен покупкой!",
  "highlighted_text": "<mark>Отличный</mark> <mark>товар</mark>, очень доволен покупкой!",
  "rank": 0.0607927
}
```

---

### Применение в проекте:

**Sprint M5, Task:** Добавить full-text search (3 SP)

Где использовать:
1. Поиск по отзывам
2. Поиск по чатам
3. Поиск по вопросам
4. Фильтр "Найти в отзывах" на дашборде

---

## 9. Database Webhooks для интеграций

### Что это:
HTTP callback при изменении данных в PostgreSQL:
- Отправить в Telegram при новом отзыве
- Синхронизация с CRM
- Analytics tracking

---

### Практика: Webhook при новом негативном отзыве

#### Создать webhook в Supabase Studio:

```sql
-- Database → Webhooks → Create a new hook

-- Name: notify_negative_review
-- Table: reviews
-- Events: INSERT
-- Condition: NEW.rating <= 2
-- HTTP URL: https://api.telegram.org/botYOUR_TOKEN/sendMessage
-- HTTP Method: POST
-- HTTP Headers:
--   Content-Type: application/json
```

#### Payload template:

```json
{
  "chat_id": "YOUR_TELEGRAM_CHAT_ID",
  "text": "🚨 Новый негативный отзыв!\n\nМагазин: {{ record.store_name }}\nРейтинг: {{ record.rating }} ⭐\nТекст: {{ record.text }}\n\nОтветить: https://wb-reputation.com/reviews/{{ record.id }}"
}
```

**Результат:** При каждом новом отзыве с rating <= 2 → Telegram уведомление!

---

### Альтернатива: Edge Function для complex webhooks

```typescript
// supabase/functions/webhook-negative-review/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { record } = await req.json();

  // Отправить в Telegram
  await fetch(`https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Deno.env.get('TELEGRAM_CHAT_ID'),
      text: `🚨 Негативный отзыв!\n\nРейтинг: ${record.rating}⭐\n${record.text}`,
    }),
  });

  // Также отправить в analytics
  await fetch('https://analytics.example.com/events', {
    method: 'POST',
    body: JSON.stringify({
      event: 'negative_review',
      properties: { store_id: record.store_id, rating: record.rating },
    }),
  });

  return new Response('OK', { status: 200 });
});
```

#### Подключить через Database Trigger:

```sql
CREATE TRIGGER send_webhook_on_negative_review
  AFTER INSERT ON reviews
  FOR EACH ROW
  WHEN (NEW.rating <= 2)
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://your-project.supabase.co/functions/v1/webhook-negative-review',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
```

---

### Применение в проекте:

**Sprint M6, Task:** Настроить webhooks (3 SP, опционально)

Webhooks для создания:
1. Telegram уведомление при негативном отзыве (rating <= 2)
2. Webhook в Slack при новом магазине
3. Analytics event при генерации AI ответа

---

## 10. Migrations для Version Control схемы

### Что это:
SQL миграции как код:
- Версионирование схемы базы
- Reproducible deployments
- Rollback при ошибках

---

### Структура миграций:

```
supabase/
├── migrations/
│   ├── 20250101000000_create_stores_table.sql
│   ├── 20250102000000_create_products_table.sql
│   ├── 20250103000000_create_reviews_table.sql
│   ├── 20250104000000_add_rls_policies.sql
│   ├── 20250105000000_create_functions.sql
│   └── 20250106000000_create_triggers.sql
└── seed.sql  # тестовые данные
```

---

### Создание миграции:

```bash
# Создать новую миграцию
supabase migration new add_full_text_search

# Файл: supabase/migrations/20250107000000_add_full_text_search.sql
```

#### Содержимое миграции:

```sql
-- supabase/migrations/20250107000000_add_full_text_search.sql

-- Add tsvector column
ALTER TABLE reviews
ADD COLUMN text_search tsvector
GENERATED ALWAYS AS (to_tsvector('russian', text)) STORED;

-- Create GIN index
CREATE INDEX reviews_text_search_idx ON reviews USING gin(text_search);
```

---

### Применение миграции:

```bash
# Локально
supabase db reset  # reset + все миграции

# Production
supabase db push  # применить новые миграции
```

---

### Rollback миграции:

#### Вариант 1: Создать down migration

```sql
-- supabase/migrations/20250108000000_rollback_full_text_search.sql

DROP INDEX IF EXISTS reviews_text_search_idx;
ALTER TABLE reviews DROP COLUMN IF EXISTS text_search;
```

#### Вариант 2: Использовать транзакции

```sql
-- supabase/migrations/20250107000000_add_full_text_search.sql

BEGIN;

-- Migration up
ALTER TABLE reviews ADD COLUMN text_search tsvector ...;
CREATE INDEX reviews_text_search_idx ...;

-- Проверка: если что-то пошло не так
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'reviews_text_search_idx') THEN
    RAISE EXCEPTION 'Index not created, rolling back';
  END IF;
END $$;

COMMIT;
```

---

### Применение в проекте:

**Sprint M1, Task:** Setup migrations (2 SP)

Создать миграции:
1. `001_create_base_schema.sql` - stores, products, reviews, chats, questions
2. `002_add_indexes.sql` - все индексы
3. `003_add_rls_policies.sql` - Row Level Security
4. `004_create_functions.sql` - database functions
5. `005_create_triggers.sql` - triggers

---

## 📊 Сводная таблица: Когда использовать что

| Задача | Технология | Sprint | SP |
|--------|-----------|--------|-----|
| **Безопасность: изоляция пользователей** | Row Level Security | M2 | 5 |
| **Аналитика: статистика за 1 запрос** | Database Functions | M3 | 5 |
| **Автоматизация: auto timestamps** | Triggers | M3 | 2 |
| **Live updates: новые отзывы** | Realtime Subscriptions | M5 | 8 |
| **Type-safety: autocomplete** | Generated Types | M4 | 1 |
| **Производительность: много пользователей** | Connection Pooling | M2 | 0.5 |
| **Быстрая аналитика: дашборды** | Materialized Views | M5 | 2 |
| **Поиск: по тексту отзывов** | Full-Text Search | M5 | 3 |
| **Интеграции: Telegram alerts** | Database Webhooks | M6 | 3 |
| **Version control: схема базы** | Migrations | M1 | 2 |

**Итого:** 31.5 SP на продвинутые фичи

---

## 🎯 Что изучить в первую очередь

### Приоритет 1 (Must Have):
1. **Row Level Security** - критично для безопасности
2. **Database Functions** - используется в 50%+ запросов
3. **Migrations** - нужно с самого начала

### Приоритет 2 (Should Have):
4. **Realtime** - ключевая фича для UX
5. **Generated Types** - экономит время на дебаггинг
6. **Triggers** - автоматизация

### Приоритет 3 (Nice to Have):
7. **Materialized Views** - можно добавить позже
8. **Full-Text Search** - если пользователи попросят
9. **Webhooks** - для интеграций (опционально)
10. **Connection Pooling** - актуально при > 100 пользователей

---

## 📚 Дополнительные ресурсы

**Документация:**
- RLS: https://supabase.com/docs/guides/auth/row-level-security
- Functions: https://supabase.com/docs/guides/database/functions
- Realtime: https://supabase.com/docs/guides/realtime
- Full-Text Search: https://supabase.com/docs/guides/database/full-text-search

**Видео (англ):**
- "Supabase в production" (40 мин)
- "Row Level Security глубокое погружение" (25 мин)

**Примеры кода:**
- Supabase Examples: https://github.com/supabase/supabase/tree/master/examples

---

## ✅ Чек-лист изучения

После изучения этого документа вы должны понимать:

- [ ] Как настроить RLS для multi-tenancy
- [ ] Когда использовать Database Functions vs API code
- [ ] Как автоматизировать задачи через Triggers
- [ ] Как заменить Firebase onSnapshot на Realtime
- [ ] Зачем нужны Generated Types
- [ ] Что такое Connection Pooling и когда включать
- [ ] Когда использовать Materialized Views
- [ ] Как сделать Full-Text Search по русским текстам
- [ ] Как настроить Webhooks для интеграций
- [ ] Как версионировать схему через Migrations

**Готовы к миграции:** ☑️ ДА / ☐ НЕТ

---

**Следующий шаг:** Открыть [TECHNICAL-ARCHITECTURE.md](./TECHNICAL-ARCHITECTURE.md) для изучения архитектуры

---

**Создано:** 30 декабря 2024
**Последнее обновление:** 30 декабря 2024
**Статус:** 📚 Study Material
**Для:** Владелец проекта (продвинутый уровень)
