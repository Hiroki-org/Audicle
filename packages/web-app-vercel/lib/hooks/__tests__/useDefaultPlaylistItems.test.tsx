import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDefaultPlaylistItems } from "../useDefaultPlaylistItems";
import React from "react";
import { useSession } from "next-auth/react";
import { setArticlesCache } from "@/lib/local-cache";

const originalFetch = global.fetch;

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock setArticlesCache
jest.mock("@/lib/local-cache", () => ({
  setArticlesCache: jest.fn(),
}));

describe("useDefaultPlaylistItems hook", () => {
  let queryClient: QueryClient;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const mockSession = {
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (!global.fetch) {
      Object.defineProperty(global, "fetch", {
        configurable: true,
        writable: true,
        value: jest.fn(),
      });
    }
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("fetch mock not configured"));
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    (useSession as jest.Mock).mockReturnValue(mockSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (!originalFetch) {
      delete (global as typeof globalThis & { fetch?: typeof fetch }).fetch;
    }
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

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith("/api/playlists/default");
    expect(result.current.data).toEqual({
      playlistId: mockData.id,
      playlistName: mockData.name,
      items: mockData.items,
    });

    // Check useEffect side-effect
    await waitFor(() =>
      expect(setArticlesCache).toHaveBeenCalledWith("test@example.com", {
        playlistId: mockData.id,
        playlistName: mockData.name,
        items: mockData.items,
      })
    );
  });

  it("should use empty items when default playlist response omits items", async () => {
    const mockData = {
      id: "playlist-1",
      name: "Default Playlist",
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      playlistId: mockData.id,
      playlistName: mockData.name,
      items: [],
    });

    await waitFor(() =>
      expect(setArticlesCache).toHaveBeenCalledWith("test@example.com", {
        playlistId: mockData.id,
        playlistName: mockData.name,
        items: [],
      })
    );
  });

  it("should handle API error (ok: false) and not call setArticlesCache", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
    } as Response);

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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setArticlesCache).not.toHaveBeenCalled();
  });

  it("should not fetch if session user has no email", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: {} },
      status: "authenticated",
    });

    const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setArticlesCache).not.toHaveBeenCalled();
  });
});
