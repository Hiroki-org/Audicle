import { getArticlesCache, setArticlesCache, CachedPlaylistData } from "../local-cache";
import { STORAGE_KEYS } from "../constants";

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const USER_ID = "test-user";
const CACHE_KEY = `${STORAGE_KEYS.ARTICLES_CACHE}-${USER_ID}`;

const mockData: CachedPlaylistData = {
    playlistId: "test-playlist",
    playlistName: "Test Playlist",
    items: [],
};

describe("local-cache", () => {
    let mockDateNow: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleInfoSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // Clear localStorage
        localStorage.clear();

        // Mock Date.now()
        mockDateNow = jest.spyOn(Date, "now").mockReturnValue(1000000000000);

        // Spy on console methods
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        mockDateNow.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        localStorage.clear();
    });

    describe("getArticlesCache", () => {
        it("returns null if userId is empty", () => {
            const result = getArticlesCache("");
            expect(result).toBeNull();
        });

        it("returns null if localStorage is empty", () => {
            const result = getArticlesCache(USER_ID);
            expect(result).toBeNull();
        });

        it("returns null and logs error if JSON is invalid", () => {
            localStorage.setItem(CACHE_KEY, "invalid-json");
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to read articles cache:",
                expect.any(SyntaxError)
            );
        });

        it("returns null and logs warning if envelope is invalid", () => {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ invalid: "envelope" }));
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith("Invalid cache structure detected");
        });

        it("returns null, clears cache, and logs warning if version mismatches", () => {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                version: CACHE_VERSION + 1,
                timestamp: Date.now(),
                payload: mockData
            }));
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith("Cache version mismatch; clearing cache");
            expect(localStorage.getItem(CACHE_KEY)).toBeNull();
        });

        it("returns null, clears cache, and logs info if TTL is expired", () => {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                version: CACHE_VERSION,
                timestamp: Date.now() - CACHE_TTL_MS - 1,
                payload: mockData
            }));
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleInfoSpy).toHaveBeenCalledWith("Articles cache expired; removing");
            expect(localStorage.getItem(CACHE_KEY)).toBeNull();
        });

        it("returns null and logs warning if payload structure is invalid", () => {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                version: CACHE_VERSION,
                timestamp: Date.now(),
                payload: { invalid: "payload" }
            }));
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith("Invalid cached payload structure");
        });

        it("returns cached data if everything is valid", () => {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                version: CACHE_VERSION,
                timestamp: Date.now(),
                payload: mockData
            }));
            const result = getArticlesCache(USER_ID);

            expect(result).toEqual(mockData);
        });

        it("returns null if window is undefined", () => {
            // Delete window to simulate server environment
            const originalWindowRef = global.window;
            // @ts-ignore
            delete global.window;

            const result = getArticlesCache(USER_ID);
            expect(result).toBeNull();

            // Restore window
            global.window = originalWindowRef;
        });
    });

    describe("setArticlesCache", () => {
        it("does nothing if userId is empty", () => {
            setArticlesCache("", mockData);
            expect(localStorage.getItem(CACHE_KEY)).toBeNull();
        });

        it("stores data with proper envelope", () => {
            setArticlesCache(USER_ID, mockData);

            const cached = localStorage.getItem(CACHE_KEY);
            expect(cached).not.toBeNull();

            const parsed = JSON.parse(cached as string);
            expect(parsed).toEqual({
                version: CACHE_VERSION,
                timestamp: 1000000000000,
                payload: mockData
            });
        });

        it("handles QuotaExceededError and logs warning", () => {
            // Mock localStorage.setItem to throw QuotaExceededError
            jest.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
                const error = new Error("Quota exceeded");
                error.name = "QuotaExceededError";
                throw error;
            });

            setArticlesCache(USER_ID, mockData);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Failed to save articles to cache (quota exceeded):",
                expect.any(Error)
            );
        });

        it("handles generic errors and logs warning", () => {
            // Mock localStorage.setItem to throw generic Error
            jest.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
                throw new Error("Generic error");
            });

            setArticlesCache(USER_ID, mockData);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Failed to save articles to cache:",
                expect.any(Error)
            );
        });
    });
});
