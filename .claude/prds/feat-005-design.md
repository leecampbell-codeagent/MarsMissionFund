# Design Specification: feat-005 — Contribution Flow and Payment Processing

> **Spec ID**: L4-005-design
> **Version**: 1.0
> **Status**: Approved
> **Feature**: feat-005 (Contribution Flow and Payment Processing with Stubbed Gateway)
> **Depends On**: L2-001 (Brand Application Standard), feat-005-contribution-flow.md, feat-005-research.md
> **Route**: `/campaigns/:id/contribute`
> **Access**: Protected (Clerk JWT auth required — handled by ProtectedRoute wrapper)

---

## Contents

1. [Page Layout Specification](#1-page-layout-specification)
2. [Component Specifications](#2-component-specifications)
3. [Design Token Mapping](#3-design-token-mapping)
4. [State Specifications](#4-state-specifications)
5. [Responsive Behaviour](#5-responsive-behaviour)
6. [Animation and Transitions](#6-animation-and-transitions)
7. [Accessibility Checklist](#7-accessibility-checklist)
8. [Copy Patterns](#8-copy-patterns)

---

## 1. Page Layout Specification

### 1.1 Overall Structure

ContributeToMissionPage uses a **single-column, form-focused layout** centred at max-width 640px. This is intentionally narrow — no sidebar, no distraction. The donor's only job on this page is to enter an amount and submit.

The page sits on the standard `--color-bg-page` background with the nav bar persisting at top (existing shell). No hero image — the campaign thumbnail in the summary header provides contextual identity without competing with the form.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [NAV BAR — existing shell, full width]                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                   page background: --color-bg-page                      │
│                                                                         │
│          ┌───────────────────────────────────────────┐                  │
│          │  ← Back to mission          max-w: 640px  │                  │
│          │                                           │                  │
│          │  ┌─────────────────────────────────────┐  │                  │
│          │  │  CAMPAIGN SUMMARY HEADER             │  │                  │
│          │  │  [thumbnail 64px] Campaign Title    │  │                  │
│          │  │                  by Creator         │  │                  │
│          │  │  [mini FundingProgressBar]           │  │                  │
│          │  └─────────────────────────────────────┘  │                  │
│          │                                           │                  │
│          │  ┌─────────────────────────────────────┐  │                  │
│          │  │  CONTRIBUTION FORM                   │  │                  │
│          │  │                                     │  │                  │
│          │  │  01 — AMOUNT                        │  │                  │
│          │  │  ┌─────────────────────────────┐    │  │                  │
│          │  │  │  $  [          0.00        ] │    │  │                  │
│          │  │  └─────────────────────────────┘    │  │                  │
│          │  │  $5.00 minimum                      │  │                  │
│          │  │  You are contributing $0.00          │  │                  │
│          │  │                                     │  │                  │
│          │  │  02 — PAYMENT TOKEN                 │  │                  │
│          │  │  ┌─────────────────────────────┐    │  │                  │
│          │  │  │  [payment token text field] │    │  │                  │
│          │  │  └─────────────────────────────┘    │  │                  │
│          │  │  Use 'tok_fail' to simulate failure  │  │                  │
│          │  │                                     │  │                  │
│          │  │  [ Back This Mission →           ]  │  │                  │
│          │  │                                     │  │                  │
│          │  └─────────────────────────────────────┘  │                  │
│          │                                           │                  │
│          │  ┌─────────────────────────────────────┐  │                  │
│          │  │  TRUST SIGNALS                       │  │                  │
│          │  │  🔒 Escrow explanation               │  │                  │
│          │  │  ✓ Encrypted  ✓ No stored cards      │  │                  │
│          │  └─────────────────────────────────────┘  │                  │
│          │                                           │                  │
│          └───────────────────────────────────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Spacing System

| Region | Value |
|--------|-------|
| Page top padding | 48px |
| Page bottom padding | 80px |
| Page horizontal padding | 24px (collapses on mobile) |
| Gap between major sections | 24px |
| Card internal padding | 32px (24px on mobile) |
| Back link to summary header gap | 24px |

### 1.3 Back Navigation

A ghost-style back link sits above the campaign summary header:

```
← Back to mission
```

- Font: `--type-button` (DM Sans 14px weight 600)
- Colour: `--color-action-ghost-text`
- No border (text-only ghost link, not a full ghost button)
- Routes back to `/campaigns/:id`
- Left-aligned, not centred

---

## 2. Component Specifications

### 2.1 ContributeToMissionPage (Page Component)

**File**: `packages/frontend/src/pages/campaign/contribute/contribute-to-mission-page.tsx`

**Props**: None (reads `:id` from `useParams`)

**Data dependencies**:
- `usePublicCampaign(id)` — fetches campaign title, hero image URL, funding progress, status
- `useContribute()` — mutation hook wrapping `POST /contributions`

**Responsibilities**:
- Guards campaign status: if campaign is not `Live`, render `ContributionNotAvailable` inline error (do not redirect)
- Manages form state: amount (string, raw user input), paymentToken (string)
- Derives `amountCents` from input for preview display and API payload
- Delegates render to child components; contains no visual markup of its own beyond the page shell

**Structure outline**:
```
ContributeToMissionPage
  └── page shell div (bg, min-height, padding)
      ├── inner container (max-width: 640px, centred)
      │   ├── BackLink
      │   ├── CampaignSummaryHeader (campaign data)
      │   ├── ContributionForm (form state + handlers)
      │   │   ├── AmountInput
      │   │   └── PaymentTokenInput
      │   └── TrustSignals
      └── [conditional overlays: ContributionSuccess | ContributionError | ContributionNotAvailable]
```

---

### 2.2 CampaignSummaryHeader

**Purpose**: Contextual anchor. Reassures the donor they are backing the right campaign before they enter payment details.

**Visual spec**:

```
┌─────────────────────────────────────────────────────────┐  ← card border
│  ┌──────────┐  CAMPAIGN TITLE (Bebas Neue uppercase)    │
│  │  64×64   │  by Creator Name                          │
│  │ thumbnail│                                           │
│  │ (rounded)│  ████████████░░░░░░  73% · 312 backers   │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

**Token mapping**:

| Element | Token |
|---------|-------|
| Card background | `--color-bg-surface` |
| Card border | `1px solid --color-border-subtle` |
| Card radius | `--radius-card` |
| Card padding | 20px |
| Thumbnail size | 64 × 64px |
| Thumbnail radius | `--radius-stat` (16px) |
| Thumbnail fallback | `--gradient-campaign-hero` as background, no img element |
| Campaign title | `--font-display`, 24px, uppercase, `--color-text-primary` |
| Creator line | `--font-body`, 13px, `--color-text-tertiary` |
| Progress bar | `FundingProgressBar` component (existing) |

**Props**:
```typescript
interface CampaignSummaryHeaderProps {
  readonly title: string;
  readonly creatorName: string | null;
  readonly heroImageUrl: string | null;
  readonly fundingPercentage: number | null;
  readonly totalRaisedCents: string;
  readonly fundingGoalCents: string | null;
  readonly contributorCount: number;
}
```

**Notes**:
- The `FundingProgressBar` here is the existing component with no modifications. It already handles aria attributes correctly.
- Thumbnail `img` must include `alt=""` if decorative, or `alt={title}` if the campaign has no other title visible — here the title is visible so thumbnail alt is `alt=""` (decorative).
- If `heroImageUrl` is null, render a 64×64 div with `--gradient-campaign-hero` background and `aria-hidden="true"`.

---

### 2.3 AmountInput

**Purpose**: The primary financial data entry point. Must feel precise, confident, and unambiguous.

**Visual spec**:

```
AMOUNT                          ← section label (--type-section-label)

┌─────────────────────────────────────────────────────┐
│  $   │  0.00                                        │
│      │                           (Space Mono 32px)  │
└─────────────────────────────────────────────────────┘
$5.00 minimum                   ← helper (--type-body-small, --color-text-tertiary)

You are contributing $127.50    ← live preview (--type-body, --color-text-secondary)
                                   amount in --font-data --color-text-primary
```

**Layout detail**:
- The `$` prefix is a visual divider within the input row, not a separate input. Implemented as a `position: relative` wrapper with the `$` symbol absolutely positioned left, and `padding-left: 48px` on the `<input>`.
- The `<input type="number">` occupies the full card width minus the prefix column.
- The input itself is large format: `font-family: var(--font-data)`, `font-size: 32px`. This is outside the closed type scale for the input *value text only* — implementor note: this is an approved exception for financial data entry (the input label uses `--type-input-label` per spec).
- `min="0.01"`, `step="0.01"`, `placeholder="0.00"`.
- Input `id="amount"` paired with `<label htmlFor="amount">`.

**Token mapping**:

| Element | Token |
|---------|-------|
| Section label | `--type-section-label`, `--color-text-accent` |
| Input background | `--color-bg-input` |
| Input border (default) | `1px solid --color-border-input` |
| Input border (focus) | `1px solid --color-border-emphasis` + `box-shadow: 0 0 0 3px rgba(255,92,26,0.25)` |
| Input border (error) | `1px solid --color-status-error` + `box-shadow: 0 0 0 3px rgba(193,68,14,0.20)` |
| Input radius | `--radius-input` |
| Input padding | 14px 20px 14px 48px (room for $ prefix) |
| $ prefix colour | `--color-text-tertiary` |
| $ prefix font | `--font-data`, 20px |
| Input value font | `--font-data`, 32px |
| Input value colour | `--color-text-primary` |
| Input placeholder colour | `--color-text-tertiary` |
| Helper text | `--type-body-small`, `--color-text-tertiary` |
| Helper text (error) | `--type-body-small`, `--color-text-error` |
| Preview label ("You are contributing") | `--type-body`, `--color-text-secondary` |
| Preview amount | `--font-data`, 16px, `--color-text-primary` |

**Validation**:
- Below minimum ($5.00 / 500 cents): show inline error "Minimum contribution is $5.00" in `--color-text-error` below helper text. Replace helper text — do not stack.
- Zero / empty: show "Enter an amount to continue" only on blur or submit attempt. Silent while user is still typing.
- Validation error triggers `aria-describedby` pointing to the error message element and `aria-invalid="true"` on the input.

**Props**:
```typescript
interface AmountInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: string | null;
  readonly disabled: boolean;
}
```

---

### 2.4 PaymentTokenInput

**Purpose**: Stub-only field. Accepts a string token that the backend forwards to the stub payment adapter. In a real integration this would be replaced by Stripe Elements — the component architecture isolates this so the swap is a single component replacement.

**Visual spec**:

```
PAYMENT TOKEN                   ← section label (--type-section-label)

┌─────────────────────────────────────────────────────┐
│  tok_success                                        │
└─────────────────────────────────────────────────────┘
Use 'tok_fail' to simulate a payment failure   ← helper
```

**Token mapping**:

| Element | Token |
|---------|-------|
| Section label | `--type-section-label`, `--color-text-accent` |
| Input | Same as AmountInput (bg, border, radius, padding) |
| Input font | `--font-data`, 14px (`--type-data`) |
| Input colour | `--color-text-primary` |
| Helper text | `--type-body-small`, `--color-text-tertiary` |
| `tok_fail` inline code | `--font-data`, same size, `--color-status-warning` (amber) |

**Notes**:
- `type="text"`, `autocomplete="off"`, `spellCheck={false}`.
- `placeholder="tok_success"` — shows the default success token as a hint.
- No validation on this field beyond required (non-empty) on submit.
- The helper text renders `tok_fail` in `--color-status-warning` to visually signal it as special. Wrap in `<code>` with inline style, not a separate component.

**Props**:
```typescript
interface PaymentTokenInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
}
```

---

### 2.5 ContributionForm (Form Shell)

**Purpose**: Wraps AmountInput and PaymentTokenInput in a single card with the submit CTA. Owns the submit handler, validates inputs before submission, and communicates loading/error state to children.

**Visual spec**:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [AmountInput]                                          │
│                                                         │
│  ─────────────────────────────────────────── divider   │
│                                                         │
│  [PaymentTokenInput]                                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │   ◌  Back This Mission →                       │    │  ← Button Primary lg
│  └─────────────────────────────────────────────────┘    │    (spinner when submitting)
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Token mapping**:

| Element | Token |
|---------|-------|
| Card background | `--color-bg-surface` |
| Card border | `1px solid --color-border-subtle` |
| Card radius | `--radius-card` |
| Card padding | 32px |
| Section divider | `1px solid --color-border-subtle`, margin: 24px 0 |
| Submit button | `Button` component, `variant="primary"`, `size="lg"`, full width |
| Submit button (submitting) | `isLoading={true}` prop → spinner inside button, text changes to "Processing..." |

**Submit button copy**:
- Default: "Back This Mission →"
- Submitting: "Processing..." (spinner visible via `isLoading` prop)
- The arrow `→` is a unicode character, not an icon, so no additional aria-label needed.

**Full-width button**: Apply `style={{ width: '100%' }}` inline on the Button component. The Button's existing `display: inline-flex` expands correctly when given `width: 100%`.

---

### 2.6 TrustSignals

**Purpose**: Reduces hesitation. Three micro-badges below the form card provide reassurance about escrow security, data handling, and the stub context.

**Visual spec**:

```
  🔒  Your contribution is held in secure escrow
      Funds are only released when milestones are verified.

  ─────────────────────────────────────────────────────

  ✓ Encrypted   ✓ No stored card details   ✓ Sandbox demo
```

**Token mapping**:

| Element | Token |
|---------|-------|
| Section padding | 24px (no card border — intentionally lighter) |
| Lock icon | SVG, `--color-text-tertiary`, 16px |
| Escrow headline | `--font-body`, 13px, weight 600, `--color-text-secondary` |
| Escrow detail | `--font-body`, 12px, `--color-text-tertiary` |
| Divider | `1px solid --color-border-subtle` |
| Badge row gap | 20px |
| Badge check | `--color-status-success`, 12px (unicode checkmark `✓`, `aria-hidden="true"`) |
| Badge text | `--font-body`, 12px, `--color-text-tertiary` |

**Trust badge items** (fixed set, not data-driven):
1. "Encrypted" — data in transit secured
2. "No stored card details" — stub note; real integrations use Stripe tokenisation
3. "Sandbox demo" — honest signal that this is a demo environment with stubbed payments

**Note**: The lock icon and check marks are decorative (`aria-hidden="true"`). The text itself carries all meaning for screen readers.

---

### 2.7 ContributionSuccess (Success State)

**Purpose**: Replaces the form entirely after a successful contribution. Confirms the transaction reference and provides a clear path back to the campaign.

**Visual spec**:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              ✓                                          │
│         (40px animated checkmark in --color-status-success)
│                                                         │
│    MISSION BACKED                                       │  ← --font-display 40px
│                                                         │
│    Your $127.50 is locked in.                           │  ← --type-body --color-text-secondary
│    You're backing [Campaign Title].                     │
│                                                         │
│    ─────────────────────────────────────────────────   │
│                                                         │
│    TRANSACTION REFERENCE                                │  ← --type-section-label
│    MMF-TXN-20260305-A3F9                                │  ← --type-data --color-text-primary
│                                                         │
│    Funds secured in escrow.                             │  ← --type-body-small
│    Release on milestone verification.                   │    --color-text-tertiary
│                                                         │
│    ┌─────────────────────────────────────────────┐      │
│    │   Return to Mission                         │      │  ← Button Ghost
│    └─────────────────────────────────────────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Token mapping**:

| Element | Token |
|---------|-------|
| Card background | `--gradient-celebration` |
| Card border | `1px solid --color-status-success-border` |
| Card radius | `--radius-card` |
| Card padding | 40px |
| Check icon | SVG circle with tick, 40px, `--color-status-success`, animated entrance |
| "MISSION BACKED" | `--font-display`, 40px, uppercase, `--color-text-primary` |
| Confirmation copy | `--type-body`, `--color-text-secondary` |
| Divider | `1px solid --color-status-success-border` |
| "TRANSACTION REFERENCE" label | `--type-section-label`, `--color-text-accent` |
| Transaction ref value | `--font-data`, 16px, `--color-text-primary` |
| Escrow note | `--type-body-small`, `--color-text-tertiary` |
| "Return to Mission" button | `Button`, `variant="ghost"`, routes to `/campaigns/:id` |

**Amount display**: Uses `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` with the API-returned cents value divided by 100 as a Number. The formatted string is display-only — the raw cents string from the API is never shown directly.

**Props**:
```typescript
interface ContributionSuccessProps {
  readonly campaignId: string;
  readonly campaignTitle: string;
  readonly amountCents: string;       // from API response, integer cents as string
  readonly transactionRef: string;    // from API response
}
```

---

### 2.8 ContributionError (Payment Failure State)

**Purpose**: Shown when the API returns a payment failure (stub `tok_fail` path) or a non-409/422 API error. Friendly, not alarming. Offers clear retry.

**Visual spec**:

```
┌─────────────────────────────────────────────────────────┐  ← --color-status-error border
│                                                         │
│  ⚠  Payment not processed                              │  ← --color-status-error 20px icon
│                                                         │
│  We couldn't process this right now.                    │  ← --type-body --color-text-secondary
│  Your data is safe — let's try again.                   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Try Again                                      │   │  ← Button Secondary
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Token mapping**:

| Element | Token |
|---------|-------|
| Alert role | `role="alert"` on the container (announces to screen readers) |
| Card background | `--color-bg-surface` |
| Card border | `1px solid --color-status-error` |
| Card radius | `--radius-card` |
| Card padding | 32px |
| Warning icon | SVG triangle-exclamation, 20px, `--color-status-error` |
| Headline | `--font-body`, 16px, weight 600, `--color-text-error` |
| Body copy | `--type-body`, `--color-text-secondary` |
| "Try Again" button | `Button`, `variant="secondary"` — resets form state, re-enables inputs |

**Inline form error (validation / 409 / 422)**:
- `DUPLICATE_CONTRIBUTION` (409): show inline message above submit button: "You've already backed this mission in the last 60 seconds. Please wait before trying again." Colour: `--color-text-error`.
- `CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` (422): show `ContributionNotAvailable` state (see below).
- Amount below minimum: handled by `AmountInput` inline error before submission.

**Props**:
```typescript
interface ContributionErrorProps {
  readonly message: string;
  readonly onRetry: () => void;
}
```

---

### 2.9 ContributionNotAvailable (Campaign Not Live)

**Purpose**: Shown when campaign data loads successfully but the campaign is not in `Live` status. Not a full error page — renders within the centred column with guidance to return.

**Visual spec**:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  This mission isn't accepting contributions right now.  │
│                                                         │
│  The campaign may have closed, fully funded, or be      │
│  under review. Check the campaign page for details.     │
│                                                         │
│  [ View Campaign ]                                      │  ← Button Ghost
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Token mapping**:

| Element | Token |
|---------|-------|
| Card background | `--color-bg-surface` |
| Card border | `1px solid --color-border-subtle` |
| Card radius | `--radius-card` |
| Headline | `--type-card-title`, `--color-text-primary` |
| Body | `--type-body`, `--color-text-secondary` |
| Button | `Button`, `variant="ghost"`, routes to `/campaigns/:id` |

---

## 3. Design Token Mapping

Complete reference table for all tokens used in feat-005 components.

### 3.1 Colour Tokens

| Token | Usage in feat-005 |
|-------|-------------------|
| `--color-bg-page` | Page background |
| `--color-bg-surface` | All card backgrounds (summary header, form, trust signals, error, not-available) |
| `--color-bg-elevated` | Thumbnail fallback background (no hero image) |
| `--color-bg-input` | AmountInput and PaymentTokenInput background |
| `--color-border-subtle` | Card borders, section dividers |
| `--color-border-input` | Input border (default state) |
| `--color-border-emphasis` | Input border (focus state) |
| `--color-text-primary` | Campaign title, input value text, transaction ref |
| `--color-text-secondary` | Creator name, body copy, confirmation message |
| `--color-text-tertiary` | Helper text, trust badge text, placeholder, creator byline |
| `--color-text-accent` | Section labels (AMOUNT, PAYMENT TOKEN, TRANSACTION REFERENCE) |
| `--color-text-error` | Inline validation errors, ContributionError headline |
| `--color-text-success` | Not used directly — success border derives from `--color-status-success-border` |
| `--color-action-primary` | Input focus box-shadow tint (rgba reference only, not direct) |
| `--color-action-primary-text` | Submit button text colour (via Button component) |
| `--color-action-primary-shadow` | Submit button shadow (via Button component) |
| `--color-action-ghost-text` | Back link colour, "Return to Mission" button |
| `--color-action-ghost-border` | "Return to Mission" button border |
| `--color-action-secondary-bg` | "Try Again" button background |
| `--color-action-secondary-text` | "Try Again" button text |
| `--color-action-secondary-border` | "Try Again" button border |
| `--color-action-disabled` | Submit button when disabled/loading (via Button component) |
| `--color-status-success` | Success check icon |
| `--color-status-success-bg` | Not used directly (celebration gradient covers card) |
| `--color-status-success-border` | ContributionSuccess card border and divider |
| `--color-status-error` | ContributionError card border, warning icon |
| `--color-status-warning` | `tok_fail` inline code highlight in PaymentTokenInput helper |
| `--color-progress-fill` | FundingProgressBar fill (via existing component) |
| `--color-progress-complete` | FundingProgressBar fill when funded (via existing component) |
| `--color-progress-track` | FundingProgressBar track (via existing component) |

### 3.2 Gradient Tokens

| Token | Usage in feat-005 |
|-------|-------------------|
| `--gradient-action-primary` | Submit button background (via Button component) |
| `--gradient-surface-card` | Thumbnail fallback background when no hero image |
| `--gradient-campaign-hero` | Thumbnail fallback — 64×64 placeholder |
| `--gradient-celebration` | ContributionSuccess card background |

### 3.3 Typography Tokens

| Token | Usage in feat-005 |
|---------|-------------------|
| `--font-display` (Bebas Neue) | "MISSION BACKED" success heading, campaign title in summary header |
| `--font-body` (DM Sans) | All body copy, button text, helper text, error messages |
| `--font-data` (Space Mono) | Amount input value (32px), $ prefix, PaymentTokenInput value, transaction ref |
| `--type-section-label` | "AMOUNT", "PAYMENT TOKEN", "TRANSACTION REFERENCE" section labels |
| `--type-input-label` | Labels for AmountInput and PaymentTokenInput (the `<label>` element) |
| `--type-body` | Body copy throughout |
| `--type-body-small` | Helper text, trust badge text, escrow note |
| `--type-button` | Submit button, ghost buttons (via Button component) |
| `--type-data` | Transaction ref value, PaymentTokenInput value, amount preview |
| `--type-card-title` | ContributionNotAvailable headline |

**Exception note**: The `<input type="number">` value text in AmountInput uses `--font-data` at 32px. This 32px size is not in the closed type scale. It is approved for this component only, scoped to the input element's `font-size` property. The section label, the input `<label>`, and all surrounding copy use only closed-scale tokens.

### 3.4 Layout Tokens

| Token | Usage in feat-005 |
|-------|-------------------|
| `--radius-card` | All card borders (summary header, form, error states) |
| `--radius-card-large` | Not used (reserved for feature cards — this page uses standard cards) |
| `--radius-input` | AmountInput, PaymentTokenInput |
| `--radius-button` | All buttons (via Button component) |
| `--radius-stat` | Campaign thumbnail in summary header |
| `--radius-badge` | Not used (no status badges on this page) |
| `--radius-progress` | FundingProgressBar track (via existing component) |

### 3.5 Motion Tokens

| Token | Usage in feat-005 |
|-------|-------------------|
| `--motion-enter` | Form card entrance on page load |
| `--motion-enter-emphasis` | ContributionSuccess card entrance; success checkmark scale animation |
| `--motion-hover` | Button hover transition (via Button component) |
| `--motion-panel` | ContributionError / ContributionSuccess replacing form (fade + slide) |

---

## 4. State Specifications

### 4.1 Loading — Fetching Campaign Data

**Trigger**: `isLoading === true` from `usePublicCampaign`

**Visual**:
```
page background (--color-bg-page), full viewport height, vertically centred

    [LoadingSpinner size="lg" label="Loading mission details"]
```

- Uses existing `LoadingSpinner` component with `size="lg"`, `color="primary"`.
- No skeleton UI — the campaign summary header is small enough that a single centred spinner is appropriate.
- `label="Loading mission details"` surfaces in screen reader announcements.

---

### 4.2 Form Ready (Default)

**Trigger**: Campaign data loaded, status is `Live`, no submission in progress.

All sections visible:
- Back link
- CampaignSummaryHeader (populated)
- ContributionForm (AmountInput empty, PaymentTokenInput empty)
- TrustSignals

AmountInput shows placeholder "0.00". Live preview reads: "Enter an amount above to continue." (tertiary colour) — switches to "You are contributing $X.XX" once the user has typed a valid number.

---

### 4.3 Submitting

**Trigger**: User clicks "Back This Mission →", form is valid, mutation is `isPending`.

- `Button` receives `isLoading={true}` → renders inline `LoadingSpinner` (sm, decorative) + text changes to "Processing..."
- `Button` is `disabled` — prevents double submission.
- Both `AmountInput` and `PaymentTokenInput` receive `disabled={true}` — inputs become uneditable with `--color-action-disabled` border tint.
- All other UI (summary header, trust signals, back link) remains visible and unchanged.
- No overlay or modal — the form card is the only element that indicates loading.

---

### 4.4 Success Confirmation

**Trigger**: Mutation resolves with `status: "captured"`, transaction reference returned.

**Transition**: The ContributionForm card and TrustSignals section fade out (opacity 0, `--motion-panel`), then ContributionSuccess card fades and slides in (translateY from +16px to 0, `--motion-enter-emphasis`). The CampaignSummaryHeader remains visible above.

The success checkmark animates:
1. Circle scales from 0 to 1.1 (`--motion-enter-emphasis`, spring easing) then settles to 1.
2. Tick path is drawn via SVG `stroke-dashoffset` animation (draws in over 300ms).
3. Reduced motion: both animations are instant (no scale bounce, no draw — just appear at opacity 1).

ContributionSuccess is not dismissible — it is the terminal state for this page visit. The only action is "Return to Mission".

---

### 4.5 Payment Failure

**Trigger**: Mutation returns a payment failure error (stub: `tok_fail` token used; backend returns failure response).

**Transition**: The ContributionForm card is replaced in place by ContributionError card (same fade + slide as success, `--motion-panel`). CampaignSummaryHeader and TrustSignals remain visible.

The `role="alert"` on ContributionError's container announces the error to screen readers without requiring focus management.

Clicking "Try Again":
- ContributionError fades out.
- ContributionForm fades back in with both inputs cleared.
- Focus is set programmatically to the AmountInput (`useEffect` + `inputRef.current?.focus()`).

---

### 4.6 Duplicate Contribution (409)

**Trigger**: API returns `HTTP 409` with error code `DUPLICATE_CONTRIBUTION`.

**Visual**: ContributionError is NOT shown. Instead, a small inline error appears below the submit button within the ContributionForm card:

```
  ─────────────────────────────────────────────────────────

  ⚠  You've already backed this mission in the last 60 seconds.
     Please wait a moment before trying again.

  [ Back This Mission → ]   ← button re-enabled once user dismisses or waits
```

Error text: `--type-body-small`, `--color-text-error`. Warning icon: `--color-status-warning`, 14px, `aria-hidden="true"`. The error is wrapped in `role="alert"` so it announces on insertion.

---

### 4.7 Campaign Not Live (422 / CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS)

**Trigger**: Either (a) campaign data loads with status not `Live`, or (b) API returns `HTTP 422` with `CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS`.

**Visual**: `ContributionNotAvailable` component replaces the form. CampaignSummaryHeader remains to provide context.

This state is also the pre-submission guard: if `usePublicCampaign` resolves with a non-Live campaign, the form is never shown — `ContributionNotAvailable` renders immediately without the form mounting.

---

### 4.8 Campaign Not Found (404)

**Trigger**: `usePublicCampaign` returns `error.status === 404`.

**Visual**: Full-screen centred error (same pattern as `PublicCampaignDetailPage` 404 state):

```
MISSION NOT FOUND

This campaign doesn't exist or is no longer available.

[ Browse Campaigns ]   ← Button Primary, routes to /campaigns
```

Typography:
- Heading: `--font-display`, 48px, uppercase, `--color-text-primary`
- Body: `--font-body`, 14px, `--color-text-secondary`

---

### 4.9 Generic API Error

**Trigger**: `usePublicCampaign` returns `isError === true` and `error.status !== 404`.

**Visual**: Same centred layout, smaller message:

```
Unable to load this campaign. Please try again.

[ Retry ]   ← secondary button, calls window.location.reload() or refetch()
```

Uses `role="alert"` on the error div. Error text: `--color-status-error`.

---

## 5. Responsive Behaviour

### 5.1 Breakpoints

| Breakpoint | Max-width | Layout changes |
|------------|-----------|----------------|
| Desktop | ≥1024px | Centred 640px column, 48px vertical padding |
| Tablet | 768px–1023px | Centred 640px column, 40px vertical padding (same single column) |
| Mobile | <768px | Full width minus 32px horizontal padding (16px each side), 24px vertical padding |

The page is intentionally single-column at all breakpoints. There is no layout shift between desktop and tablet — the 640px max-width fits comfortably within tablet viewports. Only mobile requires padding reduction.

### 5.2 Mobile Adjustments

| Element | Desktop | Mobile |
|---------|---------|--------|
| Page horizontal padding | 24px | 16px |
| Card padding | 32px | 24px |
| Campaign title in header | 24px | 20px |
| AmountInput value font | 32px | 28px |
| "MISSION BACKED" heading | 40px | 32px |
| Trust badge row | horizontal flex | wraps to two lines if needed |
| Submit button | full width | full width (unchanged) |

### 5.3 Touch Targets

All interactive elements meet the 44×44px minimum touch target:
- Submit button: `size="lg"` → 48px height minimum, full width — well above 44px.
- "Try Again" and ghost buttons: `size="md"` → 40px height. Apply `min-height: 44px` inline override for mobile breakpoint only.
- Back link: apply `padding: 12px 0` on mobile to expand tap area.
- Inputs: 48px height (14px top + 14px bottom padding + font-size line) — meets target.

---

## 6. Animation and Transitions

All animations use semantic motion tokens from L2-001 Section 2.9. All are disabled under `prefers-reduced-motion: reduce`.

### 6.1 Page Entry (Form Ready state)

| Element | Animation | Token |
|---------|-----------|-------|
| CampaignSummaryHeader | Fade in + translateY(8px→0) | `--motion-enter` (300ms `--easing-out`) |
| ContributionForm card | Fade in + translateY(8px→0), 80ms delay | `--motion-enter` (300ms `--easing-out`) |
| TrustSignals | Fade in, 160ms delay | `--motion-enter` (300ms `--easing-out`) |

Staggered entry gives a sense of progressive reveal without overwhelming the user.

Reduced motion: all three appear instantly at full opacity, no translate.

### 6.2 Button Loading State

When `isLoading={true}` on Button:
- Text changes from "Back This Mission →" to "Processing..." — this is a React state change, instant.
- `LoadingSpinner` (sm, decorative) appears to the left of the text, rendered by the existing Button component.
- No additional animation needed — the spinner itself communicates activity.

### 6.3 Input Focus Ring

On focus, inputs transition:
- `border-color`: `--color-border-input` → `--color-border-emphasis`, `--motion-hover` (150ms).
- `box-shadow`: 0 → `0 0 0 3px rgba(255,92,26,0.25)`, `--motion-hover` (150ms).

Reduced motion: both changes are instant (transition: none).

### 6.4 Success Entrance

ContributionSuccess replaces ContributionForm with:
1. ContributionForm fades to opacity 0, `--motion-panel` (500ms `--easing-out`).
2. ContributionSuccess fades in from opacity 0, translateY(16px→0), `--motion-enter-emphasis` (500ms `--easing-spring`).

Success checkmark (SVG):
- Circle: `transform: scale(0→1)`, `--motion-enter-emphasis` (500ms `--easing-spring`). Overshoot is the spring characteristic — acceptable for celebration.
- Tick: `stroke-dashoffset` from `circumference` to `0`, 300ms linear, 200ms delay after circle.

Reduced motion:
- ContributionForm and ContributionSuccess both appear/disappear instantly (no fade, no translate).
- Checkmark: no scale bounce, no draw animation — appears statically at full opacity.

### 6.5 Error Entrance

ContributionError replaces ContributionForm with:
- Same fade + translateY as success entrance but uses `--motion-panel` (not spring) — error states should not bounce.
- `role="alert"` on ContributionError container triggers screen reader announcement without requiring animation.

### 6.6 Retry Transition (Error → Form)

"Try Again" clicked:
- ContributionError fades to opacity 0, `--motion-hover` (fast — the user wants to act quickly).
- ContributionForm fades in from opacity 0, `--motion-enter` (300ms).
- After form is mounted, `useEffect` fires `amountInputRef.current?.focus()`.

---

## 7. Accessibility Checklist

### 7.1 Semantic HTML

- [ ] Page uses `<main>` landmark (via existing shell)
- [ ] CampaignSummaryHeader is `<section aria-label="Campaign summary">`
- [ ] ContributionForm is a `<form>` element with `aria-label="Contribute to mission"`
- [ ] AmountInput `<label htmlFor="amount">` paired with `<input id="amount">`
- [ ] PaymentTokenInput `<label htmlFor="payment-token">` paired with `<input id="payment-token">`
- [ ] Submit button is `<button type="submit">` within the form
- [ ] Back link is `<a>` not `<button>` (navigates, does not act)
- [ ] TrustSignals is `<aside aria-label="Security information">`

### 7.2 Colour Contrast

All text meets WCAG 2.1 AA at minimum. Primary text on surface meets AAA.

| Pairing | Ratio | WCAG |
|---------|-------|------|
| `--color-text-primary` on `--color-bg-surface` | 12.6:1 | AAA |
| `--color-text-secondary` on `--color-bg-surface` | ~9.2:1 | AAA |
| `--color-text-tertiary` on `--color-bg-surface` | ~5.4:1 | AA |
| `--color-text-accent` on `--color-bg-surface` | 4.8:1 | AA (large text only — section labels are uppercase 11px which qualifies as large text per WCAG at weight 600+) |
| `--color-text-error` on `--color-bg-surface` | ~5.1:1 | AA |
| `--color-status-success` on `--color-bg-surface` | 10.1:1 | AAA |
| `--color-action-primary-text` on primary button gradient | ~8.3:1 | AAA |

**Note on section labels**: `--color-text-accent` at 4.8:1 is applied to section labels rendered as `--type-section-label` (11px, weight 400, uppercase, letter-spacing 0.3em). At these proportions, WCAG large text exception does not strictly apply. However, section labels are supplementary navigation aids — their primary information is duplicated by the visual proximity of the form inputs themselves. Implementors should validate contrast in context and consider using `--color-action-primary-hover` (higher contrast) if review flags this.

### 7.3 Focus Management

- [ ] Focus is not trapped within the page (no modal pattern)
- [ ] On retry (ContributionError → form): programmatic focus set to AmountInput
- [ ] On success: focus is not moved (user may have scrolled; disorienting to force focus)
- [ ] Tab order: Back link → Amount input → Payment token input → Submit button → Trust signals (natural DOM order, no tabIndex manipulation)
- [ ] All interactive elements have visible focus ring (L2-001 Section 5.3)
- [ ] Focus ring: `outline: 2px solid --color-action-primary-hover; outline-offset: 2px` on buttons and links
- [ ] Focus ring on inputs: `border-color: --color-border-emphasis; box-shadow: 0 0 0 3px rgba(255,92,26,0.25)`
- [ ] `outline: none` is never used without a visible alternative

### 7.4 Screen Reader Requirements

- [ ] `LoadingSpinner` (page loading state): `role="status"`, `aria-label="Loading mission details"` — announces when spinner appears
- [ ] AmountInput validation error: `aria-invalid="true"` on input, `aria-describedby="amount-error"` pointing to error message `<span>`
- [ ] Amount live preview: `aria-live="polite"` on the preview paragraph — announces updates as user types, without interrupting
- [ ] Submit button in loading state: button is `disabled`, text reads "Processing..." — screen readers announce button state change
- [ ] ContributionError container: `role="alert"` — announces on insertion without focus change
- [ ] Duplicate contribution inline error: `role="alert"` — announces on insertion
- [ ] ContributionSuccess: no `role="alert"` needed (not urgent); focus management is passive
- [ ] FundingProgressBar: existing `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` — reused unchanged
- [ ] Decorative icons (lock, checkmarks in trust signals): `aria-hidden="true"`
- [ ] Success checkmark SVG: `aria-hidden="true"` (the heading "MISSION BACKED" and confirmation text carry all meaning)
- [ ] `tok_fail` inline code in helper: no special aria treatment needed — surrounding text provides context
- [ ] Currency amounts spoken by screen reader: `Intl.NumberFormat` output naturally includes "US dollars" in full locale strings; if using the short "$127.50" form, a visually hidden span with the full amount can be added for screen reader context (optional enhancement)

### 7.5 Motion

- [ ] All CSS animations check `@media (prefers-reduced-motion: reduce)` — refer to Section 6 for specific reduced-motion behaviours
- [ ] `LoadingSpinner` already implements `animation-play-state: paused` under reduced motion (existing component)
- [ ] Button transition properties are reduced to `none` under reduced motion
- [ ] Success checkmark animation is skipped under reduced motion
- [ ] Panel transitions (form → success, form → error) are instant under reduced motion

### 7.6 Keyboard Operation

- [ ] Form submittable via `Enter` key when focus is within any input (standard `<form>` + `<button type="submit">` behaviour)
- [ ] "Back This Mission →" keyboard accessible via Space and Enter
- [ ] "Try Again" keyboard accessible via Space and Enter
- [ ] Back link keyboard accessible via Enter (anchor element)
- [ ] No keyboard traps

### 7.7 Status Badges on This Page

No campaign status badges are displayed on `ContributeToMissionPage`. The page is only reachable for `Live` campaigns (non-live cases show `ContributionNotAvailable`). The campaign status is implicit from the page's existence.

The `PublicStatusBadge` component used on `PublicCampaignDetailPage` is **not** included here. The CampaignSummaryHeader does not need a status badge — the contribution form itself signals that the campaign is live and accepting contributions.

---

## 8. Copy Patterns

All copy follows L2-001 Section 4 (Voice-in-Product). Mission metaphors, direct address, active voice.

### 8.1 Page and Section Copy

| Element | Copy |
|---------|------|
| Page `<title>` | "Back [Campaign Title] — Mars Mission Fund" |
| Back link | "← Back to mission" |
| Amount section label | "01 — AMOUNT" |
| Amount helper (default) | "$5.00 minimum" |
| Amount validation error (below minimum) | "Minimum contribution is $5.00" |
| Amount validation error (empty on blur) | "Enter an amount to continue" |
| Amount live preview (no amount) | "Enter an amount above" |
| Amount live preview (valid) | "You are contributing [formatted amount]" |
| Payment token section label | "02 — PAYMENT TOKEN" |
| Payment token placeholder | "tok_success" |
| Payment token helper | "Use 'tok_fail' to simulate a payment failure" |
| Submit button (default) | "Back This Mission →" |
| Submit button (submitting) | "Processing..." |

### 8.2 State Copy

| State | Headline | Body |
|-------|----------|------|
| Success | "MISSION BACKED" | "Your [amount] is locked in. You're backing [Campaign Title]." |
| Success escrow note | — | "Funds secured in escrow. Release on milestone verification." |
| Success CTA | — | "Return to Mission" |
| Payment failure | "Payment not processed" | "We couldn't process this right now. Your data is safe — let's try again." |
| Payment failure CTA | — | "Try Again" |
| Duplicate contribution | — | "You've already backed this mission in the last 60 seconds. Please wait a moment before trying again." |
| Not accepting contributions | "This mission isn't accepting contributions right now." | "The campaign may have closed, fully funded, or be under review. Check the campaign page for details." |
| Not accepting CTA | — | "View Campaign" |
| 404 | "MISSION NOT FOUND" | "This campaign doesn't exist or is no longer available." |
| 404 CTA | — | "Browse Campaigns" |
| Generic error | — | "Unable to load this campaign. Please try again." |
| Generic error CTA | — | "Retry" |

### 8.3 Trust Signals Copy

| Signal | Text |
|--------|------|
| Escrow headline | "Your contribution is held in secure escrow" |
| Escrow detail | "Funds are only released when milestones are verified." |
| Badge 1 | "Encrypted" |
| Badge 2 | "No stored card details" |
| Badge 3 | "Sandbox demo" |

### 8.4 Forbidden Patterns (Reminder)

Per L2-001 Section 4.3, the following must not appear on this page:

- "Investment" — use "contribution" or "backing"
- "Click here" — all CTAs use descriptive labels
- "Guaranteed" — escrow copy must not imply guaranteed returns
- "Exciting opportunity" — copy is specific and direct
- Passive voice in CTAs — "Back This Mission" not "This mission can be backed"

---

## Change Log

| Date | Version | Author | Summary |
|------|---------|--------|---------|
| 2026-03-05 | 1.0 | Design Speccer | Initial spec for feat-005 contribution flow page. |
