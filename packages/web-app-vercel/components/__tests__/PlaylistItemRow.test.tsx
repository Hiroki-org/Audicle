import { render, screen, fireEvent } from "@testing-library/react";
import { PlaylistItemRow } from "../PlaylistItemRow";
import { PlaylistWithItems } from "@/types/playlist";

const mockPlaylist: PlaylistWithItems = {
  id: "test-playlist-1",
  owner_email: "test@example.com",
  name: "Test Playlist",
  description: "Test description",
  visibility: "private",
  is_default: false,
  allow_fork: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("PlaylistItemRow", () => {
  const mockOnToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders playlist name and description correctly", () => {
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText("Test Playlist")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.queryByText("デフォルト")).not.toBeInTheDocument();
  });

  it("renders without description", () => {
    const playlistWithoutDesc = { ...mockPlaylist, description: undefined };
    render(
      <PlaylistItemRow
        playlist={playlistWithoutDesc}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText("Test Playlist")).toBeInTheDocument();
    expect(screen.queryByText("Test description")).not.toBeInTheDocument();
  });

  it("renders default badge when is_default is true", () => {
    const defaultPlaylist = { ...mockPlaylist, is_default: true };
    render(
      <PlaylistItemRow
        playlist={defaultPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText("デフォルト")).toBeInTheDocument();
  });

  it("calls onToggle with playlist.id when checkbox is clicked", () => {
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith(mockPlaylist.id);
  });

  it("calls onToggle when label is clicked", () => {
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    const label = screen.getByText("Test Playlist");
    fireEvent.click(label);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith(mockPlaylist.id);
  });

  it("reflects isSelected prop in checkbox checked state", () => {
    const { rerender } = render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={true}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();

    rerender(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={false}
        onToggle={mockOnToggle}
      />
    );

    expect(checkbox).not.toBeChecked();
  });

  it("disables checkbox and prevents onToggle when isSaving is true", () => {
    render(
      <PlaylistItemRow
        playlist={mockPlaylist}
        isSelected={false}
        isSaving={true}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();

    fireEvent.click(checkbox);
    expect(mockOnToggle).not.toHaveBeenCalled();

    const label = screen.getByText("Test Playlist");
    fireEvent.click(label);
    expect(mockOnToggle).not.toHaveBeenCalled();
  });
});
