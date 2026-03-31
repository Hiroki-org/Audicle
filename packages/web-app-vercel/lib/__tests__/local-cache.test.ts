/** @jest-environment node */
import { getArticlesCache, setArticlesCache, CachedPlaylistData } from '../local-cache';
import { STORAGE_KEYS } from '../constants';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(global, 'window', {
    value: {
        localStorage: localStorageMock,
    },
    writable: true,
});

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

describe('local-cache', () => {
    const mockUserId = 'user123';
    const cacheKey = `${STORAGE_KEYS.ARTICLES_CACHE}-${mockUserId}`;
    const CACHE_VERSION = 1;
    const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

    const validPayload: CachedPlaylistData = {
        playlistId: 'playlist1',
        playlistName: 'My Playlist',
        items: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.clear();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(Date, 'now').mockReturnValue(1000000000000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getArticlesCache', () => {
        it('should return null when userId is empty', () => {
            expect(getArticlesCache('')).toBeNull();
            expect(localStorageMock.getItem).not.toHaveBeenCalled();
        });

        it('should return null when there is no data in localStorage', () => {
            expect(getArticlesCache(mockUserId)).toBeNull();
            expect(localStorageMock.getItem).toHaveBeenCalledWith(cacheKey);
        });

        it('should return null and warn when parsed cache is an invalid envelope', () => {
            localStorageMock.setItem(cacheKey, JSON.stringify({ invalid: 'data' }));
            expect(getArticlesCache(mockUserId)).toBeNull();
            expect(console.warn).toHaveBeenCalledWith('Invalid cache structure detected');
        });

        it('should return null, warn, and clear cache when version mismatches', () => {
            const invalidVersionData = {
                version: 999, // Mismatched version
                timestamp: Date.now(),
                payload: validPayload,
            };
            localStorageMock.setItem(cacheKey, JSON.stringify(invalidVersionData));
            expect(getArticlesCache(mockUserId)).toBeNull();
            expect(console.warn).toHaveBeenCalledWith('Cache version mismatch; clearing cache');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(cacheKey);
        });

        it('should return null, info, and clear cache when cache is expired', () => {
            const expiredData = {
                version: CACHE_VERSION,
                timestamp: Date.now() - CACHE_TTL_MS - 1000, // Expired
                payload: validPayload,
            };
            localStorageMock.setItem(cacheKey, JSON.stringify(expiredData));
            expect(getArticlesCache(mockUserId)).toBeNull();
            expect(console.info).toHaveBeenCalledWith('Articles cache expired; removing');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(cacheKey);
        });

        it('should return null and warn when payload is an invalid structure', () => {
            const invalidPayloadData = {
                version: CACHE_VERSION,
                timestamp: Date.now(),
                payload: { playlistId: 'onlyId' }, // Missing items and playlistName
            };
            localStorageMock.setItem(cacheKey, JSON.stringify(invalidPayloadData));
            expect(getArticlesCache(mockUserId)).toBeNull();
            expect(console.warn).toHaveBeenCalledWith('Invalid cached payload structure');
        });

        it('should return null and error when JSON.parse throws', () => {
            localStorageMock.setItem(cacheKey, 'invalid json');
            expect(getArticlesCache(mockUserId)).toBeNull();
            expect(console.error).toHaveBeenCalledWith('Failed to read articles cache:', expect.any(Error));
        });

        it('should return parsed payload when valid and not expired', () => {
            const validData = {
                version: CACHE_VERSION,
                timestamp: Date.now(),
                payload: validPayload,
            };
            localStorageMock.setItem(cacheKey, JSON.stringify(validData));
            const result = getArticlesCache(mockUserId);
            expect(result).toEqual(validPayload);
        });
    });

    describe('setArticlesCache', () => {
        it('should do nothing when userId is empty', () => {
            setArticlesCache('', validPayload);
            expect(localStorageMock.setItem).not.toHaveBeenCalled();
        });

        it('should construct envelope and save to localStorage', () => {
            setArticlesCache(mockUserId, validPayload);
            const expectedEnvelope = {
                version: CACHE_VERSION,
                timestamp: Date.now(),
                payload: validPayload,
            };
            expect(localStorageMock.setItem).toHaveBeenCalledWith(cacheKey, JSON.stringify(expectedEnvelope));
        });

        it('should catch QuotaExceededError and warn', () => {
            const error = new Error('Quota exceeded');
            error.name = 'QuotaExceededError';
            localStorageMock.setItem.mockImplementationOnce(() => {
                throw error;
            });

            setArticlesCache(mockUserId, validPayload);
            expect(console.warn).toHaveBeenCalledWith('Failed to save articles to cache (quota exceeded):', error);
        });

        it('should catch generic error and warn', () => {
            const error = new Error('Generic error');
            localStorageMock.setItem.mockImplementationOnce(() => {
                throw error;
            });

            setArticlesCache(mockUserId, validPayload);
            expect(console.warn).toHaveBeenCalledWith('Failed to save articles to cache:', error);
        });
    });
});
