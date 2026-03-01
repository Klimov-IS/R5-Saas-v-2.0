# TASK-20260225: Миграция PostgreSQL из Yandex Managed в Docker

**Created:** 2026-02-25
**Priority:** Medium
**Status:** Backlog (планирование)

---

## Goal

Перенести PostgreSQL из Yandex Managed PostgreSQL в Docker-контейнер на той же VM. Снизить стоимость (~4 587₽/мес → 0₽) и устранить vendor lock-in.

## Current State

- **Yandex Managed PostgreSQL 15** — кластер `wb-reputation-prod-db`
- Стоимость: **4 586,89 ₽/мес** (compute 2577₽ + RAM 1391₽ + storage 429₽ + IP 190₽)
- Host: c3-c2-m4 (2 vCPU, 4 GB RAM)
- Storage: 30 GB network-ssd
- Бэкапы: встроенные, 7 дней retention
- Нет HA-реплик (single node)
- Защита от удаления: НЕТ
- **Инцидент 2026-02-25:** Неоплата → всё остановлено, публичный IP потерян

## Proposed Change

### Архитектура

```
Текущая:  VM → Network → Yandex Managed PG (отдельный хост)
Целевая:  VM → Docker → PostgreSQL 15 (localhost)
```

### Преимущества
- **Экономия ~4 500₽/мес** (55 000₽/год)
- Нет vendor lock-in — БД живёт на VM
- Быстрее (localhost vs network round-trip)
- Полный контроль над конфигурацией
- Портативность: `docker-compose up` на любом сервере

### Риски
- Бэкапы — нужно настроить самим (pg_dump cron)
- Обновления PostgreSQL — самим (docker pull)
- Мониторинг — самим (но для single-node достаточно простых проверок)
- При сбое VM — теряется и БД (но сейчас то же самое: single node, нет HA)

### Требования к VM
- Текущая VM: 2 vCPU, 4 GB RAM, 20 GB SSD
- PostgreSQL в Docker потребует: ~0.5-1 GB RAM, ~15 GB disk
- **Нужно увеличить диск** до 40 GB (данные БД + бэкапы)
- RAM: 4 GB хватит (Next.js ~1.5GB + PG ~1GB + система)

## Implementation Plan

### Подготовка (до миграции)
1. Увеличить диск VM до 40 GB
2. Установить Docker + docker-compose на VM
3. Настроить pg_dump из Managed PG (задача TASK-20260225-pg-dump-external-backup)
4. Проверить полный бэкап + тестовый restore

### Миграция (maintenance window, ~30 мин)
1. Остановить PM2 (`pm2 stop all`)
2. `pg_dump` полный бэкап из Managed PG
3. Запустить PostgreSQL в Docker:
   ```yaml
   # docker-compose.yml
   services:
     postgres:
       image: postgres:15
       restart: always
       ports:
         - "127.0.0.1:5432:5432"
       environment:
         POSTGRES_DB: wb_reputation
         POSTGRES_USER: admin_R5
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
       volumes:
         - pgdata:/var/lib/postgresql/data
       deploy:
         resources:
           limits:
             memory: 1G
   volumes:
     pgdata:
   ```
4. `pg_restore` в Docker PostgreSQL
5. Обновить `.env.production`:
   ```
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   ```
6. Запустить PM2 (`pm2 start all`)
7. Проверить все endpoints
8. Удалить SSL параметры из DB connection (localhost не нужен SSL)

### После миграции
1. Настроить pg_dump cron (ежедневно → внешний S3)
2. Остановить / удалить Managed PG кластер
3. Обновить документацию

## Impact

- **DB:** Меняется хост подключения (managed → localhost)
- **API:** Без изменений (только env vars)
- **Cron:** Без изменений
- **AI:** Без изменений
- **UI:** Без изменений
- **Стоимость:** -4 587₽/мес

## Required Docs Updates

- `DEPLOYMENT.md` — новая секция Docker PostgreSQL, удалить Managed PG
- `database-schema.md` — обновить connection info
- `CRON_JOBS.md` — добавить pg_dump job

## Rollout Plan

1. **Неделя 1:** Настроить pg_dump (TASK-20260225-pg-dump-external-backup)
2. **Неделя 2:** Установить Docker, протестировать restore в Docker PG
3. **Неделя 3:** Миграция в maintenance window (ночь/выходные)
4. **Неделя 4:** Мониторинг, удаление Managed PG

## Backout Plan

- `.env.production` → вернуть `POSTGRES_HOST` на managed хост
- `pm2 restart all`
- Managed PG не удалять до полной стабилизации (минимум 1 неделя)

## Dependencies

- TASK-20260225-pg-dump-external-backup должна быть готова ДО миграции
- Нужно увеличить диск VM (Yandex Cloud Console)

## Решение о статическом IP

При миграции также рекомендуется:
- Зарезервировать **статический публичный IP** для VM
- Текущий тип: Динамический (теряется при остановке)
- Стоимость статического IP: ~100₽/мес
