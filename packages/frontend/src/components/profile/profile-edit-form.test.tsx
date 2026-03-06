import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ProfileEditForm } from './profile-edit-form.js';

vi.mock('../../hooks/use-update-profile.js', () => ({
  useUpdateProfile: vi.fn(),
}));

import { useUpdateProfile } from '../../hooks/use-update-profile.js';

const mockUseUpdateProfile = vi.mocked(useUpdateProfile);
const mockMutate = vi.fn();

describe('ProfileEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateProfile.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateProfile>);
  });

  it('renders display name and bio fields', () => {
    render(<ProfileEditForm initialDisplayName={null} initialBio={null} />);

    expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Bio')).toBeInTheDocument();
  });

  it('populates fields with initial values', () => {
    render(<ProfileEditForm initialDisplayName="Test User" initialBio="My bio" />);

    expect(screen.getByLabelText('Display Name')).toHaveValue('Test User');
    expect(screen.getByLabelText('Bio')).toHaveValue('My bio');
  });

  it('shows bio char counter', () => {
    render(<ProfileEditForm initialDisplayName={null} initialBio="Hello" />);

    expect(screen.getByText('5/500')).toBeInTheDocument();
  });

  it('calls mutate on form submit', async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm initialDisplayName="Jane" initialBio="" />);

    await user.click(screen.getByRole('button', { name: 'SAVE CHANGES' }));

    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it('shows loading spinner when pending', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateProfile>);

    render(<ProfileEditForm initialDisplayName={null} initialBio={null} />);

    expect(screen.getByRole('status', { name: 'Saving' })).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows error message on failure', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: new Error('Update failed'),
    } as unknown as ReturnType<typeof useUpdateProfile>);

    render(<ProfileEditForm initialDisplayName={null} initialBio={null} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Update failed')).toBeInTheDocument();
  });

  it('does not call mutate when display name is whitespace-only', async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm initialDisplayName={null} initialBio={null} />);

    const nameInput = screen.getByRole('textbox', { name: /display name/i });
    await user.type(nameInput, '   ');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockMutate).not.toHaveBeenCalled();
  });
});
