import type { Appearance } from '@clerk/types';

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#FF5C1A',
    colorBackground: '#0B1628',
    colorText: '#E8EDF5',
    colorInputBackground: 'rgba(245, 248, 255, 0.04)',
    colorInputText: '#E8EDF5',
    colorTextSecondary: '#C8D0DC',
    colorTextOnPrimaryBackground: '#F5F8FF',
    colorDanger: '#C1440E',
    colorSuccess: '#2FE8A2',
    borderRadius: '12px',
    fontFamily: '"DM Sans", sans-serif',
    fontFamilyButtons: '"DM Sans", sans-serif',
    fontSize: '14px',
    spacingUnit: '16px',
  },
  elements: {
    // Card container
    card: {
      background: '#0B1628',
      border: '1px solid rgba(245, 248, 255, 0.06)',
      borderRadius: '20px',
      boxShadow: '0 24px 48px rgba(6, 10, 20, 0.5)',
      padding: '40px',
    },
    // Header title — "Sign in" / "Create your account"
    headerTitle: {
      fontFamily: '"Bebas Neue", sans-serif',
      fontSize: '40px',
      fontWeight: '400',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      color: '#E8EDF5',
    },
    // Header subtitle
    headerSubtitle: {
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '16px',
      color: '#C8D0DC',
    },
    // Primary submit button
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #FF5C1A, #FF8C42, #FFB347)',
      color: '#F5F8FF',
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '14px',
      fontWeight: '600',
      letterSpacing: '0.01em',
      borderRadius: '100px',
      border: 'none',
      boxShadow: '0 4px 16px rgba(255, 92, 26, 0.35)',
      padding: '12px 24px',
      transition: 'opacity 150ms ease-out',
    },
    // Footer action links
    footerActionLink: {
      color: '#FF8C42',
      fontWeight: '600',
    },
    footerActionText: {
      color: '#C8D0DC',
    },
    // Form input fields
    formFieldInput: {
      background: 'rgba(245, 248, 255, 0.04)',
      border: '1px solid rgba(245, 248, 255, 0.10)',
      borderRadius: '12px',
      color: '#E8EDF5',
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '14px',
    },
    formFieldLabel: {
      fontFamily: '"Space Mono", monospace',
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: '#8A96A8',
    },
    // Social / OAuth provider buttons
    socialButtonsBlockButton: {
      background: 'rgba(245, 248, 255, 0.06)',
      border: '1px solid rgba(245, 248, 255, 0.12)',
      borderRadius: '100px',
      color: '#C8D0DC',
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '14px',
      fontWeight: '600',
    },
    dividerLine: {
      background: 'rgba(245, 248, 255, 0.06)',
    },
    dividerText: {
      color: '#8A96A8',
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '13px',
    },
    // Hide Clerk branding in demo context
    footer: {
      display: 'none',
    },
  },
};
