# API Performance Audit Report — 2026-03-19

> **From:** Extension Team (R5)
> **To:** Backend Team (rating5.ru)
> **Priority:** CRITICAL
> **Context:** Extension works extremely slowly and unstably when processing 50+ stores

---

## Executive Summary

We conducted a comprehensive performance audit of all backend API endpoints used by the R5 extension. The extension processes 50+ seller cabinets sequentially, making 3-5 API calls per store. The audit reveals **critical server-side performance issues** that are the primary cause of extension slowness.

**Key finding:** Processing 50 stores with just ONE endpoint (`/tasks`) took **214 seconds (3.5 minutes)**, including one HTTP 500 timeout. With all endpoints (tasks + complaints + chat rules + status sync), real-world processing would take **10-15+ minutes** per full cycle.

---

## 1. Test Environment

- **Client:** Windows 11, curl 8.x, sequential and parallel requests
- **Server:** `https://rating5.ru` behind Cloudflare (Next.js detected via `vary: RSC` header)
- **Auth token:** `wbrm_0ab7137430d4fb62948db3a7d9b4b997`
- **Date:** 2026-03-19, ~16:30 MSK
- **Active stores in system:** 62 (91 total, 62 active)

---

## 2. Endpoints Tested

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 1 | `/api/health` | GET | Health check |
| 2 | `/api/extension/stores` | GET | List all stores |
| 3 | `/api/extension/stores/{id}/tasks` | GET | Unified tasks for store |
| 4 | `/api/extension/stores/{id}/complaints` | GET | Draft complaints |
| 5 | `/api/extension/chat/stores/{id}/rules` | GET | Chat rules |
| 6 | `/api/extension/review-statuses` | GET | Review statuses |
| 7 | `/api/extension/review-statuses` | POST | Sync statuses |
| 8 | `/api/extension/stores/{id}/reviews/reparse` | POST | Reparse reviews |

---

## 3. CRITICAL ISSUES

### 3.1 [CRITICAL] Progressive Degradation Under Sustained Load

When processing 50 stores **sequentially** (one request at a time, no parallelism), response times degrade dramatically over time:

```
Store  1: 8.16s   (cold start?)
Store  2: 0.45s
Store  3: 0.24s
Store  4: 0.38s
Store  5: 3.86s   << SPIKE
Store  6: 5.42s   << SPIKE
Store  7: 0.26s
...
Store 20: 11.17s  << MAJOR SPIKE
Store 21: 6.19s
Store 23: 13.35s  << CRITICAL
...
Store 31: 18.53s  << CRITICAL
Store 36: 21.07s  << CRITICAL
...
Store 47: 60.36s  << HTTP 500 TIMEOUT
Store 50: 8.09s

TOTAL: 214 seconds for 50 stores (one endpoint only!)
Average: 4.3 seconds per store
```

**Pattern:** Every 10-15 requests, a major spike (5-21s) occurs. After ~45 requests, the server starts timing out (60s → HTTP 500).

**Expected behavior:** ~200-300ms per request consistently (this is what we see for the first few warm requests).

**Impact:** The extension needs to call 3-5 endpoints per store. At 4.3s average per request, processing 50 stores requires:
- Tasks only: ~215 seconds
- Full workflow (tasks + complaints + chat rules): ~650+ seconds (10+ minutes)
- With status sync writes: ~15+ minutes

### 3.2 [CRITICAL] HTTP 500 on Store "МакШуз ООО" (BhWUBJfOFTozPN1EkFml)

```
Store 47 (BhWUBJfOFTozPN1EkFml): HTTP 500, 60.36 seconds
```

- The `/tasks` endpoint for this store **timed out at 60 seconds and returned HTTP 500**
- On retry (when server was not under load), the same store returned 200 OK with **376KB response** containing 28 complaints across 20+ articles
- This suggests the server-side query for this store is too expensive and hits a timeout limit

**Questions for backend team:**
1. Is there a server-side timeout configured at 60 seconds?
2. Is the `/tasks` query doing N+1 database queries (one per article)?
3. Is the complaint text being fetched/joined in the same query?

### 3.3 [CRITICAL] Concurrent Request Degradation

When 5-15 requests are sent in parallel (simulating multiple extension instances or fast sequential processing):

**5 parallel requests:**
```
Store1: 0.22s
Store2: 13.60s  << 60x slower!
Store3: 2.55s
Store4: 0.39s
Store5: 2.17s
```

**10 parallel requests:**
```
Fastest: 0.26s
Slowest: 6.10s (23x slower)
```

**15 parallel requests:**
```
Fastest: 0.24s
Slowest: 3.52s (15x slower)
```

**This indicates the backend has limited concurrent request handling capacity** — likely a connection pool, worker thread, or serverless concurrency bottleneck.

### 3.4 [HIGH] `/stores` Endpoint Always Slow (~1.1s)

The stores list endpoint is consistently 1.0-1.6s, with occasional spikes to 6.9s:

```
10 sequential requests:
  Request  1: 1.19s
  Request  2: 1.10s
  Request  3: 1.09s
  Request  4: 1.07s
  Request  5: 1.10s
  Request  6: 1.08s
  Request  7: 1.19s
  Request  8: 1.19s
  Request  9: 1.11s
  Request 10: 1.06s

Outlier during other tests: 6.93s
```

- Response size: 15,126 bytes (91 stores with aggregated counts)
- All TTFB ~ total time, meaning delay is server processing, not network
- The aggregated counts (`draftComplaintsCount`, `pendingChatsCount`, `pendingStatusParsesCount`) per store likely require expensive COUNT queries

**This endpoint is called on every extension startup/store-switch. 1+ seconds is too slow for UI.**

**Recommendations:**
1. Cache the stores list (TTL 30-60s) on the server
2. Move aggregated counts to a separate endpoint or compute them asynchronously
3. Consider returning a simpler store list without counts for initial load

---

## 4. MODERATE ISSUES

### 4.1 [MEDIUM] Health Endpoint Intermittent Spike

```
10 sequential /health requests:
  Request  1: 0.24s
  Request  2: 3.88s  << 16x spike on unauthenticated health check!
  Request  3: 0.23s
  ...
  Request 10: 0.21s
```

Health check should be the fastest endpoint (no DB, no auth). A 3.88s spike suggests cold start or serverless function spinup.

### 4.2 [MEDIUM] Reparse Endpoint Server-Side Processing Time

```
POST /stores/{id}/reviews/reparse (1 article, 53 reviews):
  HTTP 200, total: 2.06s
  Response: {"elapsed": 1869} (1.87s server-side)
```

For just 53 reviews in 1 article, the server takes 1.87s. For stores with hundreds of articles and thousands of reviews, this could take 30-60+ seconds.

### 4.3 [MEDIUM] No Response Caching Headers

None of the GET endpoints return caching headers (`Cache-Control`, `ETag`, `Last-Modified`). This means:
- The extension cannot cache responses locally
- Cloudflare cannot cache responses at the edge
- Every request hits the origin server

### 4.4 [LOW] Rate Limit Configuration

Current rate limit headers:
```
x-ratelimit-limit: 100
x-ratelimit-remaining: 99
x-ratelimit-reset: 2026-03-19T13:42:32.480Z
```

100 requests per minute window. For 50 stores with 3-5 calls each = 150-250 calls per cycle. The extension could hit rate limits during normal operation if it processes quickly. However, given the slow response times, this is not currently an issue (requests are throttled by server speed).

---

## 5. POSITIVE FINDINGS

### 5.1 Individual Request Performance (No Load)

When the server is not under sustained load, individual endpoints are fast:

| Endpoint | Avg Response Time | Payload Size |
|----------|-------------------|--------------|
| `/health` | 220ms | ~1 KB |
| `/stores/{id}/tasks` | 250ms | 4-10 KB |
| `/stores/{id}/complaints` | 230ms | 4-48 KB |
| `/chat/stores/{id}/rules` | 210ms | 11 KB |
| `/review-statuses` (GET) | 290ms | 19 KB |
| `/review-statuses` (POST, 5 items) | 310ms | ~0.3 KB |

### 5.2 Error Handling is Correct

```
Invalid token:     401, 0.21s, {"error":"Unauthorized","message":"Invalid or expired token"}
Invalid store:     404, 0.21s, {"error":"Not found","message":"Store ... not found"}
Missing auth:      401, 0.20s, {"error":"Unauthorized","message":"Missing or invalid Authorization header"}
```

Error responses are fast (~200ms) with clear messages.

### 5.3 Idempotency Works

Status sync with duplicate data returns success without creating duplicates.

### 5.4 Burst Handling (Simple Endpoints)

20 concurrent `/health` requests all returned 200 within 200-320ms range. Simple endpoints handle concurrency well.

---

## 6. ROOT CAUSE ANALYSIS

Based on the test patterns, we believe the root cause is:

### Hypothesis 1: Serverless Cold Starts + Connection Pool Exhaustion

Evidence:
- `Server: cloudflare` + `vary: RSC, Next-Router-State-Tree` = Next.js on Vercel/similar
- First request often slow (8s), then fast, then periodically slow again
- Pattern matches serverless function cold start + DB connection pool exhaustion
- After ~40-50 requests, connections accumulate and cause timeouts

### Hypothesis 2: N+1 Database Queries in `/tasks`

Evidence:
- Small stores (0-2 complaints) return in 200-300ms
- Large stores (20+ complaints across many articles) return in 300ms-376KB but can timeout at 60s
- Store "МакШуз ООО" has 28 complaints across 20+ articles → 500 error
- Suggests the query fetches complaints per article in a loop

### Hypothesis 3: No Server-Side Caching

Evidence:
- `/stores` always takes ~1.1s (aggregated counts computed on every call)
- No `Cache-Control`, `ETag`, or `Last-Modified` headers
- Identical sequential requests take the same time (no cache hit)

---

## 7. RECOMMENDATIONS FOR BACKEND TEAM

### Priority 1 (Critical — blocks extension usage)

1. **Investigate and fix the progressive degradation** under sustained sequential load. 50 requests should not take 214 seconds. This is the #1 blocker.

2. **Fix the 60-second timeout on large stores** (МакШуз ООО). Either optimize the query or increase the timeout with streaming response.

3. **Add server-side caching for `/stores`** — this endpoint returns the same data for all requests with the same token. A 30-60 second TTL cache would reduce 1.1s to ~5ms.

### Priority 2 (High — significantly improves performance)

4. **Optimize the `/tasks` query** — likely N+1 problem. Use batch/JOIN queries instead of per-article fetches.

5. **Add `Cache-Control` headers** to GET endpoints (at least `max-age=30` for stores, `max-age=10` for tasks/complaints).

6. **Investigate concurrent request handling** — connection pool size, serverless concurrency limits, database connection limits.

### Priority 3 (Medium — improves reliability)

7. **Add a lightweight `/stores/list` endpoint** that returns just `[{id, name, isActive}]` without aggregated counts. The extension can use this for initial load.

8. **Consider pagination for `/tasks`** — sending all complaints for all articles in one response can create 376KB payloads.

9. **Add server-side request logging with timing** — we need visibility into what's slow (DB query? Network? Serialization?).

### Priority 4 (Nice to have)

10. **Consider a bulk endpoint** — instead of calling `/tasks` per store 50 times, allow `GET /tasks?storeIds=id1,id2,...` to batch requests.

11. **WebSocket or SSE for long-running operations** — reparse could stream progress instead of blocking for 2+ seconds.

---

## 8. RAW TEST DATA

### Test A: 50-store sequential `/tasks` scan

| Store # | Store ID | HTTP | Time (s) |
|---------|----------|------|----------|
| 1 | BbzuROmqW0SSEjydH49U | 200 | 8.157 |
| 2 | bj28FjeF484ZLIAnEtuV | 200 | 0.455 |
| 3 | HFi6qOHKlbVTvrpNG38T | 200 | 0.239 |
| 4 | atVotoDwBWiT1bVo2H8u | 200 | 0.377 |
| 5 | wI7Qwj7ScOdqqVDtwJKv | 200 | 3.864 |
| 6 | haNp15vW6FWomNLPesHC | 200 | 5.423 |
| 7 | ihMDtYWEY7IXkR3Lm9Pq | 200 | 0.257 |
| 8 | uSn5JyY6bi55HCpDBvy8 | 200 | 0.223 |
| 9 | NjC8DUdeaN9EjEGHTahV | 200 | 0.238 |
| 10 | PMzOrhVCOc4mT4EygKR0 | 200 | 0.250 |
| 11 | xOMA8naL3Q9eSuR2Oewr | 200 | 0.276 |
| 12 | Ycor9h1JdbJn7DTjyAXX | 200 | 0.281 |
| 13 | yS7A4p7imJYCEPG7DF1u | 200 | 0.270 |
| 14 | 1V7vaBiI85BGDQOJq26z | 200 | 0.251 |
| 15 | hnEtgp7G8iZC45mSnjZN | 200 | 0.244 |
| 16 | wHekFiPAjp3dq7a1aGpL | 200 | 0.284 |
| 17 | 53Q8F1YxtZa31eMIauzz | 200 | 0.674 |
| 18 | RO5MhbekMDCCU2LxYacE | 200 | 0.269 |
| 19 | PIJQsbgnbXMVPCTROl77 | 200 | 0.278 |
| 20 | VQY2HAOWFeETqxOW33nI | 200 | **11.169** |
| 21 | OhyiWa3U3BX5v6QeOkPW | 200 | **6.193** |
| 22 | Sj5vhEYCbkfmTi9ZZ82C | 200 | 0.313 |
| 23 | UbIWbc7i99s3bhRqeLrA | 200 | **13.351** |
| 24 | ihMDtsRIFCx6B5fbvnC5 | 200 | 0.304 |
| 25 | WxgOO5gSxAJS3TO7HZjb | 200 | 0.329 |
| 26 | uhDDqHlXLC3TZBk3nY0j | 200 | 3.166 |
| 27 | pbAkwbBXSCwnCzJVkDKG | 200 | 1.669 |
| 28 | 6TbcNUQ6tt8AWfJU8YDI | 200 | 2.945 |
| 29 | 6jTfJ4abVsjkgx8SHXZ4 | 200 | 3.950 |
| 30 | CwzAIccNF3nmfNoVEFOr | 200 | 1.565 |
| 31 | TVEwh3Ay8RXLCdhzVnpC | 200 | **18.526** |
| 32 | JyIwOtkvzuryc4MuKmYt | 200 | 3.951 |
| 33 | rpixYkH1iGxOSYraLqVR | 200 | 0.417 |
| 34 | 7nG9XKuWBWNbRXM2PpeH | 200 | 3.692 |
| 35 | zTQth115ZfXDcd586WiL | 200 | 1.189 |
| 36 | 9twKSDRjs4c27jQNDSzn | 200 | **21.067** |
| 37 | MUDoyx5ZeTQ4sit64pCH | 200 | 0.555 |
| 38 | 4C61MCXAgWBQkg7VUVjR | 200 | 1.017 |
| 39 | vLfbPJQml9hjXxgwMNNC | 200 | 4.497 |
| 40 | 7A1nEmSYSi1ejHkeqB2j | 200 | 4.556 |
| 41 | ROpMsZSmzLUFtpwqQq3t | 200 | 1.606 |
| 42 | 1Hjrlzp1OLfYNmgC6HQd | 200 | 2.685 |
| 43 | bTOtBtK5qDiydqEQmbB7 | 200 | 2.209 |
| 44 | 8WD63TveZwygvB0MrPVN | 200 | 4.607 |
| 45 | fjSmr8MEPEWXJIXBu6qE | 200 | 1.120 |
| 46 | Ibk4JgULpYSaACtc8k4c | 200 | 0.234 |
| 47 | BhWUBJfOFTozPN1EkFml | **500** | **60.356** |
| 48 | sIsysbvDaJx0IJMpFP7w | 200 | 1.607 |
| 49 | 8zFlmuTc828C8rvc7PWr | 200 | 1.041 |
| 50 | SowY9N6NqMw9vHybxBjE | 200 | 8.089 |

**Statistics:**
- Total: 214.5s
- Average: 4.29s
- Median: ~1.1s
- p95: ~13.4s
- p99: ~21.1s
- Max: 60.4s (HTTP 500)
- Errors: 1 (2%)

### Test B: Sequential single-endpoint (no degradation baseline)

30 sequential requests to the same store `/tasks`:
```
Min: 0.217s  |  Max: 0.260s  |  Avg: 0.231s  |  Spikes: 0
```

This proves the server CAN respond in ~220ms consistently when handling a single store.

### Test C: Full workflow timing for one store

```
/stores:          1.211s  (15 KB)
/tasks:           0.254s  (10 KB)
/complaints:      0.219s  (8 KB)
/chat/rules:      0.206s  (11 KB)
/review-statuses: 0.220s  (18 KB)
TOTAL:            2.110s per store
```

For 50 stores: 2.1s x 50 = **105 seconds minimum** (best case, no degradation).
With observed degradation: **~650+ seconds** (10+ minutes).

---

## 9. SPECIFIC STORES TO INVESTIGATE

These stores showed extreme response times during the 50-store scan. The backend team should profile these queries:

| Store Name | Store ID | Response Time | Notes |
|------------|----------|---------------|-------|
| МакШуз ООО | BhWUBJfOFTozPN1EkFml | **60.4s → 500** | 28 complaints, 20+ articles, 376KB response |
| ИП Пацюк А. В. | 9twKSDRjs4c27jQNDSzn | **21.1s** | Unknown data size |
| ИП Михайлова Н. Е. | TVEwh3Ay8RXLCdhzVnpC | **18.5s** | Unknown data size |
| ИП Гурьянов Е. В. | UbIWbc7i99s3bhRqeLrA | **13.4s** | Unknown data size |
| ИП Волков А. С. | VQY2HAOWFeETqxOW33nI | **11.2s** | Unknown data size |
| ООО "ГЕРУТАЛ" | SowY9N6NqMw9vHybxBjE | **8.1s** | Unknown data size |
| Duo Belan | BbzuROmqW0SSEjydH49U | **8.2s** | First request (cold start?) |

---

## 10. SUGGESTED ACTION ITEMS

| # | Action | Owner | Priority | Expected Impact |
|---|--------|-------|----------|-----------------|
| 1 | Profile and fix progressive degradation during sequential load | Backend | P0 | Fix 214s → ~15s target |
| 2 | Fix timeout on МакШуз ООО store (and similar large stores) | Backend | P0 | Eliminate HTTP 500 |
| 3 | Add server-side cache for `/stores` (30s TTL) | Backend | P1 | 1.1s → <50ms |
| 4 | Optimize `/tasks` query (eliminate N+1, use JOINs) | Backend | P1 | Reduce spikes |
| 5 | Add `Cache-Control` headers to all GET endpoints | Backend | P1 | Enable CDN caching |
| 6 | Review serverless concurrency/connection pool config | Backend | P1 | Fix concurrent degradation |
| 7 | Add lightweight `/stores/list` endpoint (no counts) | Backend | P2 | Fast initial load |
| 8 | Add server-side timing logs per query | Backend | P2 | Visibility for debugging |
| 9 | Consider bulk `/tasks` endpoint | Backend | P3 | 50 calls → 1 call |
| 10 | Raise rate limit from 100/min to 300/min | Backend | P3 | Support 50+ stores/cycle |
