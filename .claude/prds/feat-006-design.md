# feat-006 Design Spec: Campaign Review Pipeline

**Spec ID**: feat-006-design
**Version**: 1.0
**Status**: Draft
**Depends On**: L2-001 (Brand Application Standard), feat-006-spec.md

---

## 1. Overview

This spec covers the design for the reviewer queue UI, campaign detail view during review, approve/reject action patterns, and status badge styling. All visual values reference Tier 2 semantic tokens only per L2-001.

---

## 2. Review Queue Page (`/admin/review-queue`)

### 2.1 Page Layout

```
[ REVIEW QUEUE label — --font-data, --color-text-accent ]
[ MISSION REVIEW BOARD heading — --font-display, --color-text-primary ]

[ Campaign cards in a single-column list, gap: 16px ]
  └── ReviewQueueCard (per campaign)

[ Empty state: "NO CAMPAIGNS IN QUEUE" ]
[ Loading state: skeleton cards ]
[ Error state: error message box ]
```

### 2.2 Page Header

- Section label: `"REVIEW QUEUE"` — `--font-data`, 11px, 0.3em letter-spacing, `--color-text-accent`
- Page heading: `"MISSION REVIEW BOARD"` — `--font-display`, 48px/64px responsive, `--color-text-primary`, uppercase
- No secondary CTA (no "New" action — this is a queue view)

### 2.3 Empty State

- Heading: `"QUEUE IS CLEAR"` — `--font-display`, 40px, `--color-text-primary`
- Body: `"All submitted campaigns have been reviewed."` — `--font-body`, 16px, `--color-text-secondary`

### 2.4 Error State

- Background: `rgba(193, 68, 14, 0.1)` (error tint, using identity token numerically allowed in inline style)
- Border: `1px solid var(--color-status-error)`
- Text: `--color-status-error`

---

## 3. ReviewQueueCard Component

### 3.1 Card Structure

```
[ Card: --gradient-surface-card background, border 1px solid var(--color-border-subtle) ]
[ border-radius: 12px, padding: 24px ]

  Row 1: [ Status badge ] [ Category chip ]
  Row 2: [ Campaign Title — --font-display, 24px, --color-text-primary ]
  Row 3: [ Creator ID label — --font-data, 11px, --color-text-tertiary ]
  Row 4: [ Submitted label + date — --font-body, 13px, --color-text-secondary ]
         [ Reviewer label (if under_review) — --font-body, 13px, --color-text-secondary ]
  Row 5: [ Action buttons — right-aligned ]
```

### 3.2 Action Button States

**Claim button** (shown when status === `submitted`):
- Background: `var(--gradient-action-primary)`
- Color: `var(--color-action-primary-text)`
- Border-radius: `var(--radius-button)`
- Box-shadow: `0 4px 16px var(--color-action-primary-shadow)`
- Text: `"CLAIM CAMPAIGN"` — `--font-data`, 12px, 0.1em letter-spacing
- Full-width on mobile, auto width on desktop

**Approve button** (shown when status === `under_review` and reviewer matches):
- Background: `rgba(0, 200, 80, 0.1)`
- Border: `1px solid var(--color-status-success)`
- Color: `var(--color-status-success)`
- Border-radius: `var(--radius-button)`
- Text: `"APPROVE"` — `--font-data`, 12px

**Reject button** (shown when status === `under_review` and reviewer matches):
- Background: transparent
- Border: `1px solid var(--color-status-error)`
- Color: `var(--color-status-error)`
- Border-radius: `var(--radius-button)`
- Text: `"REJECT"` — `--font-data`, 12px

**Recuse button** (shown when status === `under_review` and reviewer matches):
- Background: transparent
- Border: `1px solid var(--color-border-subtle)`
- Color: `var(--color-text-tertiary)`
- Text: `"RECUSE"` — `--font-data`, 11px
- Styled as a tertiary/ghost button

### 3.3 Category Chip

- Font: `--font-data`, 10px, 0.2em letter-spacing, uppercase
- Background: `rgba(255, 255, 255, 0.04)`
- Border: `1px solid var(--color-border-subtle)`
- Border-radius: 100px
- Color: `--color-text-secondary`
- Converts underscore-separated slug to readable text (e.g. `propulsion` → `PROPULSION`)

### 3.4 Hover and Focus States

- Card hover: subtle box-shadow increase, `border-color: var(--color-border-active)` transition 0.15s
- Button focus: `outline: 2px solid var(--color-text-accent); outline-offset: 2px`
- All animations via `transition` property, respecting `prefers-reduced-motion`

---

## 4. RejectionReasonModal Component

### 4.1 Modal Structure

```
[ Overlay: full-screen, rgba(6, 10, 20, 0.85) — using #060A14 alpha ]
[ Panel: --color-bg-card background, border 1px solid var(--color-border-subtle) ]
         [ border-radius: 16px, max-width: 540px, padding: 32px ]

  [ X close button — top right, --color-text-tertiary ]
  [ "REJECT CAMPAIGN" heading — --font-display, 28px, --color-text-primary ]
  [ Subtext — --font-body, 14px, --color-text-secondary ]
    "Provide written rationale and resubmission guidance for the creator."

  [ Textarea label: "REJECTION RATIONALE" — --font-data, 11px, --color-text-secondary ]
  [ Textarea: 6 rows min, --color-bg-input background, --color-border-subtle border ]
            [ focus: --color-border-active border + box-shadow ]
            [ placeholder: "Explain which curation criteria were not met and what the creator should address..." ]

  [ Character hint: e.g. "120 / 500 chars" — --font-data, 11px, --color-text-tertiary ]

  [ Cancel button ] [ Confirm Rejection button ]
    Cancel: ghost button, --color-text-secondary
    Confirm: background --gradient-action-primary (or --color-status-error if available)
             disabled when textarea is empty or isPending
```

### 4.2 Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to heading
- Focus trap within modal while open
- Escape key closes modal
- Textarea `aria-required="true"`, `aria-describedby` on character count

---

## 5. Status Badges for Review States

The existing `CampaignStatusBadge` component already handles all required statuses. No new variants needed.

Reference mappings from existing implementation:
- `under_review` → `--color-text-accent` (orange), orange tint background
- `approved` → `--color-status-success` (green), green tint background
- `rejected` → `--color-status-error` (red), red tint background
- `submitted` → `--color-status-warning` (amber), amber tint background

---

## 6. Loading and Skeleton States

Review Queue Page loading skeleton:
```
[ skeleton label: 80px wide, 14px tall ]
[ skeleton heading: 280px wide, 48px tall ]
[ skeleton card × 3: full width, 180px tall, border-radius 12px ]
  background: --color-bg-input
  animation: skel-pulse (opacity 0.5 ↔ 1.0, 1.5s, respects prefers-reduced-motion)
```

ReviewQueueCard loading (when claim/approve/reject mutation is pending):
- Action button shows spinner or reduced opacity (0.6)
- Button `disabled` attribute set

---

## 7. Motion Tokens

All transitions use semantic motion tokens:
- Button state transitions: `transition: opacity 0.15s ease`, `transition: border-color 0.15s ease`
- Modal open/close: `transition: opacity 0.2s ease`
- Skeleton: `animation: skel-pulse 1.5s ease-in-out infinite alternate`
- `@media (prefers-reduced-motion: reduce)`: all animations disabled, skeletons use `opacity: 0.7`

---

## 8. Responsive Breakpoints

- Mobile (< 640px): single column, full-width action buttons stacked
- Tablet (640px+): action buttons side-by-side, card padding 24px
- Desktop (1024px+): page max-width 900px centred, page padding 48px 32px

---

## 9. Typography Reference (L2-001 compliance)

| Use | Token | Size |
|-----|-------|------|
| Page heading | `--font-display` | 48px (mobile), 64px (desktop) |
| Section labels | `--font-data` | 11px |
| Campaign title in card | `--font-display` | 24px |
| Body text | `--font-body` | 14–16px |
| Metadata/chips | `--font-data` | 10–13px |
| Button labels | `--font-data` | 12–13px |
| Textarea content | `--font-body` | 14px |

---

## 10. Token Usage Summary

All values from Tier 2 semantic tokens. No Tier 1 (`--launchfire`, `--void`, etc.) direct references in component code.

Key tokens used:
- Backgrounds: `--color-bg-page`, `--color-bg-card`, `--color-bg-input`
- Borders: `--color-border-subtle`, `--color-border-active`
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-text-accent`
- Actions: `--gradient-action-primary`, `--color-action-primary-text`, `--color-action-primary-shadow`
- Status: `--color-status-success`, `--color-status-error`, `--color-status-warning`
- Gradients: `--gradient-surface-card`
- Radius: `--radius-button`, `--radius-input`
- Font stacks: `--font-display`, `--font-body`, `--font-data`
