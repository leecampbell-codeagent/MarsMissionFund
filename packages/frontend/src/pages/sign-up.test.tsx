import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SignUpPage from './sign-up';

// Mock @clerk/clerk-react
vi.mock('@clerk/clerk-react', () => ({
  SignUp: (props: Record<string, unknown>) => (
    <div data-testid="clerk-sign-up" data-path={props.path} data-sign-in-url={props.signInUrl}>
      ClerkSignUp
    </div>
  ),
}));

describe('SignUpPage', () => {
  it('renders the AuthCentreLayout with MMF logo', () => {
    render(<SignUpPage />);
    expect(screen.getByText('Mars Mission Fund')).toBeInTheDocument();
  });

  it('renders the Clerk SignUp component', () => {
    render(<SignUpPage />);
    const signUp = screen.getByTestId('clerk-sign-up');
    expect(signUp).toBeInTheDocument();
  });

  it('passes correct routing props to Clerk SignUp', () => {
    render(<SignUpPage />);
    const signUp = screen.getByTestId('clerk-sign-up');
    expect(signUp).toHaveAttribute('data-path', '/sign-up');
    expect(signUp).toHaveAttribute('data-sign-in-url', '/sign-in');
  });
});
