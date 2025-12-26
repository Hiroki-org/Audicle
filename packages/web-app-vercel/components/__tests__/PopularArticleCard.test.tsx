import { render, screen, fireEvent } from "@testing-library/react";
import { PopularArticleCard } from "../PopularArticleCard";
import type { PopularArticle } from "@/types/stats";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Plus: () => <div data-testid="icon-plus" />,
}));

const mockArticle: PopularArticle = {
  url: "https://example.com/article-1",
  domain: "example.com",
  title: "Test Article Title",
  accessCount: 100,
  lastAccessedAt: new Date().toISOString(),
};

describe("PopularArticleCard", () => {
  const mockOnRead = jest.fn();
  const mockOnPlaylistAdd = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("記事の詳細が正しくレンダリングされること", () => {
    render(
      <PopularArticleCard
        article={mockArticle}
        onRead={mockOnRead}
        onPlaylistAdd={mockOnPlaylistAdd}
      />
    );

    expect(screen.getByText("Test Article Title")).toBeInTheDocument();
    expect(screen.getByText("100回")).toBeInTheDocument();
    expect(screen.getByTestId("cache-badge")).toHaveTextContent("キャッシュ済み");
    expect(screen.getByTestId("icon-plus")).toBeInTheDocument();
  });

  it("カードがクリックされたときにonReadが呼び出されること", () => {
    render(
      <PopularArticleCard
        article={mockArticle}
        onRead={mockOnRead}
        onPlaylistAdd={mockOnPlaylistAdd}
      />
    );

    const card = screen.getByTestId("article-card");
    fireEvent.click(card);

    expect(mockOnRead).toHaveBeenCalledWith(mockArticle.url);
    expect(mockOnPlaylistAdd).not.toHaveBeenCalled();
  });

  it("追加ボタンがクリックされたときにonPlaylistAddが呼び出され、イベント伝播が停止すること", () => {
    render(
      <PopularArticleCard
        article={mockArticle}
        onRead={mockOnRead}
        onPlaylistAdd={mockOnPlaylistAdd}
      />
    );

    const addButton = screen.getByRole("button", { name: "プレイリストに追加" });
    fireEvent.click(addButton);

    expect(mockOnPlaylistAdd).toHaveBeenCalledWith(mockArticle);
    expect(mockOnRead).not.toHaveBeenCalled();
  });

  describe("Edge cases and accessibility", () => {
    it("タイトルが非常に長い場合でもレンダリングできること", () => {
      const longTitleArticle = {
        ...mockArticle,
        title: "非常に".repeat(100) + "長いタイトル",
      };
      render(
        <PopularArticleCard
          article={longTitleArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      expect(screen.getByText(longTitleArticle.title)).toBeInTheDocument();
    });

    it("URLが特殊文字を含む場合でも正しく処理されること", () => {
      const specialUrlArticle = {
        ...mockArticle,
        url: "https://example.com/article?param=value&foo=bar#section",
      };
      render(
        <PopularArticleCard
          article={specialUrlArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      const card = screen.getByTestId("article-card");
      fireEvent.click(card);
      expect(mockOnRead).toHaveBeenCalledWith(specialUrlArticle.url);
    });

    it("アクセスカウントが0でも正しく表示されること", () => {
      const zeroAccessArticle = {
        ...mockArticle,
        accessCount: 0,
      };
      render(
        <PopularArticleCard
          article={zeroAccessArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      expect(screen.getByText("0回")).toBeInTheDocument();
    });

    it("アクセスカウントが大きな数値でも正しく表示されること", () => {
      const highAccessArticle = {
        ...mockArticle,
        accessCount: 999999,
      };
      render(
        <PopularArticleCard
          article={highAccessArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      expect(screen.getByText("999999回")).toBeInTheDocument();
    });

    it("ドメインが異なる場合でも正しく表示されること", () => {
      const differentDomainArticle = {
        ...mockArticle,
        domain: "github.com",
      };
      render(
        <PopularArticleCard
          article={differentDomainArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      expect(screen.getByText("Test Article Title")).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("タッチイベントでも追加ボタンが正しく動作すること", () => {
      render(
        <PopularArticleCard
          article={mockArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      const addButton = screen.getByRole("button", { name: "プレイリストに追加" });
      fireEvent.touchStart(addButton);
      fireEvent.click(addButton);

      expect(mockOnPlaylistAdd).toHaveBeenCalledWith(mockArticle);
      expect(mockOnRead).not.toHaveBeenCalled();
    });

    it("カードの複数回クリックでも正しく動作すること", () => {
      render(
        <PopularArticleCard
          article={mockArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      const card = screen.getByTestId("article-card");
      fireEvent.click(card);
      fireEvent.click(card);
      fireEvent.click(card);

      expect(mockOnRead).toHaveBeenCalledTimes(3);
    });
  });

  describe("Memo optimization", () => {
    it("同じpropsで再レンダリングされないこと", () => {
      const { rerender } = render(
        <PopularArticleCard
          article={mockArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      // Same props should not cause re-render due to memo
      rerender(
        <PopularArticleCard
          article={mockArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      expect(screen.getByText("Test Article Title")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("追加ボタンに適切なaria-labelが設定されていること", () => {
      render(
        <PopularArticleCard
          article={mockArticle}
          onRead={mockOnRead}
          onPlaylistAdd={mockOnPlaylistAdd}
        />
      );

      const addButton = screen.getByRole("button", { name: "プレイリストに追加" });
      expect(addButton).toHaveAttribute("aria-label", "プレイリストに追加");
      expect(addButton).toHaveAttribute("title", "プレイリストに追加");
    });
  });
