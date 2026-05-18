import { render, screen, fireEvent } from '@testing-library/react';
import { PlaylistItemRow } from '../PlaylistItemRow';
import type { PlaylistWithItems } from '@/types/playlist';

const mockPlaylist: PlaylistWithItems = {
  id: 'test-playlist-id',
  owner_email: 'user@example.com',
  name: 'Test Playlist',
  description: 'Test Description',
  visibility: 'private',
  is_default: false,
  allow_fork: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  items: []
};

describe('PlaylistItemRow', () => {
  it('renders correctly', () => {
    const mockOnToggle = jest.fn();
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText('Test Playlist')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.queryByText('デフォルト')).not.toBeInTheDocument();
  });

  it('renders default badge when is_default is true', () => {
    const mockOnToggle = jest.fn();
    const defaultPlaylist = { ...mockPlaylist, is_default: true };
    render(
      <PlaylistItemRow
        playlist={defaultPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText('デフォルト')).toBeInTheDocument();
  });

  it('calls onToggle when checkbox is clicked', () => {
    const mockOnToggle = jest.fn();
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockOnToggle).toHaveBeenCalledWith('test-playlist-id');
  });

  it('does not call onToggle when isSaving is true', () => {
    const mockOnToggle = jest.fn();
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={true}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockOnToggle).not.toHaveBeenCalled();
    expect(checkbox).toBeDisabled();
  });

  it('shows checkbox as checked when isSelected is true', () => {
    const mockOnToggle = jest.fn();
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={true}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});
