import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { CampaignCard } from '../components/campaign/CampaignCard';
import { useMyCampaigns } from '../hooks/campaign/use-my-campaigns';

export default function MyCampaignsPage(): ReactElement {
  const { data, isLoading, isError } = useMyCampaigns();

  if (isLoading) {
    return (
      <div className="campaigns-page">
        <div className="campaigns-page__header">
          <div>
            <div className="skeleton skeleton--label" />
            <div className="skeleton skeleton--heading" />
          </div>
        </div>
        <div className="campaigns-grid">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--card" />
          ))}
        </div>
        <style>{`
          .campaigns-page {
            display: flex;
            justify-content: center;
            flex: 1;
            padding: 24px 0;
          }
          .campaigns-page__header { max-width: 900px; width: 100%; }
          .campaigns-grid { max-width: 900px; width: 100%; margin-top: 24px; }
          .skeleton { background: var(--color-bg-input); border-radius: var(--radius-input); animation: skel-pulse 1.5s ease-in-out infinite alternate; }
          .skeleton--label { height: 14px; width: 100px; margin-bottom: 16px; }
          .skeleton--heading { height: 56px; width: 300px; margin-bottom: 32px; }
          .skeleton--card { height: 200px; width: 100%; margin-bottom: 16px; border-radius: 12px; }
          @keyframes skel-pulse { from { opacity: 0.5; } to { opacity: 1; } }
          @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; opacity: 0.7; } }
        `}</style>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="campaigns-page">
        <div className="campaigns-page__content">
          <p className="campaigns-section-label">MY CAMPAIGNS</p>
          <h1 className="campaigns-heading">MISSION CONTROL</h1>
          <div className="campaigns-error" role="alert">
            Failed to load campaigns. Please try again.
          </div>
        </div>
        <CampaignsPageStyle />
      </div>
    );
  }

  const campaigns = data ?? [];

  return (
    <div className="campaigns-page">
      <div className="campaigns-page__content">
        <div className="campaigns-page__header">
          <div>
            <p className="campaigns-section-label">MY CAMPAIGNS</p>
            <h1 className="campaigns-heading">MISSION CONTROL</h1>
          </div>
          <Link to="/campaigns/new" className="campaigns-new-btn" aria-label="Create new campaign">
            + NEW CAMPAIGN
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="campaigns-empty">
            <h2 className="campaigns-empty__heading">NO MISSIONS YET</h2>
            <p className="campaigns-empty__body">
              Your path to Mars starts with a single proposal.
            </p>
            <Link to="/campaigns/new" className="campaigns-empty__cta">
              START A CAMPAIGN
            </Link>
          </div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
      <CampaignsPageStyle />
    </div>
  );
}

function CampaignsPageStyle(): ReactElement {
  return (
    <style>{`
      .campaigns-page {
        display: flex;
        justify-content: center;
        flex: 1;
        padding: 24px 16px;
      }

      @media (min-width: 768px) {
        .campaigns-page { padding: 32px 24px; }
      }

      @media (min-width: 1024px) {
        .campaigns-page { padding: 48px 32px; }
      }

      .campaigns-page__content {
        max-width: 900px;
        width: 100%;
      }

      .campaigns-page__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 32px;
        gap: 16px;
        flex-wrap: wrap;
      }

      .campaigns-section-label {
        font-family: var(--font-data);
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: var(--color-text-accent);
        margin-bottom: 12px;
      }

      .campaigns-heading {
        font-family: var(--font-display);
        font-size: 48px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-primary);
        line-height: 1;
        margin: 0;
      }

      @media (min-width: 640px) {
        .campaigns-heading { font-size: 64px; }
      }

      .campaigns-new-btn {
        display: inline-block;
        font-family: var(--font-data);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.1em;
        padding: 12px 24px;
        background: var(--gradient-action-primary);
        color: var(--color-action-primary-text);
        border-radius: var(--radius-button);
        text-decoration: none;
        box-shadow: 0 4px 16px var(--color-action-primary-shadow);
        transition: opacity 0.15s ease;
        white-space: nowrap;
        align-self: flex-start;
        margin-top: 8px;
      }

      .campaigns-new-btn:hover {
        opacity: 0.9;
      }

      .campaigns-error {
        background: rgba(193, 68, 14, 0.1);
        border: 1px solid var(--color-status-error);
        border-radius: var(--radius-input);
        padding: 16px;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--color-status-error);
      }

      .campaigns-empty {
        text-align: center;
        padding: 80px 24px;
      }

      .campaigns-empty__heading {
        font-family: var(--font-display);
        font-size: 40px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-primary);
        margin-bottom: 16px;
      }

      .campaigns-empty__body {
        font-family: var(--font-body);
        font-size: 16px;
        color: var(--color-text-secondary);
        margin-bottom: 32px;
      }

      .campaigns-empty__cta {
        display: inline-block;
        font-family: var(--font-body);
        font-size: 15px;
        font-weight: 600;
        padding: 14px 40px;
        background: var(--gradient-action-primary);
        color: var(--color-action-primary-text);
        border-radius: var(--radius-button);
        text-decoration: none;
        box-shadow: 0 4px 20px var(--color-action-primary-shadow);
        transition: opacity 0.15s ease;
      }

      .campaigns-empty__cta:hover {
        opacity: 0.9;
      }

      .campaigns-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }

      @media (min-width: 640px) {
        .campaigns-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `}</style>
  );
}
