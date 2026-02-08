# Extension API Update: Draft Complaints Count

**Дата:** 2026-02-08
**Версия API:** 1.2.0
**Статус:** Ready for Integration

---

## Изменение

В endpoint `GET /api/extension/stores` добавлено новое поле `draftComplaintsCount` — количество жалоб в статусе "черновик" для каждого магазина.

---

## Было (v1.1.0)

```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "ИП Артюшина",
    "isActive": true
  }
]
```

## Стало (v1.2.0)

```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "ИП Артюшина",
    "isActive": true,
    "draftComplaintsCount": 45
  }
]
```

---

## Response Schema

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный ID магазина |
| `name` | string | Название магазина |
| `isActive` | boolean | Активен ли магазин |
| `draftComplaintsCount` | number | **NEW:** Количество жалоб в статусе `draft` |

---

## TypeScript Interface

```typescript
interface Store {
  id: string;
  name: string;
  isActive: boolean;
  draftComplaintsCount: number;  // NEW
}

// Response type
type StoresResponse = Store[];
```

---

## Пример запроса

```bash
curl -X GET "http://158.160.217.236/api/extension/stores" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

## Пример ответа

```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "ИП Артюшина",
    "isActive": true,
    "draftComplaintsCount": 45
  },
  {
    "id": "abc123xyz",
    "name": "ИП Соколов",
    "isActive": true,
    "draftComplaintsCount": 12
  },
  {
    "id": "def456uvw",
    "name": "ООО Тест",
    "isActive": false,
    "draftComplaintsCount": 0
  }
]
```

---

## Использование в UI

### Отображение в списке магазинов

```tsx
// React пример
function StoreList({ stores }: { stores: Store[] }) {
  return (
    <ul>
      {stores.map(store => (
        <li key={store.id}>
          <span>{store.name}</span>
          {store.draftComplaintsCount > 0 && (
            <span className="badge">{store.draftComplaintsCount}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
```

### Рекомендации по отображению

| Значение | Отображение |
|----------|-------------|
| `0` | Можно не показывать badge или показать "—" |
| `1-99` | Показать число в badge |
| `100+` | Показать "99+" для экономии места |

```typescript
function formatCount(count: number): string {
  if (count === 0) return '';
  if (count > 99) return '99+';
  return count.toString();
}
```

---

## Бизнес-логика

**Что считается:**
- Жалобы из таблицы `review_complaints` со статусом `status = 'draft'`
- Только для отзывов, принадлежащих данному магазину
- **Только для товаров с `work_status = 'active'`**

**Что НЕ считается:**
- Жалобы в статусах: `sent`, `pending`, `approved`, `rejected`
- Отзывы без сгенерированных жалоб (`not_sent`)
- **Жалобы по товарам на стопе** (`work_status != 'active'`)

> **Пример:** Магазин имеет 100 черновиков жалоб, но 20 товаров поставлены на стоп.
> В `draftComplaintsCount` будет только число жалоб по 80 активным товарам.

---

## Backward Compatibility

Изменение **обратно совместимо**:
- Добавлено новое поле, существующие поля не изменились
- Старый код Extension продолжит работать
- Новое поле можно игнорировать, если не используется

---

## Тестирование

### Test Store

```
Store ID: 7kKX9WgLvOPiXYIHk6hi
Store Name: ИП Артюшина
Expected draftComplaintsCount: > 0 (есть черновики)
```

### Verification Query (для проверки)

```sql
-- Количество черновиков только по активным товарам
SELECT COUNT(*)
FROM reviews r
JOIN review_complaints rc ON r.id = rc.review_id
JOIN products p ON r.product_id = p.id
WHERE r.store_id = '7kKX9WgLvOPiXYIHk6hi'
  AND rc.status = 'draft'
  AND p.work_status = 'active';

-- Для сравнения: общее количество черновиков (включая стоп)
SELECT COUNT(*)
FROM reviews r
JOIN review_complaints rc ON r.id = rc.review_id
WHERE r.store_id = '7kKX9WgLvOPiXYIHk6hi'
  AND rc.status = 'draft';
```

---

## Changelog

### v1.2.0 (2026-02-08)
- ✅ Добавлено поле `draftComplaintsCount` в `GET /api/extension/stores`
- ✅ Документация обновлена

### v1.1.0 (2026-02-01)
- Добавлены endpoints для синхронизации статусов

### v1.0.0 (2026-01-29)
- Исходная версия API

---

## Контакты

**Backend Team:** R5 Development
**Production URL:** http://158.160.217.236
**Документация:** [EXTENSION_API_COMPLETE.md](./reference/EXTENSION_API_COMPLETE.md)

---

**Файл создан:** 2026-02-08
**Автор:** R5 Backend Team
