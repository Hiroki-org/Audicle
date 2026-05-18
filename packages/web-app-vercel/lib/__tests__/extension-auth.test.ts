import { createExtensionToken, validateExtensionRedirectUri, verifyExtensionToken } from '../extension-auth';

describe('extension-auth', () => {
    const originalEnv = process.env;
    const originalWarn = console.warn;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.AUTH_SECRET = 'test-secret';
        process.env.EXTENSION_AUTH_SECRET = 'test-secret';
        process.env.NODE_ENV = 'test';
        console.warn = jest.fn(); // Suppress warnings in test output
        
        // Clear module cache to allow testing getExtensionAuthSecret caching
        jest.resetModules();
    });

    afterEach(() => {
        process.env = originalEnv;
        console.warn = originalWarn;
    });

    it('creates and verifies extension token', async () => {
        // Re-import to trigger getExtensionAuthSecret caching per-test
        const { createExtensionToken: createToken, verifyExtensionToken: verifyToken } = await import('../extension-auth');
        
        const { token } = createToken({
            id: 'user-id-1',
            email: 'user@example.com',
        });

        const payload = verifyToken(token);
        expect(payload).toEqual({
            sub: 'user-id-1',
            email: 'user@example.com',
        });
    });

    it('falls back to AUTH_SECRET when EXTENSION_AUTH_SECRET is not set', async () => {
        delete process.env.EXTENSION_AUTH_SECRET;
        
        const { createExtensionToken: createToken, verifyExtensionToken: verifyToken } = await import('../extension-auth');
        
        const { token } = createToken({
            id: 'user-id-1',
            email: 'user@example.com',
        });

        const payload = verifyToken(token);
        expect(payload.email).toBe('user@example.com');
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('EXTENSION_AUTH_SECRET is not set. Falling back to AUTH_SECRET'));
    });

    it('validates chromiumapp redirect uri', async () => {
        const { validateExtensionRedirectUri: validateUri } = await import('../extension-auth');
        expect(validateUri('https://abc123.chromiumapp.org/audicle-auth')).toBe(true);
        expect(validateUri('https://abc123.chromiumapp.org/wrong')).toBe(false);
        expect(validateUri('https://example.com/audicle-auth')).toBe(false);
    });
});
