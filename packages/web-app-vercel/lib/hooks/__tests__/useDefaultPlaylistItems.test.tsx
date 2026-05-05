import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDefaultPlaylistItems } from "../useDefaultPlaylistItems";
import React from "react";
import { useSession } from "next-auth/react";
import { setArticlesCache } from "@/lib/local-cache";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock setArticlesCache
jest.mock("@/lib/local-cache", () => ({
  setArticlesCache: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe("useDefaultPlaylistItems hook", () => {
  let queryClient: QueryClient;
  const mockSession = {
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue(mockSession);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should fetch default playlist items successfully and call setArticlesCache", async () => {
    const mockData = {
      id: "playlist-1",
      name: "Default Playlist",
      items: [{ id: "item-1", article: { id: "article-1", title: "Test Article" } }],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith("/api/playlists/default");
    expect(result.current.data).toEqual({
      playlistId: mockData.id,
      playlistName: mockData.name,
      items: mockData.items,
    });

    // Check useEffect side-effect
    expect(setArticlesCache).toHaveBeenCalledWith("test@example.com", {
      playlistId: mockData.id,
      playlistName: mockData.name,
      items: mockData.items,
    });
  });

  it("should handle API error (ok: false) and not call setArticlesCache", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("プレイリストの取得に失敗しました");
    expect(setArticlesCache).not.toHaveBeenCalled();
  });

  it("should not fetch if userEmail is missing", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(setArticlesCache).not.toHaveBeenCalled();
  });
});
