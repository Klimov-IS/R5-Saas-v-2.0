# R5 API Reference

**Р’РµСЂСЃРёСЏ:** 1.0
**Base URL:** `http://158.160.139.99`
**Swagger UI:** `http://158.160.139.99/api/docs`

---

## РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ

### JWT Auth (РѕСЃРЅРѕРІРЅРѕРµ РџРћ)

JWT token РІ httpOnly cookie `r5_token` (HS256, 7-day expiry). РЈСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РїСЂРё `POST /api/auth/login`.

### Bearer Auth (Extension API)

```http
Authorization: Bearer wbrm_xxxxxxxxxxxxxxxxxxxxx
```

**Р¤РѕСЂРјР°С‚ С‚РѕРєРµРЅР°:** `wbrm_*` (С…СЂР°РЅРёС‚СЃСЏ РІ `user_settings.api_key`)

### Telegram Auth (Mini App API)

```http
X-Telegram-Init-Data: <initData string>
```

HMAC-SHA256 РІР°Р»РёРґР°С†РёСЏ СЃ BOT_TOKEN. initData СЃРѕРґРµСЂР¶РёС‚ `user.id` в†’ lookup `telegram_users`.

---

## Stores (РњР°РіР°Р·РёРЅС‹)

### GET /api/stores

РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РІСЃРµС… РјР°РіР°Р·РёРЅРѕРІ.

**Response:**
```json
{
  "stores": [
    {
      "id": "abc123",
      "name": "РўР°Р№РґРё Р¦РµРЅС‚СЂ",
      "status": "active",
      "total_reviews": 1344055,
      "total_chats": 5420,
      "last_review_update_date": "2026-02-08T05:00:00Z"
    }
  ]
}
```

---

### POST /api/stores

РЎРѕР·РґР°С‚СЊ РЅРѕРІС‹Р№ РјР°РіР°Р·РёРЅ.

**Request:**
```json
{
  "name": "РќРѕРІС‹Р№ РјР°РіР°Р·РёРЅ",
  "api_token": "WB_TOKEN_HERE"
}
```

---

### GET /api/stores/:storeId

РџРѕР»СѓС‡РёС‚СЊ РґРµС‚Р°Р»Рё РјР°РіР°Р·РёРЅР°.

---

### PATCH /api/stores/:storeId

РћР±РЅРѕРІРёС‚СЊ РјР°РіР°Р·РёРЅ.

**Request:**
```json
{
  "name": "РћР±РЅРѕРІР»РµРЅРЅРѕРµ РЅР°Р·РІР°РЅРёРµ",
  "status": "inactive"
}
```

---

### DELETE /api/stores/:storeId

РЈРґР°Р»РёС‚СЊ РјР°РіР°Р·РёРЅ (CASCADE: СѓРґР°Р»СЏРµС‚ РІСЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ).

---

### PATCH /api/stores/:storeId/status

РР·РјРµРЅРёС‚СЊ СЃС‚Р°С‚СѓСЃ РјР°РіР°Р·РёРЅР°.

**Request:**
```json
{
  "status": "active" | "inactive"
}
```

---

## Products (РўРѕРІР°СЂС‹)

### GET /api/stores/:storeId/products

РџРѕР»СѓС‡РёС‚СЊ С‚РѕРІР°СЂС‹ РјР°РіР°Р·РёРЅР°.

**Query params:**
- `skip` вЂ” offset (default: 0)
- `take` вЂ” limit (default: 50)
- `is_active` вЂ” С„РёР»СЊС‚СЂ РїРѕ Р°РєС‚РёРІРЅРѕСЃС‚Рё
- `work_status` вЂ” С„РёР»СЊС‚СЂ РїРѕ work_status

---

### POST /api/stores/:storeId/products/update

РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ С‚РѕРІР°СЂС‹ СЃ WB Content API.

**Response:**
```json
{
  "message": "Synced 150 products",
  "created": 10,
  "updated": 140
}
```

---

### PATCH /api/stores/:storeId/products/:productId/status

РР·РјРµРЅРёС‚СЊ СЃС‚Р°С‚СѓСЃ С‚РѕРІР°СЂР°.

**Request:**
```json
{
  "is_active": true,
  "work_status": "active"
}
```

---

### GET /api/stores/:storeId/products/:productId/rules

РџРѕР»СѓС‡РёС‚СЊ РїСЂР°РІРёР»Р° С‚РѕРІР°СЂР° (product_rules).

---

### PUT /api/stores/:storeId/products/:productId/rules

РћР±РЅРѕРІРёС‚СЊ РїСЂР°РІРёР»Р° С‚РѕРІР°СЂР°.

**Request:**
```json
{
  "submit_complaints": true,
  "complaint_rating_1": true,
  "complaint_rating_2": true,
  "complaint_rating_3": true,
  "work_in_chats": false,
  "offer_compensation": false
}
```

---

### POST /api/stores/:storeId/products/bulk-actions

РњР°СЃСЃРѕРІС‹Рµ РґРµР№СЃС‚РІРёСЏ СЃ С‚РѕРІР°СЂР°РјРё.

**Request:**
```json
{
  "product_ids": ["id1", "id2"],
  "action": "activate" | "deactivate" | "enable_complaints"
}
```

---

## Reviews (РћС‚Р·С‹РІС‹)

### GET /api/stores/:storeId/reviews

РџРѕР»СѓС‡РёС‚СЊ РѕС‚Р·С‹РІС‹ РјР°РіР°Р·РёРЅР°.

**Query params:**
- `skip`, `take` вЂ” РїР°РіРёРЅР°С†РёСЏ
- `rating` вЂ” С„РёР»СЊС‚СЂ РїРѕ СЂРµР№С‚РёРЅРіСѓ (1-5)
- `has_complaint` вЂ” boolean
- `complaint_status` вЂ” not_sent, draft, sent, pending, approved, rejected
- `is_product_active` вЂ” boolean
- `dateFrom`, `dateTo` вЂ” РґРёР°РїР°Р·РѕРЅ РґР°С‚

**Response:**
```json
{
  "reviews": [...],
  "total": 1500,
  "page": 1,
  "pageSize": 50
}
```

---

### POST /api/stores/:storeId/reviews/update

РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ РѕС‚Р·С‹РІС‹ СЃ WB Feedbacks API.

**Query params:**
- `mode` вЂ” `incremental` (default) | `full`

**Response:**
```json
{
  "message": "Synced 150 new reviews",
  "synced": 150,
  "skipped": 0
}
```

**Note:** Full sync РёСЃРїРѕР»СЊР·СѓРµС‚ adaptive chunking РґР»СЏ РѕР±С…РѕРґР° Р»РёРјРёС‚Р° WB API РІ 20k РѕС‚Р·С‹РІРѕРІ.

---

### GET /api/stores/:storeId/reviews/stats

РЎС‚Р°С‚РёСЃС‚РёРєР° РѕС‚Р·С‹РІРѕРІ.

**Response:**
```json
{
  "total": 1344055,
  "by_rating": { "1": 5000, "2": 3000, "3": 8000, "4": 50000, "5": 1278055 },
  "with_complaints": 15000,
  "pending_complaints": 500
}
```

---

### GET /api/stores/:storeId/reviews/:reviewId

РџРѕР»СѓС‡РёС‚СЊ РґРµС‚Р°Р»Рё РѕС‚Р·С‹РІР°.

---

### PATCH /api/stores/:storeId/reviews/:reviewId

РћР±РЅРѕРІРёС‚СЊ РѕС‚Р·С‹РІ.

**Request:**
```json
{
  "draft_reply": "РўРµРєСЃС‚ С‡РµСЂРЅРѕРІРёРєР° РѕС‚РІРµС‚Р°"
}
```

---

### POST /api/stores/:storeId/reviews/:reviewId/generate-reply

РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ AI РѕС‚РІРµС‚ РЅР° РѕС‚Р·С‹РІ.

**Response:**
```json
{
  "text": "Р”РѕР±СЂС‹Р№ РґРµРЅСЊ! Р‘Р»Р°РіРѕРґР°СЂРёРј Р·Р° РѕС‚Р·С‹РІ...",
  "tokens": { "prompt": 250, "completion": 100, "total": 350 },
  "cost": 0.00015
}
```

---

### POST /api/stores/:storeId/reviews/:reviewId/send

РћС‚РїСЂР°РІРёС‚СЊ РѕС‚РІРµС‚ РЅР° РѕС‚Р·С‹РІ РІ WB.

**Request:**
```json
{
  "text": "РўРµРєСЃС‚ РѕС‚РІРµС‚Р°"
}
```

---

## Complaints (Р–Р°Р»РѕР±С‹)

### GET /api/stores/:storeId/complaints

РџРѕР»СѓС‡РёС‚СЊ Р¶Р°Р»РѕР±С‹ РјР°РіР°Р·РёРЅР°.

**Query params:**
- `status` вЂ” draft, sent, pending, approved, rejected
- `skip`, `take` вЂ” РїР°РіРёРЅР°С†РёСЏ

---

### POST /api/stores/:storeId/reviews/:reviewId/generate-complaint

РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ Р¶Р°Р»РѕР±Сѓ РЅР° РѕС‚Р·С‹РІ.

**Response:**
```json
{
  "success": true,
  "complaint": {
    "id": "complaint_id",
    "complaint_text": "РўРµРєСЃС‚ Р¶Р°Р»РѕР±С‹...",
    "reason_id": 11,
    "reason_name": "РћС‚Р·С‹РІ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє С‚РѕРІР°СЂСѓ",
    "status": "draft"
  },
  "tokens": { "prompt": 500, "completion": 200, "total": 700 },
  "cost": 0.0003
}
```

---

### PUT /api/stores/:storeId/reviews/:reviewId/complaint/sent

РћС‚РјРµС‚РёС‚СЊ Р¶Р°Р»РѕР±Сѓ РєР°Рє РѕС‚РїСЂР°РІР»РµРЅРЅСѓСЋ.

**Request:**
```json
{
  "sent_at": "2026-02-08T10:00:00Z"
}
```

---

## Chats (Р§Р°С‚С‹)

### GET /api/stores/:storeId/chats

РџРѕР»СѓС‡РёС‚СЊ С‡Р°С‚С‹ РјР°РіР°Р·РёРЅР°.

**Query params:**
- `status` вЂ” С„РёР»СЊС‚СЂ РїРѕ СЃС‚Р°С‚СѓСЃСѓ (inbox, awaiting_reply, in_progress, closed, all)
- `sender` вЂ” С„РёР»СЊС‚СЂ РїРѕ РѕС‚РїСЂР°РІРёС‚РµР»СЋ (client, seller, all)
- `tag` вЂ” С„РёР»СЊС‚СЂ РїРѕ С‚РµРіСѓ (deletion_candidate, deletion_offered, deletion_agreed, deletion_confirmed, null). Migration 024: СЃС‚Р°СЂС‹Рµ С‚РµРіРё (active, no_reply, completed, untagged Рё РґСЂ.) СѓРґР°Р»РµРЅС‹.
- `search` вЂ” РїРѕРёСЃРє РїРѕ РёРјРµРЅРё РєР»РёРµРЅС‚Р°, С‚РѕРІР°СЂСѓ, СЃРѕРѕР±С‰РµРЅРёСЋ
- `hasDraft` вЂ” С‚РѕР»СЊРєРѕ С‡Р°С‚С‹ СЃ С‡РµСЂРЅРѕРІРёРєРѕРј (true/false)
- `reviewLinkedOnly` вЂ” С‚РѕР»СЊРєРѕ С‡Р°С‚С‹ РїСЂРёРІСЏР·Р°РЅРЅС‹Рµ Рє РѕС‚Р·С‹РІР°Рј С‡РµСЂРµР· review_chat_links (true)
- `skip`, `take` вЂ” РїР°РіРёРЅР°С†РёСЏ

**Review enrichment fields** (РІ РєР°Р¶РґРѕРј РѕР±СЉРµРєС‚Рµ С‡Р°С‚Р°, РµСЃР»Рё РµСЃС‚СЊ РїСЂРёРІСЏР·РєР° Рє РѕС‚Р·С‹РІСѓ):
- `reviewRating` вЂ” СЂРµР№С‚РёРЅРі РѕС‚Р·С‹РІР° (1-5)
- `reviewDate` вЂ” РґР°С‚Р° РѕС‚Р·С‹РІР°
- `reviewText` вЂ” С‚РµРєСЃС‚ РѕС‚Р·С‹РІР°
- `complaintStatus` вЂ” СЃС‚Р°С‚СѓСЃ Р¶Р°Р»РѕР±С‹ (not_sent, pending, approved, rejected)
- `productStatus` вЂ” СЃС‚Р°С‚СѓСЃ С‚РѕРІР°СЂР° РїРѕ РѕС‚Р·С‹РІСѓ (purchased, refused, unknown)
- `offerCompensation` вЂ” РїСЂРµРґР»Р°РіР°С‚СЊ РєРµС€Р±РµРє (boolean)
- `maxCompensation` вЂ” РјР°РєСЃ. СЃСѓРјРјР° РєРµС€Р±РµРєР°
- `compensationType` вЂ” С‚РёРї РєРµС€Р±РµРєР°
- `compensationBy` вЂ” РєС‚Рѕ РїР»Р°С‚РёС‚ (r5, seller)
- `chatStrategy` вЂ” СЃС‚СЂР°С‚РµРіРёСЏ (upgrade_to_5, delete, both)

---

### GET /api/stores/:storeId/chats/:chatId

РџРѕР»СѓС‡РёС‚СЊ С‡Р°С‚ СЃ РёСЃС‚РѕСЂРёРµР№ СЃРѕРѕР±С‰РµРЅРёР№. Р’РєР»СЋС‡Р°РµС‚ review enrichment РґР°РЅРЅС‹Рµ (СЂРµР№С‚РёРЅРі, РґР°С‚Р°, С‚РµРєСЃС‚ РѕС‚Р·С‹РІР°, СЃС‚СЂР°С‚РµРіРёСЏ, РєРµС€Р±РµРє) С‡РµСЂРµР· JOINs СЃ review_chat_links, reviews, product_rules.

РљР°Р¶РґРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ СЃРѕРґРµСЂР¶РёС‚ `downloadId` (string | null) вЂ” РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІР»РѕР¶РµРЅРёСЏ WB. Р”Р»СЏ Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р° РёСЃРїРѕР»СЊР·СѓР№С‚Рµ proxy endpoint.

---

### GET /api/stores/:storeId/chat-files/:downloadId

Proxy РґР»СЏ РІР»РѕР¶РµРЅРёР№ РёР· WB Buyer Chat API. РўСЂРµР±СѓРµС‚ JWT auth (cookie `r5_token`).

РџСЂРѕРєСЃРёСЂСѓРµС‚ С„Р°Р№Р» СЃ `https://buyer-chat-api.wildberries.ru/api/v1/seller/files/{downloadId}`, РґРѕР±Р°РІР»СЏСЏ WB С‚РѕРєРµРЅ РјР°РіР°Р·РёРЅР°. Р’РѕР·РІСЂР°С‰Р°РµС‚ С„Р°Р№Р» СЃ РѕСЂРёРіРёРЅР°Р»СЊРЅС‹Рј Content-Type. Browser cache: 24 С‡Р°СЃР°.

---

### PATCH /api/stores/:storeId/chats/:chatId

РћР±РЅРѕРІРёС‚СЊ С‡Р°С‚.

**Request:**
```json
{
  "tag": "active",
  "draft_reply": "Р§РµСЂРЅРѕРІРёРє РѕС‚РІРµС‚Р°"
}
```

---

### POST /api/stores/:storeId/chats/:chatId/generate-ai

РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ AI РѕС‚РІРµС‚ РґР»СЏ С‡Р°С‚Р°.

**Response:**
```json
{
  "text": "Р”РѕР±СЂС‹Р№ РґРµРЅСЊ! РџРѕ РІР°С€РµРјСѓ РІРѕРїСЂРѕСЃСѓ...",
  "tokens": { "prompt": 350, "completion": 150, "total": 500 },
  "cost": 0.0002
}
```

---

### POST /api/stores/:storeId/chats/:chatId/send

РћС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ РІ С‡Р°С‚ WB.

**Request:**
```json
{
  "text": "РўРµРєСЃС‚ СЃРѕРѕР±С‰РµРЅРёСЏ"
}
```

---

### PATCH /api/stores/:storeId/chats/:chatId/status

РР·РјРµРЅРёС‚СЊ С‚РµРі С‡Р°С‚Р°.

**Request:**
```json
{
  "tag": "completed"
}
```

---

### POST /api/stores/:storeId/chats/classify-all

> **DEPRECATED** (migration 024). AI-РєР»Р°СЃСЃРёС„РёРєР°С†РёСЏ РѕС‚РєР»СЋС‡РµРЅР°. РўРµРіРё С‚РµРїРµСЂСЊ РЅР°Р·РЅР°С‡Р°СЋС‚СЃСЏ regex-РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂРѕРј РІ sync flows + РІСЂСѓС‡РЅСѓСЋ РёР· TG Mini App. РЎРј. [`TAG_CLASSIFICATION.md`](../domains/TAG_CLASSIFICATION.md).

~~РљР»Р°СЃСЃРёС„РёС†РёСЂРѕРІР°С‚СЊ РІСЃРµ С‡Р°С‚С‹ С‡РµСЂРµР· AI.~~ Р’РѕР·РІСЂР°С‰Р°РµС‚ HTTP 410.

---

### POST /api/stores/:storeId/chats/bulk-actions

РњР°СЃСЃРѕРІС‹Рµ РґРµР№СЃС‚РІРёСЏ СЃ С‡Р°С‚Р°РјРё.

**Request:**
```json
{
  "chat_ids": ["id1", "id2"],
  "action": "tag",
  "tag": "completed"
}
```

---

### POST /api/stores/:storeId/chats/bulk/send

РњР°СЃСЃРѕРІР°СЏ РѕС‚РїСЂР°РІРєР° СЃРѕРѕР±С‰РµРЅРёР№.

**Request:**
```json
{
  "chat_ids": ["id1", "id2"],
  "message": "РўРµРєСЃС‚ СЃРѕРѕР±С‰РµРЅРёСЏ"
}
```

---

### POST /api/stores/:storeId/chats/bulk/generate-ai

РњР°СЃСЃРѕРІР°СЏ РіРµРЅРµСЂР°С†РёСЏ AI РѕС‚РІРµС‚РѕРІ.

---

### POST /api/stores/:storeId/dialogues/update

РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ С‡Р°С‚С‹ СЃ WB Chat API.

---

## Deletion Cases (РЈРґР°Р»РµРЅРёРµ РѕС‚Р·С‹РІРѕРІ)

### POST /api/stores/:storeId/chats/classify-deletion

> **DEPRECATED** (migration 024). Р—Р°РјРµРЅРµРЅРѕ regex-РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂРѕРј `src/lib/tag-classifier.ts`, РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅРЅС‹Рј РІ sync flows. Р’РѕР·РІСЂР°С‰Р°РµС‚ HTTP 410.

~~РљР»Р°СЃСЃРёС„РёС†РёСЂРѕРІР°С‚СЊ С‡Р°С‚С‹ РЅР° РїСЂРµРґРјРµС‚ СѓРґР°Р»РµРЅРёСЏ РѕС‚Р·С‹РІР°.~~

---

### POST /api/stores/:storeId/chats/:chatId/generate-deletion-offer

РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РїСЂРµРґР»РѕР¶РµРЅРёРµ РѕР± СѓРґР°Р»РµРЅРёРё.

---

### GET /api/stores/:storeId/deletion-cases/:chatId

РџРѕР»СѓС‡РёС‚СЊ deletion case.

---

### POST /api/stores/:storeId/deletion-cases/generate-all

РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РІСЃРµ deletion offers.

---

## AI Settings (РќР°СЃС‚СЂРѕР№РєРё AI)

### GET /api/stores/:storeId/ai-instructions

РџРѕР»СѓС‡РёС‚СЊ AI РёРЅСЃС‚СЂСѓРєС†РёРё РјР°РіР°Р·РёРЅР°.

**Response:**
```json
{
  "ai_instructions": "РњС‹ вЂ” Р±СЂРµРЅРґ РїСЂРµРјРёР°Р»СЊРЅРѕР№ РєРѕСЃРјРµС‚РёРєРё. РћР±СЂР°С‰Р°Р№С‚РµСЃСЊ Рє РєР»РёРµРЅС‚Сѓ РЅР° Р’С‹..."
}
```

---

### PUT /api/stores/:storeId/ai-instructions

РћР±РЅРѕРІРёС‚СЊ AI РёРЅСЃС‚СЂСѓРєС†РёРё РјР°РіР°Р·РёРЅР°.

**Request:**
```json
{
  "ai_instructions": "РќРѕРІС‹Рµ РёРЅСЃС‚СЂСѓРєС†РёРё РґР»СЏ AI Р°РіРµРЅС‚Р°..."
}
```

---

## FAQ (Р‘Р°Р·Р° Р·РЅР°РЅРёР№)

### GET /api/stores/:storeId/faq

РџРѕР»СѓС‡РёС‚СЊ РІСЃРµ FAQ Р·Р°РїРёСЃРё РјР°РіР°Р·РёРЅР°.

**Response:**
```json
[
  {
    "id": "uuid",
    "store_id": "store123",
    "question": "РљР°Рє РІРµСЂРЅСѓС‚СЊ С‚РѕРІР°СЂ?",
    "answer": "Р’С‹ РјРѕР¶РµС‚Рµ РѕС„РѕСЂРјРёС‚СЊ РІРѕР·РІСЂР°С‚ С‡РµСЂРµР· Р»РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚ WB...",
    "is_active": true,
    "sort_order": 0
  }
]
```

---

### POST /api/stores/:storeId/faq

РЎРѕР·РґР°С‚СЊ РЅРѕРІСѓСЋ FAQ Р·Р°РїРёСЃСЊ.

**Request:**
```json
{
  "question": "Р’РѕРїСЂРѕСЃ РєР»РёРµРЅС‚Р°",
  "answer": "РћС‚РІРµС‚ РїСЂРѕРґР°РІС†Р°"
}
```

---

### PUT /api/stores/:storeId/faq/:faqId

РћР±РЅРѕРІРёС‚СЊ FAQ Р·Р°РїРёСЃСЊ.

**Request:**
```json
{
  "question": "РћР±РЅРѕРІР»С‘РЅРЅС‹Р№ РІРѕРїСЂРѕСЃ",
  "answer": "РћР±РЅРѕРІР»С‘РЅРЅС‹Р№ РѕС‚РІРµС‚",
  "is_active": false
}
```

---

### DELETE /api/stores/:storeId/faq/:faqId

РЈРґР°Р»РёС‚СЊ FAQ Р·Р°РїРёСЃСЊ.

---

## Guides (РРЅСЃС‚СЂСѓРєС†РёРё РґР»СЏ РєР»РёРµРЅС‚РѕРІ)

### GET /api/stores/:storeId/guides

РџРѕР»СѓС‡РёС‚СЊ РІСЃРµ РёРЅСЃС‚СЂСѓРєС†РёРё РјР°РіР°Р·РёРЅР°.

**Response:**
```json
[
  {
    "id": "uuid",
    "store_id": "store123",
    "title": "РљР°Рє СѓРґР°Р»РёС‚СЊ РѕС‚Р·С‹РІ С‡РµСЂРµР· Р±СЂР°СѓР·РµСЂ",
    "content": "РЁР°Рі 1: РћС‚РєСЂРѕР№С‚Рµ wildberries.ru...\nРЁР°Рі 2: ...",
    "is_active": true,
    "sort_order": 0
  }
]
```

---

### POST /api/stores/:storeId/guides

РЎРѕР·РґР°С‚СЊ РЅРѕРІСѓСЋ РёРЅСЃС‚СЂСѓРєС†РёСЋ.

**Request:**
```json
{
  "title": "РљР°Рє СѓРґР°Р»РёС‚СЊ РѕС‚Р·С‹РІ",
  "content": "РЁР°Рі 1: ..."
}
```

---

### PUT /api/stores/:storeId/guides/:guideId

РћР±РЅРѕРІРёС‚СЊ РёРЅСЃС‚СЂСѓРєС†РёСЋ.

**Request:**
```json
{
  "title": "РћР±РЅРѕРІР»С‘РЅРЅС‹Р№ Р·Р°РіРѕР»РѕРІРѕРє",
  "content": "РћР±РЅРѕРІР»С‘РЅРЅС‹Р№ С‚РµРєСЃС‚",
  "is_active": false
}
```

---

### DELETE /api/stores/:storeId/guides/:guideId

РЈРґР°Р»РёС‚СЊ РёРЅСЃС‚СЂСѓРєС†РёСЋ.

---

## AI Analysis (РђРЅР°Р»РёР· РґРёР°Р»РѕРіРѕРІ)

### POST /api/stores/:storeId/analyze-dialogues

РђРЅР°Р»РёР· РїРѕСЃР»РµРґРЅРёС… 500 РґРёР°Р»РѕРіРѕРІ РјР°РіР°Р·РёРЅР° СЃ РїРѕРјРѕС‰СЊСЋ AI. Р’РѕР·РІСЂР°С‰Р°РµС‚ РїСЂРµРґР»РѕР¶РµРЅРЅС‹Рµ FAQ Рё РёРЅСЃС‚СЂСѓРєС†РёРё РЅР° РѕСЃРЅРѕРІРµ СЂРµР°Р»СЊРЅС‹С… РїРµСЂРµРїРёСЃРѕРє. Р”Р»РёС‚РµР»СЊРЅР°СЏ РѕРїРµСЂР°С†РёСЏ (~15-30 СЃРµРє).

**Response:**
```json
{
  "faq": [
    { "question": "РљР°Рє РІРµСЂРЅСѓС‚СЊ С‚РѕРІР°СЂ?", "answer": "Р’РѕР·РІСЂР°С‚ С‡РµСЂРµР· WB РІ С‚РµС‡РµРЅРёРµ 14 РґРЅРµР№..." }
  ],
  "guides": [
    { "title": "РљР°Рє СѓРґР°Р»РёС‚СЊ РѕС‚Р·С‹РІ", "content": "1. РћС‚РєСЂРѕР№С‚Рµ СЃР°Р№С‚ WB...\n2. ..." }
  ],
  "summary": "РћСЃРЅРѕРІРЅС‹Рµ РїР°С‚С‚РµСЂРЅС‹: РІРѕРїСЂРѕСЃС‹ Рѕ РІРѕР·РІСЂР°С‚Рµ, СЂР°Р·РјРµСЂР°С…, РєРѕРјРїРµРЅСЃР°С†РёРё",
  "dialoguesAnalyzed": 347
}
```

**Р”РµС‚Р°Р»Рё:**
- Р—Р°РіСЂСѓР¶Р°РµС‚ РґРѕ 500 РїРѕСЃР»РµРґРЅРёС… С‡Р°С‚РѕРІ (СЃ РјРёРЅРёРјСѓРј 2 СЃРѕРѕР±С‰РµРЅРёСЏРјРё)
- РџРµСЂРµРґР°С‘С‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ FAQ/guides РІ AI РґР»СЏ РґРµРґСѓРїР»РёРєР°С†РёРё
- РСЃРїРѕР»СЊР·СѓРµС‚ Deepseek API СЃ JSON mode
- Р›РѕРіРёСЂСѓРµС‚СЃСЏ РІ `ai_logs` (operation: `analyze-store-dialogues`)

---

## CRON Management

### GET /api/cron/status

РЎС‚Р°С‚СѓСЃ cron jobs.

**Response:**
```json
{
  "totalJobs": 4,
  "runningJobs": ["hourly-review-sync"],
  "allJobs": [
    { "name": "hourly-review-sync", "running": true },
    { "name": "daily-product-sync", "running": false },
    { "name": "adaptive-dialogue-sync", "running": false },
    { "name": "backfill-worker", "running": false }
  ]
}
```

---

### POST /api/cron/trigger

Р СѓС‡РЅРѕР№ Р·Р°РїСѓСЃРє cron job.

**Request:**
```json
{
  "job": "hourly-review-sync"
}
```

---

### POST /api/cron/init

РРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ cron jobs (РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РїСЂРё СЃС‚Р°СЂС‚Рµ СЃРµСЂРІРµСЂР°).

---

## Extension API

API РґР»СЏ Chrome Extension.

### POST /api/extension/auth/verify

РџСЂРѕРІРµСЂРёС‚СЊ API РєР»СЋС‡.

---

### GET /api/extension/stores

РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РјР°РіР°Р·РёРЅРѕРІ (РґР»СЏ extension).

**Response:**
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

| РџРѕР»Рµ | РўРёРї | РћРїРёСЃР°РЅРёРµ |
|------|-----|----------|
| draftComplaintsCount | number | Р–Р°Р»РѕР±С‹-С‡РµСЂРЅРѕРІРёРєРё (Р°РєС‚РёРІРЅС‹Рµ С‚РѕРІР°СЂС‹) |
| pendingChatsCount | number | Р§Р°С‚С‹ Рє РѕС‚РєСЂС‹С‚РёСЋ/РїСЂРёРІСЏР·РєРµ (Р°РЅР°Р»РѕРі totalCounts.chatOpens РёР· /tasks) |
| pendingStatusParsesCount | number | РћС‚Р·С‹РІС‹ РґР»СЏ РїР°СЂСЃРёРЅРіР° СЃС‚Р°С‚СѓСЃРѕРІ (Р°РЅР°Р»РѕРі totalCounts.statusParses РёР· /tasks) |

---

### GET /api/extension/stores/:storeId/stats

РЎС‚Р°С‚РёСЃС‚РёРєР° РјР°РіР°Р·РёРЅР°.

---

### GET /api/extension/stores/:storeId/active-products

РђРєС‚РёРІРЅС‹Рµ С‚РѕРІР°СЂС‹ РґР»СЏ РіРµРЅРµСЂР°С†РёРё Р¶Р°Р»РѕР±.

---

### GET /api/extension/stores/:storeId/complaints

Р–Р°Р»РѕР±С‹ РјР°РіР°Р·РёРЅР° (РґР»СЏ copy-paste РІ WB).

---

### POST /api/extension/review-statuses

РџСЂРёС‘Рј СЃС‚Р°С‚СѓСЃРѕРІ РѕС‚Р·С‹РІРѕРІ РѕС‚ Chrome Extension (РїР°СЂСЃРёРЅРі СЃС‚СЂР°РЅРёС†С‹ Р›Рљ WB).

**Request:**
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

РџРѕР»СЏ:
- `ratingExcluded` (boolean, optional) вЂ” WB РїСЂРѕР·СЂР°С‡РЅС‹Р№ СЂРµР№С‚РёРЅРі: РѕС‚Р·С‹РІ РёСЃРєР»СЋС‡С‘РЅ РёР· СЂР°СЃС‡С‘С‚Р° СЂРµР№С‚РёРЅРіР° С‚РѕРІР°СЂР°. Р•СЃР»Рё `true`, РѕС‚Р·С‹РІ СѓР±РёСЂР°РµС‚СЃСЏ РёР· РІСЃРµС… РѕС‡РµСЂРµРґРµР№ Р·Р°РґР°С‡.
- `chatStatus` вЂ” СЃРѕСЃС‚РѕСЏРЅРёРµ РєРЅРѕРїРєРё С‡Р°С‚Р°: `chat_not_activated` | `chat_available` | `chat_opened`

---

### POST /api/extension/stores/:storeId/reviews/sync

РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ СЃС‚Р°С‚СѓСЃС‹ РѕС‚Р·С‹РІРѕРІ РёР· extension (legacy).

**Request:**
```json
{
  "reviews": [
    {
      "review_id": "...",
      "review_status_wb": "visible",
      "product_status_by_review": "purchased",
      "chat_status_by_review": "available"
    }
  ]
}
```

---

### POST /api/extension/stores/:storeId/reviews/find-by-data

РќР°Р№С‚Рё РѕС‚Р·С‹РІ РїРѕ РґР°РЅРЅС‹Рј (РґР»СЏ matching).

---

### POST /api/extension/stores/:storeId/reviews/generate-complaints-batch

РњР°СЃСЃРѕРІР°СЏ РіРµРЅРµСЂР°С†РёСЏ Р¶Р°Р»РѕР±.

**Request:**
```json
{
  "review_ids": ["id1", "id2", "id3"]
}
```

**Response:**
```json
{
  "generated": [
    { "review_id": "id1", "complaint_id": "c1", "cost_usd": 0.0003 }
  ],
  "failed": [
    { "review_id": "id2", "error": "Already has complaint" }
  ]
}
```

---

### PUT /api/extension/stores/:storeId/reviews/:reviewId/complaint/sent

РћС‚РјРµС‚РёС‚СЊ Р¶Р°Р»РѕР±Сѓ РєР°Рє РѕС‚РїСЂР°РІР»РµРЅРЅСѓСЋ (РёР· extension).

---

### POST /api/extension/complaint-statuses

РњР°СЃСЃРѕРІС‹Р№ sync СЃС‚Р°С‚СѓСЃРѕРІ Р¶Р°Р»РѕР± РѕС‚ Complaint Checker Extension. РћР±РЅРѕРІР»СЏРµС‚ `reviews` + `review_complaints` (status, filed_by, complaint_filed_date).

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

---

### POST /api/extension/complaint-details

РџРѕР»РЅС‹Рµ РґР°РЅРЅС‹Рµ РѕРґРѕР±СЂРµРЅРЅРѕР№ Р¶Р°Р»РѕР±С‹ (Р·РµСЂРєР°Р»Рѕ Google Sheets "Р–Р°Р»РѕР±С‹ V 2.0"). Source of truth РґР»СЏ Р±РёР»Р»РёРЅРіР° Рё РѕС‚С‡С‘С‚РЅРѕСЃС‚Рё.

**Request:**
```json
{
  "storeId": "store_123",
  "complaint": {
    "checkDate": "20.02.2026",
    "cabinetName": "РњРѕР№РњР°РіР°Р·РёРЅ",
    "articul": "149325538",
    "feedbackRating": 1,
    "feedbackDate": "18 С„РµРІСЂ. 2026 Рі. РІ 21:45",
    "complaintSubmitDate": "15.02.2026",
    "status": "РћРґРѕР±СЂРµРЅР°",
    "hasScreenshot": true,
    "fileName": "149325538_18.02.26_21-45.png",
    "driveLink": "https://drive.google.com/file/d/abc123/view",
    "complaintCategory": "РћС‚Р·С‹РІ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє С‚РѕРІР°СЂСѓ",
    "complaintText": "Р–Р°Р»РѕР±Р° РѕС‚: 20.02.2026\n\n..."
  }
}
```

**Response:** `{ "success": true, "data": { "created": true } }` РёР»Рё `{ "created": false, "reason": "duplicate" }`

---

## Extension Chat API (Sprint 002)

API РґР»СЏ СЃРІСЏР·РєРё РѕС‚Р·С‹РІРѕРІ СЃ С‡Р°С‚Р°РјРё С‡РµСЂРµР· Chrome Extension.
Р Р°СЃС€РёСЂРµРЅРёРµ РѕС‚РєСЂС‹РІР°РµС‚ С‡Р°С‚С‹ РёР· СЃС‚СЂР°РЅРёС†С‹ РѕС‚Р·С‹РІРѕРІ WB Рё СЃРѕРѕР±С‰Р°РµС‚ Р±СЌРєРµРЅРґСѓ СЃРІСЏР·РєСѓ review в†” chat.

**Auth:** `Authorization: Bearer {api_key}` (С‚РѕС‚ Р¶Рµ С‚РѕРєРµРЅ, С‡С‚Рѕ РґР»СЏ complaints)
**Base path:** `/api/extension/chat/`

### GET /api/extension/chat/stores

РЎРїРёСЃРѕРє РјР°РіР°Р·РёРЅРѕРІ СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ С‡Р°С‚-workflow.

**Response:**
```json
[
  {
    "id": "store_123",
    "name": "Store Name",
    "isActive": true,
    "chatEnabled": true,
    "pendingChatsCount": 12
  }
]
```

| Field | Description |
|-------|-------------|
| chatEnabled | Р•СЃС‚СЊ Р»Рё С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С‚РѕРІР°СЂ СЃ `work_in_chats = true` |
| pendingChatsCount | РћС‚Р·С‹РІС‹ СЃ РѕС‚РєР»РѕРЅС‘РЅРЅС‹РјРё Р¶Р°Р»РѕР±Р°РјРё, РґР»СЏ РєРѕС‚РѕСЂС‹С… РµС‰С‘ РЅРµ РѕС‚РєСЂС‹С‚ С‡Р°С‚ |

---

### GET /api/extension/chat/stores/:storeId/rules

РџСЂР°РІРёР»Р° С‡Р°С‚-РѕР±СЂР°Р±РѕС‚РєРё РґР»СЏ РјР°РіР°Р·РёРЅР°. Р Р°СЃС€РёСЂРµРЅРёРµ РёСЃРїРѕР»СЊР·СѓРµС‚ РґР»СЏ РѕС‚Р±РѕСЂР° РѕС‚Р·С‹РІРѕРІ.

**Response:**
```json
{
  "storeId": "store_123",
  "globalLimits": {
    "maxChatsPerRun": 50,
    "cooldownBetweenChatsMs": 3000
  },
  "items": [
    {
      "nmId": "649502497",
      "productTitle": "Р¤СѓС‚Р±РѕР»РєР° РјСѓР¶СЃРєР°СЏ",
      "isActive": true,
      "chatEnabled": true,
      "starsAllowed": [1, 2, 3, 4],
      "requiredComplaintStatus": "rejected"
    }
  ]
}
```

**РљСЂРёС‚РµСЂРёРё РѕС‚Р±РѕСЂР° (Р»РѕРіРёРєР° РІ СЂР°СЃС€РёСЂРµРЅРёРё):**
- `nmId` СЃРѕРІРїР°РґР°РµС‚ СЃ Р°СЂС‚РёРєСѓР»РѕРј РЅР° СЃС‚СЂР°РЅРёС†Рµ WB
- `isActive = true` Рё `chatEnabled = true`
- Р—РІС‘Р·РґС‹ РѕС‚Р·С‹РІР° РІС…РѕРґСЏС‚ РІ `starsAllowed`
- РЎС‚Р°С‚СѓСЃ Р¶Р°Р»РѕР±С‹ РЅР° СЃС‚СЂР°РЅРёС†Рµ = В«РћС‚РєР»РѕРЅРµРЅР°В» (`requiredComplaintStatus = "rejected"`)

---

### POST /api/extension/chat/opened

Р¤РёРєСЃР°С†РёСЏ РѕС‚РєСЂС‹С‚РёСЏ С‡Р°С‚Р°. РРґРµРјРїРѕС‚РµРЅС‚РЅРѕ: РїРѕРІС‚РѕСЂРЅС‹Р№ РІС‹Р·РѕРІ СЃ С‚РµРј Р¶Рµ `reviewKey` РІРѕР·РІСЂР°С‰Р°РµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰СѓСЋ Р·Р°РїРёСЃСЊ.

**Request:**
```json
{
  "storeId": "store_123",
  "reviewContext": {
    "nmId": "649502497",
    "rating": 2,
    "reviewDate": "2026-01-07T20:09:37.000Z",
    "reviewKey": "649502497_2_2026-01-07T20:09"
  },
  "chatUrl": "https://seller.wildberries.ru/feedback-and-questions/chats/12345",
  "openedAt": "2026-02-16T14:30:00.000Z",
  "status": "CHAT_OPENED"
}
```

**Response (201 Created / 200 OK):**
```json
{
  "success": true,
  "chatRecordId": "uuid-...",
  "message": "Chat record created",
  "reviewMatched": true
}
```

| Field | Description |
|-------|-------------|
| chatRecordId | UUID Р·Р°РїРёСЃРё `review_chat_links` (РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ РїРѕСЃР»РµРґСѓСЋС‰РёС… Р·Р°РїСЂРѕСЃР°С…) |
| reviewMatched | РЈРґР°Р»РѕСЃСЊ Р»Рё РЅР°Р№С‚Рё matching review РІ Р‘Р” |

---

### POST /api/extension/chat/:chatRecordId/anchor

Р¤РёРєСЃР°С†РёСЏ СЃРёСЃС‚РµРјРЅРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ WB ("Р§Р°С‚ СЃ РїРѕРєСѓРїР°С‚РµР»РµРј РїРѕ С‚РѕРІР°СЂСѓ...").

**Request:**
```json
{
  "systemMessageText": "Р§Р°С‚ СЃ РїРѕРєСѓРїР°С‚РµР»РµРј РїРѕ С‚РѕРІР°СЂСѓ Р¤СѓС‚Р±РѕР»РєР°, Р°СЂС‚РёРєСѓР» 649502497",
  "parsedNmId": "649502497",
  "parsedProductTitle": "Р¤СѓС‚Р±РѕР»РєР°",
  "anchorFoundAt": "2026-02-16T14:30:05.000Z",
  "status": "ANCHOR_FOUND"
}
```

**Response:**
```json
{
  "success": true,
  "reviewChatLinked": true,
  "message": "Review-chat association confirmed"
}
```

---

### POST /api/extension/chat/:chatRecordId/message-sent

Р¤РёРєСЃР°С†РёСЏ РѕС‚РїСЂР°РІРєРё СЃС‚Р°СЂС‚РѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ РїРѕРєСѓРїР°С‚РµР»СЋ.

**Request:**
```json
{
  "messageType": "A",
  "messageText": "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! РњС‹ СѓРІРёРґРµР»Рё РІР°С€ РѕС‚Р·С‹РІ...",
  "sentAt": "2026-02-16T14:30:10.000Z",
  "status": "MESSAGE_SENT"
}
```

| Field | Values |
|-------|--------|
| messageType | `"A"` (1-3в­ђ), `"B"` (4в­ђ), `"NONE"` |
| status | `MESSAGE_SENT`, `MESSAGE_SKIPPED` (РґСѓР±Р»СЊ), `MESSAGE_FAILED` |

---

### POST /api/extension/chat/:chatRecordId/error

Р›РѕРіРёСЂРѕРІР°РЅРёРµ РѕС€РёР±РєРё РЅР° Р»СЋР±РѕРј СЌС‚Р°РїРµ.

**Request:**
```json
{
  "errorCode": "ERROR_ANCHOR_NOT_FOUND",
  "errorMessage": "System message not found after scrolling to top",
  "stage": "anchor_parsing",
  "occurredAt": "2026-02-16T14:30:15.000Z"
}
```

| errorCode | Description |
|-----------|-------------|
| ERROR_TAB_TIMEOUT | Р’РєР»Р°РґРєР° С‡Р°С‚Р° РЅРµ Р·Р°РіСЂСѓР·РёР»Р°СЃСЊ |
| ERROR_ANCHOR_NOT_FOUND | РЎРёСЃС‚РµРјРЅРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ |
| ERROR_DOM_CHANGED | DOM РёР·РјРµРЅРёР»СЃСЏ |
| ERROR_INPUT_NOT_FOUND | РџРѕР»Рµ РІРІРѕРґР° РЅРµ РЅР°Р№РґРµРЅРѕ |
| ERROR_SEND_FAILED | РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ |
| ERROR_CHAT_BLOCKED | Р§Р°С‚ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ |
| ERROR_UNKNOWN | РќРµРїСЂРµРґРІРёРґРµРЅРЅР°СЏ РѕС€РёР±РєР° |

---

## Auth API (JWT Authentication)

Invite-only СЂРµРіРёСЃС‚СЂР°С†РёСЏ, JWT Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ (HS256, httpOnly cookie `r5_token`).

### POST /api/auth/login

РђРІС‚РѕСЂРёР·Р°С†РёСЏ РїРѕ email + password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Sets `r5_token` cookie (7 days), returns user + org info.

---

### POST /api/auth/register

Р РµРіРёСЃС‚СЂР°С†РёСЏ РїРѕ invite-С‚РѕРєРµРЅСѓ.

**Request:**
```json
{
  "email": "new@example.com",
  "password": "password123",
  "displayName": "РРјСЏ Р¤Р°РјРёР»РёСЏ",
  "token": "invite-token-uuid"
}
```

---

### GET /api/auth/me

РџРѕР»СѓС‡РёС‚СЊ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РёР· JWT cookie).

**Response:**
```json
{
  "user": { "id": "...", "email": "...", "displayName": "..." },
  "org": { "id": "...", "name": "...", "role": "admin" }
}
```

---

### POST /api/auth/logout

РћС‡РёСЃС‚РёС‚СЊ JWT cookie.

---

### GET /api/auth/invite-info?token=xxx

РРЅС„РѕСЂРјР°С†РёСЏ РѕР± РёРЅРІР°Р№С‚Рµ (РґР»СЏ UI СЃС‚СЂР°РЅРёС†С‹ СЂРµРіРёСЃС‚СЂР°С†РёРё).

---

## Telegram Mini App API

API РґР»СЏ TG Mini App. Р’СЃРµ endpoints Р°СѓС‚РµРЅС‚РёС„РёС†РёСЂСѓСЋС‚СЃСЏ С‡РµСЂРµР· Telegram `initData` (HMAC-SHA256 СЃ BOT_TOKEN).

**Auth header:** `X-Telegram-Init-Data: <initData string>`

### GET /api/telegram/queue

РћС‡РµСЂРµРґСЊ С‡Р°С‚РѕРІ (cross-store, review-linked only РґР»СЏ WB).

**Query params:**
- `status` вЂ” С„РёР»СЊС‚СЂ РїРѕ СЃС‚Р°С‚СѓСЃСѓ (default: `inbox`, `all` РґР»СЏ РІСЃРµС…)
- `storeIds` вЂ” comma-separated store IDs
- `limit` вЂ” max items (default: 50, max: 100)
- `offset` вЂ” РїР°РіРёРЅР°С†РёСЏ

**Response:**
```json
{
  "data": [
    {
      "id": "chat_id",
      "storeId": "store_id",
      "storeName": "Store Name",
      "marketplace": "wb",
      "clientName": "Р•РєР°С‚РµСЂРёРЅР°",
      "productName": "Р¤СѓС‚Р±РѕР»РєР° РјСѓР¶СЃРєР°СЏ",
      "lastMessageText": "Р”РѕР±СЂС‹Р№ РґРµРЅСЊ...",
      "lastMessageDate": "2026-02-22T10:00:00Z",
      "lastMessageSender": "client",
      "hasDraft": true,
      "draftPreview": "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! Р‘Р»Р°РіРѕРґР°СЂРёРј...",
      "status": "inbox",
      "tag": "deletion_candidate",
      "completionReason": null,
      "reviewRating": 2,
      "reviewDate": "2026-02-20T15:30:00Z",
      "complaintStatus": "rejected",
      "productStatus": "purchased",
      "offerCompensation": true,
      "maxCompensation": "500",
      "compensationType": "cashback",
      "compensationBy": "r5",
      "chatStrategy": "both",
      "reviewText": "РЈР¶Р°СЃРЅС‹Р№ С‚РѕРІР°СЂ..."
    }
  ],
  "totalCount": 42,
  "statusCounts": {
    "inbox": 20,
    "in_progress": 5,
    "awaiting_reply": 15,
    "closed": 2
  }
}
```

---

### GET /api/telegram/chats/:chatId

Р”РµС‚Р°Р»Рё С‡Р°С‚Р° + РїРѕСЃР»РµРґРЅРёРµ 50 СЃРѕРѕР±С‰РµРЅРёР№.

**Response:**
```json
{
  "chat": {
    "id": "chat_id",
    "storeId": "store_id",
    "storeName": "Store Name",
    "marketplace": "wb",
    "clientName": "Р•РєР°С‚РµСЂРёРЅР°",
    "productName": "Р¤СѓС‚Р±РѕР»РєР°",
    "status": "inbox",
    "tag": "deletion_candidate",
    "draftReply": "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! ...",
    "completionReason": null,
    "reviewRating": 2,
    "reviewDate": "2026-02-20T15:30:00Z",
    "complaintStatus": "rejected",
    "productStatus": "purchased",
    "offerCompensation": true,
    "maxCompensation": "500",
    "compensationType": "cashback",
    "compensationBy": "r5",
    "chatStrategy": "both",
    "reviewText": "РЈР¶Р°СЃРЅС‹Р№ С‚РѕРІР°СЂ, РЅРµ СЂРµРєРѕРјРµРЅРґСѓСЋ..."
  },
  "messages": [
    {
      "id": "msg_id",
      "text": "Р”РѕР±СЂС‹Р№ РґРµРЅСЊ!",
      "sender": "client",
      "timestamp": "2026-02-22T10:00:00Z",
      "isAutoReply": false
    }
  ]
}
```

---

### GET /api/telegram/chat-files/:downloadId?storeId=xxx

Proxy РґР»СЏ РІР»РѕР¶РµРЅРёР№ РёР· WB Buyer Chat API. РўСЂРµР±СѓРµС‚ TG initData auth + storeId РІ query.

РђРЅР°Р»РѕРіРёС‡РЅРѕ web-РІРµСЂСЃРёРё, РїСЂРѕРєСЃРёСЂСѓРµС‚ С„Р°Р№Р» СЃ WB API, РґРѕР±Р°РІР»СЏСЏ WB С‚РѕРєРµРЅ РјР°РіР°Р·РёРЅР°. РџСЂРѕРІРµСЂСЏРµС‚ РґРѕСЃС‚СѓРї РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рє СѓРєР°Р·Р°РЅРЅРѕРјСѓ РјР°РіР°Р·РёРЅСѓ. Browser cache: 24 С‡Р°СЃР°.

---

### POST /api/telegram/chats/:chatId/send

РћС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ С‡РµСЂРµР· WB/OZON API.

**Request:**
```json
{
  "text": "РўРµРєСЃС‚ СЃРѕРѕР±С‰РµРЅРёСЏ"
}
```

---

### PATCH /api/telegram/chats/:chatId/status

РР·РјРµРЅРёС‚СЊ СЃС‚Р°С‚СѓСЃ/С‚РµРі С‡Р°С‚Р°.

**Request:**
```json
{
  "status": "closed",
  "completionReason": "review_deleted"
}
```

---

### POST /api/telegram/chats/:chatId/generate-ai

РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ AI РѕС‚РІРµС‚ (РїРµСЂРµРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ draft_reply).

---

### POST /api/telegram/auth/login

РџСЂРёРІСЏР·Р°С‚СЊ TG Р°РєРєР°СѓРЅС‚ Рє R5 РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

---

### POST /api/telegram/auth/verify

РџСЂРѕРІРµСЂРёС‚СЊ СЃС‚Р°С‚СѓСЃ РїСЂРёРІСЏР·РєРё TG Р°РєРєР°СѓРЅС‚Р°.

---

## Admin API

### GET /api/admin/metrics/auto-complaints

РњРµС‚СЂРёРєРё Р°РІС‚РѕРіРµРЅРµСЂР°С†РёРё Р¶Р°Р»РѕР±.

**Response:**
```json
{
  "today": {
    "generated": 500,
    "templated": 200,
    "ai_generated": 300,
    "failed": 5,
    "cost_usd": 0.15
  },
  "last_7_days": {...}
}
```

---

### GET /api/admin/analyze-empty-reviews

РђРЅР°Р»РёР· РїСѓСЃС‚С‹С… РѕС‚Р·С‹РІРѕРІ.

---

### POST /api/admin/generate-empty-review-complaints

Р“РµРЅРµСЂР°С†РёСЏ Р¶Р°Р»РѕР± РґР»СЏ РїСѓСЃС‚С‹С… РѕС‚Р·С‹РІРѕРІ (template-based).

---

### POST /api/admin/backfill

Р—Р°РїСѓСЃС‚РёС‚СЊ backfill РґР»СЏ РїСЂРѕРґСѓРєС‚Р°.

**Request:**
```json
{
  "product_id": "prod123",
  "max_rating": 3
}
```

---

## Google Sheets Sync

### GET /api/admin/google-sheets/sync

РЎС‚Р°С‚СѓСЃ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё Product Rules РІ Google Sheets.

**Response:**
```json
{
  "configured": true,
  "config": {
    "spreadsheetId": "1-mxbnv...",
    "sheetName": "РђСЂС‚РёРєСѓР»С‹ РўР—",
    "serviceAccountEmail": "r5-automation@..."
  },
  "lastSync": {
    "timestamp": "2026-02-08T03:00:00.000Z",
    "success": true,
    "rowsWritten": 58
  }
}
```

---

### POST /api/admin/google-sheets/sync

Р СѓС‡РЅРѕР№ Р·Р°РїСѓСЃРє СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё Product Rules.

**Response:**
```json
{
  "success": true,
  "message": "Successfully synced 150 products from 5 stores",
  "result": {
    "rowsWritten": 151,
    "storesProcessed": 5,
    "productsProcessed": 150,
    "duration_ms": 1250
  }
}
```

---

### GET /api/admin/google-sheets/sync-clients

РЎС‚Р°С‚СѓСЃ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃРїСЂР°РІРѕС‡РЅРёРєР° РєР»РёРµРЅС‚РѕРІ (РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ).

**Response:**
```json
{
  "configured": true,
  "config": {
    "spreadsheetId": "1-mxbnv...",
    "sheetName": "РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ",
    "serviceAccountEmail": "r5-automation@..."
  },
  "lastSync": {
    "timestamp": "2026-02-08T10:00:00.000Z",
    "success": true,
    "storesProcessed": 63,
    "rowsUpdated": 0,
    "rowsAppended": 63
  }
}
```

---

### POST /api/admin/google-sheets/sync-clients

Р—Р°РїСѓСЃРє СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃРїСЂР°РІРѕС‡РЅРёРєР° РєР»РёРµРЅС‚РѕРІ.

**Р§С‚Рѕ РґРµР»Р°РµС‚:**
- Р§РёС‚Р°РµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РґР°РЅРЅС‹Рµ Р»РёСЃС‚Р° "РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ"
- Р”Р»СЏ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… РјР°РіР°Р·РёРЅРѕРІ вЂ” РѕР±РЅРѕРІР»СЏРµС‚ СЃС‚СЂРѕРєСѓ (UPDATE)
- Р”Р»СЏ РЅРѕРІС‹С… РјР°РіР°Р·РёРЅРѕРІ вЂ” РґРѕР±Р°РІР»СЏРµС‚ СЃС‚СЂРѕРєСѓ (APPEND)
- РЎРѕС…СЂР°РЅСЏРµС‚ РІСЂСѓС‡РЅСѓСЋ Р·Р°РїРѕР»РЅРµРЅРЅС‹Р№ РРќРќ (РєРѕР»РѕРЅРєР° C)
- РЎРІСЏР·С‹РІР°РµС‚ СЃ РїР°РїРєР°РјРё Google Drive С‡РµСЂРµР· fuzzy-matching

**Response:**
```json
{
  "success": true,
  "message": "Synced 63 stores: 10 updated, 5 appended",
  "result": {
    "storesProcessed": 63,
    "rowsUpdated": 10,
    "rowsAppended": 5,
    "duration_ms": 26728
  }
}
```

**РљРѕР»РѕРЅРєРё Р»РёСЃС‚Р°:**

| # | РљРѕР»РѕРЅРєР° | РСЃС‚РѕС‡РЅРёРє |
|---|---------|----------|
| A | ID РјР°РіР°Р·РёРЅР° | `store.id` |
| B | РќР°Р·РІР°РЅРёРµ | `store.name` |
| C | РРќРќ | (Р·Р°РїРѕР»РЅСЏРµС‚СЃСЏ РІСЂСѓС‡РЅСѓСЋ) |
| D | Р”Р°С‚Р° РїРѕРґРєР»СЋС‡РµРЅРёСЏ | `store.created_at` |
| E | РЎС‚Р°С‚СѓСЃ | `store.status` |
| F | API Main | вњ…/вќЊ |
| G | API Content | вњ…/вќЊ |
| H | API Feedbacks | вњ…/вќЊ |
| I | API Chat | вњ…/вќЊ |
| J | РџР°РїРєР° РєР»РёРµРЅС‚Р° | Google Drive СЃСЃС‹Р»РєР° |
| K | РћС‚С‡С‘С‚ | РЎСЃС‹Р»РєР° РЅР° "РћС‚С‡С‘С‚: ..." |
| L | РЎРєСЂРёРЅС€РѕС‚С‹ | РЎСЃС‹Р»РєР° РЅР° РїР°РїРєСѓ |
| M | РћР±РЅРѕРІР»РµРЅРѕ | Timestamp |

---

## Tasks API

РЈРїСЂР°РІР»РµРЅРёРµ С„РѕРЅРѕРІС‹РјРё Р·Р°РґР°С‡Р°РјРё.

### GET /api/tasks

РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє Р·Р°РґР°С‡.

---

### GET /api/tasks/stats

РЎС‚Р°С‚РёСЃС‚РёРєР° Р·Р°РґР°С‡.

---

### GET /api/tasks/:id

РџРѕР»СѓС‡РёС‚СЊ Р·Р°РґР°С‡Сѓ.

---

## Utility Endpoints

### GET /api/health

Health check.

**Response:**
```
OK
```

---

### POST /api/cache/invalidate

РРЅРІР°Р»РёРґРёСЂРѕРІР°С‚СЊ РєРµС€.

**Request:**
```json
{
  "key": "stores" | "reviews" | "chats"
}
```

---

### GET /api/openapi.json

OpenAPI СЃРїРµС†РёС„РёРєР°С†РёСЏ.

---

## WB Proxy

РџСЂРѕРєСЃРёСЂРѕРІР°РЅРёРµ Р·Р°РїСЂРѕСЃРѕРІ Рє WB API.

### POST /api/wb-proxy/reviews

Proxy Рє WB Feedbacks API.

### POST /api/wb-proxy/products

Proxy Рє WB Content API.

### POST /api/wb-proxy/chats

Proxy Рє WB Chat API.

### POST /api/wb-proxy/chat-events

РџРѕР»СѓС‡РёС‚СЊ СЃРѕР±С‹С‚РёСЏ С‡Р°С‚РѕРІ.

### POST /api/wb-proxy/questions

Proxy Рє WB Questions API.

### POST /api/wb-proxy/send-message

РћС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ С‡РµСЂРµР· WB API.

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request вЂ” РЅРµРІР°Р»РёРґРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ |
| 401 | Unauthorized вЂ” РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ РёР»Рё РЅРµРІР°Р»РёРґРЅС‹Р№ С‚РѕРєРµРЅ |
| 403 | Forbidden вЂ” РЅРµС‚ РґРѕСЃС‚СѓРїР° Рє СЂРµСЃСѓСЂСЃСѓ |
| 404 | Not Found вЂ” СЂРµСЃСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ |
| 429 | Too Many Requests вЂ” rate limit exceeded |
| 500 | Internal Server Error |

**Error Response Format:**
```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| AI Generation | 60 req/min |
| Sync Operations | 10 req/min |
| Read Operations | 100 req/min |
| Write Operations | 30 req/min |

---

## РЎРІСЏР·Р°РЅРЅС‹Рµ РґРѕРєСѓРјРµРЅС‚С‹

- [Database Schema](../database-schema.md)
- [CRON Jobs](../CRON_JOBS.md)
- [Architecture](../ARCHITECTURE.md)

---

**Last Updated:** 2026-02-22
