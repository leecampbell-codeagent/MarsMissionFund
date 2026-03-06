interface LoadingSpinnerProps {
  readonly label?: string;
  readonly size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP: Record<NonNullable<LoadingSpinnerProps['size']>, number> = {
  sm: 24,
  md: 40,
  lg: 56,
};

export function LoadingSpinner({ label = 'Loading', size = 'md' }: LoadingSpinnerProps) {
  const diameter = SIZE_MAP[size];
  const radius = (diameter - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * 0.75;

  return (
    <div
      aria-busy="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}
    >
      <svg
        role="status"
        aria-label={label}
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: 'mmf-spin 800ms linear infinite',
        }}
      >
        <style>{`
          @keyframes mmf-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            svg[role="status"] {
              animation: none !important;
            }
          }
        `}</style>
        {/* Track ring */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          strokeWidth="4"
          stroke="var(--color-progress-track)"
          fill="none"
        />
        {/* Animated arc */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          strokeWidth="4"
          stroke="var(--color-action-primary)"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transformOrigin: 'center' }}
        />
      </svg>
    </div>
  );
}
