/**
 * Centralised Clerk appearance configuration.
 * Maps MMF semantic design tokens to Clerk's theming API.
 *
 * Note: Clerk's `variables` API requires resolved hex/rgba values.
 * The `elements` API accepts CSS var() references.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#FF5C1A',
    colorText: '#E8EDF5',
    colorTextSecondary: '#C8D0DC',
    colorBackground: '#0B1628',
    colorInputBackground: 'rgba(245, 248, 255, 0.04)',
    colorInputText: '#E8EDF5',
    colorDanger: '#C1440E',
    borderRadius: '12px',
    fontFamily: "'DM Sans', sans-serif",
    fontFamilyButtons: "'DM Sans', sans-serif",
    fontSize: '16px',
    spacingUnit: '16px',
  },
  elements: {
    card: {
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'none',
    },
    headerTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: '40px',
      fontWeight: '400',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      color: 'var(--color-text-primary)',
    },
    headerSubtitle: {
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      fontWeight: '400',
      lineHeight: '1.7',
      color: 'var(--color-text-secondary)',
    },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #FF5C1A, #FF8C42, #FFB347)',
      color: 'var(--color-action-primary-text)',
      borderRadius: 'var(--radius-button)',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      fontWeight: '600',
      letterSpacing: '0.01em',
      boxShadow: '0 4px 16px var(--color-action-primary-shadow)',
      padding: '12px 24px',
    },
    formButtonPrimary__hover: {
      background: 'linear-gradient(135deg, #FF8C42, #FFB347, #FFB347)',
    },
    formFieldInput: {
      backgroundColor: 'var(--color-bg-input)',
      border: '1px solid var(--color-border-input)',
      borderRadius: 'var(--radius-input)',
      color: 'var(--color-text-primary)',
      fontFamily: 'var(--font-body)',
      fontSize: '16px',
      padding: '14px 16px',
    },
    formFieldInput__focused: {
      borderColor: 'var(--color-action-primary)',
      boxShadow: '0 0 0 3px rgba(255, 92, 26, 0.25)',
    },
    formFieldLabel: {
      fontFamily: 'var(--font-data)',
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: 'var(--color-text-tertiary)',
    },
    footerActionLink: {
      color: 'var(--color-action-primary)',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      fontWeight: '600',
    },
    footerActionLink__hover: {
      color: 'var(--color-action-primary-hover)',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'var(--color-action-secondary-bg)',
      border: '1px solid var(--color-action-secondary-border)',
      borderRadius: 'var(--radius-button)',
      color: 'var(--color-action-secondary-text)',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      fontWeight: '600',
    },
    socialButtonsBlockButton__hover: {
      backgroundColor: 'var(--color-bg-elevated)',
    },
    dividerLine: {
      backgroundColor: 'var(--color-border-subtle)',
    },
    dividerText: {
      color: 'var(--color-text-tertiary)',
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
    },
    formFieldErrorText: {
      color: 'var(--color-text-error)',
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
    },
    identityPreview: {
      backgroundColor: 'var(--color-bg-elevated)',
      borderRadius: 'var(--radius-input)',
    },
    identityPreviewText: {
      color: 'var(--color-text-secondary)',
    },
    identityPreviewEditButton: {
      color: 'var(--color-action-primary)',
    },
  },
} as const;

/**
 * Appearance overrides for the UserButton popover in the header.
 */
export const userButtonAppearance = {
  elements: {
    avatarBox: {
      width: '32px',
      height: '32px',
    },
    userButtonPopoverCard: {
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-card)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    },
    userButtonPopoverActionButton: {
      color: 'var(--color-text-secondary)',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
    },
    userButtonPopoverActionButton__hover: {
      backgroundColor: 'var(--color-bg-elevated)',
      color: 'var(--color-text-primary)',
    },
    userButtonPopoverFooter: {
      display: 'none',
    },
  },
} as const;
