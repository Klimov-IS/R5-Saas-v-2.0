# Chrome Extension API Documentation

**Version:** 2.1.0
**Last Updated:** 2026-02-20
**Production URL:** http://158.160.139.99

---

## Overview

This API provides endpoints for the Chrome Extension "R5 РїРѕРґР°С‡Р° Р¶Р°Р»РѕР±" to fetch and submit generated complaints to Wildberries.

## Authentication

All API requests (except `/api/health`) require Bearer token authentication:

```http
Authorization: Bearer your_api_token_here
```

### Getting Your API Token

1. Log into the WB Reputation Manager dashboard
2. Navigate to Settings в†’ API Tokens
3. Generate a new token for your store
4. Copy the token securely (shown only once)

### Token Security

- Keep your token secret - it provides full access to your store's data
- Don't commit tokens to version control
- Rotate tokens periodically
- Each token is scoped to a single store

---

## Rate Limiting

- **Limit:** 100 requests per minute per API token
- **Headers:** Every response includes rate limit information:
  ```http
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 2026-01-28T15:30:00.000Z
  ```
- **429 Response:** When limit exceeded, wait until `resetAt` timestamp

---

## Core Endpoints

### 1. GET /api/stores/:storeId/complaints

Fetch list of pending complaints ready for submission.

**URL:** `GET /api/stores/{storeId}/complaints`

**Query Parameters:**
- `skip` (optional) - Number of records to skip for pagination (default: 0)
- `take` (optional) - Number of records to return (default: 100, max: 200)

**Request Example:**
```http
GET /api/stores/cm5abc123/complaints?skip=0&take=50
Authorization: Bearer your_api_token_here
```

**Response Example:**
```json
[
  {
    "id": "rev_xyz789",
    "productId": "123456789",
    "rating": 1,
    "reviewDate": "2026-01-28T10:15:30.000Z",
    "reviewText": "РџР»РѕС…РѕРµ РєР°С‡РµСЃС‚РІРѕ С‚РѕРІР°СЂР°",
    "authorName": "РРІР°РЅ Р.",
    "createdAt": "2026-01-28T11:00:00.000Z",
    "complaintText": "```json\n{\"reasonId\":\"1\",\"reasonName\":\"РћСЃРєРѕСЂР±Р»РµРЅРёРµ\",\"complaintText\":\"РћС‚Р·С‹РІ СЃРѕРґРµСЂР¶РёС‚ РѕСЃРєРѕСЂР±РёС‚РµР»СЊРЅС‹Рµ РІС‹СЂР°Р¶РµРЅРёСЏ...\"}\n```",
    "status": "draft",
    "attempts": 0,
    "lastAttemptAt": null
  }
]
```

**Response Codes:**
- `200` - Success
- `400` - Invalid parameters (skip/take out of range)
- `401` - Invalid or missing API token
- `403` - Token doesn't have access to this store
- `404` - Store not found
- `429` - Rate limit exceeded
- `500` - Internal server error

---

### 2. POST /api/stores/:storeId/reviews/:reviewId/complaint/sent

Mark complaint as successfully sent to Wildberries.

**URL:** `POST /api/stores/{storeId}/reviews/{reviewId}/complaint/sent`

**Idempotency:** Safe to call multiple times - if already marked as sent, returns 200 with existing data.

**Request Example:**
```http
POST /api/stores/cm5abc123/reviews/rev_xyz789/complaint/sent
Authorization: Bearer your_api_token_here
```

**Response Example:**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "rev_xyz789",
    "status": "sent",
    "sentAt": "2026-01-28T12:00:00.000Z"
  }
}
```

**Response Codes:**
- `200` - Success (complaint marked or already marked)
- `400` - Review doesn't belong to specified store
- `401` - Invalid or missing API token
- `403` - Token doesn't have access to this store
- `404` - Store, review, or complaint not found
- `429` - Rate limit exceeded
- `500` - Internal server error

---

### 3. GET /api/health

Check API health status (no authentication required).

**URL:** `GET /api/health`

**Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "uptime_seconds": 86400,
  "uptime_human": "1d 0h 0m 0s",
  "version": "2.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "healthy",
      "message": "Connected",
      "details": {
        "latency_ms": 15
      }
    },
    "cronJobs": {
      "status": "healthy",
      "message": "Running"
    },
    "rateLimiter": {
      "status": "healthy",
      "message": "Operational"
    }
  }
}
```

**Response Codes:**
- `200` - Healthy or degraded
- `503` - Unhealthy (critical services down)

---

## Important: Date Format

### reviewDate Field

**Format:** ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)

**Example:** `"2026-01-28T10:15:30.000Z"`

**Timezone:** Always UTC (Z suffix)

**Extension Responsibility:**
The Extension team should handle conversion to Russian format (DD.MM.YYYY) for display purposes if needed. The API will always send dates in ISO 8601 format.

**JavaScript Conversion Example:**
```javascript
// API returns ISO 8601
const reviewDate = "2026-01-28T10:15:30.000Z";

// Convert to DD.MM.YYYY for WB submission
function formatToRussianDate(isoString) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

const formattedDate = formatToRussianDate(reviewDate);
// Result: "28.01.2026"
```

---

## complaintText Format

The `complaintText` field contains complaint data wrapped in markdown code block:

**Format:**
```
```json
{"reasonId":"1","reasonName":"РћСЃРєРѕСЂР±Р»РµРЅРёРµ","complaintText":"..."}
```
```

**Parsing Example:**
```javascript
// Extract JSON from markdown code block
function parseComplaintText(complaintText) {
  const match = complaintText.match(/```json\n(.*?)\n```/s);
  if (match) {
    return JSON.parse(match[1]);
  }
  throw new Error('Invalid complaintText format');
}

const complaint = parseComplaintText(response.complaintText);
// Result: { reasonId: "1", reasonName: "РћСЃРєРѕСЂР±Р»РµРЅРёРµ", complaintText: "..." }
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `INVALID_TOKEN` - Missing or invalid API token
- `STORE_ACCESS_DENIED` - Token doesn't have access to requested store
- `STORE_NOT_FOUND` - Store ID doesn't exist
- `REVIEW_NOT_FOUND` - Review ID doesn't exist
- `COMPLAINT_NOT_FOUND` - No complaint exists for this review
- `STORE_MISMATCH` - Review belongs to different store
- `INVALID_PARAMS` - Invalid query parameters
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `DB_ERROR` - Database error (temporary)

---

## Best Practices

### 1. Pagination
Always use pagination for large datasets:
```javascript
async function fetchAllComplaints(storeId, token) {
  const allComplaints = [];
  let skip = 0;
  const take = 100;

  while (true) {
    const response = await fetch(
      `http://158.160.139.99/api/stores/${storeId}/complaints?skip=${skip}&take=${take}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const complaints = await response.json();
    if (complaints.length === 0) break;

    allComplaints.push(...complaints);
    skip += take;
  }

  return allComplaints;
}
```

### 2. Rate Limit Handling
Respect rate limits and implement backoff:
```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options);

  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
  const resetAt = response.headers.get('X-RateLimit-Reset');

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After'));
    console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
    await sleep(retryAfter * 1000);
    return apiRequest(url, options); // Retry
  }

  return response;
}
```

### 3. Error Recovery
Implement proper error handling:
```javascript
try {
  const response = await apiRequest(url, options);

  if (!response.ok) {
    const error = await response.json();
    console.error(`API Error [${error.code}]:`, error.message);

    // Handle specific errors
    if (error.code === 'INVALID_TOKEN') {
      // Prompt user to re-authenticate
    } else if (error.code === 'STORE_NOT_FOUND') {
      // Invalid store configuration
    }

    return null;
  }

  return await response.json();
} catch (error) {
  console.error('Network error:', error);
  return null;
}
```

### 4. Idempotency
The `/complaint/sent` endpoint is idempotent - safe to retry:
```javascript
async function markAsSent(storeId, reviewId, token) {
  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(
        `http://158.160.139.99/api/stores/${storeId}/reviews/${reviewId}/complaint/sent`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        return await response.json();
      }

      // Don't retry 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error: ${response.status}`);
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

---

## CORS Configuration

The API supports CORS for Chrome Extensions:

**Allowed Origins:**
- `chrome-extension://*` (all Chrome Extension origins)

**Allowed Methods:**
- GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers:**
- Content-Type
- Authorization

**Preflight Caching:**
- 24 hours (86400 seconds)

---

### 4. POST /api/extension/complaint-details

Receive full approved complaint data from Chrome Extension. Called after each successful screenshot of an approved complaint. Source of truth for billing, client reporting, AI training.

**URL:** `POST /api/extension/complaint-details`

**Request Example:**
```http
POST /api/extension/complaint-details
Authorization: Bearer your_api_token_here
Content-Type: application/json

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
    "complaintText": "Р–Р°Р»РѕР±Р° РѕС‚: 20.02.2026\n\nРћС‚Р·С‹РІ РїРѕРєСѓРїР°С‚РµР»СЏ РЅРµ СЃРѕРґРµСЂР¶РёС‚ РѕС†РµРЅРєРё РєР°С‡РµСЃС‚РІР°..."
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `checkDate` | string | Yes | Р”Р°С‚Р° РїСЂРѕРІРµСЂРєРё, DD.MM.YYYY |
| `cabinetName` | string | Yes | РќР°Р·РІР°РЅРёРµ РјР°РіР°Р·РёРЅР° WB |
| `articul` | string | Yes | РђСЂС‚РёРєСѓР» WB (nmId) |
| `reviewId` | string | No | ID РѕС‚Р·С‹РІР° (Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅРѕ, РїРѕРєР° РїСѓСЃС‚Р°СЏ СЃС‚СЂРѕРєР°) |
| `feedbackRating` | number/string | Yes | Р РµР№С‚РёРЅРі РѕС‚Р·С‹РІР° 1-5 |
| `feedbackDate` | string | Yes | Р”Р°С‚Р° РѕС‚Р·С‹РІР° РІ РѕСЂРёРіРёРЅР°Р»СЊРЅРѕРј С„РѕСЂРјР°С‚Рµ WB |
| `complaintSubmitDate` | string | No | Р”Р°С‚Р° РїРѕРґР°С‡Рё Р¶Р°Р»РѕР±С‹ DD.MM.YYYY РёР»Рё DD.MM |
| `status` | string | No | Р’СЃРµРіРґР° "РћРґРѕР±СЂРµРЅР°" |
| `hasScreenshot` | boolean | No | Р’СЃРµРіРґР° true |
| `fileName` | string | Yes | РРјСЏ С„Р°Р№Р»Р° СЃРєСЂРёРЅС€РѕС‚Р° |
| `driveLink` | string | No | РЎСЃС‹Р»РєР° РЅР° СЃРєСЂРёРЅС€РѕС‚ РІ Google Drive |
| `complaintCategory` | string | Yes | РљР°С‚РµРіРѕСЂРёСЏ Р¶Р°Р»РѕР±С‹ WB |
| `complaintText` | string | Yes | РџРѕР»РЅС‹Р№ С‚РµРєСЃС‚ Р¶Р°Р»РѕР±С‹ |

**Deduplication:** `storeId` + `articul` + `feedbackDate` + `fileName`

**filed_by detection:** If `complaintText` starts with "Р–Р°Р»РѕР±Р° РѕС‚:" в†’ `r5`, otherwise в†’ `seller`.

**Response вЂ” Created:**
```json
{
  "success": true,
  "data": {
    "created": true
  }
}
```

**Response вЂ” Duplicate:**
```json
{
  "success": true,
  "data": {
    "created": false,
    "reason": "duplicate"
  }
}
```

**Response Codes:**
- `200` - Success (created or duplicate)
- `400` - Invalid request body or missing required fields
- `401` - Invalid or missing API token
- `403` - Token doesn't have access to this store
- `404` - Store not found
- `500` - Internal server error

---

## Support

**Issues:** Report bugs or request features via GitHub Issues
**Production Dashboard:** http://158.160.139.99
**Technical Contact:** See project README

---

## Changelog

### Version 2.1.0 (2026-02-20)
- POST /api/extension/complaint-details вЂ” approved complaint data from extension (source of truth for billing/reporting)

### Version 2.0.0 (2026-01-28)
- GET /api/stores/:storeId/complaints endpoint
- POST /api/stores/:storeId/reviews/:reviewId/complaint/sent endpoint
- Bearer token authentication
- Rate limiting (100 req/min per token)
- CORS support for Chrome Extensions
- Enhanced health check endpoint
- ISO 8601 date format for reviewDate field
- Markdown-wrapped JSON for complaintText field
