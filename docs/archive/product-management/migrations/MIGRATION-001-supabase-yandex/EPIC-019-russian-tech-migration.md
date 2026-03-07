# EPIC-019: Миграция на российские технологии (Supabase + Yandex Cloud)

**Status:** 📋 Planned
**Priority:** P1 (High - Compliance Required)
**Quarter:** Q2 2025
**Owner:** Product Team
**RICE Score:** 240
**Duration:** 12 недель (6 спринтов по 2 недели)

---

## RICE Scoring

**Reach (Охват):** 100 (все пользователи + новые клиенты)
**Impact (Влияние):** 3 (Massive - соответствие 152-ФЗ + улучшение производительности)
**Confidence (Уверенность):** 80% (средняя, есть риски миграции)
**Effort (Усилия):** 10 человеко-недель (2.5 месяца)

**RICE Score = (100 × 3 × 0.8) / 10 = 240**

---

## Problem Statement (Проблема)

### Текущая ситуация:

**WB Reputation Manager** использует Firebase (Google Cloud) для хранения данных:
- **Firestore Database** - NoSQL база данных (США/Европа)
- **Firebase Authentication** - авторизация пользователей
- **Firebase Cloud Functions** - серверная логика

### Проблемы:

#### 1. **Юридические риски (КРИТИЧНО)**
- ❌ Firebase хранит данные на серверах Google за рубежом
- ❌ Нарушение ФЗ-152 "О персональных данных"
- ❌ Невозможность работать с крупными российскими компаниями (требуют 152-ФЗ)
- ❌ Риск блокировки доступа к Firebase со стороны РФ

**Цитата из 152-ФЗ:**
> "Обработка персональных данных граждан РФ должна осуществляться с использованием баз данных, находящихся на территории РФ"

#### 2. **Потеря клиентов**
- 🚫 Крупные ритейлеры не могут работать с нами (нет 152-ФЗ)
- 🚫 Корпоративные клиенты требуют российские дата-центры
- 📉 Потенциальная потеря 60%+ enterprise сегмента

#### 3. **Технические ограничения Firebase**
- 💸 Высокая стоимость при масштабировании ($50-100/месяц сейчас → $500+ при 1000 клиентах)
- 🐌 Медленные запросы из России (latency 150-300ms)
- 🔒 Vendor lock-in - сложно мигрировать

#### 4. **Конкурентное отставание**
- Конкуренты уже используют российские облака
- Потеря доверия клиентов

---

## Solution (Решение)

### Целевая архитектура:

**Миграция на Supabase + Yandex Cloud**

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14)                                      │
│  - Vercel / Russian hosting                                 │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS
┌────────────────▼────────────────────────────────────────────┐
│  Supabase (Self-hosted on Yandex Cloud)                     │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │ PostgREST    │ Realtime     │ Auth (GoTrue)            │ │
│  │ Auto API     │ WebSockets   │ JWT + RLS                │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PostgreSQL 15 (Managed Service)                      │   │
│  │ - Yandex Cloud Managed PostgreSQL                    │   │
│  │ - Region: ru-central1-a (Москва)                     │   │
│  │ - Репликация: 3 зоны доступности                     │   │
│  │ - Automatic backups (7 дней)                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Компоненты решения:

#### 1. **Yandex Cloud Managed PostgreSQL**
- **Локация:** Москва (ru-central1)
- **Версия:** PostgreSQL 15
- **Конфигурация:**
  - 2 vCPU, 8 GB RAM (для старта)
  - 50 GB SSD storage
  - Multi-AZ deployment (высокая доступность)
- **Стоимость:** ~₽5,000/месяц (vs Firebase $50 = ₽5,000)

#### 2. **Supabase (Open Source)**
- **Deployment:** Self-hosted на Yandex Compute Cloud
- **Компоненты:**
  - PostgREST - автоматический REST API
  - GoTrue - аутентификация
  - Realtime Server - WebSocket subscriptions
  - Storage API - хранилище файлов
- **Стоимость:** ~₽3,000/месяц (VM + трафик)

#### 3. **Edge Functions (Supabase Functions)**
- **Runtime:** Deno (замена Firebase Cloud Functions)
- **Deployment:** Yandex Cloud Functions или self-hosted
- **Use cases:**
  - Scheduled tasks (автообновление)
  - Webhooks (интеграции)
  - Heavy processing (AI генерация)

### Итоговая стоимость:

| Компонент | Firebase (сейчас) | Yandex + Supabase |
|-----------|-------------------|-------------------|
| Database | $30/месяц | ₽5,000/месяц (~$62) |
| Auth | $5/месяц | ₽0 (включено) |
| Functions | $10/месяц | ₽1,500/месяц (~$18) |
| Storage | $5/месяц | ₽500/месяц (~$6) |
| Network | $10/месяц | ₽1,000/месяц (~$12) |
| **ИТОГО** | **$60/месяц** | **₽8,000/месяц (~$98)** |

**Вывод:** Стоимость вырастет на ~$38/месяц (+63%), но:
- ✅ Полное соответствие 152-ФЗ
- ✅ Возможность работать с enterprise клиентами
- ✅ Лучшая производительность из России (latency 20-50ms vs 150-300ms)
- ✅ Контроль над данными

---

## Success Criteria (Критерии успеха)

### Функциональные требования:

#### Must Have (P0):
- ✅ Все данные перенесены из Firestore → PostgreSQL (100% integrity)
- ✅ Аутентификация работает (Firebase Auth → Supabase Auth)
- ✅ Все фичи продукта работают идентично
- ✅ Realtime обновления сохранены (onSnapshot → Realtime subscriptions)
- ✅ Scheduled tasks работают (Cloud Functions → Edge Functions)
- ✅ Данные хранятся в России (Yandex Cloud Moscow region)

#### Should Have (P1):
- ✅ Performance улучшен (API response time < 100ms)
- ✅ Rollback plan готов и протестирован
- ✅ Мониторинг настроен (Yandex Cloud Monitoring)
- ✅ Документация обновлена

#### Nice to Have (P2):
- ⭐ Row Level Security настроен (улучшенная безопасность)
- ⭐ Database Functions для аналитики
- ⭐ Automated backups в S3

### Метрики успеха:

| Метрика | До миграции (Firebase) | После миграции (Supabase) | Цель |
|---------|------------------------|----------------------------|------|
| **Compliance** | ❌ Нет 152-ФЗ | ✅ Полное соответствие | 100% |
| **API Latency (из России)** | 150-300ms | 20-50ms | < 100ms |
| **Data integrity** | 100% | 100% | 100% |
| **Downtime при миграции** | N/A | < 2 часа | < 4ч |
| **Стоимость/месяц** | $60 | ~$98 | < $150 |
| **Enterprise клиенты** | 0 | 5+ за Q3 | 10+ за Q4 |
| **Churn rate** | 5% | < 5% | < 3% |

### Business Impact:

**Ожидаемые результаты:**
- 📈 Возможность работать с enterprise клиентами (+60% потенциального рынка)
- ⚡ Улучшение производительности на 70% (latency ↓)
- 🔒 Полное соответствие российскому законодательству
- 🚀 Масштабируемость до 10,000+ клиентов без деградации
- 💰 Конкурентное преимущество: "Данные в России"

**ROI расчет:**
- Стоимость миграции: ~₽300,000 (разработка + инфраструктура)
- Дополнительные расходы: +₽2,000/месяц (~$25)
- Потенциальный доход от enterprise: +₽500,000/месяц (10 клиентов × ₽50,000)
- **Payback period: 0.6 месяца** 🎯

---

## User Stories (18 штук, 82 SP)

### Sprint M1: Подготовка и инфраструктура (18 SP)

#### US-M01: Setup Yandex Cloud PostgreSQL
**Story Points:** 5
- [ ] Создать аккаунт в Yandex Cloud
- [ ] Настроить Managed PostgreSQL кластер
- [ ] Настроить сеть и security groups
- [ ] Создать database и users

#### US-M02: Setup Supabase локально
**Story Points:** 3
- [ ] Установить Supabase CLI
- [ ] Запустить локально (Docker)
- [ ] Настроить подключение к Yandex PostgreSQL
- [ ] Протестировать базовые операции

#### US-M03: Создать PostgreSQL схему
**Story Points:** 5
- [ ] Спроектировать схему (Firestore → PostgreSQL mapping)
- [ ] Создать таблицы (stores, products, reviews, chats, questions)
- [ ] Настроить индексы
- [ ] Создать миграции (supabase/migrations/)

#### US-M04: Настроить CI/CD для миграций
**Story Points:** 3
- [ ] GitHub Actions для деплоя миграций
- [ ] Staging environment для тестов
- [ ] Rollback механизм

#### US-M05: Backup текущей Firebase базы
**Story Points:** 2
- [ ] Экспорт всех Firestore коллекций
- [ ] Сохранить в GCS + локально
- [ ] Проверить целостность

---

### Sprint M2: Authentication & Edge Functions (14 SP)

#### US-M06: Миграция Firebase Auth → Supabase Auth
**Story Points:** 5
- [ ] Экспорт пользователей из Firebase
- [ ] Импорт в Supabase (с сохранением паролей)
- [ ] Обновить login/signup формы
- [ ] Тестирование аутентификации

#### US-M07: Настроить Row Level Security (RLS)
**Story Points:** 3
- [ ] Создать политики для stores (user_id = auth.uid())
- [ ] RLS для reviews, chats, products
- [ ] Тестирование изоляции данных

#### US-M08: Создать Edge Functions для scheduled tasks
**Story Points:** 5
- [ ] Migрировать Cloud Function → Edge Function (reviews)
- [ ] Edge Function для chats
- [ ] Edge Function для no-reply messages
- [ ] Настроить Cron (Yandex Cloud Scheduler или pg_cron)

#### US-M09: Настроить мониторинг
**Story Points:** 1
- [ ] Yandex Cloud Monitoring дашборд
- [ ] Alerts для ошибок
- [ ] Logs aggregation

---

### Sprint M3: Data Migration (15 SP)

#### US-M10: Миграция stores коллекции
**Story Points:** 3
- [ ] Export Firestore stores → JSON
- [ ] Transform JSON → PostgreSQL INSERT
- [ ] Import в таблицу stores
- [ ] Verify data integrity

#### US-M11: Миграция products и reviews
**Story Points:** 5
- [ ] Export products (1000+ документов)
- [ ] Export reviews (nested subcollection)
- [ ] Transform и import
- [ ] Verify foreign keys

#### US-M12: Миграция chats и questions
**Story Points:** 3
- [ ] Export chats
- [ ] Export questions
- [ ] Import в PostgreSQL
- [ ] Verify counts

#### US-M13: Создать Database Functions
**Story Points:** 3
- [ ] Function: get_store_stats(store_id)
- [ ] Function: get_reviews_aggregation(store_id)
- [ ] Function: bulk_update_tags(chat_ids[], new_tag)
- [ ] Тестирование производительности

#### US-M14: Настроить Triggers
**Story Points:** 1
- [ ] Trigger: auto update updated_at
- [ ] Trigger: denormalize store_name в reviews
- [ ] Audit log trigger (опционально)

---

### Sprint M4: API Migration (18 SP)

#### US-M15: Заменить Firestore queries на Supabase
**Story Points:** 8
- [ ] Заменить все `getFirebaseAdmin().firestore()` вызовы
- [ ] Обновить API routes (13 файлов)
- [ ] Обновить server actions
- [ ] Unit тесты

#### US-M16: Обновить клиентские queries
**Story Points:** 5
- [ ] Заменить Firebase SDK на Supabase client
- [ ] Обновить компоненты (store-list, reviews-sheet, etc)
- [ ] Обновить dashboard queries

#### US-M17: Миграция AI flows
**Story Points:** 3
- [ ] Обновить AI генерацию (Firestore → Supabase)
- [ ] Обновить classification flows
- [ ] Тестирование AI integrations

#### US-M18: API Testing
**Story Points:** 2
- [ ] Integration тесты для всех endpoints
- [ ] Postman collection обновить
- [ ] Swagger docs обновить

---

### Sprint M5: Real-time & Testing (12 SP)

#### US-M19: Заменить useCollection на Realtime
**Story Points:** 5
- [ ] Создать useSupabaseCollection hook
- [ ] Заменить все useCollection вызовы (10+ компонентов)
- [ ] Тестировать real-time updates

#### US-M20: Заменить useDoc на Realtime
**Story Points:** 3
- [ ] Создать useSupabaseDoc hook
- [ ] Заменить useDoc вызовы
- [ ] Тестировать real-time single doc

#### US-M21: Load Testing
**Story Points:** 2
- [ ] k6 скрипты для нагрузочного тестирования
- [ ] Тестировать 1000 concurrent users
- [ ] Оптимизация индексов если нужно

#### US-M22: End-to-End Testing
**Story Points:** 2
- [ ] Playwright тесты для критических флоу
- [ ] Тестировать на staging
- [ ] Regression testing

---

### Sprint M6: Production Cutover (5 SP)

#### US-M23: Parallel Run (Firebase + Supabase)
**Story Points:** 2
- [ ] Dual-write режим (писать в оба)
- [ ] Сравнение результатов (consistency check)
- [ ] Monitoring расхождений

#### US-M24: Production Migration
**Story Points:** 2
- [ ] Freeze Firebase writes
- [ ] Финальная синхронизация данных
- [ ] Switch DNS / environment variables
- [ ] Unfreeze на Supabase

#### US-M25: Post-migration Monitoring
**Story Points:** 1
- [ ] Мониторинг 48 часов 24/7
- [ ] Hotfix готовность
- [ ] Rollback готовность

---

## Technical Implementation

### Architecture Comparison

#### Before (Firebase):
```
Next.js App
  ↓
Firebase SDK (client)
  ↓ HTTPS
Firebase (US/Europe servers)
  ├─ Firestore (NoSQL)
  ├─ Auth
  └─ Cloud Functions

Latency: 150-300ms
Location: США/Европа
Compliance: ❌ Нет 152-ФЗ
```

#### After (Supabase + Yandex):
```
Next.js App
  ↓
Supabase Client SDK
  ↓ HTTPS (низкий latency)
Supabase (Yandex Cloud Moscow)
  ├─ PostgREST (Auto API)
  ├─ GoTrue (Auth)
  ├─ Realtime Server (WebSockets)
  └─ PostgreSQL 15 (Managed)

Latency: 20-50ms
Location: Москва, Россия
Compliance: ✅ 152-ФЗ
```

### Data Model Migration

**Firestore (NoSQL) → PostgreSQL (SQL)**

#### Example: Reviews Collection

**Before (Firestore):**
```
stores/{storeId}/products/{productId}/reviews/{reviewId}
{
  id: "review123",
  text: "Great!",
  rating: 5,
  date: Timestamp,
  storeId: "store1"  // denormalized
}
```

**After (PostgreSQL):**
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  text TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_reviews_store_date ON reviews(store_id, date DESC);
CREATE INDEX idx_reviews_rating ON reviews(store_id, rating, date DESC);
```

### Code Changes Example

#### Before (Firebase):
```typescript
// src/app/api/stores/[storeId]/reviews/route.ts
import { getFirebaseAdmin } from '@/firebase/admin';

export async function GET(request: NextRequest) {
  const firestore = getFirebaseAdmin().firestore();
  const reviewsRef = firestore
    .collection('stores')
    .doc(storeId)
    .collection('products')
    .doc(productId)
    .collection('reviews');

  const snapshot = await reviewsRef
    .where('rating', '==', 5)
    .orderBy('date', 'desc')
    .limit(10)
    .get();

  const reviews = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return NextResponse.json(reviews);
}
```

#### After (Supabase):
```typescript
// src/app/api/stores/[storeId]/reviews/route.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*, product:products(*)')  // JOIN автоматически
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .eq('rating', 5)
    .order('date', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(reviews);
}
```

**Преимущества:**
- ✅ Меньше кода (no manual mapping)
- ✅ Автоматические JOINs
- ✅ Type-safe (если использовать generated types)
- ✅ Быстрее (оптимизированные SQL запросы)

---

## Dependencies

### External Dependencies:
- ✅ Yandex Cloud аккаунт (создать до Sprint M1)
- ✅ Supabase CLI установлен
- ✅ Docker для локальной разработки
- ✅ GitHub Actions для CI/CD

### Internal Dependencies:
- ⚠️ Блокирует: Все новые фичи на Q2 2025 (пока идет миграция)
- ⚠️ Требует: Freeze feature development на 3 недели (Sprint M4-M6)

### Team Dependencies:
- 👨‍💻 1 Full-stack developer (full-time, 12 недель)
- 🧑‍💼 1 Product owner (part-time, 20% времени)
- 🔧 1 DevOps консультант (опционально, 2-3 дня для Yandex Cloud setup)

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **Потеря данных при миграции** | Средняя | 🔴 Критично | - Multiple backups<br>- Dry-run на staging<br>- Verification скрипты |
| **Downtime > 4 часов** | Средняя | 🟡 Высокое | - Parallel run (dual-write)<br>- Rollback plan готов<br>- Migration в ночь/выходные |
| **Performance деградация** | Низкая | 🟡 Высокое | - Load testing до migration<br>- Индексы оптимизированы<br>- Connection pooling |
| **Realtime не работает** | Средняя | 🟡 Высокое | - Тестирование на Sprint M5<br>- Fallback на polling |
| **Budget overrun** | Низкая | 🟢 Среднее | - Yandex Cloud grant ₽3,000<br>- Мониторинг costs weekly |
| **Team задержки** | Средняя | 🟡 Высокое | - Buffer 10% в каждом спринте<br>- Daily standups |
| **Yandex Cloud outage** | Низкая | 🟡 Высокое | - Multi-AZ deployment<br>- Automated failover |
| **Supabase bugs** | Средняя | 🟢 Среднее | - Use stable version<br>- Community support |

### Critical Risk: Data Integrity

**План проверки целостности данных:**

```sql
-- Verification queries после миграции
-- 1. Counts match
SELECT 'stores' AS table_name, COUNT(*) FROM stores
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'reviews', COUNT(*) FROM reviews;

-- Firebase counts для сравнения:
-- stores: 4
-- products: ~1000
-- reviews: ~1500

-- 2. Spot check random records
SELECT * FROM reviews ORDER BY RANDOM() LIMIT 10;

-- 3. Check foreign keys
SELECT COUNT(*) FROM reviews r
LEFT JOIN products p ON r.product_id = p.id
WHERE p.id IS NULL;  -- Should be 0

-- 4. Check duplicates
SELECT id, COUNT(*) FROM reviews GROUP BY id HAVING COUNT(*) > 1;
```

---

## Rollback Plan

### Когда откатываться:

- 🚨 Потеря > 1% данных
- 🚨 Downtime > 6 часов
- 🚨 Critical bugs не исправляются за 2 часа
- 🚨 Performance деградация > 50%

### Шаги отката:

#### 1. Immediate Rollback (< 30 минут)
```bash
# 1. Switch environment variables обратно на Firebase
export NEXT_PUBLIC_FIREBASE_API_KEY="..."
export USE_SUPABASE=false

# 2. Redeploy на Vercel
vercel --prod

# 3. Verify Firebase still working
curl https://wb-reputation.com/api/stores
```

#### 2. Data Sync (если были новые данные)
```bash
# Синхронизировать данные созданные на Supabase обратно в Firebase
node scripts/sync-supabase-to-firebase.js --since "2025-03-01T00:00:00Z"
```

#### 3. Communication
- [ ] Уведомить пользователей
- [ ] Post-mortem документ
- [ ] Plan для retry миграции

**Время rollback:** < 1 час

---

## Testing Strategy

### Unit Tests
- [ ] PostgreSQL schema валидация
- [ ] Supabase client wrapper тесты
- [ ] RLS policies тесты

### Integration Tests
- [ ] API endpoints (13 routes)
- [ ] Auth flow
- [ ] Real-time subscriptions

### E2E Tests (Playwright)
- [ ] Login → Dashboard → Reviews
- [ ] Create store → Add product → Sync reviews
- [ ] AI generation flow

### Load Testing (k6)
```javascript
// load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // ramp up
    { duration: '5m', target: 100 },   // stay
    { duration: '2m', target: 0 },     // ramp down
  ],
};

export default function () {
  let res = http.get('https://wb-reputation.com/api/stores');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
}
```

**Target:**
- ✅ 100 concurrent users
- ✅ 95th percentile < 100ms
- ✅ Error rate < 0.1%

---

## Rollout Plan

### Phase 1: Preparation (Week 1-2) - Sprint M1
- [ ] Setup Yandex Cloud
- [ ] Setup Supabase locally
- [ ] Create PostgreSQL schema
- [ ] Backup Firebase

### Phase 2: Development (Week 3-8) - Sprints M2-M4
- [ ] Migrate Auth
- [ ] Migrate Data
- [ ] Migrate API
- [ ] Parallel development on staging

### Phase 3: Testing (Week 9-10) - Sprint M5
- [ ] Load testing
- [ ] E2E testing
- [ ] User acceptance testing (UAT)

### Phase 4: Production Cutover (Week 11-12) - Sprint M6
- [ ] Parallel run (dual-write) 3 дня
- [ ] Final sync
- [ ] **CUTOVER (Friday night, 22:00 MSK)**
- [ ] Monitoring 48h

### Phase 5: Post-migration (Week 13)
- [ ] Stabilization
- [ ] Performance tuning
- [ ] Decommission Firebase (save costs)

---

## Communication Plan

### Stakeholders:

#### Internal:
- **Developer:** Daily updates, blockers
- **Product Owner:** Weekly status report
- **Management:** Bi-weekly (before/after Sprint)

#### External:
- **Users (4 магазина):**
  - 2 недели до cutover: Email announcement
  - 1 неделя до: Reminder + FAQ
  - День cutover: Status page updates
  - После: Success announcement

#### Template Email (за 2 недели):
```
Тема: Важное обновление: Переход на российские серверы

Уважаемые клиенты WB Reputation Manager!

С 1 марта мы переносим все данные на российские серверы (Yandex Cloud).

Что изменится:
✅ Ваши данные будут храниться в России (соответствие 152-ФЗ)
✅ Скорость работы увеличится в 3 раза
✅ Все ваши данные и настройки сохранятся

Что нужно сделать вам:
❌ Ничего! Миграция произойдет автоматически.

Downtime: < 2 часа (ночью, 1 марта, 22:00-00:00 МСК)

FAQ: https://wb-reputation.com/migration-faq

С уважением,
Команда WB Reputation Manager
```

---

## Success Metrics - Detailed

### Technical Metrics

| Метрика | Baseline (Firebase) | Target (Supabase) | Измерение |
|---------|---------------------|-------------------|-----------|
| API Response Time (p50) | 200ms | < 50ms | Yandex Monitoring |
| API Response Time (p95) | 500ms | < 100ms | Yandex Monitoring |
| Database Query Time | 100ms | < 20ms | PostgreSQL logs |
| Realtime Latency | 300ms | < 100ms | Client metrics |
| Error Rate | 0.1% | < 0.05% | Sentry |
| Uptime | 99.5% | 99.9% | Yandex Monitoring |

### Business Metrics

| Метрика | Baseline | Target (3 months) | Измерение |
|---------|----------|-------------------|-----------|
| Enterprise клиенты | 0 | 5+ | CRM |
| Churn rate | 5% | < 3% | Analytics |
| NPS | 40 | 50+ | Surveys |
| Customer support tickets | 10/неделя | < 8/неделя | Zendesk |

### Cost Metrics

| Метрика | Firebase | Supabase + Yandex |
|---------|----------|-------------------|
| Monthly cost (сейчас) | $60 | $98 |
| Monthly cost (1000 users) | $500+ | $150-200 |
| **Savings at scale** | - | **60%+** |

---

## Post-Migration Optimization (Q3 2025)

После успешной миграции, дополнительные улучшения:

### 1. Advanced RLS для multi-tenancy
- Tenant isolation
- Role-based access (admin, manager, viewer)

### 2. Database Functions для аналитики
```sql
CREATE FUNCTION get_store_performance(store_id UUID, period INTERVAL)
RETURNS JSON AS $$
  -- Complex analytics query
$$ LANGUAGE sql;
```

### 3. Materialized Views для дашбордов
```sql
CREATE MATERIALIZED VIEW store_stats AS
SELECT
  store_id,
  COUNT(*) as total_reviews,
  AVG(rating) as avg_rating,
  COUNT(CASE WHEN answered THEN 1 END) as answered_count
FROM reviews
GROUP BY store_id;

-- Refresh every hour
CREATE UNIQUE INDEX ON store_stats(store_id);
REFRESH MATERIALIZED VIEW CONCURRENTLY store_stats;
```

### 4. Full-Text Search
```sql
-- Поиск по отзывам
CREATE INDEX idx_reviews_search ON reviews
USING gin(to_tsvector('russian', text));

SELECT * FROM reviews
WHERE to_tsvector('russian', text) @@ to_tsquery('russian', 'отличный & товар');
```

### 5. Partitioning для масштабирования
```sql
-- Партиционирование по месяцам
CREATE TABLE reviews_2025_01 PARTITION OF reviews
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

## Related Documents

- [OWNER-PREP-CHECKLIST.md](./OWNER-PREP-CHECKLIST.md) - Ваши задачи перед миграцией ⭐
- [SUPABASE-ADVANCED-FEATURES.md](./SUPABASE-ADVANCED-FEATURES.md) - Продвинутые фишки
- [TECHNICAL-ARCHITECTURE.md](./TECHNICAL-ARCHITECTURE.md) - Детальная архитектура
- [DATA-MIGRATION-GUIDE.md](./DATA-MIGRATION-GUIDE.md) - Скрипты миграции
- [ROLLBACK-PLAN.md](./ROLLBACK-PLAN.md) - План отката

**Sprint Planning:**
- [Sprint M1 Planning](./sprints/sprint-M1-planning.md)
- [Sprint M2 Planning](./sprints/sprint-M2-planning.md)
- [Sprint M3 Planning](./sprints/sprint-M3-planning.md)
- [Sprint M4 Planning](./sprints/sprint-M4-planning.md)
- [Sprint M5 Planning](./sprints/sprint-M5-planning.md)
- [Sprint M6 Planning](./sprints/sprint-M6-planning.md)

---

## Timeline

```
Week 1-2:   Sprint M1  [Подготовка]
Week 3-4:   Sprint M2  [Auth + Edge Functions]
Week 5-6:   Sprint M3  [Data Migration]
Week 7-8:   Sprint M4  [API Migration]
Week 9-10:  Sprint M5  [Real-time + Testing]
Week 11-12: Sprint M6  [Production Cutover]
───────────────────────────────────────────────
Total: 12 недель (3 месяца)
Start: 1 апреля 2025
End:   15 июня 2025
```

---

## Next Steps

### Сразу после одобрения Epic:

1. **Владелец проекта:**
   - [ ] Прочитать [OWNER-PREP-CHECKLIST.md](./OWNER-PREP-CHECKLIST.md)
   - [ ] Зарегистрироваться в Yandex Cloud (получить грант ₽3,000)
   - [ ] Создать backup Firebase (на всякий случай)

2. **Разработчик:**
   - [ ] Установить Supabase CLI
   - [ ] Изучить [SUPABASE-ADVANCED-FEATURES.md](./SUPABASE-ADVANCED-FEATURES.md)
   - [ ] Начать Sprint M1 Planning

3. **Команда:**
   - [ ] Sprint Planning для Sprint M1 (2 апреля)
   - [ ] Создать Telegram канал для migration updates
   - [ ] Setup project tracking (GitHub Project Board)

---

**Created:** 30 декабря 2024
**Last Updated:** 30 декабря 2024
**Status:** 📋 Awaiting Approval
**Next Review:** После одобрения → Sprint M1 Planning
**Priority:** P1 (High - Compliance Required)

---

**Вопросы или комментарии?**

Откройте issue в GitHub или напишите в Telegram: [@your_handle]
