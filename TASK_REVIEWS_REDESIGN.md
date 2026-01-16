# TASK — Reviews Page UI/UX Redesign (Complaint-Focused)

You are working in an existing Next.js 14 + TypeScript + PostgreSQL project.
The Reviews page (V2) is functional but has visual and UX issues that need addressing.

## Context

Current state:
- **Page:** `src/app/stores/[storeId]/reviews/page.tsx` - Reviews list with filters
- **Components:**
  - `src/components/reviews-v2/ReviewRow.tsx` - Table row (expandable)
  - `src/components/reviews-v2/ReviewDetailsPanel.tsx` - Expanded details (2-column grid)
  - `src/components/reviews-v2/StatusBadge.tsx` - Status badges with emojis
  - `src/components/reviews-v2/ComplaintBox.tsx` - Complaint management (right column)
- **Types:** `src/types/reviews.ts` - Review statuses and labels

## Goal

Redesign the Reviews page UI to be **complaint-focused** and visually cleaner:
1. **Remove answer from seller** (not needed - we only care about complaints)
2. **Hide complaint info in collapsed row** → Show only when expanded
3. **Replace emoji status badges** with text-based format: `Category: Status`
4. **Create HTML prototype first** → Get approval → Implement in React
5. **Deploy:** Local dev → Git → Production (if approved)

## Scope (must implement)

### A) Research & Documentation
**Before starting implementation:**
1. Study all existing status types:
   - Review statuses: `visible`, `unpublished`, `excluded`, `unknown`
   - Product statuses: `purchased`, `refused`, `not_specified`, `unknown`
   - Complaint statuses: `not_sent`, `draft`, `sent`, `approved`, `rejected`, `pending`
2. Map all status combinations to new text format:
   - `👁️ Виден на WB` → `Отзыв: Виден`
   - `✅ Выкуп` → `Товар: Выкуп`
   - `⛔ Отказ` → `Товар: Отказ`
   - `📝 Черновик` → `Жалоба: Черновик`
   - `✅ Одобрена` → `Жалоба: Одобрена`
   - etc.
3. Document color scheme for new text badges (based on existing `REVIEW_STATUS_COLORS` etc.)
4. Create checklist of all UI changes required.

### B) HTML Prototype (Static)
Create **single standalone HTML file** with:
1. **Mock data:** 3-5 sample reviews with different status combinations
2. **Table structure:**
   - Collapsed row: Checkbox | Chevron | Product | Review Text | **Text Status Badges** | Date
   - NO complaint info visible in collapsed state
3. **Expanded row:**
   - Left column: Full review text (pros/cons), dates, metadata
   - Right column: Complaint details (category, text, draft)
   - **Remove:** "Ответ продавца" section entirely
4. **Status badges:**
   - Format: `Category: Status` (e.g., "Отзыв: Виден", "Жалоба: Черновик")
   - NO emojis
   - Clean typography with colored background/border (match existing color scheme)
5. **Styling:**
   - Use CSS variables compatible with existing design system
   - Match colors from `src/types/reviews.ts` (REVIEW_STATUS_COLORS, etc.)
   - Professional B2B SaaS aesthetic (clean, minimal, data-dense)

**Deliverable:**
- `prototypes/reviews-redesign.html` (standalone, can open in browser)

### C) Review & Approval
1. Open HTML prototype in browser
2. Present to stakeholder (or user in this case)
3. Collect feedback:
   - Is complaint info properly hidden in collapsed state?
   - Are text status badges clear and readable?
   - Is the expanded view easy to scan for complaint details?
4. Iterate on HTML prototype until approved
5. **ONLY proceed to implementation if approved**

### D) React Implementation (After Approval)
Once HTML prototype is approved:

**1. Update type definitions (`src/types/reviews.ts`):**
- Modify `REVIEW_STATUS_LABELS` to remove emojis:
  ```typescript
  export const REVIEW_STATUS_LABELS: Record<ReviewStatusWB, string> = {
    visible: 'Отзыв: Виден',
    unpublished: 'Отзыв: Снят с публикации',
    excluded: 'Отзыв: Исключён',
    unknown: 'Отзыв: Статус неизвестен',
  };
  ```
- Update `PRODUCT_STATUS_LABELS`:
  ```typescript
  export const PRODUCT_STATUS_LABELS: Record<ProductStatusByReview, string> = {
    purchased: 'Товар: Выкуп',
    refused: 'Товар: Отказ',
    not_specified: 'Товар: Не указан',
    unknown: 'Товар: Неизвестно',
  };
  ```
- Update `COMPLAINT_STATUS_LABELS`:
  ```typescript
  export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
    not_sent: 'Жалоба: Не отправлена',
    draft: 'Жалоба: Черновик',
    sent: 'Жалоба: Отправлена',
    approved: 'Жалоба: Одобрена',
    rejected: 'Жалоба: Отклонена',
    pending: 'Жалоба: На рассмотрении',
  };
  ```

**2. Update ReviewRow component (`src/components/reviews-v2/ReviewRow.tsx`):**
- Keep status badges in collapsed row (but with new text labels)
- Ensure NO complaint-specific info shows in collapsed state
- Status badges should use updated labels from types

**3. Update ReviewDetailsPanel (`src/components/reviews-v2/ReviewDetailsPanel.tsx`):**
- **Remove** entire "Ответ продавца" section (lines 85-97):
  ```typescript
  // DELETE THIS BLOCK:
  {review.answer && (
    <>
      <div className="detail-header">💬 Ответ продавца</div>
      <div className="answer-box">...</div>
    </>
  )}
  ```
- Keep complaint details in right column (already correct)
- Ensure review.answer is not displayed anywhere

**4. Update StatusBadge component (`src/components/reviews-v2/StatusBadge.tsx`):**
- No changes needed (labels come from types file)
- Verify styling matches HTML prototype

**5. Update CSS/Styling:**
- Match HTML prototype's visual design
- Ensure text badges are readable and professional
- Adjust padding/spacing if needed for complaint-focused layout

### E) Testing (Local Development)
1. Start dev server: `npm run dev`
2. Navigate to `/stores/{storeId}/reviews`
3. Test scenarios:
   - **Collapsed rows:** Verify NO complaint info visible, status badges show text format
   - **Expanded rows:** Verify complaint details visible, NO seller answer shown
   - **All status combinations:** Test with reviews having different statuses
   - **Responsiveness:** Test on different screen sizes
4. Compare with HTML prototype → Ensure visual match

### F) Deployment
If local testing is successful:
1. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat: Reviews page redesign - complaint-focused UI

   Changes:
   - Remove seller answer section (not needed)
   - Replace emoji status badges with text format (Category: Status)
   - Hide complaint info in collapsed rows
   - Match approved HTML prototype design

   Files modified:
   - src/types/reviews.ts (status labels)
   - src/components/reviews-v2/ReviewDetailsPanel.tsx (remove answer)
   - prototypes/reviews-redesign.html (design reference)
   "
   ```

2. **Push to GitHub:**
   ```bash
   git push origin main
   ```

3. **Deploy to production:**
   ```bash
   ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 \
     "cd /var/www/wb-reputation && bash deploy/update-app.sh"
   ```

4. **Verify production:**
   - Open http://158.160.217.236/stores/{storeId}/reviews
   - Smoke test: Check reviews load, statuses display correctly

## Non-goals (explicitly do NOT implement)
- ❌ Changing review sync logic or API endpoints
- ❌ Adding new filter options
- ❌ Modifying complaint generation logic
- ❌ Changing database schema or adding new fields
- ❌ Implementing complaint submission workflow (keep existing)
- ❌ Adding animations or complex interactions beyond expand/collapse
- ❌ Redesigning other pages (only Reviews page)

## Required tests
**Manual testing checklist:**
1. ✅ HTML prototype opens in browser and matches design intent
2. ✅ Collapsed rows show text status badges (no emojis)
3. ✅ Collapsed rows DO NOT show complaint info
4. ✅ Expanded rows show complaint details in right column
5. ✅ Expanded rows DO NOT show seller answer section
6. ✅ All 6 complaint statuses render correctly with new labels
7. ✅ All 4 review statuses render correctly
8. ✅ All 4 product statuses render correctly
9. ✅ Colors match existing design system
10. ✅ Responsive layout works (desktop + tablet)

## Docs
- Update `docs/DESIGN_DECISIONS.md` (create if doesn't exist) with:
  - Why emojis were removed (visual inconsistency, unprofessional for B2B)
  - Why seller answer was removed (not relevant to complaint workflow)
  - Screenshots: Before/After comparison

## Definition of Done
- ✅ HTML prototype created and approved by stakeholder
- ✅ Seller answer section removed from expanded view
- ✅ Complaint info hidden in collapsed rows
- ✅ Status badges use text format (Category: Status) with NO emojis
- ✅ All status labels updated in `src/types/reviews.ts`
- ✅ React components match approved HTML prototype
- ✅ Local testing passed (all 10 manual test cases)
- ✅ Changes committed to Git with descriptive message
- ✅ Deployed to production and smoke tested
- ✅ No regressions (filters, sync, pagination still work)
- ✅ Design documentation updated

## Output format for your response

### Phase 1: Research & HTML Prototype
1. **Status mapping table** (emoji → text format for all combinations)
2. **Color scheme** (based on existing COLORS constants)
3. **HTML prototype code** (`prototypes/reviews-redesign.html`)
4. **Screenshots or description** of prototype

### Phase 2: Implementation (After Approval)
1. **Plan** (which files to modify, in what order)
2. **Implementation notes** (key decisions + trade-offs)
3. **Files changed** (list with line numbers if possible)
4. **Commands to run** (dev server, testing, deployment)
5. **DoD checklist results** (mark each ✅ or ❌)

---

**Current Status:** Awaiting Phase 1 (HTML Prototype Creation)

**Important Notes:**
- Do NOT skip HTML prototype phase
- Do NOT implement in React until HTML is approved
- Keep existing complaint workflow intact (only UI changes)
- Maintain existing color scheme for visual consistency
