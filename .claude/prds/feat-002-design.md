# feat-002: Authentication — Design Spec

**Feature ID:** feat-002
**Spec Type:** Design
**Status:** Ready for Implementation
**Date:** 2026-03-07
**Depends On:** feat-002-spec.md (technical spec), L2-001 (Brand Application Standard), L3-005 (Frontend Standards)

---

## 1. Overview

Authentication UI for Mars Mission Fund is delivered primarily through Clerk's hosted `<SignIn>` and `<SignUp>` components. The MMF brand is applied to these components via Clerk's `appearance` prop — this is a token-mapping exercise, not a full custom UI build. The total custom UI work is:

- A full-viewport wrapper page for Sign In (`/sign-in`)
- A full-viewport wrapper page for Sign Up (`/sign-up`)
- A loading state while Clerk initialises
- A `ProtectedRoute` component that redirects unauthenticated users

Clerk manages all form rendering, validation, error messaging, multi-step flows (email OTP, factor-two, etc.), and SSO. We do not re-implement any of that.

**Design principle:** The auth pages are the first thing a new user sees. They must look and feel unmistakably MMF — deep space foundation, launch-fire energy, Bebas Neue authority — while Clerk handles the functional complexity.

---

## 2. Clerk Appearance Configuration

Both `<SignIn>` and `<SignUp>` receive the same `appearance` prop object. Define it once and share it.

### 2.1 Appearance Object

```typescript
import type { Appearance } from '@clerk/types';

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#FF5C1A',                        // --launchfire (--color-action-primary)
    colorBackground: '#0B1628',                      // --deep-space (--color-bg-surface)
    colorText: '#E8EDF5',                            // --chrome (--color-text-primary)
    colorInputBackground: 'rgba(245, 248, 255, 0.04)', // --white/4% (--color-bg-input)
    colorInputText: '#E8EDF5',                       // --chrome (--color-text-primary)
    colorTextSecondary: '#C8D0DC',                   // --silver (--color-text-secondary)
    colorTextOnPrimaryBackground: '#F5F8FF',         // --white (--color-action-primary-text)
    colorDanger: '#C1440E',                          // --red-planet (--color-status-error)
    colorSuccess: '#2FE8A2',                         // --success (--color-status-success)
    borderRadius: '12px',                            // --radius-md (--radius-input)
    fontFamily: '"DM Sans", sans-serif',             // --font-body
    fontFamilyButtons: '"DM Sans", sans-serif',      // --font-body
    fontSize: '14px',
    spacingUnit: '16px',
  },
  elements: {
    // Card container
    card: {
      background: '#0B1628',                         // --color-bg-surface
      border: '1px solid rgba(245, 248, 255, 0.06)', // --color-border-subtle
      borderRadius: '20px',                          // --radius-card (--radius-xl)
      boxShadow: '0 24px 48px rgba(6, 10, 20, 0.5)', // deep shadow, void-based
      padding: '40px',
    },
    // Header title — "Sign in" / "Create your account"
    headerTitle: {
      fontFamily: '"Bebas Neue", sans-serif',        // --font-display
      fontSize: '40px',                              // --type-section-heading
      fontWeight: '400',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: '#E8EDF5',                              // --color-text-primary
    },
    // Header subtitle — "Welcome back!" etc.
    headerSubtitle: {
      fontFamily: '"DM Sans", sans-serif',           // --font-body
      fontSize: '16px',                              // --type-body
      color: '#C8D0DC',                              // --color-text-secondary
    },
    // Primary submit button
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #FF5C1A, #FF8C42, #FFB347)', // --gradient-action-primary
      color: '#F5F8FF',                              // --color-action-primary-text
      fontFamily: '"DM Sans", sans-serif',           // --font-body
      fontSize: '14px',                              // --type-button
      fontWeight: '600',
      letterSpacing: '0.01em',
      borderRadius: '100px',                         // --radius-button (--radius-full)
      border: 'none',
      boxShadow: '0 4px 16px rgba(255, 92, 26, 0.35)', // --color-action-primary-shadow
      padding: '12px 24px',
      transition: 'opacity 150ms ease-out',          // --motion-hover
    },
    // Footer action links — "Don't have an account? Sign up"
    footerActionLink: {
      color: '#FF8C42',                              // --ignition (--color-action-ghost-text)
      fontWeight: '600',
    },
    footerActionText: {
      color: '#C8D0DC',                              // --color-text-secondary
    },
    // Form input fields
    formFieldInput: {
      background: 'rgba(245, 248, 255, 0.04)',       // --color-bg-input
      border: '1px solid rgba(245, 248, 255, 0.10)', // --color-border-input
      borderRadius: '12px',                          // --radius-input (--radius-md)
      color: '#E8EDF5',                              // --color-text-primary
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '14px',
    },
    formFieldLabel: {
      fontFamily: '"Space Mono", monospace',         // --font-data
      fontSize: '12px',                              // --type-input-label
      fontWeight: '600',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: '#8A96A8',                              // --color-text-tertiary
    },
    // Social / OAuth provider buttons
    socialButtonsBlockButton: {
      background: 'rgba(245, 248, 255, 0.06)',       // --color-action-secondary-bg
      border: '1px solid rgba(245, 248, 255, 0.12)', // --color-action-secondary-border
      borderRadius: '100px',                         // --radius-button
      color: '#C8D0DC',                              // --color-action-secondary-text
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '14px',
      fontWeight: '600',
    },
    dividerLine: {
      background: 'rgba(245, 248, 255, 0.06)',       // --color-border-subtle
    },
    dividerText: {
      color: '#8A96A8',                              // --color-text-tertiary
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '13px',                              // --type-body-small
    },
    // "Secured by Clerk" footer
    footer: {
      display: 'none',                               // Hide Clerk branding in demo context
    },
  },
};
```

### 2.2 Token Mapping Rationale

The `clerkAppearance` object uses raw hex/rgba values because Clerk's `appearance` prop does not consume CSS custom properties — it injects inline styles. This is the only place in the codebase where Tier 1 identity token values are used directly. The semantic intent is documented inline in comments.

This is a deliberate exception, not a violation. The mapping table below shows the intent:

| Clerk Variable / Element | Raw Value Used | Semantic Token Equivalent |
|---|---|---|
| `colorPrimary` | `#FF5C1A` | `--color-action-primary` |
| `colorBackground` | `#0B1628` | `--color-bg-surface` |
| `colorText` | `#E8EDF5` | `--color-text-primary` |
| `colorInputBackground` | `rgba(245,248,255,0.04)` | `--color-bg-input` |
| `colorDanger` | `#C1440E` | `--color-status-error` |
| `colorSuccess` | `#2FE8A2` | `--color-status-success` |
| Card border | `rgba(245,248,255,0.06)` | `--color-border-subtle` |
| Card border-radius | `20px` | `--radius-card` |
| Button gradient | `135deg, #FF5C1A, #FF8C42, #FFB347` | `--gradient-action-primary` |
| Button border-radius | `100px` | `--radius-button` |
| Header font | Bebas Neue | `--font-display` |
| Body font | DM Sans | `--font-body` |
| Label font | Space Mono | `--font-data` |

---

## 3. Page Layouts

### 3.1 Sign In Page — `/sign-in`

**File:** `packages/frontend/src/pages/SignInPage.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  [full viewport, --gradient-hero background]            │
│                                                         │
│                                                         │
│              ┌──────────────────────┐                   │
│              │  [coin icon mark]    │                   │
│              │  MARS MISSION FUND   │  <- wordmark      │
│              │  [subtitle]          │                   │
│              ├──────────────────────┤                   │
│              │                      │                   │
│              │   <SignIn />         │                   │
│              │   [Clerk card]       │                   │
│              │                      │                   │
│              └──────────────────────┘                   │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Layout rules:**

- Background: `--gradient-hero` (`linear-gradient(135deg, #060A14 0%, #0B1628 50%, rgba(255,92,26,0.15) 100%)`) applied to the full viewport
- Content column: centered horizontally and vertically, `max-width: 480px`, `width: 100%`, padding `0 24px`
- Logo block sits above the Clerk card with `margin-bottom: 32px`
- No navigation bar, no header, no footer — auth pages are full-bleed standalone

**Logo block:**

- Coin icon mark: `<img>` of the coin SVG at 64px height, `alt=""` (decorative — wordmark below carries the semantic name), `aria-hidden="true"`
- Wordmark heading: `MARS MISSION FUND` in `--font-display` (Bebas Neue), `--type-page-title` (56px), `--color-text-primary`, `letter-spacing: 0.04em`, `text-transform: uppercase`, `text-align: center`
- Subtitle: `"Fund the missions that get us there."` in `--font-body` (DM Sans), `--type-body` (16px), `--color-text-secondary`, `text-align: center`, `margin-top: 8px`
- Logo block heading should carry `aria-label="Mars Mission Fund"` on the coin image or an `<h1>` wrapping the wordmark text — see accessibility notes below

**Clerk component:**

```tsx
<SignIn
  routing="path"
  path="/sign-in"
  signUpUrl="/sign-up"
  fallbackRedirectUrl="/dashboard"
  appearance={clerkAppearance}
/>
```

### 3.2 Sign Up Page — `/sign-up`

Identical layout to Sign In. Swap the Clerk component:

```tsx
<SignUp
  routing="path"
  path="/sign-up"
  signInUrl="/sign-in"
  fallbackRedirectUrl="/dashboard"
  appearance={clerkAppearance}
/>
```

The subtitle copy changes to: `"Join the mission. Back the future."` — same token/size.

### 3.3 Shared Auth Page Wrapper Component

Extract the repeated wrapper into a shared component to avoid duplication:

**File:** `packages/frontend/src/components/auth/AuthPageLayout.tsx`

Props:
```typescript
interface AuthPageLayoutProps {
  readonly subtitle: string;
  readonly children: React.ReactNode;
}
```

The wrapper renders:
1. Full-viewport div with `--gradient-hero` background, `min-height: 100vh`, `display: flex`, `align-items: center`, `justify-content: center`
2. Inner content column (`max-width: 480px`)
3. Logo block (coin icon + MARS MISSION FUND heading + subtitle)
4. `{children}` (the Clerk component)

---

## 4. Protected Route UX

**File:** `packages/frontend/src/components/auth/ProtectedRoute.tsx`

### 4.1 Unauthenticated Redirect

When Clerk has finished loading (`isLoaded === true`) and the user is not signed in (`isSignedIn === false`):

- Immediately render `<Navigate to="/sign-in" replace />`
- No flash of protected content — the check is synchronous once `isLoaded` is true
- `replace` is used so the browser back button does not return to the protected route

### 4.2 Post-Sign-In Redirect

Clerk's `fallbackRedirectUrl="/dashboard"` handles the common case. For redirecting back to the originally requested URL after sign-in, use Clerk's `afterSignInUrl` prop or the `redirectUrl` search parameter that Clerk appends automatically when it redirects to `/sign-in`.

No custom redirect-URL logic is needed in feat-002 — Clerk handles this transparently.

### 4.3 Loading State (while `isLoaded === false`)

While Clerk is initialising, render the full-page loading state (see Section 5). Do not render a blank page or a partial layout.

---

## 5. Loading State

**File:** `packages/frontend/src/components/auth/AuthLoadingScreen.tsx`

Shown while Clerk has not yet confirmed authentication status (`isLoaded === false` from `useAuth()`).

### 5.1 Visual Specification

```
┌─────────────────────────────────────────────────────────┐
│  [--color-bg-page background, full viewport]            │
│                                                         │
│                                                         │
│                   ┌───────────────┐                     │
│                   │  [coin icon]  │  <- 48px, pulsing   │
│                   └───────────────┘                     │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Background: `--color-bg-page` (`#060A14` / `--void`) — deepest space, fills viewport
- Centered content: coin icon mark at 48px height
- Pulse animation on the coin icon (opacity 1 → 0.4 → 1, not scale — avoids layout shift)

### 5.2 Animation Specification

```css
@keyframes mmf-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.auth-loading-icon {
  animation: mmf-pulse 1.5s ease-in-out infinite;
  /* Uses --motion-urgency: 1.5s, ease-in-out, infinite */
}

@media (prefers-reduced-motion: reduce) {
  .auth-loading-icon {
    animation: none;
    opacity: 0.7; /* static glow at reduced opacity per L2-001 Section 5.2 */
  }
}
```

The `1.5s ease-in-out infinite` timing aligns with `--motion-urgency` from L2-001 Section 2.9.

### 5.3 Accessibility

- The loading screen root element: `<output aria-busy="true" aria-label="Loading Mars Mission Fund">` — `<output>` has implicit `role="status"` and avoids the Biome `useSemanticElements` lint rule that flags `<div role="status">` (per feat-002-spec.md Section 14, Note 9)
- The coin icon: `<img src="..." alt="" aria-hidden="true" />` — decorative; the `aria-label` on the `<output>` carries the accessible name

---

## 6. Typography on Auth Pages

All typography on auth page wrapper content (logo block, subtitle) follows the closed type scale from L2-001 Section 2.8. No custom sizes.

| Element | Semantic Token | Font | Size | Weight | Additional |
|---|---|---|---|---|---|
| "MARS MISSION FUND" wordmark | `--type-page-title` | Bebas Neue (`--font-display`) | 56px | 400 | `letter-spacing: 0.04em`, `text-transform: uppercase` |
| Subtitle copy | `--type-body` | DM Sans (`--font-body`) | 16px | 400 | `line-height: 1.7`, `--color-text-secondary` |

**Rule:** The wordmark on auth pages is an `<h1>`. It is the only heading on the page and represents the application name for screen reader users. Clerk's own card header ("Sign in", "Create account") renders at a visually appropriate size via the `headerTitle` appearance override but is not an `<h1>` — it is decorative titling within the Clerk component.

---

## 7. Responsive Behaviour

Auth pages use the mobile-first breakpoint system from L3-005 Section 5.2.

| Viewport | Layout |
|---|---|
| < 480px (mobile) | Full-width card, `padding: 0 16px`, coin at 48px, wordmark at 40px (drops to `--type-section-heading`) |
| 480px – 768px | 480px max-width column, centred, standard sizing |
| > 768px | Same as 480px+ — layout does not expand further |

The Clerk card width is constrained by its wrapper column. Clerk's own responsive behaviour handles input sizing inside the card.

On mobile, the wordmark font size reduces from 56px (`--type-page-title`) to 40px (`--type-section-heading`) to avoid overflow. This is the only responsive type adjustment on auth pages.

---

## 8. Colour and Visual Summary

| Surface | Token | Resolved Value |
|---|---|---|
| Page background | `--gradient-hero` | `linear-gradient(135deg, #060A14 0%, #0B1628 50%, rgba(255,92,26,0.15) 100%)` |
| Loading screen background | `--color-bg-page` | `#060A14` |
| Clerk card background | `--color-bg-surface` | `#0B1628` |
| Clerk card border | `--color-border-subtle` | `rgba(245,248,255,0.06)` |
| Wordmark text | `--color-text-primary` | `#E8EDF5` |
| Subtitle text | `--color-text-secondary` | `#C8D0DC` |
| Primary button | `--gradient-action-primary` | `linear-gradient(135deg, #FF5C1A, #FF8C42, #FFB347)` |
| Footer links | `--color-action-ghost-text` | `#FF8C42` |
| Input background | `--color-bg-input` | `rgba(245,248,255,0.04)` |
| Input border | `--color-border-input` | `rgba(245,248,255,0.10)` |
| Input labels | `--color-text-tertiary` | `#8A96A8` |
| Error colour | `--color-status-error` | `#C1440E` |
| Success colour | `--color-status-success` | `#2FE8A2` |

---

## 9. Logo Usage on Auth Pages

Per L2-001 Section 6.1, the Login/Registration context uses the **full vertical lockup (dark variant)**:
- Coin icon mark at 64px height (120px per spec is for marketing contexts; 64px is appropriate for the card-above-clerk layout without dominating the viewport)
- Full wordmark below the icon

The coin icon is the SVG asset from the brand guidelines. In the codebase, reference it from `packages/frontend/src/assets/logo/` (the asset path to be confirmed by the implementation agent when placing brand assets).

---

## 10. Accessibility Checklist

| Requirement | Implementation |
|---|---|
| Auth page has an `<h1>` | "MARS MISSION FUND" wordmark is an `<h1>` |
| Decorative images hidden | Coin icon: `alt=""`, `aria-hidden="true"` |
| Loading state announced | `<output aria-busy="true" aria-label="Loading Mars Mission Fund">` |
| Reduced motion respected | Loading pulse disables via `prefers-reduced-motion: reduce` |
| Focus on sign-in fields | Clerk manages focus within its component; wrapper does not interfere |
| Colour contrast | All wrapper text uses tokens verified at AAA in L2-001 Section 5.1 |
| Touch targets | Clerk manages its own touch targets; wrapper has no interactive elements below the Clerk card |
| Skip-to-content | Not required on auth pages — single-purpose pages with no navigation to skip |

---

## 11. Not In Scope

The following are explicitly excluded from feat-002 design work:

- Profile settings page UI — deferred to feat-011 or later
- Role assignment UI — administrators use the API directly in the demo
- MFA setup or session management UI — Clerk handles transparently
- Onboarding flow UI — feat-003
- Full KYC verification flow — feat-007
- SSO provider linking UI — Clerk handles OAuth transparently
- Account deletion / GDPR erasure UI — P3
- Profile picture upload UI — file upload and S3 integration deferred
- A public-facing landing page at `/` — the root redirects to `/home` which is a protected route placeholder; no marketing page design is required for feat-002

---

## 12. Files Produced by This Feature

| File | Description |
|---|---|
| `packages/frontend/src/pages/SignInPage.tsx` | Sign In page wrapper |
| `packages/frontend/src/pages/SignUpPage.tsx` | Sign Up page wrapper |
| `packages/frontend/src/components/auth/AuthPageLayout.tsx` | Shared auth page layout wrapper |
| `packages/frontend/src/components/auth/AuthLoadingScreen.tsx` | Full-page loading state |
| `packages/frontend/src/components/auth/ProtectedRoute.tsx` | Auth guard component |
| `packages/frontend/src/styles/auth.css` | Auth page CSS (loading animation, responsive overrides) |
| `packages/frontend/src/lib/clerkAppearance.ts` | Shared Clerk appearance config object |

---

*This design spec governs the visual and interaction design for feat-002. For backend implementation details, API contracts, and test requirements, see `feat-002-spec.md`. For brand token definitions, see `specs/standards/brand.md`.*
