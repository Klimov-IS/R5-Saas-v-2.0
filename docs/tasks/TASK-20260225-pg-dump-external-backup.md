# TASK-20260225: Ежедневный pg_dump на внешнее хранилище

**Created:** 2026-02-25
**Priority:** High
**Status:** Backlog

---

## Goal

Настроить автоматический ежедневный бэкап PostgreSQL (pg_dump) на внешнее хранилище, независимое от Yandex Cloud. Устранить single point of failure — сейчас все данные хранятся только в Yandex Managed PostgreSQL.

## Current State

- БД: Yandex Managed PostgreSQL 15 (`wb-reputation-prod-db`)
- Встроенные бэкапы Яндекса: 22:00-23:00 UTC, retention 7 дней
- **Проблема:** При неоплате Яндекса доступ к бэкапам тоже теряется
- **Инцидент 2026-02-25:** Забыли оплатить → VM остановлена, БД остановлена, IP потерян
- Защита от удаления на кластере: **НЕТ** (критически важно включить)

## Proposed Change

### Вариант A: pg_dump → Yandex Object Storage (S3-compatible)
- Cron на VM: `0 3 * * *` (ежедневно в 03:00 UTC)
- `pg_dump` → gzip → upload via `aws s3 cp` (s3cmd)
- Retention: 30 дней (lifecycle policy)
- **Минус:** Всё ещё в Яндексе

### Вариант B: pg_dump → External S3 (Selectel / Mail.ru / AWS) — Рекомендуется
- Тот же cron, но upload на внешний S3
- Полная независимость от Яндекса
- **Стоимость:** ~100-300₽/мес за хранилище

### Вариант C: pg_dump → rsync на отдельный VPS
- Самый надёжный, но требует второй сервер

## Impact

- **DB:** Только чтение (pg_dump не блокирует)
- **API:** Без изменений
- **Cron:** Новый cron job на уровне системы (не PM2)
- **AI:** Без изменений
- **UI:** Без изменений

## Implementation Plan

1. Установить `postgresql-client-15` на VM (для pg_dump)
2. Создать скрипт `scripts/backup-database.sh`
3. Настроить cron: `0 3 * * * /var/www/wb-reputation/scripts/backup-database.sh`
4. Настроить S3 credentials
5. Добавить мониторинг (проверка возраста последнего бэкапа)
6. Тестовый restore из бэкапа

## Required Docs Updates

- `DEPLOYMENT.md` — секция Backup & Recovery
- `CRON_JOBS.md` — новый системный cron job

## Rollout Plan

1. Выбрать внешнее хранилище
2. Реализовать и протестировать скрипт
3. Запустить в cron
4. Проверить первый бэкап + тестовый restore

## Backout Plan

- Удалить cron entry
- Бэкап — read-only операция, откат не требуется

## Дополнительно

- **Сразу включить "Защита от удаления"** на кластере БД в Яндексе
- Рассмотреть **статический IP** для VM (чтобы IP не терялся при остановке)
