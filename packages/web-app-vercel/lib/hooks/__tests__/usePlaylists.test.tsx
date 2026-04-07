import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePlaylists, usePlaylistDetail, useCreatePlaylistMutation, useDeletePlaylistMutation, useUpdatePlaylistMutation, useRemoveFromPlaylistMutation, useSetDefaultPlaylistMutation } from "../usePlaylists";
import React from "react";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe("usePlaylists hooks", () => {
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
                mutations: {
                    retry: false,
                }
            },
        });
        jest.clearAllMocks();
        const { useSession } = require("next-auth/react");
        useSession.mockReturnValue(mockSession);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    describe("usePlaylists", () => {
        it("should fetch playlists successfully", async () => {
            const mockData = [{ id: "1", name: "Test Playlist" }];
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const { result } = renderHook(() => usePlaylists(), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith("/api/playlists");
        });

        it("should not fetch when userEmail is undefined", async () => {
            const { useSession } = require("next-auth/react");
            useSession.mockReturnValue({ data: null, status: "unauthenticated" });

            const { result } = renderHook(() => usePlaylists(), { wrapper });

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should retry on network errors and eventually succeed", async () => {
             const mockData = [{ id: "1", name: "Retry Success" }];
             (global.fetch as jest.Mock)
                .mockRejectedValueOnce(new Error("fetch failed with ECONNRESET"))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockData,
                });

             const { result } = renderHook(() => usePlaylists(), { wrapper });

             await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });
             expect(result.current.data).toEqual(mockData);
             expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it("should throw error immediately for non-network errors", async () => {
             (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Some other error"));

             const { result } = renderHook(() => usePlaylists(), { wrapper });

             await waitFor(() => expect(result.current.isError).toBe(true));
             expect(result.current.error).toBeDefined();
             expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

        it("should fail after max retries for network errors", async () => {
             (global.fetch as jest.Mock).mockRejectedValue(new Error("fetch failed with ECONNRESET"));

             const { result } = renderHook(() => usePlaylists(), { wrapper });

             await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
             expect(global.fetch).toHaveBeenCalledTimes(3);
             expect(result.current.error).toBeDefined();
        });

    describe("usePlaylistDetail", () => {
        it("should fetch playlist detail successfully", async () => {
            const playlistId = "playlist123";
            const mockData = { id: playlistId, name: "Detail Playlist" };
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const { result } = renderHook(() => usePlaylistDetail(playlistId), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith(`/api/playlists/${playlistId}`);
        });

        it("should not fetch when playlistId is missing", async () => {
            const { result } = renderHook(() => usePlaylistDetail(""), { wrapper });

            expect(result.current.fetchStatus).toBe("idle");
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe("useCreatePlaylistMutation", () => {
        it("should call create playlist API and invalidate queries", async () => {
            const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: "newId" }),
            });

            const { result } = renderHook(() => useCreatePlaylistMutation(), { wrapper });

            result.current.mutate({ name: "New Playlist", description: "Desc" });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(global.fetch).toHaveBeenCalledWith("/api/playlists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "New Playlist", description: "Desc" }),
            });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["playlists", "test@example.com"] });
        });
    });

    describe("useDeletePlaylistMutation", () => {
        it("should call delete API and invalidate queries", async () => {
            const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            const { result } = renderHook(() => useDeletePlaylistMutation(), { wrapper });

            result.current.mutate("playlistToDelete");

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(global.fetch).toHaveBeenCalledWith("/api/playlists/playlistToDelete", {
                method: "DELETE",
            });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["playlists", "test@example.com"] });
        });
    });

    describe("useUpdatePlaylistMutation", () => {
        it("should call update API and invalidate queries", async () => {
            const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            const { result } = renderHook(() => useUpdatePlaylistMutation(), { wrapper });

            result.current.mutate({ playlistId: "p1", name: "Updated", description: "Updated Desc" });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(global.fetch).toHaveBeenCalledWith("/api/playlists/p1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Updated", description: "Updated Desc" }),
            });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["playlists", "test@example.com"] });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["playlists", "test@example.com", "p1"] });
        });
    });

    describe("useRemoveFromPlaylistMutation", () => {
        it("should call remove API and invalidate queries", async () => {
            const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            const { result } = renderHook(() => useRemoveFromPlaylistMutation(), { wrapper });

            result.current.mutate({ playlistId: "p1", itemId: "i1" });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(global.fetch).toHaveBeenCalledWith("/api/playlists/p1/items/i1", {
                method: "DELETE",
            });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["playlists", "test@example.com"] });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["playlists", "test@example.com", "p1"] });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["defaultPlaylist"] });
        });
    });

    describe("useSetDefaultPlaylistMutation", () => {
        it("should call set default API and invalidate queries", async () => {
            const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            const { result } = renderHook(() => useSetDefaultPlaylistMutation(), { wrapper });

            result.current.mutate("p1");

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(global.fetch).toHaveBeenCalledWith("/api/playlists/p1/set-default", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
            });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["playlists", "test@example.com"] });
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["defaultPlaylist"] });
        });
    });
});
// Ensure there's a test for network errors failing after max retries
// We'll add this to the usePlaylists block.
