# 🔄 Auto-Sequence Restart Analysis

**Дата анализа:** 2026-03-13
**Статус:** ⏸️ ОТЛОЖЕНО - для будущего решения
**Связано с:** Emergency Stop (2,075 sequences остановлено)

---

## 📊 Текущая ситуация

### Stopped Sequences
- **Всего остановлено:** 2,075 sequences
- **Причина:** emergency_stop_2026_03_13
- **Статус чатов:** Переведены из `awaiting_reply` → `inbox`/`in_progress`

### Distribution by current_step

| current_step | Количество | Что уже отправлено | Следующее сообщение |
|--------------|------------|-------------------|---------------------|
| 0 | 43 | Ничего (stopped до 1-го) | messages[0] (1-е) |
| 1 | 706 | 1 сообщение | messages[1] (2-е) |
| 2 | 1,007 | 2 сообщения | messages[2] (3-е) |
| 3 | 28 | 3 сообщения | messages[3] (4-е) |
| 4 | 114 | 4 сообщения | messages[4] (5-е) |
| 5 | 50 | 5 сообщений | messages[5] (6-е) |
| 6 | 127 | 6 сообщений | messages[6] (7-е) |

**Итого:** 2,075 sequences

---

## 🔍 Как работает перезапуск

### Логика продолжения sequence:

**Sequences продолжают С ТОГО МЕСТА, ГДЕ ОСТАНОВИЛИСЬ** ✅

**Пример:**
```
Sequence остановилась с current_step = 2
┌─────────────────────────────────────────────┐
│ УЖЕ ОТПРАВЛЕНО (до emergency stop):         │
│ messages[0] → 1-е сообщение ✅ отправлено   │
│ messages[1] → 2-е сообщение ✅ отправлено   │
│ current_step увеличился до 2                │
├─────────────────────────────────────────────┤
│ СЛЕДУЮЩЕЕ СООБЩЕНИЕ (при перезапуске):      │
│ messages[2] → 3-е сообщение ⏳ будет отправ │
└─────────────────────────────────────────────┘
```

**Код из auto-sequence processor:**
```typescript
// src/lib/cron-jobs.ts:743-802
const messageIndex = seq.current_step; // 0-based array index
const message = seq.messages[messageIndex];

// После отправки:
await dbHelpers.advanceSequence(seq.id, daysAhead);
// → current_step увеличится на 1
// → next_send_at = завтра (или через 3 дня для 30d)
```

**Вывод:** Дубликатов НЕ будет - уже отправленные сообщения не отправятся повторно.

---

## 💡 Варианты действий

### Вариант 1: **Умный перезапуск** (рекомендуется ⭐)

**Суть:** Перезапустить только sequences с существенным прогрессом.

**Критерии фильтрации:**
```sql
WHERE status = 'stopped'
  AND stop_reason = 'emergency_stop_2026_03_13'
  AND current_step >= 3                    -- Уже отправлено 3+ сообщения
  AND chat_status IN ('inbox', 'in_progress')  -- Чат ещё активен
  AND NOT EXISTS (                         -- Клиент НЕ ответил
    SELECT 1 FROM messages
    WHERE chat_id = chat_auto_sequences.chat_id
      AND sender = 'client'
      AND timestamp > chat_auto_sequences.started_at
  )
  AND review_status NOT IN ('resolved', 'deleted', 'complaint_approved')
```

**Затронет:** ~319 sequences (steps 3-6)

**Плюсы:**
- ✅ Завершает начатые диалоги
- ✅ Не спамит на ранних стадиях (steps 0-2)
- ✅ Проверяет актуальность чата

**Минусы:**
- ⚠️ Требует написания скрипта
- ⚠️ Нужно тестирование

**Скрипт:** См. раздел "Implementation" ниже

---

### Вариант 2: **Постепенный перезапуск**

**Суть:** Перезапускать порциями по дням.

**План:**
- **День 1:** current_step >= 5 (~177 sequences)
- **День 2:** current_step >= 3 (~319 sequences)
- **День 3:** current_step >= 1 (~2,032 sequences)

**Плюсы:**
- ✅ Контролируемая нагрузка
- ✅ Можно мониторить результаты каждого этапа
- ✅ Легко остановить, если что-то пошло не так

**Минусы:**
- ⚠️ Растянуто во времени (3 дня)
- ⚠️ Некоторые чаты могут устареть за это время

---

### Вариант 3: **Не перезапускать** (самый безопасный ✅)

**Суть:** Оставить остановленными, создавать новые sequences вручную.

**Плюсы:**
- ✅ Полный контроль
- ✅ Нет рисков спама
- ✅ Клиенты не получат unexpected сообщения
- ✅ Чаты доступны в inbox для ручной работы

**Минусы:**
- ⚠️ "Потеряно" 2,075 sequences (но большинство только начали)
- ⚠️ Нужно вручную создавать новые sequences

**Текущий статус:** 20 новых sequences уже работают (созданы после emergency stop)

---

### Вариант 4: **Массовый перезапуск** (НЕ рекомендуется ❌)

**Суть:** Перезапустить все 2,075 sequences сразу.

**Почему НЕ рекомендуется:**
- ❌ Слишком большая нагрузка на систему
- ❌ Невозможно контролировать результаты
- ❌ Риск спама клиентам
- ❌ Многие чаты уже неактуальны

---

## 📋 Анализ по категориям

### Low Progress (steps 0-2): 1,756 sequences (85%)
**Характеристика:** Только начали рассылку
**Рекомендация:** НЕ перезапускать, создать новые sequences вручную

**Причина:**
- Отправлено всего 0-2 сообщения
- Высокий риск, что чаты уже неактуальны
- Лучше начать fresh sequence с актуальными данными

---

### Medium Progress (steps 3-4): 142 sequences (7%)
**Характеристика:** Есть engagement, но ещё в начале
**Рекомендация:** Рассмотреть для умного перезапуска

**Условия:**
- Клиент НЕ ответил
- Чат ещё в inbox/in_progress
- Review ещё НЕ resolved

---

### High Progress (steps 5-6): 177 sequences (8%)
**Характеристика:** Близко к середине sequence
**Рекомендация:** Приоритет для перезапуска

**Причина:**
- Уже отправлено 5-6 сообщений из 14-30
- Есть инвестированный "капитал" в диалог
- Высокая вероятность завершения sequence

---

## 🛠️ Implementation (Вариант 1: Умный перезапуск)

### Скрипт для безопасного перезапуска

```javascript
// scripts/restart-stopped-sequences.mjs

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '6432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function restartSequences() {
  console.log('🔄 Safe Sequence Restart\n');

  // Step 1: Find eligible sequences
  const eligibleResult = await pool.query(`
    SELECT
      s.id,
      s.chat_id,
      s.current_step,
      s.max_steps,
      s.sequence_type,
      c.status as chat_status,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.chat_id = s.chat_id
          AND m.sender = 'client'
          AND m.timestamp > s.started_at
      ) as client_replies
    FROM chat_auto_sequences s
    JOIN chats c ON c.id = s.chat_id
    WHERE s.status = 'stopped'
      AND s.stop_reason = 'emergency_stop_2026_03_13'
      AND s.current_step >= 3
      AND c.status IN ('inbox', 'in_progress')
  `);

  console.log(`Found ${eligibleResult.rows.length} eligible sequences\n`);

  // Step 2: Filter out sequences where client replied
  const toRestart = eligibleResult.rows.filter(s => s.client_replies === 0);

  console.log(`After filtering (client_replies = 0): ${toRestart.length} sequences\n`);

  // Step 3: Show distribution
  const distribution = {};
  toRestart.forEach(s => {
    distribution[s.current_step] = (distribution[s.current_step] || 0) + 1;
  });

  console.log('Distribution:');
  Object.entries(distribution).forEach(([step, count]) => {
    console.log(`  Step ${step}: ${count} sequences`);
  });

  // Step 4: Confirm restart
  console.log('\n⚠️  DRY RUN MODE - no changes will be made');
  console.log('To actually restart, set DRY_RUN=false\n');

  const DRY_RUN = process.env.DRY_RUN !== 'false';

  if (DRY_RUN) {
    console.log('✅ Dry run complete. No sequences restarted.');
    await pool.end();
    return;
  }

  // Step 5: Restart sequences
  let restarted = 0;
  let failed = 0;

  for (const seq of toRestart) {
    try {
      await pool.query(`
        UPDATE chat_auto_sequences
        SET
          status = 'active',
          stop_reason = NULL,
          next_send_at = NOW() + INTERVAL '1 day',
          updated_at = NOW()
        WHERE id = $1
      `, [seq.id]);

      restarted++;
      console.log(`✅ Restarted sequence ${seq.id} (step ${seq.current_step}/${seq.max_steps})`);
    } catch (error) {
      failed++;
      console.error(`❌ Failed to restart ${seq.id}:`, error.message);
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`  ✅ Restarted: ${restarted}`);
  console.log(`  ❌ Failed: ${failed}`);

  await pool.end();
}

restartSequences();
```

### Как использовать:

```bash
# 1. Dry run (безопасная проверка, изменений НЕ будет)
cd /var/www/wb-reputation
node scripts/restart-stopped-sequences.mjs

# 2. Если результат устраивает - реальный перезапуск
DRY_RUN=false node scripts/restart-stopped-sequences.mjs
```

---

## 🎯 Рекомендация

**Текущий статус: Вариант 3 (Не перезапускать)** ✅

**Причины:**
1. Emergency stop сработал корректно
2. 20 новых sequences уже работают
3. Большинство остановленных (85%) на ранних стадиях (steps 0-2)
4. Через TG mini app можно создавать новые sequences для нужных чатов
5. Нет риска спама или неожиданных сообщений клиентам

**Если потребуется перезапуск:**
- Используйте **Вариант 1 (Умный перезапуск)** для sequences с current_step >= 5
- Проверьте результаты через 24 часа
- Постепенно расширяйте на sequences с current_step >= 3

---

## 📊 Monitoring

### После перезапуска (если решите):

```bash
# Проверить количество активных sequences
node scripts/check-sequences-status.mjs

# Проверить дубликаты
node scripts/AUDIT-check-duplicate-sends.mjs

# Мониторить логи CRON
pm2 logs wb-reputation-cron | grep "Auto-sequence"
```

---

## 📝 Next Steps (если решим перезапускать)

1. **Day 1:**
   - [ ] Создать скрипт restart-stopped-sequences.mjs
   - [ ] Протестировать в DRY_RUN mode
   - [ ] Запустить для sequences с current_step >= 5 (~177 sequences)
   - [ ] Мониторить 24 часа

2. **Day 2:**
   - [ ] Проверить результаты первого этапа
   - [ ] Если успешно - расширить на current_step >= 3 (~142 sequences)
   - [ ] Мониторить 24 часа

3. **Day 3:**
   - [ ] Final review
   - [ ] Решить по sequences с current_step 1-2 (индивидуально)

---

**Создано:** 2026-03-13
**Статус:** ⏸️ ОТЛОЖЕНО - ждем решения
**Приоритет:** 🟡 MEDIUM (не срочно, но важно для будущего)

**Связанные документы:**
- [DEPLOYMENT-REPORT-2026-03-13.md](DEPLOYMENT-REPORT-2026-03-13.md)
- [BACKLOG.md](BACKLOG.md)
