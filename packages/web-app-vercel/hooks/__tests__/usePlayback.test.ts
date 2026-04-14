import { renderHook, waitFor, act } from "@testing-library/react";
import { usePlayback } from "../usePlayback";
import { Chunk } from "@/types/api";
import "@testing-library/jest-dom";

// モックのセットアップ
jest.mock("@/lib/audioCache", () => ({
  audioCache: {
    get: jest.fn(),
    prefetch: jest.fn(),
  },
}));

jest.mock("@/lib/indexedDB", () => ({
  getAudioChunk: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/paragraphParser", () => ({
  needsPauseBefore: jest.fn(() => false),
  needsPauseAfter: jest.fn(() => false),
  getPauseDuration: jest.fn(() => 0),
}));

// useMediaSession フックのモック（バックグラウンド再生用）
jest.mock("../useMediaSession", () => ({
  useMediaSession: jest.fn(() => ({
    updateMetadata: jest.fn(),
    updatePlaybackState: jest.fn(),
  })),
}));

// HTMLAudioElement のモック
class MockAudio {
  src = "";
  playbackRate = 1.0;
  paused = true;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  error: MediaError | null = null;

  playCallCount = 0;

  play(): Promise<void> {
    this.playCallCount++;
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

describe("usePlayback", () => {
  let mockAudioInstance: MockAudio;
  const originalAudio = global.Audio;

  beforeEach(() => {
    // Audioオブジェクトをモックする
    mockAudioInstance = new MockAudio();
    global.Audio = jest.fn(() => mockAudioInstance) as any;

    // localStorageのモック
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    global.Audio = originalAudio;
    jest.clearAllMocks();
  });

  it("play()が一度だけ呼ばれることを確認（AbortError修正の検証）", async () => {
    const { audioCache } = require("@/lib/audioCache");
    const { getAudioChunk } = require("@/lib/indexedDB");

    // モックの設定
    getAudioChunk.mockResolvedValue(null);
    audioCache.get.mockResolvedValue("blob:mock-audio-url");

    const mockChunks: Chunk[] = [
      {
        id: "chunk-1",
        text: "テストチャンク1",
        cleanedText: "テストチャンク1",
        type: "paragraph",
      },
    ];

    const { result } = renderHook(() =>
      usePlayback({
        chunks: mockChunks,
        articleUrl: "https://example.com/test",
        voiceModel: "ja-JP-Standard-B",
      })
    );

    // 再生を開始
    await act(async () => {
      await result.current.play();
    });

    // 非同期処理を待つ
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // play()が一度だけ呼ばれたことを確認
    // 修正前は2回呼ばれていたが、修正後は1回のみ
    expect(mockAudioInstance.playCallCount).toBe(1);

    // 音声ソースが設定されていることを確認
    expect(mockAudioInstance.src).toBe("blob:mock-audio-url");
  });

  it("複数回の再生リクエストが同時に発生した場合、2回目以降がスキップされることを確認", async () => {
    const { audioCache } = require("@/lib/audioCache");
    const { getAudioChunk } = require("@/lib/indexedDB");
    const { logger } = require("@/lib/logger");

    // モックの設定（遅延を加えて競合状態を再現）
    getAudioChunk.mockResolvedValue(null);
    audioCache.get.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve("blob:mock-audio-url"), 100))
    );

    const mockChunks: Chunk[] = [
      {
        id: "chunk-1",
        text: "テストチャンク1",
        cleanedText: "テストチャンク1",
        type: "paragraph",
      },
    ];

    const { result } = renderHook(() =>
      usePlayback({
        chunks: mockChunks,
        articleUrl: "https://example.com/test",
        voiceModel: "ja-JP-Standard-B",
      })
    );

    // 短時間に複数回再生を試みる
    await act(async () => {
      const p1 = result.current.play();
      const p2 = result.current.play();
      const p3 = result.current.play();
      await Promise.allSettled([p1, p2, p3]);
    });

    // 非同期処理を待つ
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // 警告ログが2回呼ばれたことを確認（2回目と3回目がスキップされた）
    const warnCalls = logger.warn.mock.calls.filter(
      (call: any[]) => call[0] === "再生リクエストが既に進行中のため、新しいリクエストをスキップします"
    );
    expect(warnCalls.length).toBeGreaterThanOrEqual(1);
  });

  describe('next()', () => {
    it('次のチャンクへ移動すること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");

      // モックの設定
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks: Chunk[] = [
        {
          id: "chunk-1",
          text: "テストチャンク1",
          cleanedText: "テストチャンク1",
          type: "paragraph",
        },
        {
          id: "chunk-2",
          text: "テストチャンク2",
          cleanedText: "テストチャンク2",
          type: "paragraph",
        },
      ];

      const { result } = renderHook(() =>
        usePlayback({
          chunks: mockChunks,
          articleUrl: "https://example.com/test",
          voiceModel: "ja-JP-Standard-B",
        })
      );

      // 最初のチャンクを再生
      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.currentIndex).toBe(0);
      });

      // next() を呼ぶ
      await act(async () => {
        await result.current.next();
      });

      // 次のチャンクへ移動することを確認
      await waitFor(() => {
        expect(result.current.currentIndex).toBe(1);
      });
    });

    it('最後のチャンクで next() を呼んだ場合、何もしないこと', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");

      // モックの設定
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks: Chunk[] = [
        {
          id: "chunk-1",
          text: "テストチャンク1",
          cleanedText: "テストチャンク1",
          type: "paragraph",
        },
      ];

      const { result } = renderHook(() =>
        usePlayback({
          chunks: mockChunks,
          articleUrl: "https://example.com/test",
          voiceModel: "ja-JP-Standard-B",
        })
      );

      // 最初のチャンクを再生
      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.currentIndex).toBe(0);
      });

      // 最後のチャンクで next() を呼ぶ
      await act(async () => {
        await result.current.next();
      });

      // currentIndex が変わらないことを確認（何もしない）
      await waitFor(() => {
        expect(result.current.currentIndex).toBe(0);
      });
    });
  });

  describe('previous()', () => {
    it('前のチャンクへ移動すること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");

      // モックの設定
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks: Chunk[] = [
        {
          id: "chunk-1",
          text: "テストチャンク1",
          cleanedText: "テストチャンク1",
          type: "paragraph",
        },
        {
          id: "chunk-2",
          text: "テストチャンク2",
          cleanedText: "テストチャンク2",
          type: "paragraph",
        },
      ];

      const { result } = renderHook(() =>
        usePlayback({
          chunks: mockChunks,
          articleUrl: "https://example.com/test",
          voiceModel: "ja-JP-Standard-B",
        })
      );

      // 2番目のチャンクを直接再生
      await act(async () => {
        await result.current.seekToChunk("chunk-2");
      });

      await waitFor(() => {
        expect(result.current.currentIndex).toBe(1);
      });

      // previous() を呼ぶ
      await act(async () => {
        await result.current.previous();
      });

      // 前のチャンクへ移動することを確認
      await waitFor(() => {
        expect(result.current.currentIndex).toBe(0);
      });
    });

    it('最初のチャンクで previous() を呼んだ場合、最初から再生すること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");

      // モックの設定
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks: Chunk[] = [
        {
          id: "chunk-1",
          text: "テストチャンク1",
          cleanedText: "テストチャンク1",
          type: "paragraph",
        },
        {
          id: "chunk-2",
          text: "テストチャンク2",
          cleanedText: "テストチャンク2",
          type: "paragraph",
        },
      ];

      const { result } = renderHook(() =>
        usePlayback({
          chunks: mockChunks,
          articleUrl: "https://example.com/test",
          voiceModel: "ja-JP-Standard-B",
        })
      );

      // 最初のチャンクを再生
      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.currentIndex).toBe(0);
      });

      // 最初のチャンクで previous() を呼ぶ
      await act(async () => {
        await result.current.previous();
      });

      // currentIndex が 0 のまま（最初から再生）
      await waitFor(() => {
        expect(result.current.currentIndex).toBe(0);
      });
    });
  });

  describe('境界条件', () => {
    it('空のchunks配列でエラーが発生しないこと', () => {
      const mockChunks: Chunk[] = [];

      expect(() => {
        renderHook(() =>
          usePlayback({
            chunks: mockChunks,
          })
        );
      }).not.toThrow();
    });

    it('単一チャンクでのnext/previous動作', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");

      // モックの設定
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks: Chunk[] = [
        {
          id: "chunk-1",
          text: "テストチャンク1",
          cleanedText: "テストチャンク1",
          type: "paragraph",
        },
      ];

      const { result } = renderHook(() =>
        usePlayback({
          chunks: mockChunks,
          articleUrl: "https://example.com/test",
          voiceModel: "ja-JP-Standard-B",
        })
      );

      // 再生を開始
      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.currentIndex).toBe(0);
      });

      // next() を呼んでも何もしない
      await act(async () => {
        await result.current.next();
      });

      expect(result.current.currentIndex).toBe(0);

      // previous() を呼んでも最初から再生
      await act(async () => {
        await result.current.previous();
      });

      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('Media Session メタデータ連携', () => {
    it('articleTitle が useMediaSession に渡されること', () => {
      const { useMediaSession } = require("../useMediaSession");

      const mockChunks: Chunk[] = [
        {
          id: "chunk-1",
          text: "テストチャンク1",
          cleanedText: "テストチャンク1",
          type: "paragraph",
        },
      ];

      const articleTitle = "テスト記事タイトル";
      const articleAuthor = "テスト著者";

      renderHook(() =>
        usePlayback({
          chunks: mockChunks,
          articleTitle,
          articleAuthor,
        })
      );

      // useMediaSession が呼ばれたことを確認
      expect(useMediaSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: articleTitle,
          artist: articleAuthor,
        })
      );
    });

    it('articleAuthor が useMediaSession に渡されること', () => {
      const { useMediaSession } = require("../useMediaSession");

      const mockChunks: Chunk[] = [
        {
          id: "chunk-1",
          text: "テストチャンク1",
          cleanedText: "テストチャンク1",
          type: "paragraph",
        },
      ];

      const articleTitle = "テスト記事タイトル";
      const articleAuthor = "テスト著者";

      renderHook(() =>
        usePlayback({
          chunks: mockChunks,
          articleTitle,
          articleAuthor,
        })
      );

      // useMediaSession が呼ばれたことを確認
      expect(useMediaSession).toHaveBeenCalledWith(
        expect.objectContaining({
          artist: articleAuthor,
        })
      );
    });
  });

  describe('pause() and stop()', () => {
    it('pause() を呼ぶと音声が一時停止し isPlaying が false になること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks = [{ id: "chunk-1", text: "テスト1", cleanedText: "テスト1", type: "paragraph" }];

      const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      act(() => {
        result.current.pause();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(global.Audio.mock.results[0].value.paused).toBe(true);
    });

    it('stop() を呼ぶと音声が停止し状態がリセットされること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks = [{ id: "chunk-1", text: "テスト1", cleanedText: "テスト1", type: "paragraph" }];

      const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      act(() => {
        result.current.stop();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentIndex).toBe(-1);
      const audioInstance = global.Audio.mock.results[0].value;
      expect(audioInstance.paused).toBe(true);
      expect(audioInstance.currentTime).toBe(0);
    });
  });

  describe('playbackRate and seekToChunk', () => {
    it('seekToChunk() が正しいチャンクのインデックスを再生すること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks = [
        { id: "chunk-1", text: "テスト1", cleanedText: "テスト1", type: "paragraph" },
        { id: "chunk-2", text: "テスト2", cleanedText: "テスト2", type: "paragraph" },
      ];

      const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

      await act(async () => {
        await result.current.seekToChunk("chunk-2");
      });

      await waitFor(() => {
        expect(result.current.currentIndex).toBe(1);
        expect(result.current.currentChunkId).toBe("chunk-2");
        expect(result.current.isPlaying).toBe(true);
      });
    });

    it('setPlaybackRate() が状態と localStorage と audio の playbackRate を更新すること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks = [
        { id: "chunk-1", text: "テスト1", cleanedText: "テスト1", type: "paragraph" },
      ];
      const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

      await act(async () => {
        await result.current.play();
      });

      const audioInstance = global.Audio.mock.results[global.Audio.mock.results.length - 1]?.value;
      expect(audioInstance).toBeDefined();

      act(() => {
        result.current.setPlaybackRate(1.5);
      });

      expect(result.current.playbackRate).toBe(1.5);
      expect(window.localStorage.setItem).toHaveBeenCalledWith('audicle-playback-rate', '1.5');
      expect(audioInstance.playbackRate).toBe(1.5);
    });

    it('playbackSpeed プロパティの変更が playbackRate に反映されること', () => {
      const { result, rerender } = renderHook(
        (props) => usePlayback(props),
        { initialProps: { chunks: [], playbackSpeed: 1.0 } }
      );

      expect(result.current.playbackRate).toBe(1.0);

      rerender({ chunks: [], playbackSpeed: 2.0 });

      expect(result.current.playbackRate).toBe(2.0);
    });
  });

  describe('onArticleEnd and Error handling paths', () => {
    let originalFetch: typeof global.fetch | undefined;

    beforeEach(() => {
      jest.useFakeTimers();
      originalFetch = global.fetch;

      if (typeof global.fetch === 'undefined') {
        Object.defineProperty(global, 'fetch', {
          value: jest.fn(),
          writable: true,
          configurable: true,
        });
      }

      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
      Object.defineProperty(global, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
      });
    });

    it('最後のチャンクの再生終了時に onArticleEnd が呼ばれ、Supabase キャッシュ更新の fetch が走ること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const onArticleEndMock = jest.fn();
      const mockChunks = [{ id: "chunk-1", text: "テスト1", cleanedText: "テスト1", type: "paragraph" }];

      const { result } = renderHook(() => usePlayback({
        chunks: mockChunks,
        articleUrl: "https://example.com/test",
        voiceModel: "ja-JP-Standard-B",
        onArticleEnd: onArticleEndMock
      }));

      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      const audioInstance = global.Audio.mock.results[0].value;

      // onended ハンドラを発火させる
      await act(async () => {
        if (audioInstance.onended) {
          audioInstance.onended();
        }
        // sleep のタイマーを進める
        await jest.runAllTimersAsync();
      });

      expect(onArticleEndMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/cache/update-completed', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleUrl: "https://example.com/test",
          voice: "ja-JP-Standard-B",
          completed: true
        })
      }));
      expect(result.current.isPlaying).toBe(false);
    });


    it('音声再生エラー時にエラーメッセージが設定され、NotAllowedError が処理されること', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");
      const { logger } = require("@/lib/logger");
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks = [{ id: "chunk-1", text: "テスト1", cleanedText: "テスト1", type: "paragraph" }];

      const { result } = renderHook(() => usePlayback({ chunks: mockChunks }));

      // Hook の play() を呼び出し、内部で Audio インスタンスが作成されるようにする
      const playPromise = act(async () => {
        // play を呼ぶ前に mock を差し替える
        if (global.Audio.mock.results[0]) {
            global.Audio.mock.results[0].value.play = jest.fn().mockRejectedValue({
                name: 'NotAllowedError',
                message: 'play failed'
            });
        } else {
             // global.Audio mock was not instantiated yet. we overwrite the constructor implementation just for this test
            global.Audio.mockImplementationOnce(() => {
                const instance = new MockAudio();
                instance.play = jest.fn().mockRejectedValue({
                    name: 'NotAllowedError',
                    message: 'play failed'
                });
                return instance;
            });
        }
        await result.current.play();
      });

      await playPromise;

      await waitFor(() => {
        expect(result.current.error).toBe("音声の再生がブラウザにブロックされました。ページをクリックしてから再度お試しください。");
      });

      expect(logger.error).toHaveBeenCalledWith(
        "再生処理全体でエラー (NotAllowedError)",
        expect.any(Object)
      );
    });

    it('onerror イベントで MEDIA_ERR_SRC_NOT_SUPPORTED が発生した際に 404 が処理され次のチャンクへ進むこと', async () => {
      const { audioCache } = require("@/lib/audioCache");
      const { getAudioChunk } = require("@/lib/indexedDB");
      const { logger } = require("@/lib/logger");
      getAudioChunk.mockResolvedValue(null);
      audioCache.get.mockResolvedValue("blob:mock-audio-url");

      const mockChunks = [
        { id: "chunk-1", text: "テスト1", cleanedText: "テスト1", type: "paragraph" },
        { id: "chunk-2", text: "テスト2", cleanedText: "テスト2", type: "paragraph" }
      ];

      const { result } = renderHook(() => usePlayback({
        chunks: mockChunks,
        articleUrl: "https://example.com/test",
        voiceModel: "ja-JP-Standard-B",
      }));

      await act(async () => {
        await result.current.play();
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      const audioInstance = global.Audio.mock.results[global.Audio.mock.results.length - 1].value;

      // onerror イベントを発火させる
      const originalMediaError = global.MediaError;
      await act(async () => {
        audioInstance.error = {
          code: 4, // MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          message: 'Not Supported'
        };
        // global object patch
        global.MediaError = { MEDIA_ERR_SRC_NOT_SUPPORTED: 4 };

        if (audioInstance.onerror) {
          audioInstance.onerror(new Event('error'));
        }
      });
      global.MediaError = originalMediaError;

      await waitFor(() => {
         expect(result.current.error).toBe("一部の音声が再生できませんでした。次の部分から再開します。");
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Audio 404 detected"),
        expect.any(Object)
      );

      expect(global.fetch).toHaveBeenCalledWith('/api/cache/remove', expect.objectContaining({
        method: 'POST'
      }));
    });

  });
});
