import { generateKey } from '../indexedDB';

describe('generateKey', () => {
    it('should generate a key with all arguments provided', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 5;
        const voiceModel = 'en-US-Neural2-F';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent('https://example.com/article')}:5:${encodeURIComponent('en-US-Neural2-F')}`);
    });

    it('should generate a key with default voiceModel when not provided', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 2;

        const result = generateKey(articleUrl, chunkIndex);

        expect(result).toBe(`${encodeURIComponent('https://example.com/article')}:2:${encodeURIComponent('default')}`);
    });

    it('should generate a key with default voiceModel when provided as an empty string', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 0;
        const voiceModel = '';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent('https://example.com/article')}:0:${encodeURIComponent('default')}`);
    });

    it('should handle complex URLs and different index values', () => {
        const articleUrl = 'https://example.com/path/to/article?param1=value1&param2=value2#hash';
        const chunkIndex = 999;
        const voiceModel = 'ja-JP-Standard-A';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent('https://example.com/path/to/article?param1=value1&param2=value2#hash')}:999:${encodeURIComponent('ja-JP-Standard-A')}`);
    });
});
