# EPIC-017: Синхронизация правил работы с артикулами

**Статус:** 📋 Backlog
**Приоритет:** P1 (Высокий)
**RICE Score:** 200
**Квартал:** Q2 2025 (Апрель - Июнь)
**Оценка:** 1 неделя (5 SP)
**Владелец:** Product Manager

---

## Проблема

Сейчас правила работы с артикулами (SKU) хранятся в Google Sheets, но не синхронизируются автоматически с системой. Менеджеры магазинов должны:
- Вручную копировать правила из таблиц
- Постоянно следить за обновлениями
- Дублировать данные в разных местах

**Боль пользователей:**
- Тратят 2-3 часа/неделю на ручную синхронизацию
- Риск работы с устаревшими правилами
- Ошибки при копировании данных

---

## Решение

Автоматическая синхронизация правил артикулов из Google Sheets в Firestore с кэшированием на 1 час.

**Функционал:**
1. Интеграция с Google Sheets API
2. Автоматическая загрузка правил каждые 60 минут
3. Хранение в Firestore для быстрого доступа
4. Резервное хранилище в Supabase (для будущей миграции)
5. UI для подключения Google Sheets (вставить Sheet ID)
6. Валидация формата данных при импорте
7. Логирование изменений

---

## User Stories

### US-025: Автосинхронизация Google Sheets → Firestore
**Как:** менеджер магазина
**Я хочу:** автоматически загружать правила артикулов из Google Sheets
**Чтобы:** всегда работать с актуальными данными без ручного копирования

**Acceptance Criteria:**
- ✅ Могу указать Google Sheet ID в настройках магазина
- ✅ Правила автоматически обновляются каждые 60 минут
- ✅ Вижу timestamp последней синхронизации
- ✅ Получаю уведомление при ошибках синхронизации
- ✅ Могу вручную запустить синхронизацию кнопкой "Обновить"

**Story Points:** 5 SP (3-5 дней)

---

### US-026: Валидация и логирование
**Как:** администратор системы
**Я хочу:** видеть статус синхронизации и ошибки
**Чтобы:** быстро реагировать на проблемы

**Acceptance Criteria:**
- ✅ Система валидирует формат данных в Google Sheets
- ✅ Ошибочные строки пропускаются с логом
- ✅ История синхронизаций доступна в UI
- ✅ Email-уведомления при критических ошибках

**Story Points:** 2 SP (1-2 дня)

---

## Технические детали

### Формат Google Sheets

| SKU | Название | Правило | Автоответ | Жалоба |
|-----|----------|---------|-----------|--------|
| 12345678 | Товар А | no_reply_3d | Шаблон ответа... | Да |
| 87654321 | Товар Б | auto_response | Спасибо за отзыв... | Нет |

### Firestore Schema

```typescript
// stores/{storeId}/productRules/{ruleId}
interface ProductRule {
  storeId: string;
  sku: string; // Артикул WB
  productName: string;
  rule: 'no_reply_3d' | 'auto_response' | 'manual' | 'complaint_auto';
  autoResponseTemplate?: string; // Шаблон для автоответа
  autoComplaint: boolean; // Создавать жалобу автоматически

  // Metadata
  googleSheetId: string; // ID таблицы источника
  lastSyncAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// stores/{storeId}/settings
interface StoreSettings {
  googleSheetId?: string; // ID Google Sheets с правилами
  googleSheetRange?: string; // Диапазон (по умолчанию "Sheet1!A:E")
  syncInterval: number; // Минуты (по умолчанию 60)
}

// syncLogs/{logId}
interface SyncLog {
  storeId: string;
  storeName: string;
  type: 'rules_sync';
  status: 'success' | 'partial' | 'error';
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: Array<{row: number, error: string}>;
  timestamp: Timestamp;
}
```

### Cloud Function Implementation

```typescript
// functions/src/scheduled/sync-product-rules.ts

import * as functions from 'firebase-functions';
import { firestore } from '../firebase-admin';
import { google } from 'googleapis';

export const scheduledRulesSync = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Europe/Moscow')
  .onRun(async (context) => {
    const stores = await firestore.collection('stores').get();

    for (const storeDoc of stores.docs) {
      const settings = storeDoc.data().settings;

      if (!settings?.googleSheetId) {
        console.log(`Store ${storeDoc.id}: No Google Sheet configured`);
        continue;
      }

      try {
        await syncRulesForStore(storeDoc.id, settings.googleSheetId);
      } catch (error) {
        console.error(`Store ${storeDoc.id}: Sync failed`, error);
        await logSyncError(storeDoc.id, error);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return null;
  });

async function syncRulesForStore(storeId: string, sheetId: string) {
  const sheets = google.sheets('v4');
  const auth = await google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  // Читаем данные из Google Sheets
  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: sheetId,
    range: 'Sheet1!A2:E1000', // Пропускаем заголовок
  });

  const rows = response.data.values || [];
  const batch = firestore.batch();
  const errors: Array<{row: number, error: string}> = [];
  let successCount = 0;

  rows.forEach((row, index) => {
    try {
      const [sku, productName, rule, autoResponseTemplate, autoComplaint] = row;

      // Валидация
      if (!sku || !rule) {
        throw new Error('Missing SKU or rule');
      }

      const ruleDoc = firestore
        .collection('stores').doc(storeId)
        .collection('productRules').doc(sku);

      batch.set(ruleDoc, {
        storeId,
        sku: sku.trim(),
        productName: productName?.trim() || '',
        rule: rule.trim(),
        autoResponseTemplate: autoResponseTemplate?.trim() || null,
        autoComplaint: autoComplaint?.toLowerCase() === 'да',
        googleSheetId: sheetId,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      successCount++;
    } catch (error) {
      errors.push({ row: index + 2, error: error.message });
    }
  });

  await batch.commit();

  // Логируем результат
  await firestore.collection('syncLogs').add({
    storeId,
    type: 'rules_sync',
    status: errors.length === 0 ? 'success' : 'partial',
    totalRows: rows.length,
    successRows: successCount,
    errorRows: errors.length,
    errors: errors.slice(0, 10), // Первые 10 ошибок
    timestamp: new Date(),
  });
}
```

### UI Component

```tsx
// src/app/stores/[storeId]/settings/GoogleSheetsSettings.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function GoogleSheetsSettings({ storeId }: { storeId: string }) {
  const [sheetId, setSheetId] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSaveSettings = async () => {
    await updateDoc(doc(firestore, 'stores', storeId), {
      'settings.googleSheetId': sheetId,
      'settings.syncInterval': 60,
    });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-rules', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });

      if (response.ok) {
        setLastSync(new Date());
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Интеграция с Google Sheets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label>Google Sheet ID</label>
          <Input
            placeholder="1A2B3C4D5E..."
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
          />
          <p className="text-sm text-muted-foreground mt-1">
            Скопируйте ID из URL: docs.google.com/spreadsheets/d/<strong>ID</strong>/edit
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSaveSettings}>Сохранить</Button>
          <Button
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing || !sheetId}
          >
            {isSyncing ? 'Синхронизация...' : 'Обновить сейчас'}
          </Button>
        </div>

        {lastSync && (
          <p className="text-sm text-muted-foreground">
            Последняя синхронизация: {lastSync.toLocaleString('ru-RU')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Метрики успеха

**KPIs:**
- ⏱️ Экономия времени: 2-3 часа/неделю → 0 часов
- 📊 Актуальность данных: 100% (синхронизация каждые 60 мин)
- 🎯 Точность применения правил: +30% (за счет актуальных данных)
- ⚡ Скорость доступа к правилам: < 100ms (кэш Firestore)

**Мониторинг:**
- Количество успешных/неудачных синхронизаций
- Среднее время синхронизации
- Количество ошибок валидации

---

## Зависимости

**Внешние:**
- Google Sheets API access
- Service Account с правами на чтение
- Firestore composite индексы

**Внутренние:**
- `stores/{storeId}/settings` коллекция
- Cloud Functions инфраструктура
- Существующая архитектура магазинов

---

## Risks & Mitigation

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Google API rate limits | Средняя | Среднее | Debouncing, retry logic, кэширование |
| Неправильный формат таблицы | Высокая | Низкое | Валидация + пропуск ошибочных строк |
| Удаление доступа к Sheet | Низкая | Высокое | Email-уведомления + fallback к старым данным |
| Firestore costs | Средняя | Среднее | Batch writes, лимит на кол-во правил (1000/магазин) |

---

## Timeline

**Week 1:**
- Day 1-2: Google Sheets API интеграция + Cloud Function
- Day 3: Firestore schema + UI компонент
- Day 4: Тестирование на staging
- Day 5: Production rollout + мониторинг

---

## Монетизация

**Не влияет напрямую**, но:
- Улучшает UX → снижает churn
- Упрощает onboarding новых клиентов
- Необходимая функция для масштабирования (8,000 клиентов)

**Value Proposition:**
- "Ваши правила автоматически синхронизируются из знакомых Google Sheets"
- Снижает барьер входа для пользователей, привыкших к таблицам

---

## Definition of Done

- ✅ Cloud Function развернута и работает по расписанию
- ✅ UI для настройки Sheet ID + ручная синхронизация
- ✅ Валидация данных с логированием ошибок
- ✅ Email-уведомления при критических сбоях
- ✅ Документация для пользователей (как настроить)
- ✅ Протестировано на 3+ магазинах
- ✅ Мониторинг в Cloud Functions console

---

**Создано:** 30 декабря 2024
**Обновлено:** 30 декабря 2024
**Следующий ревью:** Sprint Planning Q2 2025
