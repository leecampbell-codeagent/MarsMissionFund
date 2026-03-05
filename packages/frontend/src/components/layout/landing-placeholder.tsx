import type { ReactElement } from 'react';

export function LandingPlaceholder(): ReactElement {
  return (
    <section className="landing-placeholder">
      <h1 className="landing-placeholder__title">MARS MISSION FUND</h1>
      <p className="landing-placeholder__subtitle">Crowdfunding the Next Giant Leap</p>
      <style>{`
        .landing-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
          padding: 48px 0;
        }

        .landing-placeholder__title {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.03em;
          color: var(--color-text-primary);
          text-transform: uppercase;
          line-height: 1;
          margin: 0 0 24px 0;
        }

        @media (min-width: 640px) {
          .landing-placeholder__title {
            font-size: 56px;
          }
        }

        @media (min-width: 1024px) {
          .landing-placeholder__title {
            font-size: 80px;
          }
        }

        @media (min-width: 1280px) {
          .landing-placeholder__title {
            font-size: 96px;
          }
        }

        .landing-placeholder__subtitle {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin: 0;
        }
      `}</style>
    </section>
  );
}
