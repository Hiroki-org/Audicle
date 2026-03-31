/**
 * @jest-environment jsdom
 */
import { getArticlesCache, setArticlesCache, CachedPlaylistData } from "../local-cache";
import { STORAGE_KEYS } from "../constants";

describe("local-cache", () => {
    const userId = "test-user-id";
    const cacheKey = `${STORAGE_KEYS.ARTICLES_CACHE}-${userId}`;
    const mockData: CachedPlaylistData = {
        playlistId: "test-playlist-id",
        playlistName: "Test Playlist",
        items: []
    };

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        jest.clearAllMocks();

        // Mock console.warn and console.error
        jest.spyOn(console, "warn").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "info").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("setArticlesCache", () => {
        it("should successfully save data to localStorage", () => {
            const setItemSpy = jest.spyOn(Storage.prototype, "setItem");

            setArticlesCache(userId, mockData);

            expect(setItemSpy).toHaveBeenCalledWith(
                cacheKey,
                expect.stringContaining('"playlistId":"test-playlist-id"')
            );

            const savedItem = localStorage.getItem(cacheKey);
            expect(savedItem).not.toBeNull();

            const parsed = JSON.parse(savedItem!);
            expect(parsed.version).toBe(1);
            expect(parsed.payload).toEqual(mockData);
        });

        it("should return early if userId is falsy", () => {
            const setItemSpy = jest.spyOn(Storage.prototype, "setItem");
            setArticlesCache("", mockData);
            expect(setItemSpy).not.toHaveBeenCalled();
        });

        it("should handle QuotaExceededError and log a specific warning", () => {
            const error = new Error("Quota Exceeded");
            error.name = "QuotaExceededError";

            jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw error;
            });

            setArticlesCache(userId, mockData);

            expect(console.warn).toHaveBeenCalledWith(
                "Failed to save articles to cache (quota exceeded):",
                error
            );
        });

        it("should handle generic errors and log a general warning", () => {
            const error = new Error("Some other error");

            jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw error;
            });

            setArticlesCache(userId, mockData);

            expect(console.warn).toHaveBeenCalledWith(
                "Failed to save articles to cache:",
                error
            );
        });
    });

    describe("getArticlesCache", () => {
        it("should return null if userId is falsy", () => {
            expect(getArticlesCache("")).toBeNull();
        });

        it("should return null if no cached data exists", () => {
            expect(getArticlesCache(userId)).toBeNull();
        });

        it("should return null and warn if envelope is invalid", () => {
            localStorage.setItem(cacheKey, JSON.stringify({ invalid: "structure" }));

            expect(getArticlesCache(userId)).toBeNull();
            expect(console.warn).toHaveBeenCalledWith("Invalid cache structure detected");
        });

        it("should return null, warn, and remove item if version mismatch", () => {
            const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

            const invalidVersionEnvelope = {
                version: 999,
                timestamp: Date.now(),
                payload: mockData
            };
            localStorage.setItem(cacheKey, JSON.stringify(invalidVersionEnvelope));

            expect(getArticlesCache(userId)).toBeNull();
            expect(console.warn).toHaveBeenCalledWith("Cache version mismatch; clearing cache");
            expect(removeItemSpy).toHaveBeenCalledWith(cacheKey);
        });

        it("should return null, info log, and remove item if cache expired", () => {
            const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

            const expiredEnvelope = {
                version: 1,
                timestamp: Date.now() - (1000 * 60 * 60 * 25), // 25 hours ago
                payload: mockData
            };
            localStorage.setItem(cacheKey, JSON.stringify(expiredEnvelope));

            expect(getArticlesCache(userId)).toBeNull();
            expect(console.info).toHaveBeenCalledWith("Articles cache expired; removing");
            expect(removeItemSpy).toHaveBeenCalledWith(cacheKey);
        });

        it("should return payload if valid", () => {
            const validEnvelope = {
                version: 1,
                timestamp: Date.now(),
                payload: mockData
            };
            localStorage.setItem(cacheKey, JSON.stringify(validEnvelope));

            expect(getArticlesCache(userId)).toEqual(mockData);
        });

        it("should return null and warn if payload structure is invalid", () => {
            const invalidPayloadEnvelope = {
                version: 1,
                timestamp: Date.now(),
                payload: { invalid: "payload" }
            };
            localStorage.setItem(cacheKey, JSON.stringify(invalidPayloadEnvelope));

            expect(getArticlesCache(userId)).toBeNull();
            expect(console.warn).toHaveBeenCalledWith("Invalid cached payload structure");
        });

        it("should return null and log error if JSON parsing fails", () => {
            localStorage.setItem(cacheKey, "invalid json");

            expect(getArticlesCache(userId)).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                "Failed to read articles cache:",
                expect.any(SyntaxError)
            );
        });
    });
});
