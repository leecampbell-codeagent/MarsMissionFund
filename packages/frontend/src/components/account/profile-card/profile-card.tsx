import { type ReactElement, useState } from 'react';
import { type UserProfile } from '../../../api/account-api';

interface ProfileCardProps {
  readonly user: UserProfile | null;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
}

function getInitials(displayName: string | null, email: string): string {
  if (displayName && displayName.trim().length > 0) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    }
    return (parts[0]?.[0] ?? '').toUpperCase();
  }
  const localPart = email.split('@')[0] ?? '';
  return (localPart[0] ?? '').toUpperCase();
}

type RoleBadgeVariant = 'backer' | 'creator' | 'reviewer' | 'administrator' | 'super_administrator';

function RoleBadge({ role }: { readonly role: RoleBadgeVariant }): ReactElement {
  const badgeConfig: Record<RoleBadgeVariant, { bg: string; color: string; border: string; dot: string; label: string }> = {
    backer: {
      bg: 'var(--color-status-new-bg)',
      color: 'var(--color-text-secondary)',
      border: 'var(--color-status-new-border)',
      dot: 'var(--color-status-new)',
      label: 'Backer',
    },
    creator: {
      bg: 'var(--color-status-active-bg)',
      color: 'var(--color-action-primary-hover)',
      border: 'var(--color-status-active-border)',
      dot: 'var(--color-status-active)',
      label: 'Creator',
    },
    reviewer: {
      bg: 'var(--color-bg-elevated)',
      color: 'var(--color-text-secondary)',
      border: 'var(--color-border-subtle)',
      dot: 'var(--color-text-tertiary)',
      label: 'Reviewer',
    },
    administrator: {
      bg: 'var(--color-bg-elevated)',
      color: 'var(--color-text-secondary)',
      border: 'var(--color-border-subtle)',
      dot: 'var(--color-text-tertiary)',
      label: 'Administrator',
    },
    super_administrator: {
      bg: 'var(--color-bg-elevated)',
      color: 'var(--color-text-secondary)',
      border: 'var(--color-border-subtle)',
      dot: 'var(--color-text-tertiary)',
      label: 'Super Admin',
    },
  };

  const config = badgeConfig[role];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        borderRadius: 'var(--radius-badge)',
        padding: '6px 12px',
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: config.dot,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

function KycBadge({ status }: { readonly status: UserProfile['kycStatus'] }): ReactElement | null {
  if (status === 'not_started') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255, 179, 71, 0.12)',
          color: 'var(--color-status-warning)',
          border: '1px solid rgba(255, 179, 71, 0.2)',
          borderRadius: 'var(--radius-badge)',
          padding: '6px 12px',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        Identity verification pending
      </span>
    );
  }
  return null;
}

function AccountStatusBadge({ status }: { readonly status: UserProfile['accountStatus'] }): ReactElement {
  const config: Record<UserProfile['accountStatus'], { bg: string; color: string; border: string; label: string }> = {
    active: {
      bg: 'var(--color-status-success-bg)',
      color: 'var(--color-status-success)',
      border: 'var(--color-status-success-border)',
      label: 'Active',
    },
    pending_verification: {
      bg: 'rgba(255, 179, 71, 0.12)',
      color: 'var(--color-status-warning)',
      border: 'rgba(255, 179, 71, 0.2)',
      label: 'Pending verification',
    },
    suspended: {
      bg: 'rgba(193, 68, 14, 0.12)',
      color: 'var(--color-status-error)',
      border: 'rgba(193, 68, 14, 0.2)',
      label: 'Suspended',
    },
    deactivated: {
      bg: 'var(--color-bg-elevated)',
      color: 'var(--color-text-tertiary)',
      border: 'var(--color-border-subtle)',
      label: 'Deactivated',
    },
  };

  const cfg = config[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        borderRadius: 'var(--radius-badge)',
        padding: '4px 10px',
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      {cfg.label}
    </span>
  );
}

function SkeletonBlock({
  width,
  height,
  borderRadius = '4px',
  circle = false,
}: {
  readonly width: string | number;
  readonly height: string | number;
  readonly borderRadius?: string;
  readonly circle?: boolean;
}): ReactElement {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : borderRadius,
        background: 'var(--color-bg-elevated)',
        animation: 'skeletonPulse 2s ease-in-out infinite',
      }}
    />
  );
}

/**
 * ProfileCard — displays user profile data.
 * Handles loading skeleton, error state, and populated state.
 */
export function ProfileCard({ user, isLoading = false, isError = false }: ProfileCardProps): ReactElement {
  const [imgError, setImgError] = useState(false);

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-card)',
    padding: '32px',
    position: 'relative',
    overflow: 'hidden',
  };

  const topAccentStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, var(--color-border-accent), var(--color-status-warning))',
  };

  if (isError) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}
        >
          We couldn&apos;t load your profile.
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--color-text-secondary)',
            marginBottom: '24px',
          }}
        >
          Try signing in again.
        </p>
        <a
          href="/sign-in"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--color-action-secondary-bg)',
            color: 'var(--color-action-secondary-text)',
            border: '1px solid var(--color-action-secondary-border)',
            borderRadius: 'var(--radius-button)',
            padding: '12px 24px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Sign in →
        </a>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div
        style={cardStyle}
        aria-busy="true"
        aria-label="Loading profile"
      >
        <div style={topAccentStyle} />
        <style>{`
          @keyframes skeletonPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes skeletonPulse {
              0%, 100% { opacity: 0.7; }
            }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonBlock width={80} height={80} circle />
          <SkeletonBlock width={160} height={24} />
          <SkeletonBlock width={120} height={14} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <SkeletonBlock width={60} height={20} />
            <SkeletonBlock width={60} height={20} />
          </div>
        </div>
      </div>
    );
  }

  const showInitials = !user.avatarUrl || imgError;
  const initials = getInitials(user.displayName, user.email);

  return (
    <div style={cardStyle}>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
      <div style={topAccentStyle} />

      {/* Avatar */}
      {showInitials ? (
        <div
          role="img"
          aria-label={`${initials} avatar`}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            color: 'var(--color-text-primary)',
            userSelect: 'none',
          }}
          aria-hidden={false}
        >
          {initials}
        </div>
      ) : (
        <img
          src={user.avatarUrl ?? ''}
          alt={user.displayName ? `${user.displayName}'s avatar` : 'Profile avatar'}
          width={80}
          height={80}
          onError={() => setImgError(true)}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: 'var(--radius-full)',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Name */}
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '24px',
          fontWeight: 700,
          color: user.displayName ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          marginTop: '16px',
        }}
      >
        {user.displayName ?? user.email}
      </div>

      {/* Email */}
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--color-text-tertiary)',
          marginTop: '4px',
        }}
      >
        {user.email}
      </div>

      {/* Role badges */}
      {user.roles.length > 0 && (
        <div
          role="group"
          aria-label="Assigned roles"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}
        >
          {user.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      )}

      {/* KYC badge */}
      <div style={{ marginTop: '8px' }}>
        <KycBadge status={user.kycStatus} />
      </div>

      {/* Divider */}
      <div
        style={{
          height: '1px',
          background: 'var(--color-border-subtle)',
          margin: '24px 0',
        }}
      />

      {/* Account status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-text-tertiary)',
          }}
        >
          ACCOUNT STATUS
        </span>
        <AccountStatusBadge status={user.accountStatus} />
      </div>
    </div>
  );
}




























