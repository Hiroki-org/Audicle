import { renderHook, act } from "@testing-library/react";
import { usePlayback } from "./usePlayback";
import { audioCache } from "@/lib/audioCache";

jest.mock("@/lib/audioCache", () => ({
  audioCache: {
    get: jest.fn(),
    prefetch: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("usePlayback", () => {
  const mockChunks = [
    { id: "chunk1", text: "Text 1" },
    { id: "chunk2", text: "Text 2" },
    { id: "chunk3", text: "Text 3" },
  ];

  let originalAudio: typeof window.Audio;
  let mockPlay: jest.Mock;
  let mockPause: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    mockPlay = jest.fn().mockResolvedValue(undefined);
    mockPause = jest.fn();

    originalAudio = window.Audio;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.Audio = jest.fn().mockImplementation((url) => ({
      play: mockPlay,
      pause: mockPause,
      src: url,
      playbackRate: 1.0,
      onended: null,
      onerror: null,
      currentTime: 0,
    })) as any;
  });

  afterEach(() => {
    window.Audio = originalAudio;
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.currentChunkId).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("");
    expect(result.current.playbackRate).toBe(1.0);
  });

  it("should load playback rate from localStorage if available", () => {
    localStorage.setItem("audicle-playback-rate", "1.5");
    const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

    expect(result.current.playbackRate).toBe(1.5);
  });

  it("should play the first chunk when play is called and not playing", async () => {
    (audioCache.get as jest.Mock).mockResolvedValue("blob:audio1");
    const onChunkChange = jest.fn();
    const { result } = renderHook(() =>
      usePlayback({ chunks: mockChunks, onChunkChange })
    );

    await act(async () => {
      result.current.play();
    });

    expect(audioCache.get).toHaveBeenCalledWith("Text 1");
    expect(audioCache.prefetch).toHaveBeenCalledWith(["Text 2", "Text 3"]);
    expect(window.Audio).toHaveBeenCalledWith("blob:audio1");
    expect(mockPlay).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentChunkId).toBe("chunk1");
    expect(onChunkChange).toHaveBeenCalledWith("chunk1");
  });

  it("should stop playback when stop is called", async () => {
    (audioCache.get as jest.Mock).mockResolvedValue("blob:audio1");
    const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

    await act(async () => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(mockPause).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.currentChunkId).toBeUndefined();
  });

  it("should handle error during playback", async () => {
     (audioCache.get as jest.Mock).mockRejectedValue(new Error("Cache error"));
     const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

     await act(async () => {
       result.current.play();
     });

     expect(result.current.error).toBe("Cache error");
     expect(result.current.isPlaying).toBe(false);
  });
});
