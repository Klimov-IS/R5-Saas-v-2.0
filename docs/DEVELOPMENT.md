# Development Guide - WB Reputation Manager

**Last Updated:** 2026-01-15

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js:** v18+ (v22 recommended)
- **PostgreSQL:** 15+
- **Git:** Latest version
- **Code Editor:** VS Code recommended

### Installation

```bash
# 1. Clone repository
git clone https://github.com/Klimov-IS/R5-Saas-v-2.0.git
cd R5-Saas-v-2.0

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.local

# 4. Edit .env.local with your credentials
# See "Environment Variables" section below

# 5. Run development server
npm run dev

# 6. Open browser
# http://localhost:3000
```

---

## Environment Variables

Create `.env.local` in project root:

```bash
# Database (Yandex Managed PostgreSQL)
POSTGRES_HOST=rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net
POSTGRES_PORT=6432
POSTGRES_DATABASE=wb_reputation
POSTGRES_USER=admin_R5
POSTGRES_PASSWORD=MyNewPass123

# AI Service (Deepseek)
DEEPSEEK_API_KEY=sk-xxx

# Application
NODE_ENV=development
PORT=9002
NEXT_PUBLIC_API_KEY=wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
NEXT_PUBLIC_BASE_URL=http://localhost:9002

# Optional: For testing production builds locally
# NODE_ENV=production
```

**Important:**
- Never commit `.env.local` to Git (already in `.gitignore`)
- Production uses `.env.production` with different values
- `PORT=9002` for dev to avoid conflicts with other Next.js apps

---

## Project Structure

```
wb-reputation/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API routes
│   │   │   ├── stores/             # Store endpoints
│   │   │   │   └── [storeId]/
│   │   │   │       ├── products/
│   │   │   │       ├── reviews/
│   │   │   │       ├── chats/
│   │   │   │       └── ...
│   │   │   ├── cron/               # Background jobs
│   │   │   └── wb-proxy/           # WB API proxy
│   │   ├── stores/[storeId]/       # Store pages (UI)
│   │   │   ├── page.tsx            # Dashboard
│   │   │   ├── products/
│   │   │   ├── reviews/
│   │   │   ├── chats/
│   │   │   └── ...
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Home page
│   │
│   ├── components/                 # React components
│   │   ├── reviews-v2/             # Review UI
│   │   ├── providers/              # Context providers
│   │   └── ui/                     # Reusable UI components
│   │
│   ├── db/                         # Database layer
│   │   ├── pool.ts                 # PostgreSQL connection pool
│   │   ├── helpers.ts              # CRUD operations
│   │   ├── complaint-helpers.ts    # Complaint CRUD
│   │   └── review-filters.ts       # Filter logic
│   │
│   ├── ai/                         # AI integration
│   │   ├── flows/                  # AI workflows
│   │   │   ├── reply-generator.ts
│   │   │   └── complaint-generator.ts
│   │   ├── prompts/                # Prompt templates
│   │   └── utils/                  # AI utilities
│   │
│   ├── lib/                        # Utilities
│   │   ├── server-utils.ts         # API auth, rate limiting
│   │   ├── wb-api.ts               # WB API client
│   │   ├── cron-jobs.ts            # CRON configuration
│   │   └── init-server.ts          # Server initialization
│   │
│   └── types/                      # TypeScript definitions
│       ├── store.ts
│       ├── review.ts
│       └── ...
│
├── docs/                           # Documentation
├── scripts/                        # Utility scripts
├── supabase/migrations/            # Database migrations
├── instrumentation.ts              # Next.js instrumentation hook
├── next.config.mjs                 # Next.js config
├── ecosystem.config.js             # PM2 config (production)
└── package.json
```

---

## Development Commands

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server (locally)
npm start

# TypeScript type checking
npx tsc --noEmit

# Lint code
npm run lint

# Format code (if prettier configured)
npm run format
```

---

## Database Setup (Local)

### Option 1: Use Production Database (Read-Only)

Connect to production Yandex Cloud PostgreSQL:

```bash
# Already configured in .env.local
POSTGRES_HOST=rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net
```

**Warning:** Be careful with write operations. You're connected to production data!

### Option 2: Local PostgreSQL (Recommended for Testing)

```bash
# Install PostgreSQL 15
# macOS:
brew install postgresql@15

# Ubuntu:
sudo apt install postgresql-15

# Windows:
# Download from https://www.postgresql.org/download/windows/

# Create local database
createdb wb_reputation_dev

# Update .env.local
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=wb_reputation_dev
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
```

### Apply Migrations

```bash
# Navigate to migrations folder
cd supabase/migrations

# Apply each migration manually (in order)
PGPASSWORD="your_password" psql \
  -h localhost \
  -p 5432 \
  -U your_username \
  -d wb_reputation_dev \
  -f 001_initial_schema.sql
```

---

## API Development

### Creating New Endpoints

**1. Create route file:**

```typescript
// src/app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-utils';

export async function GET(request: NextRequest) {
  // Authenticate request
  const authError = authenticateRequest(request);
  if (authError) {
    return authError;
  }

  try {
    // Your logic here
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
```

**2. Add database query:**

```typescript
// src/db/helpers.ts
export async function getYourData(): Promise<YourType[]> {
  const result = await query<YourType>(
    "SELECT * FROM your_table ORDER BY created_at DESC"
  );
  return result.rows;
}
```

**3. Test locally:**

```bash
# Start dev server
npm run dev

# Test endpoint
curl -X GET "http://localhost:9002/api/your-endpoint" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
```

---

## CRON Jobs (Development)

### Auto-Start Behavior

CRON jobs start automatically when running `npm run dev` (via `instrumentation.ts`).

**Development Schedule:** Every 5 minutes (vs production: daily at 8:00 AM MSK)

**Source:** [src/lib/cron-jobs.ts:54-56](../src/lib/cron-jobs.ts#L54-L56)

```typescript
const cronSchedule = process.env.NODE_ENV === 'production'
  ? '0 5 * * *'      // Production
  : '*/5 * * * *';   // Development (every 5 minutes)
```

### Disable CRON Jobs During Development

If you don't want CRON jobs running every 5 minutes:

**Option 1: Temporary disable (quick)**

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Comment out this line:
    // initializeServer();

    console.log('[INSTRUMENTATION] CRON jobs disabled for development');
  }
}
```

**Option 2: Environment variable flag**

```typescript
// src/lib/init-server.ts
export function initializeServer() {
  if (process.env.DISABLE_CRON === 'true') {
    console.log('[INIT] CRON jobs disabled via env var');
    return;
  }

  // ... rest of code
}
```

Then in `.env.local`:
```bash
DISABLE_CRON=true
```

### Testing CRON Jobs

```bash
# 1. Start dev server (CRON auto-starts)
npm run dev

# 2. Watch logs for CRON execution
# Look for "[CRON]" messages in terminal

# 3. Wait 5 minutes or modify schedule to */1 * * * * (every minute)
```

---

## Working with AI (Deepseek)

### Generate Review Reply (Local Test)

```bash
curl -X POST "http://localhost:9002/api/stores/{storeId}/reviews/{reviewId}/generate-reply" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -H "Content-Type: application/json"
```

### Generate Complaint

```bash
curl -X POST "http://localhost:9002/api/stores/{storeId}/reviews/{reviewId}/generate-complaint" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue" \
  -H "Content-Type: application/json"
```

### Modify AI Prompts

Located in `src/ai/prompts/`:

```typescript
// src/ai/prompts/review-reply.ts
export const REVIEW_REPLY_PROMPT = `
You are a professional customer service representative...
[Your custom instructions here]
`;
```

---

## TypeScript Development

### Adding New Types

```typescript
// src/types/your-type.ts
export interface YourType {
  id: string;
  name: string;
  created_at: Date;
}

// Export from index
// src/types/index.ts
export * from './your-type';
```

### Type-Safe Database Queries

```typescript
import { query } from '@/db/pool';
import type { YourType } from '@/types';

export async function getYourData(): Promise<YourType[]> {
  const result = await query<YourType>(
    "SELECT id, name, created_at FROM your_table"
  );
  return result.rows;
}
```

---

## Testing

### Manual API Testing

```bash
# Get all stores
curl -X GET "http://localhost:9002/api/stores" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Sync products for store
curl -X POST "http://localhost:9002/api/stores/{storeId}/products/update" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Get reviews (with filters)
curl -X GET "http://localhost:9002/api/stores/{storeId}/reviews?rating=1&hasAnswer=false&limit=10" \
  -H "Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
```

### Database Testing

```bash
# Connect to database
PGPASSWORD="MyNewPass123" psql \
  -h rc1a-u6gmh29sivrjjbc8.mdb.yandexcloud.net \
  -p 6432 \
  -U admin_R5 \
  -d wb_reputation

# Run test queries
SELECT COUNT(*) FROM stores WHERE status='active';
SELECT COUNT(*) FROM reviews WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## Debugging

### Enable Detailed Logs

```typescript
// Add debug logs in your code
console.log('[DEBUG] Variable value:', variableName);
console.log('[DEBUG] Request headers:', request.headers);
```

### PostgreSQL Query Logging

```typescript
// src/db/pool.ts
const pool = new Pool({
  // ... config ...
  log: (msg) => console.log('[PG]', msg),  // Enable query logging
});
```

### Next.js Debug Mode

```bash
# Run with verbose logging
NODE_OPTIONS='--inspect' npm run dev

# Then open Chrome DevTools: chrome://inspect
```

---

## Git Workflow

### Making Changes

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add .
git commit -m "feat: description of changes"

# 3. Push to GitHub
git push origin feature/your-feature-name

# 4. Create Pull Request on GitHub
```

### Commit Message Format

```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- refactor: Code refactoring
- perf: Performance improvement
- test: Test changes
- chore: Build/config changes

Examples:
feat: Add AI chat classification endpoint
fix: Resolve database connection timeout
docs: Update CRON jobs documentation
refactor: Simplify review sync logic
```

---

## Git Authentication Setup

### GitHub Personal Access Token (PAT)

For push/pull operations, configure Git with a Personal Access Token:

**1. Create Token on GitHub:**

- Visit: https://github.com/settings/tokens/new
- Select: **"Fine-grained token"** (recommended) or "Classic"
- **Repository access:** All repositories
- **Permissions required:**
  - ✅ **Contents:** Read and write
  - ✅ **Metadata:** Read-only (auto-selected)
- **Expiration:** 90 days (or "No expiration" for trusted environments)
- Click **"Generate token"**
- **Copy token immediately** (shown only once!)

**2. Configure Git Remote with Token:**

```bash
cd "R5 saas-prod"

# Replace [YOUR_TOKEN] with actual token
git remote set-url origin https://[YOUR_TOKEN]@github.com/Klimov-IS/R5-Saas-v-2.0.git

# Verify configuration
git remote -v
# Should show: https://github_pat_xxx@github.com/Klimov-IS/R5-Saas-v-2.0.git
```

**3. Test Push:**

```bash
# Make a test commit
git add .
git commit -m "test: verify git authentication"
git push origin main
```

**Security Notes:**

- ⚠️ **Never commit tokens to Git!**
- Token is stored in `.git/config` (automatically excluded from Git)
- For production server, use SSH keys instead (more secure)
- If token is accidentally exposed, regenerate immediately on GitHub

**Current Configuration:**

- **Method:** Personal Access Token (Fine-grained)
- **Repository:** `Klimov-IS/R5-Saas-v-2.0`
- **Branch:** `main`
- **Token Permissions:** Contents (Read & Write) + Metadata (Read)

---

## Common Development Tasks

### Add New Database Table

**1. Create migration file:**

```sql
-- supabase/migrations/XXX_add_your_table.sql
CREATE TABLE your_table (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_your_table_name ON your_table(name);
```

**2. Apply migration:**

```bash
PGPASSWORD="your_password" psql \
  -h localhost \
  -p 5432 \
  -U your_username \
  -d wb_reputation_dev \
  -f supabase/migrations/XXX_add_your_table.sql
```

**3. Add TypeScript types:**

```typescript
// src/types/your-table.ts
export interface YourTable {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}
```

**4. Add database helpers:**

```typescript
// src/db/helpers.ts
export async function createYourRecord(name: string): Promise<YourTable> {
  const result = await query<YourTable>(
    "INSERT INTO your_table (name) VALUES ($1) RETURNING *",
    [name]
  );
  return result.rows[0];
}
```

---

## Performance Profiling

### Monitor API Response Times

```typescript
// Add to API route
const startTime = Date.now();

// ... your logic ...

const duration = Date.now() - startTime;
console.log(`[PERF] ${request.url} took ${duration}ms`);
```

### Database Query Performance

```sql
-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM reviews WHERE store_id = 'xxx' ORDER BY created_at DESC LIMIT 100;

-- Check slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Hot Reload Issues

If hot reload stops working:

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Clear .next cache
rm -rf .next

# 3. Restart dev server
npm run dev
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Type checking | `npx tsc --noEmit` |
| Connect to DB | `psql -h rc1a-xxx.mdb.yandexcloud.net -p 6432 -U admin_R5 -d wb_reputation` |
| Test API endpoint | `curl -H "Authorization: Bearer wbrm_xxx" http://localhost:9002/api/stores` |
| View dev logs | Check terminal running `npm run dev` |

---

**Last Updated:** 2026-01-15
**Development Port:** 9002
**CRON Schedule (Dev):** Every 5 minutes
