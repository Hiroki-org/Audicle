import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobilePlayerControls } from "../MobilePlayerControls";
import type { RepeatMode } from "@/contexts/PlaylistPlaybackContext";

// --- Mock Components ---
// Mock lucide-react icons so they don't break the tests or add clutter
jest.mock("lucide-react", () => ({
  Play: () => <div data-testid="icon-play">Play</div>,
  Pause: () => <div data-testid="icon-pause">Pause</div>,
  SkipBack: () => <div data-testid="icon-skip-back">SkipBack</div>,
  SkipForward: () => <div data-testid="icon-skip-forward">SkipForward</div>,
  Plus: () => <div data-testid="icon-plus">Plus</div>,
  Repeat: () => <div data-testid="icon-repeat">Repeat</div>,
  Repeat1: () => <div data-testid="icon-repeat1">Repeat1</div>,
  Shuffle: () => <div data-testid="icon-shuffle">Shuffle</div>,
}));

// Mock MobileArticleMenu
jest.mock("@/components/MobileArticleMenu", () => ({
  MobileArticleMenu: ({
    articleUrl,
    onDownload,
    isDownloading,
  }: {
    articleUrl: string;
    onDownload: () => void;
    isDownloading: boolean;
  }) => (
    <div data-testid="mock-mobile-article-menu">
      <span data-testid="menu-url">{articleUrl}</span>
      <button
        data-testid="menu-download-btn"
        onClick={onDownload}
        disabled={isDownloading}
      >
        Download
      </button>
    </div>
  ),
}));

describe("MobilePlayerControls", () => {
  const defaultProps = {
    playbackRate: 1.0,
    setIsSpeedModalOpen: jest.fn(),
    playlistState: {
      isPlaylistMode: true,
      shuffle: false,
      repeatMode: "off" as RepeatMode,
    },
    toggleShuffle: jest.fn(),
    isPlaylistContextReady: true,
    canMovePrevious: true,
    canMoveNext: true,
    getPlaylistItemHref: jest.fn((index) => `/playlist/item/${index}`),
    wrapIndex: jest.fn((index) => index),
    currentPlaylistIndex: 1,
    isPlaying: false,
    play: jest.fn(),
    pause: jest.fn(),
    isPlaybackLoading: false,
    toggleRepeatMode: jest.fn(),
    articleId: "article-123",
    setIsPlaylistModalOpen: jest.fn(),
    url: "https://example.com/article",
    startDownload: jest.fn(),
    downloadStatus: "idle",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with default props", () => {
    render(<MobilePlayerControls {...defaultProps} />);

    // Speed button
    const speedButton = screen.getByTestId("speed-button-mobile");
    expect(speedButton).toBeInTheDocument();
    expect(speedButton).toHaveTextContent("1.0x");

    // Shuffle button
    const shuffleButton = screen.getByTestId("mobile-shuffle-button");
    expect(shuffleButton).toBeInTheDocument();

    // Previous button
    const prevLink = screen.getByRole("link", { name: "前の記事" });
    expect(prevLink).toBeInTheDocument();
    expect(prevLink).toHaveAttribute("href", "/playlist/item/0");

    // Play/Pause button
    const playButton = screen.getByTestId("play-button");
    expect(playButton).toBeInTheDocument();
    expect(screen.getByTestId("icon-play")).toBeInTheDocument();

    // Next button
    const nextLink = screen.getByRole("link", { name: "次の記事" });
    expect(nextLink).toBeInTheDocument();
    expect(nextLink).toHaveAttribute("href", "/playlist/item/2");

    // Repeat button
    const repeatButton = screen.getByTestId("mobile-repeat-button");
    expect(repeatButton).toBeInTheDocument();

    // Playlist Add button
    const playlistAddButton = screen.getByTestId("playlist-add-button");
    expect(playlistAddButton).toBeInTheDocument();

    // MobileArticleMenu
    const mobileArticleMenu = screen.getByTestId("mock-mobile-article-menu");
    expect(mobileArticleMenu).toBeInTheDocument();
  });

  it("calls setIsSpeedModalOpen when speed button is clicked", () => {
    render(<MobilePlayerControls {...defaultProps} />);
    fireEvent.click(screen.getByTestId("speed-button-mobile"));
    expect(defaultProps.setIsSpeedModalOpen).toHaveBeenCalledWith(true);
  });

  it("calls play when play button is clicked and not playing", () => {
    render(<MobilePlayerControls {...defaultProps} isPlaying={false} />);
    fireEvent.click(screen.getByTestId("play-button"));
    expect(defaultProps.play).toHaveBeenCalled();
  });

  it("calls pause when pause button is clicked and is playing", () => {
    render(<MobilePlayerControls {...defaultProps} isPlaying={true} />);
    const pauseButton = screen.getByTestId("pause-button");
    fireEvent.click(pauseButton);
    expect(defaultProps.pause).toHaveBeenCalled();
    expect(screen.getByTestId("icon-pause")).toBeInTheDocument();
  });

  it("disables play/pause button when isPlaybackLoading is true", () => {
    render(<MobilePlayerControls {...defaultProps} isPlaybackLoading={true} />);
    const loadingButton = screen.getByTestId("playback-loading");
    expect(loadingButton).toBeDisabled();
  });

  it("calls toggleShuffle when shuffle button is clicked", () => {
    render(<MobilePlayerControls {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mobile-shuffle-button"));
    expect(defaultProps.toggleShuffle).toHaveBeenCalled();
  });

  it("calls toggleRepeatMode when repeat button is clicked", () => {
    render(<MobilePlayerControls {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mobile-repeat-button"));
    expect(defaultProps.toggleRepeatMode).toHaveBeenCalled();
  });

  it("renders different icon based on repeat mode", () => {
    const { rerender } = render(
      <MobilePlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, repeatMode: "one" }}
      />,
    );
    expect(screen.getByTestId("icon-repeat1")).toBeInTheDocument();

    rerender(
      <MobilePlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, repeatMode: "all" }}
      />,
    );
    expect(screen.getByTestId("icon-repeat")).toBeInTheDocument();
  });

  it("calls setIsPlaylistModalOpen when playlist add button is clicked", () => {
    render(<MobilePlayerControls {...defaultProps} />);
    fireEvent.click(screen.getByTestId("playlist-add-button"));
    expect(defaultProps.setIsPlaylistModalOpen).toHaveBeenCalledWith(true);
  });

  it("does not render playlist add button if articleId is null", () => {
    render(<MobilePlayerControls {...defaultProps} articleId={null} />);
    expect(screen.queryByTestId("playlist-add-button")).not.toBeInTheDocument();
  });

  it("does not render playlist controls if isPlaylistMode is false", () => {
    render(
      <MobilePlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, isPlaylistMode: false }}
      />,
    );
    expect(
      screen.queryByTestId("mobile-shuffle-button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "前の記事" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "次の記事" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("mobile-repeat-button"),
    ).not.toBeInTheDocument();
  });

  it("disables previous and next buttons correctly based on props", () => {
    const props = {
      ...defaultProps,
      canMovePrevious: false,
      canMoveNext: false,
    };
    render(<MobilePlayerControls {...props} />);

    const prevLink = screen.getByRole("link", { name: "前の記事" });
    const nextLink = screen.getByRole("link", { name: "次の記事" });

    expect(prevLink).toHaveAttribute("aria-disabled", "true");
    expect(nextLink).toHaveAttribute("aria-disabled", "true");

    expect(prevLink).toHaveClass("opacity-50", "cursor-not-allowed");
  });

  it("prevents default event on click when previous button is disabled", () => {
    const props = {
      ...defaultProps,
      canMovePrevious: false,
    };
    render(<MobilePlayerControls {...props} />);
    const prevLink = screen.getByRole("link", { name: "前の記事" });

    // Create a mock event with preventDefault
    let preventDefaultCalled = false;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    clickEvent.preventDefault = jest.fn(() => {
      preventDefaultCalled = true;
    });

    // Dispatch the custom event
    fireEvent(prevLink, clickEvent);

    expect(preventDefaultCalled).toBe(true);
  });

  it("prevents default event on click when next button is disabled", () => {
    const props = {
      ...defaultProps,
      canMoveNext: false,
    };
    render(<MobilePlayerControls {...props} />);
    const nextLink = screen.getByRole("link", { name: "次の記事" });

    // Create a mock event with preventDefault
    let preventDefaultCalled = false;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    clickEvent.preventDefault = jest.fn(() => {
      preventDefaultCalled = true;
    });

    // Dispatch the custom event
    fireEvent(nextLink, clickEvent);

    expect(preventDefaultCalled).toBe(true);
  });

  it("does not prevent default event on click when previous button is enabled", () => {
    const props = {
      ...defaultProps,
      canMovePrevious: true,
    };
    render(<MobilePlayerControls {...props} />);
    const prevLink = screen.getByRole("link", { name: "前の記事" });

    // Create a mock event with preventDefault
    let preventDefaultCalled = false;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    clickEvent.preventDefault = jest.fn(() => {
      preventDefaultCalled = true;
    });

    // Dispatch the custom event
    fireEvent(prevLink, clickEvent);

    expect(preventDefaultCalled).toBe(false);
  });

  it("does not prevent default event on click when next button is enabled", () => {
    const props = {
      ...defaultProps,
      canMoveNext: true,
    };
    render(<MobilePlayerControls {...props} />);
    const nextLink = screen.getByRole("link", { name: "次の記事" });

    // Create a mock event with preventDefault
    let preventDefaultCalled = false;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    clickEvent.preventDefault = jest.fn(() => {
      preventDefaultCalled = true;
    });

    // Dispatch the custom event
    fireEvent(nextLink, clickEvent);

    expect(preventDefaultCalled).toBe(false);
  });

  it("passes correct props to MobileArticleMenu and handles download logic correctly", () => {
    render(<MobilePlayerControls {...defaultProps} downloadStatus="idle" />);
    const downloadBtn = screen.getByTestId("menu-download-btn");

    fireEvent.click(downloadBtn);
    expect(defaultProps.startDownload).toHaveBeenCalled();
  });

  it("shows download button as disabled when downloadStatus is downloading", () => {
    render(
      <MobilePlayerControls {...defaultProps} downloadStatus="downloading" />,
    );
    const downloadBtn = screen.getByTestId("menu-download-btn");
    expect(downloadBtn).toBeDisabled();
  });

  it("renders correctly with shuffle on", () => {
    render(
      <MobilePlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, shuffle: true }}
      />,
    );
    const shuffleButton = screen.getByTestId("mobile-shuffle-button");
    expect(shuffleButton).toHaveAttribute("title", "シャッフル: オン");
    expect(shuffleButton).toHaveClass("text-green-500");
  });

  it("does not render MobileArticleMenu if url is empty", () => {
    render(<MobilePlayerControls {...defaultProps} url="" />);
    expect(
      screen.queryByTestId("mock-mobile-article-menu"),
    ).not.toBeInTheDocument();
  });

  it("uses # as href for previous and next links when getPlaylistItemHref returns undefined", () => {
    const props = {
      ...defaultProps,
      getPlaylistItemHref: jest.fn(() => undefined),
    };
    render(<MobilePlayerControls {...props} />);

    const prevLink = screen.getByRole("link", { name: "前の記事" });
    const nextLink = screen.getByRole("link", { name: "次の記事" });

    expect(prevLink).toHaveAttribute("href", "#");
    expect(nextLink).toHaveAttribute("href", "#");
  });
});
