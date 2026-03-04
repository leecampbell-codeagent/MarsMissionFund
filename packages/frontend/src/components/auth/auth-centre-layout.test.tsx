import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthCentreLayout } from './auth-centre-layout';

describe('AuthCentreLayout', () => {
  it('renders the MMF logo text', () => {
    render(
      <AuthCentreLayout>
        <div>child content</div>
      </AuthCentreLayout>,
    );
    expect(screen.getByText('Mars Mission Fund')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <AuthCentreLayout>
        <div data-testid="child">test child</div>
      </AuthCentreLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('logo text is not a heading element', () => {
    render(
      <AuthCentreLayout>
        <div>content</div>
      </AuthCentreLayout>,
    );
    const logo = screen.getByText('Mars Mission Fund');
    expect(logo.tagName).toBe('P');
  });
});
