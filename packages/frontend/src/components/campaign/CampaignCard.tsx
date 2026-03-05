import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { CampaignResponse } from '../../api/campaign-api';
import { CampaignStatusBadge } from './CampaignStatusBadge';

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  propulsion: 'PROPULSION',
  entry_descent_landing: 'ENTRY, DESCENT & LANDING',
  power_energy: 'POWER & ENERGY',
  habitats_construction: 'HABITATS & CONSTRUCTION',
  life_support_crew_health: 'LIFE SUPPORT & CREW HEALTH',
  food_water_production: 'FOOD & WATER PRODUCTION',
  isru: 'ISRU',
  radiation_protection: 'RADIATION PROTECTION',
  robotics_automation: 'ROBOTICS & AUTOMATION',
  communications_navigation: 'COMMUNICATIONS & NAVIGATION',
};

interface CampaignCardProps {
  readonly campaign: CampaignResponse;
}

export function CampaignCard({ campaign }: CampaignCardProps): ReactElement {
  const formattedMin = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(campaign.min_funding_target_cents) / 100);

  const isDraft = campaign.status === 'draft';

  return (
    <>
      <article className="campaign-card">
        <div className="campaign-card__header">
          <span className="campaign-card__category">
            {CATEGORY_LABELS[campaign.category] ?? campaign.category.toUpperCase()}
          </span>
          <CampaignStatusBadge status={campaign.status} />
        </div>

        <h2 className="campaign-card__title">{campaign.title}</h2>

        {campaign.summary && (
          <p className="campaign-card__summary">{campaign.summary}</p>
        )}

        <div className="campaign-card__meta">
          <div className="campaign-card__meta-item">
            <span className="campaign-card__meta-label">MIN TARGET</span>
            <span className="campaign-card__meta-value">{formattedMin}</span>
          </div>

          {campaign.deadline && (
            <div className="campaign-card__meta-item">
              <span className="campaign-card__meta-label">DEADLINE</span>
              <span className="campaign-card__meta-value">
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                  new Date(campaign.deadline),
                )}
              </span>
            </div>
          )}
        </div>

        <div className="campaign-card__actions">
          {isDraft ? (
            <Link
              to={`/campaigns/${campaign.id}/edit`}
              className="campaign-card__action-btn campaign-card__action-btn--primary"
              aria-label={`Edit draft: ${campaign.title}`}
            >
              EDIT DRAFT
            </Link>
          ) : (
            <Link
              to={`/campaigns/${campaign.id}/edit`}
              className="campaign-card__action-btn campaign-card__action-btn--secondary"
              aria-label={`View campaign: ${campaign.title}`}
            >
              VIEW
            </Link>
          )}
        </div>
      </article>

      <style>{`
        .campaign-card {
          background: var(--gradient-surface-card, linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%));
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-card, 12px);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.2s ease;
        }

        .campaign-card:hover {
          border-color: var(--color-border-emphasis, rgba(255, 92, 26, 0.3));
        }

        .campaign-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .campaign-card__category {
          font-family: var(--font-data);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: var(--color-text-tertiary);
        }

        .campaign-card__title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          line-height: 1.1;
          margin: 0;
        }

        .campaign-card__summary {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 0;
          /* Clamp to 2 lines */
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .campaign-card__meta {
          display: flex;
          gap: 24px;
          margin-top: 4px;
        }

        .campaign-card__meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .campaign-card__meta-label {
          font-family: var(--font-data);
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--color-text-tertiary);
        }

        .campaign-card__meta-value {
          font-family: var(--font-data);
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .campaign-card__actions {
          margin-top: 8px;
          display: flex;
          gap: 8px;
        }

        .campaign-card__action-btn {
          display: inline-block;
          font-family: var(--font-data);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          padding: 8px 20px;
          border-radius: var(--radius-button);
          text-decoration: none;
          transition: opacity 0.15s ease;
        }

        .campaign-card__action-btn--primary {
          background: var(--gradient-action-primary);
          color: var(--color-action-primary-text);
          box-shadow: 0 2px 8px var(--color-action-primary-shadow);
        }

        .campaign-card__action-btn--secondary {
          background: transparent;
          border: 1px solid var(--color-border-input);
          color: var(--color-text-secondary);
        }

        .campaign-card__action-btn:hover {
          opacity: 0.85;
        }
      `}</style>
    </>
  );
}
