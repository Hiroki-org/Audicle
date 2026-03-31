/**
 * @jest-environment node
 */
import { getArticlesCache, setArticlesCache, CachedPlaylistData } from "../local-cache";

describe("local-cache (window undefined)", () => {
    const userId = "test-user-id";
    const mockData: CachedPlaylistData = {
        playlistId: "test-playlist-id",
        playlistName: "Test Playlist",
        items: []
    };

    it("setArticlesCache should return early if window is undefined", () => {
        // localStorage is not defined in node environment
        // So calling setArticlesCache should just return without trying to use localStorage
        expect(() => {
            setArticlesCache(userId, mockData);
        }).not.toThrow();
    });

    it("getArticlesCache should return null if window is undefined", () => {
        expect(getArticlesCache(userId)).toBeNull();
    });
});
