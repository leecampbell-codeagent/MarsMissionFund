import { type ReactElement } from 'react';
import { NavLink } from 'react-router-dom';

interface SettingsNavProps {
  readonly activeRoute: string;
}

interface NavItem {
  readonly path: string;
  readonly label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/settings/profile', label: 'Profile' },
  { path: '/settings/notifications', label: 'Notifications' },
];

/**
 * SettingsNav — sidebar navigation for settings pages.
 * Desktop: sticky left sidebar. Tablet: horizontal tab bar. Mobile: hidden.
 * Implements design spec SettingsNav component.
 */
export function SettingsNav({ activeRoute }: SettingsNavProps): ReactElement {
  return (
    <>
      <style>{`
        .settings-nav-desktop {
          display: block;
        }
        .settings-nav-tablet {
          display: none;
        }
        @media (max-width: 1023px) and (min-width: 768px) {
          .settings-nav-desktop { display: none; }
          .settings-nav-tablet { display: block; }
        }
        @media (max-width: 767px) {
          .settings-nav-desktop { display: none; }
          .settings-nav-tablet { display: none; }
        }
        .settings-nav-link {
          display: block;
          padding: 10px 16px;
          border-radius: var(--radius-badge);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-decoration: none;
          border-left: 2px solid transparent;
          transition: background-color var(--motion-hover);
        }
        .settings-nav-link:hover {
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
        }
        .settings-nav-link.active {
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
          border-left: 2px solid var(--color-border-accent);
          padding-left: 14px;
        }
        .settings-nav-tab {
          display: inline-block;
          padding: 10px 16px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-decoration: none;
          border-bottom: 2px solid transparent;
          transition: color var(--motion-hover);
        }
        .settings-nav-tab.active {
          color: var(--color-text-primary);
          border-bottom: 2px solid var(--color-action-primary);
        }
        .settings-nav-tab:hover:not(.active) {
          color: var(--color-text-primary);
        }
      `}</style>

      {/* Desktop sidebar */}
      <nav className="settings-nav-desktop" aria-label="Settings navigation">
        <div
          style={{
            width: '220px',
            position: 'sticky',
            top: '24px',
            paddingRight: '32px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--color-text-tertiary)',
              marginBottom: '16px',
            }}
          >
            SETTINGS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `settings-nav-link${isActive ? ' active' : ''}`
                }
                aria-current={activeRoute === item.path ? 'page' : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Tablet tab bar */}
      <nav
        className="settings-nav-tablet"
        aria-label="Settings navigation"
        style={{
          borderBottom: '1px solid var(--color-border-subtle)',
          marginBottom: '24px',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `settings-nav-tab${isActive ? ' active' : ''}`
            }
            aria-current={activeRoute === item.path ? 'page' : undefined}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}




























