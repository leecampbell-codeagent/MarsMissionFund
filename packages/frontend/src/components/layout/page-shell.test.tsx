import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageShell } from './page-shell';

// Mock @clerk/clerk-react — PageShell now includes HeaderAuthSection which uses useAuth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  UserButton: () => <div data-testid="clerk-user-button">UserButton</div>,
}));

describe('PageShell', () => {
  it('renders children in the main content area', () => {
    render(
      <PageShell>
        <p>Test content</p>
      </PageShell>,
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders a skip-to-content link as the first focusable element', () => {
    render(
      <PageShell>
        <p>Content</p>
      </PageShell>,
    );

    const skipLink = screen.getByText('Skip to content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(skipLink.tagName).toBe('A');
  });

  it('renders semantic header landmark', () => {
    render(
      <PageShell>
        <p>Content</p>
      </PageShell>,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders semantic main landmark with correct id', () => {
    render(
      <PageShell>
        <p>Content</p>
      </PageShell>,
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');
  });

  it('renders semantic footer landmark', () => {
    render(
      <PageShell>
        <p>Content</p>
      </PageShell>,
    );

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the MMF logo placeholder text', () => {
    render(
      <PageShell>
        <p>Content</p>
      </PageShell>,
    );

    expect(screen.getByText('MMF')).toBeInTheDocument();
  });

  it('renders copyright text in the footer', () => {
    render(
      <PageShell>
        <p>Content</p>
      </PageShell>,
    );

    const year = new Date().getFullYear();
    expect(screen.getByText(`\u00A9 ${year} Mars Mission Fund`)).toBeInTheDocument();
  });
});
