import { type ReactElement, type ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'success';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly children: ReactNode;
  readonly className?: string;
  readonly onClick?: () => void;
  readonly 'aria-label'?: string;
  readonly 'aria-disabled'?: boolean;
}

const BASE_STYLES: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  borderRadius: 'var(--radius-button)',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: '14px',
  letterSpacing: '0.01em',
  cursor: 'pointer',
  border: 'none',
  transition: 'opacity var(--motion-hover), box-shadow var(--motion-hover)',
  textDecoration: 'none',
};

const SIZE_STYLES: Record<string, React.CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '12px' },
  md: { padding: '12px 24px', fontSize: '14px' },
  lg: { padding: '14px 28px', fontSize: '16px' },
};

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: {
    background: 'var(--gradient-action-primary)',
    color: 'var(--color-action-primary-text)',
    boxShadow: '0 0 20px var(--color-action-primary-shadow)',
  },
  secondary: {
    background: 'var(--color-action-secondary-bg)',
    color: 'var(--color-action-secondary-text)',
    border: '1px solid var(--color-action-secondary-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-action-ghost-text)',
    border: '1px solid var(--color-action-ghost-border)',
  },
  success: {
    background: 'var(--color-status-success-bg)',
    color: 'var(--color-status-success)',
    border: '1px solid var(--color-status-success-border)',
  },
};

const DISABLED_STYLES: React.CSSProperties = {
  background: 'var(--color-action-disabled)',
  color: 'rgba(138, 150, 168, 0.8)',
  boxShadow: 'none',
  cursor: 'not-allowed',
  border: 'none',
  opacity: 0.6,
};

/**
 * Button — design system primitive.
 * Implements L2-001 Section 3.1 button specifications exactly.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  type = 'button',
  children,
  className,
  onClick,
  'aria-label': ariaLabel,
  'aria-disabled': ariaDisabled,
}: ButtonProps): ReactElement {
  const isDisabled = disabled || isLoading;

  const style: React.CSSProperties = {
    ...BASE_STYLES,
    ...SIZE_STYLES[size],
    ...(isDisabled ? DISABLED_STYLES : VARIANT_STYLES[variant]),
  };

  return (
    <button
      type={type}
      style={style}
      className={className}
      disabled={isDisabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-disabled={ariaDisabled ?? isDisabled}
    >
      {isLoading && (
        <LoadingSpinner size="sm" decorative label="Loading" />
      )}
      {children}
    </button>
  );
}




























