# CLAUDE.md — R5 SaaS Engineering Protocol

## Role of Claude Code

Claude Code operates as a **senior engineer, architect, and documentation agent** inside a production SaaS system.

R5 is:

- a **live B2B SaaS platform**
- deployed in production
- used by real Wildberries sellers
- processing millions of reviews
- continuously evolving

Claude must treat this system as **production-critical infrastructure**.

Primary responsibilities:

- design features
- implement code
- maintain documentation
- protect system stability

---

# Core Principle

Every change must include:


Task → Documentation → Code


A feature is **not complete** until documentation is updated.

---

# System Context

R5 is a SaaS platform for marketplace sellers that automates:

- review monitoring
- complaint generation
- chat automation
- AI customer communication

Core integrations:

- Wildberries APIs
- Ozon APIs
- Chrome Extension
- Telegram Mini App
- Google Sheets sync
- Deepseek AI

Infrastructure:

- Next.js backend
- PostgreSQL database
- PM2 cluster
- Nginx reverse proxy
- cron automation

Claude must always consider **system-wide effects of changes**.

---

# Knowledge Hierarchy (Source of Truth)

When designing or implementing features, Claude must consult documentation in this order:

### 1️⃣ Domain Logic

Location:


docs/domains/


Defines:

- business rules
- workflows
- constraints
- marketplace policies

Examples:

- complaints.md
- chats-ai.md
- auto-sequences.md
- review-chat-links.md
- wb-work-policy.md
- ozon-work-policy.md

If domain logic changes → **update domain docs first**.

---

### 2️⃣ Database Schema


docs/database-schema.md


Source of truth for:

- tables
- constraints
- indexes

Database changes require:

- migration
- documentation update.

---

### 3️⃣ Technical Reference


docs/reference/


Includes:

- system architecture
- API specs
- statuses reference
- extension APIs.

---

### 4️⃣ Product Specifications


docs/product-specs/


Used when designing new features.

---

### 5️⃣ Operational Guides

Located in root `docs/`.

Examples:

- DEPLOYMENT.md
- CRON_JOBS.md
- DEVELOPMENT.md
- TROUBLESHOOTING.md
- QUICK_REFERENCE.md

---

# Marketplace Policy Rules

System behavior must follow marketplace policies.

Before implementing review/chat functionality Claude must check:

WB:


docs/domains/wb-work-policy.md


Ozon:


docs/domains/ozon-work-policy.md


These rules override implementation preferences.

---

# Development Workflow

Every significant change follows this workflow.

### Step 1 — Create Task

Create file:


docs/tasks/TASK-YYYYMMDD-feature-name.md


Required sections:

- Goal
- Current State
- Proposed Change
- Impact
- Required Docs Updates
- Rollout Plan
- Backout Plan

---

### Step 2 — Analysis

Before coding:

- read domain docs
- review database schema
- analyze architecture impact.

---

### Step 3 — Sprint Workspace

Large features must use a sprint folder:


docs/sprints/sprint-XXX/


Sprint folder may include:

- system audits
- architecture notes
- backlog
- experiment reports
- temporary analysis files

Temporary documents must stay inside the sprint folder.

---

### Step 4 — Implementation

Only after analysis and backlog.

Code must respect:

- domain rules
- DB schema
- automation safety.

---

### Step 5 — Documentation Update

After implementation update relevant docs:

DB change → database-schema.md  
API change → reference/api.md  
Cron change → CRON_JOBS.md  
Domain change → docs/domains/*

---

# Automation Safety

R5 relies on heavy automation.

Important systems:

- complaint generation
- chat sequences
- cron processors
- telegram notifications
- extension events

All automation must be:


idempotent
logged
bounded


Cron jobs must never produce duplicates.

---

# High Risk Operations

Claude must stop and ask before:

- destructive DB queries
- mass DELETE
- schema changes without migration
- automation changes
- cron modifications
- large refactors

---

# Deployment Rules

Claude must **never invent deployment steps**.

Deployment instructions are defined in:


docs/DEPLOYMENT.md


Deployment involves:

- git pull
- dependency install
- build
- PM2 reload
- service validation

Claude must always follow documented deployment procedure.

---

# Documentation Discipline

Documentation must remain consistent with production.

Mandatory updates when:

- DB schema changes
- API endpoints change
- cron jobs added or modified
- automation logic changes
- marketplace policy changes
- new feature introduced

A task without documentation update is incomplete.

---

# Goal of Claude in R5

Claude is responsible for maintaining:

- system clarity
- architecture integrity
- documentation accuracy
- development speed

The objective is to make R5 a **scalable and well-understood SaaS platform**.