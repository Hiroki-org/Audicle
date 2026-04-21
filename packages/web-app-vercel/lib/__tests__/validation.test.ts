import { validateUrl } from '../validation';

describe('validateUrl', () => {
    it('should return true for valid http URLs', () => {
        expect(validateUrl('http://example.com')).toBe(true);
        expect(validateUrl('http://localhost:3000')).toBe(true);
        expect(validateUrl('http://example.com/path?query=1#hash')).toBe(true);
    });

    it('should return true for valid https URLs', () => {
        expect(validateUrl('https://example.com')).toBe(true);
        expect(validateUrl('https://sub.example.com/path')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
        expect(validateUrl('not-a-url')).toBe(false);
        expect(validateUrl('example.com')).toBe(false); // missing scheme
        expect(validateUrl('')).toBe(false);
        expect(validateUrl(' ')).toBe(false);
    });

    it('should return false for unsupported or dangerous protocols', () => {
        expect(validateUrl('javascript:alert(1)')).toBe(false);
        expect(validateUrl('data:text/html,<h1>test</h1>')).toBe(false);
        expect(validateUrl('file:///etc/passwd')).toBe(false);
        expect(validateUrl('ftp://example.com')).toBe(false);
        expect(validateUrl('ws://example.com')).toBe(false);
        expect(validateUrl('wss://example.com')).toBe(false);
        expect(validateUrl('chrome://settings')).toBe(false);
        expect(validateUrl('mailto:test@example.com')).toBe(false);
    });

    it('should return false for malformed URLs that throw during parsing', () => {
        expect(validateUrl('http://%')).toBe(false); // Valid scheme but might fail URL constructor in some environments depending on strictness
        // Node's URL parser throws on this:
        expect(validateUrl('http://[::1')).toBe(false);
    });
});
