import type { ReactElement, ReactNode } from 'react';

interface AuthCentreLayoutProps {
  readonly children: ReactNode;
}

/**
 * Centred layout wrapper for auth pages (sign-in, sign-up).
 * Displays the MMF logo text above the Clerk component.
 */
export function AuthCentreLayout({ children }: AuthCentreLayoutProps): ReactElement {
  return (
    <div className="auth-centre-layout">
      <p className="auth-centre-layout__logo">Mars Mission Fund</p>
      {children}
      <style>{`
        .auth-centre-layout {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          flex: 1;
          padding-top: 32px;
          padding-bottom: 48px;
        }

        @media (min-width: 768px) {
          .auth-centre-layout {
            padding-top: 48px;
          }
        }

        @media (min-width: 1024px) {
          .auth-centre-layout {
            padding-top: 80px;
          }
        }

        .auth-centre-layout__logo {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
          text-transform: uppercase;
          margin-bottom: 32px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}
