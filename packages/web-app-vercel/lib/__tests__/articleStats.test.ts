import { calculateCacheStats, recordArticleStats } from "../articleStats";
import { Chunk } from "@/types/api";
import { getArticleChunks } from "../indexedDB";

import { logger } from "../logger";
jest.mock("../logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/**
 * articleStats.test.ts
 * calculateCacheStats 関数の単体テスト
 */

// getArticleChunks をモック化
jest.mock("../indexedDB", () => ({
  getArticleChunks: jest.fn(),
}));

describe("calculateCacheStats", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    jest.resetAllMocks();
  });

  /**
   * テストケース 1: 全ヒット
   * すべてのチャンクがキャッシュ済み → isFullyCached: true
   */
  it("should return isFullyCached: true when all chunks are cached", async () => {
    const testUrl = "https://example.com/article1";
    const chunks: Chunk[] = [
      { id: "1", text: "chunk1", cleanedText: "chunk1", type: "text" },
      { id: "2", text: "chunk2", cleanedText: "chunk2", type: "text" },
      { id: "3", text: "chunk3", cleanedText: "chunk3", type: "text" },
    ];

    // モック設定：全てのチャンクが存在
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk1",
      },
      {
        chunkIndex: 1,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk2",
      },
      {
        chunkIndex: 2,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk3",
      },
    ]);

    const result = await calculateCacheStats(testUrl, chunks);

    expect(result).toEqual({
      cacheHits: 3,
      cacheMisses: 0,
      isFullyCached: true,
    });
  });

  /**
   * テストケース 2: 一部ヒット
   * 一部のチャンクのみキャッシュ済み → isFullyCached: false
   */
  it("should return isFullyCached: false when only some chunks are cached", async () => {
    const testUrl = "https://example.com/article2";
    const chunks: Chunk[] = [
      { id: "1", text: "chunk1", cleanedText: "chunk1", type: "text" },
      { id: "2", text: "chunk2", cleanedText: "chunk2", type: "text" },
      { id: "3", text: "chunk3", cleanedText: "chunk3", type: "text" },
      { id: "4", text: "chunk4", cleanedText: "chunk4", type: "text" },
    ];

    // モック設定：インデックス 0, 2 のみ存在
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk1",
      },
      {
        chunkIndex: 2,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk3",
      },
    ]);

    const result = await calculateCacheStats(testUrl, chunks);

    expect(result).toEqual({
      cacheHits: 2,
      cacheMisses: 2,
      isFullyCached: false,
    });
  });

  /**
   * テストケース 3: キャッシュなし
   * キャッシュが空 → cacheHits: 0
   */
  it("should return cacheHits: 0 when no chunks are cached", async () => {
    const testUrl = "https://example.com/article3";
    const chunks: Chunk[] = [
      { id: "1", text: "chunk1", cleanedText: "chunk1", type: "text" },
      { id: "2", text: "chunk2", cleanedText: "chunk2", type: "text" },
    ];

    // モック設定：キャッシュなし
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([]);

    const result = await calculateCacheStats(testUrl, chunks);

    expect(result).toEqual({
      cacheHits: 0,
      cacheMisses: 2,
      isFullyCached: false,
    });
  });

  /**
   * テストケース 4: エラーハンドリング
   * getArticleChunks がエラーを投げた場合 → フォールバック値を返す
   */
  it("should return fallback values when getArticleChunks throws an error", async () => {
    const testUrl = "https://example.com/article4";
    const chunks: Chunk[] = [
      { id: "1", text: "chunk1", cleanedText: "chunk1", type: "text" },
      { id: "2", text: "chunk2", cleanedText: "chunk2", type: "text" },
    ];

    // モック設定：エラーを投げる
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockRejectedValue(new Error("IndexedDB error"));

    const result = await calculateCacheStats(testUrl, chunks);

    // エラー時はすべてキャッシュミスとして扱う
    expect(result).toEqual({
      cacheHits: 0,
      cacheMisses: 2,
      isFullyCached: false,
    });
  });

  /**
   * テストケース 5: 範囲外インデックス
   * chunkIndex が負数または配列長超過 → 無視される
   */
  it("should ignore out-of-range chunkIndex values", async () => {
    const testUrl = "https://example.com/article5";
    const chunks: Chunk[] = [
      { id: "1", text: "chunk1", cleanedText: "chunk1", type: "text" },
      { id: "2", text: "chunk2", cleanedText: "chunk2", type: "text" },
    ];

    // モック設定：有効なインデックス（0）と無効なインデックス（-1, 2, 3）を混在
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk1",
      },
      {
        chunkIndex: -1,
        audioData: new ArrayBuffer(100),
        synthesizedText: "negative",
      }, // 無視される
      {
        chunkIndex: 2,
        audioData: new ArrayBuffer(100),
        synthesizedText: "out-of-range",
      }, // 無視される
      {
        chunkIndex: 3,
        audioData: new ArrayBuffer(100),
        synthesizedText: "also-out",
      }, // 無視される
    ]);

    const result = await calculateCacheStats(testUrl, chunks);

    // 有効なのはインデックス 0 のみ
    expect(result).toEqual({
      cacheHits: 1,
      cacheMisses: 1,
      isFullyCached: false,
    });
  });

  /**
   * テストケース 6: 重複するインデックス
   * 同じ chunkIndex が複数回存在 → Set により重複は自動排除
   */
  it("should handle duplicate chunkIndex values correctly", async () => {
    const testUrl = "https://example.com/article6";
    const chunks: Chunk[] = [
      { id: "1", text: "chunk1", cleanedText: "chunk1", type: "text" },
      { id: "2", text: "chunk2", cleanedText: "chunk2", type: "text" },
      { id: "3", text: "chunk3", cleanedText: "chunk3", type: "text" },
    ];

    // モック設定：インデックス 0, 1 が重複
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk1",
      },
      {
        chunkIndex: 0,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk1-dup",
      }, // 重複
      {
        chunkIndex: 1,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk2",
      },
      {
        chunkIndex: 1,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk2-dup",
      }, // 重複
    ]);

    const result = await calculateCacheStats(testUrl, chunks);

    // Set により重複は自動排除されるため、ヒット数は 2
    expect(result).toEqual({
      cacheHits: 2,
      cacheMisses: 1,
      isFullyCached: false,
    });
  });

  /**
   * テストケース 7: 空のチャンク配列
   * chunks が空 → cacheHits: 0, isFullyCached: false
   */
  it("should return correct values for empty chunks array", async () => {
    const testUrl = "https://example.com/article7";
    const chunks: Chunk[] = [];

    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk1",
      },
    ]);

    const result = await calculateCacheStats(testUrl, chunks);

    // チャンクが空なので isFullyCached は false
    expect(result).toEqual({
      cacheHits: 0,
      cacheMisses: 0,
      isFullyCached: false,
    });
  });
});

describe("recordArticleStats", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    // Setup crypto for SHA-256 mock
    Object.defineProperty(global, "crypto", {
      value: {
        subtle: {
          digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
        },
      },
      writable: true,
    });

    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockParams = {
    url: "https://example.com/test-article",
    title: "Test Article",
    content: "Test content for hashing",
    chunks: [
      { id: "1", text: "chunk1", cleanedText: "chunk1", type: "text" as const },
    ],
  };

  it("should record stats successfully when fetch succeeds", async () => {
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        audioData: new ArrayBuffer(100),
        synthesizedText: "chunk1",
      },
    ]);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ accessCount: 1, cacheHitRate: 100 }),
    });

    await recordArticleStats(mockParams);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/stats/article",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining(
          '"cacheHits":1,"cacheMisses":0,"isFullyCached":true',
        ),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/stats/article",
      expect.objectContaining({
        body: expect.stringContaining('"domain":"example.com"'),
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      "記事統計を記録",
      expect.objectContaining({
        url: mockParams.url,
        accessCount: 1,
        cacheHitRate: 100,
      }),
    );
  });

  it("should log a warning when fetch fails with non-ok status", async () => {
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([]);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await recordArticleStats(mockParams);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "記事統計の記録に失敗",
      expect.objectContaining({
        status: 500,
        url: mockParams.url,
      }),
    );
  });

  it("should retry on network errors (ECONNRESET/aborted) and throw after max retries", async () => {
    jest.useFakeTimers();
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([]);

    const networkError = new Error("fetch failed with ECONNRESET");
    (global.fetch as jest.Mock).mockRejectedValue(networkError);

    // start the promise
    const promise = recordArticleStats(mockParams);

    // Wait for all microtasks to drain (so fetch is called and setTimeout is queued)
    for (let i = 0; i < 5; i++) await Promise.resolve();
    jest.advanceTimersByTime(1000); // Trigger 1st retry

    for (let i = 0; i < 5; i++) await Promise.resolve();
    jest.advanceTimersByTime(1000); // Trigger 2nd retry

    for (let i = 0; i < 5; i++) await Promise.resolve();

    await promise;

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Fetch attempt 1 failed"),
      expect.any(String),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "記事統計記録エラー",
      expect.any(Error),
    );

    jest.useRealTimers();
  });

  it("should throw error immediately for non-network errors", async () => {
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([]);

    const nonNetworkError = new Error("some other error");
    (global.fetch as jest.Mock).mockRejectedValue(nonNetworkError);

    await recordArticleStats(mockParams);

    // Should only be called once, no retries
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "記事統計記録エラー",
      nonNetworkError,
    );
  });

  it("should extract domain as unknown if URL is invalid", async () => {
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    mockedGetArticleChunks.mockResolvedValue([]);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    await recordArticleStats({
      ...mockParams,
      url: "invalid-url", // Invalid URL to trigger extractDomain catch block
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/stats/article",
      expect.objectContaining({
        body: expect.stringContaining('"domain":"unknown"'),
      }),
    );
  });

  it("should not throw an exception on unexpected errors", async () => {
    const mockedGetArticleChunks = getArticleChunks as jest.MockedFunction<
      typeof getArticleChunks
    >;
    // Cause an unexpected error in cache calculation or earlier that bypasses retry
    const unexpectedError = new TypeError("Some unexpected type error");
    (global.fetch as jest.Mock).mockRejectedValue(unexpectedError);

    // recordArticleStats catches all errors
    await recordArticleStats(mockParams);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "記事統計記録エラー",
      unexpectedError,
    );
  });
});
