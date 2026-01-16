# 🚨 СРОЧНО: Применить миграции для Deletion Workflow

## Проблема

Синхронизация чатов падает с ошибкой:
```
new row for relation "chats" violates check constraint "chats_tag_check"
```

**Причина**: PostgreSQL не знает о новых тегах deletion workflow (deletion_candidate, deletion_offered и т.д.), потому что миграция не применена!

---

## Решение: Применить 3 миграции

Есть 3 файла миграций, которые нужно применить **В ЭТОМ ПОРЯДКЕ**:

1. `20260116_add_deletion_chat_tags.sql` - Добавляет новые теги в ENUM
2. `20260116_002_add_deletion_classification_prompt.sql` - Добавляет промпт для AI
3. `20260116_003_create_review_deletion_cases.sql` - Создаёт таблицу review_deletion_cases

---

## Способ 1: Через psql (если установлен)

```bash
# Миграция 1: Добавить новые теги
psql "postgresql://admin_R5:MyNewPass123@rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net:6432/wb_reputation?sslmode=require" \
  -f "supabase/migrations/20260116_add_deletion_chat_tags.sql"

# Миграция 2: Добавить AI промпт
psql "postgresql://admin_R5:MyNewPass123@rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net:6432/wb_reputation?sslmode=require" \
  -f "supabase/migrations/20260116_002_add_deletion_classification_prompt.sql"

# Миграция 3: Создать таблицу deletion_cases
psql "postgresql://admin_R5:MyNewPass123@rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net:6432/wb_reputation?sslmode=require" \
  -f "supabase/migrations/20260116_003_create_review_deletion_cases.sql"
```

---

## Способ 2: Через Node.js скрипт (рекомендуется)

Я создам скрипт для применения миграций...

```bash
npx tsx scripts/apply-migrations.ts
```

---

## После применения миграций

1. **Перезапустить синхронизацию**:
   ```bash
   curl -X POST "http://localhost:9002/api/stores/dialogues/update-all" \
     -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     -H "Content-Type: application/json" \
     -s
   ```

2. **Проверить результаты**:
   - Должны появиться чаты с тегом `deletion_candidate`
   - Ошибок "chats_tag_check" больше не должно быть

---

## Проверка: Убедиться что миграции применены

```bash
# Проверить что новые теги есть в ENUM
psql "postgresql://admin_R5:MyNewPass123@rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net:6432/wb_reputation?sslmode=require" \
  -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'chat_tag') ORDER BY enumlabel;"

# Должны увидеть:
# - deletion_candidate
# - deletion_offered
# - deletion_agreed
# - deletion_confirmed
# - refund_requested
# - spam
```

---

## Статус

- [ ] Миграция 1 применена (теги)
- [ ] Миграция 2 применена (промпт)
- [ ] Миграция 3 применена (таблица)
- [ ] Синхронизация перезапущена
- [ ] Ошибки устранены

**ВАЖНО**: Применить сейчас, иначе AI не сможет классифицировать чаты для deletion workflow!
