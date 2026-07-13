import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    usePlaylistItemPlaylists,
    useArticlePlaylists,
    useUpdateArticlePlaylistsMutation,
} from "../usePlaylistSelection";

jest.mock("next-auth/react", () => ({
    useSession: jest.fn(),
}));

global.fetch = jest.fn();

describe("usePlaylistSelection hooks", () => {
    let queryClient: QueryClient;
    const mockSession = {
        data: { user: { email: "test@example.com" } },
        status: "authenticated",
    };

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
                mutations: {
                    retry: false,
                },
            },
        });
        jest.clearAllMocks();
        const { useSession } = require("next-auth/react");
        useSession.mockReturnValue(mockSession);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    describe("usePlaylistItemPlaylists", () => {
        it("should fetch playlist item playlists successfully", async () => {
            const mockData = [{ id: "1", name: "Test Playlist" }];
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const { result } = renderHook(() => usePlaylistItemPlaylists("item123"), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith("/api/playlist-items/item123/playlists");
        });

        it("should not fetch when userEmail is undefined", () => {
            const { useSession } = require("next-auth/react");
            useSession.mockReturnValue({ data: null, status: "unauthenticated" });

            const { result } = renderHook(() => usePlaylistItemPlaylists("item123"), { wrapper });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should not fetch when itemId is empty string", () => {
            const { result } = renderHook(() => usePlaylistItemPlaylists(""), { wrapper });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should respect options.enabled", () => {
            const { result } = renderHook(() => usePlaylistItemPlaylists("item123", { enabled: false }), { wrapper });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should throw error when fetch fails", async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
            });

            const { result } = renderHook(() => usePlaylistItemPlaylists("item123"), { wrapper });

            await waitFor(() => expect(result.current.isError).toBe(true));
            expect(result.current.error?.message).toBe("プレイリストアイテムが所属するプレイリストの取得に失敗しました");
        });

        it("should fetch when options.enabled is explicitly true even if userEmail is undefined", async () => {
            const { useSession } = require("next-auth/react");
            useSession.mockReturnValue({ data: null, status: "unauthenticated" });
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            renderHook(() => usePlaylistItemPlaylists("item123", { enabled: true }), { wrapper });
            await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        });
    });

    describe("useArticlePlaylists", () => {
        it("should fetch article playlists successfully", async () => {
            const mockData = [{ id: "1", name: "Test Playlist" }];
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const { result } = renderHook(() => useArticlePlaylists("article123"), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith("/api/articles/article123/playlists");
        });

        it("should not fetch when userEmail is undefined", () => {
            const { useSession } = require("next-auth/react");
            useSession.mockReturnValue({ data: null, status: "unauthenticated" });

            const { result } = renderHook(() => useArticlePlaylists("article123"), { wrapper });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should not fetch when articleId is empty string", () => {
            const { result } = renderHook(() => useArticlePlaylists(""), { wrapper });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should respect options.enabled", () => {
            const { result } = renderHook(() => useArticlePlaylists("article123", { enabled: false }), { wrapper });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should throw error when fetch fails", async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
            });

            const { result } = renderHook(() => useArticlePlaylists("article123"), { wrapper });

            await waitFor(() => expect(result.current.isError).toBe(true));
            expect(result.current.error?.message).toBe("Failed to fetch playlists");
        });

        it("should fetch when options.enabled is explicitly true even if articleId is empty", async () => {
            const { useSession } = require("next-auth/react");
            useSession.mockReturnValue(mockSession);
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            renderHook(() => useArticlePlaylists("", { enabled: true }), { wrapper });
            await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        });
    });

    describe("useUpdateArticlePlaylistsMutation", () => {
        it("should call update API and invalidate queries", async () => {
            const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            const { result } = renderHook(() => useUpdateArticlePlaylistsMutation(), { wrapper });

            result.current.mutate({
                articleId: "article123",
                addToPlaylistIds: ["p1"],
                removeFromPlaylistIds: ["p2"],
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(global.fetch).toHaveBeenCalledWith("/api/playlists/bulk_update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    articleId: "article123",
                    addToPlaylistIds: ["p1"],
                    removeFromPlaylistIds: ["p2"],
                }),
            });

            expect(invalidateQueriesSpy).toHaveBeenCalledWith({
                queryKey: ["article", "playlists", "article123", "test@example.com"],
            });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({
                queryKey: ["playlist-item-playlists"],
            });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({
                queryKey: ["playlists", "test@example.com"],
            });
        });

        it("should throw error when fetch fails", async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
            });

            const { result } = renderHook(() => useUpdateArticlePlaylistsMutation(), { wrapper });

            result.current.mutate({
                articleId: "article123",
                addToPlaylistIds: ["p1"],
                removeFromPlaylistIds: [],
            });

            await waitFor(() => expect(result.current.isError).toBe(true));
            expect(result.current.error?.message).toBe("プレイリストの更新に失敗しました");
        });
    });
});
