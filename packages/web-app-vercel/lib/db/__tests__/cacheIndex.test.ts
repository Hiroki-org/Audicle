import { isCachedInIndex, CacheIndex } from '../cacheIndex';

describe('isCachedInIndex', () => {
    it('returns false if index is null', () => {
        expect(isCachedInIndex(null, 'someHash')).toBe(false);
    });

    it('returns false if textHash is not in cached_chunks', () => {
        const mockIndex: CacheIndex = {
            article_url: 'https://example.com',
            voice: 'en-US-Standard-A',
            cached_chunks: ['hash1', 'hash2'],
            completed_playback: false,
            read_count: 0,
            last_accessed: new Date().toISOString(),
        };
        expect(isCachedInIndex(mockIndex, 'hash3')).toBe(false);
    });

    it('returns true if textHash is in cached_chunks', () => {
        const mockIndex: CacheIndex = {
            article_url: 'https://example.com',
            voice: 'en-US-Standard-A',
            cached_chunks: ['hash1', 'hash2', 'hash3'],
            completed_playback: false,
            read_count: 0,
            last_accessed: new Date().toISOString(),
        };
        expect(isCachedInIndex(mockIndex, 'hash2')).toBe(true);
    });
});
