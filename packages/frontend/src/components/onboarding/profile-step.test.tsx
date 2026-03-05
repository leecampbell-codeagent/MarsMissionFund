import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileStep } from './profile-step';

describe('ProfileStep', () => {
  const defaultProps = {
    displayName: '',
    bio: '',
    avatarUrl: '',
    onDisplayNameChange: vi.fn(),
    onBioChange: vi.fn(),
    onAvatarUrlChange: vi.fn(),
    onContinue: vi.fn(),
    onSkip: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders the heading', () => {
    render(<ProfileStep {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SET UP YOUR PROFILE');
  });

  it('renders display name input with label', () => {
    render(<ProfileStep {...defaultProps} />);
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
  });

  it('renders bio textarea with label', () => {
    render(<ProfileStep {...defaultProps} />);
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
  });

  it('renders avatar URL input with label', () => {
    render(<ProfileStep {...defaultProps} />);
    expect(screen.getByLabelText(/avatar url/i)).toBeInTheDocument();
  });

  it('calls onDisplayNameChange when display name is typed', async () => {
    const user = userEvent.setup();
    const onDisplayNameChange = vi.fn();
    render(<ProfileStep {...defaultProps} onDisplayNameChange={onDisplayNameChange} />);
    await user.type(screen.getByLabelText(/display name/i), 'Jane');
    expect(onDisplayNameChange).toHaveBeenCalled();
  });

  it('calls onBioChange when bio is typed', async () => {
    const user = userEvent.setup();
    const onBioChange = vi.fn();
    render(<ProfileStep {...defaultProps} onBioChange={onBioChange} />);
    await user.type(screen.getByLabelText(/bio/i), 'Hello');
    expect(onBioChange).toHaveBeenCalled();
  });

  it('shows char count for bio', () => {
    render(<ProfileStep {...defaultProps} bio="hello world" />);
    expect(screen.getByText('11 / 500')).toBeInTheDocument();
  });

  it('shows field-level error for displayName', () => {
    render(
      <ProfileStep
        {...defaultProps}
        errors={{ displayName: 'Display name is required.' }}
      />,
    );
    expect(screen.getByText('Display name is required.')).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('calls onSkip when Skip is clicked', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<ProfileStep {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<ProfileStep {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onContinue when form is submitted', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<ProfileStep {...defaultProps} onContinue={onContinue} />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows loading state on Continue button', () => {
    render(<ProfileStep {...defaultProps} isLoading />);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});
