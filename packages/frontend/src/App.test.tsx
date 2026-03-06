import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from './App.js';

// Mock @clerk/react so ClerkProvider doesn't need a real publishable key
vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn().mockReturnValue({ isLoaded: false, isSignedIn: false }),
  useClerk: vi.fn().mockReturnValue({ signOut: vi.fn() }),
  useUser: vi.fn().mockReturnValue({ user: null, isLoaded: false, isSignedIn: false }),
}));

// App uses BrowserRouter internally via main.tsx, but in tests we wrap with MemoryRouter.
// App's own Routes need to be inside a Router, and the Header uses useNavigate.
// We render App inside MemoryRouter for test isolation.
function AppWithRouter() {
  return (
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
}

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<AppWithRouter />)).not.toThrow();
  });

  it('renders the header with home link', () => {
    render(<AppWithRouter />);
    expect(screen.getByRole('link', { name: 'Mars Mission Fund — home' })).toBeInTheDocument();
  });
});
