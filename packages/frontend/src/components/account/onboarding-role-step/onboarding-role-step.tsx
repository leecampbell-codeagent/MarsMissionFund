import { type ReactElement, useCallback, useRef, useState } from 'react';
import { Button } from '../../ui/Button';

interface OnboardingRoleStepProps {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

type RoleSelection = 'backer' | 'creator' | 'both' | null;

interface RoleCard {
  readonly id: RoleSelection & string;
  readonly title: string;
  readonly description: string;
  readonly icon: ReactElement;
}

function BackerIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CreatorIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5L19 12L12 19M5 12H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BothIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ROLE_CARDS: RoleCard[] = [
  {
    id: 'backer',
    title: 'Back Missions',
    description: 'Discover and fund projects moving humanity closer to Mars.',
    icon: <BackerIcon />,
  },
  {
    id: 'creator',
    title: 'Create a Campaign',
    description: 'Raise capital for your Mars-enabling technology or mission.',
    icon: <CreatorIcon />,
  },
  {
    id: 'both',
    title: 'Back and Create',
    description: 'Contribute to existing missions and launch your own.',
    icon: <BothIcon />,
  },
];

/**
 * OnboardingRoleStep — Step 2 of the onboarding flow.
 * Informational role selection (does not change backend roles in feat-001).
 */
export function OnboardingRoleStep({ onNext, onBack }: OnboardingRoleStepProps): ReactElement {
  const [selected, setSelected] = useState<RoleSelection>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, cardId: RoleSelection & string) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setSelected(cardId);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const currentIndex = ROLE_CARDS.findIndex((c) => c.id === cardId);
      const nextIndex = (currentIndex + 1) % ROLE_CARDS.length;
      const nextCard = ROLE_CARDS[nextIndex];
      if (nextCard) {
        setSelected(nextCard.id);
        const nextEl = groupRef.current?.querySelector(
          `[data-card-id="${nextCard.id}"]`,
        ) as HTMLElement | null;
        nextEl?.focus();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const currentIndex = ROLE_CARDS.findIndex((c) => c.id === cardId);
      const prevIndex = (currentIndex - 1 + ROLE_CARDS.length) % ROLE_CARDS.length;
      const prevCard = ROLE_CARDS[prevIndex];
      if (prevCard) {
        setSelected(prevCard.id);
        const prevEl = groupRef.current?.querySelector(
          `[data-card-id="${prevCard.id}"]`,
        ) as HTMLElement | null;
        prevEl?.focus();
      }
    }
  }, []);

  return (
    <div>
      <p
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: '11px',
          fontWeight: 400,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--color-text-accent)',
          marginBottom: '16px',
          marginTop: 0,
        }}
      >
        02 — YOUR ROLE
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '56px',
          fontWeight: 400,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-primary)',
          marginBottom: '16px',
          marginTop: 0,
          lineHeight: 1.1,
        }}
      >
        HOW WILL YOU JOIN THE MISSION?
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          marginBottom: '32px',
          marginTop: 0,
        }}
      >
        Tell us how you plan to participate. You can always do both.
      </p>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Select your role"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}
      >
        {ROLE_CARDS.map((card) => {
          const isSelected = selected === card.id;
          return (
            <div
              key={card.id}
              role="radio"
              aria-checked={isSelected}
              data-card-id={card.id}
              tabIndex={0}
              onClick={() => setSelected(card.id)}
              onKeyDown={(e) => handleKeyDown(e, card.id)}
              style={{
                background: isSelected ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
                border: isSelected
                  ? '2px solid var(--color-action-primary)'
                  : '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '24px',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 3px rgba(255,92,26,0.15)' : 'none',
                transition:
                  'background-color var(--motion-hover), border-color var(--motion-hover)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <span
                style={{
                  color: isSelected
                    ? 'var(--color-action-primary-hover)'
                    : 'var(--color-text-secondary)',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {card.icon}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    marginBottom: '4px',
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.7,
                  }}
                >
                  {card.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <Button variant="ghost" onClick={onBack} type="button">
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={selected === null} type="button">
          Continue →
        </Button>
      </div>
    </div>
  );
}
