import { UserButton, useAuth } from '@clerk/clerk-react';
import type { ReactElement } from 'react';
import { userButtonAppearance } from '../../lib/clerk-theme';

/**
 * Auth-aware header section.
 * Shows "Sign In" link when signed out, UserButton when signed in.
 * Renders nothing while auth state is loading.
 */
export function HeaderAuthSection(): ReactElement {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="header-auth-section" />;
  }

  if (isSignedIn) {
    return (
      <div className="header-auth-section">
        <UserButton appearance={userButtonAppearance} />
        <style>{headerAuthStyles}</style>
      </div>
    );
  }

  return (
    <div className="header-auth-section">
      <a href="/sign-in" className="header-auth-section__sign-in">
        Sign In
      </a>
      <style>{headerAuthStyles}</style>
    </div>
  );
}

const headerAuthStyles = `
  .header-auth-section {
    display: flex;
    align-items: center;
    min-height: 32px;
  }

  .header-auth-section__sign-in {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--color-action-ghost-text);
    border: 1px solid var(--color-action-ghost-border);
    border-radius: var(--radius-button);
    padding: 8px 20px;
    text-decoration: none;
    transition: background-color var(--motion-hover-duration) var(--motion-hover-easing);
    cursor: pointer;
  }

  .header-auth-section__sign-in:hover {
    background-color: var(--color-bg-elevated);
  }
`;
