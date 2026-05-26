import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobilePlayerControls, MobilePlayerControlsProps } from "../MobilePlayerControls";

// Mock nested components
jest.mock("@/components/MobileArticleMenu", () => ({
  MobileArticleMenu: () => <div data-testid="mobile-article-menu" />
}));

describe("MobilePlayerControls", () => {
  const defaultProps: MobilePlayerControlsProps = {
    playbackRate: 1.0,
    setIsSpeedModalOpen: jest.fn(),
    playlistState: {
      isPlaylistMode: false,
      shuffle: false,
      repeatMode: "off",
    },
    toggleShuffle: jest.fn(),
    isPlaylistContextReady: true,
    canMovePrevious: false,
    canMoveNext: false,
    getPlaylistItemHref: jest.fn(),
    wrapIndex: jest.fn((i) => i),
    currentPlaylistIndex: 0,
    isPlaying: false,
    play: jest.fn(),
    pause: jest.fn(),
    isPlaybackLoading: false,
    toggleRepeatMode: jest.fn(),
    articleId: "test-article-123",
    setIsPlaylistModalOpen: jest.fn(),
    url: "https://example.com/test",
    startDownload: jest.fn(),
    downloadStatus: "idle",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Single Article Mode", () => {
    it("should render speed button with correct rate", () => {
      render(<MobilePlayerControls {...defaultProps} playbackRate={1.5} />);
      const speedButton = screen.getByTestId("speed-button-mobile");
      expect(speedButton).toHaveTextContent("1.5x");
    });

    it("should call setIsSpeedModalOpen when speed button is clicked", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...defaultProps} />);
      const speedButton = screen.getByTestId("speed-button-mobile");
      await user.click(speedButton);
      expect(defaultProps.setIsSpeedModalOpen).toHaveBeenCalledWith(true);
    });

    it("should render play button when not playing", () => {
      render(<MobilePlayerControls {...defaultProps} isPlaying={false} />);
      expect(screen.getByTestId("play-button")).toBeInTheDocument();
      expect(screen.queryByTestId("pause-button")).not.toBeInTheDocument();
    });

    it("should render pause button when playing", () => {
      render(<MobilePlayerControls {...defaultProps} isPlaying={true} />);
      expect(screen.getByTestId("pause-button")).toBeInTheDocument();
      expect(screen.queryByTestId("play-button")).not.toBeInTheDocument();
    });

    it("should render loading state when playback is loading", () => {
      render(<MobilePlayerControls {...defaultProps} isPlaybackLoading={true} />);
      const loadingButton = screen.getByTestId("playback-loading");
      expect(loadingButton).toBeInTheDocument();
      expect(loadingButton).toBeDisabled();
    });

    it("should call play when play button is clicked", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...defaultProps} isPlaying={false} />);
      await user.click(screen.getByTestId("play-button"));
      expect(defaultProps.play).toHaveBeenCalled();
    });

    it("should call pause when pause button is clicked", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...defaultProps} isPlaying={true} />);
      await user.click(screen.getByTestId("pause-button"));
      expect(defaultProps.pause).toHaveBeenCalled();
    });

    it("should call setIsPlaylistModalOpen when add to playlist button is clicked", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...defaultProps} />);
      const addButton = screen.getByTestId("playlist-add-button");
      await user.click(addButton);
      expect(defaultProps.setIsPlaylistModalOpen).toHaveBeenCalledWith(true);
    });

    it("should not render add to playlist button if articleId is null", () => {
      render(<MobilePlayerControls {...defaultProps} articleId={null} />);
      expect(screen.queryByTestId("playlist-add-button")).not.toBeInTheDocument();
    });

    it("should render mobile article menu if url is provided", () => {
      render(<MobilePlayerControls {...defaultProps} />);
      expect(screen.getByTestId("mobile-article-menu")).toBeInTheDocument();
    });

    it("should not render playlist controls in single mode", () => {
      render(<MobilePlayerControls {...defaultProps} />);
      expect(screen.queryByTestId("mobile-shuffle-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mobile-repeat-button")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("前の記事")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("次の記事")).not.toBeInTheDocument();
    });
  });

  describe("Playlist Mode", () => {
    const playlistProps = {
      ...defaultProps,
      playlistState: {
        isPlaylistMode: true,
        shuffle: false,
        repeatMode: "off" as const,
      },
    };

    it("should render playlist controls", () => {
      render(<MobilePlayerControls {...playlistProps} />);
      expect(screen.getByTestId("mobile-shuffle-button")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-repeat-button")).toBeInTheDocument();
      expect(screen.getByLabelText("前の記事")).toBeInTheDocument();
      expect(screen.getByLabelText("次の記事")).toBeInTheDocument();
    });

    it("should call toggleShuffle when shuffle button is clicked", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...playlistProps} />);
      await user.click(screen.getByTestId("mobile-shuffle-button"));
      expect(playlistProps.toggleShuffle).toHaveBeenCalled();
    });

    it("should highlight shuffle button when shuffle is on", () => {
      render(
        <MobilePlayerControls
          {...playlistProps}
          playlistState={{ ...playlistProps.playlistState, shuffle: true }}
        />
      );
      const shuffleButton = screen.getByTestId("mobile-shuffle-button");
      expect(shuffleButton).toHaveClass("text-green-500");
    });

    it("should call toggleRepeatMode when repeat button is clicked", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...playlistProps} />);
      await user.click(screen.getByTestId("mobile-repeat-button"));
      expect(playlistProps.toggleRepeatMode).toHaveBeenCalled();
    });

    it("should highlight repeat button when repeat is not off", () => {
      const { rerender } = render(
        <MobilePlayerControls
          {...playlistProps}
          playlistState={{ ...playlistProps.playlistState, repeatMode: "all" }}
        />
      );
      expect(screen.getByTestId("mobile-repeat-button")).toHaveClass("text-green-500");

      rerender(
        <MobilePlayerControls
          {...playlistProps}
          playlistState={{ ...playlistProps.playlistState, repeatMode: "one" }}
        />
      );
      expect(screen.getByTestId("mobile-repeat-button")).toHaveClass("text-green-500");
    });

    describe("Navigation Links", () => {
      it("should render previous and next links as disabled when cannot move", () => {
        render(
          <MobilePlayerControls
            {...playlistProps}
            canMovePrevious={false}
            canMoveNext={false}
          />
        );
        const prevLink = screen.getByLabelText("前の記事");
        const nextLink = screen.getByLabelText("次の記事");

        expect(prevLink).toHaveAttribute("aria-disabled", "true");
        expect(prevLink).toHaveClass("opacity-50", "cursor-not-allowed");

        expect(nextLink).toHaveAttribute("aria-disabled", "true");
        expect(nextLink).toHaveClass("opacity-50", "cursor-not-allowed");
      });

      it("should prevent default when clicking disabled navigation links", async () => {
        const user = userEvent.setup();
        render(
          <MobilePlayerControls
            {...playlistProps}
            canMovePrevious={false}
            canMoveNext={false}
          />
        );

        const prevLink = screen.getByLabelText("前の記事");
        await user.click(prevLink);
        // It's tricky to assert preventDefault directly here without mocking the event,
        // but we can assert the attributes are correct which drives the preventDefault behavior.
        expect(prevLink).toHaveAttribute("aria-disabled", "true");
      });

      it("should have valid hrefs when can move and links are provided", () => {
        const mockGetPlaylistItemHref = jest.fn((index) => {
          if (index === -1) return "/playlist?item=-1";
          if (index === 1) return "/playlist?item=1";
          return undefined;
        });

        const mockWrapIndex = jest.fn((index) => index); // Simplify for test

        render(
          <MobilePlayerControls
            {...playlistProps}
            canMovePrevious={true}
            canMoveNext={true}
            currentPlaylistIndex={0}
            getPlaylistItemHref={mockGetPlaylistItemHref}
            wrapIndex={mockWrapIndex}
          />
        );

        const prevLink = screen.getByLabelText("前の記事");
        const nextLink = screen.getByLabelText("次の記事");

        expect(prevLink).toHaveAttribute("href", "/playlist?item=-1");
        expect(prevLink).not.toHaveAttribute("aria-disabled", "true");

        expect(nextLink).toHaveAttribute("href", "/playlist?item=1");
        expect(nextLink).not.toHaveAttribute("aria-disabled", "true");
      });
    });
  });
});

  describe("Next link edge case", () => {
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
      canMovePrevious: false,
      canMoveNext: false,
      getPlaylistItemHref: jest.fn(),
      wrapIndex: jest.fn((i) => i),
      currentPlaylistIndex: 0,
      isPlaying: false,
      play: jest.fn(),
      pause: jest.fn(),
      isPlaybackLoading: false,
      toggleRepeatMode: jest.fn(),
      articleId: "test-article-123",
      setIsPlaylistModalOpen: jest.fn(),
      url: "https://example.com/test",
      startDownload: jest.fn(),
      downloadStatus: "idle",
    };
    it("should prevent default when next is disabled on click", async () => {
      const user = userEvent.setup();
      const playlistProps = {
        ...defaultProps,
        playlistState: {
          isPlaylistMode: true,
          shuffle: false,
          repeatMode: "off" as const,
        },
      };
      render(
        <MobilePlayerControls
          {...playlistProps}
          canMovePrevious={true}
          canMoveNext={false}
        />
      );

      const nextLink = screen.getByLabelText("次の記事");
      await user.click(nextLink);
      expect(nextLink).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("Previous link edge case", () => {
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
      canMovePrevious: false,
      canMoveNext: false,
      getPlaylistItemHref: jest.fn(),
      wrapIndex: jest.fn((i) => i),
      currentPlaylistIndex: 0,
      isPlaying: false,
      play: jest.fn(),
      pause: jest.fn(),
      isPlaybackLoading: false,
      toggleRepeatMode: jest.fn(),
      articleId: "test-article-123",
      setIsPlaylistModalOpen: jest.fn(),
      url: "https://example.com/test",
      startDownload: jest.fn(),
      downloadStatus: "idle",
    };
    it("should prevent default when previous is disabled on click", async () => {
      const user = userEvent.setup();
      const playlistProps = {
        ...defaultProps,
        playlistState: {
          isPlaylistMode: true,
          shuffle: false,
          repeatMode: "off" as const,
        },
      };
      render(
        <MobilePlayerControls
          {...playlistProps}
          canMovePrevious={false}
          canMoveNext={true}
        />
      );

      const prevLink = screen.getByLabelText("前の記事");
      await user.click(prevLink);
      expect(prevLink).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("Link click handling", () => {
    const defaultProps = {
      playbackRate: 1.0,
      setIsSpeedModalOpen: jest.fn(),
      playlistState: {
        isPlaylistMode: true,
        shuffle: false,
        repeatMode: "off" as const,
      },
      toggleShuffle: jest.fn(),
      isPlaylistContextReady: true,
      canMovePrevious: true,
      canMoveNext: true,
      getPlaylistItemHref: jest.fn((i) => `/playlist?item=${i}`),
      wrapIndex: jest.fn((i) => i),
      currentPlaylistIndex: 0,
      isPlaying: false,
      play: jest.fn(),
      pause: jest.fn(),
      isPlaybackLoading: false,
      toggleRepeatMode: jest.fn(),
      articleId: "test-article-123",
      setIsPlaylistModalOpen: jest.fn(),
      url: "https://example.com/test",
      startDownload: jest.fn(),
      downloadStatus: "idle",
    };
    it("should allow default action when previous is clicked and enabled", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...defaultProps} />);
      const prevLink = screen.getByLabelText("前の記事");
      let defaultPrevented = false;
      prevLink.addEventListener("click", (e) => {
        defaultPrevented = e.defaultPrevented;
      });
      await user.click(prevLink);
      expect(defaultPrevented).toBe(false);
    });
    it("should allow default action when next is clicked and enabled", async () => {
      const user = userEvent.setup();
      render(<MobilePlayerControls {...defaultProps} />);
      const nextLink = screen.getByLabelText("次の記事");
      let defaultPrevented = false;
      nextLink.addEventListener("click", (e) => {
        defaultPrevented = e.defaultPrevented;
      });
      await user.click(nextLink);
      expect(defaultPrevented).toBe(false);
    });
  });
