# WB Reputation Manager | Supabase + Yandex Cloud

**Новый проект на Supabase** для миграции с Firebase.

**Статус:** 🚧 В разработке (Sprint M1)
**Дата начала:** 30 декабря 2024

---

## 📁 Структура проекта

```
wb-reputation-supabase/
├── README.md                           # Этот файл
├── YANDEX_POSTGRESQL_SETUP.md          # Инструкция по созданию PostgreSQL
├── .env.local                          # Credentials (НЕ КОММИТИТЬ!)
├── .env.example                        # Пример env variables
├── .gitignore                          # Git ignore файл
├── supabase/
│   ├── config.toml                     # Supabase конфигурация
│   ├── seed.sql                        # Тестовые данные
│   └── migrations/                     # SQL миграции
│       ├── 00000000000000_init.sql     # Начальная миграция
│       ├── 20250101000000_create_stores.sql
│       ├── 20250102000000_create_products.sql
│       ├── 20250103000000_create_reviews.sql
│       └── ...
├── scripts/
│   ├── backup-firebase.sh              # Backup старой Firebase БД
│   ├── migrate-data.ts                 # Firestore → PostgreSQL migration
│   └── verify-integrity.ts             # Проверка целостности данных
└── docs/
    ├── architecture.md                 # Архитектура нового проекта
    ├── migration-plan.md               # План миграции
    └── api-changes.md                  # Изменения в API
```

---

## 🚀 Quick Start

### Prerequisite:

1. **Node.js 18+** установлен
2. **Docker Desktop** установлен и запущен
3. **Supabase CLI** установлен глобально:
   ```bash
   npm install -g supabase
   ```
4. **Yandex Cloud PostgreSQL** кластер создан (см. [YANDEX_POSTGRESQL_SETUP.md](./YANDEX_POSTGRESQL_SETUP.md))

---

### Шаг 1: Clone и setup

```bash
# Перейти в папку проекта
cd c:/Users/79025/Desktop/проекты/R5/wb-reputation-supabase

# Установить зависимости (когда будут)
npm install

# Создать .env.local из примера
cp .env.example .env.local

# Отредактировать .env.local (добавить свои credentials)
```

---

### Шаг 2: Запустить Supabase локально

```bash
# Запустить локальный Supabase (первый раз скачает Docker images ~2GB)
supabase start

# Дождаться запуска (3-5 минут)
# В конце увидите:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Открыть Supabase Studio:**
```bash
# Откроется в браузере
open http://localhost:54323
```

---

### Шаг 3: Применить миграции

```bash
# Применить все миграции к локальной БД
supabase db reset

# Или применить только новые миграции
supabase migration up
```

---

### Шаг 4: Подключиться к Yandex Cloud PostgreSQL (production)

```bash
# Отредактировать supabase/config.toml
# Раскомментировать секцию [db] и указать Yandex Cloud URL

# Применить миграции к production БД
supabase db push
```

---

## 📊 Sprint M1 Progress

**Цель Sprint M1:** Настроить инфраструктуру и создать схему БД

### Tasks:

- [x] ✅ TASK-M01: Создать Yandex Cloud PostgreSQL кластер
- [ ] 🚧 TASK-M02: Инициализировать Supabase проект
- [ ] ⏳ TASK-M03: Создать базовую схему (stores, products, reviews)
- [ ] ⏳ TASK-M04: Настроить миграции
- [ ] ⏳ TASK-M05: Backup Firebase

**Progress:** 1/5 tasks (20%)

---

## 🔧 Available Commands

```bash
# Supabase
supabase start              # Запустить локально
supabase stop               # Остановить
supabase status             # Проверить статус
supabase db reset           # Пересоздать БД (reset + all migrations)
supabase migration new <name>  # Создать новую миграцию
supabase db push            # Применить миграции к production

# Database
psql "postgresql://..."     # Подключиться к PostgreSQL
npm run db:migrate          # Применить миграции (когда настроим)
npm run db:seed             # Заполнить тестовыми данными
npm run db:backup           # Создать backup

# Development (будет позже)
npm run dev                 # Запустить Next.js dev server
npm run build               # Build production
npm run test                # Запустить тесты
```

---

## 🗄️ Database Schema

### Основные таблицы:

```sql
-- Пользователи (из Supabase Auth)
auth.users
  ├── id (UUID)
  ├── email
  ├── created_at
  └── ...

-- Магазины
public.stores
  ├── id (UUID)
  ├── user_id (UUID) → auth.users.id
  ├── name (TEXT)
  ├── wb_api_key (TEXT, encrypted)
  ├── created_at (TIMESTAMPTZ)
  └── updated_at (TIMESTAMPTZ)

-- Товары
public.products
  ├── id (UUID)
  ├── store_id (UUID) → stores.id
  ├── wb_product_id (TEXT)
  ├── name (TEXT)
  ├── sku (TEXT)
  └── ...

-- Отзывы
public.reviews
  ├── id (UUID)
  ├── store_id (UUID) → stores.id
  ├── product_id (UUID) → products.id
  ├── wb_review_id (TEXT)
  ├── text (TEXT)
  ├── rating (INTEGER 1-5)
  ├── answered (BOOLEAN)
  ├── created_at (TIMESTAMPTZ)
  └── ...
```

**Полная схема:** См. [supabase/migrations/](./supabase/migrations/)

---

## 🔐 Environment Variables

### `.env.local` (локальная разработка):

```bash
# Yandex Cloud PostgreSQL (Production)
DATABASE_URL="postgresql://admin:PASSWORD@c-xxx.rw.mdb.yandexcloud.net:6432/wb_reputation?sslmode=verify-full"

# Supabase (Local)
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Wildberries API (копируем из старого проекта)
WB_API_KEY="..."

# Deepseek AI (копируем из старого проекта)
DEEPSEEK_API_KEY="..."
```

**⚠️ НИКОГДА не коммитить `.env.local` в Git!**

---

## 📚 Documentation

### Supabase:
- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL 15 Docs](https://www.postgresql.org/docs/15/)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Yandex Cloud:
- [Managed PostgreSQL Docs](https://cloud.yandex.ru/docs/managed-postgresql/)
- [Getting Started](https://cloud.yandex.ru/docs/managed-postgresql/quickstart)

### Migration:
- [EPIC-019: Migration Plan](../Pilot-entry/wb-reputation/product-management/migrations/MIGRATION-001-supabase-yandex/EPIC-019-russian-tech-migration.md)
- [Sprint M1 Planning](../Pilot-entry/wb-reputation/product-management/migrations/MIGRATION-001-supabase-yandex/sprints/sprint-M1-planning.md)

---

## 🐛 Troubleshooting

### Supabase не запускается:

```bash
# Проверить Docker запущен
docker ps

# Остановить и очистить
supabase stop
docker system prune -a

# Перезапустить
supabase start
```

### Не могу подключиться к Yandex PostgreSQL:

См. [YANDEX_POSTGRESQL_SETUP.md - Troubleshooting](./YANDEX_POSTGRESQL_SETUP.md#troubleshooting)

---

## 🤝 Contributing

Этот проект в активной разработке. Пока коммитим только в feature branches.

**Workflow:**
1. Создать branch от `main`: `git checkout -b feature/task-m02`
2. Сделать изменения
3. Commit: `git commit -m "feat: add stores migration"`
4. Push: `git push origin feature/task-m02`
5. Создать PR для review

---

## 📞 Support

**Вопросы по миграции:**
- Telegram: Migration Channel
- GitHub Issues: тег `migration`

**Вопросы по Yandex Cloud:**
- Email: support@cloud.yandex.ru

---

## 📅 Timeline

| Sprint | Даты | Статус |
|--------|------|--------|
| Sprint M1 | 7-20 апреля | 🚧 In Progress |
| Sprint M2 | 21 апр - 4 мая | ⏳ Pending |
| Sprint M3 | 5-18 мая | ⏳ Pending |
| Sprint M4 | 19 мая - 1 июня | ⏳ Pending |
| Sprint M5 | 2-15 июня | ⏳ Pending |
| Sprint M6 | 16-29 июня | ⏳ Pending |
| **Production Cutover** | **28 июня, 22:00** | 🎯 Target |

---

---

## 🎉 Недавние обновления

### 2026-01-06: Реализована функция "Правила работы"
✅ **Завершена полная реализация вкладки "Правила работы"**

**Что добавлено:**
- 📊 База данных: таблица `product_rules` с 17 полями
- 🔧 5 новых функций в `db/helpers.ts` для работы с правилами
- 🌐 REST API: GET и POST endpoints для загрузки/сохранения правил
- 🎨 UI в стиле прототипа с поиском, фильтрами, 17-колоночной таблицей
- ⚙️ Настройка автоматизации для каждого товара:
  - Подача жалоб на отзывы (1-4 звезды)
  - Работа в чатах (1-4 звезды)
  - Компенсация покупателям (тип, сумма, ответственный)

**Технические детали:**
- PostgreSQL миграция с индексами и внешними ключами
- UPSERT логика для сохранения правил
- Disabled states для зависимых полей
- Реактивный поиск и фильтрация
- Toast уведомления

**Документация:** [docs/changes/2026-01-06_product-rules-implementation.md](./docs/changes/2026-01-06_product-rules-implementation.md)

---

**Last Updated:** 6 января 2026
**Next Review:** После завершения Sprint 4
