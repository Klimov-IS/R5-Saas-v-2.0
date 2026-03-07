# Google Sheets Sync

**Last Updated:** 2026-03-06
**Status:** Current
**Source of Truth:** This document

---

## Overview

Two sync services export data to Google Sheets:
1. **Product Rules** — full sync (clear + write), daily 6:00 MSK
2. **Client Directory** — upsert (update + append), daily 7:30 MSK

---

## Architecture

```
src/services/google-sheets-sync/
├── sheets-client.ts              # Google API client (JWT auth, retry)
├── sync-service.ts               # Product Rules sync
├── row-formatter.ts              # Column mapping (22 cols)
├── client-directory/
│   ├── sync-service.ts           # Client Directory sync
│   ├── row-formatter.ts          # Column mapping (13 cols)
│   └── drive-matcher.ts          # Fuzzy folder name matching
└── index.ts                      # Exports

src/services/store-onboarding/
├── onboarding-service.ts         # Drive folder + template creation
└── index.ts
```

---

## Auth & Client

**Method:** Service account JWT (RS256), 1h expiry, cached for 50 min

**Retry:** `withRetry()` — 3 attempts, exponential backoff (1s, 2s, 4s). Skips 4xx (except 429).

**Scopes:** `sheets.googleapis.com` (read/write) + `drive` (folder/file ops)

---

## Product Rules Sync

**Schedule:** `0 3 * * *` (6:00 MSK daily)
**Method:** Clear entire sheet, write headers + all rows
**Sheet name:** "Артикулы ТЗ" (default)

### Columns (22: A-V)

| Col | Header | Source |
|-----|--------|--------|
| A | Магазин | Store name |
| B | Артикул WB | `product.wb_product_id` |
| C | Название товара | `product.name` |
| D | Статус товара | work_status (✅/⏸️/✔️/⏹️) |
| E-I | Жалобы + ⭐1-4 | `submit_complaints`, `complaint_rating_1-4` |
| J-N | Чаты + ⭐1-4 | `work_in_chats`, `chat_rating_1-4` |
| O | Стратегия | `upgrade_to_5`/`delete`/`both` |
| P-S | Компенсация | `offer_compensation`, type, max, payer |
| T | Обновлено | Datetime |
| U | Работаем от | `work_from_date` (DD.MM.YYYY) |
| V | Комментарий | `product_rules.comment` |

### Secondary Sheets

Same data written to additional sheets via:
```
GOOGLE_SHEETS_SECONDARY_SPREADSHEET_ID=<id>
GOOGLE_SHEETS_SECONDARY_SHEETS=Лист1,Лист2,Лист3
```

---

## Client Directory Sync

**Schedule:** `30 4 * * *` (7:30 MSK daily)
**Method:** Upsert — read existing, batch update + append new
**Sheet name:** "Список клиентов"

### Columns (13: A-M)

| Col | Header | Notes |
|-----|--------|-------|
| A | ID магазина | Store UUID |
| B | Название | Store name |
| C | ИНН | **Preserved manually** — never overwritten |
| D | Дата подключения | DD.MM.YYYY |
| E | Статус | Активен/Неактивен/etc |
| F-I | API tokens | ✅/❌ for main/content/feedbacks/chat |
| J | Папка клиента | Drive folder link |
| K | Отчёт | Report spreadsheet link |
| L | Скриншоты | Screenshots folder link |
| M | Обновлено | DD.MM.YYYY HH:MM |

### Drive Folder Matching

Three-tier fuzzy matching: exact → substring → word-based (>60% match). Normalization strips legal forms (ООО, ИП, etc.), quotes, and whitespace.

---

## Store Onboarding

**Trigger:** Async on new store creation (`triggerStoreOnboarding()`)

**Steps:**
1. Check existing folder (idempotent)
2. Create client folder under `GOOGLE_DRIVE_CLIENTS_FOLDER_ID`
3. Copy report template from `GOOGLE_DRIVE_REPORT_TEMPLATE_ID`
4. Create "Скриншоты" subfolder
5. Trigger client directory sync

---

## Debounce

**`triggerAsyncSync()`** — 5-second debounce timer

- Coalesces rapid product rule changes into single sync
- If sync running: schedules one re-sync after completion
- Non-blocking (background execution)

---

## Environment Variables

**Required:**
```
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
```

**Optional:**
```
GOOGLE_SHEETS_SHEET_NAME=Артикулы ТЗ
GOOGLE_SHEETS_SECONDARY_SPREADSHEET_ID
GOOGLE_SHEETS_SECONDARY_SHEETS=Лист1,Лист2
GOOGLE_DRIVE_CLIENTS_FOLDER_ID=1GelGC6stQVoc5OaJuachXNZtuJvOevyK
GOOGLE_DRIVE_REPORT_TEMPLATE_ID=1YCH-OOh...
```

---

## See Also

- [CRON_JOBS.md](../CRON_JOBS.md) — Cron schedule
- [database-schema.md](../database-schema.md) — product_rules schema

---

**Last Updated:** 2026-03-06
