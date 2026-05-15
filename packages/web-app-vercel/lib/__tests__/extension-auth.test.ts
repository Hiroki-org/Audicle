import { createExtensionToken, validateExtensionRedirectUri, verifyExtensionToken } from '../extension-auth';

describe('extension-auth', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.AUTH_SECRET = 'test-secret';
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('creates and verifies extension token', () => {
        const { token } = createExtensionToken({
            id: 'user-id-1',
            email: 'user@example.com',
        });

        const payload = verifyExtensionToken(token);
        expect(payload).toEqual({
            sub: 'user-id-1',
            email: 'user@example.com',
        });
    });

    it('validates chromiumapp redirect uri', () => {
        expect(validateExtensionRedirectUri('https://abc123.chromiumapp.org/audicle-auth')).toBe(true);
        expect(validateExtensionRedirectUri('https://abc123.chromiumapp.org/wrong')).toBe(false);
        expect(validateExtensionRedirectUri('https://example.com/audicle-auth')).toBe(false);
    });
});
