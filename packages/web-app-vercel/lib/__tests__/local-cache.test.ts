/**
 * @jest-environment node
 */
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

type LocalStorageMock = {
    clear: jest.Mock;
    getItem: jest.Mock;
    key: jest.Mock;
    length: number;
    removeItem: jest.Mock;
    setItem: jest.Mock;
};

describe("local-cache", () => {
    let consoleWarnSpy: jest.SpyInstance;
    let consoleInfoSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let dateNowSpy: jest.SpyInstance;
    let localStorageMock: LocalStorageMock;
    let originalWindow: (Window & typeof globalThis) | undefined;

    const withWindowUndefined = (callback: () => void) => {
        try {
            delete (global as typeof globalThis & { window?: Window & typeof globalThis }).window;
            callback();
        } finally {
            if (originalWindow === undefined) {
                return;
            }

            Object.defineProperty(global, "window", {
                configurable: true,
                value: originalWindow,
                writable: true,
            });
        }
    };

    beforeEach(() => {
        let store: Record<string, string> = {};
        localStorageMock = {
            getItem: jest.fn((key: string) =>
                Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
            ),
            setItem: jest.fn((key: string, value: string) => {
                store[key] = value.toString();
            }),
            removeItem: jest.fn((key: string) => {
                delete store[key];
            }),
            clear: jest.fn(() => {
                store = {};
            }),
            length: 0,
            key: jest.fn(() => null),
        };

        Object.defineProperty(global, "localStorage", {
            configurable: true,
            value: localStorageMock,
            writable: true,
        });

        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1000000000000);

        originalWindow = (global as typeof globalThis & {
            window?: Window & typeof globalThis;
        }).window;
        Object.defineProperty(global, "window", {
            configurable: true,
            value: {} as Window & typeof globalThis,
            writable: true,
        });
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        localStorageMock.clear();

        if (originalWindow === undefined) {
            delete (global as typeof globalThis & { window?: Window & typeof globalThis }).window;
            return;
        }

        Object.defineProperty(global, "window", {
            configurable: true,
            value: originalWindow,
            writable: true,
        });
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
            global.localStorage.setItem(CACHE_KEY, "invalid-json");
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to read articles cache:",
                expect.any(SyntaxError)
            );
        });

        it("returns null and logs warning if envelope is invalid", () => {
            global.localStorage.setItem(CACHE_KEY, JSON.stringify({ invalid: "envelope" }));
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith("Invalid cache structure detected");
        });

        it("returns null, clears cache, and logs warning if version mismatches", () => {
            global.localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    version: CACHE_VERSION + 1,
                    timestamp: Date.now(),
                    payload: mockData,
                })
            );
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith("Cache version mismatch; clearing cache");
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
        });

        it("returns null, clears cache, and logs info if TTL is expired", () => {
            global.localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    version: CACHE_VERSION,
                    timestamp: Date.now() - CACHE_TTL_MS - 1,
                    payload: mockData,
                })
            );
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleInfoSpy).toHaveBeenCalledWith("Articles cache expired; removing");
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
        });

        it("returns null and logs warning if payload structure is invalid", () => {
            global.localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    version: CACHE_VERSION,
                    timestamp: Date.now(),
                    payload: { invalid: "payload" },
                })
            );
            const result = getArticlesCache(USER_ID);

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith("Invalid cached payload structure");
        });

        it("returns cached data if everything is valid", () => {
            global.localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    version: CACHE_VERSION,
                    timestamp: Date.now(),
                    payload: mockData,
                })
            );
            const result = getArticlesCache(USER_ID);

            expect(result).toEqual(mockData);
        });

        it("returns null if window is undefined", () => {
            const cachedEnvelope = JSON.stringify({
                version: CACHE_VERSION,
                timestamp: Date.now(),
                payload: mockData,
            });
            global.localStorage.setItem(CACHE_KEY, cachedEnvelope);

            withWindowUndefined(() => {
                const result = getArticlesCache(USER_ID);
                expect(result).toBeNull();
                expect(global.localStorage.getItem(CACHE_KEY)).toBe(cachedEnvelope);
            });
        });
    });

    describe("setArticlesCache", () => {
        it("does nothing if window is undefined", () => {
            const existingCache = JSON.stringify({ existing: true });
            global.localStorage.setItem(CACHE_KEY, existingCache);
            localStorageMock.setItem.mockClear();

            withWindowUndefined(() => {
                setArticlesCache(USER_ID, mockData);
                expect(localStorageMock.setItem).not.toHaveBeenCalled();
                expect(global.localStorage.getItem(CACHE_KEY)).toBe(existingCache);
            });
        });

        it("does nothing if userId is empty", () => {
            setArticlesCache("", mockData);
            expect(global.localStorage.setItem).not.toHaveBeenCalled();
        });

        it("stores data with proper envelope", () => {
            setArticlesCache(USER_ID, mockData);

            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                CACHE_KEY,
                JSON.stringify({
                    version: CACHE_VERSION,
                    timestamp: 1000000000000,
                    payload: mockData,
                })
            );
        });

        it("handles QuotaExceededError and logs warning", () => {
            const quotaError = new Error("Quota exceeded");
            quotaError.name = "QuotaExceededError";
            localStorageMock.setItem.mockImplementationOnce(() => {
                throw quotaError;
            });

            setArticlesCache(USER_ID, mockData);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Failed to save articles to cache (quota exceeded):",
                quotaError
            );
        });

        it("handles generic errors and logs warning", () => {
            const genericError = new Error("Generic error");
            localStorageMock.setItem.mockImplementationOnce(() => {
                throw genericError;
            });

            setArticlesCache(USER_ID, mockData);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Failed to save articles to cache:",
                genericError
            );
        });
    });
});
