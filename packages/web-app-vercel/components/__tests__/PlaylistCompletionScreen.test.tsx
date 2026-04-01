import { render, screen, fireEvent } from "@testing-library/react";
import { PlaylistCompletionScreen } from "../PlaylistCompletionScreen";
import { useRouter } from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

describe("PlaylistCompletionScreen", () => {
  const mockPush = jest.fn();
  const mockOnReplay = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  const defaultProps = {
    playlistId: "test-playlist-123",
    playlistName: "お気に入り記事",
    totalCount: 5,
    onReplay: mockOnReplay,
  };

  it("renders correctly with provided props", () => {
    render(<PlaylistCompletionScreen {...defaultProps} />);

    // Check heading
    expect(screen.getByText("プレイリストの再生が完了しました")).toBeInTheDocument();

    // Check playlist details
    expect(screen.getByText("お気に入り記事")).toBeInTheDocument();
    expect(screen.getByText(/5記事/)).toBeInTheDocument();

    // Check buttons
    expect(screen.getByRole("button", { name: "もう一度聴く" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "プレイリストに戻る" })).toBeInTheDocument();
  });

  it("calls onReplay when 'もう一度聴く' button is clicked", () => {
    render(<PlaylistCompletionScreen {...defaultProps} />);

    const replayButton = screen.getByRole("button", { name: "もう一度聴く" });
    fireEvent.click(replayButton);

    expect(mockOnReplay).toHaveBeenCalledTimes(1);
  });

  it("navigates to playlist page when 'プレイリストに戻る' button is clicked", () => {
    render(<PlaylistCompletionScreen {...defaultProps} />);

    const backButton = screen.getByRole("button", { name: "プレイリストに戻る" });
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/playlists/${defaultProps.playlistId}`);
  });
});
