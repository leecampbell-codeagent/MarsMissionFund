# feat-005 Design Specification: KYC Identity Verification

> Engineers implement directly from this document.
> Status: Ready for implementation.
> Date: 2026-03-06

---

## 1. Design Principles

### Dark-first UI
- Primary background is always `--color-bg-page` (renders as #060A14)
- No light mode — the entire KYC surface is dark
- Cards and elevated surfaces use `--color-bg-surface` or `--color-bg-elevated`

### Two-tier token architecture
- Components consume **Tier 2 semantic tokens only**
- Never reference Tier 1 identity tokens directly (`--void`, `--deep-space`, `--launchfire`, `--chrome`, `--success`, etc.) in component code
- All style values go through the semantic layer (e.g., `--color-bg-page`, `--color-text-primary`, `--color-status-success`)

### Brand aesthetic
- Section labels: `--font-data` (Space Mono), 11px, `0.3em` letter-spacing, uppercase — establishes mission/technical tone
- Headings: `--font-display` (Bebas Neue), always uppercase — never sentence case
- Body: `--font-body` (DM Sans), 16px, line-height 1.7
- Labels/data: `--font-data` (Space Mono), 11px, uppercase, `0.2em` letter-spacing

### Motion
- All transitions use `--motion-enter` (`300ms cubic-bezier(0.25, 1, 0.5, 1)`) or `--motion-hover` (`150ms cubic-bezier(0.25, 1, 0.5, 1)`)
- Respect `prefers-reduced-motion`: wrap all animation/transition declarations so they are suppressed when the media query fires (the global reset in `index.css` handles this globally, but any inline `style` animations must also be guarded)

---

## 2. KYC Page (full replacement of `kyc-stub.tsx`)

**Page title:** `Identity Verification — Mars Mission Fund`

**Outer shell** (all three states share this):

```
minHeight: calc(100vh - 64px)   // accounts for nav bar
backgroundColor: var(--color-bg-page)
display: flex
alignItems: center
justifyContent: center
padding: 48px 24px
```

**Inner container** (all three states share this):

```
maxWidth: 480px
width: 100%
display: flex
flexDirection: column
gap: 32px
```

---

### 2.1 Loading State

Render when `useKycStatus()` is in `isLoading` state.

Replace the inner container with a full-screen centered spinner:

```
minHeight: calc(100vh - 64px)
backgroundColor: var(--color-bg-page)
display: flex
alignItems: center
justifyContent: center
```

Child: `<LoadingSpinner />` (existing component, default size).

No text, no label — spinner only.

---

### 2.2 Verified / Success State

Render when `status === 'verified'`.

**Section label:**
```
fontFamily: var(--font-data)
fontSize: 11px
fontWeight: 400
letterSpacing: 0.3em
textTransform: uppercase
color: var(--color-text-accent)
margin: 0
```
Text: `01 — IDENTITY VERIFIED`

**Heading:**
```
fontFamily: var(--font-display)
fontSize: 48px
fontWeight: 400
letterSpacing: 0.04em
color: var(--color-text-primary)
lineHeight: 1
margin: 0
textTransform: uppercase
```
Text: `VERIFICATION APPROVED`

**Success icon block:**

A simple checkmark indicator — not an image, rendered via a `<div>` containing a Unicode checkmark or SVG:

```
display: flex
alignItems: center
gap: 12px
```

Icon element:
```
fontSize: 32px
color: var(--color-status-success)
lineHeight: 1
```
Character: `✓` (U+2713) or an inline SVG checkmark at 32×32px with `stroke: var(--color-status-success)`.

**Body text:**
```
fontFamily: var(--font-body)
fontSize: 16px
fontWeight: 400
lineHeight: 1.7
color: var(--color-text-secondary)
margin: 0
```
Text: `Your identity has been verified. You can now submit campaigns.`

**CTA — "Return to Profile":**

Secondary style (navigation action, not a conversion CTA — must not use primary gradient):

```html
<a href="/profile"> or <button type="button" onClick={() => navigate('/profile')}>
```

```
display: inline-flex
alignItems: center
justifyContent: center
alignSelf: flex-start
minHeight: 44px
padding: 12px 24px
fontFamily: var(--font-body)
fontSize: 14px
fontWeight: 600
letterSpacing: 0.01em
color: var(--color-action-ghost-text)
backgroundColor: transparent
border: 1px solid var(--color-action-ghost-border)
borderRadius: var(--radius-button)
cursor: pointer
transition: opacity var(--motion-hover)
```
Text: `Return to Profile`

Hover: `opacity: 0.8`

Focus-visible: `outline: 2px solid var(--color-action-primary-hover); outline-offset: 2px`

---

### 2.3 Form State (not_verified / pending / rejected / expired / other)

Render for all statuses other than `verified` and the initial loading state.

**Section label:**
```
fontFamily: var(--font-data)
fontSize: 11px
fontWeight: 400
letterSpacing: 0.3em
textTransform: uppercase
color: var(--color-text-accent)
margin: 0
```
Text: `01 — VERIFY YOUR IDENTITY`

**Heading:**
```
fontFamily: var(--font-display)
fontSize: 48px
fontWeight: 400
letterSpacing: 0.04em
color: var(--color-text-primary)
lineHeight: 1
margin: 0
textTransform: uppercase
```
Text: `IDENTITY VERIFICATION`

**Body text:**
```
fontFamily: var(--font-body)
fontSize: 16px
fontWeight: 400
lineHeight: 1.7
color: var(--color-text-secondary)
margin: 0
```
Text: `To launch campaigns on Mars Mission Fund, we need to verify your identity. Select your document type below and submit — verification is processed automatically.`

**Pending status banner** (render only when `status === 'pending'`):

```
padding: 12px 16px
backgroundColor: rgba(255, 183, 71, 0.1)   // use inline rgba — no Tier 1 token here
border: 1px solid var(--color-status-warning)
borderRadius: var(--radius-input)
display: flex
alignItems: center
gap: 10px
```

Content:
- Inline `<LoadingSpinner size="sm" />` (or a static `⏳`-free indicator — prefer the existing `LoadingSpinner` at small size)
- Text:
  ```
  fontFamily: var(--font-body)
  fontSize: 14px
  color: var(--color-status-warning)
  margin: 0
  ```
  Text: `Your verification is pending review.`

Note: when `status === 'pending'`, still render the form below so the user can resubmit if they choose. The pending banner sits between the body text and the form.

**Document type selector:**

Outer group:
```
display: flex
flexDirection: column
gap: 8px
```

Label:
```html
<label htmlFor="documentType">
```
```
fontFamily: var(--font-data)
fontSize: 11px
letterSpacing: 0.2em
textTransform: uppercase
color: var(--color-text-tertiary)
```
Text: `Document Type`

Select element:
```html
<select id="documentType" name="documentType">
  <option value="passport">Passport</option>
  <option value="national_id">National ID</option>
  <option value="drivers_licence">Driver's Licence</option>
</select>
```

```
fontFamily: var(--font-body)
fontSize: 16px
color: var(--color-text-primary)
backgroundColor: var(--color-bg-input)
border: 1px solid var(--color-border-input)
borderRadius: var(--radius-input)
padding: 12px 16px
width: 100%
outline: none
cursor: pointer
appearance: auto   // preserve native dropdown arrow
transition: border-color var(--motion-hover)
```

Focus:
```
borderColor: var(--color-border-emphasis)
```

**Error message** (render when mutation returns an error):

```html
<p role="alert">
```
```
fontFamily: var(--font-body)
fontSize: 14px
color: var(--color-status-error)
margin: 0
```
Text: Display the error message from the API response, or fall back to `Something went wrong. Please try again.`

**Submit button:**

Primary CTA — one per viewport.

```html
<button type="submit"> or <button type="button" onClick={handleSubmit}>
```

Default state:
```
alignSelf: flex-start
display: inline-flex
alignItems: center
justifyContent: center
gap: 8px
minHeight: 44px
padding: 12px 32px
fontFamily: var(--font-body)
fontSize: 14px
fontWeight: 600
letterSpacing: 0.05em
textTransform: uppercase
color: var(--color-text-on-action)
background: var(--gradient-action-primary)
border: none
borderRadius: var(--radius-button)
cursor: pointer
boxShadow: 0 4px 16px var(--color-action-primary-shadow)
transition: opacity var(--motion-hover)
```
Text: `SUBMIT FOR VERIFICATION`

Hover: `opacity: 0.9`

Focus-visible: `outline: 2px solid var(--color-action-primary-hover); outline-offset: 2px`

isPending (mutation in flight):
```
cursor: not-allowed
opacity: 0.7
```
Replace button text with: `<LoadingSpinner size="sm" label="Submitting" />`

Disabled attribute: `disabled={isPending}`

---

## 3. Profile Page — KYC Status Section

The KYC status card lives in `profile.tsx` inside `<section aria-label="Identity verification">`. The section heading `IDENTITY VERIFICATION` and its `<h2>` style remain unchanged.

Extract the status card into a named component: `KycStatusDisplay`.

**Component signature:**
```tsx
interface KycStatusDisplayProps {
  readonly status: string;  // KycStatus value from useKycStatus()
  readonly isLoading: boolean;
}
export function KycStatusDisplay({ status, isLoading }: KycStatusDisplayProps): JSX.Element
```

**Card shell** (shared across all variants):
```
padding: 16px 20px
backgroundColor: var(--color-bg-surface)
border: 1px solid var(--color-border-subtle)
borderRadius: var(--radius-card)
display: flex
alignItems: center
justifyContent: space-between
gap: 16px
```

---

### 3.1 Loading variant (`isLoading === true`)

Left side:
```
fontFamily: var(--font-body)
fontSize: 14px
color: var(--color-text-tertiary)
margin: 0
```
Text: `Loading verification status…`

Right side: `<LoadingSpinner size="sm" />`

---

### 3.2 `not_verified` variant

Left side:
```
fontFamily: var(--font-body)
fontSize: 14px
color: var(--color-text-secondary)
margin: 0
```
Text: `Identity verification not yet started.`

Right side:
```html
<a href="/kyc">
```
```
fontFamily: var(--font-body)
fontSize: 14px
color: var(--color-action-ghost-text)
textDecoration: none
whiteSpace: nowrap
```
Text: `Start verification →`

Hover: `textDecoration: underline`

---

### 3.3 `pending` variant

Left side — flex row, gap 10px:
- `<LoadingSpinner size="sm" />` (or a static animated dot — prefer `LoadingSpinner`)
- Text:
  ```
  fontFamily: var(--font-body)
  fontSize: 14px
  color: var(--color-status-warning)
  margin: 0
  ```
  Text: `Verification pending review.`

Right side: none (no link — user cannot act further)

---

### 3.4 `verified` variant

Left side — flex row, gap 10px:
- Checkmark character `✓` or inline SVG:
  ```
  fontSize: 16px
  color: var(--color-status-success)
  lineHeight: 1
  ```
- Text:
  ```
  fontFamily: var(--font-body)
  fontSize: 14px
  color: var(--color-status-success)
  margin: 0
  ```
  Text: `Identity verified.`

Right side: none (no link needed)

---

### 3.5 All other statuses (`rejected`, `expired`, or unknown)

Left side:
```
fontFamily: var(--font-body)
fontSize: 14px
color: var(--color-text-secondary)
margin: 0
```
Text: `Verification status: {status}` (render status value as-is, lowercase)

Right side:
```html
<a href="/kyc">
```
```
fontFamily: var(--font-body)
fontSize: 14px
color: var(--color-action-ghost-text)
textDecoration: none
whiteSpace: nowrap
```
Text: `Retry verification →`

Hover: `textDecoration: underline`

---

## 4. Token Usage Reference

Quick reference for engineers — enforce these during code review.

### Backgrounds
| Context | Token |
|---|---|
| Page background | `--color-bg-page` |
| Card / section surface | `--color-bg-surface` |
| Input background | `--color-bg-input` |
| Elevated / modal | `--color-bg-elevated` |

### Text
| Context | Token |
|---|---|
| Primary body text | `--color-text-primary` |
| Secondary / supporting | `--color-text-secondary` |
| Labels, metadata | `--color-text-tertiary` |
| Section labels (accent) | `--color-text-accent` |
| On primary CTA button | `--color-text-on-action` |
| Success state text | `--color-status-success` |
| Warning state text | `--color-status-warning` |
| Error state text | `--color-status-error` |

### Borders
| Context | Token |
|---|---|
| Card border (default) | `--color-border-subtle` |
| Input border (default) | `--color-border-input` |
| Input border (focus) | `--color-border-emphasis` |

### Typography
| Use | Font token | Size | Transform |
|---|---|---|---|
| Page headings | `--font-display` | 48px | uppercase |
| Section labels | `--font-data` | 11px | uppercase |
| Form labels | `--font-data` | 11px | uppercase |
| Body / descriptions | `--font-body` | 16px | none |
| Button text | `--font-body` | 14px | uppercase (primary), none (secondary) |
| Error / status text | `--font-body` | 14px | none |

### Radius
| Element | Token |
|---|---|
| Card / section wrapper | `--radius-card` |
| Buttons | `--radius-button` |
| Inputs / selects | `--radius-input` |

### Gradients
| Use | Token |
|---|---|
| Primary CTA background | `--gradient-action-primary` |

### Motion
| Use | Token |
|---|---|
| Entrance / state transitions | `--motion-enter` |
| Hover state transitions | `--motion-hover` |

### Absolute prohibitions
- Never use Tier 1 tokens in component code: `--void`, `--deep-space`, `--nebula`, `--orbit`, `--launchfire`, `--ignition`, `--afterburn`, `--red-planet`, `--chrome`, `--silver`, `--stardust`, `--white`, `--success`, `--success-deep`, `--signal-blue`
- Never use raw hex values in component code — all values go through CSS custom properties
- Exception: semi-transparent overlays where no semantic token exists (e.g., the pending banner background `rgba(255, 183, 71, 0.1)`) — document with a comment when used

---

## 5. Accessibility Requirements

- All interactive elements have a minimum touch target of 44×44px
- Focus-visible ring on all buttons and links: `outline: 2px solid var(--color-action-primary-hover); outline-offset: 2px`
- Select element retains native focus ring behaviour (do not remove `outline` on select without replacing it)
- Error messages use `role="alert"` so screen readers announce them immediately
- Status messages (pending banner) use `role="status"` for polite announcement
- Loading states: `<LoadingSpinner>` must accept and render an accessible `label` prop (aria-label) — use `label="Loading verification status"` / `label="Submitting"` as appropriate
- `<select>` is associated to its `<label>` via matching `id` / `htmlFor`
- The KYC page `<title>` must be `Identity Verification — Mars Mission Fund`
