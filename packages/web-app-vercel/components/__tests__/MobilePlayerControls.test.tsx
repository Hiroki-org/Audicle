
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobilePlayerControls } from "../MobilePlayerControls";

// Mock child components to isolate the test
jest.mock("@/components/MobileArticleMenu", () => ({
  MobileArticleMenu: () => <div data-testid="mobile-article-menu" />
}));

describe("MobilePlayerControls", () => {
  const defaultProps = {
    playbackRate: 1.0,
    setIsSpeedModalOpen: jest.fn(),
    playlistState: {
      isPlaylistMode: false,
      shuffle: false,
      repeatMode: "off" as const,
    },
    toggleShuffle: jest.fn(),
    isPlaylistContextReady: true,
    canMovePrevious: true,
    canMoveNext: true,
    getPlaylistItemHref: jest.fn().mockImplementation((index) => `/item/${index}`),
    wrapIndex: jest.fn().mockImplementation((index) => index),
    currentPlaylistIndex: 1,
    isPlaying: false,
    play: jest.fn(),
    pause: jest.fn(),
    isPlaybackLoading: false,
    toggleRepeatMode: jest.fn(),
    articleId: "test-article",
    setIsPlaylistModalOpen: jest.fn(),
    url: "https://example.com/test",
    startDownload: jest.fn(),
    downloadStatus: "idle",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders basic controls correctly when not in playlist mode", () => {
    render(<MobilePlayerControls {...defaultProps} />);

    expect(screen.getByTestId("audio-player")).toBeInTheDocument();
    expect(screen.getByTestId("speed-button-mobile")).toHaveTextContent("1.0x");
    expect(screen.getByTestId("play-button")).toBeInTheDocument();
    expect(screen.getByTestId("playlist-add-button")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-article-menu")).toBeInTheDocument();

    // Playlist controls should not be rendered
    expect(screen.queryByTestId("mobile-shuffle-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-repeat-button")).not.toBeInTheDocument();
    expect(screen.queryByTitle("前の記事")).not.toBeInTheDocument();
    expect(screen.queryByTitle("次の記事")).not.toBeInTheDocument();
  });

  it("renders playlist controls when in playlist mode", () => {
    render(<MobilePlayerControls {...defaultProps} playlistState={{...defaultProps.playlistState, isPlaylistMode: true}} />);

    expect(screen.getByTestId("mobile-shuffle-button")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-repeat-button")).toBeInTheDocument();
    expect(screen.getByTitle("前の記事")).toBeInTheDocument();
    expect(screen.getByTitle("次の記事")).toBeInTheDocument();
  });

  it("calls play and pause functions correctly", () => {
    const { rerender } = render(<MobilePlayerControls {...defaultProps} isPlaying={false} />);

    const playButton = screen.getByTestId("play-button");
    fireEvent.click(playButton);
    expect(defaultProps.play).toHaveBeenCalledTimes(1);
    expect(defaultProps.pause).not.toHaveBeenCalled();

    rerender(<MobilePlayerControls {...defaultProps} isPlaying={true} />);

    const pauseButton = screen.getByTestId("pause-button");
    fireEvent.click(pauseButton);
    expect(defaultProps.pause).toHaveBeenCalledTimes(1);
    expect(defaultProps.play).toHaveBeenCalledTimes(1);
  });

  it("shows playback loading state", () => {
    render(<MobilePlayerControls {...defaultProps} isPlaybackLoading={true} />);

    const loadingButton = screen.getByTestId("playback-loading");
    expect(loadingButton).toBeInTheDocument();
    expect(loadingButton).toBeDisabled();
  });

  it("calls speed modal open function", () => {
    render(<MobilePlayerControls {...defaultProps} />);

    fireEvent.click(screen.getByTestId("speed-button-mobile"));
    expect(defaultProps.setIsSpeedModalOpen).toHaveBeenCalledWith(true);
  });

  it("calls playlist modal open function", () => {
    render(<MobilePlayerControls {...defaultProps} />);

    fireEvent.click(screen.getByTestId("playlist-add-button"));
    expect(defaultProps.setIsPlaylistModalOpen).toHaveBeenCalledWith(true);
  });

  it("handles shuffle and repeat toggles in playlist mode", () => {
    render(<MobilePlayerControls {...defaultProps} playlistState={{...defaultProps.playlistState, isPlaylistMode: true}} />);

    fireEvent.click(screen.getByTestId("mobile-shuffle-button"));
    expect(defaultProps.toggleShuffle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("mobile-repeat-button"));
    expect(defaultProps.toggleRepeatMode).toHaveBeenCalledTimes(1);
  });

  it("disables prev/next buttons when context is not ready or cannot move", () => {
    render(<MobilePlayerControls
      {...defaultProps}
      playlistState={{...defaultProps.playlistState, isPlaylistMode: true}}
      isPlaylistContextReady={false}
    />);

    const prevLink = screen.getByTitle("前の記事");
    const nextLink = screen.getByTitle("次の記事");

    expect(prevLink).toHaveAttribute("aria-disabled", "true");
    expect(prevLink).toHaveAttribute("tabIndex", "-1");
    expect(nextLink).toHaveAttribute("aria-disabled", "true");
    expect(nextLink).toHaveAttribute("tabIndex", "-1");
  });

  it("does not render add to playlist button if articleId is null", () => {
    render(<MobilePlayerControls {...defaultProps} articleId={null} />);
    expect(screen.queryByTestId("playlist-add-button")).not.toBeInTheDocument();
  });

  it("does not render mobile menu if url is empty", () => {
    render(<MobilePlayerControls {...defaultProps} url="" />);
    expect(screen.queryByTestId("mobile-article-menu")).not.toBeInTheDocument();
  });
});
