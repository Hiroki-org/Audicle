import React from "react";
import { render, act } from "@testing-library/react";
import {
  PlaylistPlaybackProvider,
  usePlaylistPlayback,
  generateShuffledIndices,
  type RepeatMode,
  type PlaylistPlaybackContextType,
} from "@/contexts/PlaylistPlaybackContext";

// Mock next/navigation useRouter
const pushMock = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const TestComponent = () => {
  const ctx = usePlaylistPlayback();
  // Expose methods on window for test access
  // @ts-expect-error intentionally exposing internals for tests
  window.__test__ = ctx;
  return null;
};

const sampleItems = Array.from({ length: 3 }).map((_, i) => ({
  id: `item-${i}`,
  article_id: `article-${i}`,
  position: i,
  playlist_id: "pl-1",
  added_at: new Date().toISOString(),
  article: {
    id: `article-${i}`,
    owner_email: "test@example.com",
    url: `https://example.com/article-${i}`,
    title: `Article ${i}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
}));

// Helper to get the test context
function getCtx(): PlaylistPlaybackContextType {
  // @ts-expect-error test harness: accessing internal
  return window.__test__;
}

describe("PlaylistPlaybackContext circular behavior", () => {
  beforeEach(() => {
    pushMock.mockClear();
    localStorage.clear();
  });

  test("canMovePrevious and canMoveNext are true when items exist", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    // initialize
    await act(async () => {
      getCtx().startPlaylistPlayback(
        "pl-1",
        "My Playlist",
        sampleItems,
        0
      );
    });

    const { canMovePrevious, canMoveNext, state } = getCtx();

    expect(state.items.length).toBe(3);
    expect(canMovePrevious).toBe(true);
    expect(canMoveNext).toBe(true);
  });

  test("playNext wraps around to first item after last", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      // start at last index
      getCtx().startPlaylistPlayback(
        "pl-1",
        "My Playlist",
        sampleItems,
        2
      );
      getCtx().playNext();
    });

    // Expect push to be called with index=0
    expect(pushMock).toHaveBeenCalled();
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(lastCall).toContain("index=0");
  });

  test("playPrevious wraps around to last item when at first index", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      // start at first index
      getCtx().startPlaylistPlayback(
        "pl-1",
        "My Playlist",
        sampleItems,
        0
      );
      getCtx().playPrevious();
    });

    // Expect push to be called with index=2
    expect(pushMock).toHaveBeenCalled();
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(lastCall).toContain("index=2");
  });
});

describe("PlaylistPlaybackContext repeat modes", () => {
  beforeEach(() => {
    pushMock.mockClear();
    localStorage.clear();
  });

  test("default repeatMode is 'off' and shuffle is false", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
    });

    expect(getCtx().state.repeatMode).toBe("off");
    expect(getCtx().state.shuffle).toBe(false);
    expect(getCtx().state.shuffledIndices).toEqual([]);
  });

  test("toggleRepeatMode cycles off → all → one → off", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
    });

    expect(getCtx().state.repeatMode).toBe("off");

    await act(async () => {
      getCtx().toggleRepeatMode();
    });
    expect(getCtx().state.repeatMode).toBe("all");

    await act(async () => {
      getCtx().toggleRepeatMode();
    });
    expect(getCtx().state.repeatMode).toBe("one");

    await act(async () => {
      getCtx().toggleRepeatMode();
    });
    expect(getCtx().state.repeatMode).toBe("off");
  });

  test("toggleShuffle enables shuffle and generates shuffledIndices", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
    });

    expect(getCtx().state.shuffle).toBe(false);

    await act(async () => {
      getCtx().toggleShuffle();
    });

    expect(getCtx().state.shuffle).toBe(true);
    expect(getCtx().state.shuffledIndices).toHaveLength(3);
    // Current index (0) should be at position 0
    expect(getCtx().state.shuffledIndices[0]).toBe(0);
    // All indices should be present
    expect(getCtx().state.shuffledIndices.sort()).toEqual([0, 1, 2]);
  });

  test("toggleShuffle off clears shuffledIndices", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
      getCtx().toggleShuffle();
    });

    expect(getCtx().state.shuffle).toBe(true);

    await act(async () => {
      getCtx().toggleShuffle();
    });

    expect(getCtx().state.shuffle).toBe(false);
    expect(getCtx().state.shuffledIndices).toEqual([]);
  });

  test("onArticleEnd with repeatMode='one' replays the same article", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 1);
    });

    // Set repeat mode to "one"
    await act(async () => {
      getCtx().toggleRepeatMode(); // off → all
    });
    await act(async () => {
      getCtx().toggleRepeatMode(); // all → one
    });
    expect(getCtx().state.repeatMode).toBe("one");

    pushMock.mockClear();

    await act(async () => {
      getCtx().onArticleEnd();
    });

    // Should push with the same index (1)
    expect(pushMock).toHaveBeenCalled();
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(lastCall).toContain("index=1");
    expect(lastCall).toContain("article-1");
  });

  test("onArticleEnd with repeatMode='off' stops at end of playlist", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    // Start at last index with repeatMode off
    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 2);
    });

    expect(getCtx().state.repeatMode).toBe("off");

    pushMock.mockClear();

    await act(async () => {
      getCtx().onArticleEnd();
    });

    // Should NOT push (playlist ended)
    expect(pushMock).not.toHaveBeenCalled();
    // Index should remain at 2
    expect(getCtx().state.currentIndex).toBe(2);
  });

  test("onArticleEnd with repeatMode='all' wraps around at end of playlist", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    // Start at last index
    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 2);
    });

    // Set repeat mode to "all"
    await act(async () => {
      getCtx().toggleRepeatMode(); // off → all
    });
    expect(getCtx().state.repeatMode).toBe("all");

    pushMock.mockClear();

    await act(async () => {
      getCtx().onArticleEnd();
    });

    // Should wrap around to index 0
    expect(pushMock).toHaveBeenCalled();
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(lastCall).toContain("index=0");
  });

  test("onArticleEnd mid-playlist with repeatMode='off' continues to next", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    // Start at middle index (not last)
    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
    });

    expect(getCtx().state.repeatMode).toBe("off");

    pushMock.mockClear();

    await act(async () => {
      getCtx().onArticleEnd();
    });

    // Should continue to next article
    expect(pushMock).toHaveBeenCalled();
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(lastCall).toContain("index=1");
  });

  test("state is persisted to and loaded from localStorage", async () => {
    const { unmount } = render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
      getCtx().toggleRepeatMode(); // off → all
      getCtx().toggleShuffle(); // false → true
    });

    unmount();

    // Re-render and check that state is restored
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    expect(getCtx().state.repeatMode).toBe("all");
    expect(getCtx().state.shuffle).toBe(true);
    expect(getCtx().state.shuffledIndices.length).toBeGreaterThan(0);
  });
});

describe("generateShuffledIndices", () => {
  test("generates array with all indices", () => {
    const result = generateShuffledIndices(5);
    expect(result).toHaveLength(5);
    expect(result.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  test("places currentIndex at position 0", () => {
    const result = generateShuffledIndices(5, 3);
    expect(result[0]).toBe(3);
    expect(result).toHaveLength(5);
    expect(result.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  test("handles empty array", () => {
    const result = generateShuffledIndices(0);
    expect(result).toEqual([]);
  });

  test("handles single element", () => {
    const result = generateShuffledIndices(1, 0);
    expect(result).toEqual([0]);
  });

  test("currentIndex out of range is ignored", () => {
    const result = generateShuffledIndices(3, 10);
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual([0, 1, 2]);
  });
});

describe("PlaylistPlaybackContext shuffle playback", () => {
  beforeEach(() => {
    pushMock.mockClear();
    localStorage.clear();
  });

  test("playNext in shuffle mode follows shuffled order", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
      getCtx().toggleShuffle();
    });

    const shuffledIndices = [...getCtx().state.shuffledIndices];
    expect(shuffledIndices[0]).toBe(0); // Current index is first in shuffle order

    pushMock.mockClear();

    await act(async () => {
      getCtx().playNext();
    });

    // Should navigate to the second item in the shuffled order
    expect(pushMock).toHaveBeenCalled();
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(lastCall).toContain(`index=${shuffledIndices[1]}`);
  });

  test("stopPlaylistPlayback resets repeat and shuffle", async () => {
    render(
      <PlaylistPlaybackProvider>
        <TestComponent />
      </PlaylistPlaybackProvider>
    );

    await act(async () => {
      getCtx().startPlaylistPlayback("pl-1", "My Playlist", sampleItems, 0);
      getCtx().toggleRepeatMode(); // off → all
      getCtx().toggleShuffle();
    });

    expect(getCtx().state.repeatMode).toBe("all");
    expect(getCtx().state.shuffle).toBe(true);

    await act(async () => {
      getCtx().stopPlaylistPlayback();
    });

    expect(getCtx().state.repeatMode).toBe("off");
    expect(getCtx().state.shuffle).toBe(false);
    expect(getCtx().state.shuffledIndices).toEqual([]);
  });
});
