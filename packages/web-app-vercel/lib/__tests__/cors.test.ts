import { getCorsHeaders } from '../cors';

describe('getCorsHeaders', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should return default headers when requestOrigin is null', () => {
        process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
        const headers = getCorsHeaders(null);

        expect(headers).toEqual({
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should include Access-Control-Allow-Origin when requestOrigin is in ALLOWED_ORIGINS', () => {
        process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
        const headers = getCorsHeaders('https://example.com');

        expect(headers).toEqual({
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': 'https://example.com',
        });
    });

    it('should NOT include Access-Control-Allow-Origin when requestOrigin is NOT in ALLOWED_ORIGINS', () => {
        process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
        const headers = getCorsHeaders('https://malicious.com');

        expect(headers).toEqual({
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should handle empty ALLOWED_ORIGINS', () => {
        process.env.ALLOWED_ORIGINS = '';
        const headers = getCorsHeaders('http://localhost:3000');

        expect(headers).toEqual({
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should handle ALLOWED_ORIGINS with whitespace', () => {
        process.env.ALLOWED_ORIGINS = ' http://localhost:3000 , https://example.com  ';
        const headers1 = getCorsHeaders('http://localhost:3000');
        const headers2 = getCorsHeaders('https://example.com');

        expect(headers1['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
        expect(headers2['Access-Control-Allow-Origin']).toBe('https://example.com');
    });
});
