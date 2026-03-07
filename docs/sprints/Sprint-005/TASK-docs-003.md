ROLE

You are a Principal Software Architect and Database Systems Auditor.

Your task is to perform a deep **Database vs Business Logic Audit** for the R5 SaaS system.

The documentation system has already been reorganized and canonical domain documents now describe the core business logic of the system.

Your mission is to verify that the **database schema correctly implements the business logic and domain model described in the documentation**.

You must detect structural mismatches, architectural risks, and technical debt in the database design.

IMPORTANT:

Do NOT modify code or database migrations.

Your task is strictly **analysis and architectural assessment**.

---

CONTEXT

The system documentation has been reorganized into canonical domain documents.

These documents now represent the **Source of Truth for system behavior and business rules**.

The database schema is described in:

docs/database-schema.md

The business logic is described primarily in:

docs/domains/

Relevant domain documents include (but are not limited to):

complaints.md  
auto-complaints.md  
chats-ai.md  
auto-sequences.md  
review-chat-links.md  
communication-policy.md  
telegram-mini-app.md  
auth-and-roles.md  
google-sheets-sync.md  
audit-trail.md  
wb-work-policy.md  
ozon-work-policy.md  

Reference documents:

docs/reference/statuses-reference.md  
docs/reference/api.md  

---

GOAL

Determine whether the **database structure properly supports the business logic of the system**.

Your audit must identify:

• schema inconsistencies  
• domain model mismatches  
• redundant tables  
• missing constraints  
• incorrect relationships  
• potential data integrity risks  
• normalization issues  
• indexing problems  

---

PHASE 1 — DOMAIN MODEL RECONSTRUCTION

Based on the canonical documentation, reconstruct the **true domain model** of the system.

Identify:

• core entities  
• relationships between entities  
• system invariants  
• lifecycle states  
• ownership boundaries  

Examples of invariants to detect:

• 1 review = 1 chat  
• chat has many messages  
• complaint belongs to review  
• sequence belongs to chat  
• organization owns stores  

Output:

Domain Model Table:

entity  
description  
relationships  
key invariants  

---

PHASE 2 — DATABASE STRUCTURE MAP

Analyze `docs/database-schema.md`.

Extract the full database structure:

• tables  
• columns  
• indexes  
• ENUMs  
• triggers  
• constraints  

Group tables by domain entity.

Output:

Database Map:

table  
entity  
purpose  
relationships  
indexes  
constraints  

---

PHASE 3 — DOMAIN vs DATABASE ALIGNMENT

Compare the domain model to the database schema.

For each domain entity determine:

• whether a corresponding table exists  
• whether relationships are properly implemented  
• whether invariants are enforced  

Identify:

Missing tables  
Redundant tables  
Overloaded tables  
Incorrect foreign keys  
Missing foreign keys  

Output:

Alignment Table:

entity  
expected_structure  
actual_structure  
status (OK / mismatch / risk)

---

PHASE 4 — DATA INTEGRITY CHECK

Identify potential integrity risks:

• orphan records  
• missing foreign keys  
• missing unique constraints  
• weak relational guarantees  

Example:

If documentation states:

"1 review = 1 chat"

Check if database enforces this constraint.

---

PHASE 5 — NORMALIZATION ANALYSIS

Evaluate database normalization.

Detect:

• duplicated fields across tables  
• denormalized structures  
• improper many-to-many modeling  
• embedded logic in JSON fields  

Classify issues by severity:

LOW  
MEDIUM  
HIGH  

---

PHASE 6 — INDEX AND PERFORMANCE ANALYSIS

Analyze indexing strategy.

Detect:

• missing indexes on frequent queries  
• unused indexes  
• redundant indexes  
• inefficient composite indexes  

---

PHASE 7 — ARCHITECTURAL TECHNICAL DEBT

Identify structural technical debt:

• legacy tables no longer aligned with business logic  
• tables used as temporary workarounds  
• mixed responsibilities in single tables  
• missing audit structures  
• schema evolution risks  

---

PHASE 8 — REFACTORING OPPORTUNITIES

Propose architectural improvements.

Examples:

• table merges  
• table splits  
• new constraints  
• improved indexing  
• domain-driven schema alignment  

Important:

Do NOT propose destructive changes without migration strategies.

---

OUTPUT FORMAT

Produce a structured report:

1. Domain Model Reconstruction  
2. Database Structure Map  
3. Domain vs Database Alignment  
4. Data Integrity Risks  
5. Normalization Issues  
6. Indexing Analysis  
7. Architectural Technical Debt  
8. Refactoring Opportunities  

Your goal is to provide a **complete architectural assessment of how well the database supports the system’s business logic**.