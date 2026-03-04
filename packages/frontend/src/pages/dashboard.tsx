import { type ReactElement } from 'react';
import { useUser } from '@clerk/clerk-react';

/**
 * Dashboard placeholder page.
 * Displays welcome heading and user info.
 */
export default function DashboardPlaceholder(): ReactElement {
  const { user, isLoaded } = useUser();

  const displayIdentity = user?.primaryEmailAddress?.emailAddress
    ?? user?.fullName
    ?? 'Mission Operative';

  return (
    <section className="dashboard-placeholder">
      <h1 className="dashboard-placeholder__title">
        WELCOME TO MARS MISSION FUND
      </h1>
      <p className="dashboard-placeholder__info">
        {isLoaded ? `Signed in as ${displayIdentity}` : '\u2014'}
      </p>
      <style>{`
        .dashboard-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
          padding: 48px 0;
        }

        .dashboard-placeholder__title {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 16px;
        }

        @media (min-width: 640px) {
          .dashboard-placeholder__title {
            font-size: 56px;
          }
        }

        .dashboard-placeholder__info {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
        }
      `}</style>
    </section>
  );
}
