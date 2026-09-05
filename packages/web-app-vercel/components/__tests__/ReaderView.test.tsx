import { render, screen, fireEvent } from "@testing-library/react";
import ReaderView from "../ReaderView";
import { useDownload } from "@/hooks/useDownload";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { Chunk } from "@/types/api";

jest.mock("@/hooks/useDownload", () => ({
  useDownload: jest.fn(),
}));

jest.mock("@/hooks/useAutoScroll", () => ({
  useAutoScroll: jest.fn(),
}));

// ResizeObserver mock since it's missing in JSDOM
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe("ReaderView", () => {
  const mockChunks: Chunk[] = [
    { id: "1", type: "h1", text: "Article Title" },
    { id: "2", type: "p", text: "First paragraph" },
    { id: "3", type: "p", text: "Second paragraph" },
  ];

  const defaultDownloadMock = {
    status: "idle",
    progress: { current: 0, total: 0 },
    error: null,
    estimatedTime: 0,
    startDownload: jest.fn(),
    cancelDownload: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDownload as jest.Mock).mockReturnValue(defaultDownloadMock);
    (useAutoScroll as jest.Mock).mockReturnValue(undefined);
  });

  it("renders empty state when chunks are empty", () => {
    render(<ReaderView chunks={[]} />);
    expect(
      screen.getByText("読み上げたい記事のURLを入力してください")
    ).toBeInTheDocument();
    expect(
      screen.getByText("記事を解析して、読みやすいチャンクに分割したビューと音声ダウンロード機能を提供します。")
    ).toBeInTheDocument();
  });

  it("renders chunks correctly", () => {
    render(<ReaderView chunks={mockChunks} />);
    expect(screen.getByText("Article Title")).toBeInTheDocument();
    expect(screen.getByText("First paragraph")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph")).toBeInTheDocument();
  });

  it("calls onChunkClick when a chunk is clicked", () => {
    const onChunkClick = jest.fn();
    render(<ReaderView chunks={mockChunks} onChunkClick={onChunkClick} />);

    fireEvent.click(screen.getByText("First paragraph"));
    expect(onChunkClick).toHaveBeenCalledWith("2");
  });

  it("handles active chunk styling (passes currentChunkId)", () => {
    render(
      <ReaderView chunks={mockChunks} currentChunkId="2" />
    );
    // currentChunkId is passed down to ReaderChunk which applies styling.
    // The component shouldn't crash and chunks should be present.
    expect(screen.getByText("First paragraph")).toBeInTheDocument();
  });

  it("renders DownloadPanel with downloading status", () => {
    const cancelDownload = jest.fn();
    (useDownload as jest.Mock).mockReturnValue({
      ...defaultDownloadMock,
      status: "downloading",
      progress: { current: 5, total: 10 },
      estimatedTime: 120, // 2 minutes
      cancelDownload,
    });

    render(<ReaderView chunks={mockChunks} />);

    // Check progress text
    expect(screen.getByText("5 / 10 (50%)")).toBeInTheDocument();
    // Check status label
    expect(screen.getByText("音声ファイルを準備中...")).toBeInTheDocument();
    // Check estimated time
    expect(screen.getByText("残り約 2 分")).toBeInTheDocument();

    // Check cancel button
    const cancelButton = screen.getByRole("button", { name: "キャンセル" });
    fireEvent.click(cancelButton);
    expect(cancelDownload).toHaveBeenCalled();
  });

  it("renders DownloadPanel with error status", () => {
    (useDownload as jest.Mock).mockReturnValue({
      ...defaultDownloadMock,
      status: "error",
      error: "Network error occurred",
    });

    render(<ReaderView chunks={mockChunks} />);

    expect(screen.getByText("ダウンロードに失敗しました")).toBeInTheDocument();
    expect(screen.getByText("Network error occurred")).toBeInTheDocument();
  });

  it("uses useAutoScroll with correct activeChunkIndex", () => {
    render(<ReaderView chunks={mockChunks} currentChunkId="3" />);

    expect(useAutoScroll).toHaveBeenCalledWith(expect.objectContaining({
      activeChunkIndex: "3",
      enabled: true,
      delay: 0,
    }));
  });
});
