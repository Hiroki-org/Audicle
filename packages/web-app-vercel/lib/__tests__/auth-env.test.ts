import {
    isTestAuthRuntime,
    hasSupabaseRuntimeConfig,
    shouldUseLocalSupabaseFallback,
} from '../auth-env';

describe('auth-env', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('isTestAuthRuntime', () => {
        it('returns true when AUTH_ENV is test', () => {
            process.env.AUTH_ENV = 'test';
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns true when NEXT_PUBLIC_AUTH_ENV is test', () => {
            delete process.env.AUTH_ENV;
            process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns false when neither is test', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'production';
            expect(isTestAuthRuntime()).toBe(false);
        });

        it('returns false when variables are undefined', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            expect(isTestAuthRuntime()).toBe(false);
        });
    });

    describe('hasSupabaseRuntimeConfig', () => {
        it('returns true when both variables are defined', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
            expect(hasSupabaseRuntimeConfig()).toBe(true);
        });

        it('returns false when URL is missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('returns false when ANON_KEY is missing', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('returns false when both are missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });
    });

    describe('shouldUseLocalSupabaseFallback', () => {
        it('returns true when isTestAuthRuntime is true', () => {
            process.env.AUTH_ENV = 'test';
            // Even if config is present
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('returns true when config is missing', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('returns false when not test runtime and config is present', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
            expect(shouldUseLocalSupabaseFallback()).toBe(false);
        });
    });
});
