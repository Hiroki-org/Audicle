import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaylistCompletionScreen } from "../PlaylistCompletionScreen";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("PlaylistCompletionScreen", () => {
  const mockOnReplay = jest.fn();
  const defaultProps = {
    playlistId: "test-playlist-123",
    playlistName: "お気に入り記事",
    totalCount: 5,
    onReplay: mockOnReplay,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders completion message and playlist information correctly", () => {
    render(<PlaylistCompletionScreen {...defaultProps} />);

    expect(screen.getByText("プレイリストの再生が完了しました")).toBeInTheDocument();
    expect(screen.getByText("お気に入り記事")).toBeInTheDocument();
    const completionMessage = screen.getByText(/5記事/, { selector: "p" });
    expect(completionMessage).toBeInTheDocument();
    expect(completionMessage).toHaveTextContent("を聴き終えました");
  });

  it("calls onReplay when 'もう一度聴く' button is clicked", () => {
    render(<PlaylistCompletionScreen {...defaultProps} />);

    const replayButton = screen.getByText("もう一度聴く");
    fireEvent.click(replayButton);

    expect(mockOnReplay).toHaveBeenCalledTimes(1);
  });

  it("navigates to playlist page when 'プレイリストに戻る' button is clicked", () => {
    render(<PlaylistCompletionScreen {...defaultProps} />);

    const backButton = screen.getByText("プレイリストに戻る");
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/playlists/test-playlist-123");
  });
});
