# Cleanup Archive - 2026-01-24

## Описание
Архив устаревших файлов, перемещенных из корня проекта для улучшения структуры.

## Дата архивации
2026-01-24

## Причина
Очистка корневой директории от:
- Временных скриптов проверки (test-*.js, check-*.js)
- Устаревших логов (*.log, *.txt)
- Старых markdown отчетов о миграциях/деплоях
- Временных файлов рефакторинга (*.py)

## Что перемещено

### Тестовые скрипты (можно удалить после проверки)
- check-db-direct.js
- check-enum-validation.js
- check-full-reviews.js
- check-synced-reviews.js
- check-synced-reviews-now.js
- check-token.js
- test-*.js (10 файлов)
- get-stores-list.js
- fix-corrupted-store.js

### Логи и временные файлы (можно удалить)
- export.log
- migration.log
- full-sync-log.txt
- full-sync-bash-log.txt
- mass-classify-output.log
- reclassify-result.log
- temp_check_complaints.js

### Устаревшие документы (миграция в docs/)
- AI_GENERATION_SUCCESS.md
- APPLY_MIGRATIONS_URGENT.md
- CRON_FIX_GUIDE.md (дубликат docs/CRON_JOBS.md)
- DEEPSEEK_API_SETUP.md
- DEPLOYMENT_SUCCESS.md
- FINAL_SYNC_SUMMARY.md
- IMPLEMENTATION_SUMMARY.md
- PROMPT_FIX_COMPLETE.md
- SERVER_RESTART_SUCCESS.md
- SYNC_COMPLETE_STATUS.md
- SYNC_STATUS_READY_FOR_TESTING.md
- TASK_CRON_AUTO_INIT.md
- TASK_DOCUMENTATION_OVERHAUL.md
- TASK_REVIEWS_REDESIGN.md

### Рефакторинг скрипты
- refactor-reviews-page.py

## Что НЕ перемещено (актуальные файлы)

### Конфигурация
- .env.example
- .env.production.example
- .gitignore
- ecosystem.config.js
- next.config.mjs
- package.json
- package-lock.json
- postcss.config.mjs
- tailwind.config.ts
- tsconfig.json
- instrumentation.ts
- serviceAccountKey.json

### Актуальная документация (в корне)
- README.md (главный README)
- DEPLOYMENT.md (актуальная инструкция)
- QUICK_REFERENCE.md (актуальный reference)

## Рекомендации

### Можно удалить через 30 дней
- Все test-*.js и check-*.js файлы
- Все *.log и *.txt файлы
- refactor-reviews-page.py

### Сохранить для истории
- Markdown документы с _SUCCESS и _SUMMARY суффиксами
- Можно оставить в архиве для справки

## Статус
✅ Файлы перемещены в архив
⏳ Ожидание финального тестирования перед удалением
