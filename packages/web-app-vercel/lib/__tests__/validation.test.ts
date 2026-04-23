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

    it('should be case-insensitive for the protocol', () => {
        expect(validateUrl('HTTP://example.com')).toBe(true);
        expect(validateUrl('HTTPS://example.com')).toBe(true);
        expect(validateUrl('Http://example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
        expect(validateUrl('not-a-url')).toBe(false);
        expect(validateUrl('example.com')).toBe(false); // missing scheme
        expect(validateUrl('')).toBe(false);
        expect(validateUrl(' ')).toBe(false);
    });

    it.each([
        ['javascript:alert(1)', 'javascript'],
        ['data:text/html,<h1>test</h1>', 'data'],
        ['file:///etc/passwd', 'file'],
        ['ftp://example.com', 'ftp'],
        ['ws://example.com', 'ws'],
        ['wss://example.com', 'wss'],
        ['chrome://settings', 'chrome'],
        ['mailto:test@example.com', 'mailto'],
    ])('should return false for %s (%s protocol)', (url) => {
        expect(validateUrl(url)).toBe(false);
    });

    it('should return false for malformed URLs that throw during parsing', () => {
        // URLs without a valid host after the scheme
        expect(validateUrl('http://')).toBe(false);
        // Unmatched brackets in IPv6
        expect(validateUrl('http://[::1')).toBe(false);
    });
});
