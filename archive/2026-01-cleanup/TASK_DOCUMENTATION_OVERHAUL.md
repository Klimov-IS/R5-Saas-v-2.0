# TASK — Documentation Overhaul (WB Reputation Manager)

You are working in an existing production Next.js 14 project (WB Reputation Manager v2.0).
The application is deployed on Yandex Cloud (158.160.217.236), has 44 active stores, 2M+ reviews, and runs background CRON jobs.

## Context

Current documentation state (7/10):
- ✅ Good: TypeScript types, folder structure, inline comments in critical files
- ❌ Missing: Comprehensive README, architecture overview, deployment procedures, troubleshooting guides
- ❌ Pain points:
  - No clear entry point for new developers
  - Production server info scattered across files
  - CRON jobs mechanism not documented
  - API endpoints lack usage examples
  - No troubleshooting section for common issues

## Goal

Create professional, comprehensive, and maintainable documentation that enables:
1. **New developers** to understand the project in <30 minutes
2. **DevOps/SRE** to deploy and troubleshoot without code diving
3. **Product team** to understand system capabilities and limitations
4. **Future maintenance** with clear architecture and decision records

## Scope (must implement)

### A) Main README.md Enhancement

Update existing `/README.md` (currently exists but incomplete):

1. **Quick Start section** (first 200 lines):
   - 30-second project summary
   - Tech stack table (current versions)
   - Prerequisites checklist
   - 5-minute local setup (copy-paste commands)
   - "How to verify it works" checklist

2. **Architecture Overview**:
   - System architecture diagram (ASCII or Mermaid)
   - Data flow: WB API → Next.js → PostgreSQL → Frontend
   - CRON jobs lifecycle (when they run, what they do)
   - Key directories explained (src/app/api, src/lib, src/db, src/ai)

3. **Core Features Documentation**:
   - Review sync (full vs incremental modes)
   - AI-powered reply generation
   - Complaint system workflow
   - Chat management
   - Product rules engine
   - Background jobs (CRON)

4. **Configuration Reference**:
   - Environment variables table (required vs optional)
   - Feature flags (if any)
   - Third-party API keys needed (WB, Deepseek)

5. **API Documentation**:
   - Link to Swagger UI (http://158.160.217.236/api/docs)
   - Top 10 most-used endpoints with curl examples
   - Authentication guide (Bearer token format)
   - Rate limiting info

### B) Deployment Documentation

Create `/docs/DEPLOYMENT.md`:

1. **Production Environment**:
   - Server specs (Yandex Cloud, Ubuntu 24.04, 2vCPU/4GB)
   - IP address: 158.160.217.236
   - PM2 configuration details
   - Nginx reverse proxy setup

2. **Deployment Procedures**:
   - Standard deployment (using `deploy/update-app.sh`)
   - Emergency rollback procedure
   - Database migration steps
   - Zero-downtime deployment checklist

3. **SSH Access**:
   - SSH key location (`~/.ssh/yandex-cloud-wb-reputation`)
   - Connection command with explanation
   - Common PM2 commands reference

4. **Post-Deployment Verification**:
   - Health check endpoints
   - CRON status verification
   - Log monitoring commands
   - What to check after each deploy

### C) CRON Jobs Documentation

Create `/docs/CRON_JOBS.md`:

1. **Overview**:
   - What CRON jobs exist
   - Why we use CRON (vs manual sync)
   - Auto-initialization mechanism (`instrumentation.ts`)

2. **Job Schedules**:
   - Production: `0 5 * * *` (08:00 MSK daily)
   - Development: `*/5 * * * *` (every 5 minutes)
   - Why these schedules were chosen

3. **Daily Review Sync Job**:
   - What it does (syncs reviews from WB API)
   - Which stores it processes (only `status='active'`)
   - Expected duration (~90-120 seconds)
   - Retry logic and error handling

4. **Monitoring & Troubleshooting**:
   - How to check if CRON is running (`/api/cron/status`)
   - How to manually trigger (`/api/cron/init`)
   - Common issues and solutions
   - Log inspection guide

### D) Troubleshooting Guide

Create `/docs/TROUBLESHOOTING.md`:

1. **Common Issues**:
   - "CRON not running after deployment" → Solution
   - "401 Unauthorized from WB API" → Token refresh guide
   - "Database connection timeout" → Connection pool debugging
   - "PM2 process crashed" → Recovery steps
   - "Build fails on production" → Common causes

2. **Debugging Procedures**:
   - How to read PM2 logs
   - How to check PostgreSQL connection
   - How to test WB API tokens
   - How to verify environment variables

3. **Health Checks**:
   - `/api/health` endpoint usage
   - Database connectivity check
   - External API availability checks

### E) Development Guide

Create `/docs/DEVELOPMENT.md`:

1. **Local Development Setup**:
   - Step-by-step environment setup
   - How to connect to dev database
   - How to test CRON jobs locally
   - Hot reload and debugging tips

2. **Code Organization**:
   - File structure conventions
   - Where to add new API endpoints
   - Where to add new database queries
   - Where to add new AI prompts

3. **Testing**:
   - How to test API endpoints manually (curl examples)
   - How to test CRON jobs without waiting
   - How to test database migrations

4. **Common Development Tasks**:
   - Adding a new store
   - Creating a new sync endpoint
   - Modifying AI prompts
   - Adding new database fields

### F) Architecture Decision Records (ADR)

Create `/docs/decisions/` directory with:

1. **ADR-001-why-instrumentation-hook.md**:
   - Why we use Next.js instrumentation hook for CRON
   - Alternatives considered (PM2 cron, separate worker)
   - Trade-offs and rationale

2. **ADR-002-active-stores-filter.md**:
   - Why we filter by `status='active'` in CRON
   - Performance impact (49 → 43 stores, -12% load)
   - When decision was made (date)

3. **ADR-003-cron-intervals.md**:
   - Why dev = 5 minutes, prod = daily 08:00 MSK
   - Calculation of optimal intervals
   - Future considerations

### G) Quick Reference Cards

Create `/docs/QUICK_REFERENCE.md`:

1. **Deployment Commands** (copy-paste ready):
   ```bash
   # Deploy to production
   ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
     "cd /var/www/wb-reputation && bash deploy/update-app.sh"

   # Check logs
   ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
     "pm2 logs wb-reputation --lines 100"
   ```

2. **Common API Calls**:
   ```bash
   # Get all stores
   curl -H "Authorization: Bearer $TOKEN" \
     http://158.160.217.236/api/stores

   # Trigger review sync
   curl -X POST -H "Authorization: Bearer $TOKEN" \
     http://158.160.217.236/api/stores/{id}/reviews/update?mode=incremental
   ```

3. **Monitoring Commands**:
   ```bash
   # Check CRON status
   curl -H "Authorization: Bearer $TOKEN" \
     http://158.160.217.236/api/cron/status

   # View PM2 status
   pm2 status
   pm2 monit
   ```

## Non-goals (explicitly do NOT implement)

- ❌ UI documentation (no screenshots or frontend guides)
- ❌ User manuals (this is for developers/DevOps only)
- ❌ Business process documentation
- ❌ Marketing materials
- ❌ API client libraries or SDKs
- ❌ Video tutorials
- ❌ Migration guides from v1.0 (if exists)

## Required Documentation Quality Standards

1. **Clarity**: Every document must be understandable by a developer who has NEVER seen the codebase
2. **Copy-paste ready**: All commands must work without modification (except variables like `$TOKEN`)
3. **Examples**: Every feature must have at least one real-world example
4. **Maintenance**: Include "Last Updated" date at top of each doc
5. **Cross-linking**: Docs should reference each other (avoid duplication)

## Definition of Done

- ✅ Main README.md has Quick Start section (new dev can start in 5 minutes)
- ✅ `/docs/DEPLOYMENT.md` exists with SSH commands and deployment checklist
- ✅ `/docs/CRON_JOBS.md` explains instrumentation hook and schedules
- ✅ `/docs/TROUBLESHOOTING.md` covers top 5 common issues
- ✅ `/docs/DEVELOPMENT.md` has local setup guide
- ✅ `/docs/decisions/` has at least 3 ADRs
- ✅ `/docs/QUICK_REFERENCE.md` has copy-paste commands for deployment/monitoring
- ✅ All code examples tested and working
- ✅ All links valid (no 404s)
- ✅ Mermaid diagrams render correctly in GitHub
- ✅ Every doc has "Last Updated" date
- ✅ No scope creep (stayed within defined scope)

## Implementation Notes

### Key Decisions

1. **Format**: Use Markdown for all docs (GitHub-flavored)
2. **Diagrams**: Use Mermaid.js (renders in GitHub natively)
3. **Code blocks**: Always specify language for syntax highlighting
4. **Real data**: Use actual production values (IP, paths, schedules)
5. **Security**: Mask secrets (tokens, passwords) but show format

### Trade-offs

- **Comprehensive vs. Concise**: Chose comprehensive (better for onboarding, worse for quick reference)
  - Mitigation: Created QUICK_REFERENCE.md for common tasks
- **Single README vs. Multiple docs**: Chose multiple (better organization, worse for initial discovery)
  - Mitigation: Enhanced main README with clear links to other docs

### Documentation Structure

```
/
├── README.md                          # Main entry point (enhanced)
├── docs/
│   ├── DEPLOYMENT.md                  # Production deployment guide
│   ├── CRON_JOBS.md                   # Background jobs documentation
│   ├── TROUBLESHOOTING.md             # Common issues & solutions
│   ├── DEVELOPMENT.md                 # Local dev setup
│   ├── QUICK_REFERENCE.md             # Copy-paste commands
│   └── decisions/
│       ├── ADR-001-why-instrumentation-hook.md
│       ├── ADR-002-active-stores-filter.md
│       └── ADR-003-cron-intervals.md
└── deploy/
    ├── update-app.sh                  # Already exists
    └── ...
```

## Files Changed

**New files** (7):
- `/docs/DEPLOYMENT.md`
- `/docs/CRON_JOBS.md`
- `/docs/TROUBLESHOOTING.md`
- `/docs/DEVELOPMENT.md`
- `/docs/QUICK_REFERENCE.md`
- `/docs/decisions/ADR-001-why-instrumentation-hook.md`
- `/docs/decisions/ADR-002-active-stores-filter.md`
- `/docs/decisions/ADR-003-cron-intervals.md`

**Modified files** (1):
- `/README.md` (enhanced with Quick Start, Architecture, API reference)

## Commands to Run

**After implementation:**

```bash
# 1. Verify all docs render correctly on GitHub
# (push to GitHub and check in browser)

# 2. Test all code examples
cd /path/to/wb-reputation

# Test deployment command (dry-run if possible)
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "echo 'SSH connection works'"

# Test API examples
export TOKEN="wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
curl -H "Authorization: Bearer $TOKEN" http://158.160.217.236/api/cron/status

# 3. Verify Mermaid diagrams
# Use GitHub's preview or https://mermaid.live

# 4. Check for broken links
# Use markdown link checker or manual review

# 5. Update "Last Updated" dates
# Add to top of each document: **Last Updated:** 2026-01-15
```

## DoD Checklist Template

When implementation is complete, verify:

```markdown
- [ ] Main README.md has Quick Start section (5-minute setup)
- [ ] `/docs/DEPLOYMENT.md` exists with full deployment procedure
- [ ] `/docs/CRON_JOBS.md` explains auto-initialization
- [ ] `/docs/TROUBLESHOOTING.md` has 5+ common issues
- [ ] `/docs/DEVELOPMENT.md` has local setup steps
- [ ] `/docs/decisions/` has 3 ADRs
- [ ] `/docs/QUICK_REFERENCE.md` has deployment/monitoring commands
- [ ] All curl examples tested and working
- [ ] All SSH commands tested
- [ ] Mermaid diagrams render on GitHub
- [ ] Every doc has "Last Updated" date
- [ ] Cross-references between docs are correct
- [ ] No secrets exposed (tokens/passwords masked)
- [ ] Reviewed by at least one other person
```

## Success Metrics

Documentation quality will be measured by:
1. **Time to first contribution**: New developer can submit first PR in <2 hours
2. **Deployment confidence**: DevOps can deploy without asking questions
3. **Troubleshooting speed**: Common issues resolved in <10 minutes using docs
4. **Onboarding feedback**: New team members rate docs 8+/10

---

**Estimated Effort**: 4-6 hours
**Priority**: High (blocks efficient onboarding and reduces bus factor)
**Dependencies**: None (can start immediately)
