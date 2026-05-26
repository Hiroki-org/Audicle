import { render, screen, waitFor } from "@testing-library/react";
import StorageManager from "../StorageManager";
import { getDownloadedArticles, getStorageUsage } from "@/lib/indexedDB";

jest.mock("@/lib/indexedDB", () => ({
  getDownloadedArticles: jest.fn(),
  getStorageUsage: jest.fn(),
  deleteArticle: jest.fn(),
  clearAll: jest.fn(),
}));

jest.mock("@/components/ConfirmDialog", () => ({
  useConfirmDialog: jest.fn(() => ({
    showConfirm: jest.fn(),
    confirmDialog: null,
  })),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe("StorageManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should display empty state message when there are no downloaded articles", async () => {
    (getDownloadedArticles as jest.Mock).mockResolvedValue([]);
    (getStorageUsage as jest.Mock).mockResolvedValue({ used: 0, available: 1000 });

    render(<StorageManager />);

    await waitFor(() => {
      expect(screen.getByText("ダウンロード済みの記事がありません")).toBeInTheDocument();
    });
  });
});
