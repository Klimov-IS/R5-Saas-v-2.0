# WB Reputation Manager

**Production-ready B2B SaaS platform** for Wildberries sellers to manage reviews, chats, complaints, and customer communication with AI-powered automation.

**🚀 Status:** Production (deployed on Yandex Cloud)
**📊 Scale:** 44 active stores, 2M+ reviews
**🌐 Production URL:** http://158.160.217.236

---

## 🎯 Overview

WB Reputation Manager helps Wildberries sellers:
- Sync and manage **reviews, chats, questions** from multiple stores
- Generate **AI-powered responses** to reviews and customer messages
- Automate **complaint generation** for problematic reviews
- Track product performance and customer sentiment
- Bulk operations and background synchronization

---

## 🛠️ Tech Stack

### Backend
- **Framework:** Next.js 14.2.35 (App Router)
- **Runtime:** Node.js v22.21.0
- **Database:** Yandex Managed PostgreSQL 15
- **Process Manager:** PM2 (cluster mode, 2 instances)
- **Web Server:** Nginx (reverse proxy)

### Frontend
- **Framework:** React 18 (Next.js)
- **UI Library:** Tailwind CSS 3
- **State Management:** React Context
- **Type Safety:** TypeScript 5

### AI & APIs
- **AI Engine:** Deepseek API (review replies, complaint generation)
- **External APIs:**
  - Wildberries Feedbacks API (reviews)
  - Wildberries Content API (products)
  - Wildberries Chat API (customer messages)

### Deployment
- **Cloud Provider:** Yandex Cloud Compute
- **Region:** ru-central1-d
- **Configuration:** 2 vCPU, 4GB RAM, 20GB SSD
- **OS:** Ubuntu 24.04 LTS

---

## ✨ Key Features

### 1. **Multi-Store Management**
- Manage multiple WB stores from single dashboard
- Store-specific API tokens and settings
- Bulk operations across all stores

### 2. **Review Synchronization**
- **Adaptive chunking** to bypass WB API 20k limit
- Full sync: fetch ALL reviews (1M+ reviews per store)
- Incremental sync: only new reviews since last update
- **Real-time progress tracking** (updates every 5 chunks)
- **Retry logic** with exponential backoff (3 attempts)
- Background sync jobs (daily at 8:00 AM MSK)

### 3. **AI-Powered Review Replies**
- Automatic reply generation using Deepseek AI
- Context-aware responses based on review sentiment
- 75% token optimization (838 → 208 tokens)
- Review classification (positive, neutral, negative)

### 4. **Complaint System**
- Dedicated `review_complaints` table with 30+ fields
- AI-powered complaint text generation
- Track complaint lifecycle (draft → sent → resolved)
- WB marketplace policy compliance

### 5. **Product Rules & Settings**
- 17 configurable fields per product
- Auto-reply settings
- AI assistant customization per product
- Bulk rule updates

### 6. **Chat Management**
- Real-time chat synchronization from WB
- AI classification (complaints, questions, feedback)
- Tag-based organization (active, no_reply, completed)
- Bulk messaging capabilities

### 7. **Background Jobs**
- Daily review sync (cron: 0 5 * * *)
- Automatic retry on failures
- Progress monitoring and logging

---

## 📁 Project Structure

```
wb-reputation/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # REST API endpoints
│   │   │   ├── stores/             # Store management
│   │   │   ├── cron/               # Background jobs
│   │   │   └── wb-proxy/           # WB API proxy
│   │   ├── stores/[storeId]/       # Store pages
│   │   │   ├── products/
│   │   │   ├── reviews/
│   │   │   └── chats/
│   │   └── layout.tsx
│   ├── components/                 # React components
│   │   ├── reviews-v2/             # Review UI components
│   │   └── providers/              # Context providers
│   ├── db/                         # Database layer
│   │   ├── helpers.ts              # PostgreSQL queries
│   │   ├── complaint-helpers.ts    # Complaint CRUD
│   │   └── review-filters.ts       # Filter logic
│   ├── ai/                         # AI integration
│   │   ├── flows/                  # AI workflows
│   │   ├── prompts/                # Prompt templates
│   │   └── utils/                  # AI utilities
│   ├── lib/                        # Utilities
│   │   ├── server-utils.ts         # API auth, rate limiting
│   │   ├── wb-api.ts               # WB API client
│   │   └── cron-jobs.ts            # Cron configuration
│   └── types/                      # TypeScript definitions
├── scripts/                        # Utility scripts
│   ├── full-sync-all-stores-v2.sh  # Batch sync (43 stores)
│   ├── check-sync-status.sh        # Monitoring
│   └── sync-config.sh              # Configuration
├── supabase/migrations/            # PostgreSQL migrations
├── docs/                           # Documentation
├── .env.production                 # Production credentials
├── ecosystem.config.js             # PM2 configuration
└── next.config.mjs                 # Next.js config
```

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/Klimov-IS/R5-Saas-v-2.0.git
cd R5-Saas-v-2.0

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations (if needed)
# Apply migrations from supabase/migrations/ to your PostgreSQL

# Start development server
npm run dev

# Open http://localhost:3000
```

---

## 📊 Database Schema

### Core Tables
- **stores** - WB seller accounts
- **products** - Product catalog (synced from WB)
- **reviews** - Customer reviews
- **review_complaints** - Complaint tracking system (30+ fields)
- **chats** - Customer messages
- **questions** - Product questions
- **logs** - System activity logs

### Key Relationships
```sql
stores (1) → (N) products
products (1) → (N) reviews
reviews (1) → (1) review_complaints
stores (1) → (N) chats
```

---

## 🔑 API Authentication

All API endpoints require Bearer token authentication:

```bash
curl -X GET "http://158.160.217.236/api/stores" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**API Key Format:** `wbrm_*` (stored in database)

---

## 📖 API Documentation

**Swagger UI:** http://158.160.217.236/api/docs

### Key Endpoints

#### Store Management
```
GET    /api/stores                    # List all stores
POST   /api/stores                    # Create new store
GET    /api/stores/:id                # Get store details
PATCH  /api/stores/:id                # Update store
DELETE /api/stores/:id                # Delete store
```

#### Product Sync
```
POST   /api/stores/:id/products/update           # Sync products from WB
GET    /api/stores/:id/products                  # List products
POST   /api/stores/:id/products/bulk-actions     # Bulk operations
```

#### Review Sync
```
POST   /api/stores/:id/reviews/update?mode=full         # Full sync (all reviews)
POST   /api/stores/:id/reviews/update?mode=incremental  # Incremental sync
GET    /api/stores/:id/reviews                          # List reviews
GET    /api/stores/:id/reviews/stats                    # Review statistics
```

#### AI Operations
```
POST   /api/stores/:id/reviews/:reviewId/generate-reply      # Generate AI reply
POST   /api/stores/:id/reviews/:reviewId/generate-complaint  # Generate complaint
POST   /api/stores/:id/chats/classify-all                    # Classify all chats
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Database (Yandex Managed PostgreSQL)
POSTGRES_HOST=rc1a-xxx.mdb.yandexcloud.net
POSTGRES_PORT=6432
POSTGRES_DATABASE=wb_reputation
POSTGRES_USER=admin_R5
POSTGRES_PASSWORD=***

# AI (Deepseek)
DEEPSEEK_API_KEY=sk-***

# Application
NODE_ENV=production
PORT=3000
API_KEY=wbrm_***
```

### Sync Configuration

Edit `scripts/sync-config.sh`:

```bash
# Delay between stores (seconds)
DELAY_BETWEEN_STORES=600  # 10 minutes

# Retry configuration
MAX_RETRIES=3
RETRY_DELAY_1=600   # 10 min
RETRY_DELAY_2=1200  # 20 min

# Exclude stores (already synced)
EXCLUDE_STORE_ID="UiLCn5HyzRPphSRvR11G"  # Тайди Центр
```

---

## 🚀 Deployment

### Production Deployment

```bash
# SSH to production server
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# Navigate to project
cd /var/www/wb-reputation

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --production=false

# Build production bundle
npm run build

# Reload PM2
pm2 reload wb-reputation

# Check status
pm2 status
pm2 logs wb-reputation --lines 50
```

**One-command update:**
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
  "cd /var/www/wb-reputation && bash deploy/update-app.sh"
```

---

## 📊 Monitoring

### Check Application Status

```bash
# Quick health check
curl http://158.160.217.236/health

# PM2 status
pm2 status

# Live logs
pm2 logs wb-reputation

# Check sync status (custom script)
bash scripts/check-sync-status.sh
```

### Sync Progress Monitoring

```bash
# View v2 sync logs
tail -f sync-v2-*.log

# Check store statistics
curl -s http://localhost:3000/api/stores \
  -H "Authorization: Bearer YOUR_KEY" | jq
```

---

## 🎯 Performance

### Current Scale
- **44 active stores**
- **2,072,693 total reviews**
- **Largest store:** 1,344,055 reviews (Тайди Центр)
- **Sync speed:** ~2-3 minutes per chunk (90 days)
- **AI optimization:** 75% token reduction (838 → 208 tokens)

### Optimization Highlights
- Adaptive date chunking (bypass WB API 20k limit)
- COALESCE in SQL for preserving manual edits
- Connection pooling (max 50 connections)
- PM2 cluster mode (2 instances)
- Periodic stats updates (every 5 chunks)

---

## 📚 Documentation

### 🚀 Quick Start Guides

- **[QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md)** - Copy-paste ready commands for common tasks
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Production deployment guide (SSH, PM2, one-command deploy)
- **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** - Local development setup and workflows

### ⚙️ Operational Guides

- **[CRON_JOBS.md](./docs/CRON_JOBS.md)** - Background jobs, auto-start, monitoring
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

### 📖 Technical Reference

- **[database-schema.md](./docs/database-schema.md)** - Complete PostgreSQL schema documentation
- **[complaint-auto-generation-rules.md](./docs/complaint-auto-generation-rules.md)** - Complaint system rules
- **[complaints-table-schema.md](./docs/complaints-table-schema.md)** - Review complaints table details
- **[CHROME_EXTENSION_INTEGRATION.md](./docs/CHROME_EXTENSION_INTEGRATION.md)** - Chrome Extension for WB reviews parsing (⚠️ BLOCKED)

### 🏗️ Architecture Decision Records (ADR)

- **[ADR-001: Why Instrumentation Hook](./docs/decisions/ADR-001-why-instrumentation-hook.md)** - CRON auto-start decision
- **[ADR-002: Active Stores Filter](./docs/decisions/ADR-002-active-stores-filter.md)** - Filtering by store status
- **[ADR-003: CRON Intervals](./docs/decisions/ADR-003-cron-intervals.md)** - 5 min dev, daily prod schedule

### 📦 Historical Documentation

- **[docs/archive/](./docs/archive/)** - Sprint reports, migration changelogs, historical analysis

---

## 🔐 Security

- ✅ SSH key authentication (no passwords)
- ✅ API Bearer token authentication
- ✅ PM2 auto-restart on crashes
- ✅ Nginx reverse proxy
- ⚠️ HTTP only (SSL recommended for production domain)
- ⏳ Firewall configuration (recommended)

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/your-feature`
5. Create Pull Request

---

## 📞 Support & Links

- **Production URL:** http://158.160.217.236
- **GitHub Repository:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **API Documentation:** http://158.160.217.236/api/docs

---

## 📝 License

Proprietary - All rights reserved

---

**Last Updated:** January 15, 2026
**Version:** 2.0.0
**Database:** PostgreSQL 15 on Yandex Cloud
**Status:** 🟢 Production
**Documentation:** ✅ Comprehensive (see [docs/](./docs/))
