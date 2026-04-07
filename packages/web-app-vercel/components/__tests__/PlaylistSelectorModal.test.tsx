import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlaylistSelectorModal } from "../PlaylistSelectorModal";
import { usePlaylists } from "@/lib/hooks/usePlaylists";
import {
  usePlaylistItemPlaylists,
  useUpdateArticlePlaylistsMutation,
  useArticlePlaylists,
} from "@/lib/hooks/usePlaylistSelection";

// Mock dependencies
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("@/lib/hooks/usePlaylists", () => ({
  usePlaylists: jest.fn(),
}));

jest.mock("@/lib/hooks/usePlaylistSelection", () => ({
  usePlaylistItemPlaylists: jest.fn(),
  useUpdateArticlePlaylistsMutation: jest.fn(),
  useArticlePlaylists: jest.fn(),
}));

const mockAllPlaylists = [
  { id: "playlist-1", name: "Playlist 1", description: "Desc 1", is_default: true },
  { id: "playlist-2", name: "Playlist 2", description: "Desc 2", is_default: false },
  { id: "playlist-3", name: "Playlist 3", description: "", is_default: false },
];

const mockCurrentPlaylists = [
  { id: "playlist-1" },
];

describe("PlaylistSelectorModal", () => {
  const mockOnClose = jest.fn();
  const mockOnPlaylistsUpdated = jest.fn().mockResolvedValue(undefined);
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (usePlaylists as jest.Mock).mockReturnValue({
      data: mockAllPlaylists,
      isLoading: false,
    });

    (usePlaylistItemPlaylists as jest.Mock).mockReturnValue({
      data: mockCurrentPlaylists,
      isLoading: false,
      error: null,
    });

    (useArticlePlaylists as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    (useUpdateArticlePlaylistsMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    itemId: "item-1",
    articleId: "article-1",
    articleTitle: "Test Article Title",
    onPlaylistsUpdated: mockOnPlaylistsUpdated,
  };

  it("renders nothing when isOpen is false", () => {
    render(<PlaylistSelectorModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows loading spinner while fetching playlists", () => {
    (usePlaylists as jest.Mock).mockReturnValue({
      data: [],
      isLoading: true,
    });
    render(<PlaylistSelectorModal {...defaultProps} />);
    expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
    expect(screen.getByText("Test Article Title")).toBeInTheDocument();
    expect(screen.queryByText("プレイリストがありません")).not.toBeInTheDocument();

    // We can also check that the lists aren't rendered
    expect(screen.queryByText("Playlist 1")).not.toBeInTheDocument();
  });

  it("shows empty state message when no playlists exist", () => {
    (usePlaylists as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });
    render(<PlaylistSelectorModal {...defaultProps} />);
    expect(screen.getByText("プレイリストがありません")).toBeInTheDocument();
  });

  it("renders list of playlists correctly with correct initial selection", () => {
    render(<PlaylistSelectorModal {...defaultProps} />);

    // Check titles
    expect(screen.getByText("Playlist 1")).toBeInTheDocument();
    expect(screen.getByText("Playlist 2")).toBeInTheDocument();
    expect(screen.getByText("Playlist 3")).toBeInTheDocument();

    // Check descriptions & default tag
    expect(screen.getByText("Desc 1")).toBeInTheDocument();
    expect(screen.getByText("デフォルト")).toBeInTheDocument();

    // Check checkboxes statuses (Playlist 1 is selected)
    // Testing library requires accessible names. The labels render both the title and the description.
    const checkbox1 = screen.getByLabelText(/Playlist 1/) as HTMLInputElement;
    const checkbox2 = screen.getByLabelText(/Playlist 2/) as HTMLInputElement;

    expect(checkbox1).toBeChecked();
    expect(checkbox2).not.toBeChecked();
  });

  it("toggles playlist selection on click", () => {
    render(<PlaylistSelectorModal {...defaultProps} />);

    const checkbox2 = screen.getByLabelText(/Playlist 2/) as HTMLInputElement;
    expect(checkbox2).not.toBeChecked();

    // Toggle on
    fireEvent.click(checkbox2);
    expect(checkbox2).toBeChecked();

    // Toggle off
    fireEvent.click(checkbox2);
    expect(checkbox2).not.toBeChecked();
  });

  it("calls handleSave with correct differences and triggers onPlaylistsUpdated on success", async () => {
    render(<PlaylistSelectorModal {...defaultProps} />);

    const checkbox2 = screen.getByLabelText(/Playlist 2/);
    const checkbox1 = screen.getByLabelText(/Playlist 1/);

    // Deselect Playlist 1 (initial: true)
    fireEvent.click(checkbox1);

    // Select Playlist 2 (initial: false)
    fireEvent.click(checkbox2);

    const saveButton = screen.getByRole("button", { name: "保存" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        articleId: "article-1",
        addToPlaylistIds: ["playlist-2"],
        removeFromPlaylistIds: ["playlist-1"],
      });
      expect(mockOnPlaylistsUpdated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("calls onPlaylistsUpdated and onClose without saving when there are no changes", async () => {
    render(<PlaylistSelectorModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(mockOnPlaylistsUpdated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("prevents overlay clicks immediately after opening but allows them later", () => {
    jest.useFakeTimers();
    render(<PlaylistSelectorModal {...defaultProps} />);

    const overlay = screen.getByRole("presentation");

    fireEvent.click(overlay);
    expect(mockOnClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("handles mutation error on save", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Mutation failed"));
    render(<PlaylistSelectorModal {...defaultProps} />);

    const checkbox2 = screen.getByLabelText(/Playlist 2/);

    // Select Playlist 2
    fireEvent.click(checkbox2);

    const saveButton = screen.getByRole("button", { name: "保存" });
    fireEvent.click(saveButton);

    // Should display the error
    expect(await screen.findByText("Mutation failed")).toBeInTheDocument();

    // Should NOT close the modal
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockOnPlaylistsUpdated).not.toHaveBeenCalled();
  });

  it("closes modal on Escape key", () => {
    render(<PlaylistSelectorModal {...defaultProps} />);

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("uses articleId when itemId is not provided", () => {
    const propsWithoutItemId = {
      ...defaultProps,
      itemId: undefined,
    };

    (useArticlePlaylists as jest.Mock).mockReturnValue({
      data: [{ id: "playlist-3" }], // This time, playlist 3 is selected for the article
      isLoading: false,
      error: null,
    });

    render(<PlaylistSelectorModal {...propsWithoutItemId} />);

    // Now Playlist 3 should be selected based on article data
    const checkbox3 = screen.getByLabelText(/Playlist 3/) as HTMLInputElement;
    expect(checkbox3).toBeChecked();
  });

  it("shows error when hook fails to load current playlists", () => {
    (usePlaylistItemPlaylists as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to load current items"),
    });

    render(<PlaylistSelectorModal {...defaultProps} />);
    expect(screen.getByText("Failed to load current items")).toBeInTheDocument();
  });
});
