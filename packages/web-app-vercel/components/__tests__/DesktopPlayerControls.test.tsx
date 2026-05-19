import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesktopPlayerControls, DesktopPlayerControlsProps } from "../DesktopPlayerControls";

// Mock the zIndex to avoid issues with undefined references during test execution
jest.mock("@/lib/zIndex", () => ({
  zIndex: {
    desktopControls: 50,
  },
}));

describe("DesktopPlayerControls", () => {
  const defaultProps: DesktopPlayerControlsProps = {
    playbackRate: 1.0,
    setIsSpeedModalOpen: jest.fn(),
    playlistState: {
      isPlaylistMode: false,
      shuffle: false,
      repeatMode: "off",
    },
    toggleShuffle: jest.fn(),
    isPlaylistContextReady: true,
    canMovePrevious: true,
    canMoveNext: true,
    getPlaylistItemHref: jest.fn((index) => `/item/${index}`),
    wrapIndex: jest.fn((index) => index),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the player controls", () => {
      render(<DesktopPlayerControls {...defaultProps} />);
      expect(screen.getByTestId("audio-player-desktop")).toBeInTheDocument();
    });

    it("should render playback speed", () => {
      render(<DesktopPlayerControls {...defaultProps} playbackRate={1.5} />);
      expect(screen.getByText("1.5x")).toBeInTheDocument();
    });

    it("should render play button when not playing", () => {
      render(<DesktopPlayerControls {...defaultProps} isPlaying={false} />);
      expect(screen.getByTestId("play-button")).toBeInTheDocument();
      expect(screen.queryByTestId("pause-button")).not.toBeInTheDocument();
    });

    it("should render pause button when playing", () => {
      render(<DesktopPlayerControls {...defaultProps} isPlaying={true} />);
      expect(screen.getByTestId("pause-button")).toBeInTheDocument();
      expect(screen.queryByTestId("play-button")).not.toBeInTheDocument();
    });

    it("should render loading state", () => {
      render(<DesktopPlayerControls {...defaultProps} isPlaybackLoading={true} />);
      expect(screen.getByTestId("playback-loading")).toBeInTheDocument();
      expect(screen.getByTestId("playback-loading")).toBeDisabled();
    });

    it("should not render playlist controls if not in playlist mode", () => {
      render(<DesktopPlayerControls {...defaultProps} playlistState={{ ...defaultProps.playlistState, isPlaylistMode: false }} />);
      expect(screen.queryByTestId("desktop-shuffle-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("desktop-prev-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("desktop-next-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("desktop-repeat-button")).not.toBeInTheDocument();
    });


    it("should have correct href for previous and next links", () => {
      render(<DesktopPlayerControls {...defaultProps} playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }} />);
      expect(screen.getByTestId("desktop-prev-button")).toHaveAttribute("href", "/item/0");
      expect(screen.getByTestId("desktop-next-button")).toHaveAttribute("href", "/item/2");
    });

    it("should render playlist controls if in playlist mode", () => {
      render(<DesktopPlayerControls {...defaultProps} playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }} />);
      expect(screen.getByTestId("desktop-shuffle-button")).toBeInTheDocument();
      expect(screen.getByTestId("desktop-prev-button")).toBeInTheDocument();
      expect(screen.getByTestId("desktop-next-button")).toBeInTheDocument();
      expect(screen.getByTestId("desktop-repeat-button")).toBeInTheDocument();
    });

    it("should reflect enabled shuffle state in labels and styling", () => {
      render(
        <DesktopPlayerControls
          {...defaultProps}
          playlistState={{
            ...defaultProps.playlistState,
            isPlaylistMode: true,
            shuffle: true,
          }}
        />,
      );

      const shuffleButton = screen.getByTestId("desktop-shuffle-button");
      expect(shuffleButton).toHaveAttribute("title", "シャッフル: オン");
      expect(shuffleButton).toHaveAttribute("aria-label", "シャッフル: オン");
      expect(shuffleButton).toHaveClass("text-green-500");
    });

    it("should reflect repeat one state in labels, styling, and icon", () => {
      render(
        <DesktopPlayerControls
          {...defaultProps}
          playlistState={{
            ...defaultProps.playlistState,
            isPlaylistMode: true,
            repeatMode: "one",
          }}
        />,
      );

      const repeatButton = screen.getByTestId("desktop-repeat-button");
      expect(repeatButton).toHaveAttribute("title", "リピート: 1曲");
      expect(repeatButton).toHaveAttribute("aria-label", "リピート: 1曲");
      expect(repeatButton).toHaveClass("text-green-500");
      expect(repeatButton.querySelector("svg")).toHaveClass("lucide-repeat-1");
    });

    it("should reflect repeat all state in labels and active styling", () => {
      render(
        <DesktopPlayerControls
          {...defaultProps}
          playlistState={{
            ...defaultProps.playlistState,
            isPlaylistMode: true,
            repeatMode: "all",
          }}
        />,
      );

      const repeatButton = screen.getByTestId("desktop-repeat-button");
      expect(repeatButton).toHaveAttribute("title", "リピート: 全曲");
      expect(repeatButton).toHaveAttribute("aria-label", "リピート: 全曲");
      expect(repeatButton).toHaveClass("text-green-500");
      expect(repeatButton.querySelector("svg")).toHaveClass("lucide-repeat");
    });

    it("should render add to playlist button if articleId is provided", () => {
      render(<DesktopPlayerControls {...defaultProps} articleId="test-id" />);
      expect(screen.getByTestId("playlist-add-button")).toBeInTheDocument();
    });

    it("should not render add to playlist button if articleId is null", () => {
      render(<DesktopPlayerControls {...defaultProps} articleId={null} />);
      expect(screen.queryByTestId("playlist-add-button")).not.toBeInTheDocument();
    });

    it("should render open original article button if url is provided", () => {
      render(<DesktopPlayerControls {...defaultProps} url="https://test.com" />);
      expect(screen.getByTitle("元記事を開く")).toBeInTheDocument();
    });

    it("should not render open original article button if url is empty", () => {
      render(<DesktopPlayerControls {...defaultProps} url="" />);
      expect(screen.queryByTitle("元記事を開く")).not.toBeInTheDocument();
    });

    it("should disable download button when downloadStatus is 'downloading'", () => {
      render(<DesktopPlayerControls {...defaultProps} downloadStatus="downloading" />);
      expect(screen.getByTestId("download-button")).toBeDisabled();
    });
  });

  describe("Interactions", () => {
    it("should call setIsSpeedModalOpen when clicking speed button", async () => {
      const user = userEvent.setup();
      render(<DesktopPlayerControls {...defaultProps} />);
      await user.click(screen.getByTestId("speed-button"));
      expect(defaultProps.setIsSpeedModalOpen).toHaveBeenCalledWith(true);
    });

    it("should call play when clicking play button", async () => {
      const user = userEvent.setup();
      render(<DesktopPlayerControls {...defaultProps} isPlaying={false} />);
      await user.click(screen.getByTestId("play-button"));
      expect(defaultProps.play).toHaveBeenCalledTimes(1);
    });

    it("should call pause when clicking pause button", async () => {
      const user = userEvent.setup();
      render(<DesktopPlayerControls {...defaultProps} isPlaying={true} />);
      await user.click(screen.getByTestId("pause-button"));
      expect(defaultProps.pause).toHaveBeenCalledTimes(1);
    });

    it("should call toggleShuffle when clicking shuffle button", async () => {
      const user = userEvent.setup();
      render(<DesktopPlayerControls {...defaultProps} playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }} />);
      await user.click(screen.getByTestId("desktop-shuffle-button"));
      expect(defaultProps.toggleShuffle).toHaveBeenCalledTimes(1);
    });

    it("should call toggleRepeatMode when clicking repeat button", async () => {
      const user = userEvent.setup();
      render(<DesktopPlayerControls {...defaultProps} playlistState={{ ...defaultProps.playlistState, isPlaylistMode: true }} />);
      await user.click(screen.getByTestId("desktop-repeat-button"));
      expect(defaultProps.toggleRepeatMode).toHaveBeenCalledTimes(1);
    });

    it("should call setIsPlaylistModalOpen when clicking add to playlist button", async () => {
      const user = userEvent.setup();
      render(<DesktopPlayerControls {...defaultProps} />);
      await user.click(screen.getByTestId("playlist-add-button"));
      expect(defaultProps.setIsPlaylistModalOpen).toHaveBeenCalledWith(true);
    });

    it("should call startDownload when clicking download button", async () => {
      const user = userEvent.setup();
      render(<DesktopPlayerControls {...defaultProps} />);
      await user.click(screen.getByTestId("download-button"));
      expect(defaultProps.startDownload).toHaveBeenCalledTimes(1);
    });

    it("should disable previous and next buttons correctly", () => {
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
      expect(nextButton).toHaveAttribute("aria-disabled", "true");
    });
  });
});
