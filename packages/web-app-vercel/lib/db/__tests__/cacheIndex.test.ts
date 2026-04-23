import { isCachedInIndex, CacheIndex } from '../cacheIndex';

describe('isCachedInIndex', () => {
    const createCacheIndex = (cached_chunks: string[] | null = []): CacheIndex => ({
        article_url: 'https://example.com',
        voice: 'en-US-Standard-A',
        cached_chunks: cached_chunks as string[], // Type assertion needed if we test null, but we'll cast at the call site if needed to avoid TS errors
        completed_playback: false,
        read_count: 0,
        last_accessed: new Date().toISOString(),
    });

    it('returns false if index is null', () => {
        expect(isCachedInIndex(null, 'someHash')).toBe(false);
    });

    it('returns false if textHash is not in cached_chunks', () => {
        const mockIndex = createCacheIndex(['hash1', 'hash2']);
        expect(isCachedInIndex(mockIndex, 'hash3')).toBe(false);
    });

    it('returns true if textHash is in cached_chunks', () => {
        const mockIndex = createCacheIndex(['hash1', 'hash2', 'hash3']);
        expect(isCachedInIndex(mockIndex, 'hash2')).toBe(true);
    });

    it('returns false if cached_chunks is empty', () => {
        const mockIndex = createCacheIndex([]);
        expect(isCachedInIndex(mockIndex, 'hash1')).toBe(false);
    });

    it('returns false if cached_chunks is null', () => {
        // Construct it without the helper since the helper enforces string[] via the CacheIndex type
        const mockIndex = {
            article_url: 'https://example.com',
            voice: 'en-US-Standard-A',
            cached_chunks: null,
            completed_playback: false,
            read_count: 0,
            last_accessed: new Date().toISOString(),
        } as unknown as CacheIndex;
        expect(isCachedInIndex(mockIndex, 'hash1')).toBe(false);
    });

    it('returns false if cached_chunks is undefined', () => {
        const mockIndex = {
            article_url: 'https://example.com',
            voice: 'en-US-Standard-A',
            cached_chunks: undefined,
            completed_playback: false,
            read_count: 0,
            last_accessed: new Date().toISOString(),
        } as unknown as CacheIndex;
        expect(isCachedInIndex(mockIndex, 'hash1')).toBe(false);
    });
});