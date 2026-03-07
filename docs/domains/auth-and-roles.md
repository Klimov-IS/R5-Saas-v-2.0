# Auth & Roles System

**Last Updated:** 2026-03-06
**Status:** Current
**Migration:** 010
**Source of Truth:** This document

---

## Overview

JWT-based auth with invite-only registration. Three roles: owner, admin, manager.

---

## JWT Implementation

| Aspect | Value |
|--------|-------|
| Algorithm | HS256 (HMAC SHA-256) |
| Secret | `JWT_SECRET` env var |
| Expiry | 7 days |
| Cookie | `r5_token` (httpOnly, secure in prod, sameSite: lax) |
| Password | bcrypt, 10 rounds |

**JWT Payload:** `{ userId, email, orgId, role }`

**File:** `src/lib/auth.ts`

**Key functions:** `signToken()`, `verifyToken()`, `getSession()`, `requireSession()`, `requireRole(...roles)`

---

## Role System

| Role | Invite | Change Roles | Remove Members | Store Access |
|------|--------|-------------|----------------|-------------|
| **Owner** | admin, manager | all (except self) | yes (except self) | All stores |
| **Admin** | admin, manager | admin↔manager | yes (except owner) | All stores |
| **Manager** | — | — | — | Assigned stores only |

**Owner is immutable:** Cannot be demoted, removed, or changed.

---

## Database (Migration 010)

### `organizations`
```sql
id (UUID PK), name (TEXT), owner_id (TEXT → users), created_at
```

### `org_members`
```sql
id (UUID PK), org_id (TEXT → organizations), user_id (TEXT → users),
role (TEXT: 'owner'|'admin'|'manager'), created_at
UNIQUE(org_id, user_id)
```

### `member_store_access`
```sql
id (UUID PK), member_id (TEXT → org_members), store_id (TEXT → stores)
UNIQUE(member_id, store_id)
```
Managers only — explicit store allowlist.

### `invites`
```sql
id (UUID PK), org_id, email, role ('admin'|'manager'),
token (TEXT UNIQUE), invited_by, expires_at (7 days), used_at
```

---

## Invite Flow

1. **Owner/admin creates invite** → `POST /api/org/invites`
   - Returns: registration URL + Telegram deep link
2. **Invitee validates** → `GET /api/auth/invite-info?token=xxx`
3. **Invitee registers** → `POST /api/auth/register`
   - Transactional: creates user + settings + org_member + store access
   - Manager auto-assigned to all active stores
   - Auto-signs JWT + sets cookie
4. **Optional TG linking** → `/start wbrm_<key>` or `/start inv_<token>`

---

## API Endpoints

### Auth (`/api/auth/`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/login` | None | Email + password → JWT |
| POST | `/register` | None | Register via invite token |
| GET | `/invite-info?token=xxx` | None | Validate invite |
| GET | `/me` | Required | Current user + org + role |
| POST | `/logout` | Required | Clear cookie |

### Organization (`/api/org/`) — Owner/Admin only

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/members` | List all org members |
| POST | `/invites` | Create invite |
| GET | `/invites` | List invites |
| PATCH | `/members/[id]` | Change role |
| DELETE | `/members/[id]` | Remove member |
| GET | `/members/[id]/stores` | Get manager's stores |
| PUT | `/members/[id]/stores` | Set manager's stores |

---

## Middleware (`src/middleware.ts`)

**Two-tier protection:**
1. **CORS** for Chrome Extension (`chrome-extension://*`)
2. **Auth redirect** — checks `r5_token` cookie presence (NOT JWT validation)
   - Missing cookie → redirect to `/login?from=/requested-path`
   - Full JWT verification happens in route handlers

**Public paths:** `/login`, `/register`, `/api/`, `/tg`, `/_next/`, `/favicon`

---

## UI Pages

| Path | Purpose |
|------|---------|
| `/login` | Email + password form |
| `/register` | Invite-based registration (token from URL) |
| `/team` | Member list, invites, role changes, store assignment |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | JWT + password logic |
| `src/db/auth-helpers.ts` | DB helpers (CRUD, transactional registration) |
| `src/middleware.ts` | Route protection |
| `migrations/010_auth_and_roles.sql` | Schema |
| `src/app/api/auth/` | Auth endpoints |
| `src/app/api/org/` | Org management endpoints |
| `src/app/team/page.tsx` | Team management UI |

---

## Production

- **Ivan's org:** `2f36a863-7ff7-41a4-aa43-5b48c4659497` (65 stores)
- **API key format:** `wbrm_<32-hex>`
- **TG deep links:** `https://t.me/R5_chat_bot?start=inv_<token>`

---

**Last Updated:** 2026-03-06
