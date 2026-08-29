import { render, waitFor, screen } from "@testing-library/react";
import PopularPage from "../page";
import React from 'react';

// Next.js components
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
    };
  },
}));

// Mock external components to isolate the page test
jest.mock("@/components/Sidebar", () => function DummySidebar() { return <div data-testid="sidebar" />; });
jest.mock("@/components/PeriodFilter", () => ({ PeriodFilter: function DummyPeriodFilter() { return <div data-testid="period-filter" />; } }));
jest.mock("@/components/PopularArticleCard", () => ({ PopularArticleCard: function DummyPopularArticleCard() { return <div data-testid="popular-article-card" />; } }));
jest.mock("@/components/PlaylistSelectorModal", () => ({ PlaylistSelectorModal: function DummyPlaylistSelectorModal() { return <div data-testid="playlist-selector-modal" />; } }));
jest.mock("@/components/Spinner", () => ({ Spinner: function DummySpinner() { return <div data-testid="spinner" />; } }));
jest.mock("@/components/ui/button", () => ({ Button: function DummyButton({ children, onClick, disabled }: any) { return <button data-testid="button" onClick={onClick} disabled={disabled}>{children}</button>; } }));

describe("PopularPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ articles: [] }),
      } as Response)
    );
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  describe("Cache parsing error handling", () => {
    it("handles invalid JSON gracefully and logs an error when cached data is corrupted", async () => {
      // Mock localStorage to return invalid JSON specifically for this test
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = jest.fn((key) => {
        if (key === "audicle_popular_articles_v2_week") {
          return "this-is-not-valid-json";
        }
        return null; // Return null for other keys if any
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      render(<PopularPage />);

      // Wait for the component to mount and the effect to run which triggers getCachedEntry
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Failed to parse popular articles cache for week"),
          expect.any(SyntaxError)
        );
      });

      // Also verify that it falls back to fetching since cache read failed (treated as cache miss)
      expect(global.fetch).toHaveBeenCalledWith("/api/stats/popular?period=week&limit=20");

      Storage.prototype.getItem = originalGetItem;
    });
  });
});
