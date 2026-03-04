import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SignInPage from './sign-in';

// Mock @clerk/clerk-react
vi.mock('@clerk/clerk-react', () => ({
  SignIn: (props: Record<string, unknown>) => (
    <div data-testid="clerk-sign-in" data-path={props.path} data-sign-up-url={props.signUpUrl}>
      ClerkSignIn
    </div>
  ),
}));

describe('SignInPage', () => {
  it('renders the AuthCentreLayout with MMF logo', () => {
    render(<SignInPage />);
    expect(screen.getByText('Mars Mission Fund')).toBeInTheDocument();
  });

  it('renders the Clerk SignIn component', () => {
    render(<SignInPage />);
    const signIn = screen.getByTestId('clerk-sign-in');
    expect(signIn).toBeInTheDocument();
  });

  it('passes correct routing props to Clerk SignIn', () => {
    render(<SignInPage />);
    const signIn = screen.getByTestId('clerk-sign-in');
    expect(signIn).toHaveAttribute('data-path', '/sign-in');
    expect(signIn).toHaveAttribute('data-sign-up-url', '/sign-up');
  });
});
