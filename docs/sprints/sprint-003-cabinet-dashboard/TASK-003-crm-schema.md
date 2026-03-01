# TASK-003: CRM — Schema + API (контакты, ссылки, заметки, статус чатов)

> **Статус:** Planning
> **Приоритет:** P1
> **Фаза:** Phase 2
> **Sprint:** 003
> **Зависимость:** Phase 1 (TASK-001, TASK-002)

---

## Goal

Добавить CRM-функционал в кабинет: реквизиты компании, контакты, Google Drive ссылки, заметки менеджера, статус работы в чатах.

## Scope

### Migration 018

**Новые поля в `stores`:**
- `company_name` TEXT
- `inn` TEXT
- `ogrn` TEXT
- `contact_name` TEXT
- `contact_email` TEXT
- `contact_phone` TEXT
- `r5_manager` TEXT
- `internal_notes` TEXT
- `chats_agreed` BOOLEAN DEFAULT FALSE
- `chats_work_status` TEXT DEFAULT 'not_started' — not_started | active | paused | stopped
- `wb_chat_option` TEXT DEFAULT 'unknown' — enabled | disabled | unknown

**Новая таблица `store_links`:**
- id, store_id, title, url, link_type, description, sort_order, timestamps
- link_type: google_sheets | google_docs | google_drive | document | custom

### API endpoints

```
GET/PUT  /api/stores/[storeId]/details      — реквизиты + контакты
GET/PUT  /api/stores/[storeId]/notes        — заметки
GET/PUT  /api/stores/[storeId]/chat-config  — статус чатов
CRUD     /api/stores/[storeId]/links        — ссылки
```

### DB helpers
- `src/db/crm-helpers.ts` — CRUD для всех новых сущностей

## Impact
- **DB:** Migration 018 (ALTER TABLE + CREATE TABLE)
- **API:** 4 новых endpoint группы
- **UI:** TASK-004

## Estimated Effort
- ~4-5 часов (миграция + API + helpers)
