import type { ReactElement } from 'react';

interface LoadingSpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly label?: string;
  readonly color?: 'primary' | 'secondary' | 'muted';
  readonly decorative?: boolean;
}

const SIZE_MAP: Record<string, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

const COLOR_MAP: Record<string, string> = {
  primary: 'var(--color-action-primary)',
  secondary: 'var(--color-text-secondary)',
  muted: 'var(--color-text-tertiary)',
};

/**
 * LoadingSpinner — design system primitive.
 * SVG circle spinner with stroke-dasharray animation.
 */
export function LoadingSpinner({
  size = 'md',
  label = 'Loading',
  color = 'primary',
  decorative = false,
}: LoadingSpinnerProps): ReactElement {
  const px = SIZE_MAP[size] ?? 24;
  const stroke = COLOR_MAP[color] ?? COLOR_MAP.primary;
  const radius = (px - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * 0.75;

  const svgStyle: React.CSSProperties = {
    animation: 'spin var(--duration-slow) linear infinite',
  };

  return (
    <span
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mmf-spinner { animation-play-state: paused !important; }
        }
      `}</style>
      <svg
        className="mmf-spinner"
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        fill="none"
        style={svgStyle}
        aria-hidden="true"
      >
        {!decorative && <title>{label}…</title>}
        {/* Background track */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          stroke={stroke}
          strokeOpacity="0.2"
          strokeWidth="2"
        />
        {/* Animated arc */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
        />
      </svg>
    </span>
  );
}
