import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoleSelectionStep } from './role-selection-step';

describe('RoleSelectionStep', () => {
  const defaultProps = {
    selectedRole: 'backer' as const,
    onRoleChange: vi.fn(),
    onContinue: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders the heading', () => {
    render(<RoleSelectionStep {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CHOOSE YOUR ROLE');
  });

  it('renders three role options', () => {
    render(<RoleSelectionStep {...defaultProps} />);
    expect(screen.getByRole('radio', { name: /backer/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /creator/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /both/i })).toBeInTheDocument();
  });

  it('marks the selected role as checked', () => {
    render(<RoleSelectionStep {...defaultProps} selectedRole="creator" />);
    expect(screen.getByRole('radio', { name: /creator/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /backer/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('calls onRoleChange when a role card is clicked', async () => {
    const user = userEvent.setup();
    const onRoleChange = vi.fn();
    render(<RoleSelectionStep {...defaultProps} onRoleChange={onRoleChange} />);
    await user.click(screen.getByRole('radio', { name: /creator/i }));
    expect(onRoleChange).toHaveBeenCalledWith('creator');
  });

  it('shows KYC callout when creator is selected', () => {
    render(<RoleSelectionStep {...defaultProps} selectedRole="creator" />);
    expect(screen.getByRole('status')).toHaveTextContent(/identity verification/i);
  });

  it('shows KYC callout when both is selected', () => {
    render(<RoleSelectionStep {...defaultProps} selectedRole="both" />);
    expect(screen.getByRole('status')).toHaveTextContent(/identity verification/i);
  });

  it('hides KYC callout when backer is selected', () => {
    render(<RoleSelectionStep {...defaultProps} selectedRole="backer" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('calls onBack when Back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<RoleSelectionStep {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onContinue when Continue is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<RoleSelectionStep {...defaultProps} onContinue={onContinue} />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows loading state on Continue button', () => {
    render(<RoleSelectionStep {...defaultProps} isLoading />);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('shows error message when provided', () => {
    render(<RoleSelectionStep {...defaultProps} error="Something went wrong." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('uses radiogroup role on the cards container', () => {
    render(<RoleSelectionStep {...defaultProps} />);
    expect(screen.getByRole('radiogroup', { name: 'Select your role' })).toBeInTheDocument();
  });
});
