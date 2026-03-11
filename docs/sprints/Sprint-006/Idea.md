# R5 SaaS — Product Vision Proposal  
## Client Cabinets Kanban Board

Status: **Proposal / Discussion Draft**  
Purpose: **Define the vision for a unified operational board for all client cabinets**

---

# 1. Context

Currently the system displays all cabinets in a **table format**.

Example data shown today:

- cabinet name
- number of products
- number of reviews
- number of dialogs
- status
- last update

While this is technically useful, it **does not reflect the operational workflow** of R5.

Managers cannot quickly understand:

- which cabinet is in which stage
- where work has not started
- where work is incomplete
- where active work is happening

The goal of this page is to transform the current table into an **operational Kanban board** representing the lifecycle of a cabinet inside the R5 system.

---

# 2. Core Concept

The page should function as a **CRM-like operational dashboard** where:

**Card = 1 marketplace cabinet**

Important:

A **client may have multiple cabinets**, therefore the system should **not operate on a client level**, but strictly on **cabinet level**.

Example:


Client A
├ WB Cabinet 1
├ WB Cabinet 2
└ Ozon Cabinet 1


Each of these cabinets is represented as an independent card in the board.

---

# 3. Main Interface

The page is proposed to be redesigned into a **Kanban-style board**.

Each column represents a **stage of the R5 operational pipeline**.

The agreed pipeline is:


Access received

Cabinet connected

Complaints submitted

Chats opened

Monitoring

Client lost


Cards move between stages as the system progresses through the operational workflow.

---

# 4. Purpose of the Board

The board must allow the team to instantly understand:

- which cabinets are ready to work
- where work has not yet started
- where complaints are not submitted
- where chats have not been opened
- where cabinets are in monitoring stage

The board should act as a **single operational control screen** for the team.

---

# 5. Design Philosophy

The design should follow these principles:

### Minimalism

Only show information that directly impacts operations.

Avoid displaying raw marketplace statistics such as:

- total reviews
- total dialogs
- total products

These numbers are not directly relevant to operational progress.

### Progress-oriented interface

Instead of raw data, the interface should display **execution progress**.

---

# 6. Card Structure

Each card represents a single cabinet.

The card should remain compact and readable.

Suggested layout:


Cabinet Name
Marketplace (WB / Ozon)

Complaints Progress
Chats Progress

Chat Status Indicator
Last Sync Time


Example visual layout:


HANIBANI & CHIP&GOOD
OZON

Complaints
████████░░ 80%
80 / 100

Chats
██████░░░░ 60%
54 / 90

Chats: Active
Updated: today


---

# 7. Complaints Progress

Complaints represent the **first stage of operational work**.

The system knows the number of **reviews approved for processing**.

Example:


Total reviews to process = 100


As complaints are submitted, progress increases.

Example:


Complaints
78 / 100
78%


Once complaints reach **100%**, the cabinet is considered ready for the next stage.

---

# 8. Chats Progress

Chats represent the **second stage of work**.

Chats should be opened only for reviews that were **not hidden through complaints**.

Example scenario:


Initial reviews = 100
Hidden via complaints = 10
Remaining = 90


Therefore:


Chats required = 90


Progress example:


Chats
72 / 90
80%


This allows managers to instantly see if chats are being opened correctly.

---

# 9. Chat Availability Indicator

Wildberries allows communication with buyers **only if chats are activated**.

Therefore each cabinet card must include a **chat availability indicator**.

Possible states:


Active
Expiring soon
Disabled
Not activated


If possible, the system may also display:


Chat activated date
Chat expiration date


This helps identify the **active working window for dialogs**.

---

# 10. Card Color Logic (Optional Proposal)

Cards may include subtle color indicators to improve readability.

Example concept:

### Green

Chats active and work progressing.

### Yellow

Work started but incomplete.

### Red

Chats unavailable or operational issue.

### Grey

Work not started.

This is optional and can be refined during UI design.

---

# 11. Card Actions (Optional)

Each card may include quick access actions such as:

- open reviews
- open dialogs
- open cabinet details
- refresh cabinet data

However these actions should remain secondary to the progress indicators.

---

# 12. Automation of Stage Movement

Cards should **move automatically between stages** based on system events.

Examples:

### Access received

Access credentials added.

### Cabinet connected

System successfully parsed cabinet data.

### Complaints submitted

At least one complaint created.

### Chats opened

At least one chat opened.

### Monitoring

Complaints and chats fully processed.

Automation logic will be implemented at backend level.

---

# 13. Data Model (Conceptual)

Each cabinet card may internally contain fields such as:


cabinet_id
cabinet_name
marketplace

stage

reviews_total
complaints_submitted

reviews_hidden

chats_required
chats_opened

chat_status
chat_activated_at
chat_expires_at

last_sync_at


The exact calculation logic will be implemented separately.

---

# 14. Expected Outcome

The board should allow a manager to understand in seconds:


Which cabinets require complaints
Which cabinets require chat opening
Which cabinets are already in monitoring


The interface should become the **central operational dashboard** for R5.

---

# 15. Next Steps

After validating this proposal:

1. Refine product specification
2. Design UI prototype
3. Define backend calculation logic
4. Implement the Kanban board