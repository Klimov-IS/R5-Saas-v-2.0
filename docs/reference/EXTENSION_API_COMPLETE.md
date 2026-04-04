# Extension API - Complete Documentation

> **Backend API РґР»СЏ РёРЅС‚РµРіСЂР°С†РёРё СЃ Chrome Extension (R5 Complaints System)**

**Р’РµСЂСЃРёСЏ:** 2.2.3
**Р”Р°С‚Р° РѕР±РЅРѕРІР»РµРЅРёСЏ:** 2026-03-14
**РЎС‚Р°С‚СѓСЃ:** Production Ready

---

## РћР±Р·РѕСЂ

WB Reputation Manager СЂР°Р±РѕС‚Р°РµС‚ РІ РїР°СЂРµ СЃ Chrome Extension РґР»СЏ Р°РІС‚РѕРјР°С‚РёР·Р°С†РёРё РїРѕРґР°С‡Рё Р¶Р°Р»РѕР± РЅР° РѕС‚Р·С‹РІС‹ Wildberries.

### РђСЂС…РёС‚РµРєС‚СѓСЂР° РёРЅС‚РµРіСЂР°С†РёРё

```
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚                      Chrome Extension                                в”‚
в”‚  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ    в”‚
в”‚  в”‚  1. РџР°СЂСЃРёС‚ РѕС‚Р·С‹РІС‹ СЃРѕ СЃС‚СЂР°РЅРёС†С‹ WB seller cabinet             в”‚    в”‚
в”‚  в”‚  2. РћС‚РїСЂР°РІР»СЏРµС‚ СЃС‚Р°С‚СѓСЃС‹ РІ Backend (review-statuses)          в”‚    в”‚
в”‚  в”‚  3. РџРѕР»СѓС‡Р°РµС‚ РіРѕС‚РѕРІС‹Рµ Р¶Р°Р»РѕР±С‹ (complaints)                    в”‚    в”‚
в”‚  в”‚  4. РџРѕРґР°РµС‚ Р¶Р°Р»РѕР±С‹ РІ WB                                      в”‚    в”‚
в”‚  в”‚  5. РћР±РЅРѕРІР»СЏРµС‚ СЃС‚Р°С‚СѓСЃС‹ РїРѕСЃР»Рµ РїРѕРґР°С‡Рё                          в”‚    в”‚
в”‚  в”‚  6. РџСЂРѕРІРµСЂСЏРµС‚ СЃС‚Р°С‚СѓСЃС‹ Р¶Р°Р»РѕР± (complaint-statuses)            в”‚    в”‚
в”‚  в”‚  7. РЎРєСЂРёРЅС€РѕС‚РёС‚ РѕРґРѕР±СЂРµРЅРЅС‹Рµ Рё С€Р»С‘С‚ РґРµС‚Р°Р»Рё (complaint-details) в”‚    в”‚
в”‚  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”    в”‚
в”‚                              в”‚                                       в”‚
в”‚                              в–ј                                       в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ HTTP API в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
                               в”‚
                               в–ј
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚                         Backend API                                  в”‚
в”‚  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ    в”‚
в”‚  в”‚  - /api/extension/review-statuses     (СЃС‚Р°С‚СѓСЃС‹ РѕС‚Р·С‹РІРѕРІ)     в”‚    в”‚
в”‚  в”‚  - /api/extension/stores              (СЃРїРёСЃРѕРє РјР°РіР°Р·РёРЅРѕРІ)    в”‚    в”‚
в”‚  в”‚  - /api/extension/stores/:id/complaints (РѕС‡РµСЂРµРґСЊ Р¶Р°Р»РѕР±)     в”‚    в”‚
в”‚  в”‚  - /api/extension/stores/:id/stats    (СЃС‚Р°С‚РёСЃС‚РёРєР°)          в”‚    в”‚
в”‚  в”‚  - /api/extension/complaint-statuses  (СЃС‚Р°С‚СѓСЃС‹ Р¶Р°Р»РѕР± WB)    в”‚    в”‚
в”‚  в”‚  - /api/extension/complaint-details   (РѕРґРѕР±СЂРµРЅРЅС‹Рµ Р¶Р°Р»РѕР±С‹)   в”‚    в”‚
в”‚  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”    в”‚
в”‚                              в”‚                                       в”‚
в”‚                              в–ј                                       в”‚
в”‚  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ    в”‚
в”‚  в”‚  PostgreSQL:                                                 в”‚    в”‚
в”‚  в”‚  - review_statuses_from_extension (СЃС‚Р°С‚СѓСЃС‹ РѕС‚ Extension)     в”‚    в”‚
в”‚  в”‚  - reviews (РѕСЃРЅРѕРІРЅР°СЏ С‚Р°Р±Р»РёС†Р° РѕС‚Р·С‹РІРѕРІ)                       в”‚    в”‚
в”‚  в”‚  - review_complaints (AI-С‡РµСЂРЅРѕРІРёРєРё Р¶Р°Р»РѕР±)                   в”‚    в”‚
в”‚  в”‚  - complaint_details (РѕРґРѕР±СЂРµРЅРЅС‹Рµ Р¶Р°Р»РѕР±С‹ вЂ” source of truth)  в”‚    в”‚
в”‚  в”‚  - review_chat_links (СЃРІСЏР·РєР° РѕС‚Р·С‹РІв†”С‡Р°С‚)                    в”‚    в”‚
в”‚  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”    в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
```

---

## Р­С‚Р°РїС‹ СЂР°Р±РѕС‚С‹ СЃ РєР°Р±РёРЅРµС‚РѕРј (Store Lifecycle)

РљР°Р¶РґС‹Р№ РјР°РіР°Р·РёРЅ РїСЂРѕС…РѕРґРёС‚ РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅС‹Рµ СЌС‚Р°РїС‹ СЂР°Р±РѕС‚С‹. API СѓС‡РёС‚С‹РІР°РµС‚ С‚РµРєСѓС‰РёР№ СЌС‚Р°Рї Рё **РЅРµ РІС‹РґР°С‘С‚ Р·Р°РґР°С‡Рё РїРѕ С‡Р°С‚Р°Рј**, РµСЃР»Рё РєР°Р±РёРЅРµС‚ РµС‰С‘ РЅРµ РґРѕС€С‘Р» РґРѕ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РµРіРѕ СЌС‚Р°РїР°.

### РџРѕСЂСЏРґРѕРє СЌС‚Р°РїРѕРІ

| # | Stage | РћРїРёСЃР°РЅРёРµ | Р§Р°С‚-Р·Р°РґР°С‡Рё |
|---|-------|----------|:----------:|
| 0 | `contract` | Р”РѕРіРѕРІРѕСЂ | вЂ” |
| 1 | `access_received` | Р”РѕСЃС‚СѓРї РїРѕР»СѓС‡РµРЅ | вЂ” |
| 2 | `cabinet_connected` | РљР°Р±РёРЅРµС‚ РїРѕРґРєР»СЋС‡С‘РЅ | вЂ” |
| 3 | `complaints_submitted` | РџРѕРґР°С‘Рј Р¶Р°Р»РѕР±С‹ | вЂ” |
| 4 | `chats_opened` | РћС‚РєСЂС‹РІР°РµРј С‡Р°С‚С‹ | **Р”Р°** |
| 5 | `monitoring` | РљР°Р±РёРЅРµС‚ РЅР° РєРѕРЅС‚СЂРѕР»Рµ | **Р”Р°** |
| вЂ” | `client_paused` | РќР° РїР°СѓР·Рµ | вЂ” |
| вЂ” | `client_lost` | РџРѕС‚РµСЂСЏ | вЂ” |

### РџСЂР°РІРёР»Рѕ stage guard (Sprint 008)

Р—Р°РґР°С‡Рё РїРѕ РѕС‚РєСЂС‹С‚РёСЋ С‡Р°С‚РѕРІ (`chatOpens`, `chatLinks`) РІРѕР·РІСЂР°С‰Р°СЋС‚СЃСЏ **С‚РѕР»СЊРєРѕ** РґР»СЏ РєР°Р±РёРЅРµС‚РѕРІ РЅР° СЌС‚Р°РїРµ `chats_opened` РёР»Рё `monitoring`. Р”Р»СЏ РєР°Р±РёРЅРµС‚РѕРІ РЅР° Р±РѕР»РµРµ СЂР°РЅРЅРёС… СЌС‚Р°РїР°С… (РЅР°РїСЂРёРјРµСЂ, `complaints_submitted`) вЂ” РјР°СЃСЃРёРІС‹ `chatOpens` Рё `chatLinks` РІСЃРµРіРґР° РїСѓСЃС‚С‹, Р° `pendingChatsCount = 0`.

Р­С‚Рѕ РіР°СЂР°РЅС‚РёСЂСѓРµС‚, С‡С‚Рѕ СЂР°СЃС€РёСЂРµРЅРёРµ РЅРµ РѕС‚РєСЂРѕРµС‚ С‡Р°С‚С‹ РґРѕ СЃРѕРіР»Р°СЃРѕРІР°РЅРёСЏ СЃ РєР»РёРµРЅС‚РѕРј.

> **Р–Р°Р»РѕР±С‹ Рё РїР°СЂСЃРёРЅРі СЃС‚Р°С‚СѓСЃРѕРІ** вЂ” `complaints` РґРѕСЃС‚СѓРїРЅС‹ РЅР° Р»СЋР±РѕРј СЌС‚Р°РїРµ. `statusParses` РґРѕСЃС‚СѓРїРЅС‹ РЅР° Р»СЋР±РѕРј СЌС‚Р°РїРµ РґР»СЏ СЂРµР№С‚РёРЅРіРѕРІ, РїРѕРґС…РѕРґСЏС‰РёС… РїРѕРґ Р¶Р°Р»РѕР±С‹ (`submit_complaints`). Р РµР№С‚РёРЅРіРё, РїРѕРґС…РѕРґСЏС‰РёРµ **С‚РѕР»СЊРєРѕ** РїРѕРґ С‡Р°С‚-РїСЂР°РІРёР»Р° (`work_in_chats` Р±РµР· `submit_complaints`), РїРѕРїР°РґР°СЋС‚ РІ `statusParses` С‚РѕР»СЊРєРѕ РїСЂРё `stage IN ('chats_opened', 'monitoring')`. (Sprint 009)

---

## РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ

Р’СЃРµ endpoints С‚СЂРµР±СѓСЋС‚ Bearer Token РІ Р·Р°РіРѕР»РѕРІРєРµ:

```http
Authorization: Bearer wbrm_<token>
```

**Р¤РѕСЂРјР°С‚ С‚РѕРєРµРЅР°:** `wbrm_` + 32-СЃРёРјРІРѕР»СЊРЅС‹Р№ С…РµС€

**Р“РґРµ РїРѕР»СѓС‡РёС‚СЊ:** РўРѕРєРµРЅС‹ С…СЂР°РЅСЏС‚СЃСЏ РІ С‚Р°Р±Р»РёС†Рµ `user_settings.api_key`

**Rate limit:** 100 requests/minute

---

## API Endpoints

### 1. Review Statuses Sync (NEW)

**РќР°Р·РЅР°С‡РµРЅРёРµ:** РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃС‚Р°С‚СѓСЃРѕРІ РѕС‚Р·С‹РІРѕРІ РѕС‚ Extension РґР»СЏ С„РёР»СЊС‚СЂР°С†РёРё РїРµСЂРµРґ РіРµРЅРµСЂР°С†РёРµР№ GPT Р¶Р°Р»РѕР±. Р­РєРѕРЅРѕРјРёС‚ ~80% С‚РѕРєРµРЅРѕРІ.

#### POST /api/extension/review-statuses

РџСЂРёРЅРёРјР°РµС‚ СЃС‚Р°С‚СѓСЃС‹ РѕС‚Р·С‹РІРѕРІ, СЃРїР°СЂСЃРµРЅРЅС‹Рµ Extension СЃ WB seller cabinet.

**Request:**

```http
POST /api/extension/review-statuses
Content-Type: application/json
Authorization: Bearer wbrm_<token>
```

```json
{
  "storeId": "7kKX9WgLvOPiXYIHk6hi",
  "parsedAt": "2026-02-01T12:00:00.000Z",
  "reviews": [
    {
      "reviewKey": "649502497_1_2026-01-07T20:09",
      "productId": "649502497",
      "rating": 1,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "statuses": ["Р–Р°Р»РѕР±Р° РѕС‚РєР»РѕРЅРµРЅР°", "Р’С‹РєСѓРї"],
      "canSubmitComplaint": false,
      "chatStatus": "chat_available",
      "ratingExcluded": false
    }
  ]
}
```

**Fields:**
- `ratingExcluded` (boolean, optional, default: false) вЂ” WB transparent rating: `true` = review excluded from product rating calculation. Reviews with `ratingExcluded: true` are removed from all task queues.
- `chatStatus` (string, optional) вЂ” Chat button state: `chat_not_activated` | `chat_available` | `chat_opened`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "received": 20,
    "created": 15,
    "updated": 5,
    "errors": 0
  },
  "message": "РЎС‚Р°С‚СѓСЃС‹ СѓСЃРїРµС€РЅРѕ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅС‹"
}
```

**Р›РёРјРёС‚С‹:**
- Max 100 reviews per request
- Max request size: 1 MB

---

#### GET /api/extension/review-statuses

РџРѕР»СѓС‡РµРЅРёРµ СЃРѕС…СЂР°РЅРµРЅРЅС‹С… СЃС‚Р°С‚СѓСЃРѕРІ (РґР»СЏ С‚РµСЃС‚РёСЂРѕРІР°РЅРёСЏ Рё РІРµСЂРёС„РёРєР°С†РёРё).

**Request:**

```http
GET /api/extension/review-statuses?storeId=xxx&limit=50&canSubmit=true|false|all
Authorization: Bearer wbrm_<token>
```

**Query Parameters:**

| РџР°СЂР°РјРµС‚СЂ | РўРёРї | РћР±СЏР·Р°С‚РµР»СЊРЅРѕ | РћРїРёСЃР°РЅРёРµ |
|----------|-----|-------------|----------|
| storeId | string | Р”Р° | ID РјР°РіР°Р·РёРЅР° |
| limit | number | РќРµС‚ | Р›РёРјРёС‚ Р·Р°РїРёСЃРµР№ (default: 50, max: 100) |
| canSubmit | string | РќРµС‚ | Р¤РёР»СЊС‚СЂ: 'true', 'false', 'all' (default: 'all') |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "total": 1500,
    "reviews": [
      {
        "reviewKey": "649502497_1_2026-01-07T20:09",
        "productId": "649502497",
        "rating": 1,
        "reviewDate": "2026-01-07T20:09:37.000Z",
        "statuses": ["Р–Р°Р»РѕР±Р° РѕС‚РєР»РѕРЅРµРЅР°", "Р’С‹РєСѓРї"],
        "canSubmitComplaint": false,
        "ratingExcluded": false,
        "parsedAt": "2026-02-01T12:00:00.000Z",
        "createdAt": "2026-02-01T12:00:01.000Z",
        "updatedAt": "2026-02-01T12:00:01.000Z"
      }
    ],
    "stats": {
      "canSubmit": 300,
      "cannotSubmit": 1200
    }
  }
}
```

---

### 2. Stores

#### GET /api/extension/stores

РџРѕР»СѓС‡РµРЅРёРµ СЃРїРёСЃРєР° РјР°РіР°Р·РёРЅРѕРІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.

**Response 200:**

```json
[
  {
    "id": "7kKX9WgLvOPiXYIHk6hi",
    "name": "РРџ РђСЂС‚СЋС€РёРЅР°",
    "isActive": true,
    "draftComplaintsCount": 45,
    "pendingChatsCount": 12,
    "pendingStatusParsesCount": 150
  }
]
```

**Response Fields:**

| РџРѕР»Рµ | РўРёРї | РћРїРёСЃР°РЅРёРµ |
|------|-----|----------|
| id | string | РЈРЅРёРєР°Р»СЊРЅС‹Р№ ID РјР°РіР°Р·РёРЅР° |
| name | string | РќР°Р·РІР°РЅРёРµ РјР°РіР°Р·РёРЅР° |
| isActive | boolean | РђРєС‚РёРІРµРЅ Р»Рё РјР°РіР°Р·РёРЅ (status = 'active') |
| draftComplaintsCount | number | РљРѕР»РёС‡РµСЃС‚РІРѕ Р¶Р°Р»РѕР± РІ СЃС‚Р°С‚СѓСЃРµ `draft` **С‚РѕР»СЊРєРѕ РґР»СЏ Р°РєС‚РёРІРЅС‹С… С‚РѕРІР°СЂРѕРІ** (`work_status = 'active'`) |
| pendingChatsCount | number | РљРѕР»РёС‡РµСЃС‚РІРѕ С‡Р°С‚РѕРІ Рє РѕС‚РєСЂС‹С‚РёСЋ/РїСЂРёРІСЏР·РєРµ. РЎСѓРјРјР° chatOpens (rejected complaint + available chat) Рё chatLinks (opened chat Р±РµР· СЃРІСЏР·РєРё РІ review_chat_links). РђРЅР°Р»РѕРі `totalCounts.chatOpens` РёР· `/tasks` |
| pendingStatusParsesCount | number | РљРѕР»РёС‡РµСЃС‚РІРѕ РѕС‚Р·С‹РІРѕРІ, С‚СЂРµР±СѓСЋС‰РёС… РїР°СЂСЃРёРЅРіР° СЃС‚Р°С‚СѓСЃРѕРІ СЂР°СЃС€РёСЂРµРЅРёРµРј (`chat_status_by_review IS NULL` РёР»Рё `unknown`). РђРЅР°Р»РѕРі `totalCounts.statusParses` РёР· `/tasks` |

> **Р’Р°Р¶РЅРѕ:** Р’СЃРµ СЃС‡С‘С‚С‡РёРєРё СѓС‡РёС‚С‹РІР°СЋС‚ С‚РѕР»СЊРєРѕ Р°РєС‚РёРІРЅС‹Рµ РјР°РіР°Р·РёРЅС‹ (`status = 'active'`), Р°РєС‚РёРІРЅС‹Рµ С‚РѕРІР°СЂС‹ (`work_status = 'active'`) Рё РїСЂРёРјРµРЅСЏСЋС‚ С„РёР»СЊС‚СЂС‹ `product_rules` (СЂРµР№С‚РёРЅРіРё, С„Р»Р°РіРё `submit_complaints`/`work_in_chats`). 5в… РѕС‚Р·С‹РІС‹ РїРѕР»РЅРѕСЃС‚СЊСЋ РёСЃРєР»СЋС‡РµРЅС‹. Р•СЃР»Рё С‚РѕРІР°СЂ РїРѕСЃС‚Р°РІР»РµРЅ РЅР° СЃС‚РѕРї вЂ” РµРіРѕ РґР°РЅРЅС‹Рµ РЅРµ СЃС‡РёС‚Р°СЋС‚СЃСЏ.

> **Stage guard (v2.2.0):** `pendingChatsCount` РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ `0` РґР»СЏ РјР°РіР°Р·РёРЅРѕРІ, С‡РµР№ СЌС‚Р°Рї РЅРёР¶Рµ `chats_opened`. Р§Р°С‚-Р·Р°РґР°С‡Рё РґРѕСЃС‚СѓРїРЅС‹ С‚РѕР»СЊРєРѕ РЅР° СЌС‚Р°РїР°С… `chats_opened` Рё `monitoring`. РЎРј. СЂР°Р·РґРµР» [Р­С‚Р°РїС‹ СЂР°Р±РѕС‚С‹ СЃ РєР°Р±РёРЅРµС‚РѕРј](#СЌС‚Р°РїС‹-СЂР°Р±РѕС‚С‹-СЃ-РєР°Р±РёРЅРµС‚РѕРј-store-lifecycle).

> **Date filter (v2.2.2):** `pendingStatusParsesCount` СѓС‡РёС‚С‹РІР°РµС‚ `product_rules.work_from_date` вЂ” РѕС‚Р·С‹РІС‹ РґРѕ СЌС‚РѕР№ РґР°С‚С‹ (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ `2023-10-01`) РЅРµ РІРєР»СЋС‡Р°СЋС‚СЃСЏ РІ СЃС‡С‘С‚С‡РёРє. РђРЅР°Р»РѕРіРёС‡РЅРѕ РІ `statusParses` Рё `totalCounts` РІ `/tasks`.

**РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ (2026-03-02):**
- 3 РїР°СЂР°Р»Р»РµР»СЊРЅС‹С… Р·Р°РїСЂРѕСЃР° С‡РµСЂРµР· `Promise.all`, ~2s РЅР° 76 РјР°РіР°Р·РёРЅРѕРІ / 2.7M РѕС‚Р·С‹РІРѕРІ
- Q1 (drafts): subquery scoped Рє `store_id IN (owner's stores)` вЂ” 165ms
- Q2 (statusParses): reversed JOIN `FROM products в†’ reviews`, РёСЃРїРѕР»СЊР·СѓРµС‚ partial index `idx_reviews_parse_pending` вЂ” 1.7s
- Q3 (pendingChats): РёСЃРїРѕР»СЊР·СѓРµС‚ `idx_rcl_matching` РґР»СЏ NOT EXISTS вЂ” 2s

---

### 2a. Active Products

#### GET /api/extension/stores/{storeId}/active-products

Returns active products for a store (only `work_status = 'active'`).

**Response 200:**

```json
{
  "products": [
    {
      "id": "7kKX9WgLvOPiXYIHk6hi_766104062",
      "wb_product_id": "766104062",
      "vendor_code": "ART-001-BLK",
      "name": "Р¤СѓС‚Р±РѕР»РєР° РјСѓР¶СЃРєР°СЏ РѕРІРµСЂСЃР°Р№Р· С…Р»РѕРїРѕРє",
      "work_status": "active",
      "rules": {
        "submit_complaints": true,
        "complaint_rating_1": true,
        "complaint_rating_2": true,
        "complaint_rating_3": false,
        "complaint_rating_4": false,
        "work_in_chats": true,
        "chat_strategy": null
      }
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| wb_product_id | string | WB nmId (article number) |
| rules.submit_complaints | boolean | Whether to file complaints |
| rules.complaint_rating_1..4 | boolean | Which ratings to complain about |
| rules.work_in_chats | boolean | Whether to work with chats |

---

### 2b. Extension Tasks

#### GET /api/extension/stores/{storeId}/tasks

Returns all extension tasks grouped by article. Main endpoint for the status checker extension.

> **Stage guard (v2.2.0+):** Р•СЃР»Рё `stores.stage` РЅРµ РІ `['chats_opened', 'monitoring']`, РјР°СЃСЃРёРІС‹ `chatOpens` Рё `chatLinks` РІСЃРµРіРґР° РїСѓСЃС‚С‹ (SQL-Р·Р°РїСЂРѕСЃС‹ РЅРµ РІС‹РїРѕР»РЅСЏСЋС‚СЃСЏ), Р° `totalCounts` РґР»СЏ С‡Р°С‚РѕРІ = 0. `statusParses` РґР»СЏ chat-only СЂРµР№С‚РёРЅРіРѕРІ (Р±РµР· `submit_complaints`) С‚Р°РєР¶Рµ РёСЃРєР»СЋС‡Р°СЋС‚СЃСЏ РґРѕ СЌС‚Р°РїР° С‡Р°С‚РѕРІ (Sprint 009). `complaints` РІРѕР·РІСЂР°С‰Р°СЋС‚СЃСЏ РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ СЌС‚Р°РїР°.
>
> **Date filter (v2.2.2):** `statusParses` Рё `totalCounts.statusParses` РёСЃРєР»СЋС‡Р°СЋС‚ РѕС‚Р·С‹РІС‹ РґРѕ `product_rules.work_from_date` (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ `2023-10-01`). РћС‚Р·С‹РІС‹ РґРѕ СЌС‚РѕР№ РґР°С‚С‹ РЅРµ РјРѕРіСѓС‚ РёРјРµС‚СЊ Р¶Р°Р»РѕР± Рё С‡Р°С‚РѕРІ вЂ” РїР°СЂСЃРёРЅРі Р±РµСЃРїРѕР»РµР·РµРЅ.
>
> **Draft exclusion (v2.2.3):** РћС‚Р·С‹РІС‹ СЃ draft-Р¶Р°Р»РѕР±Р°РјРё (`review_complaints.status = 'draft'`) РёСЃРєР»СЋС‡РµРЅС‹ РёР· `statusParses`. Р Р°СЃС€РёСЂРµРЅРёРµ Рё С‚Р°Рє Р·Р°Р№РґС‘С‚ РЅР° СЃС‚СЂР°РЅРёС†Сѓ СЂР°РґРё РїРѕРґР°С‡Рё Р¶Р°Р»РѕР±С‹ Рё СЃРїР°СЂСЃРёС‚ СЃС‚Р°С‚СѓСЃ РєР°Рє РїРѕР±РѕС‡РЅС‹Р№ СЌС„С„РµРєС‚. РџРѕСЃР»Рµ РїРѕРґР°С‡Рё Р¶Р°Р»РѕР±С‹ (СЃС‚Р°С‚СѓСЃ в†’ sent/rejected) РѕС‚Р·С‹РІ РІРµСЂРЅС‘С‚СЃСЏ РІ statusParses РµСЃР»Рё chat_status РІСЃС‘ РµС‰С‘ РЅРµРёР·РІРµСЃС‚РµРЅ.

**Response 200:**

```json
{
  "storeId": "7kKX9WgLvOPiXYIHk6hi",
  "articles": {
    "766104062": {
      "nmId": "766104062",
      "statusParses": [
        {
          "reviewId": "review_abc123",
          "reviewKey": "766104062_1_2026-01-15T10:30",
          "rating": 1,
          "date": "2026-01-15T10:30:37.000Z",
          "authorName": "РџРѕРєСѓРїР°С‚РµР»СЊ Рђ.",
          "text": "РЈР¶Р°СЃРЅРѕРµ РєР°С‡РµСЃС‚РІРѕ...",
          "currentComplaintStatus": "draft",
          "currentChatStatus": null,
          "currentReviewStatus": null
        }
      ],
      "chatOpens": [],
      "complaints": []
    }
  },
  "totals": {
    "statusParses": 3,
    "chatOpens": 0,
    "chatOpensNew": 0,
    "chatLinks": 0,
    "complaints": 0,
    "articles": 2
  },
  "totalCounts": {
    "statusParses": 150,
    "chatOpens": 0,
    "chatOpensNew": 0,
    "chatLinks": 0,
    "complaints": 0
  },
  "limits": {
    "maxChatsPerRun": 50,
    "maxComplaintsPerRun": 300,
    "cooldownBetweenChatsMs": 3000,
    "cooldownBetweenComplaintsMs": 1000
  }
}
```

**Key fields in `statusParses`:**

| Field | Type | Description |
|-------|------|-------------|
| reviewKey | string | `{nmId}_{rating}_{YYYY-MM-DDTHH:mm}` вЂ” key for matching reviews on WB |
| currentComplaintStatus | string\|null | `null`, `draft`, `pending`, `approved`, `rejected` |

**Limits:**
- `statusParses` returns up to 500 reviews per request
- `totalCounts.statusParses` shows total count (for progress bar)

---

### 3. Complaints Queue

#### GET /api/extension/stores/{storeId}/complaints

РџРѕР»СѓС‡РµРЅРёРµ РѕС‡РµСЂРµРґРё Р¶Р°Р»РѕР± РґР»СЏ РјР°СЃСЃРѕРІРѕР№ РїРѕРґР°С‡Рё.

**Query Parameters:**

| РџР°СЂР°РјРµС‚СЂ | РўРёРї | Default | РћРїРёСЃР°РЅРёРµ |
|----------|-----|---------|----------|
| filter | string | 'draft' | Р¤РёР»СЊС‚СЂ СЃС‚Р°С‚СѓСЃР°: 'draft', 'all' |
| limit | number | 100 | Р›РёРјРёС‚ (max: 500) |
| rating | string | '1,2,3' | Р РµР№С‚РёРЅРіРё С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ |

**Response 200:**

```json
{
  "complaints": [
    {
      "id": "MDZTXVilHWCXBK1YZx4u",
      "productId": "649502497",
      "rating": 1,
      "text": "РўРµРєСЃС‚ РѕС‚Р·С‹РІР°...",
      "authorName": "РђР»РёРЅР°",
      "createdAt": "2026-01-07T20:09:37.000Z",
      "complaintText": {
        "reasonId": 11,
        "reasonName": "РћС‚Р·С‹РІ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє С‚РѕРІР°СЂСѓ",
        "complaintText": "РўРµРєСЃС‚ Р¶Р°Р»РѕР±С‹..."
      }
    }
  ],
  "total": 601,
  "stats": {
    "by_rating": { "1": 205, "2": 123, "3": 273 },
    "by_article": { "649502497": 78, "528735233": 52 }
  }
}
```

---

### 4. Complaint Status Update

#### POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent

РћС‚РјРµС‚РёС‚СЊ Р¶Р°Р»РѕР±Сѓ РєР°Рє РѕС‚РїСЂР°РІР»РµРЅРЅСѓСЋ.

**Request:**

```json
{
  "sentAt": "2026-02-01T14:30:00.000Z"
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Complaint marked as sent"
}
```

---

### 5. Stats

#### GET /api/extension/stores/{storeId}/stats

РџРѕР»СѓС‡РµРЅРёРµ СЃС‚Р°С‚РёСЃС‚РёРєРё РјР°РіР°Р·РёРЅР°.

**Response 200:**

```json
{
  "totalReviews": 15234,
  "complaintsQueue": {
    "draft": 601,
    "sent": 2340,
    "approved": 1523,
    "rejected": 234
  },
  "lastSync": "2026-02-01T08:00:00.000Z"
}
```

---

## Р‘Р°Р·Р° РґР°РЅРЅС‹С…

### РўР°Р±Р»РёС†Р°: review_statuses_from_extension

РҐСЂР°РЅРёС‚ СЃС‚Р°С‚СѓСЃС‹ РѕС‚Р·С‹РІРѕРІ, СЃРїР°СЂСЃРµРЅРЅС‹Рµ Chrome Extension.

```sql
CREATE TABLE review_statuses_from_extension (
    id SERIAL PRIMARY KEY,
    review_key VARCHAR(100) NOT NULL,           -- {productId}_{rating}_{datetime}
    store_id TEXT NOT NULL REFERENCES stores(id),
    product_id VARCHAR(50) NOT NULL,            -- WB nmId
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_date TIMESTAMPTZ NOT NULL,
    statuses JSONB NOT NULL DEFAULT '[]',       -- ["Р–Р°Р»РѕР±Р° РѕС‚РєР»РѕРЅРµРЅР°", "Р’С‹РєСѓРї"]
    can_submit_complaint BOOLEAN NOT NULL DEFAULT true,
    parsed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_review_key_store UNIQUE (review_key, store_id)
);
```

**РРЅРґРµРєСЃС‹:**
- `idx_ext_statuses_store_can_submit` - РѕСЃРЅРѕРІРЅРѕР№ Р·Р°РїСЂРѕСЃ С„РёР»СЊС‚СЂР°С†РёРё
- `idx_ext_statuses_product_rating_date` - РјР°С‚С‡РёРЅРі СЃ РѕСЃРЅРѕРІРЅРѕР№ С‚Р°Р±Р»РёС†РµР№
- `idx_ext_statuses_parsed_at` - СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ РІСЂРµРјРµРЅРё РїР°СЂСЃРёРЅРіР°

---

### РўР°Р±Р»РёС†Р°: reviews (РѕСЃРЅРѕРІРЅР°СЏ)

**РљР»СЋС‡РµРІС‹Рµ РїРѕР»СЏ РґР»СЏ Extension:**

| РџРѕР»Рµ | РўРёРї | РћРїРёСЃР°РЅРёРµ |
|------|-----|----------|
| id | TEXT | РЈРЅРёРєР°Р»СЊРЅС‹Р№ ID РѕС‚Р·С‹РІР° |
| product_id | TEXT в†’ products.id | РЎСЃС‹Р»РєР° РЅР° С‚РѕРІР°СЂ |
| rating | INTEGER | Р РµР№С‚РёРЅРі 1-5 |
| text | TEXT | РўРµРєСЃС‚ РѕС‚Р·С‹РІР° |
| complaint_status | ENUM | РЎС‚Р°С‚СѓСЃ Р¶Р°Р»РѕР±С‹ |

**complaint_status ENUM:**

```sql
'not_sent'     -- Р–Р°Р»РѕР±Р° РЅРµ СЃРѕР·РґР°РЅР°
'draft'        -- Р§РµСЂРЅРѕРІРёРє (AI СЃРіРµРЅРµСЂРёСЂРѕРІР°Р»)
'sent'         -- РћС‚РїСЂР°РІР»РµРЅР°
'pending'      -- РќР° СЂР°СЃСЃРјРѕС‚СЂРµРЅРёРё WB
'approved'     -- РћРґРѕР±СЂРµРЅР° WB
'rejected'     -- РћС‚РєР»РѕРЅРµРЅР° WB
'reconsidered' -- РџРµСЂРµСЃРјРѕС‚СЂРµРЅР° (NEW)
```

---

### РўР°Р±Р»РёС†Р°: review_complaints

1:1 СЃРІСЏР·СЊ СЃ reviews, С…СЂР°РЅРёС‚ РґРµС‚Р°Р»Рё Р¶Р°Р»РѕР±С‹.

**РљР»СЋС‡РµРІС‹Рµ РїРѕР»СЏ:**

| РџРѕР»Рµ | РўРёРї | РћРїРёСЃР°РЅРёРµ |
|------|-----|----------|
| review_id | TEXT | FK в†’ reviews.id |
| complaint_text | TEXT | РўРµРєСЃС‚ Р¶Р°Р»РѕР±С‹ |
| reason_id | INTEGER | ID РїСЂРёС‡РёРЅС‹ WB (11-20) |
| reason_name | TEXT | РќР°Р·РІР°РЅРёРµ РїСЂРёС‡РёРЅС‹ |
| status | TEXT | draft/sent/approved/rejected/pending |
| sent_at | TIMESTAMPTZ | Р”Р°С‚Р° РѕС‚РїСЂР°РІРєРё |

---

## РњР°РїРїРёРЅРі СЃС‚Р°С‚СѓСЃРѕРІ

### РЎС‚Р°С‚СѓСЃС‹ РѕС‚ Extension в†’ complaint_status

| WB Interface | в†’ | complaint_status |
|--------------|---|------------------|
| Р–Р°Р»РѕР±Р° РѕС‚РєР»РѕРЅРµРЅР° | в†’ | rejected |
| Р–Р°Р»РѕР±Р° РѕРґРѕР±СЂРµРЅР° | в†’ | approved |
| РџСЂРѕРІРµСЂСЏРµРј Р¶Р°Р»РѕР±Сѓ | в†’ | pending |
| Р–Р°Р»РѕР±Р° РїРµСЂРµСЃРјРѕС‚СЂРµРЅР° | в†’ | reconsidered |
| (РЅРµС‚ СЃС‚Р°С‚СѓСЃР°) | в†’ | not_sent/draft |

### Р›РѕРіРёРєР° canSubmitComplaint

```javascript
const COMPLAINT_STATUSES = [
  'Р–Р°Р»РѕР±Р° РѕС‚РєР»РѕРЅРµРЅР°',
  'Р–Р°Р»РѕР±Р° РѕРґРѕР±СЂРµРЅР°',
  'РџСЂРѕРІРµСЂСЏРµРј Р¶Р°Р»РѕР±Сѓ',
  'Р–Р°Р»РѕР±Р° РїРµСЂРµСЃРјРѕС‚СЂРµРЅР°'
];

// РњРѕР¶РЅРѕ РїРѕРґР°С‚СЊ = РќР•Рў РЅРё РѕРґРЅРѕРіРѕ СЃС‚Р°С‚СѓСЃР° Р¶Р°Р»РѕР±С‹
const canSubmitComplaint = !statuses.some(s => COMPLAINT_STATUSES.includes(s));
```

---

## РўРµСЃС‚РѕРІС‹Рµ РґР°РЅРЅС‹Рµ

### Production Environment

```bash
Base URL: http://158.160.139.99
Test Token: wbrm_0ab7137430d4fb62948db3a7d9b4b997
Test Store: 7kKX9WgLvOPiXYIHk6hi (РРџ РђСЂС‚СЋС€РёРЅР°)
```

### РџСЂРёРјРµСЂС‹ Р·Р°РїСЂРѕСЃРѕРІ

#### РўРµСЃС‚ POST review-statuses:

```bash
curl -X POST "http://158.160.139.99/api/extension/review-statuses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
  -d '{
    "storeId": "7kKX9WgLvOPiXYIHk6hi",
    "parsedAt": "2026-02-01T14:00:00.000Z",
    "reviews": [
      {
        "reviewKey": "649502497_1_2026-01-07T20:09",
        "productId": "649502497",
        "rating": 1,
        "reviewDate": "2026-01-07T20:09:37.000Z",
        "statuses": ["Р–Р°Р»РѕР±Р° РѕС‚РєР»РѕРЅРµРЅР°"],
        "canSubmitComplaint": false,
        "ratingExcluded": true
      }
    ]
  }'
```

#### РўРµСЃС‚ GET review-statuses:

```bash
curl "http://158.160.139.99/api/extension/review-statuses?storeId=7kKX9WgLvOPiXYIHk6hi&limit=10" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

#### РўРµСЃС‚ GET complaints:

```bash
curl "http://158.160.139.99/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=5" \
  -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
```

---

## Р’РѕСЂРєС„Р»РѕСѓ РёРЅС‚РµРіСЂР°С†РёРё

### РџРѕР»РЅС‹Р№ С†РёРєР» РїРѕРґР°С‡Рё Р¶Р°Р»РѕР±

```
1. Extension РїР°СЂСЃРёС‚ СЃС‚СЂР°РЅРёС†Сѓ WB seller cabinet
                    в”‚
                    в–ј
2. POST /api/extension/review-statuses
   (РѕС‚РїСЂР°РІР»СЏРµРј СЃС‚Р°С‚СѓСЃС‹ РІСЃРµС… РѕС‚Р·С‹РІРѕРІ)
                    в”‚
                    в–ј
3. Backend СЃРѕС…СЂР°РЅСЏРµС‚ РІ review_statuses_from_extension
   Рё РїРµСЂРµРЅРѕСЃРёС‚ РІ РѕСЃРЅРѕРІРЅСѓСЋ С‚Р°Р±Р»РёС†Сѓ reviews
                    в”‚
                    в–ј
4. CRON job РіРµРЅРµСЂРёСЂСѓРµС‚ Р¶Р°Р»РѕР±С‹ РўРћР›Р¬РљРћ РґР»СЏ РѕС‚Р·С‹РІРѕРІ
   РіРґРµ can_submit_complaint = true
                    в”‚
                    в–ј
5. GET /api/extension/stores/:id/complaints
   (Extension РїРѕР»СѓС‡Р°РµС‚ РіРѕС‚РѕРІС‹Рµ Р¶Р°Р»РѕР±С‹)
                    в”‚
                    в–ј
6. Extension РїРѕРґР°РµС‚ Р¶Р°Р»РѕР±С‹ РІ WB
                    в”‚
                    в–ј
7. POST /api/extension/stores/:id/reviews/:id/complaint/sent
   (Extension РѕС‚РјРµС‡Р°РµС‚ Р¶Р°Р»РѕР±С‹ РєР°Рє РѕС‚РїСЂР°РІР»РµРЅРЅС‹Рµ)
          в”‚
          в–ј
8. Extension Complaint Checker РїСЂРѕРІРµСЂСЏРµС‚ СЃС‚Р°С‚СѓСЃС‹ Р¶Р°Р»РѕР± РЅР° WB
          в”‚
          в–ј
9. POST /api/extension/complaint-statuses
   (Extension РїРµСЂРµРґР°С‘С‚ СЃС‚Р°С‚СѓСЃС‹ РІСЃРµС… Р¶Р°Р»РѕР± + РєС‚Рѕ РїРѕРґР°РІР°Р»)
          в”‚
          в–ј
10. РџСЂРё РѕРґРѕР±СЂРµРЅРёРё вЂ” Extension РґРµР»Р°РµС‚ СЃРєСЂРёРЅС€РѕС‚
          в”‚
          в–ј
11. POST /api/extension/complaint-details
    (Extension РїРµСЂРµРґР°С‘С‚ РїРѕР»РЅС‹Рµ РґР°РЅРЅС‹Рµ РѕРґРѕР±СЂРµРЅРЅРѕР№ Р¶Р°Р»РѕР±С‹)
```

---

### 6. Complaint Statuses (Bulk Status Sync)

#### POST /api/extension/complaint-statuses

РњР°СЃСЃРѕРІРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ СЃС‚Р°С‚СѓСЃРѕРІ Р¶Р°Р»РѕР±. Р Р°СЃС€РёСЂРµРЅРёРµ РїР°СЂСЃРёС‚ СЃС‚СЂР°РЅРёС†Сѓ Р¶Р°Р»РѕР± WB Рё РїРµСЂРµРґР°С‘С‚ С‚РµРєСѓС‰РёРµ СЃС‚Р°С‚СѓСЃС‹.

**Request:**

```json
{
  "storeId": "store_123",
  "results": [
    {
      "reviewKey": "149325538_1_2026-02-18T21:45",
      "status": "Р–Р°Р»РѕР±Р° РѕРґРѕР±СЂРµРЅР°",
      "filedBy": "R5",
      "complaintDate": "15.02.2026"
    }
  ]
}
```

| РџРѕР»Рµ | РўРёРї | РћРїРёСЃР°РЅРёРµ |
|------|-----|----------|
| reviewKey | string | `{nmId}_{rating}_{YYYY-MM-DDTHH:mm}` |
| status | string | "Р–Р°Р»РѕР±Р° РѕРґРѕР±СЂРµРЅР°" / "Р–Р°Р»РѕР±Р° РѕС‚РєР»РѕРЅРµРЅР°" / "РџСЂРѕРІРµСЂСЏРµРј Р¶Р°Р»РѕР±Сѓ" / "Р–Р°Р»РѕР±Р° РїРµСЂРµСЃРјРѕС‚СЂРµРЅР°" |
| filedBy | string | "R5" РёР»Рё "РџСЂРѕРґР°РІРµС†" |
| complaintDate | string\|null | Р”Р°С‚Р° РїРѕРґР°С‡Рё DD.MM.YYYY, null РµСЃР»Рё РїРѕРґР°Р» РїСЂРѕРґР°РІРµС† |

**Р§С‚Рѕ РѕР±РЅРѕРІР»СЏРµС‚:**
- `reviews.complaint_status` + `complaint_filed_by` + `complaint_filed_date`
- `review_complaints.status` + `filed_by` + `complaint_filed_date`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "received": 50,
    "valid": 48,
    "reviewsUpdated": 45,
    "complaintsUpdated": 40,
    "skipped": 2
  },
  "elapsed": 234
}
```

---

### 7. Complaint Details (Approved Complaint Data)

#### POST /api/extension/complaint-details

РџРѕР»РЅС‹Рµ РґР°РЅРЅС‹Рµ РѕРґРѕР±СЂРµРЅРЅРѕР№ Р¶Р°Р»РѕР±С‹. Р’С‹Р·С‹РІР°РµС‚СЃСЏ РїРѕСЃР»Рµ РєР°Р¶РґРѕРіРѕ СЃРєСЂРёРЅС€РѕС‚Р°. Р—РµСЂРєР°Р»Рѕ Google Sheets "Р–Р°Р»РѕР±С‹ V 2.0".

**РќР°Р·РЅР°С‡РµРЅРёРµ:** Р‘РёР»Р»РёРЅРі, РѕС‚С‡С‘С‚РЅРѕСЃС‚СЊ РєР»РёРµРЅС‚Р°Рј, РѕР±СѓС‡РµРЅРёРµ AI РЅР° СЂРµР°Р»СЊРЅС‹С… РѕРґРѕР±СЂРµРЅРЅС‹С… РєРµР№СЃР°С….

**Request:**

```json
{
  "storeId": "store_123",
  "complaint": {
    "checkDate": "20.02.2026",
    "cabinetName": "РњРѕР№РњР°РіР°Р·РёРЅ",
    "articul": "149325538",
    "reviewId": "",
    "feedbackRating": 1,
    "feedbackDate": "18 С„РµРІСЂ. 2026 Рі. РІ 21:45",
    "complaintSubmitDate": "15.02.2026",
    "status": "РћРґРѕР±СЂРµРЅР°",
    "hasScreenshot": true,
    "fileName": "149325538_18.02.26_21-45.png",
    "driveLink": "https://drive.google.com/file/d/abc123/view",
    "complaintCategory": "РћС‚Р·С‹РІ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє С‚РѕРІР°СЂСѓ",
    "complaintText": "Р–Р°Р»РѕР±Р° РѕС‚: 20.02.2026\n\nРћС‚Р·С‹РІ РїРѕРєСѓРїР°С‚РµР»СЏ РЅРµ СЃРѕРґРµСЂР¶РёС‚..."
  }
}
```

**Р”РµРґСѓРїР»РёРєР°С†РёСЏ:** `store_id + articul + feedbackDate + fileName`

**filed_by Р°РІС‚РѕРґРµС‚РµРєС†РёСЏ:** complaintText РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ "Р–Р°Р»РѕР±Р° РѕС‚:" в†’ `r5`, РёРЅР°С‡Рµ в†’ `seller`

**Response (created):**
```json
{ "success": true, "data": { "created": true } }
```

**Response (duplicate):**
```json
{ "success": true, "data": { "created": false, "reason": "duplicate" } }
```

---

## Error Handling

### РЎС‚Р°РЅРґР°СЂС‚РЅС‹Рµ РєРѕРґС‹ РѕС€РёР±РѕРє

| HTTP Status | Error Code | РћРїРёСЃР°РЅРёРµ |
|-------------|------------|----------|
| 400 | VALIDATION_ERROR | РќРµРєРѕСЂСЂРµРєС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ |
| 401 | UNAUTHORIZED | РћС‚СЃСѓС‚СЃС‚РІСѓРµС‚/РЅРµРІРµСЂРЅС‹Р№ С‚РѕРєРµРЅ |
| 403 | FORBIDDEN | РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РјР°РіР°Р·РёРЅСѓ |
| 404 | NOT_FOUND | РњР°РіР°Р·РёРЅ/РѕС‚Р·С‹РІ РЅРµ РЅР°Р№РґРµРЅ |
| 429 | RATE_LIMITED | РџСЂРµРІС‹С€РµРЅ Р»РёРјРёС‚ Р·Р°РїСЂРѕСЃРѕРІ |
| 500 | INTERNAL_ERROR | Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР° |

### Р¤РѕСЂРјР°С‚ РѕС€РёР±РєРё

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "РћРїРёСЃР°РЅРёРµ РѕС€РёР±РєРё",
    "details": [...]
  }
}
```

---

## Changelog

### v2.2.3 (2026-03-14)

**Sprint 011: Exclude Draft Complaints from statusParses**

- **Draft exclusion:** РћС‚Р·С‹РІС‹ СЃ draft-Р¶Р°Р»РѕР±Р°РјРё (`review_complaints.status = 'draft'`) РёСЃРєР»СЋС‡РµРЅС‹ РёР· `statusParses` Рё `totalCounts.statusParses`. Р Р°СЃС€РёСЂРµРЅРёРµ Рё С‚Р°Рє РїРѕСЃРµС‚РёС‚ СЃС‚СЂР°РЅРёС†Сѓ РґР»СЏ РїРѕРґР°С‡Рё Р¶Р°Р»РѕР±С‹ Рё СЃРїР°СЂСЃРёС‚ СЃС‚Р°С‚СѓСЃ. Р—РЅР°С‡РёС‚РµР»СЊРЅРѕ СѓРјРµРЅСЊС€Р°РµС‚ РїСѓР» Р·Р°РґР°С‡ statusParses РґР»СЏ РЅРѕРІС‹С… РєР°Р±РёРЅРµС‚РѕРІ.
- Р—Р°С‚СЂРѕРЅСѓС‚С‹Рµ endpoints: `GET /stores` (Q2), `GET /stores/{storeId}/tasks` (Query A, Query E)

### v2.2.2 (2026-03-14)

**Sprint 010: work_from_date Filter**

- **Date filter РЅР° statusParses:** РћС‚Р·С‹РІС‹ РґРѕ `product_rules.work_from_date` (default `2023-10-01`) РёСЃРєР»СЋС‡РµРЅС‹ РёР· `statusParses`, `totalCounts.statusParses` Рё `pendingStatusParsesCount`. РЈСЃС‚СЂР°РЅСЏРµС‚ Р±РµСЃРїРѕР»РµР·РЅС‹Р№ РїР°СЂСЃРёРЅРі СЃС‚Р°СЂС‹С… РѕС‚Р·С‹РІРѕРІ, РїРѕ РєРѕС‚РѕСЂС‹Рј РЅРµР»СЊР·СЏ РЅРё РїРѕРґР°С‚СЊ Р¶Р°Р»РѕР±Сѓ, РЅРё РѕС‚РєСЂС‹С‚СЊ С‡Р°С‚.
- Р—Р°С‚СЂРѕРЅСѓС‚С‹Рµ endpoints: `GET /stores` (Q2), `GET /stores/{storeId}/tasks` (Query A, Query E)

### v2.2.1 (2026-03-14)

**Sprint 009: 4-Star Chat Optimization & Stage Guard Completion**

- **Stage guard РЅР° statusParses:** Chat-only СЂРµР№С‚РёРЅРіРё (Р±РµР· `submit_complaints`) РёСЃРєР»СЋС‡Р°СЋС‚СЃСЏ РёР· `statusParses` РєРѕРіРґР° СЌС‚Р°Рї РЅРёР¶Рµ `chats_opened`. РЈСЃС‚СЂР°РЅСЏРµС‚ Р±РµСЃРїРѕР»РµР·РЅС‹Р№ РїР°СЂСЃРёРЅРі 4в… РѕС‚Р·С‹РІРѕРІ РґРѕ СЌС‚Р°РїР° С‡Р°С‚РѕРІ.
- **Stage guard РЅР° `GET /stores`:** `pendingChatsCount` (Q3) + chat-only `statusParses` (Q2) С‚РµРїРµСЂСЊ РїСЂРѕРІРµСЂСЏСЋС‚ `s.stage`
- **Stage guard РЅР° totalCounts:** `chat_opens_total` Рё `chat_links_total` = 0 РµСЃР»Рё СЌС‚Р°Рї РЅРёР¶Рµ `chats_opened`
- Р—Р°РІРµСЂС€Р°РµС‚ РїРѕР»РЅРѕРµ РїРѕРєСЂС‹С‚РёРµ stage guard РґР»СЏ РІСЃРµС… endpoint'РѕРІ СЂР°СЃС€РёСЂРµРЅРёСЏ

### v2.2.0 (2026-03-14)

**Sprint 008: Stage Enforcement**

- **Stage guard РґР»СЏ С‡Р°С‚-Р·Р°РґР°С‡:** `chatOpens`, `chatLinks` Рё `pendingChatsCount` РІРѕР·РІСЂР°С‰Р°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ РјР°РіР°Р·РёРЅРѕРІ РЅР° СЌС‚Р°РїРµ `chats_opened` РёР»Рё `monitoring`. Р”Р»СЏ Р±РѕР»РµРµ СЂР°РЅРЅРёС… СЌС‚Р°РїРѕРІ (`contract` в†’ `complaints_submitted`) вЂ” РїСѓСЃС‚С‹Рµ РјР°СЃСЃРёРІС‹ / 0.
- Р—Р°С‚СЂРѕРЅСѓС‚С‹Рµ endpoints:
  - `GET /api/extension/stores/{storeId}/tasks` вЂ” `chatOpens` Рё `chatLinks` РїСѓСЃС‚С‹ РµСЃР»Рё СЌС‚Р°Рї РЅРёР¶Рµ `chats_opened`
  - `GET /api/extension/chat/stores` вЂ” `pendingChatsCount` = 0 РµСЃР»Рё СЌС‚Р°Рї РЅРёР¶Рµ `chats_opened`
- РЈС‚РёР»РёС‚Р° `isStageAtLeast()` РІ `src/types/stores.ts`

### v2.1.0 (2026-02-20)

**Data Collection Pipeline**

- POST /api/extension/complaint-statuses вЂ” РјР°СЃСЃРѕРІС‹Р№ sync СЃС‚Р°С‚СѓСЃРѕРІ Р¶Р°Р»РѕР± + filed_by + complaintDate
- POST /api/extension/complaint-details вЂ” РїРѕР»РЅС‹Рµ РґР°РЅРЅС‹Рµ РѕРґРѕР±СЂРµРЅРЅС‹С… Р¶Р°Р»РѕР± (source of truth РґР»СЏ Р±РёР»Р»РёРЅРіР°)
- РќРѕРІР°СЏ С‚Р°Р±Р»РёС†Р° `complaint_details` (migration 021) вЂ” Р·РµСЂРєР°Р»Рѕ Google Sheets "Р–Р°Р»РѕР±С‹ V 2.0"
- РџРѕР»СЏ `filed_by` + `complaint_filed_date` РЅР° reviews + review_complaints (migration 020)
- РђРІС‚РѕРґРµС‚РµРєС†РёСЏ filed_by РёР· С‚РµРєСЃС‚Р° Р¶Р°Р»РѕР±С‹ ("Р–Р°Р»РѕР±Р° РѕС‚:" в†’ r5)

### v2.1.0 (2026-03-04) вЂ” PLANNED

**Р—Р°РґР°С‡Р°: Р РµС‚СЂРѕР°РєС‚РёРІРЅР°СЏ РїСЂРёРІСЏР·РєР° С‡Р°С‚РѕРІ + Р·Р°С‰РёС‚Р° СЃС‚Р°С‚СѓСЃРѕРІ**

РџРѕРґСЂРѕР±РЅР°СЏ СЃРїРµС†РёС„РёРєР°С†РёСЏ: `docs/tasks/TASK-20260304-extension-chat-linking-and-status-protection.md`

**Р—Р°РґР°С‡Р° 1: Р РµС‚СЂРѕР°РєС‚РёРІРЅР°СЏ РїСЂРёРІСЏР·РєР° РѕС‚РєСЂС‹С‚С‹С… С‡Р°С‚РѕРІ**
- РџСЂРё РїР°СЂСЃРёРЅРіРµ `chat_status = 'chat_opened'` в†’ РїСЂРѕРІРµСЂРёС‚СЊ РЅР°Р»РёС‡РёРµ `review_chat_links`
- Р•СЃР»Рё РїСЂРёРІСЏР·РєРё РЅРµС‚ в†’ РІС‹Р·РІР°С‚СЊ `POST /api/extension/chat/opened` СЃ РєРѕРЅС‚РµРєСЃС‚РѕРј РѕС‚Р·С‹РІР° (nmId, rating, reviewDate, chatUrl)
- Endpoint РёРґРµРјРїРѕС‚РµРЅС‚РµРЅ (UNIQUE РЅР° store_id + review_key) вЂ” РїРѕРІС‚РѕСЂРЅС‹Рµ РІС‹Р·РѕРІС‹ Р±РµР·РѕРїР°СЃРЅС‹
- **Р¦РµР»СЊ:** Р’СЃРµ 291+ С‡Р°С‚РѕРІ, РѕС‚РєСЂС‹С‚С‹С… РІСЂСѓС‡РЅСѓСЋ РЅР° WB, РїРѕР»СѓС‡Р°С‚ РїСЂРёРІСЏР·РєСѓ Рє РѕС‚Р·С‹РІР°Рј

**Р—Р°РґР°С‡Р° 2: Р—Р°С‰РёС‚Р° РѕС‚ Р»РѕР¶РЅС‹С… СЃС‚Р°С‚СѓСЃРѕРІ**
- Р•СЃР»Рё РєРЅРѕРїРєР° С‡Р°С‚Р° РќР• РЅР°Р№РґРµРЅР° РІ DOM (WB РЅРµ РїСЂРѕРіСЂСѓР·РёР») в†’ РѕС‚РїСЂР°РІР»СЏС‚СЊ `chatStatus: null` (РќР• `'chat_not_activated'`)
- `'chat_not_activated'` в†’ РўРћР›Р¬РљРћ РµСЃР»Рё СЂР°СЃС€РёСЂРµРЅРёРµ **С‚РѕС‡РЅРѕ** РІРёРґРёС‚ disabled РєРЅРѕРїРєСѓ
- Backend-Р·Р°С‰РёС‚Р°: `opened` в†’ `unavailable`/`available` Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ РІ SQL

**Р—Р°С‰РёС‚Р° СЃС‚Р°С‚СѓСЃР° `opened` (СѓР¶Рµ СЂРµР°Р»РёР·РѕРІР°РЅР° РЅР° Р±СЌРєРµРЅРґРµ):**

| РўРµРєСѓС‰РёР№ в†’ РќРѕРІС‹Р№ | unavailable | available | opened |
|----------------|:-----------:|:---------:|:------:|
| NULL/unknown   | вњ… | вњ… | вњ… |
| unavailable    | вЂ” | вњ… | вњ… |
| available      | вњ… | вЂ” | вњ… |
| **opened**     | **вќЊ** | **вќЊ** | вЂ” |

### v2.0.0 (2026-02-16)

**Sprint 002: Review-Chat Linking**

- POST /api/extension/chat/opened вЂ” С„РёРєСЃР°С†РёСЏ РѕС‚РєСЂС‹С‚РёСЏ С‡Р°С‚Р° РёР· СЃС‚СЂР°РЅРёС†С‹ РѕС‚Р·С‹РІРѕРІ
- POST /api/extension/chat/:id/anchor вЂ” С„РёРєСЃР°С†РёСЏ СЃРёСЃС‚РµРјРЅРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ
- POST /api/extension/chat/:id/message-sent вЂ” РѕС‚РїСЂР°РІРєР° СЃС‚Р°СЂС‚РѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ
- POST /api/extension/chat/:id/error вЂ” Р»РѕРіРёСЂРѕРІР°РЅРёРµ РѕС€РёР±РѕРє
- GET /api/extension/chat/stores вЂ” СЃРїРёСЃРѕРє РјР°РіР°Р·РёРЅРѕРІ СЃ chat-workflow
- GET /api/extension/chat/stores/:id/rules вЂ” РїСЂР°РІРёР»Р° С‡Р°С‚-РѕР±СЂР°Р±РѕС‚РєРё

### v1.1.0 (2026-02-01)

**Sprint: Status Sync**

- вњ… Р”РѕР±Р°РІР»РµРЅР° С‚Р°Р±Р»РёС†Р° `review_statuses_from_extension`
- вњ… Р”РѕР±Р°РІР»РµРЅ ENUM Р·РЅР°С‡РµРЅРёРµ `reconsidered` РІ `complaint_status`
- вњ… РќРѕРІС‹Р№ endpoint: `POST /api/extension/review-statuses`
- вњ… РќРѕРІС‹Р№ endpoint: `GET /api/extension/review-statuses`
- вњ… Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ РѕР±РЅРѕРІР»РµРЅР°

**РћР¶РёРґР°РµРјС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚:**
- Р­РєРѕРЅРѕРјРёСЏ ~80% GPT С‚РѕРєРµРЅРѕРІ
- Р“РµРЅРµСЂР°С†РёСЏ Р¶Р°Р»РѕР± С‚РѕР»СЊРєРѕ РґР»СЏ РїРѕРґС…РѕРґСЏС‰РёС… РѕС‚Р·С‹РІРѕРІ

### v1.0.0 (2026-01-29)

- РСЃРїСЂР°РІР»РµРЅ С‚РѕРєРµРЅ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё
- РСЃРїСЂР°РІР»РµРЅР° С„РёР»СЊС‚СЂР°С†РёСЏ РїРѕ СЃС‚Р°С‚СѓСЃСѓ Р¶Р°Р»РѕР±С‹
- РСЃРїСЂР°РІР»РµРЅ С„РѕСЂРјР°С‚ productId (wb_product_id РІРјРµСЃС‚Рѕ vendor_code)
- РЈРґР°Р»РµРЅРѕ РїРѕР»Рµ productName РёР· РѕС‚РІРµС‚Р°

---

## РЎРІСЏР·Р°РЅРЅС‹Рµ РґРѕРєСѓРјРµРЅС‚С‹

- [Sprint-StatusSync/README.md](../docs/Sprint-StatusSync/README.md) - РЎРїРµС†РёС„РёРєР°С†РёСЏ СЃРїСЂРёРЅС‚Р°
- [Sprint-StatusSync/API-SPEC.md](../docs/Sprint-StatusSync/API-SPEC.md) - Р”РµС‚Р°Р»СЊРЅР°СЏ СЃРїРµС†РёС„РёРєР°С†РёСЏ API
- [database-schema.md](./database-schema.md) - РџРѕР»РЅР°СЏ СЃС…РµРјР° Р‘Р”
- [EXTENSION_API_ISSUES_SUMMARY.md](./EXTENSION_API_ISSUES_SUMMARY.md) - РСЃС‚РѕСЂРёСЏ СЂРµС€С‘РЅРЅС‹С… РїСЂРѕР±Р»РµРј

---

## РљРѕРЅС‚Р°РєС‚С‹

**Backend Team:** WB Reputation Manager v2.0.0
**Repository:** https://github.com/Klimov-IS/R5-Saas-v-2.0
**Production:** http://158.160.139.99

---

**РџРѕСЃР»РµРґРЅРµРµ РѕР±РЅРѕРІР»РµРЅРёРµ:** 2026-03-14
**РђРІС‚РѕСЂ:** R5 Backend Team
