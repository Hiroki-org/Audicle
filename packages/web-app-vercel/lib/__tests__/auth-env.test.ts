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
        it('should return true if AUTH_ENV is "test"', () => {
            process.env.AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('should return true if NEXT_PUBLIC_AUTH_ENV is "test"', () => {
            process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('should return false if neither is "test"', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'production';
            expect(isTestAuthRuntime()).toBe(false);
        });

        it('should return false if they are not set', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            expect(isTestAuthRuntime()).toBe(false);
        });
    });

    describe('hasSupabaseRuntimeConfig', () => {
        it('should return true if both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
            expect(hasSupabaseRuntimeConfig()).toBe(true);
        });

        it('should return false if only NEXT_PUBLIC_SUPABASE_URL is set', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com';
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('should return false if only NEXT_PUBLIC_SUPABASE_ANON_KEY is set', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('should return false if neither are set', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });
    });

    describe('shouldUseLocalSupabaseFallback', () => {
        it('should return true if isTestAuthRuntime is true', () => {
            process.env.AUTH_ENV = 'test';
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('should return true if hasSupabaseRuntimeConfig is false', () => {
            process.env.AUTH_ENV = 'production';
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('should return false if isTestAuthRuntime is false and hasSupabaseRuntimeConfig is true', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
            expect(shouldUseLocalSupabaseFallback()).toBe(false);
        });
    });
});
