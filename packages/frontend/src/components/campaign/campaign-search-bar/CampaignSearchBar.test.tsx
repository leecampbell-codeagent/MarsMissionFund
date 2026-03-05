import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignSearchBar } from './CampaignSearchBar';

describe('CampaignSearchBar', () => {
  it('renders search input', () => {
    const onChange = vi.fn();
    render(<CampaignSearchBar value="" onChange={onChange} />);
    expect(screen.getByRole('searchbox', { name: 'Search campaigns' })).toBeInTheDocument();
  });

  it('displays the current value', () => {
    const onChange = vi.fn();
    render(<CampaignSearchBar value="propulsion" onChange={onChange} />);
    expect(screen.getByDisplayValue('propulsion')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    render(<CampaignSearchBar value="" onChange={onChange} />);
    const input = screen.getByRole('searchbox', { name: 'Search campaigns' });
    await userEvent.type(input, 'hab');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows clear button when value is non-empty', () => {
    const onChange = vi.fn();
    render(<CampaignSearchBar value="nuclear" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('does not show clear button when value is empty', () => {
    const onChange = vi.fn();
    render(<CampaignSearchBar value="" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('calls onChange with empty string when clear button is clicked', async () => {
    const onChange = vi.fn();
    render(<CampaignSearchBar value="nuclear propulsion" onChange={onChange} />);
    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    await userEvent.click(clearButton);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('uses custom placeholder when provided', () => {
    const onChange = vi.fn();
    render(<CampaignSearchBar value="" onChange={onChange} placeholder="Find a mission" />);
    expect(screen.getByPlaceholderText('Find a mission')).toBeInTheDocument();
  });
});
