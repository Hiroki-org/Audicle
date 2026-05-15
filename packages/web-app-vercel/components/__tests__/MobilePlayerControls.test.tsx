
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MobilePlayerControls,
  type MobilePlayerControlsProps,
} from "../MobilePlayerControls";

const mockMobileArticleMenu = jest.fn((props) => (
  <div
    data-testid="mobile-article-menu"
    data-is-downloading={String(props.isDownloading)}
  />
));

// Mock child components to isolate the test
jest.mock("@/components/MobileArticleMenu", () => ({
  MobileArticleMenu: (props: { isDownloading: boolean }) =>
    mockMobileArticleMenu(props),
}));

describe("MobilePlayerControls", () => {
  const createDefaultProps = (): MobilePlayerControlsProps => ({
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders basic controls correctly when not in playlist mode", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} />);

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
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} playlistState={{...props.playlistState, isPlaylistMode: true}} />);

    expect(screen.getByTestId("mobile-shuffle-button")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-repeat-button")).toBeInTheDocument();
    const prevLink = screen.getByTitle("前の記事");
    const nextLink = screen.getByTitle("次の記事");

    expect(prevLink).toHaveAttribute("aria-disabled", "false");
    expect(prevLink).toHaveAttribute("href", "/item/0");
    expect(nextLink).toHaveAttribute("aria-disabled", "false");
    expect(nextLink).toHaveAttribute("href", "/item/2");
  });

  it("calls play and pause functions correctly", () => {
    const props = createDefaultProps();
    const { rerender } = render(<MobilePlayerControls {...props} isPlaying={false} />);

    const playButton = screen.getByTestId("play-button");
    fireEvent.click(playButton);
    expect(props.play).toHaveBeenCalledTimes(1);

    rerender(<MobilePlayerControls {...props} isPlaying={true} />);

    const pauseButton = screen.getByTestId("pause-button");
    fireEvent.click(pauseButton);
    expect(props.pause).toHaveBeenCalledTimes(1);
  });

  it("shows playback loading state", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} isPlaybackLoading={true} />);

    const loadingButton = screen.getByTestId("playback-loading");
    expect(loadingButton).toBeInTheDocument();
    expect(loadingButton).toBeDisabled();
  });

  it("calls speed modal open function", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} />);

    fireEvent.click(screen.getByTestId("speed-button-mobile"));
    expect(props.setIsSpeedModalOpen).toHaveBeenCalledWith(true);
  });

  it("calls playlist modal open function", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} />);

    fireEvent.click(screen.getByTestId("playlist-add-button"));
    expect(props.setIsPlaylistModalOpen).toHaveBeenCalledWith(true);
  });

  it("handles shuffle and repeat toggles in playlist mode", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} playlistState={{...props.playlistState, isPlaylistMode: true}} />);

    fireEvent.click(screen.getByTestId("mobile-shuffle-button"));
    expect(props.toggleShuffle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("mobile-repeat-button"));
    expect(props.toggleRepeatMode).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "playlist context is not ready",
      overrides: { isPlaylistContextReady: false },
    },
    {
      name: "movement is unavailable",
      overrides: { canMovePrevious: false, canMoveNext: false },
    },
    {
      name: "playlist hrefs are unavailable",
      overrides: { getPlaylistItemHref: jest.fn().mockReturnValue(undefined) },
    },
  ])("disables prev/next buttons when $name", ({ overrides }) => {
    const props = createDefaultProps();
    render(
      <MobilePlayerControls
        {...props}
        {...overrides}
        playlistState={{...props.playlistState, isPlaylistMode: true}}
      />
    );

    const prevLink = screen.getByTitle("前の記事");
    const nextLink = screen.getByTitle("次の記事");

    expect(prevLink).toHaveAttribute("aria-disabled", "true");
    expect(nextLink).toHaveAttribute("aria-disabled", "true");
  });

  it("does not render add to playlist button if articleId is null", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} articleId={null} />);
    expect(screen.queryByTestId("playlist-add-button")).not.toBeInTheDocument();
  });

  it("does not render mobile menu if url is empty", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} url="" />);
    expect(screen.queryByTestId("mobile-article-menu")).not.toBeInTheDocument();
  });

  it("passes downloading state to the mobile article menu", () => {
    const props = createDefaultProps();
    render(<MobilePlayerControls {...props} downloadStatus="downloading" />);

    expect(screen.getByTestId("mobile-article-menu")).toHaveAttribute(
      "data-is-downloading",
      "true"
    );
    expect(mockMobileArticleMenu).toHaveBeenCalledWith(
      expect.objectContaining({ isDownloading: true })
    );
  });
});
