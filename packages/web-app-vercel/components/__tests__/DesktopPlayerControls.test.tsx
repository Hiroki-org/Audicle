import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesktopPlayerControls } from "../DesktopPlayerControls";

// プレイリストのモック関数を準備
const mockWrapIndex = jest.fn((index) => index);
const mockGetPlaylistItemHref = jest.fn((index) => `/playlist/${index}`);

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
  getPlaylistItemHref: mockGetPlaylistItemHref,
  wrapIndex: mockWrapIndex,
  currentPlaylistIndex: 1,
  isPlaying: false,
  play: jest.fn(),
  pause: jest.fn(),
  isPlaybackLoading: false,
  toggleRepeatMode: jest.fn(),
  articleId: "article-1",
  setIsPlaylistModalOpen: jest.fn(),
  url: "https://example.com/article",
  startDownload: jest.fn(),
  downloadStatus: "idle",
};

describe("DesktopPlayerControls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with default state", () => {
    render(<DesktopPlayerControls {...defaultProps} />);

    // 再生速度ボタンが表示されていること
    expect(screen.getByTestId("speed-button")).toHaveTextContent("1.0x");

    // 再生ボタンが表示されていること
    expect(screen.getByTestId("play-button")).toBeInTheDocument();

    // プレイリスト追加ボタンが表示されていること
    expect(screen.getByTestId("playlist-add-button")).toBeInTheDocument();

    // 外部リンクターゲットが表示されていること
    const externalLink = screen.getByTitle("元記事を開く");
    expect(externalLink).toBeInTheDocument();
    expect(externalLink).toHaveAttribute("href", defaultProps.url);
    expect(externalLink).toHaveAttribute("target", "_blank");
    expect(externalLink).toHaveAttribute("rel", "noreferrer");

    // ダウンロードボタンが表示されていること
    expect(screen.getByTestId("download-button")).toBeInTheDocument();

    // プレイリストモードでない場合はシャッフル、前へ、次へ、リピートが表示されないこと
    expect(screen.queryByTestId("desktop-shuffle-button")).toBeNull();
    expect(screen.queryByTestId("desktop-prev-button")).toBeNull();
    expect(screen.queryByTestId("desktop-next-button")).toBeNull();
    expect(screen.queryByTestId("desktop-repeat-button")).toBeNull();
  });

  it("calls play function when play button is clicked", async () => {
    const user = userEvent.setup();
    render(<DesktopPlayerControls {...defaultProps} />);

    const playButton = screen.getByTestId("play-button");
    await user.click(playButton);

    expect(defaultProps.play).toHaveBeenCalledTimes(1);
    expect(defaultProps.pause).not.toHaveBeenCalled();
  });

  it("calls pause function when pause button is clicked while playing", async () => {
    const user = userEvent.setup();
    render(<DesktopPlayerControls {...defaultProps} isPlaying={true} />);

    const pauseButton = screen.getByTestId("pause-button");
    await user.click(pauseButton);

    expect(defaultProps.pause).toHaveBeenCalledTimes(1);
    expect(defaultProps.play).not.toHaveBeenCalled();
  });

  it("disables play/pause button when loading", () => {
    render(<DesktopPlayerControls {...defaultProps} isPlaybackLoading={true} />);

    const loadingButton = screen.getByTestId("playback-loading");
    expect(loadingButton).toBeDisabled();
  });

  it("renders playlist controls when in playlist mode", () => {
    render(
      <DesktopPlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }}
      />
    );

    expect(screen.getByTestId("desktop-shuffle-button")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-prev-button")).toHaveAttribute("href", "/playlist/0");
    expect(screen.getByTestId("desktop-next-button")).toHaveAttribute("href", "/playlist/2");
    expect(screen.getByTestId("desktop-repeat-button")).toBeInTheDocument();
  });

  it("marks shuffle button as active when shuffle is enabled", () => {
    render(
      <DesktopPlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true, shuffle: true }}
      />
    );

    const shuffleButton = screen.getByTestId("desktop-shuffle-button");
    expect(shuffleButton).toHaveClass("text-green-500");
    expect(shuffleButton).toHaveAttribute("aria-label", "シャッフル: オン");
    expect(shuffleButton).toHaveAttribute("title", "シャッフル: オン");
  });

  it("calls correct functions when playlist controls are clicked", async () => {
    const user = userEvent.setup();
    render(
      <DesktopPlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }}
      />
    );

    await user.click(screen.getByTestId("desktop-shuffle-button"));
    expect(defaultProps.toggleShuffle).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("desktop-repeat-button"));
    expect(defaultProps.toggleRepeatMode).toHaveBeenCalledTimes(1);
  });

  it("disables previous and next buttons when conditions are not met", () => {
    render(
      <DesktopPlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }}
        canMovePrevious={false}
        canMoveNext={false}
      />
    );

    const prevButton = screen.getByTestId("desktop-prev-button");
    const nextButton = screen.getByTestId("desktop-next-button");

    expect(prevButton).toHaveAttribute("aria-disabled", "true");
    expect(prevButton).toHaveClass("cursor-not-allowed");

    expect(nextButton).toHaveAttribute("aria-disabled", "true");
    expect(nextButton).toHaveClass("cursor-not-allowed");
  });

  it("prevents default behavior when clicking disabled prev/next links", () => {
    render(
      <DesktopPlayerControls
        {...defaultProps}
        playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }}
        canMovePrevious={false}
        canMoveNext={false}
      />
    );

    const prevButton = screen.getByTestId("desktop-prev-button");

    // Keep a reference to the dispatched event so defaultPrevented can be asserted.
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    fireEvent(prevButton, clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it("calls set speed modal open when speed button is clicked", async () => {
    const user = userEvent.setup();
    render(<DesktopPlayerControls {...defaultProps} />);

    await user.click(screen.getByTestId("speed-button"));
    expect(defaultProps.setIsSpeedModalOpen).toHaveBeenCalledWith(true);
  });

  it("calls set playlist modal open when add button is clicked", async () => {
    const user = userEvent.setup();
    render(<DesktopPlayerControls {...defaultProps} />);

    await user.click(screen.getByTestId("playlist-add-button"));
    expect(defaultProps.setIsPlaylistModalOpen).toHaveBeenCalledWith(true);
  });

  it("does not render add to playlist button if articleId is null", () => {
    render(<DesktopPlayerControls {...defaultProps} articleId={null} />);
    expect(screen.queryByTestId("playlist-add-button")).toBeNull();
  });

  it("calls startDownload when download button is clicked", async () => {
    const user = userEvent.setup();
    render(<DesktopPlayerControls {...defaultProps} />);

    await user.click(screen.getByTestId("download-button"));
    expect(defaultProps.startDownload).toHaveBeenCalledTimes(1);
  });

  it("disables download button when downloadStatus is downloading", () => {
    render(<DesktopPlayerControls {...defaultProps} downloadStatus="downloading" />);

    expect(screen.getByTestId("download-button")).toBeDisabled();
  });
});
