> **ARCHIVED (2026-03-06):** Superseded by auth system (migration 010)

# Extension API Update: Draft Complaints Count

**Р”Р°С‚Р°:** 2026-02-08
**Р’РµСЂСЃРёСЏ API:** 1.2.0
**РЎС‚Р°С‚СѓСЃ:** Ready for Integration

---

## РР·РјРµРЅРµРЅРёРµ

Р’ endpoint `GET /api/extension/stores` РґРѕР±Р°РІР»РµРЅРѕ РЅРѕРІРѕРµ РїРѕР»Рµ `draftComplaintsCount` вЂ” РєРѕР»РёС‡РµСЃС‚РІРѕ Р¶Р°Р»РѕР± РІ СЃС‚Р°С‚СѓСЃРµ "С‡РµСЂРЅРѕРІРёРє" РґР»СЏ РєР°Р¶РґРѕРіРѕ РјР°РіР°Р·РёРЅР°.

---

## Р‘С‹Р»Рѕ (v1.1.0)

```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "РРџ РђСЂС‚СЋС€РёРЅР°",
    "isActive": true
  }
]
```

## РЎС‚Р°Р»Рѕ (v1.2.0)

```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "РРџ РђСЂС‚СЋС€РёРЅР°",
    "isActive": true,
    "draftComplaintsCount": 45
  }
]
```

---

## Response Schema

| РџРѕР»Рµ | РўРёРї | РћРїРёСЃР°РЅРёРµ |
|------|-----|----------|
| `id` | string | РЈРЅРёРєР°Р»СЊРЅС‹Р№ ID РјР°РіР°Р·РёРЅР° |
| `name` | string | РќР°Р·РІР°РЅРёРµ РјР°РіР°Р·РёРЅР° |
| `isActive` | boolean | РђРєС‚РёРІРµРЅ Р»Рё РјР°РіР°Р·РёРЅ |
| `draftComplaintsCount` | number | **NEW:** РљРѕР»РёС‡РµСЃС‚РІРѕ Р¶Р°Р»РѕР± РІ СЃС‚Р°С‚СѓСЃРµ `draft` |

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

## РџСЂРёРјРµСЂ Р·Р°РїСЂРѕСЃР°

```bash
curl -X GET "http://158.160.139.99/api/extension/stores" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

## РџСЂРёРјРµСЂ РѕС‚РІРµС‚Р°

```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "РРџ РђСЂС‚СЋС€РёРЅР°",
    "isActive": true,
    "draftComplaintsCount": 45
  },
  {
    "id": "abc123xyz",
    "name": "РРџ РЎРѕРєРѕР»РѕРІ",
    "isActive": true,
    "draftComplaintsCount": 12
  },
  {
    "id": "def456uvw",
    "name": "РћРћРћ РўРµСЃС‚",
    "isActive": false,
    "draftComplaintsCount": 0
  }
]
```

---

## РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ РІ UI

### РћС‚РѕР±СЂР°Р¶РµРЅРёРµ РІ СЃРїРёСЃРєРµ РјР°РіР°Р·РёРЅРѕРІ

```tsx
// React РїСЂРёРјРµСЂ
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

### Р РµРєРѕРјРµРЅРґР°С†РёРё РїРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЋ

| Р—РЅР°С‡РµРЅРёРµ | РћС‚РѕР±СЂР°Р¶РµРЅРёРµ |
|----------|-------------|
| `0` | РњРѕР¶РЅРѕ РЅРµ РїРѕРєР°Р·С‹РІР°С‚СЊ badge РёР»Рё РїРѕРєР°Р·Р°С‚СЊ "вЂ”" |
| `1-99` | РџРѕРєР°Р·Р°С‚СЊ С‡РёСЃР»Рѕ РІ badge |
| `100+` | РџРѕРєР°Р·Р°С‚СЊ "99+" РґР»СЏ СЌРєРѕРЅРѕРјРёРё РјРµСЃС‚Р° |

```typescript
function formatCount(count: number): string {
  if (count === 0) return '';
  if (count > 99) return '99+';
  return count.toString();
}
```

---

## Р‘РёР·РЅРµСЃ-Р»РѕРіРёРєР°

**Р§С‚Рѕ СЃС‡РёС‚Р°РµС‚СЃСЏ:**
- Р–Р°Р»РѕР±С‹ РёР· С‚Р°Р±Р»РёС†С‹ `review_complaints` СЃРѕ СЃС‚Р°С‚СѓСЃРѕРј `status = 'draft'`
- РўРѕР»СЊРєРѕ РґР»СЏ РѕС‚Р·С‹РІРѕРІ, РїСЂРёРЅР°РґР»РµР¶Р°С‰РёС… РґР°РЅРЅРѕРјСѓ РјР°РіР°Р·РёРЅСѓ
- **РўРѕР»СЊРєРѕ РґР»СЏ С‚РѕРІР°СЂРѕРІ СЃ `work_status = 'active'`**

**Р§С‚Рѕ РќР• СЃС‡РёС‚Р°РµС‚СЃСЏ:**
- Р–Р°Р»РѕР±С‹ РІ СЃС‚Р°С‚СѓСЃР°С…: `sent`, `pending`, `approved`, `rejected`
- РћС‚Р·С‹РІС‹ Р±РµР· СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅС‹С… Р¶Р°Р»РѕР± (`not_sent`)
- **Р–Р°Р»РѕР±С‹ РїРѕ С‚РѕРІР°СЂР°Рј РЅР° СЃС‚РѕРїРµ** (`work_status != 'active'`)

> **РџСЂРёРјРµСЂ:** РњР°РіР°Р·РёРЅ РёРјРµРµС‚ 100 С‡РµСЂРЅРѕРІРёРєРѕРІ Р¶Р°Р»РѕР±, РЅРѕ 20 С‚РѕРІР°СЂРѕРІ РїРѕСЃС‚Р°РІР»РµРЅС‹ РЅР° СЃС‚РѕРї.
> Р’ `draftComplaintsCount` Р±СѓРґРµС‚ С‚РѕР»СЊРєРѕ С‡РёСЃР»Рѕ Р¶Р°Р»РѕР± РїРѕ 80 Р°РєС‚РёРІРЅС‹Рј С‚РѕРІР°СЂР°Рј.

---

## Backward Compatibility

РР·РјРµРЅРµРЅРёРµ **РѕР±СЂР°С‚РЅРѕ СЃРѕРІРјРµСЃС‚РёРјРѕ**:
- Р”РѕР±Р°РІР»РµРЅРѕ РЅРѕРІРѕРµ РїРѕР»Рµ, СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РїРѕР»СЏ РЅРµ РёР·РјРµРЅРёР»РёСЃСЊ
- РЎС‚Р°СЂС‹Р№ РєРѕРґ Extension РїСЂРѕРґРѕР»Р¶РёС‚ СЂР°Р±РѕС‚Р°С‚СЊ
- РќРѕРІРѕРµ РїРѕР»Рµ РјРѕР¶РЅРѕ РёРіРЅРѕСЂРёСЂРѕРІР°С‚СЊ, РµСЃР»Рё РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ

---

## РўРµСЃС‚РёСЂРѕРІР°РЅРёРµ

### Test Store

```
Store ID: 7kKX9WgLvOPiXYIHk6hi
Store Name: РРџ РђСЂС‚СЋС€РёРЅР°
Expected draftComplaintsCount: > 0 (РµСЃС‚СЊ С‡РµСЂРЅРѕРІРёРєРё)
```

### Verification Query (РґР»СЏ РїСЂРѕРІРµСЂРєРё)

```sql
-- РљРѕР»РёС‡РµСЃС‚РІРѕ С‡РµСЂРЅРѕРІРёРєРѕРІ С‚РѕР»СЊРєРѕ РїРѕ Р°РєС‚РёРІРЅС‹Рј С‚РѕРІР°СЂР°Рј
SELECT COUNT(*)
FROM reviews r
JOIN review_complaints rc ON r.id = rc.review_id
JOIN products p ON r.product_id = p.id
WHERE r.store_id = '7kKX9WgLvOPiXYIHk6hi'
  AND rc.status = 'draft'
  AND p.work_status = 'active';

-- Р”Р»СЏ СЃСЂР°РІРЅРµРЅРёСЏ: РѕР±С‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ С‡РµСЂРЅРѕРІРёРєРѕРІ (РІРєР»СЋС‡Р°СЏ СЃС‚РѕРї)
SELECT COUNT(*)
FROM reviews r
JOIN review_complaints rc ON r.id = rc.review_id
WHERE r.store_id = '7kKX9WgLvOPiXYIHk6hi'
  AND rc.status = 'draft';
```

---

## Changelog

### v1.2.0 (2026-02-08)
- вњ… Р”РѕР±Р°РІР»РµРЅРѕ РїРѕР»Рµ `draftComplaintsCount` РІ `GET /api/extension/stores`
- вњ… Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ РѕР±РЅРѕРІР»РµРЅР°

### v1.1.0 (2026-02-01)
- Р”РѕР±Р°РІР»РµРЅС‹ endpoints РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃС‚Р°С‚СѓСЃРѕРІ

### v1.0.0 (2026-01-29)
- РСЃС…РѕРґРЅР°СЏ РІРµСЂСЃРёСЏ API

---

## РљРѕРЅС‚Р°РєС‚С‹

**Backend Team:** R5 Development
**Production URL:** http://158.160.139.99
**Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ:** [EXTENSION_API_COMPLETE.md](./reference/EXTENSION_API_COMPLETE.md)

---

**Р¤Р°Р№Р» СЃРѕР·РґР°РЅ:** 2026-02-08
**РђРІС‚РѕСЂ:** R5 Backend Team
