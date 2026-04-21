import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDefaultPlaylistItems } from "../useDefaultPlaylistItems";
import { setArticlesCache } from "@/lib/local-cache";

// Mock next-auth
jest.mock("next-auth/react", () => ({
    useSession: jest.fn(),
}));

// Mock local-cache
jest.mock("@/lib/local-cache", () => ({
    setArticlesCache: jest.fn(),
}));

describe("useDefaultPlaylistItems hook", () => {
    let queryClient: QueryClient;
    const mockSession = {
        data: { user: { email: "test@example.com" } },
        status: "authenticated",
    };

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false, // Disable retries for faster tests
                },
            },
        });
        jest.clearAllMocks();

        // Setup default mocks
        const { useSession } = require("next-auth/react");
        useSession.mockReturnValue(mockSession);

        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    it("should fetch default playlist items successfully and cache them", async () => {
        const mockResponse = {
            id: "playlist-1",
            name: "Default Playlist",
            items: [{ id: "item-1", title: "Test Article" }]
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

        // Wait for query to succeed
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Verify transformed data
        expect(result.current.data).toEqual({
            playlistId: "playlist-1",
            playlistName: "Default Playlist",
            items: mockResponse.items,
        });

        // Verify fetch was called correctly
        expect(global.fetch).toHaveBeenCalledWith("/api/playlists/default");

        // Verify caching was triggered
        expect(setArticlesCache).toHaveBeenCalledWith(
            "test@example.com",
            {
                playlistId: "playlist-1",
                playlistName: "Default Playlist",
                items: mockResponse.items,
            }
        );
    });

    it("should handle empty items array gracefully", async () => {
        const mockResponse = {
            id: "playlist-2",
            name: "Empty Playlist",
            // missing items array
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Verify default empty array is used
        expect(result.current.data).toEqual({
            playlistId: "playlist-2",
            playlistName: "Empty Playlist",
            items: [],
        });
    });

    it("should not fetch when userEmail is undefined", async () => {
        const { useSession } = require("next-auth/react");
        useSession.mockReturnValue({ data: null, status: "unauthenticated" });

        const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

        expect(result.current.isPending).toBe(true);
        expect(result.current.fetchStatus).toBe("idle");
        expect(global.fetch).not.toHaveBeenCalled();
        expect(setArticlesCache).not.toHaveBeenCalled();
    });

    it("should handle network errors and reject", async () => {
        const error = new Error("Network error");
        (global.fetch as jest.Mock).mockRejectedValueOnce(error);

        const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeDefined();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(setArticlesCache).not.toHaveBeenCalled();
    });

    it("should throw an error when response is not ok", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 404,
        });

        const { result } = renderHook(() => useDefaultPlaylistItems(), { wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toBe("プレイリストの取得に失敗しました");
        expect(setArticlesCache).not.toHaveBeenCalled();
    });
});
