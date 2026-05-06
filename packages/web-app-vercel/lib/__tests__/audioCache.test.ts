import { AudioCache } from '../audioCache';
import { synthesizeSpeech } from '../api';

// Mock synthesizeSpeech
jest.mock('../api', () => ({
    synthesizeSpeech: jest.fn().mockResolvedValue(new Blob(['test'], { type: 'audio/wav' })),
}));

describe('AudioCache', () => {
    let cache: AudioCache;

    beforeEach(() => {
        cache = new AudioCache();
        (synthesizeSpeech as jest.Mock).mockReset();
        (synthesizeSpeech as jest.Mock).mockResolvedValue(new Blob(['test'], { type: 'audio/wav' }));
        // Clear cache before each test
        cache.clear();
    });

    describe('getCacheKey', () => {
        it('should generate consistent cache key for same inputs', () => {
            const instance = cache as unknown;
            const key1 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('test text', 'voice1', 'url1');
            const key2 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('test text', 'voice1', 'url1');
            expect(key1).toBe(key2);
        });

        it('should generate different keys for different text', () => {
            const instance = cache as unknown;
            const key1 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('text1', 'voice1');
            const key2 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('text2', 'voice1');
            expect(key1).not.toBe(key2);
        });

        it('should generate different keys for different voice models', () => {
            const instance = cache as unknown;
            const key1 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('text', 'voice1');
            const key2 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('text', 'voice2');
            expect(key1).not.toBe(key2);
        });

        it('should include articleUrl in key when provided', () => {
            const instance = cache as unknown;
            const key1 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('text', 'voice1');
            const key2 = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('text', 'voice1', 'url1');
            expect(key1).not.toBe(key2);
            expect(key2).toContain('url1');
        });

        it('should handle empty string', () => {
            const instance = cache as unknown;
            const key = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('', 'voice1');
            expect(typeof key).toBe('string');
            expect(key).toContain('audio_');
        });

        it('should handle special characters', () => {
            const instance = cache as unknown;
            const key = (instance as { getCacheKey: (text: string, voiceModel?: string, articleUrl?: string) => string }).getCacheKey('特殊文字: !@#', 'voice1');
            expect(typeof key).toBe('string');
        });
    });

    describe('hashString', () => {
        it('should return a string hash', () => {
            const instance = cache as unknown;
            const hash = (instance as { hashString: (s: string) => string }).hashString('test');
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        it('should produce consistent results', () => {
            const instance = cache as unknown;
            const hash1 = (instance as { hashString: (s: string) => string }).hashString('test');
            const hash2 = (instance as { hashString: (s: string) => string }).hashString('test');
            expect(hash1).toBe(hash2);
        });

        it('should produce different results for different strings', () => {
            const instance = cache as unknown;
            const hash1 = (instance as { hashString: (s: string) => string }).hashString('test1');
            const hash2 = (instance as { hashString: (s: string) => string }).hashString('test2');
            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty string', () => {
            const instance = cache as unknown;
            const hash = (instance as { hashString: (s: string) => string }).hashString('');
            expect(typeof hash).toBe('string');
        });

        it('should handle long string', () => {
            const instance = cache as unknown;
            const longStr = 'a'.repeat(1000);
            const hash = (instance as { hashString: (s: string) => string }).hashString(longStr);
            expect(typeof hash).toBe('string');
        });
    });

    describe('get', () => {
        it('should call synthesizeSpeech on cache miss and return a blob URL', async () => {
            const { synthesizeSpeech } = require('../api');
            const url = await cache.get('test text', 'voice1', 'url1');
            expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
            expect(synthesizeSpeech).toHaveBeenCalledWith('test text', undefined, 'voice1', 'url1');
            expect(url).toMatch(/^blob:/);
        });

        it('should not call synthesizeSpeech on cache hit', async () => {
            // Clear mocks to have a clean slate for this test
            (synthesizeSpeech as jest.Mock).mockClear();

            await cache.get('test text', 'voice1', 'url1'); // First call, miss
            await cache.get('test text', 'voice1', 'url1'); // Second call, hit
            expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
        });

        it('should share one in-flight synthesis for concurrent requests with the same key', async () => {
            let resolveSpeech!: (_blob: Blob) => void;
            (synthesizeSpeech as jest.Mock).mockReturnValueOnce(
                new Promise<Blob>((resolve) => {
                    resolveSpeech = resolve;
                })
            );

            const first = cache.get('same text', 'voice1', 'url1');
            const second = cache.get('same text', 'voice1', 'url1');

            expect(synthesizeSpeech).toHaveBeenCalledTimes(1);

            resolveSpeech(new Blob(['deduped'], { type: 'audio/wav' }));

            await expect(Promise.all([first, second])).resolves.toEqual([
                expect.stringMatching(/^blob:/),
                expect.stringMatching(/^blob:/),
            ]);
            expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
        });

        it('should remove a failed in-flight request so a later call can retry', async () => {
            const error = new Error('synthesis failed');
            (synthesizeSpeech as jest.Mock)
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce(new Blob(['retry'], { type: 'audio/wav' }));

            await expect(cache.get('retry text', 'voice1', 'url1')).rejects.toThrow('synthesis failed');

            const retryUrl = await cache.get('retry text', 'voice1', 'url1');

            expect(retryUrl).toMatch(/^blob:/);
            expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
        });

        it('should track an in-flight result that finishes after clear so it remains revocable', async () => {
            let resolveSpeech!: (_blob: Blob) => void;
            (synthesizeSpeech as jest.Mock)
                .mockReturnValueOnce(
                    new Promise<Blob>((resolve) => {
                        resolveSpeech = resolve;
                    })
                )
                .mockResolvedValueOnce(new Blob(['unexpected-resynthesis'], { type: 'audio/wav' }));

            const pending = cache.get('clear text', 'voice1', 'url1');

            cache.clear();
            resolveSpeech(new Blob(['stale'], { type: 'audio/wav' }));

            await expect(pending).resolves.toMatch(/^blob:/);
            await expect(cache.get('clear text', 'voice1', 'url1')).resolves.toMatch(/^blob:/);

            expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
        });
    });
});
