import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import NewCampaignPage from './campaigns-new';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NewCampaignPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NewCampaignPage', () => {
  it('renders LAUNCH YOUR MISSION heading', () => {
    renderWithProviders();
    expect(screen.getByText('LAUNCH YOUR MISSION')).toBeInTheDocument();
  });

  it('renders MISSION OBJECTIVES section', () => {
    renderWithProviders();
    expect(screen.getByRole('heading', { name: /mission objectives/i })).toBeInTheDocument();
  });

  it('renders FUNDING DETAILS section', () => {
    renderWithProviders();
    expect(screen.getByRole('heading', { name: /funding details/i })).toBeInTheDocument();
  });

  it('renders MILESTONE PLAN section', () => {
    renderWithProviders();
    expect(screen.getByRole('heading', { name: /milestone plan/i })).toBeInTheDocument();
  });

  it('renders TEAM & RISK section', () => {
    renderWithProviders();
    expect(screen.getByRole('heading', { name: /team & risk/i })).toBeInTheDocument();
  });

  it('renders SAVE DRAFT button', () => {
    renderWithProviders();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
  });

  it('does not render SUBMIT FOR REVIEW button on new campaign page', () => {
    renderWithProviders();
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
  });

  it('renders campaign title input', () => {
    renderWithProviders();
    expect(screen.getByLabelText(/campaign title/i)).toBeInTheDocument();
  });

  it('renders category select', () => {
    renderWithProviders();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
  });

  it('renders add milestone button', () => {
    renderWithProviders();
    expect(screen.getByRole('button', { name: /add milestone/i })).toBeInTheDocument();
  });
});
