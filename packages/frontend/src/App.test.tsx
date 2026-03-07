import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('@clerk/react', () => ({
  useAuth: vi.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
  })),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignIn: () => <div>SignIn</div>,
  SignUp: () => <div>SignUp</div>,
}));

describe('App', () => {
  it('renders the home page heading when authenticated', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /mars mission fund/i })).toBeInTheDocument();
  });
});
