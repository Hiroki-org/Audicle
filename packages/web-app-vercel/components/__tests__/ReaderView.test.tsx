import { render, screen } from "@testing-library/react";
import ReaderView from "../ReaderView";
import type { Chunk } from "@/types/api";

// Mock dependencies
jest.mock("@/hooks/useDownload", () => ({
  useDownload: jest.fn(() => ({
    status: "idle",
    progress: 0,
    error: null,
    estimatedTime: null,
    startDownload: jest.fn(),
    cancelDownload: jest.fn(),
  })),
}));

jest.mock("@/hooks/useAutoScroll", () => ({
  useAutoScroll: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
  },
}));

// Mock child components
jest.mock("../ReaderChunk", () => ({
  __esModule: true,
  default: ({ chunk, isActive, onClick }: any) => (
    <div
      data-testid={`reader-chunk-${chunk.id}`}
      data-active={isActive}
      onClick={() => onClick(chunk.id)}
    >
      {chunk.text}
    </div>
  ),
}));

jest.mock("../DownloadPanel", () => ({
  __esModule: true,
  default: ({ status }: any) => (
    <div data-testid="download-panel">Status: {status}</div>
  ),
}));

describe("ReaderView", () => {
  const mockChunks: Chunk[] = [
    { id: "c1", text: "Chunk 1", type: "p" },
    { id: "c2", text: "Chunk 2", type: "p" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("チャンクが提供されない場合、空の状態をレンダリングすること", () => {
    render(
      <ReaderView
        chunks={[]}
        articleUrl=""
        voiceModel="ja-JP"
        speed={1}
        onChunkClick={jest.fn()}
      />
    );

    expect(
      screen.getByText("読み上げたい記事のURLを入力してください")
    ).toBeInTheDocument();
  });

  it("チャンクが提供された場合、チャンクとダウンロードパネルをレンダリングすること", () => {
    render(
      <ReaderView
        chunks={mockChunks}
        articleUrl="https://example.com"
        currentChunkId="c1"
        voiceModel="ja-JP"
        speed={1}
        onChunkClick={jest.fn()}
      />
    );

    expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    expect(screen.getByTestId("reader-chunk-c1")).toBeInTheDocument();
    expect(screen.getByTestId("reader-chunk-c2")).toBeInTheDocument();
    expect(screen.getByText("Chunk 1")).toBeInTheDocument();
    expect(screen.getByText("Chunk 2")).toBeInTheDocument();
  });

  it("アクティブなチャンクがハイライトされること", () => {
    render(
      <ReaderView
        chunks={mockChunks}
        articleUrl="https://example.com"
        currentChunkId="c1"
        voiceModel="ja-JP"
        speed={1}
        onChunkClick={jest.fn()}
      />
    );

    const chunk1 = screen.getByTestId("reader-chunk-c1");
    const chunk2 = screen.getByTestId("reader-chunk-c2");

    expect(chunk1).toHaveAttribute("data-active", "true");
    expect(chunk2).toHaveAttribute("data-active", "false");
  });

  it("チャンクがクリックされたときにonChunkClickが呼び出されること", () => {
    const mockOnChunkClick = jest.fn();
    render(
      <ReaderView
        chunks={mockChunks}
        articleUrl="https://example.com"
        currentChunkId="c1"
        voiceModel="ja-JP"
        speed={1}
        onChunkClick={mockOnChunkClick}
      />
    );

    const chunk2 = screen.getByTestId("reader-chunk-c2");
    chunk2.click();

    expect(mockOnChunkClick).toHaveBeenCalledWith("c2");
  });

  describe("Edge cases and error handling", () => {
    it("currentChunkIdが存在しないIDの場合でもレンダリングできること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          currentChunkId="non-existent-id"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
      expect(screen.getByTestId("reader-chunk-c1")).toBeInTheDocument();
    });

    it("大量のチャンクでもレンダリングできること", () => {
      const manyChunks: Chunk[] = Array.from({ length: 100 }, (_, i) => ({
        id: `chunk-${i}`,
        text: `Chunk ${i} content`,
        type: "p",
      }));

      render(
        <ReaderView
          chunks={manyChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
      expect(screen.getByTestId("reader-chunk-chunk-0")).toBeInTheDocument();
      expect(screen.getByTestId("reader-chunk-chunk-99")).toBeInTheDocument();
    });

    it("特殊文字を含むテキストでもレンダリングできること", () => {
      const specialChunks: Chunk[] = [
        { id: "c1", text: "=== Header ===", type: "h1" },
        { id: "c2", text: "--- Separator ---", type: "p" },
        { id: "c3", text: "*** Bold ***", type: "p" },
      ];

      render(
        <ReaderView
          chunks={specialChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByText("=== Header ===")).toBeInTheDocument();
      expect(screen.getByText("--- Separator ---")).toBeInTheDocument();
      expect(screen.getByText("*** Bold ***")).toBeInTheDocument();
    });

    it("空のテキストを含むチャンクでもレンダリングできること", () => {
      const emptyTextChunks: Chunk[] = [
        { id: "c1", text: "", type: "p" },
        { id: "c2", text: "Normal text", type: "p" },
      ];

      render(
        <ReaderView
          chunks={emptyTextChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("reader-chunk-c1")).toBeInTheDocument();
      expect(screen.getByText("Normal text")).toBeInTheDocument();
    });
  });

  describe("Voice model and speed props", () => {
    it("異なる音声モデルでレンダリングできること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          voiceModel="en-US"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    });

    it("異なる速度でレンダリングできること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          speed={2.0}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    });

    it("速度が0の場合でもレンダリングできること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          speed={0}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    });
  });

  describe("Optional props handling", () => {
    it("onChunkClickが未定義でもクリックイベントを処理できること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          speed={1}
        />
      );

      const chunk1 = screen.getByTestId("reader-chunk-c1");
      // Should not throw error even without onChunkClick
      expect(() => chunk1.click()).not.toThrow();
    });

    it("voiceModelが未定義でもレンダリングできること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    });

    it("speedが未定義でもレンダリングできること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    });
  });

  describe("Different chunk types", () => {
    it("さまざまなチャンクタイプをレンダリングできること", () => {
      const diverseChunks: Chunk[] = [
        { id: "c1", text: "Heading 1", type: "h1" },
        { id: "c2", text: "Heading 2", type: "h2" },
        { id: "c3", text: "Heading 3", type: "h3" },
        { id: "c4", text: "Paragraph", type: "p" },
        { id: "c5", text: "List item", type: "li" },
        { id: "c6", text: "Blockquote", type: "blockquote" },
      ];

      render(
        <ReaderView
          chunks={diverseChunks}
          articleUrl="https://example.com"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByText("Heading 1")).toBeInTheDocument();
      expect(screen.getByText("Heading 2")).toBeInTheDocument();
      expect(screen.getByText("Heading 3")).toBeInTheDocument();
      expect(screen.getByText("Paragraph")).toBeInTheDocument();
      expect(screen.getByText("List item")).toBeInTheDocument();
      expect(screen.getByText("Blockquote")).toBeInTheDocument();
    });
  });

  describe("Multiple active chunks", () => {
    it("アクティブなチャンクが切り替わったときに正しくハイライトされること", () => {
      const { rerender } = render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          currentChunkId="c1"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("reader-chunk-c1")).toHaveAttribute(
        "data-active",
        "true"
      );
      expect(screen.getByTestId("reader-chunk-c2")).toHaveAttribute(
        "data-active",
        "false"
      );

      // Switch active chunk
      rerender(
        <ReaderView
          chunks={mockChunks}
          articleUrl="https://example.com"
          currentChunkId="c2"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("reader-chunk-c1")).toHaveAttribute(
        "data-active",
        "false"
      );
      expect(screen.getByTestId("reader-chunk-c2")).toHaveAttribute(
        "data-active",
        "true"
      );
    });
  });

  describe("ArticleUrl variations", () => {
    it("複雑なURLでもレンダリングできること", () => {
      const complexUrl =
        "https://example.com/article?param1=value1&param2=value2#section";
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl={complexUrl}
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    });

    it("無効なURLでも正しく処理されること", () => {
      render(
        <ReaderView
          chunks={mockChunks}
          articleUrl="not-a-valid-url"
          voiceModel="ja-JP"
          speed={1}
          onChunkClick={jest.fn()}
        />
      );

      expect(screen.getByTestId("download-panel")).toBeInTheDocument();
    });
  });
