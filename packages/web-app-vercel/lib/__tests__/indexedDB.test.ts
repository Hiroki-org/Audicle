import { generateKey } from '../indexedDB';

describe('generateKey', () => {
    it('should generate a key with all arguments provided', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 5;
        const voiceModel = 'en-US-Neural2-F';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent(articleUrl)}:5:${encodeURIComponent(voiceModel)}`);
    });

    it('should generate a key with default voiceModel when not provided', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 2;

        const result = generateKey(articleUrl, chunkIndex);

        expect(result).toBe(`${encodeURIComponent(articleUrl)}:2:default`);
    });

    it('should generate a key with default voiceModel when provided as an empty string', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 0;
        const voiceModel = '';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent(articleUrl)}:0:default`);
    });

    it('should handle complex URLs and different index values', () => {
        const articleUrl = 'https://example.com/path/to/article?param1=value1&param2=value2#hash';
        const chunkIndex = 999;
        const voiceModel = 'ja-JP-Standard-A';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent(articleUrl)}:999:${encodeURIComponent(voiceModel)}`);
    });
});
