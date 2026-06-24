import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PopularArticleCard } from "../PopularArticleCard";
import type { PopularArticle } from "@/types/stats";

// Mock dependencies
jest.mock("@/components/DomainBadge", () => ({
  DomainBadge: ({ domain }: { domain: string }) => <span data-testid="domain-badge">{domain}</span>,
}));

jest.mock("lucide-react", () => ({
  Plus: () => <span data-testid="icon-plus" />,
}));

const mockArticle: PopularArticle = {
  articleId: "article-1",
  articleHash: "hash-1",
  url: "https://example.com/article",
  title: "Test Popular Article Title",
  domain: "example.com",
  accessCount: 123,
  uniqueUsers: 100,
  cacheHitRate: 90,
  isFullyCached: true,
  lastAccessedAt: "2023-01-01T00:00:00Z",
};

describe("PopularArticleCard", () => {
  const mockOnRead = jest.fn();
  const mockOnPlaylistAdd = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders article information correctly", () => {
    render(
      <PopularArticleCard
        article={mockArticle}
        onRead={mockOnRead}
        onPlaylistAdd={mockOnPlaylistAdd}
      />
    );

    expect(screen.getByText("Test Popular Article Title")).toBeInTheDocument();
    expect(screen.getByTestId("domain-badge")).toHaveTextContent("example.com");
    expect(screen.getByText("123回")).toBeInTheDocument();
    expect(screen.getByTestId("cache-badge")).toHaveTextContent("キャッシュ済み");
  });

  it("handles card click to read article", () => {
    render(
      <PopularArticleCard
        article={mockArticle}
        onRead={mockOnRead}
        onPlaylistAdd={mockOnPlaylistAdd}
      />
    );

    const card = screen.getByTestId("article-card");
    fireEvent.click(card);

    expect(mockOnRead).toHaveBeenCalledWith("https://example.com/article");
  });

  it("handles playlist add button click", () => {
    render(
      <PopularArticleCard
        article={mockArticle}
        onRead={mockOnRead}
        onPlaylistAdd={mockOnPlaylistAdd}
      />
    );

    const plusIcon = screen.getByTestId("icon-plus");
    const addButton = plusIcon.closest("button");
    if (!addButton) {
      fail("Add button not found");
    }
    fireEvent.click(addButton);

    expect(mockOnPlaylistAdd).toHaveBeenCalledWith(mockArticle);
    expect(mockOnRead).not.toHaveBeenCalled(); // Propagation stopped
  });
});
