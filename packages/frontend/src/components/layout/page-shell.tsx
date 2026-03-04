import { type ReactElement, type ReactNode } from 'react';

interface PageShellProps {
  readonly children: ReactNode;
}

export function PageShell({ children }: PageShellProps): ReactElement {
  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="page-header">
        <div className="page-header__inner">
          <span className="page-header__logo">MMF</span>
        </div>
      </header>
      <main id="main-content" className="page-main">
        <div className="page-main__inner">{children}</div>
      </main>
      <footer className="page-footer">
        <div className="page-footer__inner">
          <p className="page-footer__text">
            &copy; {new Date().getFullYear()} Mars Mission Fund
          </p>
        </div>
      </footer>
      <style>{`
        .page-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg-page);
          color: var(--color-text-primary);
        }

        .page-header {
          border-bottom: 1px solid var(--color-border-subtle);
          padding: 16px 0;
        }

        .page-header__inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 16px;
        }

        @media (min-width: 640px) {
          .page-header__inner {
            padding: 0 24px;
          }
        }

        @media (min-width: 1024px) {
          .page-header__inner {
            padding: 0 32px;
          }
        }

        .page-header__logo {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
          text-transform: uppercase;
          line-height: 1;
        }

        .page-main {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .page-main__inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 16px;
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 640px) {
          .page-main__inner {
            padding: 0 24px;
          }
        }

        @media (min-width: 1024px) {
          .page-main__inner {
            padding: 0 32px;
          }
        }

        .page-footer {
          border-top: 1px solid var(--color-border-subtle);
          padding: 24px 0;
        }

        .page-footer__inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 16px;
        }

        @media (min-width: 640px) {
          .page-footer__inner {
            padding: 0 24px;
          }
        }

        @media (min-width: 1024px) {
          .page-footer__inner {
            padding: 0 32px;
          }
        }

        .page-footer__text {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-tertiary);
        }
      `}</style>
    </div>
  );
}
