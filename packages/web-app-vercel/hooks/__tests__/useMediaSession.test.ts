import { renderHook, act } from "@testing-library/react";
import { useMediaSession } from "../useMediaSession";
import "@testing-library/jest-dom";

// モックのセットアップ
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("useMediaSession", () => {
  let mockMediaSession: {
    metadata: MediaMetadata | null;
    playbackState: MediaSessionPlaybackState;
    setActionHandler: jest.Mock;
  };

  const originalNavigator = global.navigator;

  beforeEach(() => {
    // MediaSession APIのモック
    mockMediaSession = {
      metadata: null,
      playbackState: "none",
      setActionHandler: jest.fn(),
    };

    // navigator.mediaSessionをモック
    Object.defineProperty(global, "navigator", {
      value: {
        ...originalNavigator,
        mediaSession: mockMediaSession,
      },
      writable: true,
      configurable: true,
    });
    // MediaMetadataのモック
    global.MediaMetadata = jest.fn().mockImplementation((options) => options) as unknown as typeof MediaMetadata;
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  it("Media Session APIが利用可能な場合、メタデータを設定すること", () => {
    renderHook(() =>
      useMediaSession({
        title: "テスト記事",
        artist: "example.com",
        isPlaying: false,
      })
    );

    // メタデータが設定されていることを確認
    expect(mockMediaSession.metadata).toEqual(
      expect.objectContaining({
        title: "テスト記事",
        artist: "example.com",
        album: "Audicle",
      })
    );
  });

  it("再生状態が変更されたとき、playbackStateを更新すること", () => {
    const { rerender } = renderHook(
      ({ isPlaying }) =>
        useMediaSession({
          title: "テスト記事",
          isPlaying,
        }),
      { initialProps: { isPlaying: false } }
    );

    expect(mockMediaSession.playbackState).toBe("paused");

    // 再生状態を変更
    rerender({ isPlaying: true });
    expect(mockMediaSession.playbackState).toBe("playing");
  });

  it("アクションハンドラが登録されること", () => {
    const onPlay = jest.fn();
    const onPause = jest.fn();
    const onNextTrack = jest.fn();
    const onPreviousTrack = jest.fn();
    const onStop = jest.fn();

    renderHook(() =>
      useMediaSession({
        title: "テスト記事",
        isPlaying: false,
        onPlay,
        onPause,
        onNextTrack,
        onPreviousTrack,
        onStop,
      })
    );

    // すべてのアクションハンドラが登録されていることを確認
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("play", expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("pause", expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("nexttrack", expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("previoustrack", expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("stop", expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekto", expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekforward", expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekbackward", expect.any(Function));
  });

  it("playアクションがトリガーされたとき、onPlayコールバックを呼び出すこと", () => {
    const onPlay = jest.fn();

    renderHook(() =>
      useMediaSession({
        title: "テスト記事",
        isPlaying: false,
        onPlay,
      })
    );

    // playアクションハンドラを取得
    const playHandler = mockMediaSession.setActionHandler.mock.calls.find(
      (call) => call[0] === "play"
    )?.[1];

    // playアクションをトリガー
    act(() => {
      playHandler?.();
    });

    expect(onPlay).toHaveBeenCalled();
  });

  it("タイトルが空の場合、デフォルトのタイトルを使用すること", () => {
    renderHook(() =>
      useMediaSession({
        title: "",
        isPlaying: false,
      })
    );

    // タイトルが空でもデフォルト値でメタデータを設定する
    expect(mockMediaSession.metadata).toEqual(
      expect.objectContaining({
        title: "記事を読み上げ中",
        artist: "Audicle",
      })
    );
  });

  it("アンマウント時にアクションハンドラがクリアされること", () => {
    const { unmount } = renderHook(() =>
      useMediaSession({
        title: "テスト記事",
        isPlaying: false,
      })
    );

    unmount();

    // nullでハンドラがクリアされることを確認
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("play", null);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("pause", null);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("nexttrack", null);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("previoustrack", null);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("stop", null);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekto", null);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekforward", null);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekbackward", null);
  });
});

describe('Media Session API 未対応環境', () => {
  let originalNavigator: Navigator;

  beforeEach(() => {
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  it('navigator.mediaSession が undefined でもエラーが発生しないこと', () => {
    // navigator.mediaSession を undefined にする
    Object.defineProperty(global, "navigator", {
      value: {
        ...originalNavigator,
        mediaSession: undefined,
      },
      writable: true,
      configurable: true,
    });

    expect(() => {
      renderHook(() =>
        useMediaSession({
          title: "テスト記事",
          isPlaying: false,
        })
      );
    }).not.toThrow();
  });
});
