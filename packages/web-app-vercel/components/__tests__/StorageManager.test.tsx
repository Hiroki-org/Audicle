import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StorageManager from "../StorageManager";
import { getDownloadedArticles, getStorageUsage, deleteArticle, clearAll } from "@/lib/indexedDB";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { logger } from "@/lib/logger";

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

  beforeEach(() => {
    jest.resetAllMocks();
    (useConfirmDialog as jest.Mock).mockReturnValue({
      showConfirm: mockShowConfirm,
      confirmDialog: <div data-testid="mock-confirm-dialog" />,
    });
  });

  it("renders loading state initially", () => {
    (getDownloadedArticles as jest.Mock).mockReturnValue(new Promise(() => {}));
    (getStorageUsage as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<StorageManager />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("renders empty state when no articles are downloaded", async () => {
    (getDownloadedArticles as jest.Mock).mockResolvedValue([]);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 0, available: 100000 });

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("0 B")).toBeInTheDocument();
    expect(screen.getByText("ダウンロード済みの記事がありません")).toBeInTheDocument();
  });

  it("renders articles correctly", async () => {
    const mockArticles = [
      {
        url: "https://example.com/1",
        totalChunks: 3,
        downloadedChunks: 3,
        totalSize: 1024 * 1024 * 5, // 5MB
        timestamp: 1672531200000, // 2023-01-01T00:00:00.000Z
      },
      {
        url: "https://example.com/2",
        totalChunks: 5,
        downloadedChunks: 2,
        totalSize: 1024 * 1024 * 2, // 2MB
        timestamp: 1672617600000,
      }
    ];

    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 1024 * 1024 * 7, available: 100000000 });

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("7.00 MB")).toBeInTheDocument(); // Storage

    // Check article 1 (Complete)
    expect(screen.getByText("https://example.com/1")).toBeInTheDocument();
    expect(screen.getByText("3 / 3 チャンク")).toBeInTheDocument();
    expect(screen.getByText("✓ 完全")).toBeInTheDocument();
    expect(screen.getByText("5.00 MB")).toBeInTheDocument();

    // Check article 2 (Partial)
    expect(screen.getByText("https://example.com/2")).toBeInTheDocument();
    expect(screen.getByText("2 / 5 チャンク")).toBeInTheDocument();
    expect(screen.getByText("⚠ 部分的")).toBeInTheDocument();
    expect(screen.getByText("2.00 MB")).toBeInTheDocument();
  });

  it("handles loading error", async () => {
    (getDownloadedArticles as jest.Mock).mockRejectedValue(new Error("Failed to load"));
    (getStorageUsage as jest.Mock).mockRejectedValue(new Error("Failed to load"));

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    expect(logger.error).toHaveBeenCalledWith("ストレージ情報の読み込みに失敗", expect.any(Error));
  });

  it("handles article deletion when confirmed", async () => {
    const mockArticles = [{ url: "https://example.com/1", totalChunks: 3, downloadedChunks: 3, totalSize: 5242880, timestamp: 1672531200000 }];
    (getDownloadedArticles as jest.Mock).mockResolvedValueOnce(mockArticles).mockResolvedValueOnce([]);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 5242880, available: 100000000 });
    (deleteArticle as jest.Mock).mockResolvedValue(undefined);
    mockShowConfirm.mockResolvedValue(true);

    render(<StorageManager />);

    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());

    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(deleteArticle).toHaveBeenCalledWith("https://example.com/1"));
    await waitFor(() => expect(screen.getByText("ダウンロード済みの記事がありません")).toBeInTheDocument());
  });

  it("does not delete article if not confirmed", async () => {
    const mockArticles = [{ url: "https://example.com/1", totalChunks: 3, downloadedChunks: 3, totalSize: 5242880, timestamp: 1672531200000 }];
    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 5242880, available: 100000000 });
    mockShowConfirm.mockResolvedValue(false);

    render(<StorageManager />);

    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());

    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
    expect(deleteArticle).not.toHaveBeenCalled();
  });

  it("handles deletion error", async () => {
    const mockArticles = [{ url: "https://example.com/1", totalChunks: 3, downloadedChunks: 3, totalSize: 5242880, timestamp: 1672531200000 }];
    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 5242880, available: 100000000 });
    (deleteArticle as jest.Mock).mockRejectedValue(new Error("Delete failed"));
    mockShowConfirm.mockResolvedValue(true);

    render(<StorageManager />);

    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());

    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(screen.getByText("削除に失敗しました")).toBeInTheDocument());
  });

  it("handles clear all when confirmed", async () => {
    const mockArticles = [{ url: "https://example.com/1", totalChunks: 3, downloadedChunks: 3, totalSize: 5242880, timestamp: 1672531200000 }];
    (getDownloadedArticles as jest.Mock).mockResolvedValueOnce(mockArticles).mockResolvedValueOnce([]);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 5242880, available: 100000000 });
    (clearAll as jest.Mock).mockResolvedValue(undefined);
    mockShowConfirm.mockResolvedValue(true);

    render(<StorageManager />);

    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());

    const clearAllButton = screen.getByRole("button", { name: "全て削除" });
    fireEvent.click(clearAllButton);

    await waitFor(() => expect(clearAll).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("ダウンロード済みの記事がありません")).toBeInTheDocument());
  });

  it("does not clear all if not confirmed", async () => {
    const mockArticles = [{ url: "https://example.com/1", totalChunks: 3, downloadedChunks: 3, totalSize: 5242880, timestamp: 1672531200000 }];
    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 5242880, available: 100000000 });
    mockShowConfirm.mockResolvedValue(false);

    render(<StorageManager />);

    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());

    const clearAllButton = screen.getByRole("button", { name: "全て削除" });
    fireEvent.click(clearAllButton);

    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
    expect(clearAll).not.toHaveBeenCalled();
    expect(screen.getByText("https://example.com/1")).toBeInTheDocument();
  });

  it("handles clear all error", async () => {
    const mockArticles = [{ url: "https://example.com/1", totalChunks: 3, downloadedChunks: 3, totalSize: 5242880, timestamp: 1672531200000 }];
    const clearError = new Error("Clear failed");
    (getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 5242880, available: 100000000 });
    (clearAll as jest.Mock).mockRejectedValue(clearError);
    mockShowConfirm.mockResolvedValue(true);

    render(<StorageManager />);

    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());

    const clearAllButton = screen.getByRole("button", { name: "全て削除" });
    fireEvent.click(clearAllButton);

    await waitFor(() => expect(screen.getByText("削除に失敗しました")).toBeInTheDocument());
    expect(logger.error).toHaveBeenCalledWith("全削除に失敗", clearError);
  });
});
