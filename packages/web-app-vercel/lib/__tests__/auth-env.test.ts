import { isTestAuthRuntime, hasSupabaseRuntimeConfig, shouldUseLocalSupabaseFallback } from '../auth-env';

describe('auth-env', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('isTestAuthRuntime', () => {
        it('returns true when AUTH_ENV is test', () => {
            process.env.AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns true when NEXT_PUBLIC_AUTH_ENV is test', () => {
            process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns false when neither is test', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'production';
            expect(isTestAuthRuntime()).toBe(false);
        });

        it('returns false when env vars are missing', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            expect(isTestAuthRuntime()).toBe(false);
        });
    });

    describe('hasSupabaseRuntimeConfig', () => {
        it('returns true when both URL and ANON_KEY are present', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
            expect(hasSupabaseRuntimeConfig()).toBe(true);
        });

        it('returns false when URL is missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('returns false when ANON_KEY is missing', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
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
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('returns true when hasSupabaseRuntimeConfig is false', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('returns false when isTestAuthRuntime is false and hasSupabaseRuntimeConfig is true', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
            expect(shouldUseLocalSupabaseFallback()).toBe(false);
        });
    });
});
