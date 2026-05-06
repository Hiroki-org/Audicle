/**
 * @jest-environment node
 */
import { setArticlesCache, getArticlesCache, CachedPlaylistData } from "../local-cache";
import { STORAGE_KEYS } from "../constants";

const mockUserId = "test-user-id";
const mockData: CachedPlaylistData = {
    playlistId: "test-playlist-id",
    playlistName: "test-playlist",
    items: [],
};

const mockKey = `${STORAGE_KEYS.ARTICLES_CACHE}-${mockUserId}`;

describe("local-cache", () => {
    let originalWindow: typeof window | undefined;

    beforeEach(() => {
        // Mock localStorage
        const localStorageMock = (function () {
            let store: { [key: string]: string } = {};
            return {
                getItem: jest.fn((key: string) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
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
                key: jest.fn((_index: number) => null),
            };
        })();

        Object.defineProperty(global, "localStorage", {
            value: localStorageMock,
            writable: true,
            configurable: true,
        });

        // Mock console.warn and console.error
        jest.spyOn(console, "warn").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "info").mockImplementation(() => {});

        originalWindow = global.window;
        // make sure window is defined for most tests
        // @ts-ignore
        global.window = originalWindow || {};
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (global.localStorage) {
             global.localStorage.clear();
        }
        if (originalWindow !== undefined) {
             global.window = originalWindow;
        } else {
             // @ts-ignore
             delete global.window;
        }
    });

    describe("setArticlesCache", () => {
        it("should return early if window is undefined", () => {
            const tempWindow = global.window;
            // @ts-ignore
            delete global.window;

            setArticlesCache(mockUserId, mockData);

            expect(global.localStorage.setItem).not.toHaveBeenCalled();

            global.window = tempWindow;
        });

        it("should return early if userId is falsy", () => {
            setArticlesCache("", mockData);
            expect(global.localStorage.setItem).not.toHaveBeenCalled();
        });

        it("should save payload to localStorage successfully", () => {
            const mockDateNow = 1234567890;
            const dateSpy = jest.spyOn(Date, "now").mockReturnValue(mockDateNow);

            setArticlesCache(mockUserId, mockData);

            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                mockKey,
                JSON.stringify({
                    version: 1,
                    timestamp: mockDateNow,
                    payload: mockData,
                })
            );

            dateSpy.mockRestore();
        });

        it("should catch and warn QuotaExceededError", () => {
            const quotaError = new Error("Quota exceeded");
            quotaError.name = "QuotaExceededError";

            (global.localStorage.setItem as jest.Mock).mockImplementation(() => {
                throw quotaError;
            });

            setArticlesCache(mockUserId, mockData);

            expect(console.warn).toHaveBeenCalledWith(
                "Failed to save articles to cache (quota exceeded):",
                quotaError
            );
        });

        it("should catch and warn other unknown errors", () => {
            const unknownError = new Error("Some unknown error");

            (global.localStorage.setItem as jest.Mock).mockImplementation(() => {
                throw unknownError;
            });

            setArticlesCache(mockUserId, mockData);

            expect(console.warn).toHaveBeenCalledWith(
                "Failed to save articles to cache:",
                unknownError
            );
        });
    });

    describe("getArticlesCache", () => {
        it("should return null if window is undefined", () => {
            const tempWindow = global.window;
            // @ts-ignore
            delete global.window;

            const result = getArticlesCache(mockUserId);

            expect(result).toBeNull();

            global.window = tempWindow;
        });

        it("should return null if userId is falsy", () => {
            const result = getArticlesCache("");
            expect(result).toBeNull();
        });

        it("should return null if nothing is cached", () => {
            const result = getArticlesCache(mockUserId);
            expect(result).toBeNull();
        });

        it("should return null and warn if cache structure is invalid", () => {
            global.localStorage.setItem(mockKey, JSON.stringify({ invalid: "data" }));

            const result = getArticlesCache(mockUserId);

            expect(result).toBeNull();
            expect(console.warn).toHaveBeenCalledWith("Invalid cache structure detected");
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
        });

        it("should clear cache and return null if version mismatch", () => {
            global.localStorage.setItem(
                mockKey,
                JSON.stringify({
                    version: 999, // Invalid version
                    timestamp: Date.now(),
                    payload: mockData,
                })
            );

            const result = getArticlesCache(mockUserId);

            expect(result).toBeNull();
            expect(console.warn).toHaveBeenCalledWith("Cache version mismatch; clearing cache");
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
        });

        it("should clear cache and return null if cache is expired", () => {
            global.localStorage.setItem(
                mockKey,
                JSON.stringify({
                    version: 1,
                    timestamp: Date.now() - (1000 * 60 * 60 * 25), // 25 hours ago
                    payload: mockData,
                })
            );

            const result = getArticlesCache(mockUserId);

            expect(result).toBeNull();
            expect(console.info).toHaveBeenCalledWith("Articles cache expired; removing");
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
        });

        it("should return null and warn if payload is invalid", () => {
            global.localStorage.setItem(
                mockKey,
                JSON.stringify({
                    version: 1,
                    timestamp: Date.now(),
                    payload: { invalid: "payload" }, // Missing required properties
                })
            );

            const result = getArticlesCache(mockUserId);

            expect(result).toBeNull();
            expect(console.warn).toHaveBeenCalledWith("Invalid cached payload structure");
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
        });

        it("should return parsed payload successfully", () => {
            global.localStorage.setItem(
                mockKey,
                JSON.stringify({
                    version: 1,
                    timestamp: Date.now(),
                    payload: mockData,
                })
            );

            const result = getArticlesCache(mockUserId);

            expect(result).toEqual(mockData);
        });

        it("should catch and error on JSON parse failure", () => {
            global.localStorage.setItem(mockKey, "invalid-json");

            const result = getArticlesCache(mockUserId);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                "Failed to read articles cache:",
                expect.any(SyntaxError)
            );
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
        });

        describe("safeRemoveCache swallows removeItem errors", () => {
            beforeEach(() => {
                (global.localStorage.removeItem as jest.Mock).mockImplementation(() => {
                    throw new Error("Storage removeItem failed");
                });
            });

            it("should not throw when removeItem fails on invalid cache structure", () => {
                global.localStorage.setItem(mockKey, JSON.stringify({ invalid: "data" }));

                expect(() => getArticlesCache(mockUserId)).not.toThrow();
                const result = getArticlesCache(mockUserId);
                expect(result).toBeNull();
            });

            it("should not throw when removeItem fails on version mismatch", () => {
                global.localStorage.setItem(
                    mockKey,
                    JSON.stringify({ version: 999, timestamp: Date.now(), payload: mockData })
                );

                expect(() => getArticlesCache(mockUserId)).not.toThrow();
                const result = getArticlesCache(mockUserId);
                expect(result).toBeNull();
            });

            it("should not throw when removeItem fails on expired cache", () => {
                global.localStorage.setItem(
                    mockKey,
                    JSON.stringify({
                        version: 1,
                        timestamp: Date.now() - (1000 * 60 * 60 * 25),
                        payload: mockData,
                    })
                );

                expect(() => getArticlesCache(mockUserId)).not.toThrow();
                const result = getArticlesCache(mockUserId);
                expect(result).toBeNull();
            });

            it("should not throw when removeItem fails on invalid payload structure", () => {
                global.localStorage.setItem(
                    mockKey,
                    JSON.stringify({ version: 1, timestamp: Date.now(), payload: { invalid: "payload" } })
                );

                expect(() => getArticlesCache(mockUserId)).not.toThrow();
                const result = getArticlesCache(mockUserId);
                expect(result).toBeNull();
            });

            it("should not throw when removeItem fails on JSON parse error", () => {
                global.localStorage.setItem(mockKey, "not-valid-json");

                expect(() => getArticlesCache(mockUserId)).not.toThrow();
                const result = getArticlesCache(mockUserId);
                expect(result).toBeNull();
            });
        });

        describe("safeRemoveCache called exactly once per error path", () => {
            it("should call removeItem exactly once on invalid cache structure", () => {
                global.localStorage.setItem(mockKey, JSON.stringify({ invalid: "data" }));

                getArticlesCache(mockUserId);

                expect(global.localStorage.removeItem).toHaveBeenCalledTimes(1);
                expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
            });

            it("should call removeItem exactly once on version mismatch", () => {
                global.localStorage.setItem(
                    mockKey,
                    JSON.stringify({ version: 999, timestamp: Date.now(), payload: mockData })
                );

                getArticlesCache(mockUserId);

                expect(global.localStorage.removeItem).toHaveBeenCalledTimes(1);
                expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
            });

            it("should call removeItem exactly once on expired cache", () => {
                global.localStorage.setItem(
                    mockKey,
                    JSON.stringify({
                        version: 1,
                        timestamp: Date.now() - (1000 * 60 * 60 * 25),
                        payload: mockData,
                    })
                );

                getArticlesCache(mockUserId);

                expect(global.localStorage.removeItem).toHaveBeenCalledTimes(1);
                expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
            });

            it("should call removeItem exactly once on invalid payload structure", () => {
                global.localStorage.setItem(
                    mockKey,
                    JSON.stringify({ version: 1, timestamp: Date.now(), payload: { invalid: "payload" } })
                );

                getArticlesCache(mockUserId);

                expect(global.localStorage.removeItem).toHaveBeenCalledTimes(1);
                expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
            });

            it("should call removeItem exactly once on JSON parse error", () => {
                global.localStorage.setItem(mockKey, "not-valid-json");

                getArticlesCache(mockUserId);

                expect(global.localStorage.removeItem).toHaveBeenCalledTimes(1);
                expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
            });

            it("should not call removeItem on a cache miss (null stored value)", () => {
                // Nothing in cache — no cleanup should occur
                getArticlesCache(mockUserId);

                expect(global.localStorage.removeItem).not.toHaveBeenCalled();
            });
        });

        it("should call removeItem with correct key when localStorage.getItem itself throws", () => {
            // Key is computed before the try block, so even when getItem throws,
            // safeRemoveCache receives the correct key in the catch handler.
            (global.localStorage.getItem as jest.Mock).mockImplementation(() => {
                throw new Error("getItem failed");
            });

            const result = getArticlesCache(mockUserId);

            expect(result).toBeNull();
            expect(global.localStorage.removeItem).toHaveBeenCalledWith(mockKey);
        });

        it("should not throw when both getItem and removeItem throw", () => {
            (global.localStorage.getItem as jest.Mock).mockImplementation(() => {
                throw new Error("getItem failed");
            });
            (global.localStorage.removeItem as jest.Mock).mockImplementation(() => {
                throw new Error("removeItem failed");
            });

            expect(() => getArticlesCache(mockUserId)).not.toThrow();
            expect(getArticlesCache(mockUserId)).toBeNull();
        });
    });
});
