import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import StorageManager from "../StorageManager";
import {
  getDownloadedArticles,
  getStorageUsage,
  deleteArticle,
  clearAll,
} from "@/lib/indexedDB";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { logger } from "@/lib/logger";

// モックの設定
jest.mock("@/lib/indexedDB", () => ({
  getDownloadedArticles: jest.fn(),
  getStorageUsage: jest.fn(),
  deleteArticle: jest.fn(),
  clearAll: jest.fn(),
}));

jest.mock("@/components/ConfirmDialog", () => ({
  useConfirmDialog: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe("StorageManager", () => {
  const mockShowConfirm = jest.fn();
  const mockConfirmDialog = <div data-testid="confirm-dialog"></div>;

  beforeEach(() => {
    jest.clearAllMocks();

    (useConfirmDialog as jest.Mock).mockReturnValue({
      showConfirm: mockShowConfirm,
      confirmDialog: mockConfirmDialog,
    });

    (getStorageUsage as jest.Mock).mockResolvedValue({
      used: 1024 * 1024 * 5, // 5MB
      available: 1024 * 1024 * 100, // 100MB
    });
  });

  it("初期状態ではローディング画面を表示する", () => {
    (getDownloadedArticles as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<StorageManager />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("記事がない場合は空の状態を表示する", async () => {
    (getDownloadedArticles as jest.Mock).mockResolvedValue([]);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("ストレージ使用量")).toBeInTheDocument();
    expect(screen.getByText("5.00 MB")).toBeInTheDocument();
    expect(screen.getByText("ダウンロード済みの記事がありません")).toBeInTheDocument();
  });

  it("ダウンロード済みの記事一覧を表示する", async () => {
    const mockArticles = [
      {
        url: "https://example.com/article1",
        totalChunks: 10,
        downloadedChunks: 10,
        totalSize: 1024 * 1024 * 2, // 2MB
        timestamp: 1672531200000, // 2023-01-01
        voiceModel: "alloy",
      },
      {
        url: "https://example.com/article2",
        totalChunks: 5,
        downloadedChunks: 3,
        totalSize: 1024 * 1024 * 1, // 1MB
        timestamp: 1672617600000, // 2023-01-02
        voiceModel: "echo",
      },
    ];

    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    // 記事1 (完全)
    expect(screen.getByText("https://example.com/article1")).toBeInTheDocument();
    expect(screen.getByText("10 / 10 チャンク")).toBeInTheDocument();
    expect(screen.getByText("2.00 MB")).toBeInTheDocument();
    expect(screen.getByText("✓ 完全")).toBeInTheDocument();

    // 記事2 (部分的)
    expect(screen.getByText("https://example.com/article2")).toBeInTheDocument();
    expect(screen.getByText("3 / 5 チャンク")).toBeInTheDocument();
    expect(screen.getByText("1.00 MB")).toBeInTheDocument();
    expect(screen.getByText("⚠ 部分的")).toBeInTheDocument();
  });

  it("記事を削除できる", async () => {
    const mockArticles = [
      {
        url: "https://example.com/article-to-delete",
        totalChunks: 5,
        downloadedChunks: 5,
        totalSize: 1024 * 1024,
        timestamp: Date.now(),
        voiceModel: "alloy",
      },
    ];

    (getDownloadedArticles as jest.Mock).mockResolvedValueOnce(mockArticles);
    mockShowConfirm.mockResolvedValueOnce(true); // 確認ダイアログで「はい」を選択
    (deleteArticle as jest.Mock).mockResolvedValueOnce(undefined);

    // 再読み込み用のモック
    (getDownloadedArticles as jest.Mock).mockResolvedValueOnce([]);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 0, available: 100 });

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteButton);

    expect(mockShowConfirm).toHaveBeenCalledWith({
      title: "音声データを削除",
      message: "「https://example.com/article-to-delete」の音声データを削除しますか?",
      confirmText: "削除",
      cancelText: "キャンセル",
      isDangerous: true,
    });

    await waitFor(() => {
      expect(deleteArticle).toHaveBeenCalledWith("https://example.com/article-to-delete");
      expect(logger.success).toHaveBeenCalledWith("記事を削除", { url: "https://example.com/article-to-delete" });
    });
  });

  it("記事の削除をキャンセルできる", async () => {
    const mockArticles = [
      {
        url: "https://example.com/article-to-keep",
        totalChunks: 5,
        downloadedChunks: 5,
        totalSize: 1024 * 1024,
        timestamp: Date.now(),
        voiceModel: "alloy",
      },
    ];

    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    mockShowConfirm.mockResolvedValueOnce(false); // 確認ダイアログで「キャンセル」を選択

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });

    expect(deleteArticle).not.toHaveBeenCalled();
  });

  it("全ての記事を削除できる", async () => {
    const mockArticles = [
      {
        url: "https://example.com/article1",
        totalChunks: 1,
        downloadedChunks: 1,
        totalSize: 1024,
        timestamp: Date.now(),
      },
    ];

    (getDownloadedArticles as jest.Mock).mockResolvedValueOnce(mockArticles);
    mockShowConfirm.mockResolvedValueOnce(true);
    (clearAll as jest.Mock).mockResolvedValueOnce(undefined);

    // 再読み込み用のモック
    (getDownloadedArticles as jest.Mock).mockResolvedValueOnce([]);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const clearAllButton = screen.getByRole("button", { name: "全て削除" });
    fireEvent.click(clearAllButton);

    expect(mockShowConfirm).toHaveBeenCalledWith({
      title: "全ての音声データを削除",
      message: "全ての音声データを削除しますか? この操作は取り消せません。",
      confirmText: "全て削除",
      cancelText: "キャンセル",
      isDangerous: true,
    });

    await waitFor(() => {
      expect(clearAll).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith("全データを削除");
    });
  });

  it("データの読み込みに失敗した場合にエラーをログ出力する", async () => {
    const error = new Error("Failed to load");
    (getDownloadedArticles as jest.Mock).mockRejectedValueOnce(error);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    expect(logger.error).toHaveBeenCalledWith("ストレージ情報の読み込みに失敗", error);
  });

  it("記事の削除に失敗した場合にエラーメッセージを表示する", async () => {
    const mockArticles = [
      {
        url: "https://example.com/article1",
        totalChunks: 1,
        downloadedChunks: 1,
        totalSize: 1024,
        timestamp: Date.now(),
      },
    ];

    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    mockShowConfirm.mockResolvedValueOnce(true);

    const error = new Error("Failed to delete");
    (deleteArticle as jest.Mock).mockRejectedValueOnce(error);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith("記事の削除に失敗", error);
      expect(screen.getByText("削除に失敗しました")).toBeInTheDocument();
    });
  });

  it("全データの削除に失敗した場合にエラーメッセージを表示する", async () => {
    const mockArticles = [
      {
        url: "https://example.com/article1",
        totalChunks: 1,
        downloadedChunks: 1,
        totalSize: 1024,
        timestamp: Date.now(),
      },
    ];

    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    mockShowConfirm.mockResolvedValueOnce(true);

    const error = new Error("Failed to clear");
    (clearAll as jest.Mock).mockRejectedValueOnce(error);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const clearAllButton = screen.getByRole("button", { name: "全て削除" });
    fireEvent.click(clearAllButton);

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith("全削除に失敗", error);
      expect(screen.getByText("削除に失敗しました")).toBeInTheDocument();
    });
  });
});
