import { calculateTextHash } from '../textHash';

describe('calculateTextHash', () => {
    it('should return a string hash for valid input', () => {
        const text = 'test text';
        const index = 1;
        const hash = calculateTextHash(text, index);
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64); // SHA256 hash length
    });

    it('should produce consistent results for the same input', () => {
        const text = 'consistent text';
        const index = 2;
        const hash1 = calculateTextHash(text, index);
        const hash2 = calculateTextHash(text, index);
        expect(hash1).toBe(hash2);
    });

    it('should produce different results for different text', () => {
        const hash1 = calculateTextHash('text1', 1);
        const hash2 = calculateTextHash('text2', 1);
        expect(hash1).not.toBe(hash2);
    });

    it('should produce different results for different index', () => {
        const text = 'same text';
        const hash1 = calculateTextHash(text, 1);
        const hash2 = calculateTextHash(text, 2);
        expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
        const hash = calculateTextHash('', 0);
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64);
    });

    it('should handle long string', () => {
        const longText = 'a'.repeat(10000);
        const hash = calculateTextHash(longText, 1);
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64);
    });

    it('should handle special characters', () => {
        const specialText = '特殊文字: !@#$%^&*()';
        const hash = calculateTextHash(specialText, 1);
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64);
    });
});