import { renderHook, act, waitFor } from "@testing-library/react";
import { usePlayback } from "../usePlayback";
import { audioCache } from "@/lib/audioCache";

jest.mock("@/lib/audioCache", () => ({
  audioCache: {
    get: jest.fn().mockResolvedValue("blob:mock-url"),
    prefetch: jest.fn().mockResolvedValue(undefined),
  }
}));

describe("usePlayback", () => {
  let mockAudioInstance: any;
  let originalAudio: any;

  beforeAll(() => {
    originalAudio = global.Audio;
  });

  afterAll(() => {
    global.Audio = originalAudio;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // @ts-ignore
    global.Audio = class MockAudio {
      src: string;
      playbackRate: number;
      onended: (() => void) | null;
      onerror: (() => void) | null;

      constructor(src?: string) {
        this.src = src || '';
        this.playbackRate = 1;
        this.onended = null;
        this.onerror = null;
        mockAudioInstance = this;
      }

      play = jest.fn().mockResolvedValue(undefined);
      pause = jest.fn();
    };
  });

  it("handles playback error via audio.onerror", async () => {
    const chunks = [{ id: "1", text: "テスト", start: 0, end: 1 }];
    const { result } = renderHook(() => usePlayback({ chunks }));

    act(() => {
      result.current.play();
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });

    // Trigger error
    act(() => {
      if (mockAudioInstance.onerror) {
        mockAudioInstance.onerror();
      }
    });

    expect(result.current.error).toBe("音声の再生に失敗しました");
    expect(result.current.isPlaying).toBe(false);
  });

  it("handles audio.play error", async () => {
    const chunks = [{ id: "1", text: "テスト", start: 0, end: 1 }];
    const { result } = renderHook(() => usePlayback({ chunks }));

    const mockPlay = jest.fn().mockRejectedValue(new Error("Playback failed"));

    // @ts-ignore
    global.Audio = class MockAudio {
      src: string;
      playbackRate: number;
      onended: (() => void) | null;
      onerror: (() => void) | null;

      constructor(src?: string) {
        this.src = src || '';
        this.playbackRate = 1;
        this.onended = null;
        this.onerror = null;
        mockAudioInstance = this;
      }

      play = mockPlay;
      pause = jest.fn();
    };

    act(() => {
      result.current.play();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Playback failed");
      expect(result.current.isPlaying).toBe(false);
    });
  });

  it("handles audioCache.get error", async () => {
    const chunks = [{ id: "1", text: "テスト", start: 0, end: 1 }];
    const { result } = renderHook(() => usePlayback({ chunks }));

    (audioCache.get as jest.Mock).mockRejectedValueOnce(new Error("Cache failed"));

    act(() => {
      result.current.play();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Cache failed");
      expect(result.current.isPlaying).toBe(false);
    });
  });
});
