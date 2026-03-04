import { useEffect, type ReactElement } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../hooks/use-api-client';

interface AuthMeResponse {
  readonly id: string;
  readonly onboarding_completed: boolean;
}

/**
 * Dashboard placeholder page.
 * Checks onboarding status and redirects if incomplete.
 */
export default function DashboardPlaceholder(): ReactElement {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const apiClient = useApiClient();

  const { data: account } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient.get<AuthMeResponse>('/api/v1/auth/me'),
    enabled: isLoaded && !!user,
  });

  useEffect(() => {
    if (account && !account.onboarding_completed) {
      void navigate('/onboarding');
    }
  }, [account, navigate]);

  const displayIdentity =
    user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? 'Mission Operative';

  return (
    <section className="dashboard-placeholder">
      <h1 className="dashboard-placeholder__title">WELCOME TO MARS MISSION FUND</h1>
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
