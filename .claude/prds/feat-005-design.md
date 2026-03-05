# feat-005 Design Spec: Campaign Creation (Draft & Submit)

> **Based on**: feat-005-spec.md, specs/standards/brand.md (L2-001)
> **Token tier**: Tier 2 semantic tokens only (never Tier 1 identity tokens directly)
> **Theme**: Dark-first UI — `--color-bg-page` (#060A14) as primary background

---

## 1. User Flow Overview

```
/dashboard or /campaigns/mine
    → [Create Campaign button]
    → /campaigns/new (multi-step form)
    → [Save Draft] → /campaigns/mine
    → [Continue Editing] → /campaigns/:id/edit
    → [Submit for Review] → confirmation → /campaigns/mine
```

### 1.1 Page Routes

| Route | Component | Purpose |
|---|---|---|
| `/campaigns/new` | `NewCampaignPage` | Create new draft campaign |
| `/campaigns/mine` | `MyCampaignsPage` | List creator's campaigns |
| `/campaigns/:id/edit` | `EditCampaignPage` | Edit existing draft campaign |

---

## 2. Component Architecture

### 2.1 Page Components (default exports)

- `NewCampaignPage` — `/campaigns/new`
- `MyCampaignsPage` — `/campaigns/mine`
- `EditCampaignPage` — `/campaigns/:id/edit`

### 2.2 Named Export Components

- `CampaignForm` — shared form used by New and Edit pages
- `CampaignStatusBadge` — displays draft/submitted status chip
- `MilestoneEditor` — add/remove/edit milestone rows
- `CampaignCard` — card for campaign list

---

## 3. CampaignForm Component

### 3.1 Layout
Single-page scrollable form (not tabbed multi-step) for MVP simplicity. Section headers divide the 5 logical groups.

### 3.2 Sections

**Section 1: Mission Objectives**
- Title (text input, required, 1-200 chars)
- Summary (textarea, ≤280 chars, with live char counter)
- Description (textarea, larger)
- Mars Alignment Statement (textarea — "How does this project help get humanity to Mars?")

**Section 2: Funding Details**
- Category (select, 10 options)
- Min Funding Target (number input in dollars → stored as cents)
- Max Funding Cap (number input in dollars → stored as cents)
- Deadline (date picker, ISO date)
- Budget Breakdown (textarea, free-form)

**Section 3: Milestone Plan**
- `MilestoneEditor` component
- Add milestone button
- Each milestone: Title, Target Date, Funding % (number), Verification Criteria
- Live percentage sum display (shows total, highlights red if not 100%)

**Section 4: Team & Risk**
- Team Info (textarea — "Describe your team members, roles, and experience")
- Risk Disclosures (textarea — "Describe key risks and mitigation strategies")

**Section 5: Media**
- Hero Image URL (text input, https:// URL)

### 3.3 Form Actions
- **Save Draft** (secondary CTA) — PATCH or POST depending on mode
- **Submit for Review** (primary CTA, one per page) — only shown when status is draft

---

## 4. MyCampaignsPage Design

### 4.1 Empty State
When creator has no campaigns:
- Heading: "NO MISSIONS YET"
- Body text: "Your path to Mars starts with a single proposal."
- Primary CTA: "START A CAMPAIGN"

### 4.2 Campaign List
Grid of `CampaignCard` components.

### 4.3 Page header
- Section label: "MY CAMPAIGNS"
- Heading: "MISSION CONTROL"
- Secondary action: "+ NEW CAMPAIGN" (top-right)

---

## 5. CampaignCard Component

### 5.1 Visual
- Background: `var(--gradient-surface-card)` or `var(--color-bg-card)`
- Border: `1px solid var(--color-border-subtle)`
- Border-radius: `var(--radius-card)`
- Padding: `24px`

### 5.2 Content
- `CampaignStatusBadge` (top-right)
- Title (Bebas Neue, large)
- Category (Space Mono, small, uppercase)
- Min Funding Target (formatted via `Intl.NumberFormat` as USD)
- Deadline if set
- "Edit Draft" button (for draft status)
- "View" button (for submitted status)

---

## 6. CampaignStatusBadge Component

### 6.1 States

| Status | Color Token | Label |
|---|---|---|
| `draft` | `--color-text-tertiary` (muted) | DRAFT |
| `submitted` | `--color-status-warning` (amber) | SUBMITTED |

### 6.2 Visual
- Font: `var(--font-data)`, 11px, letter-spacing 0.3em
- Padding: `4px 10px`
- Background: semi-transparent version of status color
- Border: `1px solid` status color
- Border-radius: `var(--radius-badge)` or `100px`

---

## 7. MilestoneEditor Component

### 7.1 Each milestone row
- Title (text input)
- Target Date (date input)
- Funding % (number input, 0-100)
- Verification Criteria (textarea, collapsible)
- Remove button (only if >1 milestone)

### 7.2 Sum indicator
- Shows "Total: XX% / 100%"
- Color: `--color-status-success` when = 100%, `--color-status-error` when ≠ 100%

### 7.3 Add milestone button
- Secondary button style: border only, no fill
- Label: "+ ADD MILESTONE"

---

## 8. Typography & Token Usage

| Element | Token |
|---|---|
| Page heading | `--font-display`, 40-56px, uppercase |
| Section labels | `--font-data`, 11px, 0.3em letter-spacing, `--color-text-accent` |
| Section headings | `--font-display`, 24px, uppercase |
| Form labels | `--font-data`, 12px, 0.05em, `--color-text-tertiary` |
| Body text | `--font-body`, 15-16px, `--color-text-secondary` |
| Monetary values | `--font-data`, `--color-text-primary` |
| Data labels | `--font-data`, 11-12px |

---

## 9. Form Input Design

All form inputs follow the established pattern from settings-verification.tsx:

```css
.form-input {
  width: 100%;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-input);
  padding: 14px 16px;
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--color-text-primary);
}

.form-input:focus {
  border-color: var(--color-border-emphasis);
  box-shadow: 0 0 0 3px rgba(255, 92, 26, 0.25);
}
```

---

## 10. Submit Flow UX

### 10.1 Submit button state
- Default: "SUBMIT FOR REVIEW"
- Pending: spinner + "SUBMITTING..."
- Gradient CTA (`--gradient-action-primary`)

### 10.2 KYC Gate handling
If submission returns 403 with KYC_REQUIRED:
- Show inline banner: amber/warning background
- Message: "Identity verification required before submitting. Complete verification in Settings → Verification."
- Link to `/settings/verification`

### 10.3 Success state
After successful submission:
- Toast or success banner: "Mission submitted for review! We'll notify you of the outcome."
- Redirect to `/campaigns/mine`

### 10.4 Validation errors
- Inline error below each invalid field
- Summary error banner at top of form if submit fails

---

## 11. Responsive Design

- Mobile (< 640px): single column, full-width inputs
- Tablet (640px–1024px): 2-column layout for some field groups
- Desktop (> 1024px): max-width 800px form, centered

---

## 12. Accessibility

- All form inputs have associated `<label>` elements
- Error messages have `role="alert"`
- Required fields marked with aria-required
- Loading states use aria-busy
- `prefers-reduced-motion`: disable animations
- Keyboard navigable milestone add/remove
