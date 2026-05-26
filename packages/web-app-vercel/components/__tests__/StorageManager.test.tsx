import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import StorageManager from "../StorageManager";
import * as indexedDB from "@/lib/indexedDB";
import * as ConfirmDialogHook from "@/components/ConfirmDialog";

// モック化
jest.mock("@/lib/indexedDB");
jest.mock("@/components/ConfirmDialog");
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe("StorageManager Component", () => {
  const mockArticles: indexedDB.DownloadedArticle[] = [
    {
      url: "https://example.com/article1",
      totalChunks: 5,
      downloadedChunks: 5,
      totalSize: 5000000, // 約 4.77 MB
      timestamp: 1672531200000, // 2023-01-01 00:00:00 (JSTだと 09:00:00)
      voiceModel: "test-model",
    },
    {
      url: "https://example.com/article2",
      totalChunks: 3,
      downloadedChunks: 1, // 部分的
      totalSize: 1000000, // 約 976.56 KB
      timestamp: 1672617600000, // 2023-01-02 00:00:00 (JSTだと 09:00:00)
    },
  ];

  const mockUsage = {
    used: 6000000, // 約 5.72 MB
    available: 100000000,
  };

  const mockShowConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモック実装
    (indexedDB.getDownloadedArticles as jest.Mock).mockResolvedValue(mockArticles);
    (indexedDB.getStorageUsage as jest.Mock).mockResolvedValue(mockUsage);
    (indexedDB.deleteArticle as jest.Mock).mockResolvedValue(undefined);
    (indexedDB.clearAll as jest.Mock).mockResolvedValue(undefined);

    (ConfirmDialogHook.useConfirmDialog as jest.Mock).mockReturnValue({
      showConfirm: mockShowConfirm,
      confirmDialog: <div data-testid="confirm-dialog" />,
    });
  });

  it("ローディング状態が正しく表示されること", async () => {
    // 解決を遅延させる
    (indexedDB.getDownloadedArticles as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockArticles), 100))
    );

    render(<StorageManager />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("データが正しく読み込まれて表示されること", async () => {
    render(<StorageManager />);

    // ローディングが完了するのを待つ
    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    // ストレージ使用量の表示確認 (5.72 MB)
    expect(screen.getByText("ストレージ使用量")).toBeInTheDocument();
    expect(screen.getByText("5.72 MB")).toBeInTheDocument();

    // 記事1の表示確認
    expect(screen.getByText("https://example.com/article1")).toBeInTheDocument();
    expect(screen.getByText("5 / 5 チャンク")).toBeInTheDocument();
    expect(screen.getByText("4.77 MB")).toBeInTheDocument();
    expect(screen.getByText("✓ 完全")).toBeInTheDocument();

    // 記事2の表示確認
    expect(screen.getByText("https://example.com/article2")).toBeInTheDocument();
    expect(screen.getByText("1 / 3 チャンク")).toBeInTheDocument();
    expect(screen.getByText("976.56 KB")).toBeInTheDocument();
    expect(screen.getByText("⚠ 部分的")).toBeInTheDocument();
  });

  it("データが空の場合、適切なメッセージが表示されること", async () => {
    (indexedDB.getDownloadedArticles as jest.Mock).mockResolvedValue([]);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.getByText("ダウンロード済みの記事がありません")).toBeInTheDocument();
    });

    // 全て削除ボタンが表示されていないこと
    expect(screen.queryByRole("button", { name: "全て削除" })).not.toBeInTheDocument();
  });

  it("記事の削除が正しく機能すること", async () => {
    mockShowConfirm.mockResolvedValue(true);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    // 最初が記事1の削除ボタン
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "音声データを削除",
          message: expect.stringContaining("https://example.com/article1"),
        })
      );
    });

    await waitFor(() => {
      expect(indexedDB.deleteArticle).toHaveBeenCalledWith("https://example.com/article1");
      // データが再読み込みされること
      expect(indexedDB.getDownloadedArticles).toHaveBeenCalledTimes(2);
    });
  });

  it("記事の削除をキャンセルした場合は処理が中断されること", async () => {
    mockShowConfirm.mockResolvedValue(false); // キャンセル

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });

    // 削除処理は呼ばれない
    expect(indexedDB.deleteArticle).not.toHaveBeenCalled();
    // 再読み込みもされない
    expect(indexedDB.getDownloadedArticles).toHaveBeenCalledTimes(1);
  });

  it("記事の削除に失敗した場合はエラーが表示されること", async () => {
    mockShowConfirm.mockResolvedValue(true);
    (indexedDB.deleteArticle as jest.Mock).mockRejectedValue(new Error("削除エラー"));

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("削除に失敗しました")).toBeInTheDocument();
    });
  });

  it("全てのデータの削除が正しく機能すること", async () => {
    mockShowConfirm.mockResolvedValue(true);

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    const clearAllButton = screen.getByRole("button", { name: "全て削除" });
    fireEvent.click(clearAllButton);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "全ての音声データを削除",
        })
      );
    });

    await waitFor(() => {
      expect(indexedDB.clearAll).toHaveBeenCalled();
      // データが再読み込みされること
      expect(indexedDB.getDownloadedArticles).toHaveBeenCalledTimes(2);
    });
  });

  it("データの読み込みに失敗した場合はエラー処理されること", async () => {
    (indexedDB.getDownloadedArticles as jest.Mock).mockRejectedValue(new Error("読込エラー"));

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });

    // エラーが起きた場合も、クラッシュせずに空のリストなどとして表示されること（現状の実装では空リストになる）
    expect(screen.getByText("ダウンロード済みの記事がありません")).toBeInTheDocument();
  });
});
