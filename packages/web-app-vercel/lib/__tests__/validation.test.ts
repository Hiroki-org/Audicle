import { validateUrl } from '../validation';

describe('validateUrl', () => {
    describe('Valid URLs', () => {
        it('should return true for valid HTTP URLs', () => {
            expect(validateUrl('http://example.com')).toBe(true);
            expect(validateUrl('http://www.example.com/path?query=1')).toBe(true);
        });

        it('should return true for valid HTTPS URLs', () => {
            expect(validateUrl('https://example.com')).toBe(true);
            expect(validateUrl('https://www.example.com/path?query=1#hash')).toBe(true);
        });
    });

    describe('Invalid and Dangerous Schemes', () => {
        it('should return false for javascript: scheme', () => {
            expect(validateUrl('javascript:alert(1)')).toBe(false);
            expect(validateUrl('javascript://%250Aalert(1)')).toBe(false);
        });

        it('should return false for data: scheme', () => {
            expect(validateUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
        });

        it('should return false for file: scheme', () => {
            expect(validateUrl('file:///etc/passwd')).toBe(false);
        });

        it('should return false for ftp: scheme', () => {
            expect(validateUrl('ftp://example.com/file.zip')).toBe(false);
        });
    });

    describe('Malformed and Edge Case URLs', () => {
        it('should return false for malformed URLs', () => {
            expect(validateUrl('not a url')).toBe(false);
            expect(validateUrl('://missing.scheme')).toBe(false);
            expect(validateUrl('')).toBe(false);
        });

        it('should handle URLs with surrounding whitespace', () => {
            expect(validateUrl('  https://example.com  ')).toBe(true);
        });

        it('should handle uppercase schemes properly (new URL normalizes this)', () => {
            expect(validateUrl('HTTPS://EXAMPLE.COM')).toBe(true);
            expect(validateUrl('HTTP://example.com')).toBe(true);
        });
    });
});
