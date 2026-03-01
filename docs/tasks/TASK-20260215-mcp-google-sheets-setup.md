# TASK-20260215: Настройка MCP сервера для Google Sheets/Drive

## Goal

Настроить MCP (Model Context Protocol) сервер, чтобы Claude Code имел **прямой нативный доступ** к Google Sheets и Google Drive без необходимости писать одноразовые скрипты.

## Current State

- Сервисный аккаунт `r5-automation@r5-wb-bot.iam.gserviceaccount.com` уже настроен
- Приватный ключ хранится в `.env.local` (`GOOGLE_PRIVATE_KEY`)
- Существует клиент `src/services/google-sheets-sync/sheets-client.ts` с функциями:
  - `readSheetData()` — чтение данных
  - `clearAndWriteRows()` — полная перезапись листа
  - `batchUpdateRows()` — обновление строк
  - `appendRows()` — добавление строк
  - `listFilesInFolder()` — листинг файлов Drive
  - `createFolder()`, `copyFile()` — операции с Drive
- Используются таблицы:
  - `1-mxbnv0qkicJMVUCtqDGJH82FhLlDKDvICb-PAVbxfI` — основная (руководитель)
  - `1Cg-vl5-aKrM95FihQi0_C2OJRVwR_vtLcPzcDkKWrC8` — сотрудники
  - `1eqZCwzEnSS3uKc-NN-LK0dztcUARLO4YcbltQMPEj3A` — Complaints
- Текущий подход: для разовых запросов — standalone `.mjs` скрипты, для автоматизации — вызовы из Next.js API/cron

## Problem

Claude Code не может напрямую читать/писать Google Sheets. Каждый раз нужно:
1. Написать standalone скрипт
2. Запустить через Bash
3. Прочитать вывод

Это медленно и неудобно для итеративной аналитической работы.

## Proposed Change

### Вариант A: Готовый MCP сервер (Recommended)

Использовать существующий open-source MCP сервер для Google Sheets.

**Кандидаты:**
- `@anthropic/mcp-google-sheets` — официальный (если существует)
- `mcp-server-google-sheets` — community
- Написать свой минимальный MCP сервер на основе `sheets-client.ts`

**Конфигурация Claude Code** (`.claude/mcp.json`):
```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "node",
      "args": ["./mcp-servers/google-sheets-server.mjs"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_EMAIL": "${GOOGLE_SERVICE_ACCOUNT_EMAIL}",
        "GOOGLE_PRIVATE_KEY": "${GOOGLE_PRIVATE_KEY}"
      }
    }
  }
}
```

### Вариант B: Свой MCP сервер

Написать MCP сервер на базе `@modelcontextprotocol/sdk`, который:
- Переиспользует логику из `sheets-client.ts`
- Предоставляет tools: `read_sheet`, `write_sheet`, `list_files`, `append_rows`
- Авторизуется через тот же сервисный аккаунт

**Плюсы:** полный контроль, точная интеграция с проектом
**Минусы:** нужно написать и поддерживать код

## Impact

### DB
Нет изменений

### API
Нет изменений

### Cron
Нет изменений

### AI
Нет изменений

### UI
Нет изменений

### DevX (Claude Code)
- Claude Code получает нативные tools для Google Sheets/Drive
- Итеративная аналитика становится возможной без скриптов
- Удобно для задач типа "прочитай таблицу, проанализируй, запиши результат"

## Required Docs Updates

- `docs/reference/ARCHITECTURE.md` — добавить секцию MCP servers
- `CLAUDE.md` — упомянуть доступные MCP tools

## Rollout Plan

1. Исследовать существующие MCP серверы для Google Sheets
2. Выбрать подход (A или B)
3. Настроить `.claude/mcp.json`
4. Протестировать чтение/запись
5. Задокументировать

## Backout Plan

Удалить конфигурацию из `.claude/mcp.json`. Откатиться к standalone скриптам — они продолжат работать.

## Priority

Low — улучшение DevX, не блокирует продуктовую разработку.

## Estimated Effort

- Вариант A: 1-2 часа (поиск + настройка)
- Вариант B: 3-4 часа (написание MCP сервера)
